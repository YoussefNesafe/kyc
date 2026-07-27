import { describe, expect, it } from "vitest";
import { visibleFieldsFor } from "@/form-builder/core/conditions";
import { defaultMessages } from "@/form-builder/core/messages";
import { buildResolverSchema } from "@/form-builder/core/validation";
import type { AnyFieldConfig, FormValues } from "@/form-builder/core/types";
import { buildFormConfig } from "./buildFormConfig";
import { ACCOUNT_TYPES, type AccountType } from "./jurisdictions";
import { SAMPLE_SENTINELS, sampleValues, sampleValuesForStep } from "./sampleData";
import { STEP_SLUGS, stepIndexForSlug } from "./steps";

const REFERENCE = new Date("2026-07-27T00:00:00Z");
const config = buildFormConfig({ now: REFERENCE });

/** DE, US and AE are configured; FR exercises the fallback. */
const COUNTRIES = ["DE", "US", "AE", "FR"] as const;

const fileFieldNames = new Set(config.fields.filter((f) => f.type === "file").map((f) => f.name));

/** `static`, `submit` and `hidden` hold no value a sample could supply. */
const VALUELESS_TYPES = new Set(["static", "submit", "hidden"]);

function stringsIn(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(stringsIn);
  if (value && typeof value === "object") return Object.values(value).flatMap(stringsIn);
  return [];
}

function hasSentinel(value: string): boolean {
  return SAMPLE_SENTINELS.some((sentinel) => value.toLowerCase().includes(sentinel.toLowerCase()));
}

function eachProfile(run: (values: FormValues, label: string) => void): void {
  for (const country of COUNTRIES) {
    for (const accountType of ACCOUNT_TYPES) {
      run(sampleValues({ country, accountType }), `${country}/${accountType}`);
    }
  }
}

describe("sample data validates against the schema the engine builds", () => {
  it("leaves nothing invalid except the files a button cannot fill", () => {
    eachProfile((values, label) => {
      const schema = buildResolverSchema(config, defaultMessages, undefined, values);
      const result = schema.safeParse(values);
      const offending = result.success
        ? []
        : result.error.issues
            .map((issue) => String(issue.path[0] ?? ""))
            .filter((name) => !fileFieldNames.has(name));
      expect(offending, `${label}: ${JSON.stringify(offending)}`).toEqual([]);
    });
  });

  it("supplies a value for every visible field that takes one", () => {
    eachProfile((values, label) => {
      const missing = visibleFieldsFor(config, values)
        .filter((f: AnyFieldConfig) => !VALUELESS_TYPES.has(f.type) && !fileFieldNames.has(f.name))
        .map((f) => f.name)
        .filter((name) => !(name in values));
      expect(missing, label).toEqual([]);
    });
  });

  it("supplies nothing for a field that is not visible", () => {
    eachProfile((values, label) => {
      const visible = new Set(visibleFieldsFor(config, values).map((f) => f.name));
      const known = new Set(config.fields.map((f) => f.name));
      const strays = Object.keys(values).filter((name) => known.has(name) && !visible.has(name));
      expect(strays, label).toEqual([]);
    });
  });

  it("fills the German branch with German fields and the US branch with US ones", () => {
    expect(sampleValues({ country: "DE", accountType: "individual" })).toHaveProperty("de_steuerId");
    expect(sampleValues({ country: "US", accountType: "individual" })).toHaveProperty("us_tin");
    expect(sampleValues({ country: "US", accountType: "individual" })).not.toHaveProperty("de_steuerId");
    expect(sampleValues({ country: "AE", accountType: "individual" })).toHaveProperty("ae_emiratesId");
    expect(sampleValues({ country: "FR", accountType: "individual" })).toHaveProperty("default_tin");
  });

  it("keeps a country the visitor already chose", () => {
    expect(sampleValues({ country: "JP", accountType: "individual" }).country).toBe("JP");
  });

  it("does not fill a Japanese application with a French nationality", () => {
    const values = sampleValues({ country: "JP", accountType: "individual" });
    expect(values.nationality).toBe("JP");
    expect(values.default_taxResidency).toBe("JP");
    expect(sampleValues({ country: "JP", accountType: "corporate" }).default_incorporationCountry).toBe("JP");
  });

  it("leaves a configured jurisdiction's own nationality alone", () => {
    expect(sampleValues({ country: "DE", accountType: "individual" }).nationality).toBe("DE");
  });

  it("shows a configured jurisdiction when nothing has been chosen yet", () => {
    const values = sampleValues({});
    expect(values.country).toBe("DE");
    expect(values.accountType).toBe("individual");
    expect(values).toHaveProperty("de_steuerId");
  });
});

describe("sample data is unmistakably fictional", () => {
  it("carries a sentinel in every name, company and email", () => {
    const NAMED = ["fullName", "contactName", "companyName", "email", "contactEmail"];
    eachProfile((values, label) => {
      for (const name of NAMED) {
        const value = values[name];
        if (value === undefined) continue;
        expect(hasSentinel(String(value)), `${label}.${name} = ${String(value)}`).toBe(true);
      }
      for (const owner of (values.beneficialOwners as { ownerName: string }[] | undefined) ?? []) {
        expect(hasSentinel(owner.ownerName), `${label} owner ${owner.ownerName}`).toBe(true);
      }
    });
  });

  it("uses only the reserved .invalid TLD for email, so no sample address can reach anyone", () => {
    eachProfile((values, label) => {
      for (const key of ["email", "contactEmail"]) {
        const value = values[key];
        if (value === undefined) continue;
        expect(String(value).endsWith(".invalid"), `${label}.${key}`).toBe(true);
      }
    });
  });

  it("puts at least one sentinel in every profile, which is what the network test greps for", () => {
    eachProfile((values, label) => {
      expect(stringsIn(values).some(hasSentinel), label).toBe(true);
    });
  });

  it("declares sentinels that are not words a real submission would contain", () => {
    expect(SAMPLE_SENTINELS.length).toBeGreaterThan(0);
    for (const sentinel of SAMPLE_SENTINELS) {
      expect(sentinel.length).toBeGreaterThan(4);
    }
  });
});

describe("sampleValuesForStep", () => {
  const current = { country: "DE", accountType: "individual" as AccountType };

  it("returns only fields belonging to that step", () => {
    STEP_SLUGS.forEach((slug, index) => {
      const stepNames = new Set(config.steps![index].fieldNames ?? []);
      for (const name of Object.keys(sampleValuesForStep(config, index, current))) {
        expect(stepNames.has(name), `${slug} does not own ${name}`).toBe(true);
      }
    });
  });

  it("never offers a value for a file field — a button cannot produce an upload", () => {
    STEP_SLUGS.forEach((_, index) => {
      for (const name of Object.keys(sampleValuesForStep(config, index, current))) {
        expect(fileFieldNames.has(name)).toBe(false);
      }
    });
  });

  it("returns nothing for the review step, which owns no fields", () => {
    expect(sampleValuesForStep(config, stepIndexForSlug("review")!, current)).toEqual({});
  });

  it("returns nothing for an index that is not a step", () => {
    expect(sampleValuesForStep(config, 99, current)).toEqual({});
  });

  it("adds up to the whole profile, step by step", () => {
    const merged = STEP_SLUGS.reduce<FormValues>(
      (acc, _slug, index) => ({ ...acc, ...sampleValuesForStep(config, index, current) }),
      {},
    );
    const expected = Object.fromEntries(
      Object.entries(sampleValues(current)).filter(([name]) => !fileFieldNames.has(name)),
    );
    expect(merged).toEqual(expected);
  });
});
