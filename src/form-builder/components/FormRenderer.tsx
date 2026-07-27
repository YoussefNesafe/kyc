"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FormProvider } from "react-hook-form";
import type { AutosaveOptions } from "../core/autosave";
import type { InferValues } from "../core/inferValues";
import type { Messages } from "../core/messages";
import { hiddenStepFieldNames } from "../core/conditions";
import { applyServerErrors, type ServerErrorResult } from "../core/serverErrors";
import { isBuiltInField, type FormConfig, type FormValues } from "../core/types";
import { toZodSchema } from "../core/validation";
import { useDynamicForm } from "../hooks/useDynamicForm";
import { useOtpController, type OtpController } from "../hooks/useOtpController";
import { FieldRuntimeContext, type FormLocale } from "./FieldRuntime";
import type { ReviewFormatters } from "./reviewValue";
import { FormStepper, type StepperOrientation } from "./FormStepper";
import { renderField } from "./renderField";
import { FLAT_GRID_CLASS } from "../ui/layout";

/**
 * What `onDraftRestore` is told about the draft that was just restored.
 *
 * Named so a host can write `function onRestore(info: DraftRestoreInfo)` as a
 * standalone handler instead of retyping the shape or reaching for
 * `Parameters<...>`. It is deliberately an object rather than a bare `step`
 * argument, so a later restore detail can be added without a breaking change.
 */
export type DraftRestoreInfo = {
  /**
   * The step index recorded in the draft just restored, or `undefined` if that
   * draft recorded none — a non-wizard form, or a wizard the visitor never
   * advanced past the first step of.
   */
  step?: number;
};

