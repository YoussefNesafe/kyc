import { expect, test, type Locator, type Page } from "@playwright/test";
import { NEXT, expectAttached, sampleUpload, stepUrl, tabTo, tabToAndAssert } from "./support/flow";

/**
 * One application, start to finish, driven by the keyboard alone.
 *
 * ## Why this is a test and not a checklist line
 *
 * "Keyboard-only completion works" is an acceptance criterion for this demo,
 * and it is the criterion most likely to be quietly false: every control here
 * is a composite — a Radix radio group, a Radix select, two cmdk comboboxes in
 * popovers, a react-day-picker calendar, a visually-hidden file input — and any
 * one of them can regress into a mouse-only control without changing how the
 * page looks. A person reading the code cannot see that; a person pressing Tab
 * finds it immediately.
 *
 * ## The rules this spec holds itself to
 *
 * - **No `click()`, no `focus()`, no `fill()`.** Focus is only ever moved by
 *   `Tab` (see `tabTo`), and values are only ever entered with real key
 *   presses. `focus()` would skip the tab order — the thing under test — and
 *   `fill()` sets the value without dispatching the keystrokes a masked input
 *   or a phone field reformats on.
 * - **One exception, stated rather than hidden:** `setInputFiles` on the two
 *   file inputs. Pressing Enter on a focused `<input type=file>` opens the
 *   operating system's file chooser, which is not part of the page and cannot
 *   be driven by any browser automation. So the spec proves the half that is
 *   in the page — that the input is reachable by Tab and takes focus, which is
 *   what a keyboard user needs and what a `sr-only` input can easily lose —
 *   and then supplies the file the way Playwright must.
 *
 * ## Which branch it walks
 *
 * Germany, individual. It is the branch with the most controls of the most
 * kinds: it adds a masked eleven-digit field, a second radio group and a
 * second required upload on top of the shared set, so it exercises more of the
 * field registry than the other three.
 */

/**
 * How long each key is held down.
 *
 * Not decoration, and not a sleep-until-it-passes: Playwright's default press
 * dispatches `keydown` and `keyup` in the same tick, and Radix's radio group
 * decides whether an arrow key should *select* the newly focused option by
 * reading a flag that its own `document` keydown listener sets — a flag the
 * matching `keyup` clears again. React's focus handling runs after both, so a
 * zero-length tap moves focus without selecting, while any real keystroke
 * (measured here: 10 ms is already enough) selects as the ARIA radio pattern
 * requires. A human cannot produce a 0 ms keypress; asserting against one would
 * be inventing a defect rather than finding one.
 */
const KEY = { delay: 30 } as const;

/** The first day the calendar offers, and its year, so the assertion can name it. */
async function pickFirstOfferedDay(page: Page, trigger: Locator): Promise<string> {
  await tabToAndAssert(page, trigger);
  await page.keyboard.press("Enter", KEY);
  await expect(page.locator('[data-slot="popover-content"]')).toBeVisible();

  // react-day-picker gives exactly one day a tabbable index — the selected day,
  // else today, else the first of the displayed month. The calendar opens on
  // `maxDate`'s month (today minus eighteen years), so the day this lands on is
  // the first of that month: comfortably over eighteen, whatever today is.
  for (let press = 0; press < 12; press += 1) {
    await page.keyboard.press("Tab", KEY);
    const day = await page.evaluate(() => document.activeElement?.getAttribute("data-day") ?? null);
    if (day) {
      await page.keyboard.press("Enter", KEY);
      await expect(page.locator('[data-slot="popover-content"]')).toBeHidden();
      return day;
    }
  }
  throw new Error("No selectable day was reachable by Tab inside the open calendar.");
}

/** Open a cmdk combobox, type enough to leave one option, and take it. */
async function chooseFromCombobox(page: Page, trigger: Locator, search: string): Promise<void> {
  await tabToAndAssert(page, trigger);
  await page.keyboard.press("Enter", KEY);
  await expect(page.getByRole("option", { name: new RegExp(search, "i") })).toBeVisible();
  // The popover puts focus on the search box, so this types into it without
  // anything having to reach for it.
  await page.keyboard.type(search);
  await page.keyboard.press("Enter", KEY);
  await expect(trigger).toContainText(search);
}

