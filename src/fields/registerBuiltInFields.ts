import { registerField } from "@/form-builder/core/registry";
import { CheckboxField } from "@/form-builder/fields/CheckboxField";
import { CountryField } from "@/form-builder/fields/CountryField";
import { DateField } from "@/form-builder/fields/DateField";
import { GroupField } from "@/form-builder/fields/GroupField";
import { HiddenField } from "@/form-builder/fields/HiddenField";
import { MaskedField } from "@/form-builder/fields/MaskedField";
import { PhoneField } from "@/form-builder/fields/PhoneField";
import { RadioField } from "@/form-builder/fields/RadioField";
import { SelectField } from "@/form-builder/fields/SelectField";
import { StaticField } from "@/form-builder/fields/StaticField";
import { SubmitField } from "@/form-builder/fields/SubmitField";
import { TextField } from "@/form-builder/fields/TextField";
import { DocumentField } from "./document";
import { withFormHandle } from "./formHandle";

/**
 * Teaches the engine's registry which component renders which field type.
 *
 * ## Why the host does this and the engine does not
 *
 * `renderField` looks the type up in a `Symbol.for`-keyed global registry and
 * has no built-in switch to fall back on — an unregistered type renders
 * "Unknown field type" in development and nothing at all in production. Nothing
 * in the vendored tree calls `registerField`, and that is the design rather than
 * an omission: the host decides which field types its bundle pays for. There is
 * exactly one registration point, so there is exactly one place to look when
 * something renders blank.
 *
 * ## The registry is also how a host replaces a component
 *
 * `file` below is not the engine's `FileField`. It is `src/fields/document.tsx`
 * — the same value contract and the same schema, with a simulated upload the
 * engine has no opinion about. That is the demo's worked example of putting
 * host code behind a field type, and it is one line here rather than a fork of
 * the engine or a new type. `document.tsx` explains at length why it takes over
 * `file` instead of registering a `document` type of its own; the short version
 * is that the engine validates built-in types and hands custom ones
 * `z.unknown().optional()`, and these are the fields where that matters most.
 *
 * ## The three aliases
 *
 * `email`, `number` and `textarea` are all served by `TextField`, which
 * branches on `field.type` internally. They still need their own entries: the
 * registry is the whole lookup, so registering `text` alone would leave the
 * other three unknown. The types are listed out longhand below rather than
 * derived from the config, so this file states its coverage rather than
 * inheriting it — a config that grows a type nobody registered should fail the
 * coverage test, not silently register it.
 *
 * ## Why every component is wrapped
 *
 * `withFormHandle` hands the shell the form instance the engine owns; see its
 * own documentation for why that indirection exists at all. It is applied here
 * rather than at each call site so a new field type cannot be added without it.
 *
 * ## Idempotence
 *
 * `registerField` is a `Map.set`, and the map lives on `globalThis`, so calling
 * this twice — or from a test after the shell has already imported it — is a
 * no-op rather than a duplicate. It must run before the first render: the shell
 * calls it at module scope, which in a client module means before any component
 * in it mounts, on the server render as well as in the browser.
 *
 * Wrapped once, at module scope, so the component identity is stable: a second
 * `registerBuiltInFields()` then overwrites each entry with the same value
 * rather than a fresh wrapper, which would remount every field on screen.
 */
const Text = withFormHandle(TextField);
const Masked = withFormHandle(MaskedField);
const Phone = withFormHandle(PhoneField);
const Select = withFormHandle(SelectField);
const Radio = withFormHandle(RadioField);
const Checkbox = withFormHandle(CheckboxField);
const DateInput = withFormHandle(DateField);
const Country = withFormHandle(CountryField);
const Document = withFormHandle(DocumentField);
const Group = withFormHandle(GroupField);
const Static = withFormHandle(StaticField);
const Hidden = withFormHandle(HiddenField);
const Submit = withFormHandle(SubmitField);

export function registerBuiltInFields(): void {
  registerField("text", Text);
  registerField("email", Text);
  registerField("number", Text);
  registerField("textarea", Text);
  registerField("masked", Masked);
  registerField("phone", Phone);
  registerField("select", Select);
  registerField("radio", Radio);
  registerField("checkbox", Checkbox);
  registerField("date", DateInput);
  registerField("country", Country);
  registerField("file", Document);
  registerField("group", Group);
  registerField("static", Static);
  registerField("hidden", Hidden);
  registerField("submit", Submit);
}
