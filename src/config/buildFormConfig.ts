import { defineForm } from "@/form-builder/core/defineForm";
import type { AnyFieldConfig, Condition, FormConfig, StepConfig } from "@/form-builder/core/types";
import { corporateFields } from "./fields/corporate";
import { individualFields } from "./fields/individual";
import { accountStepFields, residencyField, submitField } from "./fields/shared";
import {
  ACCOUNT_TYPES,
  CONFIGURED_CODES,
  FALLBACK_CODE,
  JURISDICTIONS,
  fallback,
  type AccountType,
  type Jurisdiction,
} from "./jurisdictions";
import { STEP_SLUGS, STEP_TITLES } from "./steps";

export type BuildFormConfigOptions = {
  /**
   * The reference date for every relative bound in the config — today's age
   * cutoff, today's latest incorporation date. Defaults to now.
   *
   * Passing it is what makes the config reproducible: a test can pin it, and
   * two calls in one session produce byte-identical fields, which is what
   * `draftConfigHash` needs. It changes once a day, which does invalidate a
   * draft left open across midnight; that is the honest cost of expressing the
   * age rule declaratively, and it is a far smaller blast radius than the
   * alternative below.
   */
  now?: Date;
};

/**
 * The whole application form, as one `FormConfig`.
 *
 * ## One config, not a rebuild per country
 *
 * The obvious design is `buildFormConfig(country)` — resolve the jurisdiction,
 * emit its fields, done. It is wrong here, for two reasons that both come from
 * the engine:
 *
 * 1. `draftConfigHash` hashes `config.fields`. A config rebuilt on every
 *    country change hashes differently every time, and `loadDraft` discards a
 *    draft whose hash does not match — so a visitor who changed their mind
 *    about the country would silently lose everything they had typed.
 * 2. Visibility is already the engine's job. With every jurisdiction's fields
 *    present and guarded, `stripInvisibleValues` keeps the hidden ones out of
 *    the payload and `buildResolverSchema` keeps them out of validation, on the
 *    client and in `parseSubmission` on a server, from the same declaration.
 *
 * So all four jurisdictions' fields live in the config at once and at most one
 * set is ever visible. The cost is a larger config object; the benefit is that
 * changing country is a value change, not a structural one.
 *
 * ## What the builder stamps
 *
 * A jurisdiction file and a branch file declare fields and nothing else. This
 * function adds:
 *
 * - `visibleWhen` — the country guard and the account-type guard. For a
 *   configured country that is `country === "DE"`; for the fallback it is
 *   `country !== "DE" && country !== "US" && country !== "AE"`, derived from the
 *   registry so a new jurisdiction cannot be added without the fallback
 *   standing aside for it. The engine's conditions are DNF over a fixed set of
 *   operators, with no `notIn`, which is why the fallback guard is a list of
 *   `notEquals` rather than one condition.
 *
 *   Note what that guard does before a country is chosen: `undefined` is not
 *   equal to any of the three, so the fallback fields are visible. That is
 *   deliberate and matches `resolveJurisdiction(undefined)` — a visitor who has
 *   not chosen a country is in exactly the situation the fallback describes.
 *
 * - `badge` — "Required in Germany", the short annotation the engine renders
 *   beside the label and folds into the accessible name. Without it, a field
 *   that appeared because of an answer two questions ago looks arbitrary.
 *   Skipped for a field with no label, since the badge has nothing to annotate.
 *
 * ## Adding a country
 *
 * One file under `jurisdictions/`, one line in `jurisdictions/index.ts`. No
 * change here, and no change to a component.
 */
