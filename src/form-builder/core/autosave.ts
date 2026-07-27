import type { AnyFieldConfig, FormValues } from "./types";

/** The subset of the Web Storage API a draft needs. Anything matching this
 *  shape works — sessionStorage, localStorage, or an in-memory stub.
 *  Note the SSR difference: the built-in `"local"`/`"session"` stores are
 *  skipped when there is no `window`, but a custom store is used as given, so
 *  it will also be read and written during server rendering. */
export type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type DraftStorageOption = "local" | "session" | DraftStorage;

function resolveStorage(storage: DraftStorageOption = "local"): DraftStorage | null {
  if (storage && typeof storage === "object") return storage;
  if (typeof window === "undefined") return null;
  return storage === "session" ? window.sessionStorage : window.localStorage;
}

export type AutosaveOptions = {
  key?: string;
  debounceMs?: number;
  includeSignatures?: boolean;
  /** Where drafts live. Defaults to "local" — unchanged from previous behaviour.
   *  If you pass an object, keep it referentially stable (module scope or
   *  useMemo); a new object each render re-subscribes the autosave effect. */
  storage?: DraftStorageOption;
};

type DraftPayload = {
  hash: string;
  values: FormValues;
  step?: number;
};

export function draftStorageKey(idOrKey: string): string {
  return `form-builder:draft:${idOrKey}`;
}

export function draftConfigHash(fields: AnyFieldConfig[]): string {
  const json = JSON.stringify(fields);
  let hash = 5381;
  for (let i = 0; i < json.length; i += 1) {
    hash = ((hash << 5) + hash + json.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

const hasFile = (value: unknown): boolean =>
  (typeof File !== "undefined" && value instanceof File) ||
  (Array.isArray(value) && value.some((item) => typeof File !== "undefined" && item instanceof File));

export function sanitizeDraftValues(
  fields: AnyFieldConfig[],
  values: FormValues,
  includeSignatures = false,
): FormValues {
  const byName = new Map(fields.map((field) => [field.name, field]));
  const out: FormValues = {};
  for (const [name, value] of Object.entries(values)) {
    const field = byName.get(name);
    if (field?.type === "file" || field?.type === "password" || field?.type === "otp") continue;
    if (field?.type === "signature" && !includeSignatures) continue;
    if (field?.type === "group" && Array.isArray(value)) {
      const inner = (field as { fields: AnyFieldConfig[] }).fields;
      out[name] = value.map((row) =>
        row && typeof row === "object" && !Array.isArray(row)
          ? sanitizeDraftValues(inner, row as FormValues, includeSignatures)
          : row,
      );
      continue;
    }
    if (hasFile(value)) continue;
    out[name] = value;
  }
  return out;
}

export function loadDraft(
  idOrKey: string,
  hash: string,
  storage?: DraftStorageOption,
): { values: FormValues; step?: number } | null {
  const store = resolveStorage(storage);
  if (!store) return null;
  const storageKey = draftStorageKey(idOrKey);
  try {
    const raw = store.getItem(storageKey);
    if (raw === null) return null;
    const payload = JSON.parse(raw) as DraftPayload;
    if (payload.hash !== hash || typeof payload.values !== "object" || payload.values === null) {
      store.removeItem(storageKey);
      return null;
    }
    return { values: payload.values, step: payload.step };
  } catch {
    try {
      store.removeItem(storageKey);
    } catch {
    }
    return null;
  }
}

export function saveDraft(
  idOrKey: string,
  hash: string,
  values: FormValues,
  step?: number,
  storage?: DraftStorageOption,
): void {
  const store = resolveStorage(storage);
  if (!store) return;
  try {
    const payload: DraftPayload = { hash, values, ...(step !== undefined ? { step } : {}) };
    store.setItem(draftStorageKey(idOrKey), JSON.stringify(payload));
  } catch {
  }
}

export function hasDraft(idOrKey: string, storage?: DraftStorageOption): boolean {
  const store = resolveStorage(storage);
  if (!store) return false;
  try {
    return store.getItem(draftStorageKey(idOrKey)) !== null;
  } catch {
    return false;
  }
}

export function clearDraft(idOrKey: string, storage?: DraftStorageOption): void {
  const store = resolveStorage(storage);
  if (!store) return;
  try {
    store.removeItem(draftStorageKey(idOrKey));
  } catch {
  }
}
