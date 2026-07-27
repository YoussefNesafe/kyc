import { z } from "zod";
import { getCountries, isValidPhoneNumber } from "libphonenumber-js";
import { assertNever } from "./assertNever";
import { visibleFieldsFor } from "./conditions";
import { acceptedFormatsLabel, fileExtensionLabel, fileMatchesAccept } from "./fileAccept";
import type { Messages } from "./messages";
import { getPasswordChecks } from "./password";
import { isBuiltInField } from "./types";
import type { AnyFieldConfig, FieldConfig, FormConfig, FormValues, Option, TextRules } from "./types";
import { BYTES_PER_MB } from "./units";

type FieldSchema = z.ZodType | null;

const ISO_DATE_LENGTH = 10;
const MIN_RATING = 1;
const DEFAULT_RATING_MAX = 5;

function optionValueSchema(options: Option[], requiredMessage?: string): z.ZodType {
  const error = requiredMessage;
  const hasString = options.some((option) => typeof option.value === "string");
  const hasNumber = options.some((option) => typeof option.value === "number");
  if (hasString && hasNumber) return z.union([z.string(), z.number()], { error });
  return hasNumber ? z.number({ error }) : z.string({ error });
}

function optionalEmptyable(schema: z.ZodType): z.ZodType {
  return z.preprocess((value) => (value === "" ? undefined : value), schema.optional());
}

function optionalClearable(schema: z.ZodType): z.ZodType {
  return z.preprocess(
    (value) => (value === null || value === "" || (typeof value === "number" && Number.isNaN(value)) ? undefined : value),
    schema.optional(),
  );
}

function withTrim(rules: TextRules | undefined, schema: z.ZodType): z.ZodType {
  if (!rules?.trim) return schema;
  return z.preprocess((value) => (typeof value === "string" ? value.trim() : value), schema);
}

function applyTextRules(schema: z.ZodString, rules: TextRules | undefined, messages: Messages): z.ZodString {
  let result = schema;
  if (rules?.minLength !== undefined) result = result.min(rules.minLength, messages.minLength(rules.minLength));
  if (rules?.maxLength !== undefined) result = result.max(rules.maxLength, messages.maxLength(rules.maxLength));
  if (rules?.pattern !== undefined) {
    try {
      result = result.regex(new RegExp(rules.pattern), rules.message ?? messages.pattern);
    } catch {
    }
  }
  return result;
}

function datePart(value: string): string {
  return value.slice(0, ISO_DATE_LENGTH);
}

/**
 * The schema for one ISO date value — the whole field when it is a single date,
 * and each of `from`/`to` when it is a range, which is why `field.message`
 * lands on both endpoints.
 *
 * `field.message` replaces the bound messages only. A value that is not a date
 * at all keeps `messages.invalidDate`: the override explains a rule, and a
 * typo has not reached the rule yet.
 *
 * The override is reported before the `minDateField`/`maxDateField` message
 * when a field carries both a static bound and a cross-field rule and both
 * fail — these refinements run inside the field's own schema, and the
 * cross-field pass is a `superRefine` on the enclosing object, which Zod runs
 * afterwards. Under react-hook-form's default `criteriaMode: "firstError"` only
 * the leading issue per path reaches the user, so this ordering decides which
 * sentence they read. It is the intended one: the override was written for this
 * field's rule, whereas the cross-field message is derivable from the form. As
 * with the type-before-size ordering in `fileIssueReporter`, moving either
 * check out of its current pass is a user-visible change.
 */
function isoDateSchema(field: Extract<FieldConfig, { type: "date" }>, messages: Messages): z.ZodType<string> {
  let schema = z
    .string({ error: field.required ? messages.required : undefined })
    .refine(
      (value) => /^\d{4}-\d{2}-\d{2}(T|$)/.test(value) && !Number.isNaN(Date.parse(datePart(value))),
      messages.invalidDate,
    );
  if (field.minDate !== undefined) {
    const min = datePart(field.minDate);
    schema = schema.refine((value) => datePart(value) >= min, field.message ?? messages.min(field.minDate));
  }
  if (field.maxDate !== undefined) {
    const max = datePart(field.maxDate);
    schema = schema.refine((value) => datePart(value) <= max, field.message ?? messages.max(field.maxDate));
  }
  return schema;
}

