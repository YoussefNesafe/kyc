"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { useStore } from "zustand";
import { Button } from "./ui/button";
import { cn } from "../internal/cn";
import { conditionFieldNames, conditionSpecMatches } from "../core/conditions";
import type { FormConfig } from "../core/types";
import { createStepperStore } from "../store/stepper";
import { FLAT_GRID_CLASS, STACK_GAP_CLASS } from "../ui/layout";
import { useFieldRuntime } from "./FieldRuntime";
import { renderField } from "./renderField";
import { ReviewStep } from "./ReviewStep";

function nearestVisible(step: number, visibleIndices: number[]): number | undefined {
  return (
    visibleIndices.find((index) => index > step) ??
    [...visibleIndices].reverse().find((index) => index < step)
  );
}

export type StepperOrientation = "horizontal" | "vertical";

export function FormStepper({
  config,
  stepJumpRef,
  initialStep,
  restoreKey,
  controlledStep,
  orientation = "horizontal",
  onStepMoved,
  onStepChange,
}: {
  config: FormConfig;
  stepJumpRef?: React.MutableRefObject<((fieldName: string) => void) | null>;
  /** A step recovered from somewhere the visitor left it. Applied once per
   *  distinct `restoreKey`, and it outranks `controlledStep` when both land in
   *  the same commit — see the resolution effect below. */
  initialStep?: number;
  /** Changes exactly when `initialStep` has been recovered afresh, even if its
   *  value is unchanged. Without it, two recoveries naming the same step are
   *  indistinguishable and the second is silently dropped. */
  restoreKey?: number;
  /** A step the host wants the wizard on. Synchronised in, not rendered from:
   *  the store stays the single source of truth so the stepper can still move
   *  itself (validation gating, a step hiding under the user). See the
   *  `step` prop's JSDoc on FormRenderer for the full contract. */
  controlledStep?: number;
  orientation?: StepperOrientation;
  /** Fires on EVERY real move, including one the host itself asked for through
   *  `controlledStep`. Anything that must not miss a host-driven move belongs
   *  here rather than on `onStepChange`, which is filtered. */
  onStepMoved?: (step: number) => void;
  onStepChange?: (step: number) => void;
}) {
  const steps = useMemo(() => config.steps ?? [], [config.steps]);
  const form = useFormContext();
  const { messages } = useFieldRuntime();
  const [store] = useState(() => createStepperStore(steps.length));
  const step = useStore(store, (state) => state.step);

  const stepConditionNames = useMemo(
    () => [...new Set(steps.flatMap((s) => conditionFieldNames(s.visibleWhen)))],
    [steps],
  );
  const stepConditionValues = useWatch({
    control: form.control,
    name: stepConditionNames,
    disabled: stepConditionNames.length === 0,
  });
  const stepValueOf = (name: string) => stepConditionValues?.[stepConditionNames.indexOf(name)];
  const visibleIndices = steps
    .map((s, index) => (conditionSpecMatches(s.visibleWhen, stepValueOf) ? index : -1))
    .filter((index) => index >= 0);

  const currentHidden = steps.length > 0 && !visibleIndices.includes(step);
  useEffect(() => {
    if (!currentHidden || visibleIndices.length === 0) return;
    const fallback = nearestVisible(step, visibleIndices);
    if (fallback !== undefined) store.getState().goTo(fallback);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentHidden, step, store]);

  // ONE effect resolves both inbound step requests, because they can arrive in
  // the same commit and the winner must be a stated rule rather than whichever
  // `useEffect` happens to be written second.
  //
  // Precedence: a freshly restored draft beats the host. A visitor returning to
  // a half-finished form should land where they left off, not be pinned to
  // whatever step the host's route happens to name; the restored step is then
  // reported through `onStepChange` so the host can catch its URL up.
  //
  // The restore arm is keyed on `restoreKey`, NOT on `initialStep`'s value: two
  // consecutive drafts can name the same step, and comparing values would treat
  // the second restore as a no-op and strand the visitor wherever they had
  // since navigated.
  //
  // Deliberately never keyed on the store's own `step`: ask for a hidden step
  // and the bounce effect above redirects off it once, and nothing here pulls
  // it back. Keying this on `step` would make the two ping-pong forever.
  const appliedRestoreRef = useRef<number | undefined>(undefined);
  const appliedControlledRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    const restored = restoreKey !== appliedRestoreRef.current;
    const hostMoved = controlledStep !== appliedControlledRef.current;
    appliedRestoreRef.current = restoreKey;
    appliedControlledRef.current = controlledStep;
    if (restored && initialStep !== undefined) {
      store.getState().goTo(initialStep);
      return;
    }
    if (hostMoved && controlledStep !== undefined) store.getState().goTo(controlledStep);
  }, [restoreKey, initialStep, controlledStep, store]);

  // Two channels off one observation. They must NOT be collapsed: `onStepMoved`
  // sees every real move, `onStepChange` is filtered down to the moves the host
  // doesn't already know about (not the step we mounted on, not one it asked
  // for via `controlledStep`) so a host that navigates on every call fires no
  // redundant navigation on load and never echoes its own prop back.
  //
  // Both skip the mount observation and any re-run where the step didn't
  // actually move — an unrelated dep changing, e.g. an inline arrow passed as
  // `onStepChange`, must not be mistaken for navigation.
  const lastStepRef = useRef<number | null>(null);
  useEffect(() => {
    const previous = lastStepRef.current;
    lastStepRef.current = step;
    if (previous === null || previous === step) return;
    onStepMoved?.(step);
    if (step !== controlledStep) onStepChange?.(step);
  }, [step, controlledStep, onStepMoved, onStepChange]);

  useEffect(() => {
    if (!stepJumpRef) return;
    stepJumpRef.current = (fieldName) => {
      const root = fieldName.split(".")[0];
      const index = steps.findIndex((s) => (s.fieldNames ?? []).includes(root));
      if (index >= 0) store.getState().goTo(index);
    };
    return () => {
      stepJumpRef.current = null;
    };
  }, [stepJumpRef, steps, store]);

  // Moving focus to the labelled step list IS the engine's step-change
  // announcement: it re-reads the list's accessible name and the new
  // aria-current item, and it puts the keyboard where the new step starts. A
  // live region deliberately does NOT live here — it would fire at the same
  // moment as this focus move (double announcement in several screen readers),
  // and its wording ("Step 2 of 5, Personal details") is host copy that the
  // Messages bundle has no interpolation slot for. Hosts that want one now have
  // `onStepChange` to drive their own aria-live element with their own words.
  const stepListRef = useRef<HTMLOListElement>(null);
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    stepListRef.current?.focus();
  }, [step]);

  const fieldsByName = useMemo(
    () => new Map(config.fields.map((field) => [field.name, field])),
    [config],
  );

  if (!steps.length) return null;
  if (visibleIndices.length === 0) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("form-builder: every wizard step is hidden by its visibleWhen — nothing to render");
    }
    return null;
  }
  const effectiveStep = visibleIndices.includes(step)
    ? step
    : (nearestVisible(step, visibleIndices) ?? visibleIndices[0]);

  const currentStep = steps[effectiveStep];
  const currentFieldNames = currentStep.fieldNames ?? [];
  const currentFields = currentFieldNames
    .map((name) => fieldsByName.get(name))
    .filter((field) => field !== undefined);
  const hiddenFields = config.fields.filter((field) => field.type === "hidden");
  const submitField = config.fields.find((field) => field.type === "submit");
  const position = visibleIndices.indexOf(effectiveStep);
  const isLast = position === visibleIndices.length - 1;

  const handleNext = async () => {
    const valid = currentFieldNames.length === 0 ? true : await form.trigger(currentFieldNames);
    if (valid) {
      const next = visibleIndices[position + 1];
      if (next !== undefined) store.getState().goTo(next);
      return;
    }
    const firstInvalid = currentFieldNames.find((name) => form.getFieldState(name).invalid);
    if (firstInvalid) form.setFocus(firstInvalid);
  };

  const handleBack = () => {
    const prev = visibleIndices[position - 1];
    if (prev !== undefined) store.getState().goTo(prev);
  };

  const vertical = orientation === "vertical";

  return (
    <div
      className={cn(
        "flex",
        STACK_GAP_CLASS,
        // A left rail is only a rail once there is room beside the fields; below
        // the tablet breakpoint vertical still stacks, like horizontal does.
        vertical ? "flex-col tablet:flex-row" : "flex-col",
      )}
    >
      <ol
        ref={stepListRef}
        tabIndex={-1}
        aria-label={messages.steps}
        // Not aria-orientation: that attribute isn't supported on role="list",
        // and the step list carries no orientation-dependent keyboard model.
        // This is a styling/testing hook, not an accessibility one.
        data-orientation={orientation}
        className={cn(
          "flex gap-[var(--fb-space-8,4.272vw)] tablet:gap-[var(--fb-space-8-tablet,2vw)] desktop:gap-[var(--fb-space-8-desktop,0.832vw)] outline-none",
          vertical ? "flex-col items-start tablet:shrink-0" : "items-center",
        )}
      >
        {visibleIndices.map((index, displayIndex) => (
          <li
            key={index}
            aria-current={index === effectiveStep ? "step" : undefined}
            className={cn(
              "flex items-center gap-[var(--fb-space-4,2.136vw)] tablet:gap-[var(--fb-space-4-tablet,1vw)] desktop:gap-[var(--fb-space-4-desktop,0.416vw)] text-[var(--fb-space-7,3.738vw)] tablet:text-[var(--fb-space-7-tablet,1.75vw)] desktop:text-[var(--fb-space-7-desktop,0.728vw)]",
              index === effectiveStep ? "font-medium text-foreground" : "text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "flex size-[var(--fb-space-12,6.408vw)] tablet:size-[var(--fb-space-12-tablet,3vw)] desktop:size-[var(--fb-space-12-desktop,1.248vw)] items-center justify-center rounded-full border text-[var(--fb-space-6,3.204vw)] tablet:text-[var(--fb-space-6-tablet,1.5vw)] desktop:text-[var(--fb-space-6-desktop,0.624vw)]",
                index === effectiveStep && "border-primary bg-primary text-primary-foreground",
                displayIndex < position && "border-primary text-primary",
              )}
            >
              {displayIndex + 1}
            </span>
            {steps[index].title}
          </li>
        ))}
      </ol>

      {/* Panel wrapper: in horizontal it just re-creates the old three-in-a-column
          stack (same gap token); in vertical it is what sits beside the rail. */}
      <div className={cn("flex min-w-0 flex-1 flex-col", STACK_GAP_CLASS)}>
        {currentStep.review ? (
          <>
            <ReviewStep
              config={config}
              currentIndex={effectiveStep}
              visibleIndices={visibleIndices}
              goTo={(index) => store.getState().goTo(index)}
            />
            <div className={FLAT_GRID_CLASS}>{hiddenFields.map(renderField)}</div>
          </>
        ) : (
          <div className={FLAT_GRID_CLASS}>
            {currentFields.map(renderField)}
            {hiddenFields.map(renderField)}
          </div>
        )}

        <div className="flex items-center justify-between">
          <Button type="button" variant="outline" disabled={position === 0} onClick={handleBack}>
            {messages.back}
          </Button>
          {isLast ? (
            renderField(submitField ?? { type: "submit", name: "__submit", text: messages.submit })
          ) : (
            <Button type="button" onClick={handleNext}>
              {messages.next}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
