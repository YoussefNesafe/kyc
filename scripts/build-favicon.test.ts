// @vitest-environment node
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { GEOMETRY, SIZES, buildIco, encodeIco, encodePng, renderRgba } from "./build-favicon.mjs";

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

describe("GEOMETRY", () => {
  /**
   * A change-detector test, deliberately. Every other test here — and the SVG
   * drift guard below — reads GEOMETRY and asserts that something agrees with
   * it, so all of them stay green while the mark itself changes: swap `radius`
   * to 8 and the .ico, the .svg and the whole suite move together in silence.
   *
   * These numbers are a signed-off design decision, not an implementation
   * detail (docs/plans/2026-07-28-favicon-design.md argues each one). The test
   * exists to make changing them DELIBERATE, not to prevent it: if you meant
   * to redraw the mark, update this literal in the same commit and the diff
   * will show a reviewer exactly what the brand mark now is.
   */
  it("holds the signed-off design values", () => {
    expect(GEOMETRY).toEqual({
      viewBox: 32,
      radius: 3,
      tile: "#0F5C5A",
      figure: "#FFFFFF",
      rects: [
        { x: 16, y: 4, width: 4, height: 24 }, // vertical
        { x: 6, y: 18, width: 14, height: 4 }, // crossbar, left of the vertical only
      ],
    });
  });
});

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

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe("encodePng", () => {
  it("writes a PNG signature and an IHDR declaring the size", () => {
    const png = encodePng(32, renderRgba(32));
    expect(png.subarray(0, 8)).toEqual(PNG_SIGNATURE);
    // IHDR payload starts at 16: length(4) + "IHDR"(4) after the 8-byte signature.
    expect(png.readUInt32BE(16)).toBe(32);
    expect(png.readUInt32BE(20)).toBe(32);
    expect(png.readUInt8(24)).toBe(8); // bit depth
    expect(png.readUInt8(25)).toBe(6); // colour type: RGBA
  });

  it("ends with IEND", () => {
    const png = encodePng(16, renderRgba(16));
    expect(png.subarray(png.length - 8, png.length - 4).toString("ascii")).toBe("IEND");
  });

  it("computes real chunk CRCs", () => {
    // IEND carries no payload, so its twelve bytes — a zero length, the type,
    // and the checksum over the type alone — are the same twelve bytes in every
    // valid PNG ever written. That makes this constant an oracle the suite does
    // not derive from the code under test, which matters because every other
    // encoder assertion here reads lengths, offsets and header fields, and all
    // of those stay correct while the checksums are garbage. Tidy the `-1` seed
    // in crc32 to a `0` — it reads like a stray initialiser — and every chunk
    // in both PNGs is corrupt, the .ico is undecodable, and nothing else in
    // this file notices.
    const png = encodePng(16, renderRgba(16));
    expect(png.subarray(png.length - 12).toString("hex")).toBe("0000000049454e44ae426082");
  });
});

describe("encodeIco", () => {
  it("declares one directory entry per image", () => {
    const ico = buildIco();
    expect(ico.readUInt16LE(0)).toBe(0); // reserved
    expect(ico.readUInt16LE(2)).toBe(1); // type 1 = icon
    expect(ico.readUInt16LE(4)).toBe(SIZES.length);
  });

  it("points every entry at a real PNG", () => {
    const ico = buildIco();
    SIZES.forEach((size, index) => {
      const entry = 6 + index * 16;
      expect(ico.readUInt8(entry)).toBe(size); // width
      expect(ico.readUInt8(entry + 1)).toBe(size); // height
      expect(ico.readUInt16LE(entry + 6)).toBe(32); // bits per pixel

      const length = ico.readUInt32LE(entry + 8);
      const offset = ico.readUInt32LE(entry + 12);
      expect(ico.subarray(offset, offset + 8)).toEqual(PNG_SIGNATURE);
      expect(offset + length).toBeLessThanOrEqual(ico.length);
    });
  });

  it("lays the payloads out back to back after the directory", () => {
    const ico = encodeIco([
      { size: 16, png: Buffer.from("aaaa") },
      { size: 32, png: Buffer.from("bbbbbb") },
    ]);
    expect(ico.readUInt32LE(6 + 12)).toBe(6 + 32);
    expect(ico.readUInt32LE(6 + 16 + 12)).toBe(6 + 32 + 4);
    expect(ico).toHaveLength(6 + 32 + 4 + 6);
  });
});

/**
 * Every IDAT payload in a PNG, concatenated, found by walking the chunk list.
 *
 * The offsets are computable — IHDR's payload is fixed at 13 bytes, so the
 * first IDAT's data begins at 8 + 25 + 8 — and doing that arithmetic inline
 * would be shorter. It would also quietly assume the two things this test is
 * here to check somebody else's work on: that there is exactly one IDAT, and
 * that no chunk was ever inserted ahead of it. The format permits an encoder to
 * split the deflate stream across any number of IDATs and to emit ancillary
 * chunks between them, so a decoder walks; this walks. Four lines, and it
 * cannot silently start reading the wrong bytes.
 */
