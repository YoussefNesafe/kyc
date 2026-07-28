#!/usr/bin/env node

/**
 * Builds src/app/favicon.ico from the geometry below.
 *
 * No image dependency, by choice. The mark is two axis-aligned rectangles on a
 * rounded tile, so rasterising it is arithmetic; `node:zlib` supplies the only
 * hard part (PNG's deflate) and ships with Node. The alternative — committing a
 * .ico with no way to regenerate or review it — makes the icon the one file in
 * the tree that cannot be read in a diff.
 *
 * GEOMETRY is the single source of truth. src/app/icon.svg is authored by hand
 * and held to these same numbers by build-favicon.test.ts, so the vector and
 * the raster cannot drift apart unnoticed.
 *
 * Run: yarn favicon
 */

/**
 * The meridian datum, on a 32×32 grid. See
 * docs/plans/2026-07-28-favicon-design.md for why each number is what it is.
 *
 * The vertical sits at x 15→19, one pixel right of true centre: the crossbar
 * runs left only, and this pays back the weight. Optical centring, not
 * geometric. The crossbar stops AT the vertical rather than crossing it — a
 * symmetric bar would read as a close button.
 */
export const GEOMETRY = {
  viewBox: 32,
  radius: 3,
  tile: "#0F5C5A", // --primary
  figure: "#FFFFFF", // --primary-foreground, 7.8:1 on the tile
  rects: [
    { x: 15, y: 4, width: 4, height: 24 }, // vertical
    { x: 6, y: 18, width: 13, height: 4 }, // crossbar
  ],
};

/** Rendered sizes inside the .ico. */
export const SIZES = [16, 32];

/** Samples per axis per pixel. 8 is plenty to antialias four corner arcs. */
const SUPERSAMPLE = 8;

function hexToRgb(hex) {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

/** Point-in-rounded-square. Clamping to the inner box handles edges and corners alike. */
function inRoundedSquare(x, y, side, radius) {
  if (x < 0 || y < 0 || x > side || y > side) return false;
  const cx = Math.min(Math.max(x, radius), side - radius);
  const cy = Math.min(Math.max(y, radius), side - radius);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= radius * radius;
}

function inFigure(x, y) {
  return GEOMETRY.rects.some(
    (r) => x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height,
  );
}

/** Rasterise the mark to a straight (non-premultiplied) RGBA buffer. */
export function renderRgba(size) {
  const { viewBox, radius } = GEOMETRY;
  const tile = hexToRgb(GEOMETRY.tile);
  const figure = hexToRgb(GEOMETRY.figure);
  const out = Buffer.alloc(size * size * 4);
  const step = viewBox / (size * SUPERSAMPLE);
  const samples = SUPERSAMPLE * SUPERSAMPLE;

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let covered = 0;

      for (let sy = 0; sy < SUPERSAMPLE; sy++) {
        for (let sx = 0; sx < SUPERSAMPLE; sx++) {
          const x = (px * SUPERSAMPLE + sx + 0.5) * step;
          const y = (py * SUPERSAMPLE + sy + 0.5) * step;
          if (!inRoundedSquare(x, y, viewBox, radius)) continue;
          const [cr, cg, cb] = inFigure(x, y) ? figure : tile;
          r += cr;
          g += cg;
          b += cb;
          covered++;
        }
      }

      // Colour averages over COVERED samples only; alpha over all of them. Do
      // this the other way and a corner pixel comes out teal-blended-to-black
      // instead of teal at partial alpha.
      const i = (py * size + px) * 4;
      out[i] = covered ? Math.round(r / covered) : 0;
      out[i + 1] = covered ? Math.round(g / covered) : 0;
      out[i + 2] = covered ? Math.round(b / covered) : 0;
      out[i + 3] = Math.round((covered / samples) * 255);
    }
  }

  return out;
}
