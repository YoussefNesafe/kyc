import type { AnyFieldConfig, FormConfig } from "./types";

type StringField =
  | "text" | "email" | "textarea" | "password" | "masked"
  | "otp" | "phone" | "country" | "radio" | "segmented"
  | "signature" | "date" | "time";
type NumberField = "number" | "slider" | "rating";

type Prettify<T> = { [K in keyof T]: T[K] } & {};

export type FieldValue<F extends AnyFieldConfig> =
  F extends { type: "checkbox" | "switch"; options: readonly unknown[] } ? string[] :
  F extends { type: "checkbox" | "switch" } ? boolean :
  F extends { type: "select"; multiple: true } ? string[] :
  F extends { type: "select" } ? string :
  F extends { type: "date"; range: true } ? [string, string] :
  F extends { type: "file"; multiple: true } ? File[] :
  F extends { type: "file" } ? File | File[] :
  F extends { type: "group"; fields: infer GF extends readonly AnyFieldConfig[] } ? Prettify<NamedValues<GF>>[] :
  F extends { type: "hidden"; value: infer V } ? V :
  F extends { type: StringField } ? string :
  F extends { type: NumberField } ? number :
  unknown;

type ValueField<F extends AnyFieldConfig> =
  F extends { type: "static" | "submit" } ? never : F;

type IsConditional<F> =
  F extends { visibleWhen: unknown } ? true :
  F extends { enabledWhenVerified: unknown } ? true :
  false;

type RequiredFields<Fields extends readonly AnyFieldConfig[]> =
  Extract<Fields[number], ValueField<Fields[number]>> extends infer F
    ? F extends AnyFieldConfig ? (IsConditional<F> extends true ? never : F) : never
    : never;

type OptionalFields<Fields extends readonly AnyFieldConfig[]> =
  Extract<Fields[number], ValueField<Fields[number]>> extends infer F
    ? F extends AnyFieldConfig ? (IsConditional<F> extends true ? F : never) : never
    : never;

type NamedValues<Fields extends readonly AnyFieldConfig[]> =
  { [F in RequiredFields<Fields> as F["name"]]: FieldValue<F> } &
  { [F in OptionalFields<Fields> as F["name"]]?: FieldValue<F> };

export type InferValues<C extends FormConfig> = Prettify<NamedValues<C["fields"]>>;

export type FieldNames<C extends FormConfig> = C["fields"][number]["name"];
