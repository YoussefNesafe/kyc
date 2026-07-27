import { getCountries } from "libphonenumber-js";
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
   * The reference date for every relative bound in the config — the age cutoff
   * on `dateOfBirth`, the latest permitted `incorporationDate`.
   *
   * Required, with no `new Date()` default, because the default would be the
   * dangerous path: `draftConfigHash` hashes `config.fields`, the engine's
   * `useDynamicForm` recomputes that hash whenever the config identity changes,
   * and a `maxDate` sourced from the clock moves at UTC midnight. A builder that
   * silently read the clock would let a caller create an unstable config
   * without ever making a decision about it.
   *
   * The application passes a persisted, draft-scoped date — see
   * `APPLICATION_FORM` in `./applicationForm`. Tests pin a literal.
   */
  now: Date;
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
 *   configured country that is `country === "DE"`; for the fallback it is a
 *   single `in` over every ISO code the registry does not claim, derived from
 *   the registry so a new jurisdiction cannot be added without the fallback
 *   standing aside for it.
 *
 *   `in` rather than a `notEquals` per configured code, which is the other way
 *   to say it: one condition instead of N, and — the part that matters — an
 *   unchosen country is not *in* the list, whereas it is not *equal* to any of
 *   them. With `notEquals` the three fallback fields were visible and required
 *   before the visitor had chosen anything, so pressing Continue on an empty
 *   tax step named three fields that disappear the moment a country is picked.
 *   The cost is ~1.2 KB of repeated ISO codes per guarded field in the
 *   serialised config; it compresses to almost nothing and never reaches the
 *   network.
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
export function buildFormConfig({ now }: BuildFormConfigOptions): FormConfig {
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

  const steps: StepList = [
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

/**
 * The step list, written out longhand above, pinned to the slugs the router
 * uses. Mapping over a `readonly` tuple yields a tuple of the same arity, so
 * this is one `StepConfig` per entry in `STEP_SLUGS` — adding a sixth slug
 * fails the build here rather than desynchronising the routes from the wizard.
 */
type SameArity<T extends readonly unknown[], V> = { -readonly [K in keyof T]: V };
type StepList = SameArity<typeof STEP_SLUGS, StepConfig>;

function names(fields: AnyFieldConfig[]): string[] {
  return fields.map((field) => field.name);
}

/**
 * Every ISO code the registry does not claim — the fallback's country guard,
 * as one `in` condition.
 *
 * Sourced from the same `getCountries()` the engine's `country` field validates
 * against, so the guard and the control cannot drift apart, and sorted so the
 * config serialises identically on every call.
 */
const UNCONFIGURED_COUNTRIES: readonly string[] = (getCountries() as string[])
  .filter((code) => !CONFIGURED_CODES.includes(code))
  .sort();

/**
 * The country half of the guard. A configured jurisdiction matches its own
 * code; the fallback matches every code nobody claimed — which, being a
 * membership test, excludes an unchosen country for free.
 */
function countryConditions(code: string): Condition[] {
  return code === FALLBACK_CODE
    ? [{ field: "country", in: [...UNCONFIGURED_COUNTRIES] }]
    : [{ field: "country", equals: code }];
}

function withAccountTypeGuard(field: AnyFieldConfig, accountType: AccountType): AnyFieldConfig {
  return { ...field, visibleWhen: [{ field: "accountType", equals: accountType }] };
}

/**
 * "Required in Germany", "Only asked in countries without their own rules".
 *
 * One phrasing for every jurisdiction including the fallback, which is why
 * `Jurisdiction.label` is written as a noun phrase that reads after a
 * preposition rather than as a bare country name — the fallback has no country
 * to name, and a special case here would have left its label unread.
 */
function badgeFor(jurisdiction: Jurisdiction, field: AnyFieldConfig): string | undefined {
  // Nothing to sit beside: `static` and `hidden` render no label, and the
  // engine documents `badge` as part of the label's accessible name.
  if (!field.label) return undefined;
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
