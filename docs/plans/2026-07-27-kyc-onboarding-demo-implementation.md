# Meridian Markets KYC Demo — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship a multi-step KYC onboarding demo for a fictional brokerage that proves a config-driven form engine handles jurisdiction-conditional fields, document validation and resumable progress — with zero user data leaving the browser.

**Architecture:** Two repos. Gaps in the existing `form-builder` engine are upstreamed as eight additive, backwards-compatible changes on a branch. The KYC demo then vendors that engine via the engine's own CLI and consumes it as a library: every step, field and jurisdiction rule is declarative config, with no per-step JSX.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript strict, Tailwind v4, shadcn/ui, react-hook-form, Zod v4, Zustand, CVA, vitest, Playwright.

**Design doc:** `docs/plans/2026-07-27-kyc-onboarding-demo-design.md`

---

## Repos and conventions

| | |
|---|---|
| Engine | `C:/Users/youss/OneDrive/Desktop/Projects/form-builder` — branch `feat/kyc-hardening` off `master` |
| Demo | `C:/Users/youss/OneDrive/Desktop/Projects/kyc` — branch `master` |
| Package manager | **yarn** in both. The brief said `pnpm lint`; both repos already carry `yarn.lock`, and introducing a second package manager for one command is churn. README documents `yarn lint`. |
| Engine tests | `vitest run` from the engine root. Tests are colocated (`foo.ts` → `foo.test.ts`), start with `// @vitest-environment jsdom` when they touch DOM or storage, and import from `vitest` explicitly. |
| Zod | **v4**. Note `z.strictObject`, `z.iso.date()`, and `{ error }` rather than `{ message }` in schema constructors. |

**Read before starting:** @superpowers:test-driven-development and @superpowers:verification-before-completion.

### Two facts that will bite if forgotten

1. **`baseFieldSchema` in `form-builder/core/schema.ts:58` is a `z.strictObject`.** Any new field property must be added there or `validateFormConfig` throws at runtime on every form using it.
2. **`cli/vendor/` exists in the engine checkout.** `cli/src/source.mjs:114` prefers vendored mode, so the installer copies *stale* engine source until `node cli/scripts/vendor.mjs` is re-run. Every engine change must be re-vendored before it reaches the demo (Task 10).

---

# Phase A — Engine hardening

## Task 1: Branch the engine

**Files:** none (git only)

**Step 1: Create the branch**

```bash
cd "C:/Users/youss/OneDrive/Desktop/Projects/form-builder"
git checkout -b feat/kyc-hardening
```

**Step 2: Confirm a green baseline before changing anything**

Run: `yarn test`
Expected: all suites pass. If anything is already red, stop and report — do not build on a red baseline.

Run: `yarn typecheck`
Expected: no output, exit 0.

---

## Task 2: E1 — storage adapter for autosave

Autosave hardcodes `window.localStorage`. The demo needs sessionStorage so a shared machine does not retain a half-finished application.

**Files:**
- Modify: `form-builder/core/autosave.ts`
- Modify: `form-builder/hooks/useDynamicForm.ts:95-175`
- Test: `form-builder/core/autosave.test.ts`

**Step 1: Write the failing tests**

Append to `form-builder/core/autosave.test.ts`:

```ts
describe("storage selection", () => {
  afterEach(() => window.sessionStorage.clear());

  it("defaults to localStorage", () => {
    saveDraft("f", "h", { name: "Ada" });
    expect(window.localStorage.getItem(draftStorageKey("f"))).not.toBeNull();
    expect(window.sessionStorage.getItem(draftStorageKey("f"))).toBeNull();
  });

  it("round-trips through sessionStorage when selected", () => {
    saveDraft("f", "h", { name: "Ada" }, 2, "session");
    expect(window.localStorage.getItem(draftStorageKey("f"))).toBeNull();
    expect(loadDraft("f", "h", "session")).toEqual({ values: { name: "Ada" }, step: 2 });
    expect(hasDraft("f", "session")).toBe(true);
    clearDraft("f", "session");
    expect(hasDraft("f", "session")).toBe(false);
  });

  it("accepts a custom storage object", () => {
    const map = new Map<string, string>();
    const custom = {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
      removeItem: (k: string) => void map.delete(k),
    };
    saveDraft("f", "h", { name: "Ada" }, undefined, custom);
    expect(loadDraft("f", "h", custom)).toEqual({ values: { name: "Ada" } });
  });
});
```

**Step 2: Run to verify it fails**

Run: `yarn vitest run form-builder/core/autosave.test.ts`
Expected: FAIL — `saveDraft` takes 4 arguments, extra args ignored, sessionStorage assertions fail.

**Step 3: Implement**

In `form-builder/core/autosave.ts`, add above `AutosaveOptions`:

```ts
/** The subset of the Web Storage API a draft needs. Anything matching this
 *  shape works — sessionStorage, localStorage, or an in-memory stub. */
export type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type DraftStorageOption = "local" | "session" | DraftStorage;

function resolveStorage(storage?: DraftStorageOption): DraftStorage | null {
  if (typeof storage === "object") return storage;
  if (typeof window === "undefined") return null;
  return storage === "session" ? window.sessionStorage : window.localStorage;
}
```

Extend the options type:

```ts
export type AutosaveOptions = {
  key?: string;
  debounceMs?: number;
  includeSignatures?: boolean;
  /** Where drafts live. Defaults to "local" — unchanged from previous behaviour. */
  storage?: DraftStorageOption;
};
```

Then give `loadDraft`, `saveDraft`, `hasDraft` and `clearDraft` a trailing optional
`storage?: DraftStorageOption` parameter, and replace every `window.localStorage`
reference with a `resolveStorage(storage)` result, bailing out when it is `null`.
`saveDraft`'s new parameter goes *after* `step`. The parameter is optional
everywhere, so `clearDraft(id)` — which is public API — keeps working.

In `form-builder/hooks/useDynamicForm.ts`, read `const draftStorage = autosave?.storage;`
alongside the other autosave options and thread it through all four call sites.
Add `draftStorage` to the dependency arrays of the save effect, `noteStep` and
`clearDraftAndPending`.

**Step 4: Run tests**

Run: `yarn vitest run form-builder/core/autosave.test.ts form-builder/hooks/useDynamicForm.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add form-builder/core/autosave.ts form-builder/core/autosave.test.ts form-builder/hooks/useDynamicForm.ts
git commit -m "feat(autosave): let consumers choose draft storage

Adds AutosaveOptions.storage accepting \"local\", \"session\", or any object
matching the Web Storage subset a draft needs. Defaults to localStorage, so
existing consumers are unaffected."
```

---

## Task 3: E2a — shared file-accept helpers

Both the Zod schema and the upload UI need to agree on what counts as an accepted
file. Put the rule in one pure module so they cannot drift.

**Files:**
- Create: `form-builder/core/fileAccept.ts`
- Test: `form-builder/core/fileAccept.test.ts`

**Step 1: Write the failing test**

