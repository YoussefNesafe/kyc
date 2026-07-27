import { describe, expect, it } from "vitest";
import type { AnyFieldConfig } from "@/form-builder/core/types";
import { ACCOUNT_TYPES, type Jurisdiction } from "./types";
import { CONFIGURED_CODES, FALLBACK_CODE, JURISDICTIONS, resolveJurisdiction } from "./index";

function allFields(jurisdiction: Jurisdiction): AnyFieldConfig[] {
  return ACCOUNT_TYPES.flatMap((accountType) => {
    const requirements = jurisdiction[accountType];
    return [...(requirements?.taxFields ?? []), ...(requirements?.documentFields ?? [])];
  });
}

describe("resolveJurisdiction", () => {
  it("returns the exact config for a supported country", () => {
    expect(resolveJurisdiction("DE").code).toBe("DE");
    expect(resolveJurisdiction("US").code).toBe("US");
    expect(resolveJurisdiction("AE").code).toBe("AE");
  });

  it("falls back for an unconfigured country and says so", () => {
    const resolved = resolveJurisdiction("FR");
    expect(resolved.code).toBe(FALLBACK_CODE);
    expect(resolved.fallbackNotice).toBeTruthy();
  });

  it("falls back for an empty selection", () => {
    expect(resolveJurisdiction("").code).toBe(FALLBACK_CODE);
  });

  it("falls back for an undefined selection, which is what an untouched country field holds", () => {
    expect(resolveJurisdiction(undefined).code).toBe(FALLBACK_CODE);
  });

  it("names the config that resolved, so the notice is not a vague apology", () => {
    expect(resolveJurisdiction("FR").fallbackNotice).toContain("standard");
  });
});

describe("the configured jurisdictions", () => {
  it("lists exactly the codes the fallback guard excludes", () => {
    expect(CONFIGURED_CODES).toEqual(JURISDICTIONS.map((j) => j.code));
    expect(CONFIGURED_CODES).not.toContain(FALLBACK_CODE);
  });

  it("gives every jurisdiction a distinct set of tax field names", () => {
    const names = JURISDICTIONS.map((j) => (j.individual.taxFields ?? []).map((f) => f.name).join(","));
    expect(new Set(names).size).toBe(names.length);
  });

  it("differs in shape, not only in labels — no two ask the same number of the same field types", () => {
    const shapes = JURISDICTIONS.map((j) =>
      allFields(j)
        .map((f) => f.type)
        .sort()
        .join(","),
    );
    expect(new Set(shapes).size).toBe(shapes.length);
  });

  it("asks the UAE for no tax identification number at all", () => {
    const ae = resolveJurisdiction("AE");
    const names = allFields(ae).map((f) => f.name.toLowerCase());
    expect(names.some((name) => name.includes("tin") || name.includes("tax"))).toBe(false);
  });

  it("declares no visibility guard of its own — the builder owns that", () => {
    for (const jurisdiction of [...JURISDICTIONS, resolveJurisdiction("FR")]) {
      for (const field of allFields(jurisdiction)) {
        expect(field.visibleWhen, `${jurisdiction.code}.${field.name}`).toBeUndefined();
        expect(field.badge, `${jurisdiction.code}.${field.name}`).toBeUndefined();
      }
    }
  });

  it("prefixes every field name with its own code, so one flat namespace stays collision-free", () => {
    for (const jurisdiction of [...JURISDICTIONS, resolveJurisdiction("FR")]) {
      const prefix = `${jurisdiction.code.toLowerCase()}_`;
      for (const field of allFields(jurisdiction)) {
        expect(field.name.startsWith(prefix), `${field.name} should start with ${prefix}`).toBe(true);
      }
    }
  });

  it("carries a fallbackNotice on the fallback config only", () => {
    for (const jurisdiction of JURISDICTIONS) {
      expect(jurisdiction.fallbackNotice, jurisdiction.code).toBeUndefined();
    }
  });
});
