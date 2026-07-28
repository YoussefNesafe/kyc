# Meridian Markets — KYC onboarding

A five-step account-opening flow for a fictional brokerage. The questions change
with where you live and how you are applying — a German applicant is asked for a
masked eleven-digit Steuer-Identifikationsnummer and whether they pay church tax,
an American gets a searchable state list fed by the country field above it, an
Emirati gets a `784-####-#######-#` Emirates ID and a note explaining there is no
personal taxpayer number to give.

**None of that branching is written in a component.** It is three jurisdiction
files plus a fallback, and one line in a registry. Adding a fourth country
touches no JSX at all — the claim is worked through in
[Adding a jurisdiction](#adding-a-jurisdiction) with the real `de.ts`, not a toy.

> **Demo only.** Nothing typed here is sent anywhere, no file is uploaded, and
> there is no server. That is not a promise in a README — see
> [Demo safety, and what enforces it](#demo-safety-and-what-enforces-it) for the
> tests that fail if it stops being true.

**Live:** <https://kyc-six.vercel.app/>
**Package manager:** `yarn`. (Not `pnpm` — there is one lockfile and it is
`yarn.lock`.)

```bash
yarn install
yarn dev          # http://localhost:3000

yarn test         # vitest — 15 files, 194 tests
yarn test:e2e     # playwright — keyboard completion, a data-egress guard, crawler output
yarn typecheck    # tsc --noEmit
yarn lint         # eslint + scripts/check-engine-boundary.mjs
yarn build

yarn measure <url> [--runs=5] [--out=file]   # Lighthouse, median + spread
yarn analyze                                  # build with the bundle treemap
```

`yarn test:e2e` runs against a **production build**, because the things it
asserts — no network egress, keyboard reachability, real minified React — are
properties of the shipped bundle and dev-mode overlays mask them. Playwright's
`webServer` will run `yarn build && yarn start` for you; `reuseExistingServer` is
on outside CI, so if you already have `yarn start` running it is reused instead
of costing you a rebuild.

---

## What this demonstrates

- **Jurisdiction-conditional fields** across two axes — `country` × `accountType`
  (individual / corporate) — resolved declaratively, with a fallback config for
  the other 242 ISO codes, which have no bespoke rules.
- **One schema, two sides.** The same `FormConfig` that renders the form also
  validates a submission server-side, including recomputing which fields were
  even *visible* for those answers. `src/server/parseApplication.example.ts` is
  real, typechecked code proving it — deliberately wired to nothing.
- **Resumable progress.** Autosave to `sessionStorage`, restore-and-say-so, and
  file *metadata* only: a `File` handle cannot be persisted, so the visitor is
  told to re-choose rather than silently losing an upload.
- **Per-file document validation.** A `.tiff` on a JPG/PNG/PDF field is rejected
  by name with its format spelled out, no upload is ever started for it, and its
  neighbours in the same drop are judged independently.
- **Route-per-step without remounting the form.** `/apply/[step]` with the
  form living in the layout above the dynamic segment, so react-hook-form state
  survives navigation, Back works, and deep links past your progress redirect.
- **Keyboard-complete and WCAG-conscious throughout**, asserted by a Playwright
  spec that fills and submits the entire application without a mouse.

---

## The architecture decision: a field registry, and one config

### Why config-driven rather than per-step JSX

The naive shape for a form like this is a component per step with conditionals
inside it. That works until the second country, and then the branching lives in
three places at once: the JSX that renders the field, the Zod schema that
validates it, and whatever the server does with the payload. The three drift.
The failure mode is a required field that renders but is not validated, or is
validated but never rendered.

So every step, field and jurisdiction rule here is **data**. The engine derives
the schema, the visible field set and the submission payload from the same
declaration, on the client and on a server. There is no per-step JSX in this
repo at all.

### The registry

The engine has no built-in `switch (field.type)`. `renderField` looks the type
up in a `Symbol.for`-keyed global map, and there is exactly one place in this
repo that populates it — `src/fields/registerBuiltInFields.ts`. Two consequences
worth having:

1. **The host decides which field types its bundle pays for.** The engine ships
   a signature pad, an OTP input and a rating control; this demo installs none of
   them, so none of them are in the bundle.
2. **Replacing a component is one line, not a fork.** `registerField("file", Document)`
   swaps the engine's file field for `src/fields/document.tsx` everywhere in the
   config at once. See [Adding a field type](#adding-a-field-type).

### One config, not a rebuild per country

Every jurisdiction's fields live in a single `FormConfig` simultaneously, each
guarded by a `visibleWhen`. The obvious alternative — `buildFormConfig(country)`,
rebuilt whenever the country changes — is wrong here for a reason that comes out
of the engine:

`draftConfigHash` hashes `config.fields`, and `loadDraft` discards any draft
whose hash does not match. A config rebuilt on every country change hashes
differently every time, so a visitor who changed their mind about the country
would **silently lose everything they had typed**. Keeping one config makes
changing country a value change rather than a structural one, and hands
visibility back to the engine, which already strips hidden fields from both the
schema and the payload for free.

The cost is a larger config object in memory. It never reaches a network.

---

## Adding a jurisdiction

Two edits. Here is the whole of Germany, from
[`src/config/jurisdictions/de.ts`](src/config/jurisdictions/de.ts) — abridged
only by dropping its `corporate` branch and some prose:

```ts
import type { Jurisdiction } from "./types";

export const de: Jurisdiction = {
  code: "DE",
  label: "Germany",

  individual: {
    taxFields: [
      {
        type: "masked",
        name: "de_steuerId",
        label: "Steuer-Identifikationsnummer",
        mask: "## ### ### ###",
        required: true,
        description: "Eleven digits, issued once and for life by the Bundeszentralamt für Steuern.",
        message: "A Steuer-Identifikationsnummer is eleven digits.",
      },
      {
        type: "radio",
        name: "de_churchTax",
        label: "Church tax (Kirchensteuer)",
        required: true,
        description:
          "German brokers withhold church tax alongside the flat capital-gains tax, so the answer changes what is deducted at source.",
        options: [
          { label: "Yes — I belong to a religious community that levies it", value: "member" },
          { label: "No — I do not", value: "none" },
          { label: "Prefer not to say — treat me as liable", value: "undisclosed" },
        ],
      },
    ],
    documentFields: [
      {
        type: "file",
        name: "de_meldebescheinigung",
        label: "Meldebescheinigung",
        required: true,
        accept: ".pdf,.jpg,.jpeg,.png",
        maxSizeMB: 5,
        description: "The registration certificate from your Einwohnermeldeamt, dated within the last three months.",
      },
    ],
  },

  corporate: { /* USt-IdNr, registering Amtsgericht, Handelsregisterauszug */ },
};
```

And the second edit, in
[`src/config/jurisdictions/index.ts`](src/config/jurisdictions/index.ts):

```ts
export const JURISDICTIONS: readonly Jurisdiction[] = [de, us, ae];
```

That is it. **No component, no route, no schema and no test is touched.**

### What the file deliberately does not contain

Read it again and notice the absences. There is no `visibleWhen` anywhere, and
no `badge`. Those are stamped by
[`buildFormConfig`](src/config/buildFormConfig.ts), which knows nothing about
Germany:

```ts
// what the builder adds to every field above
visibleWhen: [
  { field: "country", equals: "DE" },
  { field: "accountType", equals: "individual" },
],
badge: "Required in Germany",   // or "Only asked in Germany" when not required
```

The grouping keys are the whole trick: `individual`/`corporate` says which
account type, `taxFields`/`documentFields` says which step, and those two facts
*are* the guard. A jurisdiction file that wrote its own condition could get it
wrong; one that cannot express a condition cannot.

The fallback config falls out of the same registry rather than being maintained
alongside it. Its country guard is a single `in` over every ISO code
`JURISDICTIONS` does not claim, derived from `getCountries()` — so adding a
country automatically makes the fallback stand aside for it, and forgetting to
is not a reachable mistake.

<details>
<summary>Why <code>in</code> rather than a <code>notEquals</code> per configured country</summary>

Both express "not one of ours". Only one of them handles an *unchosen* country
correctly: an untouched `country` field holds `undefined`, which is not **in**
the list but is also not **equal** to any entry in it. Under `notEquals` the
three fallback fields were visible and required before the visitor had picked
anything, so pressing Continue on an empty tax step named three fields that
vanish on the next click.

</details>

### The rules a new file has to respect

- **Field names are one flat namespace** shared with every other jurisdiction,
  because they are all composed into one config. Prefix with the lowercased code
  (`de_steuerId`, `us_tin`); `buildFormConfig`'s test catches a collision.
- **The engine's `baseFieldSchema` is a `z.strictObject`.** An unrecognised
  property makes `validateFormConfig` throw at runtime, not at compile time.
- **A field with no `label` gets no badge** — `badge` joins the label's
  accessible name, and `static`/`hidden` render no label to join.
- **Five steps, always.** Branching is field-level `visibleWhen` inside the fixed
  five; the engine's stepper store is sized once per mount, and the route table
  is static so `generateStaticParams` stays honest.

---

## Adding a field type

The honest version of this story is more interesting than the one the plan
assumed, so here it is with the mistake left in.

[`src/fields/document.tsx`](src/fields/document.tsx) is the demo's own upload
field: the engine's `FileDropzone`, its per-file verdicts, and a simulated
upload bar on top. It is registered like this
([`registerBuiltInFields.ts`](src/fields/registerBuiltInFields.ts)):

```ts
const Document = withFormHandle(DocumentField);
// ...
registerField("file", Document);
```

Note the type string: **`file`**, not `document`. It replaces the engine's own
file field rather than adding a new type beside it — and that was a correction,
not the original plan.

### Why not a `document` type of its own

The engine *does* accept custom types: `validateFormConfig` allows any `type`
that is in the registry. What it will not do is validate them.
`buildFieldsSchema` hands every non-built-in field `z.unknown().optional()`
(`core/validation.ts:468`).

For these particular fields that is a silent catastrophe. Moving the identity
document onto a custom type would drop `required`, `accept` and `maxSizeMB`
together: the required photo ID would stop gating Submit, and a `.tiff` would be
accepted without a word. It would also remove the component's own foundation —
every per-file verdict it renders is read out of react-hook-form's *per-index*
errors, and those exist only because the built-in schema raised one issue per
index. Under a custom type there would be nothing to read, and the only way back
would be to judge files inside the component, which is exactly what the engine
keeps `fileMatchesAccept` unexported to prevent.

So the general rule this repo can actually recommend is:

> **Put your own component behind a field type the engine already knows how to
> validate.** Reach for a genuinely custom `type` only when the engine has no
> comparable built-in and you are prepared to own its validation entirely.

`DocumentField` therefore borrows `FieldWrapper`, `fieldAriaDescribedBy`,
`acceptedFormatsLabel`, `useFieldDisabled` and `useFieldRuntime` from the engine
so that it is not the one field in the form whose label, error region, hint text
and disabled state drift from the others. Only two sentences in it are host copy,
and both are about the simulation.

### Where the upload lives, and why here

The progress bar is a `setInterval` counting to 100 against a duration invented
from the file's size. There is no `fetch`, no `FormData`, no object URL and no
read of a file's bytes anywhere in it. That is not the engine being incapable —
the engine documents uploading as the *host's* job, done from `onSubmit`. Where
the upload would live, its progress lives.

### The question a reviewer will ask: is `accept` enforced anywhere real?

Partly, and the boundary is deliberate.

`accept` is enforced by the **client** schema — per file, with the format named
in the message. On a server, `parseSubmission` routes every `file` field to its
`unvalidated` list instead of validating it, because a `File` does not survive a
JSON wire and the engine will not pretend it checked something it could not see.
It returns the paths by name, so the server is told exactly which fields it owns
rather than keeping its own copy of that list in step with the config.

**So: a real deployment must re-check uploaded bytes server-side.**
`documentPathsToCheck()` in
[`parseApplication.example.ts`](src/server/parseApplication.example.ts) is the
shape of that check. This demo has no server at all, which is why the gap costs
it nothing.

---

## Demo safety, and what enforces it

The banner in the root layout says nothing typed here is sent anywhere. Every
constraint below has a check attached, because a claim like that breaks by
accident — an analytics snippet, an error reporter with `beforeSend` at its
default, a `<form action>` that loses its `preventDefault` — and none of those
look like data exfiltration in a diff.

| Constraint | What enforces it |
|---|---|
| Zero requests carry form input | [`e2e/no-data-egress.spec.ts`](e2e/no-data-egress.spec.ts) — fills the whole application, attaches files, submits, and asserts no request URL or body contains any `SAMPLE_SENTINELS` string; then asserts no request had a body at all, and none went off-origin |
| No third-party requests | Same spec's off-origin assertion. Fonts are self-hosted via `next/font`, so there are none to allow |
| No server endpoint exists | `parseApplication.example.ts` is imported by nothing; there is no route handler and no server action in the repo |
| Files never leave the tab | `document.tsx` contains no `fetch`/`FormData`/`FileReader`/`createObjectURL`; drafts are sanitised by the engine, which refuses to persist `file`, `password`, `otp` and `signature` values at all |
| Drafts do not outlive the tab | `sessionStorage`, not `localStorage` — this is a public URL and a half-finished draft holds a name, a date of birth and a taxpayer number |
| The banner cannot be missed | Rendered as the first child of `<body>` in the **root** layout, above every route including the success panel — the screen most likely to be screenshotted |
| A search result cannot pass for a real broker | Indexed since 2026-07-28, having been `noindex` before it. The risk that motivated the old setting — a convincing brokerage form asking for a passport photo, ranking for "open a brokerage account" — is answered instead of avoided: every title names the author rather than the brokerage, every description leads with the disclaimer, and the page's JSON-LD types it `SoftwareSourceCode` authored by a `Person`, never an `Organization`. [`src/config/seo.test.ts`](src/config/seo.test.ts) fails if a title or description ever mentions the brand |
| Preview deployments stay out of the index | `robots.ts` serves `Disallow: /` for anything where `VERCEL_ENV` is not `production` — every preview URL serves identical content, and indexed they would compete with the canonical site for its own queries |

The sentinels are the part that makes the egress test non-vacuous. Every sample
profile is built from invented words (`Quillon`, `Tidewater`) and the reserved
`.invalid` TLD, and the spec checks a sentinel actually reached the review screen
before it makes any claim about the network — an empty form would pass the
network assertion perfectly.

Confirmed by hand as well as by the spec, **on the deployed origin**: a complete
walk in one tab — landing page, all five steps, two files attached, submit —
makes **43 requests, all GET, all same-origin**, every one a static asset, a
favicon revalidation, or a Next RSC prefetch of the five step routes. No POST at
all, no request body of any kind, and no `Set-Cookie` in any response. The same
walk against a local production build made 37; the extra six are RSC segment
prefetches and `304` favicon revalidations that the CDN's caching headers
provoke and `next start` does not.

---

## The engine, and the boundary around it

`src/form-builder/` is a vendored copy of
[`form-builder`](https://github.com/YoussefNesafe/form-builder), a config-driven
form engine that is **my own library**, installed shadcn-style through its own
CLI rather than from npm. Nine additive, backwards-compatible changes were made
to it while building this demo, each with tests, on the branch
`feat/kyc-hardening`:

| # | Change | |
|---|---|---|
| 1 | `AutosaveOptions.storage` | `"local"` \| `"session"` \| a custom `DraftStorage` |
| 2 | `accept` enforcement | validated per file, in the schema, with the format named — plus `acceptedFormatsLabel()` and six `Messages` keys |
| 3 | `date.message` | per-field text for a `minDate`/`maxDate` violation |
| 4 | `date.pickerBounds` | out-of-range days stay selectable and fail with that message |
| 5 | `BaseField.badge` | a short annotation beside a label, part of its accessible name |
| 6 | `FormRenderer` `step` / `onStepChange` | share the wizard step with a host router |
| 7 | `FormRenderer` `stepperOrientation` | a vertical left rail |
| 8 | `FormRenderer` `onDraftRestore` | surface the step a restored draft recorded |
| 9 | `FileDropzone` | drag-and-drop over a real `<input type="file">`, exported as a primitive |

The only one that changes existing behaviour is #2: `accept` used to shape the
file picker and nothing else, which a drag-and-drop bypasses entirely. It is a
minor bump under the engine's own semver contract.

The engine is never edited from this repo — changes go upstream and come back
through the CLI.

### The boundary is machine-checked

The claim is that `src/form-builder/` could be lifted out and published without a
rewrite. That is easy to assert and easy to break in a hurry: one
`import { JURISDICTIONS } from "@/config/jurisdictions"` inside a field
component, added late to make a requirement land, and the engine is a fork of
itself. Nothing about that edit looks wrong in review — it typechecks, it builds,
it ships.

So `yarn lint` runs
[`scripts/check-engine-boundary.mjs`](scripts/check-engine-boundary.mjs), which
scans every file under `src/form-builder/` and fails on:

1. **Any mention of `meridian`, case-insensitive, in file content _or_ in a
   path.** The engine must not know whose form it renders — a hardcoded label, a
   comment, a CSS class or a filename all count.
2. **Any import reaching back into demo code.** `@/components/ui/*` is the one
   allowed alias (shadcn primitives are the engine's documented foundation).
   Relative specifiers are resolved and checked too, because `../../lib/utils`
   reaches `src/lib/utils` just as surely as `@/lib/utils` does.

It exits non-zero if the engine directory is missing or empty, on the principle
that a check which cannot find what it guards must not report success. Current
output:

```
check-engine-boundary: OK — 67 file(s) in src/form-builder, no "meridian" mention
and no import reaching into demo code.
```

An ESLint `no-restricted-imports` override carries rule 2 as well, so the bad
import is red-underlined while it is being typed. It cannot express rule 1 or the
relative-path escape, which is why the script is the authority and ESLint is the
fast feedback. If the two ever disagree, the script wins.

---

## Performance: the number that sits on 90

**Lighthouse mobile against the deployed origin**, `https://kyc-six.vercel.app`,
three runs each:

| Route | Runs | Median | FCP | LCP | TBT | CLS | Transfer |
|---|---|---|---|---|---|---|---|
| `/` | 98 / 98 / 98 | **98** | 1.09 s | 2.29 s | 85 ms | 0 | 570 KiB |
| `/apply/account-type` | 79 / 90 / 89 | **89** | 1.08 s | 2.28 s | 380 ms | 0 | 581 KiB |

A confirming second set of three on the form route scored 82 / 90 / 91 (median
**90**). Over all six runs the median is 89.5, so the honest statement is that
the form route **sits on the 90 line rather than above it** — it clears the
target about half the time and the run-to-run spread (79 to 91) is wider than
the distance to the target.

The same measurement on `yarn build && yarn start`, on a machine simultaneously
running Chrome and the test runner, gave **94** on `/` and **70** on
`/apply/account-type`. Two things changed at once between those numbers and the
ones above — the origin *and* what else the measuring machine was doing — so the
+19 on the form route cannot be attributed to the deployment alone, and I am not
going to pretend it can. What can be said is that the deployed numbers are the
ones a visitor actually gets, and they are the ones quoted here for that reason.

CLS is 0 on every run of both routes, deployed and local.

**Cause, re-measured deployed.** One client chunk of **291 KiB over the wire**
(brotli; 1.09 MB raw), of which Lighthouse reports **186 KiB unused** on the
first step, and 1.2 s of main-thread work — 758 ms of it script evaluation. LCP
is **68 % render delay** and 32 % TTFB; on localhost the split was 91 % render
delay, because there was no real network latency to occupy the other third. The
shape of the problem is unchanged: the page is not waiting on the network, it is
waiting on JavaScript. The single biggest contributor is
`react-phone-number-input`'s 250-flag SVG barrel, imported wholesale by both the
engine's `CountryField` and its `PhoneField`.

**What was measured and rejected** (locally, against the 70 baseline). Stubbing
the flag barrel entirely took one run from 60 to 69; dropping the JetBrains Mono
preload on top of that reached 76. Neither shipped:

- The flag stub deletes the flags from **both** country selectors — the country
  field and the phone field — for five points. On a form whose entire subject is
  which country you live in, that is the wrong trade.
- The font delta did not survive repetition. FCP is bimodal at roughly 1.1 s /
  3.0 s whether or not mono is preloaded, so the flattering single-run reading
  was noise, and the change was reverted rather than kept with a confident
  comment attached. **That bimodality reproduced on the deployed origin**: five
  of six form-route runs landed at 0.9–1.1 s FCP and one at 2.9 s, and that one
  is the 82. The other low run, the 79, had a perfectly normal 1.1 s FCP and lost
  its points to a 3.9 s LCP instead — so the two outliers do not share a cause,
  and neither of them is worth a fix aimed at the other.

**Why the remaining gap stands.** Closing it means not shipping the form engine
to first paint — deferring the thing the demo exists to demonstrate behind a
spinner to win a synthetic score. I took the working form. Deployment has since
carried the route to the edge of the target on its own, which does not change
that judgement, only the size of what is left.

Measured with Lighthouse 12.8.2, mobile form factor, default simulated
throttling (150 ms RTT, 1.6 Mbps, 4× CPU), headless Chrome, nothing else running
on the machine. The localhost figures quoted for comparison were taken with the
same tool and settings against `yarn build && yarn start`, on a machine that was
also running Chrome and the test runner.

---

## Repo map

```
src/
├─ app/
│  ├─ layout.tsx              fonts, DemoBanner, metadataBase + title template
│  ├─ page.tsx                landing, canonical, JSON-LD
│  ├─ robots.ts               production allows; every preview disallows
│  ├─ sitemap.ts              built from the route table
│  ├─ opengraph-image.tsx     1200×630 card, generated at build time
│  └─ apply/
│     ├─ layout.tsx           FormRenderer lives HERE, so it survives [step] navigation
│     └─ [step]/page.tsx      slug → index, generateStaticParams; renders null by design
├─ form-builder/              vendored engine — never edited in this repo
├─ config/
│  ├─ jurisdictions/          de · us · ae · default · index (the registry)
│  ├─ fields/                 individual · corporate · shared
│  ├─ buildFormConfig.ts      composes one FormConfig; stamps visibleWhen + badge
│  ├─ applicationForm.ts      the built config, and the draft-reference-date freeze
│  ├─ steps.ts                the five slugs, and slug ↔ index
│  ├─ seo.ts                  titles, descriptions, sitemap and robots, from the route table
│  └─ sampleData.ts           per-jurisdiction profiles + SAMPLE_SENTINELS
├─ fields/
│  ├─ document.tsx            the demo's upload field, registered FOR `file`
│  └─ registerBuiltInFields.ts  the one registration point
├─ components/                ApplicationShell · DemoBanner · ResumedNotice · SuccessPanel
├─ server/parseApplication.example.ts   real parseSubmission code, wired to nothing
└─ lib/age.ts
```

## Known rough edges

Two engine defects surfaced during this build and are worked around in host code
rather than in the vendored copy, with the analysis in a comment at each site.
Both have upstream fixes described in the engine's PR.

- **A `select` that is mounted when a draft lands loses its restored value**
  (Radix `Select` does not mount its options while closed). Worked around in
  `ApplicationShell.handleDraftRestore`, which re-applies the draft one commit
  later, when every control is settled.
- **Submit renders permanently disabled on a controlled-step review screen.**
  react-hook-form's `formState` is a lazy proxy whose getters *are* the
  subscription; nothing reads `isValid` until `SubmitField` mounts, which happens
  only on the review step, so it reads a stale snapshot and then subscribes to a
  verdict nobody publishes again. The host re-publishes it with a bare
  `trigger()`. The upstream fix is `useFormState({ control })` in
  `SubmitField.tsx:13`.

A third gap was found on the deployed build and has since been **fixed
upstream** rather than worked around here, which is why it is worth recording:

- **No `autocomplete` on the text fields** (fixed). `fullName`, `email`,
  `residentialAddress`, `postalCode` and `city` used to render with no
  `autocomplete` attribute. Only the phone field had one, and that came from
  `react-phone-number-input` rather than from the engine — Chrome's **Issues**
  panel was the thing that said so ("An element doesn't have an autocomplete
  attribute"), which is why it survived a console-only check. For a form asking
  a person for their own name and address that is a WCAG 2.2 AA 1.3.5 (Identify
  Input Purpose) failure, not merely an inconvenience.

  The engine now takes `autocomplete` on `BaseField` and forwards it to the nine
  field types whose control is a native text-entry input, and this config sets
  the purpose token on every field that asks about the applicant — `name`,
  `email`, `street-address`, `postal-code`, `address-level2`, `mobile tel`, and
  `organization`/`work email`/`work tel` on the corporate branch. The tokens are
  pinned by name in `buildFormConfig.test.ts`, because the engine types
  `autocomplete` as a plain string (the attribute is a grammar, not a fixed
  vocabulary) and a near-miss like `postcode` would otherwise read as
  conformant and fail silently. Fields that ask about someone or something else
  — the entity's registered address, a beneficial owner's name — deliberately
  carry none: a wrong token is worse than a missing one, because it points the
  browser at the applicant's own details.

  One known limit: `dateOfBirth` declares `bday` but the attribute does not
  reach the DOM, because the engine's `date` field is a calendar in a popover
  behind a `<button>` with no input to carry it. 1.3.5 is not failed by a
  control that is not an input field, and the token is declared so it starts
  working the day the date field grows a typed entry path.

---

Built by Youssef Nesafe. Everything above is a demonstration — Meridian Markets
does not exist, and no data entered here is transmitted, uploaded or stored.
