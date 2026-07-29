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
import { DEFERRED_FIELD_LOADERS } from "@/fields/deferred";
import { FormHandleProvider, type FormHandle } from "@/fields/formHandle";
import { registerBuiltInFields } from "@/fields/registerBuiltInFields";
import { draftConfigHash, loadDraft } from "@/form-builder/core/autosave";
import type { FormValues } from "@/form-builder/core/types";
import { FormRenderer, type DraftRestoreInfo } from "@/form-builder/components/FormRenderer";
import { ProgressNotice, ResumedNotice } from "./ResumedNotice";
import { SampleDataButton } from "./SampleDataButton";
import { SuccessPanel, newApplicationReference } from "./SuccessPanel";

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
/**
 * Both fall back to a value that makes every comparison against them *false*,
 * so a slug that went missing turns the feature off rather than turning it on
 * for everyone. `DOCUMENTS_STEP` is the one that had it backwards: it is read
 * as `resumed.step >= DOCUMENTS_STEP`, and a `-1` there is satisfied by every
 * restore, so every resumed draft would have claimed that files were cleared —
 * including one saved on step 1, where nothing has been attached and the
 * sentence is simply untrue. `REVIEW_STEP` is read as `stepIndex === …`, which
 * a `-1` already fails; it is written the same way so the pair cannot be
 * mistaken for two different intentions.
 */
