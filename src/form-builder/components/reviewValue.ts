import type { Messages } from "../core/messages";
import { isBuiltInField, type AnyFieldConfig, type FieldConfig, type FieldType, type Option } from "../core/types";
import { formatMasked } from "../fields/maskedValue";
import type { FormLocale } from "./FieldRuntime";

export type ReviewFormatter = (value: unknown, field: AnyFieldConfig) => string;
export type ReviewFormatters = Record<string, ReviewFormatter>;

export type ReviewValueContext = {
  messages: Messages;
  locale?: FormLocale;
  verifiedFields?: ReadonlySet<string>;
  reviewFormatters?: ReviewFormatters;
};

const isBlank = (value: unknown): boolean =>
  value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);

function optionPool(field: Extract<FieldConfig, { type: "select" }>): Option[] {
  return field.optionsFrom ? Object.values(field.optionsFrom.map).flat() : (field.options ?? []);
}

function optionLabels(options: Option[], value: unknown): string {
  const values = Array.isArray(value) ? value : [value];
  return values
    .map((entry) => options.find((option) => option.value === entry)?.label ?? String(entry))
    .join(", ");
}

function countryLabel(code: string, locale?: FormLocale): string {
  try {
    return locale?.countryLabels?.[code] ?? new Intl.DisplayNames(undefined, { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

type BuiltInReviewFormatter = (value: unknown, field: FieldConfig, ctx: ReviewValueContext) => string;

const REVIEW_FORMATTERS: Partial<Record<FieldType, BuiltInReviewFormatter>> = {
  select: (value, field) => optionLabels(optionPool(field as Extract<FieldConfig, { type: "select" }>), value),
  radio: (value, field) => optionLabels((field as Extract<FieldConfig, { type: "radio" }>).options, value),
  segmented: (value, field) => optionLabels((field as Extract<FieldConfig, { type: "segmented" }>).options, value),
  checkbox: (value, field, ctx) => {
    const config = field as Extract<FieldConfig, { type: "checkbox" | "switch" }>;
    if (config.options?.length) return optionLabels(config.options, value);
    return value === true ? ctx.messages.yes : ctx.messages.no;
  },
  switch: (value, _field, ctx) => (value === true ? ctx.messages.yes : ctx.messages.no),
  country: (value, _field, ctx) => countryLabel(String(value), ctx.locale),
  masked: (value, field) => formatMasked(String(value), (field as Extract<FieldConfig, { type: "masked" }>).mask),
  date: (value, field, ctx) => {
    const config = field as Extract<FieldConfig, { type: "date" }>;
    if (config.range && typeof value === "object" && value !== null) {
      const range = value as { from?: string; to?: string };
      return [range.from, range.to].filter(Boolean).join(" – ") || ctx.messages.notAnswered;
    }
    return String(value);
  },
  file: (value) => {
    const files = Array.isArray(value) ? value : [value];
    return files
      .map((file) => (typeof File !== "undefined" && file instanceof File ? file.name : String(file)))
      .join(", ");
  },
};

export function formatReviewValue(field: AnyFieldConfig, value: unknown, ctx: ReviewValueContext): string {
  const { messages } = ctx;
  if (!isBuiltInField(field)) {
    const custom = ctx.reviewFormatters?.[field.type];
    if (custom) return custom(value, field);
    return isBlank(value) ? messages.notAnswered : String(value);
  }
  if (field.type === "otp") {
    if (ctx.verifiedFields?.has(field.name)) return messages.otpVerified;
    return isBlank(value) ? messages.notAnswered : messages.otpNotVerified;
  }
  if (field.type === "password") return isBlank(value) ? messages.notAnswered : "••••••";
  if (field.type === "signature") return isBlank(value) ? messages.notAnswered : messages.signed;
  if (isBlank(value)) return messages.notAnswered;

  const formatter = REVIEW_FORMATTERS[field.type];
  return formatter ? formatter(value, field, ctx) : String(value);
}
