import { describe, expect, it } from "vitest";
import { SIZES, renderRgba } from "./build-favicon.mjs";

/**
 * The mark is two axis-aligned rectangles knocked out of a teal tile. These
 * tests read pixels back out of the rasteriser rather than comparing whole
 * files, so a failure names the part of the mark that moved.
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
    // (16,16) sits inside the vertical rect: x 15→19, y 4→28.
    expect(pixel(renderRgba(32), 32, 16, 16)).toEqual(WHITE);
  });

  it("leaves the tile teal away from the figure", () => {
    // (26,8) is clear of both rects.
    expect(pixel(renderRgba(32), 32, 26, 8)).toEqual(TEAL);
  });

  it("does not read as a plus sign: the crossbar is left of the vertical only", () => {
    // The single design risk this concept carries. y=20 is inside the crossbar
    // band (18→22); the bar must be present at x=10 and absent at x=24.
    const rgba = renderRgba(32);
    expect(pixel(rgba, 32, 10, 20)).toEqual(WHITE);
    expect(pixel(rgba, 32, 24, 20)).toEqual(TEAL);
  });

  it("rounds the corners", () => {
    // rx=3 on a 32 grid: the corner pixel is mostly outside the tile.
    const [, , , alpha] = pixel(renderRgba(32), 32, 0, 0);
    expect(alpha).toBeLessThan(128);
  });

  it("renders a full opaque buffer at every shipped size", () => {
    // Driven by SIZES rather than a literal [16, 32]: adding a size to the .ico
    // must not quietly leave that size unrendered by anything.
    for (const size of SIZES) {
      expect(renderRgba(size)).toHaveLength(size * size * 4);
      // Centre of the vertical stroke, opaque at both sizes.
      expect(pixel(renderRgba(size), size, size / 2, size / 2)[3]).toBe(255);
    }
  });
});
