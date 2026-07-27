import { assertNever } from "./assertNever";
import { isBuiltInField } from "./types";
import type { AnyFieldConfig, FieldConfig, FormValues } from "./types";

function defaultValueFor(field: FieldConfig): { value: unknown } | null {
  switch (field.type) {
    case "static":
    case "submit":
      return null;
    case "text":
    case "email":
    case "password":
    case "textarea":
    case "otp":
    case "phone":
    case "time":
    case "masked":
    case "signature":
      return { value: "" };
    case "checkbox":
      return { value: field.options?.length ? [] : false };
    case "switch":
      return { value: false };
    case "select":
      return { value: field.multiple ? [] : undefined };
    case "radio":
    case "segmented":
    case "country":
    case "number":
    case "date":
    case "file":
    case "rating":
      return { value: undefined };
    case "slider":
      return { value: field.min };
    case "hidden":
      return { value: field.value };
    case "group": {
      const rowCount = field.min ?? 0;
      const row = buildDefaultValues(field.fields);
      return { value: Array.from({ length: rowCount }, () => ({ ...row })) };
    }
    default:
      return assertNever(field);
  }
}

export function buildDefaultValues(fields: AnyFieldConfig[]): FormValues {
  const defaults: FormValues = {};
  for (const field of fields) {
    const entry = isBuiltInField(field) ? defaultValueFor(field) : { value: field.defaultValue };
    if (entry) defaults[field.name] = entry.value;
  }
  return defaults;
}