export function buildFormConfig(options: BuildFormConfigOptions = {}): FormConfig {
  const now = options.now ?? new Date();

  const individual = individualFields(now);
  const corporate = corporateFields(now);

  const branchFields: Record<AccountType, typeof individual> = { individual, corporate };

  const personalFields = ACCOUNT_TYPES.flatMap((accountType) =>
    branchFields[accountType].personalFields.map((field) => withAccountTypeGuard(field, accountType)),
  );

  const jurisdictionTaxFields = jurisdictionFields("taxFields");
  const jurisdictionDocumentFields = jurisdictionFields("documentFields");

  const sharedDocumentFields = ACCOUNT_TYPES.flatMap((accountType) =>
    branchFields[accountType].documentFields.map((field) => withAccountTypeGuard(field, accountType)),
  );

  const taxStepFields: AnyFieldConfig[] = [residencyField, ...fallbackNoticeField(), ...jurisdictionTaxFields];
  const documentStepFields: AnyFieldConfig[] = [...sharedDocumentFields, ...jurisdictionDocumentFields];

  const fields: AnyFieldConfig[] = [
    ...accountStepFields,
    ...personalFields,
    ...taxStepFields,
    ...documentStepFields,
    submitField,
  ];

  const steps: StepConfig[] = [
    { title: STEP_TITLES["account-type"], fieldNames: names(accountStepFields) },
    { title: STEP_TITLES["personal-details"], fieldNames: names(personalFields) },
    { title: STEP_TITLES["tax-residency"], fieldNames: names(taxStepFields) },
    { title: STEP_TITLES.documents, fieldNames: names(documentStepFields) },
    { title: STEP_TITLES.review, review: true },
  ];

  return defineForm({
    id: "meridian-kyc-application",
    title: "Open an account",
    description:
      "Five steps. Which questions you get depends on how you are applying and where you live — everything below is declared as configuration, not written per country.",
    fields,
    steps,
  });
}

/** Sanity net: the step list is written out longhand above, so pin it to the slugs the router uses. */
if (STEP_SLUGS.length !== 5) {
  throw new Error("buildFormConfig writes five steps by hand — STEP_SLUGS must have five entries");
}

function names(fields: AnyFieldConfig[]): string[] {
  return fields.map((field) => field.name);
}

/**
 * The country half of the guard. A configured jurisdiction matches its own
 * code; the fallback matches everything the registry does not claim, expressed
 * as one `notEquals` per configured code because the engine's condition
 * vocabulary has `equals`, `notEquals`, `in` and `isValid` — and no `notIn`.
 */
function countryConditions(code: string): Condition[] {
  return code === FALLBACK_CODE
    ? CONFIGURED_CODES.map((configured) => ({ field: "country", notEquals: configured }))
    : [{ field: "country", equals: code }];
}

function withAccountTypeGuard(field: AnyFieldConfig, accountType: AccountType): AnyFieldConfig {
  return { ...field, visibleWhen: [{ field: "accountType", equals: accountType }] };
}

function badgeFor(jurisdiction: Jurisdiction, field: AnyFieldConfig): string | undefined {
  // Nothing to sit beside: `static` and `hidden` render no label, and the
  // engine documents `badge` as part of the label's accessible name.
  if (!field.label) return undefined;
  if (jurisdiction.code === FALLBACK_CODE) {
    return field.required ? "Standard requirement" : "Standard, optional";
  }
  return field.required ? `Required in ${jurisdiction.label}` : `Only asked in ${jurisdiction.label}`;
}

function withJurisdictionGuard(
  field: AnyFieldConfig,
  jurisdiction: Jurisdiction,
  accountType: AccountType,
): AnyFieldConfig {
  const badge = badgeFor(jurisdiction, field);
  return {
    ...field,
    visibleWhen: [...countryConditions(jurisdiction.code), { field: "accountType", equals: accountType }],
    ...(badge === undefined ? {} : { badge }),
  };
}

/**
 * Every jurisdiction's contribution to one step, guarded and badged. Grouped by
 * jurisdiction and then by account type, which is also the order they appear in
 * the config — invisible to any one visitor, since at most one jurisdiction and
 * one account type are ever visible together.
 */
function jurisdictionFields(slot: "taxFields" | "documentFields"): AnyFieldConfig[] {
  return [...JURISDICTIONS, fallback].flatMap((jurisdiction) =>
    ACCOUNT_TYPES.flatMap((accountType) =>
      (jurisdiction[accountType]?.[slot] ?? []).map((field) =>
        withJurisdictionGuard(field, jurisdiction, accountType),
      ),
    ),
  );
}

/**
 * The fallback's notice, as a `static` field on the tax step. It is guarded on
 * the country alone — both account types get the same sentence, so gating it on
 * the account type as well would mean two copies of it in the config.
 */
function fallbackNoticeField(): AnyFieldConfig[] {
  if (!fallback.fallbackNotice) return [];
  return [
    {
      type: "static",
      name: "jurisdictionFallbackNotice",
      as: "p",
      content: fallback.fallbackNotice,
      visibleWhen: countryConditions(FALLBACK_CODE),
    },
  ];
}
