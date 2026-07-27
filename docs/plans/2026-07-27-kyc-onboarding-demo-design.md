# Design: Meridian Markets KYC onboarding demo

**Date:** 2026-07-27
**Status:** Approved

A multi-step KYC onboarding flow for a fictional brokerage, built as a public
portfolio demo. It is deployed to Vercel and linked from proposals, so it must
read as production software and survive a technical buyer opening the repo.

## Decisions

| Area | Decision |
|---|---|
| Engine | Existing `form-builder` library, vendored into `src/form-builder/`. Gaps upstreamed to `Projects/form-builder` on branch `feat/kyc-hardening`. |
| Repo layout | Single Next.js app. Engine lives in an internal directory; the extractability boundary is enforced by ESLint and a CI grep, not by convention. |
| Routing | Route per step: `/apply/[step]`. |
| Branching | Two axes: `accountType` (individual / corporate) × `country`. |
| Countries | Full ISO list. Three configured jurisdictions (DE, US, AE) plus a `default` fallback config. |
| Files on resume | Metadata only. File contents never persist; the visitor is prompted to re-select. |
| Seeding | Fictional placeholders on every field, plus a per-step "Fill with sample data" button. |
| Tests | Engine changes: vitest, matching the existing suite. Demo: vitest on config logic plus one Playwright keyboard-only run. |
| Visual | Inter Tight and JetBrains Mono, single deep-teal accent `#0F5C5A`. |

## Engine capability audit

Read from source, not documentation. The engine already provides more than the
brief assumed.

Already present:

- `autosave` in `useDynamicForm` — debounced draft save, config-hash
  invalidation, restores values and step. `sanitizeDraftValues` already strips
  `file`, `password`, `otp` and `signature` from the draft.
- `steps[].visibleWhen` — the individual/corporate branch is a config change,
  not code.
- `select.optionsFrom: { field, map }` — US states keyed off country,
  declaratively.
- `parseSubmission`, `createFormAction`, `applyServerErrors` — genuine
  client/server schema reuse. On server error the form jumps to the owning step
  and focuses the field.
- Focus-to-first-invalid on `handleNext` and on failed submit. `aria-current`
  on the active step. `fieldAriaDescribedBy` helper.
- `registerField` backed by a `Symbol.for` global registry, so custom types
  survive module duplication.

Seven gaps against the brief:

| # | Requirement | Engine reality |
|---|---|---|
| 1 | sessionStorage persistence | `core/autosave.ts` hardcodes `window.localStorage`. |
| 2 | `.tiff` rejected with a specific reason | `accept` is only the native input attribute. Nothing validates file type in the schema; only `maxSizeMB` validates. |
| 3 | Drag-drop, per-file status, progress | `FileField` is a button and a `<ul>`. No drag-and-drop, no per-file state. |
| 4 | Under-18 human message | `date.maxDate` emits `messages.max(field.maxDate)` — "Must be at most 2008-07-27". No per-field message override on `date`. |
| 5 | Badge on conditional fields | `FieldWrapper.description` is `string`. No ReactNode, no adornment slot. |
| 6 | Left rail stepper | `FormStepper` renders a horizontal `<ol>`, is unexported, and has no orientation option. |
| 7 | Route per step | `FormRenderer` owns step state internally and exposes no `step` or `onStepChange` prop. |

## Where the brief is wrong

Two requirements are overridden deliberately.

**`when?: (values) => boolean`.** A predicate function cannot be serialised or
evaluated server-side, and `parseSubmission` must recompute visibility on the
server to strip hidden fields. The engine's declarative `Condition` /
`ConditionSpec` DNF form is correct and is kept.

**"Continue disabled until the step is valid."** The engine instead validates
on click and moves focus to the first invalid field. That is the better
pattern, and the brief itself objects to "a dead button with no explanation" —
a disabled button is exactly that. Kept as-is, with an error summary on click.

## Engine changes

Branch `feat/kyc-hardening` on `Projects/form-builder`. All additive and
backwards-compatible; each ships with tests.

**E1 — storage adapter.** `AutosaveOptions.storage?: "local" | "session" |
StorageLike`, defaulting to `"local"`. `core/autosave.ts` resolves it rather
than hardcoding `window.localStorage`.

**E2 — `accept` enforcement and per-file reasons.** Add extension, MIME and
wildcard parsing to `fileSchema()`. Convert the `multiple` branch from
`files.every(...)`, which produces one error for the whole array, to
`superRefine` emitting per-index issues. New messages: `fileType`,
`fileTypeRejected(name, ext)`. This is what lets a `.tiff` upload say "TIFF
files aren't accepted — upload a JPG, PNG or PDF" instead of a generic array
error.

**E3 — `date.message?: string`.** Mirrors the existing `TextRules.message` and
`masked.message`. The age check becomes `{ maxDate: <today−18y>, message: "You
must be 18 or older to open an account." }` — declarative, so `parseSubmission`
reproduces the same message server-side.

**E4 — `BaseField.badge?: string` and a `FieldWrapper` adornment slot.**
`description` widens to `ReactNode`; a new `adornment` slot sits beside the
label. Generic rather than KYC-specific. This renders the conditional-field
badge from config alone.