type FileField = Extract<FieldConfig, { type: "file" }>;

/** `maxSizeMB` as the schema needs it: a byte ceiling and its ready-made message. */
type SizeLimit = { maxBytes: number; message: string };

function sizeLimitFor(field: FileField, messages: Messages): SizeLimit | undefined {
  if (field.maxSizeMB === undefined) return undefined;
  return { maxBytes: field.maxSizeMB * BYTES_PER_MB, message: messages.fileSize(field.maxSizeMB) };
}

/**
 * Builds the per-file check for a field, or `undefined` when the field
 * constrains nothing and needs no refinement wrapped around it at all. Both the
 * single-file and multi-file branches go through this, so a new per-file
 * constraint is added in one place and neither branch can quietly skip it.
 *
 * The returned reporter says everything wrong with one file — an unaccepted
 * type and an oversize file are independent problems, so a file with both gets
 * an issue for each.
 *
 * Type is reported before size on purpose. Both issues land on the same path,
 * and under react-hook-form's default `criteriaMode: "firstError"` only the
 * leading one per path reaches the user — and "wrong format" is the more
 * actionable of the two. Reordering these two blocks is a user-visible change.
 * (Both issues are always present in the parse result, so a consumer using
 * `criteriaMode: "all"`, or reading the schema directly, sees each of them.)
 *
 * `path` is empty for a single-file field and `[index]` within a multi-file
 * array, which is what lets the UI mark exactly which file failed and why.
 */
function fileIssueReporter(field: FileField, messages: Messages) {
  const size = sizeLimitFor(field, messages);
  const { accept } = field;
  // An empty `accept` constrains nothing, same as an absent one — without this
  // it would wrap the schema in a refinement that can never fire.
  if (!accept && size === undefined) return undefined;
  const formats = acceptedFormatsLabel(accept);
  return (ctx: z.RefinementCtx, file: File, path: (string | number)[]): void => {
    // Each issue gets its own copy of `path`. Zod walks the parse back up the
    // tree prepending the parent key to every issue *in place*, so two issues
    // sharing one array get that array prefixed twice, and react-hook-form then
    // nests the error under a second copy of the field name where no consumer
    // can find it. Both callers are affected, not just the multi-file one:
    // - multi-file passes [index], so a file that is both the wrong type and
    //   too large is reported at ["docs","docs",0] instead of ["docs",0];
    // - single-file passes [] (see `fileSchema` below), so the same file is
    //   reported at ["doc","doc"] instead of ["doc"] — measured, and just as
    //   total. There is no shape of file field that escapes this.
    // Only the async parse prefixes in place — and the async parse is the one
    // react-hook-form's resolver uses, so the corruption is invisible to a
    // `safeParse` test and complete in the browser.
    if (accept && !fileMatchesAccept(file, accept)) {
      ctx.addIssue({
        code: "custom",
        path: [...path],
        message: messages.fileTypeRejected(file.name, fileExtensionLabel(file) || undefined, formats),
      });
    }
    if (size !== undefined && file.size > size.maxBytes) {
      ctx.addIssue({ code: "custom", path: [...path], message: size.message });
    }
  };
}

function fileSchema(field: FileField, messages: Messages): z.ZodType {
  const base = z.instanceof(File, { error: messages.required });
  const report = fileIssueReporter(field, messages);
  if (!report) return base;
  return base.superRefine((file, ctx) => report(ctx, file, []));
}

export type OtpVerifiedChecker = (fieldName: string, code: string) => boolean;

