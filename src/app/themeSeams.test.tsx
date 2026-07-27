import { readFileSync } from "node:fs";
import path from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Button } from "@/form-builder/components/ui/button";
import { FieldLegend } from "@/form-builder/components/ui/field";
import { Popover, PopoverTrigger } from "@/form-builder/components/ui/popover";
import { Switch } from "@/form-builder/components/ui/switch";

/**
 * The one theme override that cannot be keyed on `data-slot`, pinned.
 *
 * `globals.css` restyles the vendored shadcn primitives through `data-slot`,
 * and `theme.test.ts` checks every one of those names against the engine. The
 * button is the exception: `button.tsx` writes `data-slot` *before* spreading
 * `{...props}`, so a Radix `asChild` trigger's own `data-slot` lands last and
 * wins. The date, country and phone controls are all rendered that way, and
 * keyed on `data-slot` they stayed at the vendored 21px while every other
 * control was 44px.
 *
 * The stylesheet therefore matches `[data-variant][data-size]` — the two
 * attributes that do survive the merge, and the pair no other primitive
 * carries. Both halves of that claim are assertions here rather than comments,
 * because both are properties of vendored code that a re-vendor can change
 * without anything else in this repo noticing.
 */

afterEach(cleanup);

const SELECTOR = "[data-variant][data-size]";

const css = readFileSync(path.join(__dirname, "globals.css"), "utf8");

describe("the button seam", () => {
  it("is the selector the stylesheet actually uses", () => {
    // Without this, the rest of the file could pass while `globals.css` had
    // moved on to something else.
    expect(css).toContain(SELECTOR);
  });

  it("matches a plain button", () => {
    render(<Button>Continue</Button>);
    const button = screen.getByRole("button", { name: "Continue" });

    expect(button.getAttribute("data-slot")).toBe("button");
    expect(button.matches(SELECTOR)).toBe(true);
  });

  it("still matches when a Radix trigger has taken the slot", () => {
    render(
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline">Choose a country</Button>
        </PopoverTrigger>
      </Popover>,
    );
    const trigger = screen.getByRole("button", { name: "Choose a country" });

    // The overwrite this whole seam exists because of. If a future engine
    // version writes `data-slot` after the spread, this expectation flips and
    // the simpler `[data-slot="button"]` selector becomes available again.
    expect(trigger.getAttribute("data-slot")).toBe("popover-trigger");

    expect(trigger.getAttribute("data-variant")).toBe("outline");
    expect(trigger.getAttribute("data-size")).toBe("default");
    expect(trigger.matches(SELECTOR)).toBe(true);
  });

  it("distinguishes the icon-only sizes by name", () => {
    // The horizontal-padding rule is `:not([data-size^="icon"])`. It used to be
    // `[class*="px-["]`, which read the same distinction off the utility string
    // the CVA happened to emit.
    render(
      <>
        <Button size="lg">Submit</Button>
        <Button size="icon-sm" aria-label="Remove" />
      </>,
    );

    expect(screen.getByRole("button", { name: "Submit" }).matches('[data-size^="icon"]')).toBe(
      false,
    );
    expect(screen.getByRole("button", { name: "Remove" }).matches('[data-size^="icon"]')).toBe(
      true,
    );
  });

  it("does not catch the other primitives that carry one of the two attributes", () => {
    // `switch` and `select-trigger` carry `data-size`; `field-legend` carries
    // `data-variant`. Only the button carries both, which is why the selector
    // needs both. A re-vendor that adds the missing attribute to either of
    // these would start styling them as buttons.
    render(
      <>
        <Switch aria-label="Notify me" />
        <fieldset>
          <FieldLegend>Account type</FieldLegend>
        </fieldset>
      </>,
    );

    expect(screen.getByRole("switch").matches(SELECTOR)).toBe(false);
    expect(document.querySelector('[data-slot="field-legend"]')!.matches(SELECTOR)).toBe(false);
  });
});