**E5 — controlled step.** `FormRenderer` gains `step?: number` and
`onStepChange?: (step: number) => void`, threaded through to `FormStepper`,
which already has the internals. Internals stay unexported, preserving the
single public entry point.

**E6 — `stepperOrientation?: "horizontal" | "vertical"`.** Produces the left
rail from a prop.

**E7 — `onDraftRestore?: (info: { step?: number }) => void`.**
`useDynamicForm` already computes `draft.restoredStep`; `FormRenderer`
currently swallows it. Surfacing it powers the "resumed" indicator.

**E8 — extract `FileDropzone` and `useFileValidation`** as exported primitives.
The built-in `FileField` gains drag-and-drop by consuming them. Progress
simulation stays out of the engine — it is host policy, and the engine's own
docs place upload handling with the host.

## Demo structure

```
src/
├─ app/
│  ├─ layout.tsx              DemoBanner, fonts, registerBuiltInFields
│  └─ apply/
│     ├─ layout.tsx           ApplicationShell — FormRenderer mounts here and
│     │                       persists across [step] navigation
│     └─ [step]/page.tsx      slug to step index, generateStaticParams
├─ form-builder/              vendored engine, never edited in this repo
├─ config/
│  ├─ jurisdictions/{index,default,de,us,ae,types}.ts
│  ├─ fields/{individual,corporate}.ts
│  ├─ steps.ts
│  ├─ buildFormConfig.ts      composes one FormConfig from all of the above
│  └─ sampleData.ts
├─ fields/document.tsx        registerField("document", …) — README worked example
├─ components/                DemoBanner, StepRail, ResumedNotice, SuccessPanel
├─ server/parseApplication.example.ts   real parseSubmission code, wired to nothing
└─ lib/{age,fileManifest}.ts
```

### One config, not per-country rebuilds

`buildFormConfig()` concatenates every jurisdiction's fields into a single
`FormConfig` and auto-injects the `visibleWhen` guard. A jurisdiction file
never writes a condition — it only declares fields:

```ts
// config/jurisdictions/de.ts
export const de: Jurisdiction = {
  code: "DE",
  label: "Germany",
  taxFields: [
    { type: "masked", name: "de_steuerId", label: "Steuer-Identifikationsnummer",
      mask: "## ### ### ###", required: true,
      description: "11 digits, issued by the Bundeszentralamt für Steuern" },
  ],
}
// buildFormConfig stamps:
//   visibleWhen: [{ field: "country", equals: "DE" },
//                 { field: "accountType", equals: "individual" }]
//   badge: "Required in Germany"
```

Adding a country is one file plus one registry line, with no component code
touched.

Rebuilding the config whenever the country changes is the obvious alternative
and is wrong here: `draftConfigHash()` hashes `config.fields`, so a rebuild
silently invalidates the saved draft on every country change. A single config
also means the engine strips hidden fields from both schema and payload for
free.

### Jurisdiction differences

Each must differ in a way a visitor notices.

- **DE** — masked 11-digit Steuer-ID, church-tax declaration radio.
- **US** — state `select` driven by `optionsFrom: { field: "country", map }`,
  SSN/ITIN, W-9 backup-withholding checkbox.
- **AE** — masked Emirates ID `784-####-#######-#`, visa-status radio, no TIN.
- **fallback** — self-declared tax residency and TIN, with a visible note
  naming which config resolved.

### Routing

`FormRenderer` mounts in `apply/layout.tsx` so react-hook-form state survives
`[step]` navigation. `useParams()` maps slug to index to the controlled `step`
prop; `onStepChange` pushes the route. A guard redirects deep links past the
furthest completed step.

To verify before building: that a layout above a dynamic segment stays mounted
across param changes in Next 16. If it does not, the fallback is a `?step=`
query parameter on a single route.

### Bundle budget

Scoped install keeps Lighthouse mobile above 90:

```
form-builder.mjs add text email select country radio checkbox date phone \
  file masked static submit hidden group
```

This drops `signature_pad`, `input-otp` and the `react-day-picker` extras, and
omits the slider, rating, time and segmented components entirely.

## Demo safety

Made verifiable rather than asserted.

- Playwright asserts that no outgoing request body contains the sample-data
  sentinel strings. The "zero requests carrying form input" requirement becomes
  a test rather than a manual DevTools check.
- `server/parseApplication.example.ts` contains real, typechecked
  `parseSubmission` code imported by nothing — stronger than the comment the
  brief asked for.
- CI runs `grep -ri meridian src/form-builder/` and requires an empty result.
  ESLint `no-restricted-imports` blocks engine-to-demo imports.
- Fonts are self-hosted through `next/font`, so there are no third-party
  requests at all.
- The demo banner renders in the root layout, so it cannot be missed on any
  screen including success.

## Deliverables

- Deployed Vercel app and the deploy command.
- `README.md` covering what the demo proves, the field-registry decision, how
  to add a jurisdiction with a worked example, how to add a field type using
  `fields/document.tsx`, and the demo-safety constraints.
- Clean commit history.
- `lint` and `tsc --noEmit` clean in both repos.
