import { visibleFieldsFor } from "./conditions";
import { buildDefaultValues } from "./defaults";
import type { InferValues } from "./inferValues";
import { mergeMessages, type Messages } from "./messages";
import { validateFormConfig } from "./schema";
import type { ServerErrorResult } from "./serverErrors";
import { isBuiltInField } from "./types";
import type { AnyFieldConfig, FormConfig, FormValues } from "./types";
import { buildFieldsSchema, type OtpVerifiedChecker } from "./validation";

export type ParseSubmissionErrorCode =
  | "invalid_body"
  | "otp_checker_missing"
  | "otp_in_group"
  | "input_too_large"
  | "validation_failed";

export type ParseSubmissionOptions = {
  otpVerified?: OtpVerifiedChecker;
  messages?: Partial<Messages>;
  maxStringLength?: number;
};

export type ParseSubmissionResult<V = FormValues> =
  | { ok: true; values: V; unvalidated: string[] }
  | { ok: false; code: ParseSubmissionErrorCode; errors: ServerErrorResult; unvalidated: string[] };

const DEFAULT_MAX_STRING_LENGTH = 10_000;

export const GENERIC_SUBMISSION_ERROR = "We couldn't process your submission. Please try again.";

const RESERVED_KEYS = ["__proto__", "constructor", "prototype"] as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false;
  if (Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function scrubReservedKeys(fields: AnyFieldConfig[], body: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = { ...body };
  for (const key of RESERVED_KEYS) delete cleaned[key];
  for (const field of fields) {
    if (!isBuiltInField(field) || field.type !== "group") continue;
    const rows = cleaned[field.name];
    if (!Array.isArray(rows)) continue;
    const rowFields = Array.isArray(field.fields) ? field.fields : [];
    cleaned[field.name] = rows.map((row) => (isPlainObject(row) ? scrubReservedKeys(rowFields, row) : row));
  }
  return cleaned;
}

function hasGroupOtp(fields: AnyFieldConfig[], insideGroup: boolean): boolean {
  for (const field of fields) {
    if (!isBuiltInField(field)) continue;
    if (field.type === "otp" && insideGroup) return true;
    if (field.type === "group" && hasGroupOtp(field.fields, true)) return true;
  }
  return false;
}

function cloneHiddenValue(value: unknown): unknown {
  try {
    return structuredClone(value);
  } catch {
    return value;
  }
}

function reinjectHiddenFields(fields: AnyFieldConfig[], body: Record<string, unknown>): Record<string, unknown> {
  const injected: Record<string, unknown> = { ...body };
  for (const field of fields) {
    if (!isBuiltInField(field)) continue;
    if (field.type === "hidden") {
      injected[field.name] = cloneHiddenValue(field.value);
      continue;
    }
    if (field.type !== "group") continue;
    const rows = injected[field.name];
    if (!Array.isArray(rows)) continue;
    const rowFields = Array.isArray(field.fields) ? field.fields : [];
    injected[field.name] = rows.map((row) => (isPlainObject(row) ? reinjectHiddenFields(rowFields, row) : row));
  }
  return injected;
}

function reassertHiddenFields(fields: AnyFieldConfig[], values: Record<string, unknown>): Record<string, unknown> {
  const asserted: Record<string, unknown> = { ...values };
  for (const field of fields) {
    if (!isBuiltInField(field)) continue;
    if (field.type === "hidden") {
      if (field.name in asserted) asserted[field.name] = cloneHiddenValue(field.value);
      continue;
    }
    if (field.type !== "group") continue;
    const rows = asserted[field.name];
    if (!Array.isArray(rows)) continue;
    const rowFields = Array.isArray(field.fields) ? field.fields : [];
    asserted[field.name] = rows.map((row) => (isPlainObject(row) ? reassertHiddenFields(rowFields, row) : row));
  }
  return asserted;
}

const MAX_STRING_LENGTH_CHECK_DEPTH = 32;

function exceedsMaxStringLength(value: unknown, maxLength: number, depth = 0): boolean {
  if (depth > MAX_STRING_LENGTH_CHECK_DEPTH) return true;
  if (typeof value === "string") return value.length > maxLength;
  if (Array.isArray(value)) return value.some((entry) => exceedsMaxStringLength(entry, maxLength, depth + 1));
  if (isPlainObject(value)) {
    return Object.values(value).some((entry) => exceedsMaxStringLength(entry, maxLength, depth + 1));
  }
  return false;
}

function partitionValidatable(
  fields: AnyFieldConfig[],
  prefix: string,
): { schemaFields: AnyFieldConfig[]; unvalidated: string[] } {
  const schemaFields: AnyFieldConfig[] = [];
  const unvalidated: string[] = [];
  for (const field of fields) {
    const path = prefix ? `${prefix}.${field.name}` : field.name;
    const isFile = isBuiltInField(field) && field.type === "file";
    if (isFile || !isBuiltInField(field)) unvalidated.push(path);
    if (isFile) continue;
    if (isBuiltInField(field) && field.type === "group") {
      const rowFields = Array.isArray(field.fields) ? field.fields : [];
      const nested = partitionValidatable(rowFields, path);
      unvalidated.push(...nested.unvalidated);
      schemaFields.push({ ...field, fields: nested.schemaFields });
      continue;
    }
    schemaFields.push(field);
  }
  return { schemaFields, unvalidated };
}

function reinjectNestedFileValues(
  fields: AnyFieldConfig[],
  values: Record<string, unknown>,
  scrubbed: Record<string, unknown>,
): void {
  for (const field of fields) {
    if (!isBuiltInField(field) || field.type !== "group") continue;
    const valueRows = values[field.name];
    const scrubbedRows = scrubbed[field.name];
    if (!Array.isArray(valueRows) || !Array.isArray(scrubbedRows)) continue;
    const rowFields = Array.isArray(field.fields) ? field.fields : [];
    for (let i = 0; i < valueRows.length; i++) {
      const valueRow = valueRows[i];
      const scrubbedRow = scrubbedRows[i];
      if (!isPlainObject(valueRow) || !isPlainObject(scrubbedRow)) continue;
      for (const rowField of rowFields) {
        if (isBuiltInField(rowField) && rowField.type === "file" && rowField.name in scrubbedRow) {
          valueRow[rowField.name] = scrubbedRow[rowField.name];
        }
      }
      reinjectNestedFileValues(rowFields, valueRow, scrubbedRow);
    }
  }
}

type MinimalIssue = { path: PropertyKey[]; message: string };

function mapIssuesToServerErrors(issues: MinimalIssue[]): ServerErrorResult {
  const fieldErrors: Record<string, string> = {};
  const formParts: string[] = [];
  for (const issue of issues) {
    if (issue.path.length === 0) {
      formParts.push(issue.message);
      continue;
    }
    const key = issue.path.map(String).join(".");
    if (!(key in fieldErrors)) fieldErrors[key] = issue.message;
  }
  const result: ServerErrorResult = {};
  if (Object.keys(fieldErrors).length > 0) result.fieldErrors = fieldErrors;
  if (formParts.length > 0) result.formError = formParts.join("; ");
  return result;
}

export function parseSubmission<C extends FormConfig = FormConfig>(
  config: C,
  rawBody: unknown,
  opts?: ParseSubmissionOptions,
): ParseSubmissionResult<InferValues<C>> {
  if (!isPlainObject(rawBody)) {
    return { ok: false, code: "invalid_body", errors: { formError: GENERIC_SUBMISSION_ERROR }, unvalidated: [] };
  }

  const scrubbed = scrubReservedKeys(config.fields, rawBody);

  validateFormConfig(config);

  const messages = mergeMessages(opts?.messages);

  if (hasGroupOtp(config.fields, false)) {
    return { ok: false, code: "otp_in_group", errors: { formError: GENERIC_SUBMISSION_ERROR }, unvalidated: [] };
  }

  const defaults = buildDefaultValues(config.fields);
  const seeded: Record<string, unknown> = { ...defaults };
  for (const [key, value] of Object.entries(scrubbed)) {
    if (value === undefined && key in defaults) continue;
    seeded[key] = value;
  }
  const injected = reinjectHiddenFields(config.fields, seeded);

  const maxStringLength = opts?.maxStringLength ?? DEFAULT_MAX_STRING_LENGTH;
  if (exceedsMaxStringLength(scrubbed, maxStringLength)) {
    return { ok: false, code: "input_too_large", errors: { formError: GENERIC_SUBMISSION_ERROR }, unvalidated: [] };
  }

  const visibleFields = visibleFieldsFor(config, injected as FormValues);

  const { schemaFields, unvalidated } = partitionValidatable(visibleFields, "");

  const otpFieldNames = schemaFields
    .filter((field) => isBuiltInField(field) && field.type === "otp")
    .map((field) => field.name);
  if (otpFieldNames.length > 0 && opts?.otpVerified === undefined) {
    const fieldErrors: Record<string, string> = {};
    for (const name of otpFieldNames) fieldErrors[name] = messages.otpNotVerified;
    return {
      ok: false,
      code: "otp_checker_missing",
      errors: { fieldErrors, formError: GENERIC_SUBMISSION_ERROR },
      unvalidated,
    };
  }

  const schema = buildFieldsSchema(schemaFields, messages, opts?.otpVerified);
  const parsed = schema.safeParse(injected);

  if (!parsed.success) {
    return {
      ok: false,
      code: "validation_failed",
      errors: mapIssuesToServerErrors(parsed.error.issues),
      unvalidated,
    };
  }

  const values = reassertHiddenFields(config.fields, parsed.data as Record<string, unknown>) as FormValues;

  for (const field of visibleFields) {
    if (isBuiltInField(field) && field.type === "file" && field.name in scrubbed) {
      values[field.name] = injected[field.name];
    }
  }
  reinjectNestedFileValues(visibleFields, values, scrubbed);

  return { ok: true, values: values as InferValues<C>, unvalidated };
}