type FormRendererProps<C extends FormConfig = FormConfig> = {
  config: C;
  onSubmit: (values: InferValues<C>) => void | ServerErrorResult | Promise<void | ServerErrorResult>;
  onSendOtp?: (fieldName: string, values: FormValues) => Promise<void>;
  onVerifyOtp?: (fieldName: string, code: string) => Promise<boolean>;
  otp?: OtpController;
  messages?: Partial<Messages>;
  locale?: FormLocale;
  className?: string;
  autosave?: AutosaveOptions;
  reviewFormatters?: ReviewFormatters;
  /**
   * The wizard step to show, by index into `config.steps`. Ignored when the
   * config has no `steps`.
   *
   * **Derive it synchronously from the URL** — `routes.indexOf(pathname)` —
   * rather than storing it in state you update after a navigation commits.
   *
   * **If your router can't give you a synchronous step, don't pass `step` at
   * all.** Use `onStepChange` on its own to push the URL and let the wizard own
   * the step. You still get one route per step and a working back button; you
   * simply stop trying to feed the value back in. That is the safe default, and
   * the only thing you give up is the ability to drive the wizard from outside
   * (deep links into a step, or a browser Back the wizard should follow).
   *
   * **This shares the step, it does not own it.** Unlike a controlled `<input
   * value>`, the wizard still moves on its own: Next advances after its own
   * validation gate passes, a step hiding under the visitor bounces to the
   * nearest visible one, and a server field error jumps to that field's step.
   * Setting `step` asks the wizard to go somewhere; it goes, then reports
   * through `onStepChange` wherever it actually ended up. A host that ignores
   * `onStepChange` still gets a working wizard — its own `step` just goes stale.
   *
   * The request is not honoured literally in two cases: an out-of-range index
   * is clamped into `[0, steps.length - 1]`, and an index whose step is hidden
   * by `visibleWhen` redirects to the nearest visible step (the next one, else
   * the previous). `onStepChange` reports the real index whenever it differs
   * from the step the wizard was already on — so `step={99}` on a fresh mount
   * reports the last step, but `step={-5}` reports nothing, because it clamps
   * to 0 and that is where the wizard already was.
   *
   * If autosave restores a draft that recorded a step, the restored step beats
   * `step` — including when both land in the same commit — and is reported, so
   * a router-backed host navigates to where the visitor left off rather than
   * pinning them to the route they happened to open.
   *
   * Why the guidance above matters: a `step` that lags the wizard has two
   * consequences, neither of which the engine can detect.
   *
   * 1. *A return to the step you still hold is not reported.* Hold `step={1}`
   *    while the visitor goes Next to 2 (reported) then Back to 1: that last
   *    move matches the value you passed, so the engine treats it as one you
   *    already know about and stays silent. Nothing is out of sync — you and
   *    the wizard agree on step 1 — but no callback told you the visitor moved.
   * 2. *A late `step` pulls the visitor forward again.* If your router lands
   *    `step={2}` a tick after the visitor has already gone Back to 1, the
   *    wizard honours it. A sync is a sync whenever it arrives; the engine
   *    cannot tell a stale echo of its own report from a genuine browser-Back
   *    to that URL, because both arrive as the same number.
   */
  step?: number;
  /**
   * Called with the step index whenever the wizard lands on a step the caller
   * is not already on. It deliberately does NOT fire for the step the wizard
   * mounts on, nor for a step reached because you passed it as `step` — so
   * `onStepChange={(s) => router.push(routes[s])}` is safe to write literally,
   * with no redundant navigation on load and no echo of your own `step` back.
   *
   * It DOES fire for a step the wizard chose itself: Next/Back, a review-step
   * Edit button, a server-error jump, a hidden-step bounce, and the clamping
   * and redirect cases described on `step` — whenever the resulting index
   * differs both from the step the wizard was on and from your `step`.
   *
   * This is the host's channel only. Autosave records the step over a separate
   * internal channel that is NOT suppressed, so driving the wizard from a
   * router never costs a draft its resume point.
   */
  onStepChange?: (step: number) => void;
  /**
   * Lays the step list out along the top (`"horizontal"`, the default) or down
   * the side as a left rail (`"vertical"`). The rail only sits beside the
   * fields from the tablet breakpoint up; narrower than that it stacks, as
   * horizontal does. The list markup — `<ol>`/`<li>`, its accessible name,
   * `aria-current="step"`, and the focus move on step change — is identical in
   * both; only layout classes and a `data-orientation` styling hook differ.
   * Ignored when the config has no `steps`.
   */
  stepperOrientation?: StepperOrientation;
  /**
   * Called once each time autosave restores a draft into the form, after the
   * values have been applied. Use it to tell the visitor their progress came
   * back.
   *
   * Fires only when `autosave` is configured AND a stored draft was found AND
   * its config hash still matches the current `config.fields`. It therefore
   * does NOT fire on a fresh form, when nothing is stored, when the stored
   * draft is discarded as stale after a config change, or when storage is
   * unavailable (SSR, or a throwing store). Within one mount it fires again
   * only if the draft key changes (`autosave.key`, or `config.id` when no key
   * is given) and a draft exists under the new key.
   *
   * `info.step` is the step index recorded in the draft just restored, or
   * `undefined` if that draft recorded none — a non-wizard form, or a wizard
   * the visitor never advanced past the first step of.
   */
  onDraftRestore?: (info: DraftRestoreInfo) => void;
};