test("a keyboard alone can complete the application from the first field to submit", async ({
  page,
}) => {
  await page.goto(stepUrl("account-type"));

  // ---- Step 1: account type -------------------------------------------------
  const individual = page.getByRole("radio", { name: /an individual account/ });
  await tabToAndAssert(page, individual);
  await page.keyboard.press("Space", KEY);
  await expect(individual).toBeChecked();

  const purpose = page.getByRole("combobox", { name: /What will the account mostly be used for/ });
  await tabToAndAssert(page, purpose);
  await page.keyboard.press("Enter", KEY);
  await expect(page.getByRole("option", { name: "Long-term investing" })).toBeVisible();
  await page.keyboard.press("Enter", KEY);
  await expect(purpose).toContainText("Long-term investing");

  await tabToAndAssert(page, page.getByRole("button", NEXT));
  await page.keyboard.press("Enter", KEY);
  await expect(page).toHaveURL(new RegExp(`${stepUrl("personal-details")}$`));

  // ---- Step 2: personal details --------------------------------------------
  await tabToAndAssert(page, page.getByLabel(/Full legal name/));
  await page.keyboard.type("Marit Quillon");

  const day = await pickFirstOfferedDay(page, page.getByLabel(/Date of birth/));
  const year = day.slice(-4);
  await expect(page.getByLabel(/Date of birth/)).toContainText(year);

  await chooseFromCombobox(page, page.getByRole("combobox", { name: /Nationality/ }), "Germany");

  await tabToAndAssert(page, page.getByLabel(/Email address/));
  await page.keyboard.type("marit.quillon@sample.invalid");

  // The phone field is a country button followed by the number input; Tab
  // reaches the input past the button without either being clicked.
  await tabToAndAssert(page, page.getByLabel(/Mobile number/));
  await page.keyboard.type("+49 30 231 25100");

  await tabToAndAssert(page, page.getByLabel(/Residential address/));
  await page.keyboard.type("Quillonweg 14, Vorderhaus, 2. OG");

  await tabToAndAssert(page, page.getByLabel(/Postal code/));
  await page.keyboard.type("10999");

  await tabToAndAssert(page, page.getByLabel(/^City/));
  await page.keyboard.type("Berlin");

  await tabToAndAssert(page, page.getByRole("button", NEXT));
  await page.keyboard.press("Enter", KEY);
  await expect(page).toHaveURL(new RegExp(`${stepUrl("tax-residency")}$`));

  // ---- Step 3: tax residency, and the branch it opens ----------------------
  await chooseFromCombobox(
    page,
    page.getByRole("combobox", { name: /Country of residence/ }),
    "Germany",
  );

  // Proof the branch actually opened: neither of these fields exists until the
  // country above says Germany.
  const steuerId = page.getByLabel(/Steuer-Identifikationsnummer/);
  await expect(steuerId).toBeVisible();
  await tabToAndAssert(page, steuerId);
  await page.keyboard.type("00000001234");
  await expect(steuerId).toHaveValue("00 000 001 234");

  const churchTax = page.getByRole("radio", { name: /I do not/ });
  // A radio group is one tab stop: Tab lands on the first option and the arrow
  // keys move within it, selecting as they go. Tabbing again would leave the
  // group entirely, which is exactly the behaviour being relied on here.
  await tabToAndAssert(page, page.getByRole("radio", { name: /religious community/ }));
  await page.keyboard.press("ArrowDown", KEY);
  await expect(churchTax).toBeChecked();

  await tabToAndAssert(page, page.getByRole("button", NEXT));
  await page.keyboard.press("Enter", KEY);
  await expect(page).toHaveURL(new RegExp(`${stepUrl("documents")}$`));

  // ---- Step 4: documents ---------------------------------------------------
  // The inputs are `sr-only`, which is the shape most likely to fall out of the
  // tab order without anyone noticing — so reaching them by Tab is asserted
  // even though the file itself has to be supplied out of band.
  const identity = page.getByLabel(/Photo identity document/);
  await tabToAndAssert(page, identity);
  await identity.setInputFiles(sampleUpload("keyboard-passport.png"));

  const meldebescheinigung = page.getByLabel(/Meldebescheinigung/);
  await tabToAndAssert(page, meldebescheinigung);
  await meldebescheinigung.setInputFiles(sampleUpload("keyboard-meldebescheinigung.png"));

  await expectAttached(page, 2);

  await tabToAndAssert(page, page.getByRole("button", NEXT));
  await page.keyboard.press("Enter", KEY);
  await expect(page).toHaveURL(new RegExp(`${stepUrl("review")}$`));

  // ---- Step 5: review and submit -------------------------------------------
  const submit = page.getByRole("button", { name: "Submit application" });
  // Enabled, not merely present. Submit was permanently disabled here once, for
  // a reason a keyboard user would experience as the form simply ending.
  await expect(submit).toBeEnabled();
  await tabTo(page, submit);
  await expect(submit).toBeFocused();
  await page.keyboard.press("Enter", KEY);

  await expect(page.getByRole("heading", { name: "Application submitted" })).toBeVisible();
  await expect(page.getByText(/No data was transmitted/)).toBeVisible();
  await expect(page.getByText(/^MM-[0-9A-Z]{4}-[0-9A-Z]{4}$/)).toBeVisible();
});
