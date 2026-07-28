# SEO and Web Vitals — design

**Date:** 2026-07-28
**Status:** approved

Two tracks. The SEO track ships. The Web Vitals track produces a measurement and
stops at a gate — no performance fix is committed on the strength of the numbers
already in the README.

---

## The decision that had to come first

Every route on this site was `robots: { index: false, follow: false }`, set
deliberately in `src/app/layout.tsx` with a rationale worth quoting: a convincing
account-opening form for a brokerage that does not exist, asking for a date of
birth, a taxpayer number and a photograph of a passport, should not rank for
"open a brokerage account" — the demo banner would be the only thing separating
it from a phishing page, and a hurried visitor may not register it.

**That decision is reversed. Every route is now indexable.** The reversal was
made by the repo owner with the original rationale in front of them.

The concern was not dismissed, it was engineered around. Indexing is paired with
three measures that make the search result unambiguous about what this is:

1. **Every title names the author, not the fictional broker.** A search result
   reads `Step 3: Tax residency — KYC demo by Youssef Nessafe`, never `Tax
   residency — Meridian Markets`.
2. **Every description leads with the demo disclaimer.** The snippet under the
   title says it is a portfolio demonstration and that nothing entered is sent
   anywhere, before it says anything else.
3. **The structured data types the page as source code by a person.**
   `SoftwareSourceCode` with an `author` of `@type: Person` — deliberately not
   `Organization` and not `FinancialService`. JSON-LD is the one place a crawler
   asks "what kind of thing is this", and it gets an answer that cannot be
   confused with a broker.

The non-dismissible demo banner stays exactly as it is. Nothing about the
in-product experience changes.

---

## Track 1 — SEO

### Architecture

Metadata is derived from the route table, not written out beside it. This is the
same rule `src/config/routes.ts` already follows: it builds paths from
`STEP_SLUGS` so the landing page and the router cannot disagree about where step
one is. A hand-listed sitemap would reintroduce precisely the drift the rest of
the repo works to prevent.

**New files**

| File | Job |
|---|---|
| `src/config/seo.ts` | `SITE_URL`, author and brand strings, `absoluteUrl(path)`, `INDEXABLE_ROUTES`, `metadataForStep(slug)`, the JSON-LD builder |
| `src/config/seo.test.ts` | Drift guard between the route table, the sitemap and the metadata |
| `src/app/robots.ts` | `Allow: /` plus a sitemap pointer in production; `Disallow: /` everywhere else |
| `src/app/sitemap.ts` | Built from `INDEXABLE_ROUTES` |
| `src/app/opengraph-image.tsx` | 1200×630 card via `next/og`, generated at build time |
| `e2e/seo.spec.ts` | `/robots.txt` and `/sitemap.xml` resolve; `/` carries canonical and `og:image` |

**Changed files**

- `src/app/layout.tsx` — the `robots` override is removed and `metadataBase`,
  the new title template, and default `openGraph`/`twitter` blocks take its
  place. The comment justifying the noindex is replaced by one recording the
  reversal and its mitigations, not deleted.
- `src/app/page.tsx` — its own title, description and canonical, plus the
  JSON-LD `<script>`.
- `src/app/apply/[step]/page.tsx` — `generateMetadata` already exists and
  returns a bare title; it now returns the full per-step block from
  `metadataForStep`.
- `README.md` — two places assert the noindex (the demo-safety table and the
  repo map). Both change with the code, or the repo starts lying.
- `docs/plans/2026-07-28-favicon-design.md` — two references to the noindex,
  amended in place with a dated note rather than rewritten.

### What the metadata says

Root title template `%s — KYC demo by Youssef Nessafe`; root default
`Jurisdiction-aware KYC onboarding — Youssef Nessafe`.

| Route | Title |
|---|---|
| `/` | Jurisdiction-aware KYC onboarding — Youssef Nessafe |
| `/apply/account-type` | Step 1: Account type — KYC demo by Youssef Nessafe |
| `/apply/personal-details` | Step 2: Your details — … |
| `/apply/tax-residency` | Step 3: Tax residency — … |
| `/apply/documents` | Step 4: Documents — … |
| `/apply/review` | Step 5: Review and submit — … |

Step names come from `STEP_TITLES` and the number from the `STEP_SLUGS` index, so
renaming or reordering a step carries into the title with no second edit.

Descriptions are five hand-written strings, one per step, each naming what that
step demonstrates and closing with the disclaimer. They are written, not
templated: a generated description says nothing a crawler or a human can use.

### Preview deployments

Once the site-wide noindex is gone, every Vercel preview URL becomes indexable
and competes with production for identical content. `robots.ts` therefore reads
`VERCEL_ENV` and serves `Disallow: /` for anything that is not `production` —
including local development, where the variable is absent. Without this, turning
indexing on makes the ranking worse rather than better.