Create `form-builder/core/fileAccept.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { fileExtensionLabel, fileMatchesAccept } from "./fileAccept";

const file = (name: string, type: string) => new File(["x"], name, { type });

describe("fileMatchesAccept", () => {
  it("accepts everything when accept is empty or absent", () => {
    expect(fileMatchesAccept(file("a.tiff", "image/tiff"), undefined)).toBe(true);
    expect(fileMatchesAccept(file("a.tiff", "image/tiff"), "  ")).toBe(true);
  });

  it("matches extension tokens case-insensitively", () => {
    expect(fileMatchesAccept(file("Scan.PDF", ""), ".pdf,.jpg")).toBe(true);
    expect(fileMatchesAccept(file("scan.tiff", ""), ".pdf,.jpg")).toBe(false);
  });

  it("matches exact and wildcard MIME tokens", () => {
    expect(fileMatchesAccept(file("a.png", "image/png"), "image/*")).toBe(true);
    expect(fileMatchesAccept(file("a.pdf", "application/pdf"), "image/*")).toBe(false);
    expect(fileMatchesAccept(file("a.pdf", "application/pdf"), "application/pdf")).toBe(true);
  });

  it("does not let a bare dot or empty token match everything", () => {
    expect(fileMatchesAccept(file("noext", ""), ".pdf")).toBe(false);
  });
});

describe("fileExtensionLabel", () => {
  it("returns an uppercase extension without the dot", () => {
    expect(fileExtensionLabel(file("scan.tiff", ""))).toBe("TIFF");
  });

  it("returns an empty string when there is no extension", () => {
    expect(fileExtensionLabel(file("scan", ""))).toBe("");
  });
});
```

**Step 2: Run to verify it fails**

Run: `yarn vitest run form-builder/core/fileAccept.test.ts`
Expected: FAIL — cannot resolve `./fileAccept`.

**Step 3: Implement**

Create `form-builder/core/fileAccept.ts`:

```ts
/**
 * Interpretation of the HTML `accept` attribute, shared by the Zod schema and
 * the upload UI so a file can never be rendered as accepted while the schema
 * rejects it (or the reverse).
 */

/** Splits an `accept` string into normalised, non-empty lowercase tokens. */
function acceptTokens(accept: string | undefined): string[] {
  if (!accept) return [];
  return accept
    .split(",")
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token.length > 0 && token !== ".");
}

export function fileMatchesAccept(file: File, accept: string | undefined): boolean {
  const tokens = acceptTokens(accept);
  if (tokens.length === 0) return true;

  const name = file.name.toLowerCase();
  const mime = file.type.toLowerCase();

  return tokens.some((token) => {
    if (token.startsWith(".")) return name.endsWith(token);
    if (token.endsWith("/*")) return mime !== "" && mime.startsWith(token.slice(0, -1));
    return mime === token;
  });
}

/** "scan.tiff" -> "TIFF". Used to name the rejected format back to the user. */
export function fileExtensionLabel(file: File): string {
  const dot = file.name.lastIndexOf(".");
  if (dot === -1 || dot === file.name.length - 1) return "";
  return file.name.slice(dot + 1).toUpperCase();
}
```

**Step 4: Run tests**

Run: `yarn vitest run form-builder/core/fileAccept.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add form-builder/core/fileAccept.ts form-builder/core/fileAccept.test.ts
git commit -m "feat(file): add shared accept-matching helpers"
```

---

## Task 4: E2b — enforce `accept` in the schema, per file

Today `accept` is only the native input attribute — nothing validates file type.
And the `multiple` branch uses `files.every(...)`, producing one error for the
whole array, so a per-file reason is impossible.

**Files:**
- Modify: `form-builder/core/messages.ts`
- Modify: `form-builder/core/validation.ts:76-83` and `:242-258`
- Test: `form-builder/core/validation.test.ts`

**Step 1: Write the failing tests**

Append to `form-builder/core/validation.test.ts`:

```ts
describe("file accept enforcement", () => {
  const pdf = () => new File(["x"], "passport.pdf", { type: "application/pdf" });
  const tiff = () => new File(["x"], "scan.tiff", { type: "image/tiff" });

  it("rejects a single file whose type is not accepted, naming the format", () => {
    const schema = toZodSchema(
      { type: "file", name: "doc", required: true, accept: ".pdf,.jpg,.png" },
      defaultMessages,
    )!;
    const result = schema.safeParse(tiff());
    expect(result.success).toBe(false);
    expect(result.error!.issues[0].message).toContain("TIFF");
    expect(result.error!.issues[0].message).toContain(".pdf");
  });

  it("accepts a file whose type is allowed", () => {
    const schema = toZodSchema(
      { type: "file", name: "doc", required: true, accept: ".pdf,.jpg,.png" },
      defaultMessages,
    )!;
    expect(schema.safeParse(pdf()).success).toBe(true);
  });

  it("reports the offending index for multi-file uploads", () => {
    const schema = toZodSchema(
      { type: "file", name: "docs", required: true, multiple: true, accept: ".pdf" },
      defaultMessages,
    )!;
    const result = schema.safeParse([pdf(), tiff()]);
    expect(result.success).toBe(false);
    expect(result.error!.issues[0].path).toEqual([1]);
  });

  it("reports size and type issues independently, per index", () => {
    const big = new File([new Uint8Array(3 * 1024 * 1024)], "big.pdf", { type: "application/pdf" });
    const schema = toZodSchema(
      { type: "file", name: "docs", required: true, multiple: true, accept: ".pdf", maxSizeMB: 2 },
      defaultMessages,
    )!;
    const result = schema.safeParse([big, tiff()]);
    expect(result.success).toBe(false);
    expect(result.error!.issues.map((issue) => issue.path[0]).sort()).toEqual([0, 1]);
  });
});
```

**Step 2: Run to verify it fails**

Run: `yarn vitest run form-builder/core/validation.test.ts -t "file accept"`
Expected: FAIL — the TIFF parses successfully because nothing checks type.

**Step 3: Add the messages**

In `form-builder/core/messages.ts`, add to the `Messages` type:

```ts
  fileTypeRejected: (name: string, extension: string | undefined, formats: string) => string;
```

and to `defaultMessages`:

```ts
  fileTypeRejected: (name, extension, formats) =>
    `${name} isn't in a format we accept${extension ? ` (${extension})` : ""}${formats ? ` — please upload ${formats}` : ""}`,
