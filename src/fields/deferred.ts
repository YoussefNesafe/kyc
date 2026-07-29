import type { ComponentType } from "react";
import type { FieldComponentProps } from "@/form-builder/core/registry";

/**
 * The field components step one does not need, as loaders rather than imports.
 *
 * ## Why these four
 *
 * `/apply/account-type` renders three field types: `static`, `radio` and
 * `select`. Everything below belongs to a later step, and until this file
 * existed the first step's bundle paid for all of it anyway — one client chunk
 * of 291 KiB over the wire, of which Lighthouse reported 186 KiB unused on the
 * first step.
 *
 * The largest single item in it is `react-phone-number-input/flags`, a barrel of
 * 250 inlined SVGs, imported wholesale by BOTH `CountryField` and `PhoneField`.
 * Splitting one and not the other would have moved nothing: the barrel would
 * have stayed in the main chunk through whichever import was left behind. They
 * are deferred together for that reason, not because they are similar fields.
 *
 * `DateField` brings `react-day-picker`. `DocumentField` brings the dropzone and
 * the simulated upload machinery. Neither appears before step two.
 *
 * ## Why the loaders live here rather than inline in the registry
 *
 * Two callers need the identical module specifier: `registerBuiltInFields`,
 * which wraps each in `next/dynamic`, and the shell, which warms them once the
 * first step is interactive. Written twice, they would be two bundles of the
 * same code the day someone edited one path — the deferred chunk would silently
 * stop being the warmed chunk, and nothing would fail. Written once, that cannot
 * happen.
 *
 * ## What is deliberately NOT deferred
 *
 * `text`, `masked`, `select`, `radio`, `checkbox`, `group`, `static`, `hidden`
 * and `submit`. Each is small, several are on the first step, and a component
 * that arrives late is worse than a component that was always there — splitting
 * them would buy kilobytes and cost a flash of empty space on every step.
 */

type FieldLoader = () => Promise<ComponentType<FieldComponentProps>>;

export const loadCountryField: FieldLoader = () =>
  import("@/form-builder/fields/CountryField").then((m) => m.CountryField);

export const loadPhoneField: FieldLoader = () =>
  import("@/form-builder/fields/PhoneField").then((m) => m.PhoneField);

export const loadDateField: FieldLoader = () =>
  import("@/form-builder/fields/DateField").then((m) => m.DateField);

export const loadDocumentField: FieldLoader = () =>
  import("./document").then((m) => m.DocumentField);

/**
 * Every deferred loader, for the shell to warm.
 *
 * Listed rather than derived so this file states its own coverage: a fifth
 * deferred field that was registered but never added here would load lazily and
 * never be warmed, which is the failure that shows up as a flash on a slow
 * connection and nowhere else.
 */
export const DEFERRED_FIELD_LOADERS: readonly FieldLoader[] = [
  loadCountryField,
  loadPhoneField,
  loadDateField,
  loadDocumentField,
];
