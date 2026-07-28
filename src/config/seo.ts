import type { Metadata, MetadataRoute } from "next";
import { STEP_SLUGS, STEP_TITLES, stepIndexForSlug, type StepSlug } from "./steps";
import { stepPath } from "./routes";

/**
 * Everything a crawler is told about this site, in one place, derived from the
 * route table rather than written out beside it.
 *
 * ## Why this file exists at all
 *
 * `src/config/routes.ts` already builds every path from `STEP_SLUGS`, so the
 * landing page and the router cannot disagree about where step one is. A
 * hand-listed sitemap or a title typed into each page file would reintroduce
 * exactly the drift the rest of the repo works to prevent — and a sitemap that
 * advertises a URL the router no longer serves is worse than no sitemap, because
 * it is a promise to a machine that will keep coming back to check.
 *
 * So: one module, one route table, and `seo.test.ts` failing the moment the two
 * fall out of step.
 *
 * ## Why this site is indexed, having been deliberately hidden
 *
 * Until 2026-07-28 the root layout carried `robots: { index: false, follow:
 * false }` with a rationale that is still worth reading: this is a convincing
 * account-opening form for a brokerage that does not exist, asking for a date of
 * birth, a taxpayer number and a photograph of a passport. Ranking for "open a
 * brokerage account" would put it in front of people who arrived looking for the
 * real thing, and the demo banner is then the only difference between this and a
 * phishing page — a difference a hurried visitor may not register.
 *
 * That concern was not wrong and it has not been dismissed. It has been
 * engineered around, in three places, all of them in this file:
 *
 *   1. `TITLE_TEMPLATE` names the AUTHOR, never the fictional broker. A search
 *      result reads "Step 3: Tax residency — KYC demo by Youssef Nessafe". The
 *      brand survives inside the product, where the banner is; it does not
 *      survive into the one line a stranger sees before they click.
 *
 *   2. Every description leads with the fact that this is a demonstration and
 *      closes with `DEMO_DISCLAIMER`. The snippet under the title says nothing
 *      is sent anywhere before it says anything else.
 *
 *   3. `landingStructuredData()` types the page as `SoftwareSourceCode` authored
 *      by a `Person` — deliberately not `Organization`, and emphatically not
 *      `FinancialService`. JSON-LD is the one place a crawler asks "what kind of
 *      thing is this", and the answer it gets cannot be mistaken for a broker.
 *
 * The non-dismissible banner is unchanged. Nothing about using the form changed.
 */

/**
 * The canonical origin. No trailing slash: `absoluteUrl` composes it.
 *
 * Hardcoded rather than read from an environment variable on purpose. A
 * canonical URL that varies with the environment is a canonical URL that can be
 * wrong in production without anything failing — and the failure mode is silent
 * and slow, which is the worst kind. There is one home for this site and it is
 * written here; changing it is a code change with a test behind it.
 */
export const SITE_URL = "https://kyc-six.vercel.app";

export const AUTHOR_NAME = "Youssef Nessafe";

/** What the site is called in a browser tab and an OG card, as opposed to what the fictional broker is called. */
export const SITE_NAME = `KYC demo by ${AUTHOR_NAME}`;

/**
 * Applied by the root layout to every title a child segment sets. The step
 * pages therefore only ever name themselves — "Step 3: Tax residency" — and the
 * attribution is added here, once.
 */
export const TITLE_TEMPLATE = `%s — ${SITE_NAME}`;

/** `/` does not go through the template; it is the whole sentence already. */
export const LANDING_TITLE = `Jurisdiction-aware KYC onboarding — ${AUTHOR_NAME}`;

/**
 * Appended to every description, verbatim, and asserted by the tests.
 *
 * It is one sentence because a search snippet is truncated somewhere around 155
 * characters and this has to survive the cut.
 */
export const DEMO_DISCLAIMER = "Nothing entered is sent anywhere, uploaded, or stored on a server.";

export const SITE_DESCRIPTION =
  `A portfolio demonstration by ${AUTHOR_NAME}: a jurisdiction-aware KYC ` +
  `onboarding flow whose questions are held as configuration, not written into ` +
  `components. ${DEMO_DISCLAIMER}`;

/** Alt text for the generated Open Graph card. */
export const OG_IMAGE_ALT = `${LANDING_TITLE} — portfolio demonstration`;

/**
 * An absolute URL for a root-relative path.
 *
 * Sitemaps, canonical links and JSON-LD all require fully-qualified URLs, and
 * `metadataBase` only covers the fields Next composes itself — it does not reach
 * into a JSON-LD blob or a sitemap entry. Rather than remember which is which,
 * everything in this file goes through here.
 *
 * The trailing slash is stripped, and that is not cosmetic. `new URL("/", base)`
 * produces `https://host/`, but Next renders the canonical link for `/` as
 * `https://host` — this project runs with the default `trailingSlash: false`.
 * Left alone, the sitemap would advertise one spelling of the home page while
 * the page itself declared the other canonical, which is precisely the
 * duplicate-URL signal a canonical link exists to remove. Caught by
 * `e2e/seo.spec.ts` comparing the rendered `<head>` against this function; kept
 * honest by the unit test below it.
 */
