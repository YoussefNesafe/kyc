import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The theme is CSS and a font loader, neither of which a component test can
 * see. What is worth asserting is not that a class string is spelled a certain
 * way — a class name proves nothing about what it renders — but the invariants
 * the theme exists to hold, two of which had already been broken in the files
 * this task inherited:
 *
 *   1. Every font variable the stylesheet consumes is produced by a loader in
 *      the layout. `globals.css` referenced `--font-geist-mono` and mapped
 *      `--font-sans` to itself, so `font-mono` resolved to nothing and
 *      `font-sans` fell back to the browser default.
 *   2. Nothing fetches a font over the network. The demo's central claim is
 *      that it makes no third-party requests.
 *   3. The palette is the brief's palette, and the size scale is stated in
 *      rem — the vendored `vw` scale renders a field label at 9.3px on a
 *      1280-wide screen.
 *
 * Prose is stripped before every scan. An earlier draft of this file failed
 * because a comment in the layout mentioned `fonts.googleapis.com` while
 * explaining why nothing requests it.
 */

const SRC = path.resolve(__dirname, "..");
const rawCss = readFileSync(path.join(SRC, "app/globals.css"), "utf8");
const rawLayout = readFileSync(path.join(SRC, "app/layout.tsx"), "utf8");

const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const css = stripComments(rawCss);
const layout = stripComments(rawLayout);

const VENDORED_START = "/* form-builder theme (managed) */";
const VENDORED_END = "/* end form-builder theme */";

/**
 * `globals.css` minus the block the form-builder CLI regenerates. That block
 * is vendored verbatim on purpose — it is overridden below, never edited — so
 * its violet brand tokens are not this repo's palette and must not be judged
 * as if they were.
 */
const ownedCss = stripComments(
  rawCss.slice(0, rawCss.indexOf(VENDORED_START)) +
    rawCss.slice(rawCss.indexOf(VENDORED_END) + VENDORED_END.length),
);

/** `variable: "--font-x"` on every `next/font` loader call in the layout. */
function fontVariablesDefined(source: string): Set<string> {
  return new Set([...source.matchAll(/variable:\s*"(--font-[a-z0-9-]+)"/gi)].map((m) => m[1]));
}

describe("font wiring", () => {
  it("resolves every font variable the stylesheet references", () => {
    const referenced = new Set(
      [...css.matchAll(/--font-[a-z0-9-]+:\s*var\((--font-[a-z0-9-]+)\)/gi)].map((m) => m[1]),
    );
    const defined = fontVariablesDefined(layout);

    expect(referenced.size).toBeGreaterThan(0);
    expect([...referenced].filter((name) => !defined.has(name))).toEqual([]);
  });

  it("gives the sans and mono tokens a face each", () => {
    // Both must map to a real loader variable, not to themselves and not to a
    // Tailwind default. `--font-mono` is the token the engine's file sizes and
    // masked values pick up, so leaving it unbound costs the whole
    // machine-value convention silently.
    const defined = fontVariablesDefined(layout);
    for (const token of ["--font-sans", "--font-mono"]) {
      const match = css.match(new RegExp(`${token}:\\s*var\\((--font-[a-z0-9-]+)\\)`, "i"));
      expect(match, `${token} is not mapped to a loader variable`).not.toBeNull();
      expect(defined.has(match![1]), `${token} points at an undefined variable`).toBe(true);
    }
  });

  it("loads both faces through next/font, which self-hosts them", () => {
    expect(layout).toMatch(/from "next\/font\/google"/);
    expect(layout).toMatch(/\bInter_Tight\s*\(/);
    expect(layout).toMatch(/\bJetBrains_Mono\s*\(/);
  });

  it("applies both font variables to the document element", () => {
    // A loaded font that is never put on an element is a downloaded file
    // nothing can use.
    const html = layout.match(/<html[^>]*>/)?.[0] ?? "";
    expect(html).toMatch(/interTight\.variable/);
    expect(html).toMatch(/jetBrainsMono\.variable/);
  });
});

describe("zero external requests", () => {
  it("never imports a stylesheet or a font over the network", () => {
    // `@import "tailwindcss"` and friends are bare package specifiers resolved
    // at build time. A URL is not.
    expect(css).not.toMatch(/@import\s+url\(/i);
    expect(css).not.toMatch(/https?:\/\//);
    expect(layout).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
  });
});

describe("palette", () => {
  it("uses the brief's teal as the single accent", () => {
    // #0F5C5A in oklch. Both the shadcn primary and the engine's own brand
    // token have to land on it, or the interface has two accents.
    const teal = "oklch\\(0\\.4313 0\\.0693 192\\.17\\)";
    expect(ownedCss).toMatch(new RegExp(`--primary:\\s*${teal}`));
    expect(ownedCss).toMatch(new RegExp(`--accent-brand-solid:\\s*${teal}`));
  });

  it("leaves no violet or blue in the palette this repo owns", () => {
    // The vendored block ships `oklch(0.5 0.18 271)`. Anything with real
    // chroma in the 250-330 hue band is the look the brief rules out; the
    // near-neutral surfaces sit around hue 200 below 0.02 chroma and are fine.
    const offPalette = [...ownedCss.matchAll(/oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)/g)].filter(
      ([, , chroma, hue]) => Number(chroma) > 0.02 && Number(hue) >= 250 && Number(hue) <= 330,
    );
    expect(offPalette.map((m) => m[0])).toEqual([]);
  });

  it("uses no gradients at all", () => {
    expect(ownedCss).not.toMatch(/linear-gradient|radial-gradient|conic-gradient/);
  });
});

describe("engine size scale", () => {
  const vendored = rawCss.slice(rawCss.indexOf(VENDORED_START), rawCss.indexOf(VENDORED_END));
  const overrides = rawCss.slice(rawCss.indexOf(VENDORED_END));
  const declared = [...vendored.matchAll(/(--fb-space-[a-z0-9-]+):/g)].map((m) => m[1]);

  it("redefines every --fb-space token the vendored block declares", () => {
    // A half-converted scale is worse than no conversion: it puts a rem gap
    // next to a vw gap in the same row and they drift apart as the window
    // resizes.
    expect(declared.length).toBeGreaterThan(40);
    expect(declared.filter((name) => !new RegExp(`${name}:`).test(overrides))).toEqual([]);
  });

  it("states the scale in rem, so a label is the same size at every width", () => {
    const values = [...overrides.matchAll(/--fb-space-[a-z0-9-]+:\s*([^;]+);/g)].map((m) =>
      m[1].trim(),
    );
    expect(values.length).toBe(declared.length);
    expect(values.filter((value) => value.includes("vw"))).toEqual([]);
  });
});
