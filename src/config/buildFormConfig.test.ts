import { describe, expect, it } from "vitest";
import { draftConfigHash } from "@/form-builder/core/autosave";
import { getVisibleFields, stripInvisibleValues } from "@/form-builder/core/conditions";
import { defaultMessages } from "@/form-builder/core/messages";
import { buildResolverSchema } from "@/form-builder/core/validation";
import { validateFormConfig } from "@/form-builder/core/schema";
import type { AnyFieldConfig, FormValues } from "@/form-builder/core/types";
import { buildFormConfig } from "./buildFormConfig";
import { STEP_SLUGS, slugForStepIndex, stepIndexForSlug } from "./steps";

/** Pinned so the age cutoff — and therefore the config hash — cannot drift with the calendar. */
const REFERENCE = new Date("2026-07-27T00:00:00Z");

const config = buildFormConfig({ now: REFERENCE });

function field(name: string): AnyFieldConfig {
  const found = config.fields.find((f) => f.name === name);
  if (!found) throw new Error(`no field named "${name}" in the built config`);
  return found;
}

function visibleNames(values: FormValues): string[] {
  return getVisibleFields(config.fields, values).map((f) => f.name);
}

/**
 * The field types this demo's engine install actually ships components for.
 * `validateFormConfig` will not catch a type outside this list — every entry
 * here is a built-in as far as the engine is concerned — but the renderer looks
 * the type up in the registry and draws "Unknown field type" when it misses.
 */
const INSTALLED_TYPES = new Set([
  "text",
  "email",
  "password",
  "textarea",
  "number",
  "select",
  "country",
  "radio",
  "checkbox",
  "date",
  "file",
  "phone",
  "masked",
  "static",
  "submit",
  "hidden",
  "group",
]);

function everyFieldIncludingGroupChildren(fields: AnyFieldConfig[]): AnyFieldConfig[] {
  return fields.flatMap((f) =>
    f.type === "group"
      ? [f, ...everyFieldIncludingGroupChildren((f as { fields: AnyFieldConfig[] }).fields)]
      : [f],
  );
}

describe("buildFormConfig", () => {
  it("produces a config the engine accepts", () => {
    expect(() => validateFormConfig(config)).not.toThrow();
  });

  it("uses only field types this install ships a component for", () => {
    for (const f of everyFieldIncludingGroupChildren(config.fields as AnyFieldConfig[])) {
      expect(INSTALLED_TYPES.has(f.type), `${f.name} is a ${f.type}`).toBe(true);
    }
  });

  it("includes every jurisdiction's fields in one config", () => {
    const names = config.fields.map((f) => f.name);
    expect(names).toContain("de_steuerId");
    expect(names).toContain("us_tin");
    expect(names).toContain("ae_emiratesId");
    expect(names).toContain("default_tin");
  });

  it("guards each jurisdiction field on country and account type", () => {
    expect(field("de_steuerId").visibleWhen).toEqual([
      { field: "country", equals: "DE" },
      { field: "accountType", equals: "individual" },
    ]);
    expect(field("us_ein").visibleWhen).toEqual([
      { field: "country", equals: "US" },
      { field: "accountType", equals: "corporate" },
    ]);
  });

  it("guards the fallback on every configured country being unselected", () => {
    expect(field("default_tin").visibleWhen).toEqual([
      { field: "country", notEquals: "DE" },
      { field: "country", notEquals: "US" },
      { field: "country", notEquals: "AE" },
      { field: "accountType", equals: "individual" },
    ]);
  });

  it("badges every jurisdiction-conditional field, and says required only when it is", () => {
    expect(field("ae_emiratesId").badge).toContain("United Arab Emirates");
    expect(field("ae_emiratesId").badge).toContain("Required");
    expect(field("us_treatyStatement").required).toBeUndefined();
    expect(field("us_treatyStatement").badge).not.toContain("Required");
  });

  it("leaves a labelless field unbadged — a badge annotates a label", () => {
    expect(field("ae_noNumberNote").label).toBeUndefined();
    expect(field("ae_noNumberNote").badge).toBeUndefined();
  });

  it("guards the shared branch fields on account type without badging them", () => {
    expect(field("fullName").visibleWhen).toEqual([{ field: "accountType", equals: "individual" }]);
    expect(field("companyName").visibleWhen).toEqual([{ field: "accountType", equals: "corporate" }]);
    expect(field("fullName").badge).toBeUndefined();
  });

  it("leaves the unbranched fields unguarded", () => {
    expect(field("accountType").visibleWhen).toBeUndefined();
    expect(field("country").visibleWhen).toBeUndefined();
  });

  it("renders the fallback notice as a field, guarded like the fallback it explains", () => {
    const notice = config.fields.find((f) => f.type === "static" && typeof (f as { content?: string }).content === "string" && (f as { content: string }).content.includes("standard self-declaration"));
    expect(notice).toBeDefined();
    expect(notice!.visibleWhen).toEqual([
      { field: "country", notEquals: "DE" },
      { field: "country", notEquals: "US" },
      { field: "country", notEquals: "AE" },
    ]);
  });

  it("has a stable hash across calls, so drafts survive", () => {
    expect(draftConfigHash(buildFormConfig({ now: REFERENCE }).fields)).toBe(
      draftConfigHash(buildFormConfig({ now: REFERENCE }).fields),
    );
  });

  it("has a stable hash for the same day regardless of the time of day", () => {
    expect(draftConfigHash(buildFormConfig({ now: new Date("2026-07-27T23:59:00Z") }).fields)).toBe(
      draftConfigHash(buildFormConfig({ now: new Date("2026-07-27T00:00:01Z") }).fields),
    );
  });
});

