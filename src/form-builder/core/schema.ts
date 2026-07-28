import { z } from "zod";
import { getCountries } from "libphonenumber-js";
import { getRegisteredTypes } from "./registry";
import { conditionFieldNames, toConditionGroups } from "./conditions";
import type { ConditionSpec, FieldConfig, FormConfig } from "./types";

const countryCodeSchema = z.string().refine(
  (code) => (getCountries() as string[]).includes(code),
  { message: "not a valid ISO 3166-1 alpha-2 country code (e.g. \"AE\")" },
);

const timeStringSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, { message: "must be a zero-padded HH:mm time (e.g. \"09:30\")" });

const conditionObjectSchema = z.strictObject({
  field: z.string().min(1),
  equals: z.unknown().optional(),
  notEquals: z.unknown().optional(),
  in: z.array(z.unknown()).optional(),
  isValid: z.boolean().optional(),
});

const conditionSchema = conditionObjectSchema.refine(
  (cond) => "equals" in cond || "notEquals" in cond || "in" in cond || "isValid" in cond,
  { message: "condition needs at least one operator (equals, notEquals, in, isValid)" },
);

const valueConditionSchema = conditionObjectSchema
  .refine((cond) => cond.isValid === undefined, {
    message: "isValid conditions are only supported in disabledWhen/enabledWhen, not visibleWhen",
  })
  .refine((cond) => "equals" in cond || "notEquals" in cond || "in" in cond, {
    message: "condition needs at least one operator (equals, notEquals, in)",
  });

function conditionSpecSchema(leaf: z.ZodType): z.ZodType {
  return z.union([leaf, z.array(leaf).min(1), z.strictObject({ anyOf: z.array(z.array(leaf).min(1)).min(1) })]);
}

const optionSchema = z.strictObject({
  label: z.string(),
  value: z.union([z.string(), z.number()]),
  disabled: z.boolean().optional(),
});

const fieldWidthValueSchema = z.enum(["full", "half", "third", "quarter"]);

const fieldWidthSchema = z.union([
  fieldWidthValueSchema,
  z.strictObject({
    mobile: fieldWidthValueSchema.optional(),
    tablet: fieldWidthValueSchema.optional(),
    desktop: fieldWidthValueSchema.optional(),
  }),
]);

const baseFieldSchema = z.strictObject({
  type: z.string(),
  name: z
    .string()
    .min(1)
    .refine((name) => !name.includes("."), { message: "field names must not contain dots" })
    .refine((name) => !["__proto__", "constructor", "prototype"].includes(name), {
      message: "field name must not be a reserved object key (__proto__, constructor, prototype)",
    }),
  label: z.string().optional(),
  description: z.string().optional(),
  badge: z.string().optional(),
  // Not an enum of the WCAG 1.3.5 purposes: the attribute is a grammar around
  // one purpose token (optional section-*/shipping/billing/home/work/mobile
  // groups, optional trailing webauthn) plus the standalone on/off, so an
  // allowlist would reject valid HTML. See BaseField.autocomplete.
  autocomplete: z.string().optional(),
  placeholder: z.string().optional(),
  required: z.boolean().optional(),
  disabled: z.boolean().optional(),
  visibleWhen: conditionSpecSchema(valueConditionSchema).optional(),
  disabledWhen: conditionSpecSchema(conditionSchema).optional(),
  enabledWhen: conditionSpecSchema(conditionSchema).optional(),
  enabledWhenVerified: z.string().min(1).optional(),
  copyFrom: z.string().min(1).optional(),
  width: fieldWidthSchema.optional(),
});

/**
 * Every key `baseFieldSchema` accepts, `type` included. Exported only so a test
 * can pin it against `keyof BaseField`.
 *
 * This is the one base-prop surface the compiler cannot police. A prop added to
 * `BaseField` but not to the strictObject above typechecks clean everywhere and
 * then throws `Unrecognized key` on the first config that sets it — and because
 * `AnyFieldConfig` admits `Record<string, unknown>` for custom types, even the
 * config literal that triggers it compiles.
 */
export const BASE_FIELD_SCHEMA_KEYS: readonly string[] = Object.keys(baseFieldSchema.shape);

