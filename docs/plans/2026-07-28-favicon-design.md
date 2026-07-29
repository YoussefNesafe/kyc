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
does not exist, and the crawler-facing surface names the author rather than the
brokerage. (Amended 2026-07-28: this sentence originally read "the site is
withheld from crawlers on both `index` and `follow`", which stopped being true
later the same day. The conclusion is unchanged — the disambiguation moved from
hiding the site to labelling it.) The icon does not need to carry a fourth copy of a message that is
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
| Vertical | `x 16→20`, `y 4→28` | 2px wide, 12px tall |
| Crossbar | `x 6→20`, `y 18→22` | 2px tall, 7px long |

Every `x` is even, and decision 3 below is why.

Three decisions inside those numbers:

1. **The crossbar terminates at the vertical rather than crossing it.** This is
   the whole defence against the failure mode this concept has: a symmetric
   crossbar is a close button or a medical cross. A left-only tick is a datum.
2. **The crossbar sits at ~62% of the height, not 50%.** Below optical centre,
   so it reads as a measured position rather than a midpoint.
3. **The vertical is at `x 16→20`, two pixels right of true centre on the 32
   grid — which is exactly one pixel at 16px.** The left-only crossbar makes the
   figure left-heavy; this pays it back. Optical centring, not geometric.

   This coordinate was corrected after it was drawn. The first attempt was
   `x 15→19`, picked as "one pixel right of centre" on the 32 grid and never
   rendered at 16 before it was written down. It halves to `7.5→9.5`, which
   straddles a pixel boundary; a real 16px render measured columns 7, 8 and 9 as
   `135,174,173` / `255,255,255` / `135,174,173` — the stroke smeared across
   three columns at partial alpha instead of occupying two cleanly. That
   falsified the argument this concept was selected on two sections above, that
   nothing in the mark goes soft at 16px, and it did so in the mark's single
   most prominent element.

   `16→20` states the same optical intent one grid down, where it actually
   lands: both edges fall on whole pixels at 16 and at 32. The general rule is
   the even coordinate, not this specific number — an odd `x` on a 32 grid is a
   half-pixel at 16 by construction. `build-favicon.test.ts` asserts the 16px
   columns directly so the correction cannot be tidied back out.

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

## Outcome

Verified 2026-07-29 against a production build served by `yarn start`, in Chrome.

`yarn lint`, `yarn typecheck` and `yarn build` all clean; `yarn test` at 211
passing (209 when this was first recorded; a review afterwards added two tests,
covered below). `src/app/favicon.ico` went from the 25,931-byte scaffold default to
307 bytes — the mark is flat colour, so it deflates hard.

Both tags reach the head, though not in the shape the plan predicted:

```html
<link rel="icon" href="/favicon.ico?…" sizes="32x32" type="image/x-icon"/>
<link rel="icon" href="/icon.svg?…" sizes="any" type="image/svg+xml"/>
```

The plan expected `sizes="any"` on the `.ico` from reading `app-icons.md`. Next
in fact opens the file and derives `32x32` from the largest frame it finds. Not
a problem, but the documented behaviour and the observed behaviour differ, and
the observed one is what ships.

**The mark reads correctly at 16px.** Rendered from both served assets and
compared pixel by pixel, the two encodings are identical: the vertical occupies
columns 8–9, the crossbar columns 3–9, and no pixel in the figure is a partial
blend. It reads as a datum. It does not read as a plus sign or a close button,
which was the one risk the geometry was chosen to defend against.

### The geometry was wrong first, and measuring is what caught it

The vertical originally sat at `x 15→19`. That halves to `7.5→9.5`, so at 16px
it straddled the pixel grid and rendered as one solid column flanked by two
half-strength blends — `135,174,173` either side of white. The coordinate had
been chosen for optical balance without ever being rendered at the size the
whole concept was justified on. It moved to `x 16→20`, which expresses the same
one-pixel offset on the 16 grid instead of the 32 grid.

There is a second payoff nobody planned for. Chrome loaded the **32px** frame
out of the `.ico` and downscaled it to 16 itself, rather than taking the 16px
frame that is sitting right there. That path survives crisp only because every
coordinate is even — the same fix, paying out somewhere the design never
considered.

Claimed for Chrome only, because that is the only browser this was watched in,
and the `sizes="32x32"` recorded above is part of why: Next derives that hint
from the largest frame in the file, so the `<link>` itself points a browser at
the 32px one. A bare `/favicon.ico` request carries no hint and sees both
frames. Which frame any given browser picks under which conditions was not
established here; that the even geometry holds up when one is downscaled was.

### Still not verified

Safari's SVG-favicon support. The design declined to guess at it and the guess
was never made; the `.ico` is what makes the question moot, and it is confirmed
decoding correctly under Windows WIC as two `Bgra32` frames. Anyone testing on
Safari should record what they see here.