```

**Step 4: Implement the schema change**

In `form-builder/core/validation.ts`, import the helpers:

```ts
import { fileExtensionLabel, fileMatchesAccept } from "./fileAccept";
```

Replace `fileSchema` (line 76) so the accept refinement runs before the size one:

```ts
function fileSchema(field: Extract<FieldConfig, { type: "file" }>, messages: Messages): z.ZodType {
  let schema: z.ZodType = z.instanceof(File, { error: messages.required });
  if (field.accept !== undefined) {
    const accept = field.accept;
    schema = schema.refine(
      (file) => fileMatchesAccept(file as File, accept),
      (file) => ({ message: messages.fileTypeRejected((file as File).name, fileExtensionLabel(file as File), accept) }),
    );
  }
  if (field.maxSizeMB !== undefined) {
    const maxBytes = field.maxSizeMB * BYTES_PER_MB;
    schema = schema.refine((file) => (file as File).size <= maxBytes, messages.fileSize(field.maxSizeMB));
  }
  return schema;
}
```

Replace the `case "file"` multiple branch (line 243) with a `superRefine` that
emits one issue per offending index:

```ts
    case "file": {
      if (field.multiple) {
        const base = z.array(z.instanceof(File, { error: messages.required }));
        const withMin = field.required ? base.min(1, messages.required) : base;
        const accept = field.accept;
        const maxBytes = field.maxSizeMB !== undefined ? field.maxSizeMB * BYTES_PER_MB : undefined;
        if (accept === undefined && maxBytes === undefined) {
          return field.required ? withMin : withMin.optional();
        }
        // One issue per index, so the UI can mark exactly which file failed and why
        // rather than reporting a single error for the whole list.
        const schema = withMin.superRefine((files, ctx) => {
          files.forEach((file, index) => {
            if (accept !== undefined && !fileMatchesAccept(file, accept)) {
              ctx.addIssue({
                code: "custom",
                path: [index],
                message: messages.fileTypeRejected(file.name, fileExtensionLabel(file), accept),
              });
            }
            if (maxBytes !== undefined && file.size > maxBytes) {
              ctx.addIssue({
                code: "custom",
                path: [index],
                message: messages.fileSize(field.maxSizeMB as number),
              });
            }
          });
        });
        return field.required ? schema : schema.optional();
      }
      const single = fileSchema(field, messages);
      return field.required ? single : single.optional();
    }
```

**Step 5: Run tests**

Run: `yarn vitest run form-builder/core/validation.test.ts`
Expected: PASS, including pre-existing file tests.

Run: `yarn typecheck`
Expected: clean. If the `refine` message-function overload complains, use the
plain-string form with a precomputed message instead — the per-file name is only
needed in the `multiple` branch.

**Step 6: Commit**

```bash
git add form-builder/core/messages.ts form-builder/core/validation.ts form-builder/core/validation.test.ts
git commit -m "feat(file): validate accept in the schema with per-file reasons

accept was previously only the native input attribute, so a .tiff passed
validation. Multi-file uploads now emit one issue per index instead of a
single array-level error, so the UI can say which file failed and why."
```

---

## Task 5: E3 — per-field message on `date`

`date.maxDate` currently emits `messages.max(field.maxDate)` — "Must be at most
2008-07-27". The age check needs a sentence. `TextRules.message` and
`masked.message` already establish this pattern.

**Files:**
- Modify: `form-builder/core/types.ts:104-111`
- Modify: `form-builder/core/schema.ts:213` (the `date` entry)
- Modify: `form-builder/core/validation.ts:58-74`
- Test: `form-builder/core/validation.test.ts`, `form-builder/core/schema.test.ts`

**Step 1: Write the failing test**

Append to `form-builder/core/validation.test.ts`:

```ts
describe("date message override", () => {
  const field = {
    type: "date" as const,
    name: "dob",
    required: true,
    maxDate: "2008-07-27",
    message: "You must be 18 or older to open an account.",
  };

  it("uses the override for a bound violation", () => {
    const result = toZodSchema(field, defaultMessages)!.safeParse("2015-01-01");
    expect(result.success).toBe(false);
    expect(result.error!.issues[0].message).toBe("You must be 18 or older to open an account.");
  });

  it("keeps the generic message for an unparseable date", () => {
    const result = toZodSchema(field, defaultMessages)!.safeParse("not-a-date");
    expect(result.success).toBe(false);
    expect(result.error!.issues[0].message).toBe(defaultMessages.invalidDate);
  });

  it("still passes a date inside the bound", () => {
    expect(toZodSchema(field, defaultMessages)!.safeParse("1990-03-14").success).toBe(true);
  });
});
```

Append to `form-builder/core/schema.test.ts`:

```ts
it("accepts message on a date field", () => {
  expect(() =>
    validateFormConfig({
      id: "f",
      fields: [{ type: "date", name: "dob", maxDate: "2008-07-27", message: "Too young" }],
    }),
  ).not.toThrow();
});
```

**Step 2: Run to verify it fails**

Run: `yarn vitest run form-builder/core/validation.test.ts -t "date message" form-builder/core/schema.test.ts -t "message on a date"`
Expected: FAIL — the config validator rejects the unknown `message` key (strictObject), and the bound message is the generic one.

**Step 3: Implement**

`form-builder/core/types.ts` — add `message?: string` to the `date` variant:

```ts
  | (BaseField & {
      type: "date";
      range?: boolean;
      minDate?: string;
      maxDate?: string;
      minDateField?: string;
      maxDateField?: string;
      /** Replaces the generic bound message for minDate/maxDate violations. */
      message?: string;
    })
```

`form-builder/core/schema.ts` — inside the `date:` entry's `.extend({ ... })`, add:

```ts
      message: z.string().optional(),
```

`form-builder/core/validation.ts` — in `isoDateSchema`, use the override for both bounds:

```ts
  if (field.minDate !== undefined) {
    const min = datePart(field.minDate);
    schema = schema.refine((value) => datePart(value) >= min, field.message ?? messages.min(field.minDate));
  }
  if (field.maxDate !== undefined) {
    const max = datePart(field.maxDate);
    schema = schema.refine((value) => datePart(value) <= max, field.message ?? messages.max(field.maxDate));
  }
```

**Step 4: Run tests**

Run: `yarn vitest run form-builder/core`
Expected: PASS.

**Step 5: Commit**

```bash
git add form-builder/core/types.ts form-builder/core/schema.ts form-builder/core/validation.ts form-builder/core/validation.test.ts form-builder/core/schema.test.ts
git commit -m "feat(date): allow a per-field message for min/max violations

Mirrors TextRules.message and masked.message. A bare bound message reads as
\"Must be at most 2008-07-27\"; a date field expressing a rule (an age cutoff,
a settlement window) needs to say what the rule is."
```

---

## Task 6: E4 — `badge` on fields, rendered by `FieldWrapper`

The demo needs a badge on jurisdiction-conditional fields so a visitor can see the
conditional logic firing. Threading a prop through 24 field components would be
noise; `FieldGate` already wraps every field and owns a context, so put it there.

**Files:**
- Modify: `form-builder/core/types.ts` (`BaseField`)
- Modify: `form-builder/core/schema.ts:58` (`baseFieldSchema`)
- Modify: `form-builder/components/FieldRuntime.tsx`
- Modify: `form-builder/ui/FieldWrapper.tsx`
- Test: `form-builder/components/FieldRuntime.test.tsx`

**Step 1: Write the failing test**

Append to `form-builder/components/FieldRuntime.test.tsx` (follow the existing
render helper in that file):

```tsx
it("renders a field badge from config without the field component passing it", async () => {
  render(
    <FormRenderer
      config={{
        id: "f",
        fields: [{ type: "text", name: "tin", label: "Tax ID", badge: "Required in Germany" }],
      }}
      onSubmit={() => {}}
    />,
  );
  expect(await screen.findByText("Required in Germany")).toBeTruthy();
});
```

**Step 2: Run to verify it fails**

Run: `yarn vitest run form-builder/components/FieldRuntime.test.tsx`
Expected: FAIL — `validateFormConfig` throws on the unrecognised `badge` key.

**Step 3: Implement**

`form-builder/core/types.ts` — add to `BaseField`:

```ts
  /** Short annotation rendered beside the label. Use it to explain why a field
   *  is present — "Required in Germany", "Corporate accounts only". */
  badge?: string;
