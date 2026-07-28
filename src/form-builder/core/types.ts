export type Option = { label: string; value: string | number; disabled?: boolean };

export type TextRules = {
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  message?: string;
  trim?: boolean;
  allow?: string;
  matches?: string;
  matchesMessage?: string;
};

export type PasswordComplexity = {
  uppercase?: boolean;
  lowercase?: boolean;
  number?: boolean;
  special?: boolean;
  minLength?: number;
};

export type ButtonVariant = "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";

export type Condition = {
  field: string;
  equals?: unknown;
  notEquals?: unknown;
  in?: unknown[];
  isValid?: boolean;
};

export type ConditionSpec = Condition | Condition[] | { anyOf: Condition[][] };

export type FieldWidth = "full" | "half" | "third" | "quarter";

export type ResponsiveFieldWidth =
  | FieldWidth
  | { mobile?: FieldWidth; tablet?: FieldWidth; desktop?: FieldWidth };

export type BaseField = {
  name: string;
  label?: string;
  description?: string;
  /**
   * Short annotation rendered beside the label — "Required in Germany",
   * "Verified by your bank". Says why this field is here, which a
   * conditionally-revealed field otherwise leaves the visitor to infer.
   *
   * It is part of the field's accessible name ("Tax identification number
   * Required in Germany"), unlike the required `*`, which is `aria-hidden`
   * because `required` already reaches assistive tech through the control's
   * own attribute. The badge has no such second channel, so hiding it would
   * drop the information rather than de-duplicate it.
   *
   * `FieldWrapper` reads it off the runtime context that `FieldGate` publishes,
   * so no field component passes it through and custom types registered with
   * `registerField` inherit it for free. (A `FieldWrapper` rendered by hand,
   * outside a gate, has no config to read and takes a `badge` prop instead.)
   *
   * Needs a `label` to annotate: with none there is nothing to sit beside, and
   * `hidden`, `static`, and `submit` render no label at all. Empty string
   * renders nothing, same as `label`/`description`.
   */
  badge?: string;
  /**
   * The control's HTML `autocomplete` attribute — `"name"`, `"email"`,
   * `"street-address"`, `"postal-code"`, `"address-level2"`, `"bday"`.
   *
   * This is what WCAG 2.2 SC 1.3.5 (Identify Input Purpose, AA) asks for on
   * any field collecting information *about the person filling the form*: the
   * token is the machine-readable statement of what the field is for, which is
   * what lets a browser fill it and what lets assistive technology re-label it
   * with the icon or vocabulary its user knows. A label alone does not carry
   * that — "Postleitzahl" and "ZIP" are the same purpose and no parser can
   * tell. Omitting it on a field that has a purpose in
   * https://www.w3.org/TR/WCAG22/#input-purposes is a 1.3.5 failure.
   *
   * Deliberately typed `string`, not a union of those purposes. The attribute's
   * value is a *grammar*, not a vocabulary — an optional `section-*` group, an
   * optional `shipping`/`billing`, an optional `home`/`work`/`mobile`/`fax`/
   * `pager`, then the purpose token, then an optional `webauthn`; plus the
   * standalone `on`/`off`. The 1.3.5 list is only the purpose slot. A union of
   * it would reject `"section-owner-1 name"`, `"shipping street-address"`,
   * `"mobile tel"` and `"off"` — all valid HTML, and the first is what a
   * repeating `group` of people needs to keep the browser from filling every
   * row with the same name. Getting a token *wrong* is caught where it is
   * catchable — a test on the config, and a browser that quietly fails to fill.
   *
   * Reaches the DOM only on the field types whose control is a native
   * text-entry input the browser can write into: `text`, `email`, `password`,
   * `textarea`, `number`, `masked`, `time`, `phone`, `otp`. `date`, `select`
   * and `country` render a popover behind a `<button>` — no input to carry it —
   * and HTML ignores the attribute on `file`, `checkbox`/`switch`, `radio` and
   * `segmented`. Set on one of those it is inert, not an error.
   */
  autocomplete?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  visibleWhen?: ConditionSpec;
  disabledWhen?: ConditionSpec;
  enabledWhen?: ConditionSpec;
  enabledWhenVerified?: string;
  copyFrom?: string;
  width?: ResponsiveFieldWidth;
};

export const BUILT_IN_FIELD_TYPES = [
  "text",
  "email",
  "password",
  "textarea",
  "masked",
  "number",
  "otp",
  "phone",
  "select",
  "country",
  "radio",
  "segmented",
  "checkbox",
  "switch",
  "date",
  "time",
  "rating",
  "slider",
  "signature",
  "file",
  "hidden",
  "static",
  "group",
  "submit",
] as const;

