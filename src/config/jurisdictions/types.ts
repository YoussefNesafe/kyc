import type { AnyFieldConfig } from "@/form-builder/core/types";

/** The two branches of the application. The other axis is `country`. */
export type AccountType = "individual" | "corporate";

export const ACCOUNT_TYPES: readonly AccountType[] = ["individual", "corporate"] as const;

/**
 * What one jurisdiction asks of one kind of applicant, grouped by the step the
 * fields land on. The grouping is the whole reason `buildFormConfig` needs no
 * per-jurisdiction knowledge: the key says which step, the enclosing
 * `Jurisdiction` key says which account type, and those two facts are exactly
 * the guard the builder has to stamp.
 */
export type JurisdictionRequirements = {
  /** Extra fields on the "Tax residency" step. */
  taxFields?: AnyFieldConfig[];
  /** Extra uploads on the "Documents" step. */
  documentFields?: AnyFieldConfig[];
};

/**
 * One jurisdiction's contribution to the application form.
 *
 * A jurisdiction file declares fields only — it never writes a `visibleWhen`
 * and never writes a `badge`. `buildFormConfig` stamps the country and
 * account-type guard and the "Required in <label>" badge, so adding a country
 * is one file plus one line in `index.ts`, with no component code touched.
 *
 * Consequences worth knowing before writing one:
 *
 * - Field names live in a single flat namespace shared with every other
 *   jurisdiction, because all of them are composed into one `FormConfig`
 *   (see `buildFormConfig` for why it is one config and not a rebuild per
 *   country). Prefix names with the lowercased code — `de_steuerId`,
 *   `us_tin` — and `buildFormConfig`'s own test will catch a collision.
 * - A field with no `label` gets no badge: the engine documents `badge` as an
 *   annotation that sits beside the label and joins the accessible name, so
 *   there is nothing for it to annotate on `static` or `hidden`.
 * - Anything set here that `baseFieldSchema` does not recognise makes
 *   `validateFormConfig` throw at runtime, not at compile time — it is a
 *   `z.strictObject`.
 */
export type Jurisdiction = {
  /** ISO 3166-1 alpha-2, or `"DEFAULT"` for the fallback. */
  code: string;
  /** Written out in full, because it is rendered: "Required in Germany". */
  label: string;
  /** What an individual applicant resident here is asked for. */
  individual: JurisdictionRequirements;
  /** What a corporate applicant registered here is asked for. */
  corporate?: JurisdictionRequirements;
  /**
   * Set only on the fallback config. `buildFormConfig` renders it as a `static`
   * field on the tax step, so a visitor whose country has no bespoke config is
   * told which config resolved rather than left wondering why the questions
   * look generic.
   */
  fallbackNotice?: string;
};
