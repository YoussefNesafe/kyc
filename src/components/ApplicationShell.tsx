"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  APPLICATION_DRAFT_STORAGE,
  APPLICATION_FORM,
  APPLICATION_FORM_ID,
} from "@/config/applicationForm";
import { furthestAvailableStep } from "@/config/progress";
import { stepPath } from "@/config/routes";
import { STEP_SLUGS, slugForStepIndex, stepIndexForSlug } from "@/config/steps";
import { FormHandleProvider, type FormHandle } from "@/fields/formHandle";
import { registerBuiltInFields } from "@/fields/registerBuiltInFields";
import { draftConfigHash, loadDraft } from "@/form-builder/core/autosave";
import type { FormValues } from "@/form-builder/core/types";
import { FormRenderer, type DraftRestoreInfo } from "@/form-builder/components/FormRenderer";
import { ProgressNotice, ResumedNotice } from "./ResumedNotice";
import { SampleDataButton } from "./SampleDataButton";

/**
 * The application, and everything about it that is the host's job rather than
 * the engine's.
 *
 * ## Why this mounts in a layout and the page renders nothing
 *
 * `/apply/[step]` is one route per step, and the form must survive moving
 * between them. Next 16 guarantees that for a layout and only for a layout:
 * *"On navigation, layouts preserve state, remain interactive, and do not
 * rerender"* (`node_modules/next/dist/docs/01-app/01-getting-started/
 * 03-layouts-and-pages.md:43`). A `template.tsx` is the same file with the
 * opposite promise — it remounts — and would throw away every answer on every
 * Next. So the whole form lives here, in `apply/layout.tsx`, and the page under
 * it exists to name the route and 404 an unknown slug.
 *
 * ## What the engine owns and what this owns
 *
 * The engine owns the step: `step` is a request, not a value it renders from.
 * It validates before Next, bounces off a step that has hidden under the
 * visitor, jumps to a server error's field, and reports wherever it actually
 * landed through `onStepChange`. That callback is documented as silent on mount
 * and silent for any step the host itself passed, which is what makes
 * `onStepChange={(s) => router.push(stepPath(s))}` safe to write literally —
 * there is no `if (slug === next) return` guard below because adding one would
 * be guarding against a call the engine does not make.
 *
 * This component owns: the URL, the 404, the progress guard, the resumed-draft
 * notice, the step announcement, and the demo's sample-data affordance.
 *
 * ## `step` is derived, never stored
 *
 * `stepIndex` below is computed during render from `useParams()`. There is no
 * `useState` holding the step and no effect that sets it after a navigation
 * commits, which is the lag the engine's `step` documentation warns about: a
 * `step` that arrives a tick late can drag a visitor forward over a Back they
 * just pressed, and can swallow the report of a Back to the step the host still
 * holds. Both artifacts are properties of a host that echoes the step through
 * state; neither can occur when the value is read straight off the render's own
 * params.
 *
 * What remains is the router's own commit latency — the URL changes when the
 * navigation commits, not when `push` is called — and no host can remove that.
 * It is minimised rather than ignored: every step route is statically generated
 * (`generateStaticParams`) and prefetched on mount, so the commit is a client
 * router transition with nothing to fetch.
 */

registerBuiltInFields();

const STEPS = APPLICATION_FORM.steps ?? [];
const DOCUMENTS_STEP = stepIndexForSlug("documents") ?? -1;
const REVIEW_STEP = stepIndexForSlug("review") ?? -1;
const DRAFT_HASH = draftConfigHash(APPLICATION_FORM.fields);

function stepTitle(index: number): string {
  return STEPS[index]?.title ?? "";
}

/**
 * The answers the guard reasons about.
 *
 * The live form is the truth whenever there is one — it holds the keystroke the
 * autosave debounce has not written yet, which matters because the engine
 * navigates the instant its own validation passes and the guard must not
 * disagree with it half a second later.
 *
 * The stored draft is the fallback for the one case where there is no live form
 * to ask: a cold deep link onto a step whose fields are all hidden (the
 * documents step before an account type is chosen renders nothing, so no field
 * has published a handle). That is precisely the case the guard exists for, and
 * a debounce race cannot apply to it, because nothing has been typed.
 */