describe("what the visitor sees", () => {
  it("changes which fields are visible when the country changes", () => {
    const de = visibleNames({ accountType: "individual", country: "DE" });
    const us = visibleNames({ accountType: "individual", country: "US" });

    expect(de).toContain("de_steuerId");
    expect(de).toContain("de_churchTax");
    expect(de).not.toContain("us_tin");

    expect(us).toContain("us_tin");
    expect(us).toContain("us_state");
    expect(us).not.toContain("de_steuerId");
  });

  it("asks the UAE branch for no taxpayer number, and says so", () => {
    const ae = visibleNames({ accountType: "individual", country: "AE" });
    expect(ae).toContain("ae_emiratesId");
    expect(ae).toContain("ae_noNumberNote");
    expect(ae.filter((name) => name.endsWith("_tin"))).toEqual([]);
  });

  it("falls back for an unconfigured country", () => {
    const fr = visibleNames({ accountType: "individual", country: "FR" });
    expect(fr).toContain("default_tin");
    expect(fr).not.toContain("de_steuerId");
  });

  it("falls back before a country has been chosen, matching resolveJurisdiction(undefined)", () => {
    expect(visibleNames({ accountType: "individual" })).toContain("default_tin");
  });

  it("swaps the whole personal-details step when the account type changes", () => {
    const individual = visibleNames({ accountType: "individual", country: "DE" });
    const corporate = visibleNames({ accountType: "corporate", country: "DE" });

    expect(individual).toContain("dateOfBirth");
    expect(individual).not.toContain("beneficialOwners");
    expect(corporate).toContain("beneficialOwners");
    expect(corporate).not.toContain("dateOfBirth");
    expect(corporate).toContain("de_ustIdNr");
  });
});

describe("the payload", () => {
  it("strips fields for the unselected country", () => {
    const values = {
      country: "DE",
      accountType: "individual",
      de_steuerId: "12345678901",
      us_tin: "111223333",
    };
    expect(Object.keys(stripInvisibleValues(config.fields, values))).not.toContain("us_tin");
    expect(Object.keys(stripInvisibleValues(config.fields, values))).toContain("de_steuerId");
  });

  it("strips the other account type's fields", () => {
    const values = { accountType: "individual", country: "DE", fullName: "A", companyName: "B" };
    expect(Object.keys(stripInvisibleValues(config.fields, values))).not.toContain("companyName");
  });
});

