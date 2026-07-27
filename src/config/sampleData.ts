import type { FormConfig, FormValues } from "@/form-builder/core/types";
import { FALLBACK_CODE, resolveJurisdiction, type AccountType } from "./jurisdictions";

/**
 * Invented words that appear in every sample profile and in no real submission.
 *
 * They are the demo's proof rather than its decoration: the Playwright run
 * fills the form with sample data and asserts that no outgoing request body
 * contains any of these strings. "No data leaves the browser" then becomes a
 * failing test rather than a sentence in a README.
 *
 * Anything added here must be long enough not to occur by accident in a header,
 * a URL or a bundle — a four-letter sentinel would make the network assertion
 * flaky in the direction that hides a real leak.
 */
export const SAMPLE_SENTINELS: readonly string[] = ["Quillon", "Tidewater", "sample.invalid"];

/** What "Fill with sample data" assumes when the visitor has chosen no country yet. */
export const DEFAULT_SAMPLE_COUNTRY = "DE";

/**
 * Identifiers are shaped to pass the field's mask and to be unissuable in real
 * life: a Steuer-ID never begins 000, a US taxpayer number never begins 999,
 * and every email sits under the reserved `.invalid` TLD, which by definition
 * resolves nowhere.
 *
 * Phone numbers have to satisfy `libphonenumber-js`, so they cannot be
 * nonsense. Germany and North America reserve ranges for fiction and those are
 * used (030 231 25 xxx, 555-01xx). The UAE and France reserve none, so those
 * two are merely invented — valid in shape, and not known to belong to anyone,
 * but not guaranteed unassigned the way the other two are.
 */
type Profile = Record<AccountType, FormValues>;

const DE_PROFILE: Profile = {
  individual: {
    accountPurpose: "long-term",
    fullName: "Marit Quillon",
    dateOfBirth: "1988-04-12",
    nationality: "DE",
    email: "marit.quillon@sample.invalid",
    phone: "+493023125100",
    residentialAddress: "Quillonweg 14, Vorderhaus, 2. OG",
    postalCode: "10999",
    city: "Berlin",
    de_steuerId: "00000001234",
    de_churchTax: "none",
  },
  corporate: {
    accountPurpose: "treasury",
    companyName: "Tidewater Quillon Handels GmbH",
    companyNumber: "HRB 000123 B",
    incorporationDate: "2016-03-09",
    registeredAddress: "Quillonweg 14, Aufgang C",
    contactName: "Marit Quillon",
    contactEmail: "treasury@tidewater-quillon.sample.invalid",
    contactPhone: "+493023125101",
    beneficialOwners: [
      { ownerName: "Marit Quillon", ownerStake: 60, ownerNationality: "DE" },
      { ownerName: "Ilan Tidewater", ownerStake: 40, ownerNationality: "AT" },
    ],
    de_ustIdNr: "DE000000123",
    de_handelsregisterCourt: "charlottenburg",
  },
};

const US_PROFILE: Profile = {
  individual: {
    accountPurpose: "active-trading",
    fullName: "Devon Quillon",
    dateOfBirth: "1991-11-03",
    nationality: "US",
    email: "devon.quillon@sample.invalid",
    phone: "+12025550143",
    residentialAddress: "1400 Quillon Avenue, Apartment 6",
    postalCode: "78701",
    city: "Austin",
    us_state: "TX",
    us_tin: "999001234",
    us_backupWithholding: [],
  },
  corporate: {
    accountPurpose: "hedging",
    companyName: "Tidewater Quillon Holdings LLC",
    companyNumber: "DE-0001234-LLC",
    incorporationDate: "2019-07-22",
    registeredAddress: "1400 Quillon Avenue, Suite 900",
    contactName: "Devon Quillon",
    contactEmail: "treasury@tidewater-quillon.sample.invalid",
    contactPhone: "+12025550144",
    beneficialOwners: [
      { ownerName: "Devon Quillon", ownerStake: 75, ownerNationality: "US" },
      { ownerName: "Marit Quillon", ownerStake: 25, ownerNationality: "DE" },
    ],
    us_ein: "990001234",
    us_entityClassification: "llc",
  },
};

const AE_PROFILE: Profile = {
  individual: {
    accountPurpose: "long-term",
    fullName: "Sara Quillon",
    dateOfBirth: "1986-01-25",
    nationality: "AE",
    email: "sara.quillon@sample.invalid",
    phone: "+97145550123",
    residentialAddress: "Quillon Tower, Office 1204, Marasi Drive",
    postalCode: "00000",
    city: "Dubai",
    ae_emiratesId: "000000012345",
    ae_visaStatus: "golden",
    ae_emirate: "DU",
  },
  corporate: {
    accountPurpose: "treasury",
    companyName: "Tidewater Quillon Trading FZ-LLC",
    companyNumber: "FZ-0001234",
    incorporationDate: "2021-02-15",
    registeredAddress: "Quillon Tower, Office 1204, Marasi Drive",
    contactName: "Sara Quillon",
    contactEmail: "treasury@tidewater-quillon.sample.invalid",
    contactPhone: "+97145550124",
    beneficialOwners: [{ ownerName: "Sara Quillon", ownerStake: 100, ownerNationality: "AE" }],
    ae_tradeLicenceNumber: "QT0001234",
  },
};