const NESTED_QUANTIFIER = /\([^)]*[+*}][^)]*\)[+*{]/;

function isSafeCharClassBody(body: string): boolean {
  if (body.startsWith("^")) return false;
  for (let i = 0; i < body.length; i += 1) {
    const char = body[i];
    if (char === "[" || char === "]") return false;
    if (char === "\\") {
      const next = body[i + 1];
      if (next === undefined || !/[dwsDWS\\\-.,'"]/.test(next)) return false;
      i += 1;
    }
  }
  try {
    new RegExp(`[^${body}]`, "g");
    return true;
  } catch {
    return false;
  }
}

const textRulesSchema = z.strictObject({
  minLength: z.number().int().nonnegative().optional(),
  maxLength: z.number().int().nonnegative().optional(),
  pattern: z
    .string()
    .max(256, "pattern is too long (max 256 chars)")
    .optional()
    .refine(
      (pattern) => {
        if (pattern === undefined) return true;
        try {
          new RegExp(pattern);
          return true;
        } catch {
          return false;
        }
      },
      { message: "pattern is not a valid regular expression" },
    )
    .refine((pattern) => pattern === undefined || !NESTED_QUANTIFIER.test(pattern), {
      message: "pattern contains a nested quantifier (ReDoS risk)",
    }),
  message: z.string().optional(),
  trim: z.boolean().optional(),
  allow: z
    .string()
    .min(1)
    .optional()
    .refine((allow) => allow === undefined || isSafeCharClassBody(allow), {
      message: "allow must be a plain character-class body (letters, digits, ranges, \\d \\w \\s escapes)",
    }),
  matches: z.string().min(1).optional(),
  matchesMessage: z.string().optional(),
}).refine((rules) => rules.matchesMessage === undefined || rules.matches !== undefined, {
  message: "matchesMessage requires matches",
});

const textFieldSchema = baseFieldSchema.extend({ rules: textRulesSchema.optional() });

const fieldSchemasByType: Record<FieldConfig["type"], z.ZodType> = {
  text: textFieldSchema,
  email: textFieldSchema,
  password: textFieldSchema.extend({
    complexity: z
      .strictObject({
        uppercase: z.boolean().optional(),
        lowercase: z.boolean().optional(),
        number: z.boolean().optional(),
        special: z.boolean().optional(),
        minLength: z.number().int().positive().optional(),
      })
      .optional(),
  }),
  textarea: textFieldSchema,
  masked: baseFieldSchema.extend({
    mask: z
      .string()
      .min(1)
      .refine((mask) => [...mask].some((char) => char === "#" || char === "A" || char === "*"), {
        message: "mask must contain at least one token char (#, A, *)",
      }),
    message: z.string().optional(),
  }),
  number: baseFieldSchema.extend({
    min: z.number().optional(),
    max: z.number().optional(),
    step: z.number().optional(),
  }),
  otp: baseFieldSchema.extend({
    length: z.number().int().positive(),
    dependsOn: z.string().min(1).optional(),
  }),
  phone: baseFieldSchema.extend({
    defaultCountry: countryCodeSchema.optional(),
    preferredCountries: z.array(countryCodeSchema).optional(),
    countryFrom: z.string().min(1).optional(),
  }),
  select: baseFieldSchema
    .extend({
      options: z.array(optionSchema).min(1).optional(),
      optionsFrom: z
        .strictObject({
          field: z.string().min(1),
          map: z.record(z.string(), z.array(optionSchema)),
        })
        .optional(),
      searchable: z.boolean().optional(),
      multiple: z.boolean().optional(),
    })
    .refine((field) => (field.options === undefined) !== (field.optionsFrom === undefined), {
      message: "select needs exactly one of options or optionsFrom",
    }),
  country: baseFieldSchema
    .extend({
      countries: z.array(countryCodeSchema).min(1).optional(),
      preferredCountries: z.array(countryCodeSchema).optional(),
    })
    .refine(
      (field) =>
        field.countries === undefined ||
        field.preferredCountries === undefined ||
        field.preferredCountries.every((code) => field.countries!.includes(code)),
      { message: "preferredCountries must be a subset of countries" },
    ),
  radio: baseFieldSchema.extend({ options: z.array(optionSchema).min(1) }),
  segmented: baseFieldSchema.extend({ options: z.array(optionSchema).min(1) }),
  checkbox: baseFieldSchema.extend({ options: z.array(optionSchema).optional() }),
  switch: baseFieldSchema.extend({ options: z.array(optionSchema).optional() }),
  date: baseFieldSchema
    .extend({
      range: z.boolean().optional(),
      minDate: z.iso.date().optional(),
      maxDate: z.iso.date().optional(),
      minDateField: z.string().min(1).optional(),
      maxDateField: z.string().min(1).optional(),
      // min(1): "" is not nullish, so `field.message ?? messages.max(...)` would
      // keep it and Zod would fall back to its own untranslated "Invalid input"
      // — losing the bound text and escaping the Messages layer at once.
      message: z.string().min(1).optional(),
      // Picker-only: "validate" leaves out-of-range days selectable so the
      // bound can explain itself. The value is rejected either way.
      pickerBounds: z.enum(["restrict", "validate"]).optional(),
    })
    .refine((field) => !field.range || (field.minDateField === undefined && field.maxDateField === undefined), {
      message: "minDateField/maxDateField are not supported on range date fields",
    }),
  time: baseFieldSchema
    .extend({
      minTime: timeStringSchema.optional(),
      maxTime: timeStringSchema.optional(),
      stepMinutes: z.number().int().positive().optional(),
      minTimeField: z.string().min(1).optional(),
      maxTimeField: z.string().min(1).optional(),
    })
    .refine(
      (field) => field.minTime === undefined || field.maxTime === undefined || field.minTime <= field.maxTime,
      { message: "minTime must not be after maxTime" },
    ),
  rating: baseFieldSchema.extend({
    max: z.number().int().min(2).max(10).optional(),
  }),
  slider: baseFieldSchema.extend({
    min: z.number(),
    max: z.number(),
    step: z.number().optional(),
  }),
  signature: baseFieldSchema.extend({
    penColor: z.string().min(1).optional(),
    heightPx: z.number().int().positive().optional(),
  }),
  file: baseFieldSchema.extend({
    accept: z.string().optional(),
    maxSizeMB: z.number().positive().optional(),
    multiple: z.boolean().optional(),
  }),
  hidden: baseFieldSchema.extend({ value: z.unknown() }),
  static: baseFieldSchema.extend({
    content: z.string(),
    as: z.enum(["h1", "h2", "p", "divider"]).optional(),
  }),
  group: baseFieldSchema.extend({
    fields: z.array(z.record(z.string(), z.unknown())).min(1),
    min: z.number().int().nonnegative().optional(),
    max: z.number().int().positive().optional(),
  }),
  submit: baseFieldSchema.extend({
    text: z.string().min(1),
    variant: z.enum(["default", "destructive", "outline", "secondary", "ghost", "link"]).optional(),
  }),
};

const customFieldSchema = z.looseObject(baseFieldSchema.shape);

const formConfigShellSchema = z.object({
  id: z.string().min(1),
  title: z.string().optional(),
  description: z.string().optional(),
  fields: z.array(z.record(z.string(), z.unknown())).min(1),
  steps: z
    .array(
      z
        .object({
          title: z.string(),
          fieldNames: z.array(z.string()).min(1).optional(),
          review: z.boolean().optional(),
          visibleWhen: conditionSpecSchema(valueConditionSchema).optional(),
        })
        .refine((step) => (step.review === true) !== (step.fieldNames !== undefined), {
          message: "a step needs fieldNames, or review: true instead of them (not both)",
        }),
    )
    .optional(),
});

function formatIssues(issues: z.core.$ZodIssue[], path: string): string {
  return issues.map((issue) => `${path}${issue.path.length ? "." + issue.path.join(".") : ""}: ${issue.message}`).join("; ");
}

const VACUOUS_VALIDITY_TYPES = new Set<string>(["static", "submit", "hidden"]);

const COPY_FROM_UNSUPPORTED_TYPES = new Set<string>([
  "phone",
  "otp",
  "password",
  "file",
  "signature",
  "group",
  "hidden",
  "static",
  "submit",
]);

const TEXT_FAMILY_TYPES = new Set<string>(["text", "email", "password", "textarea"]);
const CROSS_BOUND_KEYS = ["minDateField", "maxDateField", "minTimeField", "maxTimeField"] as const;

function crossRuleSources(raw: unknown): { source: string; rule: string }[] {
  const field = raw as {
    type?: unknown;
    rules?: { matches?: string };
    minDateField?: string;
    maxDateField?: string;
    minTimeField?: string;
    maxTimeField?: string;
  };
  const out: { source: string; rule: string }[] = [];
  if (typeof field.type === "string" && TEXT_FAMILY_TYPES.has(field.type) && field.rules?.matches !== undefined) {
    out.push({ source: field.rules.matches, rule: "rules.matches" });
  }
  for (const key of CROSS_BOUND_KEYS) {
    if (field[key] !== undefined) out.push({ source: field[key], rule: key });
  }
  return out;
}

function isValidConditionTargets(raw: unknown): string[] {
  const field = raw as { disabledWhen?: ConditionSpec; enabledWhen?: ConditionSpec };
  return [...toConditionGroups(field.disabledWhen), ...toConditionGroups(field.enabledWhen)]
    .flat()
    .filter((condition) => condition.isValid !== undefined)
    .map((condition) => condition.field);
}

function validateFields(fields: unknown[], path: string, insideGroup = false): void {
  const seenNames = new Set<string>();

  fields.forEach((raw, index) => {
    const fieldPath = `${path}[${index}]`;
    const type = (raw as { type?: unknown })?.type;
    const isBuiltIn = typeof type === "string" && type in fieldSchemasByType;

    if (!isBuiltIn && (typeof type !== "string" || !getRegisteredTypes().includes(type))) {
      throw new Error(`Invalid form config at ${fieldPath}: unknown field type "${String(type)}"`);
    }

    if (insideGroup) {
      const wiring = raw as { dependsOn?: unknown; enabledWhenVerified?: unknown; countryFrom?: unknown };
      if (type === "otp" && wiring.dependsOn !== undefined) {
        throw new Error(`Invalid form config at ${fieldPath}: otp dependsOn is not supported inside groups`);
      }
      if (wiring.enabledWhenVerified !== undefined) {
        throw new Error(
          `Invalid form config at ${fieldPath}: enabledWhenVerified is not supported inside groups`,
        );
      }
      if (type === "phone" && wiring.countryFrom !== undefined) {
        throw new Error(`Invalid form config at ${fieldPath}: phone countryFrom is not supported inside groups`);
      }
    }

    const schema = isBuiltIn ? fieldSchemasByType[type as FieldConfig["type"]] : customFieldSchema;
    if (!isBuiltIn && (raw as { required?: unknown }).required === true && process.env.NODE_ENV !== "production") {
      console.warn(
        `form-builder: custom field "${(raw as { name?: unknown }).name}" sets required, but custom field values pass validation as unknown — enforce it in the component or onSubmit`,
      );
    }
    const result = schema.safeParse(raw);
    if (!result.success) {
      throw new Error(`Invalid form config at ${formatIssues(result.error.issues, fieldPath)}`);
    }

    const disableWiring = raw as { disabledWhen?: unknown; enabledWhen?: unknown };
    if (disableWiring.disabledWhen !== undefined && disableWiring.enabledWhen !== undefined) {
      throw new Error(
        `Invalid form config at ${fieldPath}: disabledWhen and enabledWhen are mutually exclusive — use one`,
      );
    }

    if (insideGroup && isValidConditionTargets(raw).length > 0) {
      throw new Error(`Invalid form config at ${fieldPath}: isValid conditions are not supported inside groups`);
    }

    if (insideGroup) {
      const crossRule = crossRuleSources(raw)[0];
      if (crossRule) {
        throw new Error(
          `Invalid form config at ${fieldPath}: ${crossRule.rule} is not supported inside groups`,
        );
      }
      if ((raw as { copyFrom?: unknown }).copyFrom !== undefined) {
        throw new Error(`Invalid form config at ${fieldPath}: copyFrom is not supported inside groups`);
      }
      if ((raw as { optionsFrom?: unknown }).optionsFrom !== undefined) {
        throw new Error(`Invalid form config at ${fieldPath}: optionsFrom is not supported inside groups`);
      }
    }

    if (type === "hidden" && !("value" in (raw as object))) {
      throw new Error(`Invalid form config at ${fieldPath}: hidden field requires a value`);
    }

    const name = (raw as { name: string }).name;
    if (seenNames.has(name)) {
      throw new Error(`Invalid form config at ${fieldPath}: duplicate field name "${name}"`);
    }
    seenNames.add(name);

    if (type === "group") {
      validateFields((raw as { fields: unknown[] }).fields, `${fieldPath}.fields`, true);
    }
  });

  const typeByName = new Map(
    fields.map((raw) => [(raw as { name: string }).name, (raw as { type?: unknown }).type]),
  );
  fields.forEach((raw, index) => {
    const field = raw as {
      type?: unknown;
      name: string;
      dependsOn?: unknown;
      enabledWhenVerified?: unknown;
      countryFrom?: unknown;
      copyFrom?: unknown;
      multiple?: unknown;
      range?: unknown;
    };

    if (field.type === "otp" && field.dependsOn !== undefined) {
      if (!seenNames.has(field.dependsOn as string) || field.dependsOn === field.name) {
        throw new Error(
          `Invalid form config at ${path}[${index}]: otp dependsOn references unknown field "${String(field.dependsOn)}"`,
        );
      }
    }

    if (field.enabledWhenVerified !== undefined) {
      const target = field.enabledWhenVerified as string;
      if (typeByName.get(target) !== "otp" || target === field.name) {
        throw new Error(
          `Invalid form config at ${path}[${index}]: enabledWhenVerified must reference a sibling otp field, got "${target}"`,
        );
      }
    }

    for (const target of isValidConditionTargets(raw)) {
      const targetType = typeByName.get(target);
      const isValidatable =
        typeof targetType === "string" &&
        targetType in fieldSchemasByType &&
        !VACUOUS_VALIDITY_TYPES.has(targetType);
      if (target === field.name || !isValidatable) {
        throw new Error(
          `Invalid form config at ${path}[${index}]: isValid condition must reference a sibling built-in input field, got "${target}"`,
        );
      }
    }

    const optionsFrom = (raw as { optionsFrom?: { field: string; map: Record<string, unknown> } }).optionsFrom;
    if (optionsFrom !== undefined) {
      const source = optionsFrom.field;
      const sourceRaw = fields.find((f) => (f as { name: string }).name === source) as
        | { type?: unknown; multiple?: unknown; options?: { value: unknown }[] }
        | undefined;
      const validSource =
        sourceRaw !== undefined &&
        (sourceRaw.type === "country" || (sourceRaw.type === "select" && sourceRaw.multiple !== true));
      if (source === field.name || !validSource) {
        throw new Error(
          `Invalid form config at ${path}[${index}]: optionsFrom must reference a sibling single-value select or country field, got "${source}"`,
        );
      }
      const optionsFromOf = new Map(
        fields
          .map((f) => f as { name: string; optionsFrom?: { field?: unknown } })
          .filter((f) => typeof f.optionsFrom?.field === "string")
          .map((f) => [f.name, f.optionsFrom!.field as string]),
      );
      let cursor: string | undefined = source;
      for (let hops = 0; cursor !== undefined && hops <= fields.length; hops += 1) {
        if (cursor === field.name) {
          throw new Error(
            `Invalid form config at ${path}[${index}]: optionsFrom chain from "${field.name}" loops back to itself`,
          );
        }
        cursor = optionsFromOf.get(cursor);
      }

      if (process.env.NODE_ENV !== "production" && sourceRaw.type === "select") {
        for (const option of sourceRaw.options ?? []) {
          if (!(String(option.value) in optionsFrom.map)) {
            console.warn(
              `form-builder: select "${field.name}" optionsFrom has no map entry for source option "${String(option.value)}" — that branch renders an empty select`,
            );
          }
        }
      }
    }

    if (field.copyFrom !== undefined) {
      if (typeof field.type === "string" && COPY_FROM_UNSUPPORTED_TYPES.has(field.type)) {
        throw new Error(
          `Invalid form config at ${path}[${index}]: copyFrom is not supported on ${field.type} fields`,
        );
      }
      const source = field.copyFrom as string;
      const sourceRaw = fields.find((f) => (f as { name: string }).name === source) as
        | { type?: unknown; multiple?: unknown; range?: unknown }
        | undefined;
      const sameShape =
        sourceRaw !== undefined &&
        sourceRaw.type === field.type &&
        (field.type !== "select" || (sourceRaw.multiple === true) === (field.multiple === true)) &&
        (field.type !== "date" || (sourceRaw.range === true) === (field.range === true));
      if (source === field.name || !sameShape) {
        throw new Error(
          `Invalid form config at ${path}[${index}]: copyFrom must reference a same-type sibling field, got "${source}"`,
        );
      }
      const copyFromOf = new Map(
        fields
          .map((f) => f as { name: string; copyFrom?: unknown })
          .filter((f) => typeof f.copyFrom === "string")
          .map((f) => [f.name, f.copyFrom as string]),
      );
      let cursor: string | undefined = source;
      for (let hops = 0; cursor !== undefined && hops <= fields.length; hops += 1) {
        if (cursor === field.name) {
          throw new Error(
            `Invalid form config at ${path}[${index}]: copyFrom chain from "${field.name}" loops back to itself`,
          );
        }
        cursor = copyFromOf.get(cursor);
      }
    }

    for (const { source, rule } of crossRuleSources(raw)) {
      const sourceType = typeByName.get(source);
      const compatible =
        rule === "rules.matches"
          ? typeof sourceType === "string" && TEXT_FAMILY_TYPES.has(sourceType)
          : rule.startsWith("minDate") || rule.startsWith("maxDate")
            ? sourceType === "date" &&
              (fields.find((f) => (f as { name: string }).name === source) as { range?: unknown })?.range !== true
            : sourceType === "time";
      if (source === field.name || !compatible) {
        throw new Error(
          `Invalid form config at ${path}[${index}]: ${rule} must reference a compatible sibling field, got "${source}"`,
        );
      }
    }

    if (field.type === "phone" && field.countryFrom !== undefined) {
      const source = field.countryFrom as string;
      if (!seenNames.has(source) || source === field.name) {
        throw new Error(
          `Invalid form config at ${path}[${index}]: phone countryFrom references unknown field "${source}"`,
        );
      }
      const sourceRaw = fields.find((f) => (f as { name: string }).name === source) as {
        type?: unknown;
        multiple?: unknown;
        options?: { value: unknown }[];
        optionsFrom?: unknown;
      };
      if (sourceRaw.type !== "country") {
        if (sourceRaw.type !== "select" || sourceRaw.multiple === true) {
          throw new Error(
            `Invalid form config at ${path}[${index}]: phone countryFrom must reference a single-value select or country field, got "${source}"`,
          );
        }
        if (sourceRaw.optionsFrom !== undefined) {
          throw new Error(
            `Invalid form config at ${path}[${index}]: phone countryFrom source "${source}" uses optionsFrom — its values cannot be verified as country codes; use a static select or a country field`,
          );
        }
        const countries = getCountries() as string[];
        for (const option of sourceRaw.options ?? []) {
          if (typeof option.value !== "string" || !countries.includes(option.value)) {
            throw new Error(
              `Invalid form config at ${path}[${index}]: phone countryFrom source "${source}" option value "${String(option.value)}" is not an ISO 3166-1 alpha-2 country code`,
            );
          }
        }
      }
    }
  });
}

function validateSteps(config: FormConfig): void {
  if (!config.steps) return;

  const topLevelNames = new Set(config.fields.map((field) => field.name));
  const stepped = new Set<string>();
  for (const step of config.steps) {
    for (const fieldName of step.fieldNames ?? []) {
      if (!topLevelNames.has(fieldName)) {
        throw new Error(`Invalid form config: step "${step.title}" references unknown field "${fieldName}"`);
      }
      stepped.add(fieldName);
    }
  }

  if (process.env.NODE_ENV !== "production") {
    const stepOf = new Map<string, number>();
    config.steps.forEach((step, index) => (step.fieldNames ?? []).forEach((name) => stepOf.set(name, index)));
    config.steps.forEach((step, index) => {
      for (const source of conditionFieldNames(step.visibleWhen)) {
        const sourceStep = stepOf.get(source);
        if (sourceStep !== undefined && sourceStep > index) {
          console.warn(
            `form-builder: step "${step.title}" (step ${index + 1}) is shown/hidden by "${source}" (step ${sourceStep + 1}) — a later step's value decides an earlier step's visibility`,
          );
        }
      }
    });
    if (config.steps.every((step) => step.visibleWhen !== undefined)) {
      console.warn(
        "form-builder: every step has a visibleWhen — a value combination could hide the whole wizard",
      );
    }
    for (const field of config.fields) {
      const dependsOn = field.type === "otp" ? (field as { dependsOn?: string }).dependsOn : undefined;
      if (dependsOn === undefined) continue;
      const otpStep = stepOf.get(field.name);
      const depStep = stepOf.get(dependsOn);
      if (otpStep !== undefined && depStep !== undefined && otpStep !== depStep) {
        console.warn(
          `form-builder: otp field "${field.name}" (step ${otpStep + 1}) depends on "${dependsOn}" (step ${depStep + 1}) — editing the source while the otp field is unmounted defers re-verification until the otp step remounts`,
        );
      }
    }
    for (const field of config.fields) {
      const countryFrom = field.type === "phone" ? (field as { countryFrom?: string }).countryFrom : undefined;
      if (countryFrom === undefined) continue;
      const phoneStep = stepOf.get(field.name);
      const sourceStep = stepOf.get(countryFrom);
      if (phoneStep !== undefined && sourceStep !== undefined && phoneStep !== sourceStep) {
        console.warn(
          `form-builder: phone field "${field.name}" (step ${phoneStep + 1}) syncs country from "${countryFrom}" (step ${sourceStep + 1}) — source changes while the phone field is unmounted are not applied on remount`,
        );
      }
    }
    for (const field of config.fields) {
      const copyFrom = (field as { copyFrom?: string }).copyFrom;
      if (copyFrom === undefined) continue;
      const fieldStep = stepOf.get(field.name);
      const sourceStep = stepOf.get(copyFrom);
      if (fieldStep !== undefined && sourceStep !== undefined && fieldStep !== sourceStep) {
        console.warn(
          `form-builder: field "${field.name}" (step ${fieldStep + 1}) copies from "${copyFrom}" (step ${sourceStep + 1}) — source changes while the field is unmounted are not applied on remount`,
        );
      }
    }
    for (const field of config.fields) {
      const optionsFrom =
        field.type === "select" ? (field as { optionsFrom?: { field: string } }).optionsFrom : undefined;
      if (optionsFrom === undefined) continue;
      const fieldStep = stepOf.get(field.name);
      const sourceStep = stepOf.get(optionsFrom.field);
      if (fieldStep !== undefined && sourceStep !== undefined && fieldStep !== sourceStep) {
        console.warn(
          `form-builder: select "${field.name}" (step ${fieldStep + 1}) derives options from "${optionsFrom.field}" (step ${sourceStep + 1}) — a source edit while the select is unmounted defers stale-value cleanup to validation`,
        );
      }
    }
    for (const field of config.fields) {
      for (const { source, rule } of crossRuleSources(field)) {
        const fieldStep = stepOf.get(field.name);
        const sourceStep = stepOf.get(source);
        if (fieldStep !== undefined && sourceStep !== undefined && fieldStep !== sourceStep) {
          console.warn(
            `form-builder: field "${field.name}" (step ${fieldStep + 1}) has a ${rule} rule against "${source}" (step ${sourceStep + 1}) — the error will show where its cause is invisible`,
          );
        }
      }
    }
    for (const field of config.fields) {
      for (const target of isValidConditionTargets(field)) {
        const fieldStep = stepOf.get(field.name);
        const targetStep = stepOf.get(target);
        if (fieldStep !== undefined && targetStep !== undefined && fieldStep !== targetStep) {
          console.warn(
            `form-builder: field "${field.name}" (step ${fieldStep + 1}) is gated on validity of "${target}" (step ${targetStep + 1}) — the disable reason is invisible on the field's step`,
          );
        }
      }
    }
  }

  for (const field of config.fields) {
    const exemptFromSteps = field.type === "hidden" || field.type === "submit";
    if (!exemptFromSteps && !stepped.has(field.name)) {
      throw new Error(`Invalid form config: field "${field.name}" is not assigned to any step`);
    }
    if (exemptFromSteps && stepped.has(field.name)) {
      throw new Error(
        `Invalid form config: ${field.type} field "${field.name}" must not be listed in steps (rendered automatically)`,
      );
    }
  }
}

export function validateFormConfig(config: FormConfig): void {
  const shell = formConfigShellSchema.safeParse(config);
  if (!shell.success) {
    throw new Error(`Invalid form config at ${formatIssues(shell.error.issues, config?.id ?? "config")}`);
  }

  validateFields(config.fields, "fields");
  validateSteps(config);
}
