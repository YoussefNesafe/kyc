import { hasDraft, type DraftStorage, type DraftStorageOption } from "@/form-builder/core/autosave";
import type { FormConfig } from "@/form-builder/core/types";
import { buildFormConfig } from "./buildFormConfig";

/**
 * The one built config the application uses, and the draft settings that have
 * to agree with it.
 */

/** Must match `FormConfig.id`; it is also the autosave draft key. */
export const APPLICATION_FORM_ID = "meridian-kyc-application";

/**
 * Where the draft lives. `"session"`, and the reason is demo safety rather than
 * ergonomics.
 *
 * This form is on a public URL and looks like a real KYC application. A
 * half-finished draft holds a name, a date of birth and a taxpayer number, and
 * `localStorage` would leave that sitting on a shared or public machine
 * indefinitely with nothing to evict it. `sessionStorage` bounds the exposure
 * to the life of the tab. It is the same instinct as the engine's
 * `sanitizeDraftValues`, which refuses to persist files, passwords and OTPs at
 * all: what is not kept cannot leak.
 *
 * `FormRenderer`'s autosave option must be given this value. The reference date
 * below is resolved from the same constant, so the draft and the date it was
 * built with always share one store and therefore one lifetime — closing the
 * tab takes both.
 */
export const APPLICATION_DRAFT_STORAGE: DraftStorageOption = "session";

const REFERENCE_DATE_KEY = "meridian-kyc:config-reference-date";
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Resolves `APPLICATION_DRAFT_STORAGE` the way the engine's own `resolveStorage`
 * does. Written out rather than imported because that helper is internal to
 * `core/autosave.ts` — but driven off the same constant the draft uses, so the
 * two cannot drift apart if it ever changes.
 */
function browserStorage(): DraftStorage | null {
  if (typeof APPLICATION_DRAFT_STORAGE === "object") return APPLICATION_DRAFT_STORAGE;
  if (typeof window === "undefined") return null;
  try {
    return APPLICATION_DRAFT_STORAGE === "session" ? window.sessionStorage : window.localStorage;
  } catch {
    // Storage can throw on access alone under some privacy settings.
    return null;
  }
}

/**
 * The reference date to build the config with: frozen while a draft exists,
 * refreshed whenever one does not.
 *
 * ## The problem this solves
 *
 * `dateOfBirth.maxDate` is `today − 18 years`, so the config's serialised
 * fields change at UTC midnight. `useDynamicForm` derives `draftConfigHash`
 * from `config.fields` internally, with no override hook, and `loadDraft`
 * discards any draft whose hash does not match.
 *
 * With the draft in `sessionStorage` the case this bites is a long sitting or
 * an open tab: someone filling the form late in the evening who refreshes, or
 * returns to the tab, after UTC midnight. The config rebuilds with a new
 * cutoff, the hash moves, and two steps of answers vanish on a page they never
 * left. Rarer than the overnight case, and considerably more baffling when it
 * happens.
 *
 * ## The fix
 *
 * Persist the date the config was built with, next to the draft, in the same
 * store. While a draft exists, rebuild with the stored date and the hash
 * matches. When no draft exists there is nothing to protect, so the date is
 * refreshed and the cutoff becomes current again — and when the tab closes,
 * `sessionStorage` takes the draft and the date together, so the next visit
 * starts clean rather than pinned to a date nothing remembers.
 *
 * Staleness is therefore bounded by the age of the draft, which against an
 * 18-year cutoff is noise — and a submission is re-derived server-side by
 * `parseSubmission` with its own `now` regardless, so nothing under-age can
 * pass on the strength of a stale bound.
 *
 * Both parameters are injected so this is testable without a browser or a
 * frozen clock.
 */
export function applicationReferenceDate(
  storage: DraftStorage | null = browserStorage(),
  today: Date = new Date(),
): Date {
  if (!storage) return today;

  try {
    const stored = storage.getItem(REFERENCE_DATE_KEY);
    if (stored !== null && ISO_DAY.test(stored) && hasDraft(APPLICATION_FORM_ID, storage)) {
      const parsed = new Date(`${stored}T00:00:00.000Z`);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    storage.setItem(REFERENCE_DATE_KEY, isoDay(today));
  } catch {
    // A full or disabled store costs us the freeze, not the form.
  }

  return today;
}

/**
 * The application's config, built once at module scope.
 *
 * Built once on purpose: `useDynamicForm` memoises on config identity, so a
 * `buildFormConfig()` call inside a component body would rebuild the config —
 * and rehash it — on every render. Import this; call `buildFormConfig` directly
 * only from tests, where the reference date is pinned.
 */
export const APPLICATION_FORM: FormConfig = buildFormConfig({ now: applicationReferenceDate() });