function currentValues(form: FormHandle | null): FormValues {
  if (form) return form.getValues();
  return loadDraft(APPLICATION_FORM_ID, DRAFT_HASH, APPLICATION_DRAFT_STORAGE)?.values ?? {};
}

export function ApplicationShell() {
  const router = useRouter();
  const params = useParams<{ step: string | string[] }>();
  const slug = Array.isArray(params.step) ? params.step[0] : params.step;
  const stepIndex = slug === undefined ? undefined : stepIndexForSlug(slug);

  const form = useRef<FormHandle | null>(null);
  const [resumed, setResumed] = useState<DraftRestoreInfo | null>(null);
  const [blocked, setBlocked] = useState<{ requested: number; landed: number } | null>(null);
  const [submitted, setSubmitted] = useState(false);

  /**
   * The router, reached through a ref so that `goToStep` — and therefore the
   * guard effect that depends on it — is stable for the life of the mount.
   *
   * Nothing documents `useRouter()`'s return value as referentially stable, and
   * a version of it that is not turns this component into a loop with teeth:
   * the guard would re-run on every render, re-parsing the whole form to decide
   * whether the step is allowed, and re-issuing the redirect that caused the
   * render. Depending on a ref instead makes the guard a function of the step
   * alone, which is what it actually is.
   */
  const routerRef = useRef(router);
  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  const goToStep = useCallback((index: number, mode: "push" | "replace") => {
    const target = slugForStepIndex(index);
    if (!target) return;
    routerRef.current[mode](stepPath(target));
  }, []);

  /**
   * The engine reporting where it landed, turned into a URL.
   *
   * The clamp is not defensive decoration — without it this and the progress
   * guard below can drive each other in a loop, and the loop is reachable:
   *
   * 1. Someone opens `/apply/review` with nothing answered. The engine is asked
   *    for step 4 and goes there; the guard, running after it, replaces the URL
   *    with step 0.
   * 2. In the commit that carries the new `step={0}`, the engine's store has
   *    only just settled on 4. Its report fires for the move it made a moment
   *    ago, compares 4 against the `step` it can now see — 0 — finds them
   *    different, and reports 4. Correctly: from where it stands, that is a
   *    move the host does not know about.
   * 3. Unclamped, this pushes `/apply/review` straight back, and the guard
   *    replaces it again. Forever.
   *
   * Reproduced in the shell's own tests, where the router is synchronous. A real
   * router's commit latency usually lets the two settle in order, which is worse
   * rather than better: it makes the failure a race that shows up on a fast
   * machine, in a browser nobody tested, once.
   *
   * Clamping fixes it at the only place the URL is ever written from inside the
   * app: the host never names a step the answers do not support, so the echo
   * resolves to the URL already showing and the cycle has nowhere to go. It also
   * silently does the right thing for the case that motivated the guard — a
   * draft restored past the documents step, whose files cannot come back with
   * it, lands on documents instead of bouncing off review.
   */
  const handleStepChange = useCallback(
    (next: number) => {
      const available = furthestAvailableStep(APPLICATION_FORM, currentValues(form.current));
      const target = Math.min(next, available);
      // The resume notice retires here, in the callback, rather than from an
      // effect watching the step. `onDraftRestore` fires *before* the engine
      // reports the restored step, so "clear whenever the step changes" would
      // wipe the notice on the very navigation the restore caused — the mistake
      // this file made twice. Comparing against the step the draft recovered
      // means the arrival keeps it and only moving on past it does not.
      setResumed((previous) => (previous && target > (previous.step ?? 0) ? null : previous));
      goToStep(target, "push");
    },
    [goToStep],
  );

  /**
   * Re-applies the draft the engine has just restored, and then says so.
   *
   * ## The bug this exists for
   *
   * A `select` that is *on screen* when the draft lands does not keep its
   * restored value. Measured, not inferred: with a draft holding
   * `accountPurpose: "long-term"`, `fullName` and `de_churchTax`, opening the
   * first step — the only step whose `select` is mounted — restored the other
   * two and left `accountPurpose` undefined; opening the second step, where the
   * same field is off screen, restored all three. The visible consequence is
   * worse than a blank control: the visitor resumes, presses Continue, and
   * nothing happens, because the wizard is gating on a field they cannot see
   * they have lost. That was the state of the demo's headline feature until this
   * was traced.
   *
   * The cause is inside the engine's `SelectField`, in its Radix `Select` — the
   * one control here whose options are not mounted while it is closed — and
   * `src/form-builder/` is not editable from this repo. So the fix is placed
   * where a host can put it.
   *
   * ## Why re-applying works
   *
   * `onDraftRestore` fires a commit *after* the restore, by which point every
   * control is mounted and settled: the same values applied then survive, which
   * is exactly what the "Fill with sample data" button demonstrates a hundred
   * times a day. The values come from the store rather than from a copy, so this
   * cannot disagree with what was restored, and re-applying values a field
   * already holds is a no-op for every field that did not drop one.
   */
  const handleDraftRestore = useCallback((info: DraftRestoreInfo) => {
    const handle = form.current;
    const draft = loadDraft(APPLICATION_FORM_ID, DRAFT_HASH, APPLICATION_DRAFT_STORAGE);
    if (handle && draft) handle.reset({ ...handle.getValues(), ...draft.values });
    setResumed(info);
  }, []);

  const handleSubmit = useCallback(() => {
    setSubmitted(true);
  }, []);

  // Every step is a static route; warming them on mount makes each `push` a
  // client transition with nothing left to fetch, which is what keeps the
  // window between the engine's move and the URL catching up down to a frame.
  useEffect(() => {
    for (const stepSlug of STEP_SLUGS) routerRef.current.prefetch(stepPath(stepSlug));
  }, []);

  /**
   * The progress guard.
   *
   * Runs on every step the URL names, not only the first, because the address
   * bar is not the only way to name one: the browser's forward button, a
   * restored tab and a bookmark all arrive the same way. `replace` rather than
   * `push`, so the rejected URL does not become a Back destination that bounces
   * the visitor a second time.
   */
  useEffect(() => {
    if (stepIndex === undefined || submitted) return;
    const available = furthestAvailableStep(APPLICATION_FORM, currentValues(form.current));
    if (stepIndex > available) {
      setBlocked({ requested: stepIndex, landed: available });
      goToStep(available, "replace");
      return;
    }
    /**
     * Re-validate the whole form on arrival at the review step, because
     * otherwise Submit is disabled and nothing says why.
     *
     * Found by walking the flow in Chrome. The engine's `SubmitField` disables
     * itself on `!formState.isValid`, and the wizard's Next gate calls
     * `form.trigger(currentFieldNames)` — a *subset* trigger, which
     * react-hook-form does not use to recompute `isValid`. So a visitor who has
     * answered every question correctly arrives at the review step with
     * `isValid === false` and a dead Submit button, and nothing on that step
     * changes a value, so nothing ever recomputes it. Measured in the page:
     * `isValid` was `false` on arrival and `true` immediately after a bare
     * `trigger()`, with `errors` empty in both readings.
     *
     * It sits inside the guard, after the redirect has been ruled out, and that
     * placement is load-bearing rather than tidy. A `trigger()` marks every
     * visible field, so it may only run where the answers are known to be
     * complete — which is exactly what reaching this line means. In its first
     * version this was an effect of its own, and a cold load of `/apply/review`
     * with a restored draft ran it before the redirect landed: the visitor
     * arrived on the documents step with "This field is required" already under
     * two uploads they had never been shown. Seen in the browser, not in a test.
     */
    if (stepIndex === REVIEW_STEP) void form.current?.trigger();
  }, [stepIndex, submitted, goToStep]);

  const autosave = useMemo(() => ({ storage: APPLICATION_DRAFT_STORAGE }), []);

  /**
   * The guard's notice belongs to the step it sent the visitor to, and is
   * derived rather than unset from an effect for the same reason the resume
   * notice is retired in a callback: the redirect that raises it is itself a
   * step change, so an effect that cleared notices on step changes would erase
   * this one as it was being painted.
   */
  const showBlocked = blocked !== null && blocked.landed === stepIndex;

  /**
   * An unknown slug renders nothing at all, leaving the 404 the page raised as
   * the only thing on screen — a not-found message sitting under a live
   * application form would read as a rendering bug. The form is not lost by
   * this: `/apply/nonsense` is not a step, and coming back to a real one
   * restores the draft from the same session store.
   */
  if (stepIndex === undefined) return null;

  return (
    <div className="shell flex flex-col gap-8 py-10 tablet:py-12">
      <header className="flex flex-col gap-3">
        <h1 className="text-h2">{APPLICATION_FORM.title}</h1>
        {APPLICATION_FORM.description && (
          <p className="max-w-[var(--measure)] text-detail text-muted-foreground text-pretty">
            {APPLICATION_FORM.description}
          </p>
        )}
      </header>

      {/*
        The step announcement.

        The engine deliberately ships no live region. It moves focus to the
        labelled step list — which re-reads the list and its `aria-current`
        item — and documents the wording of an announcement as host copy,
        because "Step 2 of 5, Your details" needs interpolation its message
        bundle has no slot for. This is that copy.

        Rendered rather than pushed into state from an effect, and the
        difference is not stylistic. A live region's *initial* content is not
        announced; only later changes are. Since this element is in the first
        paint with its text already in it, arriving on a page says nothing —
        the heading is about to be read anyway — and every step change after
        that is announced, with no effect, no cascading render, and nothing to
        keep in sync with the URL it is derived from.

        `polite`, so it queues behind the engine's focus move instead of
        talking over it.
      */}
      <p aria-live="polite" className="sr-only">
        {`Step ${stepIndex + 1} of ${STEPS.length}, ${stepTitle(stepIndex)}`}
      </p>

      {resumed && (
        <ResumedNotice
          filesCleared={resumed.step !== undefined && resumed.step >= DOCUMENTS_STEP}
          onDismiss={() => setResumed(null)}
        />
      )}

      {showBlocked && blocked && (
        <ProgressNotice
          requestedTitle={stepTitle(blocked.requested)}
          landedTitle={stepTitle(blocked.landed)}
          onDismiss={() => setBlocked(null)}
        />
      )}

      {submitted ? (
        <SubmittedPanel
          onRestart={() => {
            setSubmitted(false);
            setResumed(null);
            goToStep(0, "push");
          }}
        />
      ) : (
        <>
          {/*
            The demo's own chrome, kept outside the questions and out of the tab
            order of the form itself. It is absent on the review step, which asks
            for nothing and so has nothing to offer or explain — an earlier
            version left "Short of time? The sample data is…" sitting above a
            step with no button under it, which reads as a control that failed
            to render.
          */}
          {stepIndex !== REVIEW_STEP && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-y border-border py-3">
              <p className="text-note text-muted-foreground">
                {stepIndex === DOCUMENTS_STEP
                  ? "Attach whatever you like — files are read in this tab and never uploaded."
                  : "Short of time? The sample data is invented and safe to submit."}
              </p>
              <SampleDataButton stepIndex={stepIndex} form={form} />
            </div>
          )}

          <FormHandleProvider value={form}>
            <FormRenderer
              config={APPLICATION_FORM}
              step={stepIndex}
              onStepChange={handleStepChange}
              onDraftRestore={handleDraftRestore}
              onSubmit={handleSubmit}
              stepperOrientation="vertical"
              autosave={autosave}
            />
          </FormHandleProvider>
        </>
      )}
    </div>
  );
}

/**
 * The end of the flow, in the smallest form that tells the truth. Task 20
 * replaces this with `SuccessPanel`, which adds the application reference; it
 * is here now so the walk-through has an end rather than a form that clears its
 * own draft and sits there.
 */
function SubmittedPanel({ onRestart }: { onRestart: () => void }) {
  return (
    <div role="status" className="flex flex-col items-start gap-4 rounded-md border border-border bg-card p-6">
      <h2 className="text-h3">Application complete</h2>
      <p className="max-w-[var(--measure)] text-detail text-muted-foreground text-pretty">
        It validated, and it went nowhere. There is no server behind this form:
        nothing was transmitted, no file was uploaded, and the draft this tab was
        holding has been cleared.
      </p>
      <button
        type="button"
        onClick={onRestart}
        className="min-h-11 rounded-md bg-primary px-5 text-ui font-medium text-primary-foreground transition-colors hover:bg-[var(--primary-hover)]"
      >
        Start again
      </button>
    </div>
  );
}
