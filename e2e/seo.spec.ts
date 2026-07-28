import { expect, test } from "@playwright/test";
import { INDEXABLE_ROUTES, SITE_URL, absoluteUrl } from "../src/config/seo";

/**
 * What a crawler actually receives.
 *
 * `src/config/seo.test.ts` asserts the values the metadata modules produce. It
 * cannot assert that Next rendered them into the served document, or that the
 * two generated routes resolve at all — a `robots.ts` that throws at build time
 * and a `robots.ts` that was never written look identical from a unit test. So
 * this spec fetches the built output.
 *
 * Note what `/robots.txt` is expected to say here: **Disallow**. Playwright
 * serves `yarn build && yarn start` on localhost, where `VERCEL_ENV` is absent,
 * and everything that is not a production deployment is closed to crawlers on
 * purpose — otherwise every Vercel preview URL would compete with the canonical
 * site for its own queries. This spec passing is that guard working, not a
 * mistake in it.
 */
test.describe("crawler-facing output", () => {
  test("closes robots.txt everywhere that is not a production deployment", async ({ request }) => {
    const response = await request.get("/robots.txt");
    expect(response.status()).toBe(200);

    const body = await response.text();
    expect(body).toContain("User-Agent: *");
    expect(body).toContain("Disallow: /");
    expect(body).not.toContain("Allow: /");
  });

  test("serves a sitemap covering every indexable route", async ({ request }) => {
    const response = await request.get("/sitemap.xml");
    expect(response.status()).toBe(200);

    const body = await response.text();
    for (const route of INDEXABLE_ROUTES) {
      expect(body).toContain(`<loc>${absoluteUrl(route)}</loc>`);
    }
  });

  test("gives the landing page a canonical, a card and structured data", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", absoluteUrl("/"));

    const ogImage = await page.locator('meta[property="og:image"]').getAttribute("content");
    expect(ogImage?.startsWith(`${SITE_URL}/`)).toBe(true);
    expect(ogImage).toContain("opengraph-image");

    const jsonLd = await page.locator('script[type="application/ld+json"]').textContent();
    expect(jsonLd).toBeTruthy();
    const parsed = JSON.parse(jsonLd!);
    // The one signal that says "code sample by a person" to something that has
    // just been handed five screens of a brokerage application.
    expect(parsed["@type"]).toBe("SoftwareSourceCode");
    expect(parsed.author["@type"]).toBe("Person");
  });

  test("titles a step for its author, not for the brokerage", async ({ page }) => {
    await page.goto("/apply/tax-residency");

    await expect(page).toHaveTitle(/^Step 3: Tax residency — KYC demo by /);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      absoluteUrl("/apply/tax-residency"),
    );
  });
});