```

`form-builder/core/schema.ts` — add to `baseFieldSchema`:

```ts
  badge: z.string().optional(),
```

`form-builder/components/FieldRuntime.tsx` — add `field?: AnyFieldConfig` to the
`FieldRuntime` type, and include it in the provider `FieldGate` already renders:

```tsx
    <FieldRuntimeContext.Provider value={{ ...runtime, disabled, field }}>
```

`form-builder/ui/FieldWrapper.tsx` — widen `description` and read the badge from
context. Add to the props type:

```ts
  description?: ReactNode;
  /** Overrides the badge from field config. Rarely needed. */
  badge?: ReactNode;
```

and inside the component:

```tsx
  const { field: contextField } = useFieldRuntime();
  const resolvedBadge = badge ?? contextField?.badge;
```

Render it next to the label in both the `asGroup` and default branches:

```tsx
        <FieldLabel htmlFor={id}>
          {label}
          {required && <RequiredMark />}
          {resolvedBadge && (
            <span data-slot="field-badge" className="ms-auto rounded-sm border px-[0.5em] py-[0.15em] font-mono text-[0.85em] font-normal text-muted-foreground">
              {resolvedBadge}
            </span>
          )}
        </FieldLabel>
```

Import `useFieldRuntime` from `../components/FieldRuntime`.

> If this import creates a cycle (`FieldRuntime` → field components → `FieldWrapper`
> → `FieldRuntime`), move the context definition into `form-builder/core/fieldContext.ts`
> and re-export it from `FieldRuntime.tsx`. Check with `yarn typecheck` and a test run.

**Step 4: Run tests**

Run: `yarn vitest run form-builder/components form-builder/ui form-builder/core/schema.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add form-builder/core/types.ts form-builder/core/schema.ts form-builder/components/FieldRuntime.tsx form-builder/ui/FieldWrapper.tsx form-builder/components/FieldRuntime.test.tsx
git commit -m "feat(fields): add BaseField.badge rendered beside the label

Delivered through FieldGate's existing context so no field component needs
changing. description widens to ReactNode at the same time."
```

---

## Task 7: E5 + E6 + E7 — controlled step, orientation, restore callback

Three `FormRenderer` props. Grouped because they touch the same two files and the
demo needs all three before it can render anything.

**Files:**
- Modify: `form-builder/components/FormStepper.tsx`
- Modify: `form-builder/components/FormRenderer.tsx`
- Test: `form-builder/components/FormRenderer.test.tsx`

**Step 1: Write the failing tests**

Append to `form-builder/components/FormRenderer.test.tsx`:

```tsx
const twoStepConfig = {
  id: "wiz",
  fields: [
    { type: "text" as const, name: "a", label: "A" },
    { type: "text" as const, name: "b", label: "B" },
    { type: "submit" as const, name: "s", text: "Submit" },
  ],
  steps: [
    { title: "One", fieldNames: ["a"] },
    { title: "Two", fieldNames: ["b"] },
  ],
};

it("renders the step named by the controlled step prop", async () => {
  render(<FormRenderer config={twoStepConfig} step={1} onSubmit={() => {}} />);
  expect(await screen.findByLabelText("B")).toBeTruthy();
  expect(screen.queryByLabelText("A")).toBeNull();
});

it("reports step changes to onStepChange", async () => {
  const onStepChange = vi.fn();
  render(<FormRenderer config={twoStepConfig} onStepChange={onStepChange} onSubmit={() => {}} />);
  await userEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(onStepChange).toHaveBeenCalledWith(1);
});

it("lays the stepper out vertically when asked", async () => {
  render(<FormRenderer config={twoStepConfig} stepperOrientation="vertical" onSubmit={() => {}} />);
  const list = await screen.findByRole("list", { name: /steps/i });
  expect(list.className).toContain("flex-col");
});

it("notifies the consumer when a draft is restored", async () => {
  window.sessionStorage.setItem(
    `form-builder:draft:wiz`,
    JSON.stringify({ hash: draftConfigHash(twoStepConfig.fields), values: { a: "x" }, step: 1 }),
  );
  const onDraftRestore = vi.fn();
  render(
    <FormRenderer
      config={twoStepConfig}
      autosave={{ storage: "session" }}
      onDraftRestore={onDraftRestore}
      onSubmit={() => {}}
    />,
  );
  await waitFor(() => expect(onDraftRestore).toHaveBeenCalledWith({ step: 1 }));
});
```

**Step 2: Run to verify it fails**

Run: `yarn vitest run form-builder/components/FormRenderer.test.tsx`
Expected: FAIL — the props do not exist, so step 0 renders and the mocks never fire.

**Step 3: Implement `FormStepper`**

Add to the props type:

```ts
  controlledStep?: number;
  orientation?: "horizontal" | "vertical";
```

Sync the store to the controlled value — the existing `onStepChange` effect then
tells the parent, the parent updates the URL, and the new prop arrives back as a
no-op `goTo`, so there is no loop:

```tsx
  useEffect(() => {
    if (controlledStep !== undefined) store.getState().goTo(controlledStep);
  }, [controlledStep, store]);
```

Make the outer wrapper and the `<ol>` orientation-aware:

```tsx
  const vertical = orientation === "vertical";
```

- Outer `div`: when `vertical`, use `grid` with `desktop:grid-cols-[minmax(0,13rem)_minmax(0,1fr)]`; otherwise keep the existing `flex flex-col`.
- `<ol>`: when `vertical`, `flex flex-col items-start`; otherwise `flex items-center`.

**Step 4: Implement `FormRenderer`**

Add props:

```ts
  step?: number;
  onStepChange?: (step: number) => void;
  stepperOrientation?: "horizontal" | "vertical";
  onDraftRestore?: (info: { step?: number }) => void;
```

Wire the stepper:

```tsx
  const handleStepChange = useCallback(
    (next: number) => {
      draft?.noteStep(next);
      onStepChange?.(next);
    },
    [draft, onStepChange],
  );
```

```tsx
            <FormStepper
              config={config}
              stepJumpRef={stepJumpRef}
              initialStep={draft?.restoredStep}
              controlledStep={step}
              orientation={stepperOrientation}
              onStepChange={handleStepChange}
            />
```

Fire the restore callback exactly once per restore — `restoreGeneration` only
increments on a real restore:

```tsx
  const notifiedRestoreRef = useRef(0);
  useEffect(() => {
    if (restoreGeneration > notifiedRestoreRef.current) {
      notifiedRestoreRef.current = restoreGeneration;
      onDraftRestore?.({ step: draft?.restoredStep });
    }
  }, [restoreGeneration, draft?.restoredStep, onDraftRestore]);
```

**Step 5: Run tests**

Run: `yarn vitest run form-builder/components`
Expected: PASS.

**Step 6: Commit**

```bash
git add form-builder/components/FormStepper.tsx form-builder/components/FormRenderer.tsx form-builder/components/FormRenderer.test.tsx
git commit -m "feat(stepper): controlled step, vertical orientation, restore callback

