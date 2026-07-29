// @vitest-environment node
import { describe, expect, it } from "vitest";
import { SIZES, renderRgba } from "./build-favicon.mjs";

/**
 * The mark is two axis-aligned rectangles knocked out of a teal tile. These
 * tests read pixels back out of the rasteriser rather than comparing whole
 * files, so a failure names the part of the mark that moved.
 *
 * Pinned to the node environment: this is arithmetic over a Buffer, and
 * inheriting jsdom would cost a second of setup per run and let a pure-Node
 * generator quietly start depending on browser globals.
 */

/** RGBA of one pixel in a `size`×`size` render. */
function pixel(rgba: Buffer, size: number, x: number, y: number) {
  const i = (y * size + x) * 4;
  return [rgba[i], rgba[i + 1], rgba[i + 2], rgba[i + 3]];
}

const TEAL = [0x0f, 0x5c, 0x5a, 0xff];
const WHITE = [0xff, 0xff, 0xff, 0xff];

describe("renderRgba", () => {
  it("knocks the vertical stroke out in white", () => {
    // (16,16) sits inside the vertical rect: x 16→20, y 4→28.
    expect(pixel(renderRgba(32), 32, 16, 16)).toEqual(WHITE);
  });

  it("leaves the tile teal away from the figure", () => {
    // (26,8) is clear of both rects.
    expect(pixel(renderRgba(32), 32, 26, 8)).toEqual(TEAL);
  });

  it("does not read as a plus sign: the crossbar is left of the vertical only", () => {
    // The single design risk this concept carries, checked at both shipped
    // sizes. The bar must be present left of the vertical and absent right of
    // it: 32px band y 18→22, 16px band y 9→11.
    const rgba32 = renderRgba(32);
    expect(pixel(rgba32, 32, 10, 20)).toEqual(WHITE);
    expect(pixel(rgba32, 32, 24, 20)).toEqual(TEAL);

    const rgba16 = renderRgba(16);
    expect(pixel(rgba16, 16, 5, 9)).toEqual(WHITE);
    expect(pixel(rgba16, 16, 12, 9)).toEqual(TEAL);
  });

  it("keeps the vertical on whole pixels at 16px", () => {
    // 16px is the canvas this mark was designed for, and the reason every x in
    // GEOMETRY is even. x 16→20 halves to 8→10, so the stroke is exactly the
    // two pixels 8 and 9 with hard teal either side. An odd coordinate —
    // 15→19 was the first attempt — halves onto a boundary and smears the
    // stroke across three columns at partial alpha, which is why this asserts
    // full opacity rather than merely "white-ish".
    const rgba = renderRgba(16);
    expect(pixel(rgba, 16, 7, 8)).toEqual(TEAL);
    expect(pixel(rgba, 16, 8, 8)).toEqual(WHITE);
    expect(pixel(rgba, 16, 9, 8)).toEqual(WHITE);
    expect(pixel(rgba, 16, 10, 8)).toEqual(TEAL);
  });

  it("rounds the corners", () => {
    // rx=3 on a 32 grid: the corner pixel is almost entirely outside the tile,
    // measuring alpha 4. Corner alpha falls as the radius grows, so this bound
    // catches the corner going SQUARE and nothing else — radius 2 measures 84
    // and radius 0 measures 255, both caught here, while a radius that grows
    // tends to 0 and slips past any upper bound. Pinning the radius itself is
    // the SVG drift guard's job, not this probe's.
    //
    // Deliberately 32px-only: the same pixel at 16px measures 135, which is
    // correct for a radius that is 1.5px there, not a regression.
    const [, , , alpha] = pixel(renderRgba(32), 32, 0, 0);
    expect(alpha).toBeLessThan(32);
  });

  it("renders a full opaque buffer at every shipped size", () => {
    // Driven by SIZES rather than a literal [16, 32]: adding a size to the .ico
    // must not quietly leave that size unrendered by anything. Pinned first,
    // because a loop over a shrinking list would cover less and still pass.
    expect(SIZES).toEqual([16, 32]);
    for (const size of SIZES) {
      expect(renderRgba(size)).toHaveLength(size * size * 4);
      // Centre of the vertical stroke. Asserting the COLOUR, not just opacity —
      // an alpha-only check passes for any interior tile pixel and would still
      // pass with the figure deleted entirely.
      expect(pixel(renderRgba(size), size, size / 2, size / 2)).toEqual(WHITE);
    }
  });
});
