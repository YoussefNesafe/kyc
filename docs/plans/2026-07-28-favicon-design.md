# Design: Meridian Markets favicon

**Date:** 2026-07-28
**Status:** Approved

The tab icon is still the Next.js scaffold default, untouched since `0718004`.
It is the last stock asset in a project where every other surface was decided
deliberately, and it is the one the visitor sees first — the tab renders before
the page does.

This replaces it with a drawn mark.

## Decisions

| Area | Decision |
|---|---|
| Source | Mark drawn for this project. No supplied artwork, no third-party asset. |
| Demo signalling | None in the icon. The banner carries it. (Amended 2026-07-28: this row originally also cited `robots: noindex, nofollow`, which was reversed later the same day — see `2026-07-28-seo-and-web-vitals-design.md`. The banner still carries it; the search result is now disambiguated by titles and JSON-LD instead.) |
| Concept | "Meridian datum" — a full-height vertical stroke met by a shorter crossbar. |
| Colour | `--primary` `#0F5C5A` tile, `--primary-foreground` white figure. |
| Files | `src/app/icon.svg` (primary) + `src/app/favicon.ico` (fallback, regenerated). |
| `.ico` production | `scripts/build-favicon.mjs`, zero dependencies, `node:zlib` only. |
| Not shipping | `apple-icon`, `manifest`. |

## The trust-signal question, and why the answer is "none"

A favicon is a trust signal, and it reaches places the demo banner cannot: the
tab strip, bookmarks, history. `layout.tsx` already names the risk this project
carries — the banner is the only thing between a convincing account-opening form
and a phishing page.

The considered alternative was a mark with a deliberate tell in its geometry: a
dashed or incomplete stroke, reading as intentional design at 32px and as "not a
real product" to anyone who looks closer.

Rejected in favour of a clean mark. The banner sits above every route as the
first child of `<body>`, the page states twice in prose that Meridian Markets
does not exist, and the site is withheld from crawlers on both `index` and
`follow`. The icon does not need to carry a fourth copy of a message that is
already unavoidable on screen, and the portfolio piece is better for a mark that
is not compromised.

Recorded because it was a close call, not because it was an obvious one.

## The mark

A meridian is both a line of longitude and the point at which something stands
highest. The mark takes the surveying reading: a datum, a fixed reference
against which a position is measured. That is nearer to what the product does —
jurisdiction, residency, verification against a rule — than a globe would be,
and a globe is the reflex gesture for anything financial.

Two concepts were drawn and set aside:

- **Meridian arc.** A circle with one vertical lens through it. The most literal
  reading of the name, and the shape most likely to mush at 16px — concentric
  curves with thin gaps between them are exactly what small raster sizes destroy.
- **M counterform.** The monogram convention actual brokerages use. Four strokes
  and three gaps is the legibility floor at 16px, and its diagonals antialias
  soft where an axis-aligned stroke stays crisp.

Both lost to the same argument: **16px is the real canvas.** The datum is built
from two axis-aligned rectangles. Nothing in it curves, nothing in it runs
diagonal, and so nothing in it goes soft when the rasteriser has 16 pixels to
work with.

### Geometry

A 32×32 viewBox. Halve every number for the rendered 16px case.

**Tile** — `#0F5C5A`, full bleed, `rx="3"`.

**Figure** — `#FFFFFF`. The `--primary-foreground` comment already asserts 7.8:1
on this accent, so the knockout inherits a ratio `theme.test.ts` guards.

| Element | Geometry | At 16px |
|---|---|---|
| Vertical | `x 15→19`, `y 4→28` | 2px wide, 12px tall |
| Crossbar | `x 6→19`, `y 18→22` | 2px tall, 6.5px long |

Three decisions inside those numbers:

1. **The crossbar terminates at the vertical rather than crossing it.** This is
   the whole defence against the failure mode this concept has: a symmetric
   crossbar is a close button or a medical cross. A left-only tick is a datum.
2. **The crossbar sits at ~62% of the height, not 50%.** Below optical centre,
   so it reads as a measured position rather than a midpoint.
3. **The vertical is at `x 15→19`, one pixel right of true centre.** The
   left-only crossbar makes the figure left-heavy; this pays it back. Optical
   centring, not geometric.

`rx="3"` is proportional, not literal. `--radius` is 3px against card-sized
elements, where it reads as a hairline softening; 3px on a 32px tile lands at
1.5px rendered, which is that same softening at this scale rather than a copied
number.

## Delivery

`src/app/icon.svg` and `src/app/favicon.ico` are separate Next file conventions
(`app-icons.md`, Next 16.2.12). Both are emitted as `<link rel="icon">` and the
browser chooses. The scaffold `favicon.ico` therefore cannot simply be left in
place and ignored — it is not dormant, it is an actively served competing icon.

`apple-icon` and `manifest` are not shipped. A `noindex` demo linked from a
profile does not get added to a home screen.

> **Amended 2026-07-28.** The site is no longer `noindex`, so the premise of that
> last sentence is gone. Whether an indexed demo earns an `apple-icon` and a
> manifest is deliberately left open rather than decided here — see the "Out of
> scope" section of `2026-07-28-seo-and-web-vitals-design.md`.

### Theme handling is a non-issue

A solid tile with a knocked-out figure carries its own background, so the mark
holds on a light tab strip and a dark one alike. No `prefers-color-scheme` block
inside the SVG, no second asset, no `.dark` coupling. This is the filled-tile
decision paying for itself.

### Building the `.ico`

`scripts/build-favicon.mjs`, no new dependency. The mark is two axis-aligned
rectangles, so rasterising 16px and 32px in plain JS is arithmetic; `node:zlib`
is built in and does the PNG compression; the ICO container is a header and two
entries.

Two reasons over adding `sharp` or `png-to-ico`:

- `check-engine-boundary.mjs` established the precedent. This repo writes the
  small tool rather than taking the dependency.
- It fixes what is wrong with committing any `.ico`: a binary blob is the one
  file in the tree a reviewer cannot read in a diff. Generated from a committed
  script, the icon is derived and checkable instead of asserted.

The alternative of shipping SVG alone was rejected for a second, independent
reason: current Safari's SVG-favicon support was not verified and will not be
guessed at. The `.ico` makes the question moot whatever the answer is, and it
also answers the blind `/favicon.ico` requests that arrive with no `<link>` tag
to guide them.

## Verification

- `yarn build` succeeds.
- Both `<link rel="icon">` tags appear in `<head>`.
- The mark renders in a real browser tab at 16px, and does not read as a plus
  sign or a close button. This is the one risk the geometry is defending
  against, so it is checked by eye rather than assumed.
- `yarn lint`, `yarn typecheck` and `yarn test` stay green.