export function FormRenderer<C extends FormConfig = FormConfig>({
  config,
  onSubmit,
  onSendOtp,
  onVerifyOtp,
  otp: otpProp,
  messages,
  locale,
  className,
  autosave,
  reviewFormatters,
  step,
  onStepChange,
  stepperOrientation,
  onDraftRestore,
}: FormRendererProps<C>) {
  const legacyFallback = useMemo(
    () => (onSendOtp || onVerifyOtp ? { send: onSendOtp, verify: onVerifyOtp } : undefined),
    [onSendOtp, onVerifyOtp],
  );
  const internalController = useOtpController({ fallback: legacyFallback });
  const controller = otpProp ?? internalController;
  if (otpProp && legacyFallback && process.env.NODE_ENV !== "production") {
    console.warn(
      "FormRenderer: both an otp controller and onSendOtp/onVerifyOtp were supplied — the controller wins. Choose one wiring per mount; switching mid-session drops verified state.",
    );
  }

  const { form, messages: mergedMessages, draft, restoreGeneration } = useDynamicForm(config, {
    messages,
    otpVerified: controller.hasVerify ? controller.otpVerified : undefined,
    autosave,
  });

  const fieldSchemas = useMemo(() => {
    const schemas = new Map<string, ReturnType<typeof toZodSchema>>();
    for (const field of config.fields) {
      if (isBuiltInField(field)) schemas.set(field.name, toZodSchema(field, mergedMessages));
    }
    return schemas;
  }, [config, mergedMessages]);
  const isFieldValid = useCallback(
    (fieldName: string, value: unknown) => {
      const schema = fieldSchemas.get(fieldName);
      return schema ? schema.safeParse(value).success : true;
    },
    [fieldSchemas],
  );

  const runtime = useMemo(
    () => ({
      disabled: false,
      messages: mergedMessages,
      otp: controller.otp,
      isFieldValid,
      verifiedFields: controller.verifiedFields,
      locale,
      restoreGeneration,
      reviewFormatters,
    }),
    [mergedMessages, controller.otp, controller.verifiedFields, isFieldValid, locale, restoreGeneration, reviewFormatters],
  );

  const [formError, setFormError] = useState<string | null>(null);
  const stepJumpRef = useRef<((fieldName: string) => void) | null>(null);

  // Autosave records the step over `onStepMoved` (every move) rather than the
  // consumer's `onStepChange` (filtered). Composing the two into one callback
  // looks equivalent and isn't: the host-facing report is deliberately
  // suppressed for a move the host asked for, so autosave would stop recording
  // exactly the moves a router-driven wizard makes and the visitor would resume
  // on the wrong step.
  const noteStep = draft?.noteStep;

  // restoreGeneration only ever increments, and only on a draft that was
  // actually loaded — so comparing against the last one we announced fires the
  // callback exactly once per restore and never on a fresh form (both start 0).
  // restoredStep is set in the same batched update, so it is already the newly
  // restored draft's step by the time this runs.
  const restoredStep = draft?.restoredStep;
  const announcedRestoreRef = useRef(restoreGeneration);
  useEffect(() => {
    if (announcedRestoreRef.current === restoreGeneration) return;
    announcedRestoreRef.current = restoreGeneration;
    onDraftRestore?.({ step: restoredStep });
  }, [restoreGeneration, restoredStep, onDraftRestore]);

  const submitHandler = (event: React.FormEvent<HTMLFormElement>) => {
    setFormError(null);
    return form.handleSubmit(async (values) => {
      const result = await onSubmit(values as InferValues<C>);
      if (!result || (!result.fieldErrors && !result.formError)) {
        draft?.clear();
        return;
      }
      const outcome = applyServerErrors(form.setError, result, config.fields);
      if (outcome.formError) setFormError(outcome.formError);
      const first = outcome.applied[0];
      const stepHidden = hiddenStepFieldNames(config, values).has(first?.split(".")[0] ?? "");
      if (first !== undefined && !stepHidden) {
        stepJumpRef.current?.(first);
        setTimeout(() => form.setFocus(first), 0);
      }
    })(event);
  };

  return (
    <FormProvider {...form}>
      <FieldRuntimeContext.Provider value={runtime}>
        <form onSubmit={submitHandler} className={className} noValidate>
          {config.steps?.length ? (
            <FormStepper
              config={config}
              stepJumpRef={stepJumpRef}
              initialStep={restoredStep}
              restoreKey={restoreGeneration}
              controlledStep={step}
              orientation={stepperOrientation}
              onStepMoved={noteStep}
              onStepChange={onStepChange}
            />
          ) : (
            <div className={FLAT_GRID_CLASS}>{config.fields.map(renderField)}</div>
          )}
          {formError && (
            <p
              role="alert"
              className="mt-[var(--fb-space-8,4.272vw)] tablet:mt-[var(--fb-space-8-tablet,2vw)] desktop:mt-[var(--fb-space-8-desktop,0.832vw)] text-[var(--fb-space-7,3.738vw)] tablet:text-[var(--fb-space-7-tablet,1.75vw)] desktop:text-[var(--fb-space-7-desktop,0.728vw)] font-normal text-destructive"
            >
              {formError}
            </p>
          )}
        </form>
      </FieldRuntimeContext.Provider>
    </FormProvider>
  );
}