Lets a host own step state (so a wizard can live on real routes), render the
stepper as a left rail, and tell the user their progress was restored. All
three props are optional; uncontrolled use is unchanged."
```

---

## Task 8: E8 — drag-and-drop dropzone and per-file status

**Files:**
- Create: `form-builder/ui/FileDropzone.tsx`
- Modify: `form-builder/fields/FileField.tsx`
- Modify: `form-builder/core/messages.ts`
- Test: `form-builder/fields/FileField.test.tsx` (create)

**Step 1: Write the failing test**

Create `form-builder/fields/FileField.test.tsx`. Cover: a drop event adds files;
a rejected file shows its own reason next to its own row; the dropzone is
reachable and activatable by keyboard. Use `fireEvent.drop` with a
`dataTransfer: { files: [...] }` stub — `userEvent` has no drop helper.

**Step 2: Run to verify it fails**

Run: `yarn vitest run form-builder/fields/FileField.test.tsx`
Expected: FAIL — no dropzone exists.

**Step 3: Implement the dropzone**

Create `form-builder/ui/FileDropzone.tsx`: a `div` with `role="button"`,
`tabIndex={0}`, `aria-describedby`, `onDragOver`/`onDragLeave`/`onDrop`, and
Enter/Space activating the hidden input. It must call `event.preventDefault()` in
`onDragOver` or the browser navigates to the dropped file. Track hover state with
`data-dragging` for styling. Add messages: `dropzoneHint`, `dropzoneActive`.

**Step 4: Rewrite `FileField`'s file list**

Replace the button with `FileDropzone`, and render each file as a row showing
name, size, and its own status. Read per-index errors from react-hook-form —
with the Task 4 change, `fieldState.error` for a multiple field is an array-shaped
object, so index `i`'s message is at `(fieldState.error as Record<string, {message?: string}>)?.[i]?.message`.
Keep the existing single-file path reading `fieldState.error.message`.

Each row gets `data-status="accepted" | "rejected"`. Sizes render in the mono face.

**Step 5: Run tests**

Run: `yarn vitest run form-builder/fields`
Expected: PASS.

**Step 6: Commit**

```bash
git add form-builder/ui/FileDropzone.tsx form-builder/fields/FileField.tsx form-builder/fields/FileField.test.tsx form-builder/core/messages.ts
git commit -m "feat(file): drag-and-drop dropzone with per-file status

Rejected files now show their own reason on their own row instead of a single
error for the whole upload."
```

---

## Task 9: Export the new surface and verify the whole engine

**Files:**
- Modify: `form-builder/index.ts`
- Modify: `form-builder/headless.ts`

**Step 1: Add exports**

To `form-builder/index.ts`:

```ts
export { FileDropzone } from "./ui/FileDropzone";
export { fileMatchesAccept, fileExtensionLabel, acceptedFormatsLabel } from "./core/fileAccept";
export type { DraftStorage, DraftStorageOption } from "./core/autosave";
```

To `form-builder/headless.ts` — the same, minus `FileDropzone` (it is a React
component with UI dependencies and does not belong in the headless entry).

**Step 2: Verify the full engine**

```bash
yarn test
yarn typecheck
yarn lint
```
Expected: all green. Report the actual output; do not claim success without it.

**Step 3: Commit**

```bash
git add form-builder/index.ts form-builder/headless.ts
git commit -m "feat: export file-accept helpers, dropzone, and storage types"
```

---

# Phase B — Wire the engine into the demo

## Task 10: Re-vendor the CLI and install the engine

**Critical:** `cli/vendor/` exists, and `cli/src/source.mjs:114` prefers it. Skipping
the re-vendor installs the *old* engine and every Phase A change silently vanishes.

**Files:** `kyc/` (many, created by the installer)

**Step 1: Re-vendor**

```bash
cd "C:/Users/youss/OneDrive/Desktop/Projects/form-builder"
node cli/scripts/vendor.mjs
```

**Step 2: Confirm a Phase A change reached the vendored copy**

Run: `grep -c "fileTypeRejected" cli/vendor/form-builder/core/messages.ts`
Expected: at least `1`. If `0`, the vendor script did not pick up the change — stop
and investigate before installing.

**Step 3: Prepare the demo repo**

```bash
cd "C:/Users/youss/OneDrive/Desktop/Projects/kyc"
git checkout -b feat/kyc-demo
mkdir -p src && git mv app src/app
```

Update `tsconfig.json` `paths` so `@/*` resolves to `./src/*`, then confirm the app
still builds: `yarn build`.

Initialise shadcn (the engine requires it as a foundation):

```bash
yarn dlx shadcn@latest init
```

**Step 4: Install the engine, scoped to the field types this demo uses**

Omitting unused field types drops `signature_pad`, `input-otp` and the extra
date-picker weight — this is the main lever for the Lighthouse mobile ≥ 90 target.

```bash
cd "C:/Users/youss/OneDrive/Desktop/Projects/form-builder"
node cli/bin/form-builder.mjs add text email select country radio checkbox date phone file masked static submit hidden group --cwd "C:/Users/youss/OneDrive/Desktop/Projects/kyc"
```

**Step 5: Install remaining dependencies and verify**

Follow whatever the installer prints. Then in `kyc/`:

```bash
yarn add react-hook-form @hookform/resolvers zod zustand class-variance-authority clsx tailwind-merge cmdk date-fns react-day-picker libphonenumber-js react-phone-number-input radix-ui lucide-react tw-animate-css
yarn add -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom @playwright/test
yarn tsc --noEmit
```
Expected: clean.

**Step 6: Commit**

```bash
cd "C:/Users/youss/OneDrive/Desktop/Projects/kyc"
git add -A
git commit -m "chore: vendor form-builder engine and move app under src/

Scoped install — only the 14 field types this demo uses — to keep the mobile
bundle within the Lighthouse budget."
```

Then commit the re-vendored files in the engine repo separately.

---

## Task 11: Lock the engine boundary

The extractability claim must be machine-checked, not asserted.

**Files:**
- Modify: `kyc/eslint.config.mjs`
- Create: `kyc/scripts/check-engine-boundary.mjs`
- Modify: `kyc/package.json`

**Step 1: Write the failing check**

Create `kyc/scripts/check-engine-boundary.mjs`: fail with a non-zero exit if
`src/form-builder/` contains a case-insensitive match for `meridian`, or any
import from `@/config`, `@/components/`, `@/fields`, `@/lib` or `@/app`.

**Step 2: Run it**

Run: `node scripts/check-engine-boundary.mjs`
Expected: PASS on a clean install. Temporarily add `// Meridian` to a vendored
file, re-run, confirm it FAILS, then remove it. A check that has never failed is
not a check.

**Step 3: Add the ESLint rule**

In `eslint.config.mjs`, add an override for `src/form-builder/**` with
`no-restricted-imports` banning those same patterns, so the failure surfaces in the
editor rather than only in CI.

**Step 4: Wire into scripts**

```json
"scripts": {
  "lint": "eslint && node scripts/check-engine-boundary.mjs",
  "test": "vitest run",
  "test:e2e": "playwright test",
  "typecheck": "tsc --noEmit"
}
```

**Step 5: Commit**

```bash
git add eslint.config.mjs scripts/check-engine-boundary.mjs package.json
git commit -m "chore: enforce the engine/demo boundary in lint

The engine must stay liftable. This fails the build if demo code leaks into
src/form-builder or a Meridian reference appears there."
```

---

# Phase C — Configuration

## Task 12: Jurisdiction types and the age helper

**Files:**
- Create: `src/config/jurisdictions/types.ts`
- Create: `src/lib/age.ts`
- Test: `src/lib/age.test.ts`

**Step 1: Write the failing test**

Create `src/lib/age.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { latestDobForAge } from "./age";

describe("latestDobForAge", () => {
  it("returns the date exactly N years before the reference date", () => {
    expect(latestDobForAge(18, new Date("2026-07-27T00:00:00Z"))).toBe("2008-07-27");
  });

  it("handles a 29 February reference date without producing an invalid date", () => {
    expect(latestDobForAge(18, new Date("2024-02-29T00:00:00Z"))).toBe("2006-02-28");
  });
});
```

**Step 2: Run to verify it fails**

Run: `yarn vitest run src/lib/age.test.ts`
Expected: FAIL — module not found.

**Step 3: Implement**

`src/lib/age.ts` returns the latest ISO date of birth that still satisfies a
minimum age. Clamp the day when the target month is shorter, so 29 February does
not roll into 1 March.

**Step 4: Create the jurisdiction type**

`src/config/jurisdictions/types.ts`:

```ts
import type { AnyFieldConfig } from "@/form-builder";

/**
 * One jurisdiction's contribution to the application form.
 *
 * A jurisdiction file declares fields only — it never writes a `visibleWhen`.
 * buildFormConfig stamps the country/account-type guard and the badge, so
 * adding a country is one file plus one registry line and no component code.
 */
