import { readdirSync, readFileSync } from "node:fs";
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

/**
 * The first `:root { … }` block of the code this repo owns — the palette. There
 * is a second one further down holding the `--fb-space-*` overrides, and a
 * `.dark` block holding a different value for several of the same names, so a
 * whole-file scan for `--input:` would find three answers and pick the wrong
 * one. No rule in this file nests braces, so matching to the first `}` is exact.
 */
function firstRootBlock(source: string): string {
  const start = source.indexOf(":root");
  const open = source.indexOf("{", start);
  return source.slice(open + 1, source.indexOf("}", open));
}

const palette = firstRootBlock(ownedCss);

/** `--name: value;` pairs, whitespace-collapsed. */
function declarations(block: string): Map<string, string> {
  return new Map(
    [...block.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/gi)].map((m) => [m[1], m[2].trim()]),
  );
}

const tokens = declarations(palette);

/**
 * `oklch(L C H)` → linear-light sRGB, clamped to gamut.
 *
 * Written out rather than pulled from a colour library because the whole point
 * of the assertions below is to be an independent second opinion on the values
 * in the stylesheet. A dependency that shared a bug with the browser would
 * agree with it and prove nothing. Coefficients are Björn Ottosson's published
 * OKLab ↔ linear sRGB matrices.
 */
function oklchToLinearSrgb(l: number, c: number, hDegrees: number): [number, number, number] {
  const h = (hDegrees * Math.PI) / 180;
  const a = c * Math.cos(h);
  const b = c * Math.sin(h);

  const lCone = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const mCone = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const sCone = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;

  return [
    4.0767416621 * lCone - 3.3077115913 * mCone + 0.2309699292 * sCone,
    -1.2684380046 * lCone + 2.6097574011 * mCone - 0.3413193965 * sCone,
    -0.0041960863 * lCone - 0.7034186147 * mCone + 1.707614701 * sCone,
  ].map((channel) => Math.min(1, Math.max(0, channel))) as [number, number, number];
}

/** The colour a token names, as linear sRGB. Throws rather than guess. */
function channels(token: string): [number, number, number] {
  const value = tokens.get(token);
  if (value === undefined) throw new Error(`${token} is not declared in the palette`);
  const match = value.match(/^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/);
  if (!match) throw new Error(`${token} is "${value}", which this test cannot measure`);
  return oklchToLinearSrgb(Number(match[1]), Number(match[2]), Number(match[3]));
}

/** WCAG 2.x relative luminance, then the 2.x contrast ratio. */
function contrast(foreground: string, background: string): number {
  const luminance = (rgb: [number, number, number]) =>
    0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  const [lighter, darker] = [luminance(channels(foreground)), luminance(channels(background))].sort(
    (a, b) => b - a,
  );
  return (lighter + 0.05) / (darker + 0.05);
}

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

describe("contrast", () => {
  /**
   * SC 1.4.3, text. The palette comment claims every text-weight value clears
   * 4.5:1 on both surfaces; until now nothing checked it.
   */
  it.each([
    ["--foreground", "--background"],
    ["--foreground", "--card"],
    ["--muted-foreground", "--background"],
    ["--muted-foreground", "--card"],
    ["--primary", "--background"],
    ["--primary", "--card"],
    ["--primary", "--secondary"],
    ["--success", "--background"],
    ["--success", "--success-surface"],
    ["--warning", "--background"],
    ["--warning", "--warning-surface"],
    ["--destructive", "--background"],
    ["--destructive", "--destructive-surface"],
    ["--accent-foreground", "--accent"],
    ["--primary-foreground", "--primary"],
    ["--notice-foreground", "--notice-surface"],
    ["--notice-tag", "--notice-surface"],
  ])("reads %s on %s at 4.5:1 or better", (ink, surface) => {
    expect(contrast(ink, surface)).toBeGreaterThanOrEqual(4.5);
  });

  /**
   * SC 1.4.11, non-text. Every control in this interface is transparent-filled
   * on a near-white page, so its border is the only visual information
   * identifying it as a control — which is exactly what the criterion covers,
   * and it asks for 3:1 against the adjacent colour. A control can sit on the
   * page (`--background`) or inside a panel (`--card`), so both count.
   *
   * This is the assertion that was missing when `--input` shipped at #C7CDCD:
   * 1.61:1 on `--card` and 1.50:1 on `--background`, roughly half the bar, on
   * every input, textarea, select trigger, checkbox, radio, phone shell and
   * outline button at once. The value is a token, so one number moves all of
   * them — and one test holds all of them.
   */
  it.each([
    ["--input", "--card"],
    ["--input", "--background"],
    // The focus outline is drawn in `--ring` and is also non-text information.
    ["--ring", "--card"],
    ["--ring", "--background"],
  ])("draws %s against %s at 3:1 or better", (edge, surface) => {
    expect(contrast(edge, surface)).toBeGreaterThanOrEqual(3);
  });

  it("keeps --border below the control bar, so the two tokens stay distinguishable", () => {
    // Not a conformance requirement — the opposite. `--border` is decorative
    // separation and is deliberately lighter; if someone ever "fixes" it to 3:1
    // as well, the interface loses the distinction between a control edge and a
    // hairline and this test should be the prompt to think about that.
    expect(contrast("--border", "--card")).toBeLessThan(contrast("--input", "--card"));
  });
});

/**
 * The `[data-slot]` overrides are ~40 rules that exist because the vendored
 * shadcn primitives hardcode a fluid `vw` scale and cannot be edited from this
 * repo. Each one is keyed on a string the engine happens to emit. A re-vendor
 * that renames a slot does not fail a build, a type-check or a lint: the
 * selector simply stops matching, and the only detector left is a human
 * noticing 21px inputs again.
 *
 * So: every slot named in the stylesheet must exist in the engine.
 */
describe("data-slot overrides are anchored to the engine", () => {
  const ENGINE = path.join(SRC, "form-builder");

  const engineSource = readdirSync(ENGINE, { recursive: true, encoding: "utf8" })
    .filter((entry) => /\.tsx?$/.test(entry))
    .map((entry) => readFileSync(path.join(ENGINE, entry), "utf8"))
    .join("\n");

  const emitted = new Set(
    [...engineSource.matchAll(/data-slot="([a-z0-9-]+)"/gi)].map((m) => m[1]),
  );
  const targeted = [
    ...new Set([...css.matchAll(/\[data-slot="([a-z0-9-]+)"\]/gi)].map((m) => m[1])),
  ].sort();

  it("finds the engine and its slots", () => {
    // A guard on the guard: if either scan silently matched nothing, every
    // assertion below would pass vacuously.
    expect(emitted.size).toBeGreaterThan(30);
    expect(targeted.length).toBeGreaterThan(20);
  });

  it("targets no slot the engine does not render", () => {
    expect(targeted.filter((slot) => !emitted.has(slot))).toEqual([]);
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