export function absoluteUrl(path: string): string {
  const url = new URL(path, SITE_URL).toString();
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

/**
 * Every URL a crawler should know about, in crawl-priority order.
 *
 * Derived, not listed. `/apply/[step]` prerenders exactly `STEP_SLUGS` with
 * `dynamicParams = false`, so this is the complete set by construction: a slug
 * that is not in the step list is a 404, and a step that exists cannot be
 * missing from here.
 */
export const INDEXABLE_ROUTES: readonly string[] = ["/", ...STEP_SLUGS.map(stepPath)];

/**
 * One written description per step.
 *
 * Written, not generated. A templated "Step 3 of 5 of a KYC form" tells a
 * crawler nothing a human would search for and tells a human nothing worth
 * clicking. Each of these names the thing that step actually demonstrates — the
 * branching, the masking, the upload behaviour — because that is what the page
 * is a work sample of.
 *
 * `DEMO_DISCLAIMER` is appended by `descriptionForStep`, not repeated here, so
 * it cannot be forgotten on a step added later.
 */
const STEP_DESCRIPTION_BODIES: Record<StepSlug, string> = {
  "account-type":
    "Step 1 of a portfolio demo. Choosing individual or corporate reshapes every later step, through per-field visibility rules rather than a second set of screens.",
  "personal-details":
    "Step 2 of a portfolio demo. Names, dates and phone numbers, with validation and error messaging wired to each control for screen readers.",
  "tax-residency":
    "Step 3 of a portfolio demo. The tax questions change with the country above them: a German applicant is asked for a masked Steuer-Identifikationsnummer and church tax, an Emirati is told there is no personal taxpayer number to give.",
  documents:
    "Step 4 of a portfolio demo. Document upload with drag-and-drop, type and size rules, and simulated progress — the file never leaves the browser.",
  review:
    "Step 5 of a portfolio demo. Every answer given, read back from the same configuration that asked for it, with a way back to the step that owns each one.",
};

/** The full description for a step: what it demonstrates, then the disclaimer. */
export function descriptionForStep(slug: StepSlug): string {
  return `${STEP_DESCRIPTION_BODIES[slug]} ${DEMO_DISCLAIMER}`;
}

/** "Step 3: Tax residency". The number comes from the route table, not from a second list. */
export function titleForStep(slug: StepSlug): string {
  return `Step ${(stepIndexForSlug(slug) ?? 0) + 1}: ${STEP_TITLES[slug]}`;
}

/**
 * The metadata block for one step route.
 *
 * Returns an empty object for a slug that is not a step rather than throwing.
 * `generateMetadata` runs BEFORE the page component decides to `notFound()`, so
 * a throw here would turn a clean 404 into a 500 — the caller has the 404 well
 * in hand and this must not get in its way.
 */
export function metadataForStep(slug: string): Metadata {
  if (stepIndexForSlug(slug) === undefined) return {};

  const step = slug as StepSlug;
  const title = titleForStep(step);
  const description = descriptionForStep(step);
  const url = absoluteUrl(stepPath(step));

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: `${title} — ${SITE_NAME}`,
      description,
      url,
      siteName: SITE_NAME,
      type: "website",
    },
  };
}

/** The sitemap, one entry per indexable route. `lastModified` is supplied by the caller so this stays pure. */
export function sitemapEntries(lastModified: Date): MetadataRoute.Sitemap {
  return INDEXABLE_ROUTES.map((path) => ({
    url: absoluteUrl(path),
    lastModified,
    changeFrequency: "monthly" as const,
    // The landing page is the one worth ranking; the steps are context for it.
    priority: path === "/" ? 1 : 0.6,
  }));
}

/**
 * The robots policy for a given `VERCEL_ENV`.
 *
 * Split out from `app/robots.ts` so both branches can be tested without
 * mutating `process.env` around an import.
 *
 * **Everything that is not a production deployment is disallowed entirely.**
 * Vercel gives every preview deployment a public URL serving content identical
 * to production; indexed, they compete with the canonical site for the same
 * queries and split whatever authority it has. Local development is treated the
 * same way because `VERCEL_ENV` is simply absent there, and defaulting an
 * unknown environment to "crawlable" is the wrong way round.
 */
export function robotsPolicy(vercelEnv: string | undefined): MetadataRoute.Robots {
  if (vercelEnv !== "production") {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: absoluteUrl("/sitemap.xml"),
    host: SITE_URL,
  };
}

/**
 * JSON-LD for the landing page.
 *
 * `SoftwareSourceCode`, authored by a `Person`. The type is the point, and it is
 * the third of the three measures described at the top of this file: whatever a
 * crawler infers from a form that asks for a passport photograph, the structured
 * data says plainly that this is a code sample written by someone. `Organization`
 * would invite exactly the confusion the old noindex was guarding against, and
 * `FinancialService` would be a lie told to a machine that believes it.
 */
export function landingStructuredData() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareSourceCode",
    name: LANDING_TITLE,
    headline: LANDING_TITLE,
    description: SITE_DESCRIPTION,
    url: absoluteUrl("/"),
    image: absoluteUrl("/opengraph-image"),
    inLanguage: "en",
    isAccessibleForFree: true,
    programmingLanguage: "TypeScript",
    runtimePlatform: "Next.js",
    author: { "@type": "Person", name: AUTHOR_NAME },
    creator: { "@type": "Person", name: AUTHOR_NAME },
    about:
      "A configuration-driven KYC onboarding flow: jurisdiction-specific field sets, an enforced engine boundary, and accessibility held to WCAG 2.2 AA by tests.",
    keywords: [
      "KYC onboarding",
      "jurisdiction-aware form",
      "config-driven form engine",
      "Next.js App Router",
      "React 19",
      "accessible forms",
      "frontend portfolio",
    ],
  };
}
