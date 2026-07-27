import { describe, expect, it } from "vitest";
import type { FormValues } from "@/form-builder/core/types";
import { buildFormConfig } from "./buildFormConfig";
import { furthestAvailableStep } from "./progress";
import { sampleValues, sampleValuesForStep } from "./sampleData";
import { STEP_SLUGS, stepIndexForSlug } from "./steps";

const REFERENCE = new Date("2026-07-27T00:00:00Z");
const config = buildFormConfig({ now: REFERENCE });

const ACCOUNT_STEP = stepIndexForSlug("account-type")!;
const DETAILS_STEP = stepIndexForSlug("personal-details")!;
const TAX_STEP = stepIndexForSlug("tax-residency")!;
const DOCUMENTS_STEP = stepIndexForSlug("documents")!;
const REVIEW_STEP = stepIndexForSlug("review")!;

/** The answers a sample-filled run has by the time it reaches `upTo`, exclusive. */
function answersThrough(upTo: number, country: string, accountType: string): FormValues {
  let values: FormValues = {};
  for (let index = 0; index < upTo; index += 1) {
    values = { ...values, ...sampleValuesForStep(config, index, { country, accountType }) };
  }
  return values;
}

describe("furthestAvailableStep", () => {
  it("holds a visitor with no answers on the first step", () => {
    expect(furthestAvailableStep(config, {})).toBe(ACCOUNT_STEP);
  });

  it("opens each step in turn as the one before it is answered", () => {
    expect(furthestAvailableStep(config, answersThrough(1, "DE", "individual"))).toBe(DETAILS_STEP);
    expect(furthestAvailableStep(config, answersThrough(2, "DE", "individual"))).toBe(TAX_STEP);
    expect(furthestAvailableStep(config, answersThrough(3, "DE", "individual"))).toBe(
      DOCUMENTS_STEP,
    );
  });

  /**
   * The documents step is the only one a returning visitor cannot have
   * pre-satisfied: files are deliberately never written to the draft, so a
   * resumed application always stops here however complete it was before.
   */
  it("stops at the documents step while no files are attached", () => {
    const everything = sampleValues({ country: "DE", accountType: "individual" });
    expect(furthestAvailableStep(config, everything)).toBe(DOCUMENTS_STEP);
  });

  it("opens the review step once every earlier step validates", () => {
    const everything = sampleValues({ country: "DE", accountType: "individual" });
    const file = () => new File(["x"], "passport.pdf", { type: "application/pdf" });
    const files = Object.fromEntries(
      (config.steps?.[DOCUMENTS_STEP]?.fieldNames ?? []).map((name) => {
        const field = config.fields.find((candidate) => candidate.name === name);
        const multiple = field?.type === "file" && field.multiple;
        return [name, multiple ? [file()] : file()];
      }),
    );
    expect(furthestAvailableStep(config, { ...everything, ...files })).toBe(REVIEW_STEP);
  });

  /**
   * A German applicant must not be held on the tax step by the US taxpayer
   * number, which they are never shown. This is the guard agreeing with the
   * engine's own visibility rules rather than re-deriving them.
   */
  it("ignores fields hidden by the jurisdiction the visitor chose", () => {
    for (const country of ["DE", "US", "AE", "FR"]) {
      for (const accountType of ["individual", "corporate"]) {
        expect(furthestAvailableStep(config, answersThrough(3, country, accountType))).toBe(
          DOCUMENTS_STEP,
        );
      }
    }
  });

  /**
   * Switching account type after answering re-opens the step whose fields the
   * switch emptied — the guard is a function of the current answers, not a
   * high-water mark that would let a corporate applicant walk past an unanswered
   * company name because an individual once completed the same step.
   */
  it("closes a step again when a later answer invalidates it", () => {
    const individual = answersThrough(3, "DE", "individual");
    expect(furthestAvailableStep(config, { ...individual, accountType: "corporate" })).toBe(
      DETAILS_STEP,
    );
  });

  it("treats a form with no steps as a single step", () => {
    expect(furthestAvailableStep({ id: "x", fields: [] }, {})).toBe(0);
  });

  it("agrees with the step list about how many steps there are", () => {
    expect(config.steps).toHaveLength(STEP_SLUGS.length);
  });
});