function idatPayload(png: Buffer) {
  const parts: Buffer[] = [];
  // Past the 8-byte signature. Each chunk is length(4) + type(4) + data + crc(4).
  for (let offset = 8; offset < png.length; ) {
    const length = png.readUInt32BE(offset);
    const type = png.subarray(offset + 4, offset + 8).toString("ascii");
    if (type === "IDAT") parts.push(png.subarray(offset + 8, offset + 8 + length));
    offset += 12 + length;
  }
  return Buffer.concat(parts);
}

describe("src/app/favicon.ico", () => {
  /**
   * The committed binary, checked against the generator that claims to produce
   * it. Everything else in this file tests buildIco's return value, which is
   * not the artefact the browser loads — and nothing runs `yarn favicon` but a
   * developer remembering to. There is no CI here and no prebuild hook.
   *
   * That leaves exactly one ordering uncovered, and it is the natural one:
   * change GEOMETRY, update the pin at the top of this file, update icon.svg,
   * and forget the generator. The drift guard passes, the geometry pin passes,
   * every pixel probe passes — they all read the same constant — and the .ico
   * on disk still draws the old mark. It is also the claim the design doc rests
   * the generator's existence on, that the icon is "derived and checkable
   * instead of asserted". Derived it was; this is the checkable half.
   *
   * The comparison is by decoded pixel, not by byte. deflateSync is
   * deterministic within one zlib build, but its output has changed across the
   * zlib versions Node bundles, so asserting the compressed bytes would make a
   * Node upgrade fail as a diff in a file nobody touched. The pixels are what
   * has to match; how they were spelled on the way to disk is not.
   */
  it("holds the bytes the generator would write today", () => {
    const disk = readFileSync(new URL("../src/app/favicon.ico", import.meta.url));
    expect(disk.readUInt16LE(4)).toBe(SIZES.length);

    SIZES.forEach((size, index) => {
      const entry = 6 + index * 16;
      expect(disk.readUInt8(entry)).toBe(size);
      const offset = disk.readUInt32LE(entry + 12);
      const png = disk.subarray(offset, offset + disk.readUInt32LE(entry + 8));

      // The inflated stream is one filter byte plus one RGBA scanline per row.
      const stride = size * 4;
      const raw = inflateSync(idatPayload(png));
      expect(raw).toHaveLength((stride + 1) * size);

      const expected = renderRgba(size);
      for (let y = 0; y < size; y++) {
        const row = y * (stride + 1);
        // Filter type None on every scanline, which is what encodePng writes —
        // and what makes the slice below directly comparable to the render.
        expect(raw[row]).toBe(0);
        expect(raw.subarray(row + 1, row + 1 + stride)).toEqual(
          expected.subarray(y * stride, (y + 1) * stride),
        );
      }
    });
  });
});

describe("icon.svg", () => {
  const svg = () => readFileSync(new URL("../src/app/icon.svg", import.meta.url), "utf8");

  /**
   * The vector and the raster are two encodings of one mark. Nothing but this
   * test stops someone nudging the SVG and shipping a favicon.ico that no
   * longer matches it — the drift would only ever show up as a tab icon that
   * looks subtly wrong next to the bookmark bar.
   *
   * Matching on exact attribute strings makes this brittle to reordering, on
   * purpose: reformatting the SVG should make you re-read this test.
   */
  it("is built from the same geometry as the .ico", () => {
    const source = svg();
    expect(source).toContain(`viewBox="0 0 ${GEOMETRY.viewBox} ${GEOMETRY.viewBox}"`);
    // The tile as one contiguous match rather than a loose `rx` and a loose
    // fill. Full bleed at viewBox×viewBox is part of the design — anything
    // smaller leaves a transparent margin the rasteriser does not draw — and
    // free-floating substrings assert only that the numbers appear SOMEWHERE
    // in the file, which a 30×30 tile satisfies as happily as a 32×32 one.
    expect(source).toContain(
      `x="0" y="0" width="${GEOMETRY.viewBox}" height="${GEOMETRY.viewBox}" rx="${GEOMETRY.radius}" fill="${GEOMETRY.tile}"`,
    );
    for (const rect of GEOMETRY.rects) {
      // The fill is part of the geometry here, not decoration. Matched without
      // it, this loop is blind to the worst drift the file allows: recolour the
      // figure to the tile colour and the SVG renders as a blank teal square
      // while the .ico still carries the mark — same coordinates, same widths,
      // test green. Browsers that prefer the SVG would show nothing at all.
      expect(source).toContain(
        `x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}" fill="${GEOMETRY.figure}"`,
      );
    }
  });

  it("makes no external reference", () => {
    // The page promises it issues no third-party request. An icon is a place
    // that promise could quietly break — a <use xlink:href> or a webfont pulled
    // in by @import inside <style> both look innocuous in a diff.
    //
    // xmlns declarations are stripped before the scan rather than exempted by
    // the pattern. The SVG namespace is spelled as an http URL and is REQUIRED
    // on a standalone .svg — a file served as image/svg+xml is parsed as XML,
    // and without the declaration it is not SVG and does not render. It is an
    // identifier, never fetched. Removing just those attributes keeps every
    // other http(s): in the file a failure, which is the whole point.
    const source = svg().replace(/\sxmlns(:\w+)?="[^"]*"/g, "");
    expect(source).not.toMatch(/https?:|xlink:href|<image|@import/);
  });
});
