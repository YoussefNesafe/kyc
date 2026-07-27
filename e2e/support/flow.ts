import { expect, type Locator, type Page } from "@playwright/test";
import { STEP_SLUGS } from "@/config/steps";

/**
 * The bits both browser flows need. Not a page object: the two specs walk the
 * form for opposite reasons — one proves a keyboard user can finish it, the
 * other proves nothing they type leaves the tab — and a shared "fill the form"
 * helper would hide the very steps each is asserting about. What is shared here
 * is only the mechanics neither spec is testing.
 *
 * This file sits under `e2e/support/` rather than beside the specs because
 * Playwright's default `testMatch` collects `*.spec.ts` / `*.test.ts` only, so
 * a helper module here is imported, never collected as an empty suite.
 */

export const stepUrl = (slug: (typeof STEP_SLUGS)[number]) => `/apply/${slug}`;

/**
 * Whether the browser's focus is on this element right now.
 *
 * `Locator.evaluate` resolves the element first, so a locator that matches
 * nothing yet — a field that has not appeared, a popover that has not opened —
 * throws rather than answering. That is a "no" for a caller that is tabbing
 * around looking for it, not an error, hence the catch.
 */
async function isFocused(target: Locator): Promise<boolean> {
  return target.evaluate((element) => element === document.activeElement).catch(() => false);
}

/**
 * Move the keyboard focus onto `target` using Tab presses and nothing else.
 *
 * This is the whole point of the keyboard spec, so it is deliberately not
 * `locator.focus()`: calling `focus()` would prove the element *can* hold
 * focus, which is never in doubt, while saying nothing about whether a person
 * pressing Tab can ever get there. An element that is `display: none`,
 * `tabindex="-1"`, behind an inert layer, or simply never reached before the
 * order wraps will fail here — which is the defect this is looking for.
 *
 * The limit is a real assertion, not a timeout guard: reaching a control should
 * take a handful of presses, and needing more than `limit` means the tab order
 * has gone somewhere a visitor would not follow.
 */
export async function tabTo(page: Page, target: Locator, limit = 40): Promise<void> {
  for (let press = 0; press <= limit; press += 1) {
    if (await isFocused(target)) return;
    await page.keyboard.press("Tab");
  }
  throw new Error(
    `Tabbed ${limit} times without reaching ${target}. Either it is not in the tab order or the order does not lead to it.`,
  );
}

/** Tab to a control and confirm the browser agrees, so a later `press` cannot go astray. */
export async function tabToAndAssert(page: Page, target: Locator, limit = 40): Promise<void> {
  await tabTo(page, target, limit);
  await expect(target).toBeFocused();
}

/**
 * A PNG small enough to be under every size ceiling in the form, and named with
 * a sample-data sentinel.
 *
 * The name matters more than the bytes: it is the one piece of the upload that
 * the egress spec can recognise in a request, so if a file handle ever did turn
 * into a `FormData` part, the sentinel scan sees it. The contents are a real
 * 1×1 PNG rather than random bytes so the file is what its extension claims.
 */
export const SAMPLE_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

export function sampleUpload(name: string) {
  return { name, mimeType: "image/png", buffer: Buffer.from(SAMPLE_PNG_BASE64, "base64") };
}

/**
 * The simulated upload runs for up to ~2.6 s (`MAX_DURATION_MS` in
 * `src/fields/document.tsx`), and a row only reports `attached` once its bar
 * has finished. Waiting for the status rather than sleeping keeps this honest
 * on a slow machine and quick on a fast one.
 */
export async function expectAttached(page: Page, count: number): Promise<void> {
  const attached = page.locator('[data-slot="document-row"][data-status="attached"]');
  await expect(attached).toHaveCount(count, { timeout: 15_000 });
}

/** The two required documents on the German individual branch. */
export async function attachRequiredDocuments(page: Page, prefix: string): Promise<void> {
  await page
    .getByLabel(/Photo identity document/)
    .setInputFiles(sampleUpload(`${prefix}-passport.png`));
  await page
    .getByLabel(/Meldebescheinigung/)
    .setInputFiles(sampleUpload(`${prefix}-meldebescheinigung.png`));
  await expectAttached(page, 2);
}

export const NEXT = { name: "Next", exact: true } as const;
