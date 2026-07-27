"use client";

import { useMemo } from "react";
import { APPLICATION_FORM } from "@/config/applicationForm";
import { sampleValuesForStep } from "@/config/sampleData";
import type { FormHandleSink } from "@/fields/formHandle";

/**
 * "Fill this step with sample data".
 *
 * ## Per step, not once for the whole form
 *
 * A single button that filled all five steps would be quicker and would destroy
 * the thing this demo exists to show. The interesting behaviour is what happens
 * *between* steps: choose Germany and the tax step grows a Steuer-ID and a
 * church-tax question; choose France and the same step offers a self-declared
 * TIN and says why. A visitor who arrives on the review screen with everything
 * already filled has watched none of it. Filling one step at a time keeps the
 * visitor making the two choices that drive the branching — account type and
 * country — and the sample follows those choices rather than overriding them:
 * `sampleValuesForStep` reads the current answers and returns the profile for
 * the branch they are actually on.
 *
 * It is also the only version that is honest about the documents step, where
 * the correct sample is no sample at all.
 *
 * ## Why `reset` and not a run of `setValue`
 *
 * `beneficialOwners` is a `group`, backed by `useFieldArray`. Only `reset`
 * resynchronises a field array's rows; `setValue` on the array updates the
 * values and leaves the rendered rows behind. The current values are spread
 * underneath so this fills a step without disturbing the other four — including
 * any `File` the visitor has already chosen, which is held in form state and
 * would otherwise be dropped.
 */
export function SampleDataButton({
  stepIndex,
  form,
}: {
  stepIndex: number;
  form: FormHandleSink;
}) {
  /**
   * Whether this step has anything a sample could supply. Computed against an
   * empty context because the answer is a property of the step, not of the
   * visitor: steps 1–3 always hold fillable fields, the documents step holds
   * only `file` fields (which `sampleValuesForStep` excludes) and the review
   * step declares no fields at all.
   */
  const fillable = useMemo(
    () => Object.keys(sampleValuesForStep(APPLICATION_FORM, stepIndex, {})).length > 0,
    [stepIndex],
  );

  if (!fillable) return null;

  const fill = () => {
    const handle = form.current;
    if (!handle) return;
    const current = handle.getValues();
    const sample = sampleValuesForStep(APPLICATION_FORM, stepIndex, {
      accountType: typeof current.accountType === "string" ? current.accountType : undefined,
      country: typeof current.country === "string" ? current.country : undefined,
    });
    handle.reset({ ...current, ...sample });
  };

  return (
    <button
      type="button"
      onClick={fill}
      className="min-h-11 rounded-md border border-dashed border-border px-3 text-detail font-medium text-muted-foreground transition-colors hover:border-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
    >
      Fill this step with sample data
    </button>
  );
}