describe("the schema the engine builds from this config", () => {
  const values: FormValues = {
    accountType: "individual",
    country: "DE",
    dateOfBirth: "1988-04-12",
  };

  it("requires the German fields when Germany is selected", () => {
    const schema = buildResolverSchema(config, defaultMessages, undefined, values);
    const result = schema.safeParse(values);
    const paths = result.success ? [] : result.error.issues.map((issue) => issue.path.join("."));
    expect(paths).toContain("de_steuerId");
    expect(paths).not.toContain("us_tin");
  });

  it("rejects a date of birth under eighteen with the rule as its message", () => {
    const schema = buildResolverSchema(config, defaultMessages, undefined, values);
    const result = schema.safeParse({ ...values, dateOfBirth: "2020-01-01" });
    const message = result.success
      ? undefined
      : result.error.issues.find((issue) => issue.path.join(".") === "dateOfBirth")?.message;
    expect(message).toMatch(/18 or older/);
  });

  it("accepts a date of birth exactly on the cutoff", () => {
    const schema = buildResolverSchema(config, defaultMessages, undefined, values);
    const result = schema.safeParse({ ...values, dateOfBirth: "2008-07-27" });
    const dobIssue = result.success
      ? undefined
      : result.error.issues.find((issue) => issue.path.join(".") === "dateOfBirth");
    expect(dobIssue).toBeUndefined();
  });
});

describe("steps", () => {
  it("has five steps, ending in a review step", () => {
    expect(config.steps).toHaveLength(STEP_SLUGS.length);
    expect(config.steps).toHaveLength(5);
    expect(config.steps!.at(-1)!.review).toBe(true);
    expect(config.steps!.at(-1)!.fieldNames).toBeUndefined();
  });

  it("keeps the step count fixed — no step is added or removed by any answer", () => {
    for (const step of config.steps!) {
      expect(step.visibleWhen).toBeUndefined();
    }
  });

  it("maps slugs to indices both ways", () => {
    STEP_SLUGS.forEach((slug, index) => {
      expect(stepIndexForSlug(slug)).toBe(index);
      expect(slugForStepIndex(index)).toBe(slug);
    });
    expect(stepIndexForSlug("not-a-step")).toBeUndefined();
    expect(slugForStepIndex(99)).toBeUndefined();
  });

  it("puts every jurisdiction's tax fields on the tax step and its documents on the documents step", () => {
    const tax = config.steps![stepIndexForSlug("tax-residency")!].fieldNames ?? [];
    const documents = config.steps![stepIndexForSlug("documents")!].fieldNames ?? [];

    expect(tax).toContain("de_steuerId");
    expect(tax).toContain("ae_emiratesId");
    expect(documents).toContain("de_meldebescheinigung");
    expect(documents).not.toContain("de_steuerId");
  });

  it("puts the country field on the same step as the fields it governs, so no answer is invisible when it takes effect", () => {
    const tax = config.steps![stepIndexForSlug("tax-residency")!].fieldNames ?? [];
    expect(tax[0]).toBe("country");
  });

  it("assigns every non-exempt field to exactly one step", () => {
    const stepped = config.steps!.flatMap((step) => step.fieldNames ?? []);
    expect(new Set(stepped).size).toBe(stepped.length);

    const exempt = new Set(["hidden", "submit"]);
    for (const f of config.fields) {
      if (exempt.has(f.type)) continue;
      expect(stepped, `${f.name} is on no step`).toContain(f.name);
    }
  });

  it("has a submit button, which the engine renders outside the steps", () => {
    const submit = config.fields.find((f) => f.type === "submit");
    expect(submit).toBeDefined();
    expect(config.steps!.flatMap((s) => s.fieldNames ?? [])).not.toContain(submit!.name);
  });
});
