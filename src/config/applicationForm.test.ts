import { describe, expect, it } from "vitest";
import {
  clearDraft,
  draftConfigHash,
  loadDraft,
  saveDraft,
  type DraftStorage,
} from "@/form-builder/core/autosave";
import { APPLICATION_FORM, APPLICATION_FORM_ID, applicationReferenceDate } from "./applicationForm";
import { buildFormConfig } from "./buildFormConfig";

function memoryStorage(): DraftStorage {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  };
}

const MONDAY = new Date("2026-07-27T09:00:00Z");
const TUESDAY = new Date("2026-07-28T09:00:00Z");

describe("applicationReferenceDate", () => {
  it("returns today when there is no storage at all, as on the server", () => {
    expect(applicationReferenceDate(null, MONDAY)).toBe(MONDAY);
  });

  it("records today's date the first time it is asked", () => {
    const storage = memoryStorage();
    expect(applicationReferenceDate(storage, MONDAY)).toBe(MONDAY);
    expect(storage.getItem("meridian-kyc:config-reference-date")).toBe("2026-07-27");
  });

  it("refreshes the date when no draft is in progress", () => {
    const storage = memoryStorage();
    applicationReferenceDate(storage, MONDAY);
    expect(applicationReferenceDate(storage, TUESDAY).toISOString()).toBe(TUESDAY.toISOString());
  });

  it("freezes the date while a draft exists, so the config it was built with can be rebuilt", () => {
    const storage = memoryStorage();
    applicationReferenceDate(storage, MONDAY);
    saveDraft(APPLICATION_FORM_ID, "any-hash", { fullName: "Marit Quillon" }, 1, storage);

    expect(applicationReferenceDate(storage, TUESDAY).toISOString()).toBe("2026-07-27T00:00:00.000Z");
  });

  it("ignores a corrupted stored date rather than building an invalid config", () => {
    const storage = memoryStorage();
    storage.setItem("meridian-kyc:config-reference-date", "the day before yesterday");
    saveDraft(APPLICATION_FORM_ID, "any-hash", {}, 0, storage);

    expect(applicationReferenceDate(storage, TUESDAY)).toBe(TUESDAY);
  });

  it("survives a storage that throws on every access", () => {
    const hostile: DraftStorage = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
      removeItem: () => {
        throw new Error("denied");
      },
    };
    expect(applicationReferenceDate(hostile, MONDAY)).toBe(MONDAY);
  });
});

describe("a draft written on one day and reopened on the next", () => {
  it("still loads — which is what the first step promises the visitor", () => {
    const storage = memoryStorage();

    // Monday: build the config the way the app does, and autosave a draft.
    const mondayConfig = buildFormConfig({ now: applicationReferenceDate(storage, MONDAY) });
    const mondayHash = draftConfigHash(mondayConfig.fields);
    const values = { accountType: "individual", country: "DE", fullName: "Marit Quillon" };
    saveDraft(APPLICATION_FORM_ID, mondayHash, values, 1, storage);

    // Tuesday: same code path, one day later.
    const tuesdayConfig = buildFormConfig({ now: applicationReferenceDate(storage, TUESDAY) });
    const tuesdayHash = draftConfigHash(tuesdayConfig.fields);

    expect(tuesdayHash).toBe(mondayHash);
    expect(loadDraft(APPLICATION_FORM_ID, tuesdayHash, storage)).toEqual({ values, step: 1 });
  });

  it("would not load without the freeze — the guard is load-bearing, not decorative", () => {
    const storage = memoryStorage();

    const mondayHash = draftConfigHash(buildFormConfig({ now: MONDAY }).fields);
    saveDraft(APPLICATION_FORM_ID, mondayHash, { fullName: "Marit Quillon" }, 1, storage);

    // The clock, unfrozen.
    const tuesdayHash = draftConfigHash(buildFormConfig({ now: TUESDAY }).fields);
    expect(tuesdayHash).not.toBe(mondayHash);
    expect(loadDraft(APPLICATION_FORM_ID, tuesdayHash, storage)).toBeNull();
  });

  it("lets go once the draft is cleared, so the age cutoff does not stay stale forever", () => {
    const storage = memoryStorage();
    applicationReferenceDate(storage, MONDAY);
    saveDraft(APPLICATION_FORM_ID, "any-hash", {}, 0, storage);
    clearDraft(APPLICATION_FORM_ID, storage);

    expect(applicationReferenceDate(storage, TUESDAY)).toBe(TUESDAY);
  });
});

describe("APPLICATION_FORM", () => {
  it("is one built config, not a factory the UI could call per render", () => {
    expect(APPLICATION_FORM.id).toBe(APPLICATION_FORM_ID);
    expect(APPLICATION_FORM.fields.length).toBeGreaterThan(0);
  });
});
