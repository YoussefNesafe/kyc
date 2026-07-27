"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { conditionFieldNames, conditionSpecMatches } from "../core/conditions";
import { useCopyFromSync } from "../hooks/useSourceSync";
import { defaultMessages, type Messages } from "../core/messages";
import type { AnyFieldConfig, FormValues } from "../core/types";

export type OtpRuntime = {
  send?: (fieldName: string, values: FormValues) => Promise<void>;
  verify?: (fieldName: string, code: string, depValue?: unknown) => Promise<boolean>;
  invalidate?: (fieldName: string) => void;
  isVerifiedFor?: (fieldName: string, depValue: unknown) => boolean;
};

export type FormLocale = {
  dateFns?: import("date-fns").Locale;
  countryLabels?: Record<string, string>;
};

type FieldRuntime = {
  disabled: boolean;
  messages: Messages;
  /**
   * The config of the field currently being rendered, published by `FieldGate`
   * so shared chrome can read declarative config without every field component
   * threading it through. `FieldWrapper` uses it for `badge`. Undefined outside
   * a gate — a `FieldWrapper` rendered by hand rather than via `renderField`.
   *
   * This is the RAW config as authored, not resolved state. In particular
   * `field.disabled` is only the statically declared flag; the resolved answer
   * — which also folds in `disabledWhen`, `enabledWhen`, `enabledWhenVerified`,
   * and an inherited form-level disable — is the sibling `disabled` on this
   * same object, or `useFieldDisabled(config)`. Reading `field.disabled` for
   * that gives the wrong answer with no type error to warn you.
   *
   * Chrome-only channel: it exists for wrappers that render around every field.
   * Field components already receive their config as a `field` prop and should
   * keep using it. The whole config is published rather than just the props the
   * chrome needs, which is what lets a new annotation reach every field type
   * without touching one of them.
   */
  field?: AnyFieldConfig;
  otp?: OtpRuntime;
  isFieldValid?: (fieldName: string, value: unknown) => boolean;
  verifiedFields?: ReadonlySet<string>;
  locale?: FormLocale;
  restoreGeneration?: number;
  reviewFormatters?: import("./reviewValue").ReviewFormatters;
};

export const FieldRuntimeContext = createContext<FieldRuntime>({
  disabled: false,
  messages: defaultMessages,
});

export function useFieldRuntime() {
  return useContext(FieldRuntimeContext);
}

export function useFieldDisabled(config: AnyFieldConfig): boolean {
  const runtime = useFieldRuntime();
  return !!config.disabled || runtime.disabled;
}

export function FieldGate({ field, children }: { field: AnyFieldConfig; children: ReactNode }) {
  const { control } = useFormContext();
  const runtime = useFieldRuntime();
  useCopyFromSync(field);

  const watchNames = useMemo(
    () => [
      ...new Set([
        ...conditionFieldNames(field.visibleWhen),
        ...conditionFieldNames(field.disabledWhen),
        ...conditionFieldNames(field.enabledWhen),
      ]),
    ],
    [field.visibleWhen, field.disabledWhen, field.enabledWhen],
  );
  const watched = useWatch({ control, name: watchNames, disabled: watchNames.length === 0 });
  const valueOf = (name: string) => watched?.[watchNames.indexOf(name)];

  const visible = conditionSpecMatches(field.visibleWhen, valueOf);
  const disabled =
    runtime.disabled ||
    !!field.disabled ||
    (!!field.disabledWhen && conditionSpecMatches(field.disabledWhen, valueOf, runtime.isFieldValid)) ||
    (!!field.enabledWhen && !conditionSpecMatches(field.enabledWhen, valueOf, runtime.isFieldValid)) ||
    (!!field.enabledWhenVerified && !runtime.verifiedFields?.has(field.enabledWhenVerified));

  if (!visible) return null;

  return (
    <FieldRuntimeContext.Provider value={{ ...runtime, field, disabled }}>
      {children}
    </FieldRuntimeContext.Provider>
  );
}