export type FieldConfig =
  | (BaseField & { type: "text" | "email" | "textarea"; rules?: TextRules })
  | (BaseField & { type: "password"; rules?: TextRules; complexity?: PasswordComplexity })
  | (BaseField & { type: "masked"; mask: string; message?: string })
  | (BaseField & { type: "number"; min?: number; max?: number; step?: number })
  | (BaseField & { type: "otp"; length: number; dependsOn?: string })
  | (BaseField & { type: "phone"; defaultCountry?: string; preferredCountries?: string[]; countryFrom?: string })
  | (BaseField & {
      type: "select";
      options?: Option[];
      optionsFrom?: { field: string; map: Record<string, Option[]> };
      searchable?: boolean;
      multiple?: boolean;
    })
  | (BaseField & { type: "country"; countries?: string[]; preferredCountries?: string[] })
  | (BaseField & { type: "radio"; options: Option[] })
  | (BaseField & { type: "segmented"; options: Option[] })
  | (BaseField & { type: "checkbox" | "switch"; options?: Option[] })
  | (BaseField & {
      type: "date";
      range?: boolean;
      minDate?: string;
      maxDate?: string;
      minDateField?: string;
      maxDateField?: string;
      /**
       * Replaces the generic bound message ("Must be at most 2008-07-27") when a
       * value falls outside `minDate`/`maxDate`, so a date expressing a rule can
       * state the rule: "You must be 18 or older to open an account."
       *
       * WHERE THIS SURFACES depends on `pickerBounds`. Under the default
       * `"restrict"` the calendar disables out-of-range days and clamps its
       * navigable months, and the field has no text-entry path, so a user
       * driving the UI cannot reach a bound violation — the message is then
       * reserved for values that arrive without passing through the calendar
       * (`parseSubmission`, a restored autosave draft, `copyFrom`, programmatic
       * defaults) and it does not explain greyed-out days. Under `"validate"`
       * those same days stay selectable and this becomes inline feedback on the
       * pick as well, which is the setting an age cutoff wants.
       *
       * It covers every `minDate`/`maxDate` violation on the field and nothing
       * else. That means:
       * - one sentence serves both bounds, so with `minDate` and `maxDate` both
       *   set it must read for too-early and too-late alike ("Settlement must
       *   fall inside January 2026", not "Too late");
       * - on `range: true` it applies to `from` and `to` alike. The missing-`to`
       *   and `from`-after-`to` messages stay generic, so a reversed range that
       *   also breaks a bound reports the override on each offending endpoint
       *   *and* `messages.invalidDate` at the field root;
       * - an unparseable value still gets `messages.invalidDate`;
       * - `minDateField`/`maxDateField` keep their own messages, which already
       *   name the other field ("Must be on or after Start date"). Overriding
       *   those would collapse two distinct rules into one sentence and drop
       *   that label — the same reason `TextRules` gives `matches` its own
       *   `matchesMessage` rather than reusing `message`. When a static bound
       *   and a cross-field rule both fail, both issues land on this field and
       *   the override is reported first, so it is the one a form using
       *   react-hook-form's default `criteriaMode: "firstError"` shows.
       *
       * The string is a config literal, so it bypasses the `Messages` layer and
       * renders as written on a localized form — the same tradeoff `masked`
       * makes with its own `message`. Must be non-empty (validator-enforced).
       */
      message?: string;
      /**
       * What `minDate`/`maxDate` do to the calendar. They always constrain the
       * *value*; this chooses whether they also constrain the *picker*. It
       * governs those two bounds and nothing else: `minDateField`/`maxDateField`
       * never shape the calendar under either setting, because their limit
       * moves with a sibling field and is only known to the form-level refine —
       * so a field bounded only by those already behaves like `"validate"`.
       *
       * - `"restrict"` (default): out-of-range days are disabled and the
       *   month/year dropdowns stop at the bounds, so an unavailable range is
       *   simply unreachable — right for a booking calendar with no
       *   availability before today.
       * - `"validate"`: those days stay selectable by mouse and by arrow key,
       *   and picking one fails with `message` (or the generic bound text).
       *
       * Choose `"validate"` when the bound states a rule the user needs told
       * rather than a range that is unavailable. An age cutoff greys out
       * two-thirds of the calendar and reads as a broken widget — the visitor
       * is left asking why they cannot select their own birthday, when what
       * they need to hear is "you must be 18 or older". Only the picker
       * changes: the schema rejects the value under either setting, so this
       * never widens what a form accepts.
       *
       * `"validate"` also unclamps month navigation, since a 16-year-old cannot
       * reach their birth year through a year dropdown that stops at the
       * cutoff. Unclamping widens rather than replaces: the navigable span is
       * the generic one around today *plus* whatever the bounds reach, so a
       * bound far outside it stays reachable instead of being swapped out for a
       * window that excludes it. The calendar still *opens* on `maxDate`'s
       * month when that is in the past — a landing month is not a restriction,
       * and it puts the rule a hop away from the dates that break it.
       */
      pickerBounds?: "restrict" | "validate";
    })
  | (BaseField & {
      type: "time";
      minTime?: string;
      maxTime?: string;
      stepMinutes?: number;
      minTimeField?: string;
      maxTimeField?: string;
    })
  | (BaseField & { type: "rating"; max?: number })
  | (BaseField & { type: "slider"; min: number; max: number; step?: number })
  | (BaseField & { type: "signature"; penColor?: string; heightPx?: number })
  | (BaseField & { type: "file"; accept?: string; maxSizeMB?: number; multiple?: boolean })
  | (BaseField & { type: "hidden"; value: unknown })
  | (BaseField & { type: "static"; content: string; as?: "h1" | "h2" | "p" | "divider" })
  | (BaseField & { type: "group"; fields: AnyFieldConfig[]; min?: number; max?: number })
  | (BaseField & { type: "submit"; text: string; variant?: ButtonVariant });

export type FieldType = FieldConfig["type"];

export type CustomFieldConfig = BaseField & { type: string } & Record<string, unknown>;

export type AnyFieldConfig = FieldConfig | CustomFieldConfig;

export function isBuiltInField(field: AnyFieldConfig): field is FieldConfig {
  return (BUILT_IN_FIELD_TYPES as readonly string[]).includes(field.type);
}

export type StepConfig = {
  title: string;
  fieldNames?: string[];
  review?: boolean;
  visibleWhen?: ConditionSpec;
};

export type FormConfig = {
  id: string;
  title?: string;
  description?: string;
  fields: AnyFieldConfig[];
  steps?: StepConfig[];
};

export type FormValues = Record<string, unknown>;