/**
 * The fallback covers 242 countries, so unlike the other three it cannot name a
 * city or a nationality without contradicting whichever country the visitor
 * actually chose — filling a Japanese application with a Lyon address is the
 * kind of detail that tells a reviewer the sample data was not thought about.
 * The placeless fields sit here; the country-derived ones are patched in by
 * `sampleValues`, which is the only place that knows the choice.
 */
const FALLBACK_PROFILE: Profile = {
  individual: {
    accountPurpose: "long-term",
    fullName: "Noor Quillon",
    dateOfBirth: "1994-09-30",
    email: "noor.quillon@sample.invalid",
    phone: "+33155550142",
    residentialAddress: "Quillon House, 4 Harbour Row",
    postalCode: "QT-0142",
    city: "Port Aldan",
    default_tin: "TIN-QUILLON-0001",
    default_selfDeclaration: ["confirmed"],
  },
  corporate: {
    accountPurpose: "hedging",
    companyName: "Tidewater Quillon International",
    companyNumber: "REG-0001234",
    incorporationDate: "2018-05-14",
    registeredAddress: "Quillon House, 4 Harbour Row",
    contactName: "Noor Quillon",
    contactEmail: "treasury@tidewater-quillon.sample.invalid",
    contactPhone: "+33155550143",
    beneficialOwners: [
      { ownerName: "Noor Quillon", ownerStake: 55, ownerNationality: "AT" },
      { ownerName: "Ilan Tidewater", ownerStake: 45, ownerNationality: "AT" },
    ],
    default_corporateTin: "TIN-QUILLON-0002",
  },
};

/**
 * The fallback fields whose value should simply be the country the visitor
 * chose. Split by account type because that is what the form shows: only the
 * individual branch has `nationality` and `default_taxResidency`, only the
 * corporate branch has `default_incorporationCountry`, and a sample that
 * supplied a value for a field nobody can see would be lying about coverage.
 *
 * Listed rather than inferred from the field types: `nationality` is shared
 * with the configured branches, where the profile's own answer is the right one
 * and this substitution would be wrong.
 */
const COUNTRY_DERIVED_FALLBACK_FIELDS: Record<AccountType, readonly string[]> = {
  individual: ["nationality", "default_taxResidency"],
  corporate: ["default_incorporationCountry"],
};

/** Keyed by jurisdiction code, so a new jurisdiction adds an entry here and nothing else. */
const PROFILES: Record<string, Profile> = {
  DE: DE_PROFILE,
  US: US_PROFILE,
  AE: AE_PROFILE,
  DEFAULT: FALLBACK_PROFILE,
};

export type SampleContext = {
  accountType?: string;
  country?: string;
};

/**
 * A complete, valid set of answers for the branch the visitor is currently on.
 *
 * The branch is read from what they have already chosen, not imposed: pick
 * France and the sample fills the fallback's self-declaration, not Germany's
 * Steuer-ID. Only when nothing has been chosen does it default — to Germany,
 * because landing a first-time visitor in the fallback would show them the one
 * branch that demonstrates the least.
 *
 * File fields are absent by design. A button cannot produce an upload, and the
 * design's rule that file contents never persist means there is nothing to
 * restore either — the visitor is asked to attach something themselves.
 */
export function sampleValues(current: SampleContext = {}): FormValues {
  const accountType: AccountType = current.accountType === "corporate" ? "corporate" : "individual";
  const country = current.country || DEFAULT_SAMPLE_COUNTRY;
  const code = resolveJurisdiction(country).code;
  const profile = PROFILES[code] ?? FALLBACK_PROFILE;

  const countryDerived =
    code === FALLBACK_CODE
      ? Object.fromEntries(COUNTRY_DERIVED_FALLBACK_FIELDS[accountType].map((name) => [name, country]))
      : {};

  return { ...profile[accountType], ...countryDerived, accountType, country };
}

/**
 * The slice of `sampleValues` that belongs to one step — what the per-step
 * "Fill with sample data" button applies.
 *
 * Scoped by the step's own `fieldNames` rather than by a second hand-written
 * list, so a field that moves between steps moves its sample value with it.
 */
export function sampleValuesForStep(
  config: FormConfig,
  stepIndex: number,
  current: SampleContext = {},
): FormValues {
  const fieldNames = config.steps?.[stepIndex]?.fieldNames;
  if (!fieldNames) return {};

  const typeByName = new Map(config.fields.map((field) => [field.name, field.type]));
  const values = sampleValues(current);

  return Object.fromEntries(
    fieldNames
      .filter((name) => name in values && typeByName.get(name) !== "file")
      .map((name) => [name, values[name]]),
  );
}