export function toZodSchema(
  field: FieldConfig,
  messages: Messages,
  otpVerified?: OtpVerifiedChecker,
): FieldSchema {
  switch (field.type) {
    case "static":
    case "submit":
      return null;

    case "hidden":
      return z.unknown();

    case "text":
    case "password":
    case "textarea": {
      const base = field.required ? z.string({ error: messages.required }).min(1, messages.required) : z.string();
      let schema: z.ZodType = applyTextRules(base, field.rules, messages);
      if (field.type === "password" && field.complexity) {
        for (const check of getPasswordChecks(field.complexity, messages)) {
          schema = schema.refine((value) => check.test(value as string), check.label);
        }
      }
      return withTrim(field.rules, field.required ? schema : optionalEmptyable(schema));
    }

    case "email": {
      const base = field.required ? z.string({ error: messages.required }).min(1, messages.required) : z.string();
      const schema = applyTextRules(base, field.rules, messages).refine(
        (value) => z.email().safeParse(value).success,
        messages.email,
      );
      return withTrim(field.rules, field.required ? schema : optionalEmptyable(schema));
    }

    case "masked": {
      const tokenCount = [...field.mask].filter((char) => char === "#" || char === "A" || char === "*").length;
      const base = field.required ? z.string({ error: messages.required }).min(1, messages.required) : z.string();
      const schema = base.refine(
        (value) => (value as string).length === tokenCount,
        field.message ?? messages.maskIncomplete,
      );
      return field.required ? schema : optionalEmptyable(schema);
    }

    case "number": {
      let schema = z.number({ error: messages.required });
      if (field.min !== undefined) schema = schema.min(field.min, messages.min(field.min));
      if (field.max !== undefined) schema = schema.max(field.max, messages.max(field.max));
      return field.required ? schema : optionalClearable(schema);
    }

    case "otp": {
      let schema = z.string().length(field.length, messages.otpLength(field.length));
      if (otpVerified) {
        schema = schema.refine((code) => otpVerified(field.name, code), messages.otpNotVerified);
      }
      return field.required ? schema : optionalEmptyable(schema);
    }

    case "phone": {
      const base = field.required ? z.string({ error: messages.required }).min(1, messages.required) : z.string();
      const schema = base.refine((value) => isValidPhoneNumber(value), messages.invalidPhone);
      return field.required ? schema : optionalEmptyable(schema);
    }

    case "select": {
      const options = field.optionsFrom ? Object.values(field.optionsFrom.map).flat() : (field.options ?? []);
      if (field.multiple) {
        const schema = z.array(optionValueSchema(options));
        return field.required ? schema.min(1, messages.required) : schema.optional();
      }
      const value = optionValueSchema(options, field.required ? messages.required : undefined);
      return field.required ? value : optionalClearable(value);
    }

    case "country": {
      const allowed = new Set<string>(field.countries ?? (getCountries() as string[]));
      const base = field.required ? z.string({ error: messages.required }).min(1, messages.required) : z.string();
      const schema = base.refine((value) => allowed.has(value as string), messages.invalidCountry);
      return field.required ? schema : optionalClearable(schema);
    }

    case "radio":
    case "segmented": {
      const value = optionValueSchema(field.options, field.required ? messages.required : undefined);
      return field.required ? value : optionalClearable(value);
    }

    case "checkbox": {
      if (field.options?.length) {
        const schema = z.array(optionValueSchema(field.options));
        return field.required ? schema.min(1, messages.required) : schema.optional();
      }
      return field.required ? z.literal(true, { error: messages.required }) : z.boolean().optional();
    }

    case "switch":
      return field.required ? z.literal(true, { error: messages.required }) : z.boolean().optional();

    case "date": {
      if (field.range) {
        const iso = isoDateSchema(field, messages);
        const schema = z
          .object({ from: iso, to: iso.optional() }, { error: messages.required })
          .refine((range) => range.to !== undefined, messages.required)
          .refine(
            (range) => range.to === undefined || datePart(range.from) <= datePart(range.to),
            messages.invalidDate,
          );
        return field.required ? schema : schema.optional();
      }
      const schema = isoDateSchema(field, messages);
      return field.required ? schema : optionalEmptyable(schema);
    }

    case "time": {
      const base = field.required ? z.string({ error: messages.required }).min(1, messages.required) : z.string();
      let schema: z.ZodType = base.refine(
        (value) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value as string),
        messages.invalidTime,
      );
      if (field.minTime !== undefined) {
        const min = field.minTime;
        schema = schema.refine((value) => (value as string) >= min, messages.min(min));
      }
      if (field.maxTime !== undefined) {
        const max = field.maxTime;
        schema = schema.refine((value) => (value as string) <= max, messages.max(max));
      }
      return field.required ? schema : optionalEmptyable(schema);
    }

    case "rating": {
      const max = field.max ?? DEFAULT_RATING_MAX;
      const schema = z
        .number({ error: messages.required })
        .int(messages.required)
        .min(MIN_RATING, messages.min(MIN_RATING))
        .max(max, messages.max(max));
      return field.required ? schema : optionalClearable(schema);
    }

    case "slider": {
      let schema = z.number({ error: messages.required });
      schema = schema.min(field.min, messages.min(field.min)).max(field.max, messages.max(field.max));
      return schema;
    }

    case "signature": {
      const base = field.required ? z.string({ error: messages.required }).min(1, messages.required) : z.string();
      const schema = base.refine((value) => (value as string).startsWith("data:image/"), messages.required);
      return field.required ? schema : optionalEmptyable(schema);
    }

    case "file": {
      if (field.multiple) {
        const base = z.array(z.instanceof(File, { error: messages.required }));
        const withMin = field.required ? base.min(1, messages.required) : base;
        const report = fileIssueReporter(field, messages);
        // One issue per index rather than one for the whole list, so the UI can
        // say which file failed and why.
        const schema = report
          ? withMin.superRefine((files, ctx) => {
              files.forEach((file, index) => report(ctx, file, [index]));
            })
          : withMin;
        return field.required ? schema : schema.optional();
      }
      const single = fileSchema(field, messages);
      return field.required ? single : single.optional();
    }

    case "group": {
      const row = buildFieldsSchema(field.fields, messages);
      let schema = z.array(row);
      if (field.min !== undefined) schema = schema.min(field.min, messages.min(field.min));
      if (field.max !== undefined) schema = schema.max(field.max, messages.max(field.max));
      return schema;
    }

    default:
      return assertNever(field);
  }
}