export type Jurisdiction = {
  /** ISO 3166-1 alpha-2, or "DEFAULT" for the fallback. */
  code: string;
  label: string;
  /** Extra fields shown on the Tax & residency step for individuals. */
  taxFields: AnyFieldConfig[];
  /** Extra fields shown on the Tax & residency step for corporate accounts. */
  corporateTaxFields?: AnyFieldConfig[];
  /** Identity documents this jurisdiction expects, replacing the generic set. */
  documentFields?: AnyFieldConfig[];
  /** Shown when this config resolved via fallback rather than an exact match. */
  fallbackNotice?: string;
};
```

**Step 5: Run and commit**

Run: `yarn vitest run src/lib/age.test.ts` → PASS.

```bash
git add src/config/jurisdictions/types.ts src/lib/age.ts src/lib/age.test.ts
git commit -m "feat(config): add Jurisdiction type and the minimum-age helper"
```

---

## Task 13: The three jurisdictions and the fallback

Each must differ in a way a visitor notices — that is an acceptance criterion, not
a nicety.

**Files:**
- Create: `src/config/jurisdictions/de.ts`, `us.ts`, `ae.ts`, `default.ts`
- Create: `src/config/jurisdictions/index.ts`
- Test: `src/config/jurisdictions/index.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { resolveJurisdiction, JURISDICTIONS } from "./index";

describe("resolveJurisdiction", () => {
  it("returns the exact config for a supported country", () => {
    expect(resolveJurisdiction("DE").code).toBe("DE");
  });

  it("falls back for an unconfigured country and says so", () => {
    const resolved = resolveJurisdiction("FR");
    expect(resolved.code).toBe("DEFAULT");
    expect(resolved.fallbackNotice).toBeTruthy();
  });

  it("falls back for an empty selection", () => {
    expect(resolveJurisdiction("").code).toBe("DEFAULT");
  });

  it("gives every jurisdiction a distinct set of tax field names", () => {
    const names = JURISDICTIONS.map((j) => j.taxFields.map((f) => f.name).join(","));
    expect(new Set(names).size).toBe(names.length);
  });
});
```

**Step 2: Run to verify it fails**, then implement.

**Step 3: Write the jurisdiction files**

- **`de.ts`** — masked `de_steuerId` (`## ### ### ###`, 11 digits, described as issued by the Bundeszentralamt für Steuern); `de_churchTax` radio (yes / no / not applicable).
- **`us.ts`** — `us_state` select using `optionsFrom: { field: "country", map: { US: [...] } }`; masked `us_tin` (`###-##-####`); `us_backupWithholding` checkbox referencing form W-9.
- **`ae.ts`** — masked `ae_emiratesId` (`784-####-#######-#`); `ae_visaStatus` radio (residence visa / golden visa / GCC national); **no TIN at all** — the visible absence is the point.
- **`default.ts`** — `tax_residency` country field and a plain `tax_tin` text field, plus a `fallbackNotice`.

All copy must be original. Placeholders must be obviously fictional.

**Step 4: Write the registry**

```ts
export const JURISDICTIONS = [de, us, ae];
const BY_CODE = new Map(JURISDICTIONS.map((j) => [j.code, j]));
export function resolveJurisdiction(country: string): Jurisdiction {
  return BY_CODE.get(country) ?? fallback;
}
```

**Step 5: Run tests and commit**

```bash
git add src/config/jurisdictions
git commit -m "feat(config): add DE, US and AE jurisdictions with a fallback

Each differs visibly: a masked Steuer-ID and church-tax question for Germany,
a state select and W-9 question for the US, an Emirates ID and visa status for
the UAE with no TIN at all."
```

---

## Task 14: `buildFormConfig`

The architectural centre of the demo. Read the design doc's "One config, not
per-country rebuilds" section before writing this — rebuilding the config per
country invalidates the draft on every country change, because `draftConfigHash`
hashes `config.fields`.

**Files:**
- Create: `src/config/steps.ts`
- Create: `src/config/fields/individual.ts`, `src/config/fields/corporate.ts`
- Create: `src/config/buildFormConfig.ts`
- Test: `src/config/buildFormConfig.test.ts`

**Step 1: Write the failing tests**

```ts
describe("buildFormConfig", () => {
  const config = buildFormConfig();

  it("produces a config the engine accepts", () => {
    expect(() => validateFormConfig(config)).not.toThrow();
  });

  it("includes every jurisdiction's fields in one config", () => {
    const names = config.fields.map((f) => f.name);
    expect(names).toContain("de_steuerId");
    expect(names).toContain("us_tin");
    expect(names).toContain("ae_emiratesId");
  });

  it("guards each jurisdiction field on country and account type", () => {
    const field = config.fields.find((f) => f.name === "de_steuerId")!;
    expect(field.visibleWhen).toEqual([
      { field: "country", equals: "DE" },
      { field: "accountType", equals: "individual" },
    ]);
  });

  it("badges every jurisdiction-conditional field", () => {
    expect(config.fields.find((f) => f.name === "ae_emiratesId")!.badge).toContain("United Arab Emirates");
  });

  it("has a stable hash across calls, so drafts survive", () => {
    expect(draftConfigHash(buildFormConfig().fields)).toBe(draftConfigHash(buildFormConfig().fields));
  });

  it("strips fields for the unselected country from the payload", () => {
    const values = { country: "DE", accountType: "individual", de_steuerId: "12345678901", us_tin: "111-22-3333" };
    expect(Object.keys(stripInvisibleValues(config, values))).not.toContain("us_tin");
  });
});
```

**Step 2: Run to verify it fails**, then implement.

**Step 3: Implement**

`buildFormConfig()` returns a single `FormConfig` wrapped in `defineForm`,
composed of the shared individual fields, the shared corporate fields (each
guarded on `accountType`), and every jurisdiction's fields with the guard and
badge stamped on automatically:

