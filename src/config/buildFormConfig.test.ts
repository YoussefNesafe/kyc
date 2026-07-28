import { describe, expect, it } from "vitest";
import { getCountries } from "libphonenumber-js";
import { draftConfigHash } from "@/form-builder/core/autosave";
import { getVisibleFields, stripInvisibleValues } from "@/form-builder/core/conditions";
import { defaultMessages } from "@/form-builder/core/messages";
import { buildResolverSchema } from "@/form-builder/core/validation";
import { validateFormConfig } from "@/form-builder/core/schema";
import type { AnyFieldConfig, Condition, FormValues } from "@/form-builder/core/types";
import { buildFormConfig } from "./buildFormConfig";
import { corporateFields } from "./fields/corporate";
import { individualFields } from "./fields/individual";
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

  it("guards the fallback on membership of every country the registry does not claim", () => {
    const guard = field("default_tin").visibleWhen as Condition[];
    expect(guard).toHaveLength(2);
    expect(guard[1]).toEqual({ field: "accountType", equals: "individual" });

    const countries = guard[0].in as string[];
    expect(guard[0].field).toBe("country");
    expect(countries).toContain("FR");
    expect(countries).toContain("JP");
    expect(countries).not.toContain("DE");
    expect(countries).not.toContain("US");
    expect(countries).not.toContain("AE");
  });

  it("draws the fallback's country list from the same source the country field validates against", () => {
    const guard = field("default_tin").visibleWhen as Condition[];
    const countries = guard[0].in as string[];
    const expected = (getCountries() as string[]).filter((code) => !["DE", "US", "AE"].includes(code));
    expect([...countries].sort()).toEqual([...expected].sort());
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
    const notice = config.fields.find(
      (f) =>
        f.type === "static" &&
        typeof (f as { content?: string }).content === "string" &&
        (f as { content: string }).content.includes("standard self-declaration"),
    );
    expect(notice).toBeDefined();

    const guard = notice!.visibleWhen as Condition[];
    expect(guard).toHaveLength(1);
    expect(guard[0].field).toBe("country");
    expect(guard[0].in).toContain("FR");
    expect(guard[0].in).not.toContain("DE");
  });

  it("declares no guard of its own in the branch files either — the builder owns that", () => {
    const branch = [individualFields(REFERENCE), corporateFields(REFERENCE)];
    for (const { personalFields, documentFields } of branch) {
      for (const f of [...personalFields, ...documentFields]) {
        expect(f.visibleWhen, `${f.name} declares a visibleWhen the builder would overwrite`).toBeUndefined();
        expect(f.badge, `${f.name} declares a badge`).toBeUndefined();
      }
    }
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

  it("asks nothing jurisdictional before a country has been chosen", () => {
    const nothingChosen = visibleNames({ accountType: "individual" });
    expect(nothingChosen).toContain("country");
    expect(nothingChosen).not.toContain("default_tin");
    expect(nothingChosen).not.toContain("de_steuerId");
  });

  it("does not demand fields that vanish the moment a country is picked", () => {
    // Pressing Continue on an untouched tax step must name the country field
    // and nothing else — an error summary listing three fallback fields that
    // disappear on the next click is worse than no summary.
    const schema = buildResolverSchema(config, defaultMessages, undefined, { accountType: "individual" });
    const result = schema.safeParse({ accountType: "individual" });
    const taxStepNames = new Set(config.steps![stepIndexForSlug("tax-residency")!].fieldNames ?? []);
    const complainedAbout = result.success
      ? []
      : [...new Set(result.error.issues.map((issue) => String(issue.path[0])))].filter((name) =>
          taxStepNames.has(name),
        );
    expect(complainedAbout).toEqual(["country"]);
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

describe("input purpose (WCAG 2.2 SC 1.3.5)", () => {
  // The engine types `autocomplete` as a plain string — the attribute is a
  // grammar, not a fixed vocabulary, so a union would reject "work tel" and
  // "section-* name". That leaves the token itself uncheckable by tsc, and a
  // near-miss ("postcode", "city") is the failure mode: it reads as conformant,
  // costs nothing at build time, and silently fails the criterion. So the
  // tokens are pinned here, spelled out, against
  // https://www.w3.org/TR/WCAG22/#input-purposes.
  const EXPECTED: Record<string, string> = {
    // Individual — the branch 1.3.5 is really about.
    fullName: "name",
    dateOfBirth: "bday",
    email: "email",
    phone: "mobile tel",
    residentialAddress: "street-address",
    postalCode: "postal-code",
    city: "address-level2",
    // Corporate — only the fields describing the person filling the form.
    companyName: "organization",
    contactName: "name",
    contactEmail: "work email",
    contactPhone: "work tel",
  };

  it.each(Object.entries(EXPECTED))("%s declares autocomplete=%s", (name, token) => {
    expect((field(name) as { autocomplete?: string }).autocomplete).toBe(token);
  });

  it("claims no purpose for data that is not about the applicant", () => {
    // A wrong token is worse than none: it points a browser at the applicant's
    // own details for a field that asks about someone or something else.
    for (const name of ["nationality", "registeredAddress", "companyNumber", "incorporationDate"]) {
      expect((field(name) as { autocomplete?: string }).autocomplete, name).toBeUndefined();
    }
    const owners = field("beneficialOwners") as { fields?: AnyFieldConfig[] };
    for (const row of owners.fields ?? []) {
      expect((row as { autocomplete?: string }).autocomplete, `beneficialOwners.${row.name}`).toBeUndefined();
    }
  });

  it("leaves no field on the personal-details step silently unpurposed", () => {
    // The regression guard. This step is where the criterion was failing, and
    // where a field added later would fail it again without anyone noticing —
    // so every field on it either declares a token or is named here as having
    // no purpose token to declare.
    const NO_TOKEN_EXISTS = new Set(["nationality", "companyNumber", "incorporationDate", "registeredAddress"]);
    const personal = config.steps![stepIndexForSlug("personal-details")!].fieldNames ?? [];
    expect(personal.length).toBeGreaterThan(0);

    for (const name of personal) {
      const f = field(name) as { type: string; autocomplete?: string };
      if (f.type === "static" || f.type === "group") continue;
      const accounted = f.autocomplete !== undefined || NO_TOKEN_EXISTS.has(name);
      expect(accounted, `${name} has no autocomplete and is not listed as having no token`).toBe(true);
    }
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
