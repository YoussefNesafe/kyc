import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import {
  AUTHOR_NAME,
  DEMO_DISCLAIMER,
  INDEXABLE_ROUTES,
  LANDING_TITLE,
  SITE_URL,
  TITLE_TEMPLATE,
  absoluteUrl,
  descriptionForStep,
  landingStructuredData,
  metadataForStep,
  robotsPolicy,
  titleForStep,
} from "./seo";
import { stepPath } from "./routes";
import { STEP_SLUGS } from "./steps";

/**
 * The drift guard.
 *
 * A sitemap is a promise made to a machine that will keep coming back to check
 * it, so the failure mode of getting it wrong is not a broken page — it is a
 * crawler repeatedly fetching a URL that 404s, and a page that exists never
 * being offered. Nothing about that shows up in a browser, which is exactly why
 * it is asserted here rather than trusted.
 *
 * The `Meridian` assertions further down are not stylistic. Indexing this site
 * is only defensible because a search result names the author rather than a
 * brokerage that does not exist; if that ever stops being true, the reasoning
 * written into `seo.ts` has quietly stopped applying and this should fail.
 */

const EXPECTED_ROUTES = ["/", ...STEP_SLUGS.map(stepPath)];

/** The brokerage the demo is dressed as. It belongs inside the product, not in a search result. */
const DEMO_BRAND = /meridian/i;

describe("INDEXABLE_ROUTES", () => {
  it("is the landing page plus every step, in order", () => {
    expect([...INDEXABLE_ROUTES]).toEqual(EXPECTED_ROUTES);
  });

  it("has no duplicates", () => {
    expect(new Set(INDEXABLE_ROUTES).size).toBe(INDEXABLE_ROUTES.length);
  });
});

describe("sitemap", () => {
  const entries = sitemap();

  it("covers exactly the indexable routes, in both directions", () => {
    const urls = entries.map((entry) => entry.url).sort();
    const expected = EXPECTED_ROUTES.map(absoluteUrl).sort();
    expect(urls).toEqual(expected);
  });

  it("emits absolute URLs on the canonical origin", () => {
    for (const entry of entries) {
      expect(entry.url.startsWith(SITE_URL)).toBe(true);
      expect(() => new URL(entry.url)).not.toThrow();
    }
  });

  it("spells the home page the way Next spells its canonical link", () => {
    // `new URL("/", base)` gives a trailing slash and Next's canonical does not.
    // Advertising one spelling in the sitemap while the page declares the other
    // is the duplicate-URL problem a canonical exists to solve.
    expect(absoluteUrl("/")).toBe(SITE_URL);
    for (const entry of entries) expect(entry.url.endsWith("/")).toBe(false);
  });

  it("ranks the landing page above the steps", () => {
    const landing = entries.find((entry) => entry.url === absoluteUrl("/"));
    const steps = entries.filter((entry) => entry.url !== absoluteUrl("/"));
    expect(landing?.priority).toBe(1);
    for (const step of steps) expect(step.priority).toBeLessThan(1);
  });
});

describe("step metadata", () => {
  it("gives every step a unique, numbered title", () => {
    const titles = STEP_SLUGS.map(titleForStep);
    expect(new Set(titles).size).toBe(titles.length);
    titles.forEach((title, index) => {
      expect(title).toContain(`Step ${index + 1}:`);
      expect(title.trim()).not.toBe("");
    });
  });

  it("gives every step a unique description that carries the disclaimer", () => {
    const descriptions = STEP_SLUGS.map(descriptionForStep);
    expect(new Set(descriptions).size).toBe(descriptions.length);
    for (const description of descriptions) {
      expect(description).toContain(DEMO_DISCLAIMER);
    }
  });

  it("canonicalises each step to its own absolute URL", () => {
    for (const slug of STEP_SLUGS) {
      const metadata = metadataForStep(slug);
      expect(metadata.alternates?.canonical).toBe(absoluteUrl(stepPath(slug)));
    }
  });

  it("returns an empty block for a slug that is not a step, without throwing", () => {
    // generateMetadata runs before the page can call notFound(), so this path
    // has to be survivable or a 404 becomes a 500.
    expect(() => metadataForStep("not-a-step")).not.toThrow();
    expect(metadataForStep("not-a-step")).toEqual({});
    expect(metadataForStep("")).toEqual({});
  });
});

describe("what a search result says", () => {
  it("attributes every title to the author, not to the fictional broker", () => {
    expect(TITLE_TEMPLATE).toContain("%s");
    expect(TITLE_TEMPLATE).toContain(AUTHOR_NAME);
    expect(TITLE_TEMPLATE).not.toMatch(DEMO_BRAND);
    expect(LANDING_TITLE).toContain(AUTHOR_NAME);
    expect(LANDING_TITLE).not.toMatch(DEMO_BRAND);

    for (const slug of STEP_SLUGS) {
      expect(titleForStep(slug)).not.toMatch(DEMO_BRAND);
      expect(descriptionForStep(slug)).not.toMatch(DEMO_BRAND);
    }
  });

  it("types the landing page as source code by a person", () => {
    const data = landingStructuredData();
    expect(data["@type"]).toBe("SoftwareSourceCode");
    expect(data.author["@type"]).toBe("Person");
    expect(data.author.name).toBe(AUTHOR_NAME);
    expect(data.url).toBe(absoluteUrl("/"));
  });
});

describe("robotsPolicy", () => {
  it("opens the site up on a production deployment", () => {
    const policy = robotsPolicy("production");
    expect(policy.rules).toMatchObject({ userAgent: "*", allow: "/" });
    expect(policy.sitemap).toBe(absoluteUrl("/sitemap.xml"));
  });

  it("closes everything that is not production, including an absent env", () => {
    // Preview deployments serve identical content on a public URL; indexed, they
    // compete with the canonical site for its own queries.
    for (const env of ["preview", "development", undefined, ""]) {
      const policy = robotsPolicy(env);
      expect(policy.rules).toMatchObject({ userAgent: "*", disallow: "/" });
      expect(policy.sitemap).toBeUndefined();
    }
  });
});