```ts
function guard(field: AnyFieldConfig, code: string, accountType: "individual" | "corporate"): AnyFieldConfig {
  return {
    ...field,
    visibleWhen: [
      { field: "country", equals: code },
      { field: "accountType", equals: accountType },
    ],
    badge: `Required in ${labelFor(code)}`,
  };
}
```

The five steps come from `src/config/steps.ts`, which also exports the slug ↔ index
mapping the router needs:

```ts
export const STEP_SLUGS = ["account-type", "personal-details", "tax-residency", "documents", "review"] as const;
```

The final step is `{ title: "Review", review: true }`.

**Step 4: Run tests and commit**

```bash
git add src/config
git commit -m "feat(config): compose one FormConfig from all jurisdictions

Jurisdiction files declare fields; the builder stamps the country and account
type guard plus the badge. Adding a country touches no component code.

Deliberately one config rather than rebuilding per country: draftConfigHash
hashes config.fields, so a rebuild would drop the saved draft every time the
visitor changed country."
```

---

## Task 15: Sample data

**Files:**
- Create: `src/config/sampleData.ts`
- Test: `src/config/sampleData.test.ts`

**Step 1: Write the failing test**

Assert that for each of DE, US, AE and a fallback country, the sample values
**validate against the built schema** — a sample-data button that produces invalid
data is worse than no button. Also assert every string is unmistakably fictional
(names drawn from a fixed invented set; no real-format identifiers).

**Step 2: Run to verify it fails**, then implement per-step, per-jurisdiction values.

**Step 3: Commit**

```bash
git add src/config/sampleData.ts src/config/sampleData.test.ts
git commit -m "feat(config): add per-jurisdiction sample data, schema-verified"
```

---

# Phase D — Application shell

## Task 16: Theme tokens and fonts

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`

Set the palette on the shadcn tokens: neutral grey surfaces, near-black text,
accent `#0F5C5A`. Semantic colours are desaturated — ochre warning, muted forest
pass, brick fail — never saturated traffic-light blocks.

Load Inter Tight and JetBrains Mono through `next/font/google` so they are
self-hosted; a third-party font request would violate the zero-external-request
rule and cost Lighthouse points. Bind the mono face to `--font-mono` so the
engine's file sizes and masked values pick it up automatically.

The engine's field components size themselves from `--fb-space-*` custom
properties with `vw` fallbacks. Define those in `globals.css` for the institutional
spacing scale rather than overriding component classes.

Commit: `feat(theme): institutional palette, Inter Tight and JetBrains Mono`

---

## Task 17: The demo banner

**Files:**
- Create: `src/components/DemoBanner.tsx`
- Modify: `src/app/layout.tsx`

Renders in the **root** layout so it cannot be missed on any screen, including
success. No dismiss control. Text: *"Demo only — no data is sent anywhere, no
files are uploaded, nothing is stored on a server."*

Commit: `feat(ui): add the persistent demo-safety banner`

---

## Task 18: The application shell

**Files:**
- Create: `src/app/apply/layout.tsx`
- Create: `src/app/apply/[step]/page.tsx`
- Create: `src/components/ApplicationShell.tsx`
- Create: `src/components/ResumedNotice.tsx`

`FormRenderer` mounts in `apply/layout.tsx`. Next 16 guarantees this is safe —
`node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md:43`:
*"On navigation, layouts preserve state, remain interactive, and do not rerender."*
A `template.tsx` would remount and lose the form; do not add one.

`ApplicationShell` is a client component that:
- reads the slug with `useParams()` and maps it to an index via `STEP_SLUGS`
- passes `step` and `onStepChange` to `FormRenderer` (`onStepChange` pushes the route, and must no-op when the slug already matches, or the mount-time call will fire a redundant navigation)
- passes `stepperOrientation="vertical"` and `autosave={{ storage: "session" }}`
- passes `onDraftRestore` to raise `ResumedNotice`
- redirects to the furthest valid step when someone deep-links ahead of their progress
- renders a "Fill with sample data" button per step, calling `form.reset` with the merged sample values

`[step]/page.tsx` is a thin server component with `generateStaticParams` over
`STEP_SLUGS`, returning `null` — the layout renders everything. Add a comment
saying so, since an empty page is otherwise confusing to a reader.

Add the live region announcing step changes here (the engine focuses the step
list, which is good, but the brief also asks for an announcement).

Commit: `feat(app): route-per-step shell with resumable progress`

---

## Task 19: The `document` field type

The README's worked example for "how to add a field type", and where the simulated
upload progress lives — progress is host policy, which is why it is not in the engine.

**Files:**
- Create: `src/fields/document.tsx`
- Modify: `src/fields/registerBuiltInFields.ts` (the one registration point)
- Test: `src/fields/document.test.tsx`

Composes the engine's exported `FileDropzone` and `acceptedFormatsLabel`, adding a
timer-driven progress bar per file. Nothing leaves the page — say so in a comment
at the top of the file, since a reviewer will look here first.

**Corrected against the code, twice.**

1. *Registration point.* The plan said `src/app/layout.tsx`. That is a server
   component: importing `"use client"` field components there registers them in
   the server graph and leaves the browser registry empty. There is exactly one
   registration point and it is `registerBuiltInFields.ts`.

2. *Not a new `type` string.* `DocumentField` is registered **for `file`**, not
   as a `document` type of its own, and the config keeps `type: "file"`. The
   engine does accept custom types — `validateFormConfig` allows any type in the
   registry — but `buildFieldsSchema` hands every non-built-in field
   `z.unknown().optional()` (`core/validation.ts:468`). Moving the document
   fields onto a custom type would silently drop `required`, `accept` and
   `maxSizeMB`: the required photo ID would stop gating Submit and a TIFF would
   be accepted in silence. It would also remove the field's own foundation —
   every per-file verdict is read from react-hook-form's per-index errors, which
   exist only because the *built-in* schema raised one issue per index, and the
   only replacement would be to judge files in the component, which is exactly
   what `fileMatchesAccept` is unexported to prevent.

   So the README's worked example is "put your own component behind a field
   type", which is the registry's other purpose and the one that is safe to
   recommend. `document.tsx` states the whole argument at the top.

Commit: `feat(fields): add the document field with simulated upload progress`

---

## Task 20: Success state and the server-reuse example

**Files:**
- Create: `src/components/SuccessPanel.tsx`
- Create: `src/server/parseApplication.example.ts`
- Modify: `src/components/ApplicationShell.tsx` (reconcile the success state with
  the URL)

`SuccessPanel` shows a monospace application reference and states explicitly that
no data was transmitted.

It also closes the one place the shell's thesis broke: submitting and then
pressing Back left "Application complete" on screen at `/apply/documents` with the
live region announcing "Step 4 of 5, Documents". Success is **not** given its own
slug — `/apply/complete` could never be honoured on a reload or a deep link,
because submitting clears the draft, and a URL that cannot be reloaded,
bookmarked or shared is state wearing a route's clothes. Instead the reference is
state that belongs to the review step, and any URL that is not the review step
ends it; the guard then does the honest thing with an emptied application and
sends it back to step 1.

`parseApplication.example.ts` is real, typechecked `parseSubmission` code that
nothing imports — a stronger demonstration than the comment the brief asked for.
Head it with a comment explaining that it is deliberately unwired, so a reader does
not mistake it for dead code and delete it.

