import { hasDraft, type DraftStorage, type DraftStorageOption } from "@/form-builder/core/autosave";
import type { FormConfig } from "@/form-builder/core/types";
import { buildFormConfig } from "./buildFormConfig";

/**
 * The one built config the application uses, and the draft settings that have
 * to agree with it.
 *
 * Everything here exists to keep one promise the form makes on screen —
 * "Progress is kept in this browser only, so you can close the tab and come
 * back" — against one engine behaviour that would otherwise break it.
 */

/** Must match `FormConfig.id`; it is also the autosave draft key. */
export const APPLICATION_FORM_ID = "meridian-kyc-application";

/**
 * Where the draft lives. `"local"` rather than `"session"` because the copy
 * promises the visitor can *close the tab* and come back, and sessionStorage
 * does not survive that. `FormRenderer`'s autosave option must be given this
 * value, or the draft and the reference date below stop sharing a lifetime.
 */
export const APPLICATION_DRAFT_STORAGE: DraftStorageOption = "local";

const REFERENCE_DATE_KEY = "meridian-kyc:config-reference-date";
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function browserStorage(): DraftStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
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
 * discards any draft whose hash does not match. A visitor who filled two steps
 * on Monday and returned on Tuesday would find the form empty — while being
 * told, on the first step, that they could do exactly that.
 *
 * ## The fix
 *
 * Persist the date the config was built with, next to the draft. While a draft
 * exists, rebuild with the stored date and the hash matches. When no draft
 * exists there is nothing to protect, so the date is refreshed and the cutoff
 * becomes current again.
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
