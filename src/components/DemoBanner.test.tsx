// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import path from "node:path";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DemoBanner } from "./DemoBanner";
import { accountStepFields } from "@/config/fields/shared";

/**
 * The banner exists for one reason: this form is convincing enough that a
 * stranger on a public URL will otherwise type a real passport number into it.
 * Everything asserted here is a property of that job — the three facts are
 * stated, nothing can make the notice go away, and it renders above every
 * route. Nothing here asserts a class name.
 */

const CLAIMS = [
  { name: "nothing is transmitted", pattern: /nothing you type is sent anywhere/i },
  { name: "nothing is uploaded", pattern: /no file you choose is uploaded/i },
  { name: "nothing is stored on a server", pattern: /nothing is stored on a server/i },
];

// `globals` is off in vitest.config.ts, so Testing Library's automatic
// teardown never registers and every render would stack in the same document.
afterEach(cleanup);

/** The notice's text as a screen reader would hear it, whitespace normalised. */
function noticeText(): string {
  return screen.getByRole("complementary").textContent!.replace(/\s+/g, " ").trim();
}

describe("DemoBanner", () => {
  it.each(CLAIMS)("says plainly that $name", ({ pattern }) => {
    render(<DemoBanner />);
    expect(noticeText()).toMatch(pattern);
  });

  it("tells the visitor what to do about it", () => {
    render(<DemoBanner />);
    expect(noticeText()).toMatch(/don.t enter real personal details/i);
  });

  it("carries an accessible name, so it is reachable by landmark", () => {
    render(<DemoBanner />);
    expect(screen.getByRole("complementary", { name: /demonstration notice/i })).toBeTruthy();
  });

  it("offers no way to dismiss it", () => {
    // The specific failure this guards against is someone later adding a close
    // button "to clean up the layout". By the upload step, with a passport in
    // hand, a dismissed notice is no notice at all — so the banner must contain
    // no control of any kind, not merely no control labelled "close".
    const { container } = render(<DemoBanner />);
    const notice = screen.getByRole("complementary");

    expect(within(notice).queryAllByRole("button")).toEqual([]);
    expect(within(notice).queryAllByRole("link")).toEqual([]);
    expect(container.querySelectorAll("button, a, input, [role='button'], [onclick]")).toHaveLength(
      0,
    );
    // Nothing focusable at all: a dismiss control that is neither a button nor
    // a link is still a dismiss control.
    expect(container.querySelectorAll("[tabindex]")).toHaveLength(0);
  });

  it("is a server component, so nothing can hide it with client state", () => {
    const source = readFileSync(path.join(__dirname, "DemoBanner.tsx"), "utf8");
    expect(source).not.toMatch(/^\s*["']use client["']/m);
    expect(source).not.toMatch(/\buseState\b|\blocalStorage\b|\bsessionStorage\b/);
  });
});

describe("the root layout", () => {
  it("renders the banner itself, above every route", () => {
    // Asserted against the layout source rather than by rendering it: importing
    // layout.tsx runs the next/font loaders, which only exist inside the Next
    // compiler. What matters is the position — inside <body>, outside
    // {children} — because a banner rendered by a page is a banner some other
    // page can forget.
    const layout = readFileSync(path.join(__dirname, "../app/layout.tsx"), "utf8");
    const body = layout.slice(layout.indexOf("<body"), layout.indexOf("</body>"));

    expect(layout).toMatch(/import \{ DemoBanner \} from "@\/components\/DemoBanner"/);
    expect(body).toMatch(/<DemoBanner \/>/);
    expect(body.indexOf("<DemoBanner />")).toBeLessThan(body.indexOf("{children}"));
  });
});

describe("the form's intro copy", () => {
  const intro = accountStepFields.find((field) => field.name === "applicationIntro");
  const content = intro && "content" in intro ? String(intro.content) : "";

  it("exists and explains where the answers actually go", () => {
    expect(content).toMatch(/browser tab/i);
    expect(content).toMatch(/closing the tab discards them/i);
  });

  it("does not repeat any of the banner's three claims", () => {
    // The two pieces of copy divide one message. If a later edit moves a claim
    // back into the form, the visitor reads it twice on their first screen and
    // starts skipping both.
    for (const { name, pattern } of CLAIMS) {
      expect(content, `intro copy repeats the banner's claim that ${name}`).not.toMatch(pattern);
    }
    expect(content).not.toMatch(/fictional brokerage/i);
  });
});