Commit: `feat(app): success state and an unwired server-validation example`

---

# Phase E — Verification, docs, deploy

## Task 21: Playwright — keyboard completion and network silence

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/keyboard-flow.spec.ts`
- Create: `e2e/no-data-egress.spec.ts`

`keyboard-flow.spec.ts` completes the entire flow using only keyboard input, from
the first field to submit, and asserts the success panel appears.

`no-data-egress.spec.ts` registers a `request` listener, walks the flow with sample
data, and asserts that **no** request URL or post body contains any sample-data
sentinel string. This converts the "zero requests carrying form input" requirement
from a manual DevTools check into a test that runs on every commit.

Commit: `test(e2e): keyboard completion and a data-egress guard`

---

## Task 22: Work the acceptance checklist

Go through section 8 of the brief one item at a time, run each check, and record the
actual result. Do not mark an item done from inspection — @superpowers:verification-before-completion.

**Worked 2026-07-28.** Every item below was driven in Chrome (chrome-devtools) against
`yarn build && yarn start`, or by a Playwright run against the same production server.
Nothing here is marked from reading the code.

Two corrections to the checklist itself, established during the build:

1. **The country field is on the tax-residency step, not step 1.** It was moved there
   deliberately — `us_state` reads its options from it through `optionsFrom`, and the
   engine's config validator warns when an `optionsFrom` source sits on a different
   step. So item one is really "changing country changes the fields around it".
2. **The documents step is identical for US, AE and the fallback.** All individual-branch
   differentiation lives on the tax step; a jurisdiction-specific upload exists only for
   DE (Meldebescheinigung) and in the corporate branch. The documents step does not
   demonstrate jurisdiction branching and should not be claimed to.

- [x] Changing country changes the fields around it — DE → Steuer-ID (masked
      `## ### ### ###`) + church-tax radio; US → searchable state select fed by the
      country + masked `###-##-####` TIN + backup-withholding checkboxes; AE → a
      static "no personal income tax, so no taxpayer number" note + Emirates ID
      (`784-####-#######-#`) + visa-status radio + emirate select; FR → the fallback's
      notice + country-of-tax-residence + free-text TIN + self-declaration. Every field
      carries the "Required in <jurisdiction>" badge. With no country chosen the step
      shows the country field alone.
- [x] All three jurisdictions differ noticeably — see above; the control *types* differ,
      not just the labels.
- [x] `.tiff` rejected with a specific reason — row `data-status="rejected"`, no upload
      bar ever started, message: `scan.tiff isn't in a format we accept (TIFF) — please
      upload JPG, JPEG, PNG or PDF`.
- [x] Oversized file rejected before processing — a 7.00 MB PNG on a 5 MB field:
      `File must be smaller than 5 MB`, no `role="progressbar"` was ever created for it,
      and no request was made. `grep -rn "FileReader\|createObjectURL\|arrayBuffer()\|
      FormData\|fetch(\|XMLHttpRequest\|sendBeacon" src/` returns nothing, so there is no
      code path that could have read it.
- [x] Under-18 DOB gives a human message — picking 15 July 2015 raises
      `You must be 18 or older to open a Meridian Markets account.` immediately, and Next
      stays on the step.
- [x] Refresh mid-flow restores and says so — reload on `/apply/documents` stayed on step
      4 and showed "Your answers are back… Files are never kept, so any documents you had
      chosen need choosing again." All values verified back, including the two that have
      regressed before: the step-1 `accountPurpose` select and the church-tax radio.
- [x] Keyboard-only completion works — `e2e/keyboard-flow.spec.ts`, green.
- [x] Banner visible on every step including success — checked on all five steps and on
      the success panel.
- [x] Zero requests carrying form input — `e2e/no-data-egress.spec.ts`, green; and
      confirmed by hand in DevTools: 37 requests over a complete flow, all GET, all
      same-origin, all either static assets or Next RSC prefetches of the five step
      routes. No POST at all.
- [ ] **Lighthouse mobile performance ≥ 90 — FAILS on the form routes.** Measured with
      Lighthouse 12.8.2, mobile, default simulated throttling, against `yarn build &&
      yarn start`, three runs each: `/` scores 82 / 94 / **96** (median 94, passes);
      `/apply/account-type` scores 65 / **70** / 73 (median 70). CLS is 0 everywhere.
      The cause is one 286 KiB gzipped client chunk (1.1 MB raw) of which Lighthouse
      reports ~195 KiB unused on the first step, and ~1.4 s of main-thread script
      evaluation: LCP is 91 % "render delay". The measured ceiling of the proportionate
      fixes is **76** — stubbing out the entire 250-flag SVG barrel that
      `react-phone-number-input/flags` exports and both `CountryField` and `PhoneField`
      import wholesale took one run from 60 to 69, and dropping the JetBrains Mono
      preload on top of it reached 76. Neither was kept: the flags stub removes the flags
      from both country selectors for five points, and repeated runs showed the font
      change is inside the noise (FCP is bimodal at 1.06 s / 3.02 s on this hardware
      whether or not mono is preloaded, which is what the single-run "60 → 71" reading
      earlier was). Closing the remaining gap means not shipping the form engine to the
      first paint, which is the thing the demo exists to show. Re-measure against the
      deployed URL in Task 24; the localhost server, Chrome and the test runner were all
      competing for the same machine here.
- [x] No console errors or warnings — zero console messages of any type over a complete
      flow from `/` through submit on a production build.
- [x] `grep -ri meridian src/form-builder/` empty — and no `@/` import of any kind in the
      engine; `scripts/check-engine-boundary.mjs` passes over all 67 files.

Fix what fails; commit fixes individually.

---

## Task 23: README

**Files:** `README.md`

Cover what the demo proves, the field-registry decision and why config-driven beat
per-step JSX, how to add a jurisdiction (with `de.ts` as a worked example), how to
add a field type (pointing at `src/fields/document.tsx`), and the demo-safety
constraints with the checks that enforce them.

State plainly that `yarn` is used rather than `pnpm`, so nobody trips over the
brief's `pnpm lint`.

Commit: `docs: add README covering architecture and demo-safety constraints`

---

## Task 24: Deploy

**Step 1: Final gate**

```bash
yarn lint && yarn typecheck && yarn test && yarn test:e2e
```
All four must pass. Report the real output.

**Step 2: Deploy**

```bash
yarn dlx vercel@latest deploy --prod
```

**Step 3: Verify the deployed URL** — banner present, all three jurisdictions
behave, DevTools Network shows nothing carrying input, Lighthouse mobile ≥ 90.

**Step 4: Open the engine PR**

The Phase A branch is independently useful. Push `feat/kyc-hardening` and open a PR
describing the eight changes and that all are backwards-compatible.

---

## Open items for the human

1. **Package manager** — plan uses `yarn` in both repos; the brief said `pnpm lint`. Say if you want the switch instead.
2. **Engine PR** — Task 24 pushes a branch and opens a PR rather than merging to `master`. Confirm before merging.
3. **Corporate depth** — Task 14 gives corporate a full second branch (entity name, registration number, incorporation date, UBO group). If that proves heavier than it is worth once running, it can be cut to the thin version without touching the engine.
