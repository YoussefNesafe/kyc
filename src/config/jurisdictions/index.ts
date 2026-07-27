import { ae } from "./ae";
import { fallback } from "./default";
import { de } from "./de";
import { us } from "./us";
import type { Jurisdiction } from "./types";

export type { AccountType, Jurisdiction, JurisdictionRequirements } from "./types";
export { ACCOUNT_TYPES } from "./types";

/**
 * The registry. Adding a country is this line plus the file it imports —
 * `buildFormConfig` reads the list, stamps the guards and the badges, and every
 * component downstream renders the new fields without being told they exist.
 *
 * Order is the order the fields appear in the composed config, which matters
 * only for the config hash, not for what any one visitor sees: at most one
 * jurisdiction's fields are visible at a time.
 */
export const JURISDICTIONS: readonly Jurisdiction[] = [de, us, ae];

/** The fallback is deliberately not in `JURISDICTIONS` — it is what resolves when nothing in that list does. */
export const FALLBACK_CODE = fallback.code;

/**
 * The codes the fallback's visibility guard has to exclude. Derived rather than
 * written down, so a new jurisdiction cannot be added without the fallback
 * stepping aside for it.
 */
export const CONFIGURED_CODES: readonly string[] = JURISDICTIONS.map((jurisdiction) => jurisdiction.code);

const BY_CODE = new Map(JURISDICTIONS.map((jurisdiction) => [jurisdiction.code, jurisdiction]));

/**
 * The jurisdiction config for a country code, or the fallback.
 *
 * `undefined` is a real input, not defensive padding: an untouched `country`
 * field holds `undefined` (see the engine's `buildDefaultValues`), and a
 * visitor who has not chosen yet is in exactly the situation the fallback
 * describes.
 */
export function resolveJurisdiction(country: string | undefined): Jurisdiction {
  if (!country) return fallback;
  return BY_CODE.get(country) ?? fallback;
}

export { ae, de, fallback, us };
