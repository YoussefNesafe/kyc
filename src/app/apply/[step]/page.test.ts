import { describe, expect, it, vi } from "vitest";
import { metadataForStep } from "@/config/seo";
import { STEP_SLUGS } from "@/config/steps";

const notFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});

vi.mock("next/navigation", () => ({ notFound }));

const { default: ApplicationStepPage, dynamicParams, generateMetadata, generateStaticParams } =
  await import("./page");

/**
 * The route's contract with the rest of the app: five prerendered URLs, a title
 * per step, and a real 404 for anything else. The page renders nothing on
 * purpose — the form lives in the layout — so "returns null" is an assertion
 * about the design, not a placeholder.
 */
describe("/apply/[step]", () => {
  it("prerenders exactly the configured steps", () => {
    expect(generateStaticParams()).toEqual(STEP_SLUGS.map((step) => ({ step })));
  });

  it("refuses to serve a slug outside that list", () => {
    expect(dynamicParams).toBe(false);
  });

  it("serves the step's own metadata", async () => {
    // Compared against `metadataForStep` rather than against a literal: what
    // that block should CONTAIN — the numbered title, the disclaimer, the
    // canonical — is asserted once in `src/config/seo.test.ts`. This route's
    // contract is only that it delegates there and awaits its params, and a
    // second copy of the expected strings here would be one more place to
    // forget when a step is renamed.
    expect(await generateMetadata({ params: Promise.resolve({ step: "tax-residency" }) })).toEqual(
      metadataForStep("tax-residency"),
    );
  });

  it("adds no title it cannot name", async () => {
    expect(await generateMetadata({ params: Promise.resolve({ step: "nonsense" }) })).toEqual({});
  });

  it("renders nothing for a real step — the layout holds the form", async () => {
    await expect(
      ApplicationStepPage({ params: Promise.resolve({ step: "account-type" }) }),
    ).resolves.toBeNull();
    expect(notFound).not.toHaveBeenCalled();
  });

  it("404s a slug that is not a step", async () => {
    await expect(
      ApplicationStepPage({ params: Promise.resolve({ step: "personal_details" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
  });
});