const DOCUMENTS_STEP = stepIndexForSlug("documents") ?? Number.MAX_SAFE_INTEGER;
const REVIEW_STEP = stepIndexForSlug("review") ?? Number.MAX_SAFE_INTEGER;
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
  /**
   * The submitted application's reference, and the fact that there is one.
   * Null is the whole of "not submitted" — a separate boolean beside it could
   * disagree with it, and the two would be reconciled with the URL separately.
   */
  const [reference, setReference] = useState<string | null>(null);
  const submitted = reference !== null;

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
    setReference(newApplicationReference());
    // The handle is about to dangle. This render replaces `FormRenderer` with
    // the success panel, and the sink is only ever written from a field's mount
    // effect, so nothing else clears it. Left in place it would answer the
    // progress guard with the submitted answers off a form that no longer
    // exists — so a Back out of the success panel would find every step still
    // unlocked, on an application that has been cleared. Dropping it makes
    // `currentValues` fall through to the draft, which the engine has just
    // emptied, which is the truth.
    form.current = null;
  }, []);

  // Every step is a static route; warming them on mount makes each `push` a
  // client transition with nothing left to fetch, which is what keeps the
  // window between the engine's move and the URL catching up down to a frame.
  useEffect(() => {
    for (const stepSlug of STEP_SLUGS) routerRef.current.prefetch(stepPath(stepSlug));
  }, []);

  /**
   * The same idea for the field components the first step does not render.
   *
   * `country`, `phone`, `date` and `file` are code-split (see
   * `src/fields/deferred.ts`), which is what keeps the 250-flag SVG barrel and
   * the date picker out of step one's bundle. The cost of that split, left
   * alone, is paid on the step that first needs one: the chunk is requested
   * during the navigation and the field pops in behind it.
   *
   * So the split is undone in time rather than in space. Prefetching the routes
   * above is the expensive part of arriving at step two; this rides along behind
   * it and puts the field modules in the module cache while the visitor is still
   * reading step one. By the time Next is asked to render one, `import()`
   * resolves from cache and there is nothing to wait for.
   *
   * `requestIdleCallback` so none of this competes with making the FIRST step
   * interactive — that is the whole point of having split them. Safari still has
   * no `requestIdleCallback`, hence the `setTimeout` fallback; the delay is
   * arbitrary and only needs to be past the first paint.
   */
  useEffect(() => {
    const warm = () => {
      for (const load of DEFERRED_FIELD_LOADERS) {
        // A failed warm is not an error: the component is still registered and
        // will load on demand when the step that needs it renders. Swallowing
        // it here keeps a flaky network from putting an unhandled rejection in
        // the console of a page that is working correctly.
        void load().catch(() => {});
      }
    };

    if (typeof window.requestIdleCallback === "function") {
      const handle = window.requestIdleCallback(warm);
      return () => window.cancelIdleCallback(handle);
    }

    const handle = window.setTimeout(warm, 1_500);
    return () => window.clearTimeout(handle);
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
     * Re-publish the form's validity on arrival at the review step, because
     * otherwise Submit is disabled and nothing says why.
     *
     * ## Not the subset trigger
     *
     * An earlier version of this comment blamed the wizard's Next gate for
     * calling `form.trigger(currentFieldNames)` — a *subset* trigger — and
     * claimed react-hook-form does not recompute `isValid` from one. That is
     * false, and it was stated confidently. With a resolver present, `trigger`
     * runs the resolver and takes `isValid = isEmptyObject(errors)` from its
     * *whole* error object (`react-hook-form/dist/index.esm.mjs:2650-2700`),
     * and `@hookform/resolvers` keeps every issue the schema raised whatever
     * `names` it was handed (`toNestErrors` iterates the errors, not the
     * names). The subset only narrows which errors are written into
     * `formState.errors`; the verdict is always the full form's.
     *
     * ## The lazy formState proxy, and the order things subscribe in
     *
     * `formState` is a proxy whose getters double as the subscription: reading
     * `formState.isValid` is what marks `isValid` on `control._proxyFormState`,
     * and only a key marked *there* makes `shouldRenderFormState` re-render the
     * root `useForm`. Nothing reads it until `SubmitField` mounts — and
     * `SubmitField` only exists on this step. `useDynamicForm` never touches
     * `formState` at all, so for the whole journey up to here the root has no
     * subscription to `isValid` and never re-renders for one. The snapshot
     * `FormProvider` hands down therefore stays at the `isValid: false` it was
     * created with. `SubmitField` mounts, reads that stale snapshot, disables
     * itself, and *then* subscribes — by which time the review step changes no
     * value, so nothing publishes `isValid` again and the button never wakes.
     *
     * Measured in Chrome with this line switched off, at the moment Submit
     * rendered disabled: internal `control._formState.isValid` `true`, the
     * react-side `formState.isValid` `false`, internal `errors` `[]`. And the
     * confirming half — with the line still off, marking
     * `_proxyFormState.isValid` on step 1 and changing nothing else brought the
     * same walk to review with Submit **enabled**. Field-level reads do not
     * substitute for it: `useController` marks keys `true` (`errors`,
     * `touchedFields` and `disabled` were all `true` on arrival) where the root
     * test accepts only `"all"`.
     *
     * A bare `trigger()` fixes it from the host side for the dull reason that
     * it runs *after* `SubmitField` has subscribed, so its verdict is the first
     * one anybody is listening for.
     *
     * ## The upstream fix, which is not available from here
     *
     * `SubmitField.tsx:13` should read validity through `useFormState({
     * control })` instead of the root proxy on `useFormContext()`. That hook
     * seeds its own state from `control._formState` — the live internal value,
     * not the root's render snapshot — and its mount effect calls
     * `control._setValid(true)`, which recomputes the verdict for a subscriber
     * that arrived late. Both halves of this, closed inside the component that
     * has the problem, and react-hook-form built the hook for exactly this.
     * `src/form-builder/` is vendored and not editable from this repo, so the
     * host re-publishes the verdict instead.
     *
     * ## Why it sits inside the guard
     *
     * Load-bearing rather than tidy. A `trigger()` marks every visible field,
     * so it may only run where the answers are known to be complete — which is
     * exactly what reaching this line past the redirect above means. In its
     * first version this was an effect of its own, and a cold load of
     * `/apply/review` with a restored draft ran it before the redirect landed:
     * the visitor arrived on the documents step with "This field is required"
     * already under two uploads they had never been shown. Seen in the browser,
     * not in a test.
     */
    if (stepIndex === REVIEW_STEP) void form.current?.trigger();
  }, [stepIndex, submitted, goToStep]);

  /**
   * Submission is a fact about the review step, and the URL is allowed to
   * contradict it.
   *
   * Without this the success panel outlived its own URL: submit, press Back,
   * and `/apply/documents` sat there reading "Application complete" while the
   * live region announced "Step 4 of 5, Documents". In a shell whose entire
   * claim is that the URL is the step, that was the one screen where the claim
   * was false.
   *
   * ## Why success is not its own route
   *
   * The obvious alternative is a sixth slug, `/apply/complete`, and it was
   * rejected because that URL could never be honoured. Submitting clears the
   * draft, so a reload or a deep link onto it has no application and no
   * reference to show and would have to bounce to step 1 — and a URL that
   * cannot be reloaded, bookmarked or shared is not a route, it is state
   * wearing a route's clothes. It would also cost an "except complete" clause
   * in every place that reasons about steps: `STEP_SLUGS`,
   * `generateStaticParams`, `furthestAvailableStep`, the progress guard and the
   * "Step N of 5" announcement, none of which have anything to say about a
   * screen that is not a step.
   *
   * So the reference stays state and the rule is one line: it belongs to the
   * review step, and any URL that is not the review step ends it. What the
   * visitor gets after a Back is not the form they submitted — that is gone,
   * with its draft — but the guard's honest answer to an empty application: the
   * first step, and a notice saying why.
   *
   * ## And the guard's notice, which retires the same way
   *
   * It belongs to the step it sent the visitor to. Clearing it on *any* step
   * change is wrong — the redirect that raises it is itself a step change, so
   * that erases the notice in the commit that paints it, which is the mistake
   * this file has now made twice. Comparing against the step it landed on is
   * safe in that commit, because there the URL names precisely that step.
   *
   * Leaving it to `showBlocked` to merely *hide* the notice was the previous
   * behaviour, and hiding is not retiring: deep-linking `/apply/review`, taking
   * the bounce to step 1, going Next to step 2 and Back to step 1 brought the
   * notice back, about a URL typed two navigations ago. Reproduced in Chrome
   * before this was written.
   *
   * ## Why this is in the render body and not in an effect
   *
   * Both were effects first, and `react-hooks/set-state-in-effect` rejected
   * them — correctly. This is react.dev's own prescription for state that has
   * to reset when a prop changes: keep the previous value, compare during
   * render, adjust immediately. React re-runs this component before committing
   * anything, so the DOM never shows the stale panel or the stale notice for
   * even one frame, where an effect would have painted both and then removed
   * them. The guard above stays an effect because it navigates, which is a side
   * effect and belongs in one.
   */
  const [noticedStep, setNoticedStep] = useState(stepIndex);
  if (noticedStep !== stepIndex) {
    setNoticedStep(stepIndex);
    if (stepIndex !== REVIEW_STEP) setReference(null);
    if (blocked && blocked.landed !== stepIndex) setBlocked(null);
  }

  const autosave = useMemo(() => ({ storage: APPLICATION_DRAFT_STORAGE }), []);

  /**
   * The same condition the effect above retires the notice on, applied a
   * render earlier. It is not redundant with it: `setBlocked` and the `replace`
   * that follows are issued together, and between them there is a commit where
   * the URL still names the *requested* step. Without this the notice would
   * paint for one frame on the step the visitor is being sent away from.
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

      {submitted && reference ? (
        <SuccessPanel
          reference={reference}
          onRestart={() => {
            setResumed(null);
            // The URL does the rest: landing on a step that is not review
            // clears the reference through the effect above, which is the same
            // path a browser Back takes. One rule, not two — a `setReference`
            // here as well would be a second way to end the same state, and the
            // second one is the one that goes stale.
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