### Failure modes

- `generateMetadata` receives a slug that is not a step. The page 404s, but
  metadata is computed first, so `metadataForStep` returns a safe fallback
  instead of throwing — a metadata crash would turn a clean 404 into a 500.
- A route missing from the sitemap. Impossible by construction; that is what
  deriving it buys.
- The OG image fails to build. The build fails loudly, which is correct.
- No new environment variable is required. `SITE_URL` is a constant and
  `VERCEL_ENV` is read defensively.

### Tests

`src/config/seo.test.ts` asserts:

- the sitemap covers exactly `INDEXABLE_ROUTES`, in both directions
- every emitted URL is absolute and under `SITE_URL`
- every `STEP_SLUG` has a non-empty, unique title and description
- every description carries the demo disclaimer
- `robots.ts` disallows everything unless `VERCEL_ENV === "production"`

`e2e/no-data-egress.spec.ts` must stay green untouched. The OG image is a
build-time, same-origin asset, so it should — and if it does not, that is a real
finding rather than a test to relax.

---

## Track 2 — Web Vitals

### Why measurement comes before any fix

The README already reports Lighthouse mobile medians of 98 on `/` and 89 on
`/apply/account-type`, and it is honest about why that second number is soft: the
run-to-run spread was 79 to 91, wider than the distance to the target, and FCP
was bimodal at roughly 1.1 s and 3.0 s. A conclusion drawn from single runs is
what made the last two candidate fixes arguable enough to reject.

So the tooling that lands first is the tooling that was missing: something that
runs N times and reports the spread, not one run and a number.

### `scripts/measure.mjs`

`node scripts/measure.mjs <url> [--runs=5]`

- Drives Lighthouse through `lighthouse` and `chrome-launcher`, mobile form
  factor, default simulated throttling — the same settings the README quotes, so
  the new numbers are comparable to the old ones.
- Reports **median, min and max** for the performance score, FCP, LCP, TBT, CLS
  and transfer size.
- Writes a markdown table to `docs/perf/<date>-baseline.md` and prints it.

Honest limit: Lighthouse is a lab tool, so there is **no INP**. TBT stands in for
it. Field data was considered and ruled out — a `web-vitals` beacon or Vercel
Speed Insights would POST a body from the page, which fails
`e2e/no-data-egress.spec.ts` and falsifies the landing page's claim that nothing
phones home. Those two are worth more than an INP number from a demo with a
handful of visitors.

### Bundle composition

`@next/bundle-analyzer` wired into `next.config.ts` behind `ANALYZE=1`, inert in
a normal build. This names the contents of the 291 KiB client chunk instead of
inferring them. The README fingers `react-phone-number-input`'s 250-flag SVG
barrel, imported wholesale by both `CountryField` and `PhoneField`; the analyzer
either confirms that or finds the real culprit.

`cross-env` is added because `ANALYZE=1 next build` is a POSIX-ism that fails in
PowerShell, which is one of the two shells this repo is developed in.

All four additions — `lighthouse`, `chrome-launcher`, `@next/bundle-analyzer`,
`cross-env` — are devDependencies. Nothing reaches the client bundle, the
no-egress guard is untouched, and the "no analytics, nothing phones home" claim
stays true.

### The gate

The report lands as a committed document. Fixes are chosen from it afterwards,
in a separate plan. Candidates already on the board, none of them committed to:

- per-country lazy flags, replacing the wholesale flag barrel — the earlier
  experiment stubbed the flags out entirely and was rejected for deleting them
  from a form whose subject is which country you live in
- `next/dynamic` on the heavy field types (calendar, combobox, dropzone, phone),
  so step one stops paying for step four's controls

---

## Sequencing

1. This design document.
2. The SEO layer, its tests, and the documentation that asserts the old
   behaviour.
3. The measurement tooling — devDependencies, `scripts/measure.mjs`, the
   analyzer. No `src/` change.
4. Push to `main`, wait for the deployment, run the measurement against
   `https://kyc-six.vercel.app/`, commit the report.
5. **Gate.** Read the report, then decide.

Verification before any completion claim: `yarn lint`, `yarn typecheck`,
`yarn test`, `yarn build`, `yarn test:e2e`, then fetch `/robots.txt` and
`/sitemap.xml` from the deployment and read the rendered `<head>`.

## Out of scope

`docs/plans/2026-07-28-favicon-design.md` skipped `apple-icon` and a web manifest
*because* the demo was not indexed. Indexing changes that calculus — a search
result and a mobile bookmark both want them. Left out deliberately rather than
folded in quietly; it is a decision for after this lands.