type CrossRuleKind = "matches" | "minDate" | "maxDate" | "minTime" | "maxTime";

export type CrossRulePair = {
  field: string;
  source: string;
  kind: CrossRuleKind;
  matchesMessage?: string;
};

type CrossRule = CrossRulePair & { message: string };

const TEXT_FAMILY = new Set(["text", "email", "password", "textarea"]);
const DATE_FORMAT = /^\d{4}-\d{2}-\d{2}(T|$)/;
const TIME_FORMAT = /^([01]\d|2[0-3]):[0-5]\d$/;

export function collectCrossRulePairs(fields: AnyFieldConfig[]): CrossRulePair[] {
  const pairs: CrossRulePair[] = [];
  for (const field of fields) {
    if (!isBuiltInField(field)) continue;
    if (TEXT_FAMILY.has(field.type)) {
      const rules = (field as { rules?: TextRules }).rules;
      if (rules?.matches !== undefined) {
        pairs.push({ field: field.name, source: rules.matches, kind: "matches", matchesMessage: rules.matchesMessage });
      }
    }
    if (field.type === "date" && !field.range) {
      if (field.minDateField !== undefined) pairs.push({ field: field.name, source: field.minDateField, kind: "minDate" });
      if (field.maxDateField !== undefined) pairs.push({ field: field.name, source: field.maxDateField, kind: "maxDate" });
    }
    if (field.type === "time") {
      if (field.minTimeField !== undefined) pairs.push({ field: field.name, source: field.minTimeField, kind: "minTime" });
      if (field.maxTimeField !== undefined) pairs.push({ field: field.name, source: field.maxTimeField, kind: "maxTime" });
    }
  }
  return pairs;
}

function collectCrossRules(fields: AnyFieldConfig[], messages: Messages): CrossRule[] {
  const byName = new Map(fields.map((field) => [field.name, field]));
  const label = (name: string) => byName.get(name)?.label || name;
  const messageFor = (pair: CrossRulePair): string => {
    switch (pair.kind) {
      case "matches":
        return pair.matchesMessage ?? messages.matches(label(pair.source));
      case "minDate":
        return messages.dateAfter(label(pair.source));
      case "maxDate":
        return messages.dateBefore(label(pair.source));
      case "minTime":
        return messages.timeAfter(label(pair.source));
      case "maxTime":
        return messages.timeBefore(label(pair.source));
      default:
        return assertNever(pair.kind);
    }
  };
  return collectCrossRulePairs(fields)
    .filter((pair) => byName.has(pair.source))
    .map((pair) => ({ ...pair, message: messageFor(pair) }));
}

