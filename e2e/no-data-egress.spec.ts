import { expect, test, type Page, type Request } from "@playwright/test";
import { APPLICATION_FORM_ID } from "@/config/applicationForm";
import { SAMPLE_SENTINELS } from "@/config/sampleData";
import { draftStorageKey } from "@/form-builder/core/autosave";
import { NEXT, attachRequiredDocuments, stepUrl } from "./support/flow";

/**
 * The demo's central promise, as a test: a complete application is filled in,
 * documents are attached, and the whole thing is submitted — and not one byte
 * of any of it appears in a request.
 *
 * ## Why this exists rather than a note in the README
 *
 * The banner on every screen says "nothing you type is sent anywhere, no file
 * you choose is uploaded". That is a claim about behaviour, and the way it
 * breaks is not by someone writing `fetch("/api/kyc")` — it is by an analytics
 * snippet, an error reporter with `beforeSend` left at its default, a
 * `<form action>` that loses its `preventDefault`, or a `next/image` loader
 * given a user-supplied value. None of those look like data exfiltration in a
 * diff. All of them would fail here.
 *
 * The original acceptance criterion was "the DevTools Network tab shows zero
 * requests containing form input" — a check a person performs once, on the
 * branch they happened to walk, and never again. This is that check, on every
 * commit, on a real browser.
 *
 * ## How it recognises the data
 *
 * `SAMPLE_SENTINELS` is exported from `src/config/sampleData.ts` for exactly
 * this. Every sample profile is written around invented words ("Quillon",
 * "Tidewater") and the reserved `.invalid` TLD, so a string that shows up in a
 * URL or a request body is either the visitor's answers or an extraordinary
 * coincidence. The two uploaded files are named with a sentinel too, which is
 * the only part of a `File` that could survive a `FormData` round trip and be
 * recognised at the far end.
 *
 * ## Two things it does that a naive version would not
 *
 * 1. **It proves the sentinels actually reached the form.** A spec that filled
 *    nothing would pass this assertion perfectly. So the review step is checked
 *    for a sentinel-bearing answer before the network claim is made.
 * 2. **It listens from before the first navigation.** The document request for
 *    the first page is in scope, not just the XHRs after it.
 */

/** Every request the page made, flattened to the two places data could hide. */
type Recorded = { method: string; url: string; body: string };

function record(page: Page): Recorded[] {
  const requests: Recorded[] = [];
  page.on("request", (request: Request) => {
    requests.push({
      method: request.method(),
      url: request.url(),
      // `postData()` returns null for a GET and for a body Playwright cannot
      // decode as text; the buffer covers the second case, which is the shape a
      // multipart file upload would arrive in.
      body: request.postData() ?? request.postDataBuffer()?.toString("utf8") ?? "",
    });
  });
  return requests;
}

/** Case-insensitive, because a sentinel that leaked lowercased still leaked. */
function carrying(requests: Recorded[], sentinel: string): Recorded[] {
  const needle = sentinel.toLowerCase();
  return requests.filter(
    (request) =>
      decodeURIComponent(request.url).toLowerCase().includes(needle) ||
      request.body.toLowerCase().includes(needle),
  );
}

async function fillStepWithSampleData(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Fill this step with sample data" }).click();
}

test("a full application, filled and submitted, puts nothing into a request", async ({
  page,
  baseURL,
}) => {
  const requests = record(page);

  await page.goto(stepUrl("account-type"));

  // Three steps of answers. The sample button fills one step at a time on
  // purpose, so this is the whole of it — see SampleDataButton for why.
  for (const step of ["personal-details", "tax-residency", "documents"] as const) {
    await fillStepWithSampleData(page);
    await page.getByRole("button", NEXT).click();
    await expect(page).toHaveURL(new RegExp(`${stepUrl(step)}$`));
  }

  // The sample data leaves the country as Germany, so this is the German
  // individual branch and both of its required uploads are present.
  await attachRequiredDocuments(page, "Quillon");
  await page.getByRole("button", NEXT).click();
  await expect(page).toHaveURL(new RegExp(`${stepUrl("review")}$`));

  // The guard against a vacuous pass: if the form were empty, every assertion
  // below would hold and mean nothing.
  await expect(page.getByText("Marit Quillon").first()).toBeVisible();

  const submit = page.getByRole("button", { name: "Submit application" });
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page.getByText(/No data was transmitted/)).toBeVisible();
  await expect(page.getByText(/^MM-[0-9A-Z]{4}-[0-9A-Z]{4}$/)).toBeVisible();

  // ---- The claim ------------------------------------------------------------
  expect(requests.length).toBeGreaterThan(0);
  for (const sentinel of SAMPLE_SENTINELS) {
    expect(
      carrying(requests, sentinel),
      `"${sentinel}" reached the network — the demo's banner says nothing typed here is sent anywhere`,
    ).toEqual([]);
  }

  // Nothing was posted at all. Narrower than the sentinel scan and worth
  // stating separately: a body this spec cannot decode still cannot be a body
  // that was never sent.
  expect(requests.filter((request) => request.body !== "")).toEqual([]);

  // No third party, either. Self-hosted fonts and no analytics are what make
  // the sentinel scan sufficient — a request to somewhere else would be
  // carrying something this spec has no way to read.
  const origin = new URL(baseURL ?? "http://localhost:3000").origin;
  expect(
    requests.filter((request) => !request.url.startsWith(origin) && !request.url.startsWith("data:")),
  ).toEqual([]);

  // And the draft is gone: submitting clears it, so nothing is left in the tab
  // either. A free assertion, and the one a visitor is least able to check.
  const key = draftStorageKey(APPLICATION_FORM_ID);
  await expect
    .poll(() => page.evaluate((k) => window.sessionStorage.getItem(k), key))
    .toBeNull();
});
