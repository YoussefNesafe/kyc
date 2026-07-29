#!/usr/bin/env node
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import zlib from "node:zlib";

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
 * The vertical sits at x 16→20 — two pixels right of true centre on this grid,
 * which is exactly ONE pixel at 16px. That is the point: the crossbar runs left
 * only, and the shift pays back the weight. Optical centring, not geometric.
 * The crossbar stops AT the vertical rather than crossing it — a symmetric bar
 * would read as a close button.
 *
 * Every x here is even on purpose. 16px is the canvas this mark is really for,
 * and an odd coordinate halves onto a pixel boundary and renders soft: 15→19
 * was the first attempt and it blurred the vertical across three columns at
 * 16px. Do not "centre" these back to 15 or 14 — that reintroduces the blur.
 */
export const GEOMETRY = {
  viewBox: 32,
  radius: 3,
  tile: "#0F5C5A", // --primary
  figure: "#FFFFFF", // --primary-foreground, 7.8:1 on the tile
  rects: [
    { x: 16, y: 4, width: 4, height: 24 }, // vertical
    { x: 6, y: 18, width: 14, height: 4 }, // crossbar
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

/*
 * PNG, by hand.
 *
 * CRC32 is rolled here rather than taken from `zlib.crc32`, which landed in
 * Node 20.15. This repo declares no Node floor at all — no `engines` field, no
 * .nvmrc — so reaching for a 20.15+ API would make this script the one thing in
 * the tree with a version requirement, and an undocumented one at that. Eight
 * lines of table lookup costs less than a constraint nobody would think to
 * write down.
 */
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** 8-bit RGBA, no interlace, filter type 0 on every scanline. */
export function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.writeUInt8(8, 8); // bit depth
  ihdr.writeUInt8(6, 9); // colour type: truecolour with alpha
  ihdr.writeUInt8(0, 10); // compression: deflate
  ihdr.writeUInt8(0, 11); // filter method: adaptive
  ihdr.writeUInt8(0, 12); // interlace: none

  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    const row = y * (stride + 1);
    raw[row] = 0; // filter type None. The image is flat colour; nothing to gain.
    rgba.copy(raw, row + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    PNG_SIGNATURE,
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/**
 * ICO container: a 6-byte header, a 16-byte directory entry per image, then the
 * payloads. PNG-compressed entries are read by every browser in use.
 */
export function encodeIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // 1 = icon (2 would be cursor)
  header.writeUInt16LE(images.length, 4);

  let offset = 6 + 16 * images.length;
  const entries = images.map(({ size, png }) => {
    const entry = Buffer.alloc(16);
    // Width and height are single bytes, which is why the format caps at 256 —
    // and why 256 is spelled 0. SIZES tops out at 32, so that case never
    // arises; a 256 entry would throw here rather than silently mis-encode,
    // which is the failure mode worth having.
    entry.writeUInt8(size, 0);
    entry.writeUInt8(size, 1);
    entry.writeUInt8(0, 2); // palette entries, 0 = truecolour
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    return entry;
  });

  return Buffer.concat([header, ...entries, ...images.map((image) => image.png)]);
}

export function buildIco() {
  return encodeIco(SIZES.map((size) => ({ size, png: encodePng(size, renderRgba(size)) })));
}

const OUTPUT = fileURLToPath(new URL("../src/app/favicon.ico", import.meta.url));

/*
 * Importable by the tests, executable by `yarn favicon`. Without this guard the
 * test run would rewrite the committed icon as a side effect of importing it —
 * every `yarn test` would leave a dirty working tree, and a generator bug would
 * land in the binary before anyone had a chance to review it.
 *
 * The comparison is url-to-url rather than path-to-path on purpose: argv[1] is
 * a native path (drive letter and backslashes on Windows), import.meta.url is
 * always a file: URL, and pathToFileURL is the only conversion that agrees with
 * how Node itself spelled this module's URL.
 */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  fs.writeFileSync(OUTPUT, buildIco());
  console.log(`Wrote ${OUTPUT} (${SIZES.join("px, ")}px)`);
}