function crossRulePasses(rule: CrossRule, target: unknown, source: unknown): boolean {
  if (rule.kind === "matches") return target === source;
  if (typeof target !== "string" || typeof source !== "string") return true;
  switch (rule.kind) {
    case "minDate":
      return !DATE_FORMAT.test(target) || !DATE_FORMAT.test(source) || datePart(target) >= datePart(source);
    case "maxDate":
      return !DATE_FORMAT.test(target) || !DATE_FORMAT.test(source) || datePart(target) <= datePart(source);
    case "minTime":
      return !TIME_FORMAT.test(target) || !TIME_FORMAT.test(source) || target >= source;
    case "maxTime":
      return !TIME_FORMAT.test(target) || !TIME_FORMAT.test(source) || target <= source;
    default:
      return assertNever(rule.kind);
  }
}

function isBlank(value: unknown): boolean {
  return value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
}

type OptionsFromRule = {
  field: string;
  source: string;
  map: Record<string, Option[]>;
  multiple: boolean;
};

function collectOptionsFromRules(fields: AnyFieldConfig[]): OptionsFromRule[] {
  const names = new Set(fields.map((field) => field.name));
  const rules: OptionsFromRule[] = [];
  for (const field of fields) {
    if (!isBuiltInField(field) || field.type !== "select" || !field.optionsFrom) continue;
    if (!names.has(field.optionsFrom.field)) continue;
    rules.push({
      field: field.name,
      source: field.optionsFrom.field,
      map: field.optionsFrom.map,
      multiple: field.multiple === true,
    });
  }
  return rules;
}

export function buildFieldsSchema(
  fields: AnyFieldConfig[],
  messages: Messages,
  otpVerified?: OtpVerifiedChecker,
): z.ZodObject {
  const shape: Record<string, z.ZodType> = {};
  for (const field of fields) {
    const schema = isBuiltInField(field) ? toZodSchema(field, messages, otpVerified) : z.unknown().optional();
    if (schema) shape[field.name] = schema;
  }
  const objectSchema = z.object(shape);

  const crossRules = collectCrossRules(fields, messages);
  const optionsFromRules = collectOptionsFromRules(fields);
  if (crossRules.length === 0 && optionsFromRules.length === 0) return objectSchema;
  return objectSchema.superRefine((values, ctx) => {
    for (const rule of crossRules) {
      const target = (values as Record<string, unknown>)[rule.field];
      const source = (values as Record<string, unknown>)[rule.source];
      if (isBlank(target) || isBlank(source)) continue;
      if (!crossRulePasses(rule, target, source)) {
        ctx.addIssue({ code: "custom", path: [rule.field], message: rule.message });
      }
    }
    for (const rule of optionsFromRules) {
      const target = (values as Record<string, unknown>)[rule.field];
      if (isBlank(target)) continue;
      const sourceValue = (values as Record<string, unknown>)[rule.source];
      const allowed = isBlank(sourceValue)
        ? new Set<Option["value"]>()
        : new Set((rule.map[String(sourceValue)] ?? []).map((option) => option.value));
      const passes = rule.multiple
        ? Array.isArray(target) && target.every((entry) => allowed.has(entry as Option["value"]))
        : allowed.has(target as Option["value"]);
      if (!passes) {
        ctx.addIssue({ code: "custom", path: [rule.field], message: messages.invalidOption });
      }
    }
  });
}

export function buildFormSchema(config: FormConfig, messages: Messages, otpVerified?: OtpVerifiedChecker): z.ZodObject {
  return buildFieldsSchema(config.fields, messages, otpVerified);
}

export function buildResolverSchema(
  config: FormConfig,
  messages: Messages,
  otpVerified: OtpVerifiedChecker | undefined,
  values: FormValues,
): z.ZodObject {
  return buildFieldsSchema(visibleFieldsFor(config, values), messages, otpVerified);
}
