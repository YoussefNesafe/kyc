"use client";

import { createContext, useContext, useEffect, type ComponentType } from "react";
import { useFormContext, type UseFormReturn } from "react-hook-form";
import type { FieldComponentProps } from "@/form-builder/core/registry";
import type { FormValues } from "@/form-builder/core/types";

export type FormHandle = UseFormReturn<FormValues>;
export type FormHandleSink = { current: FormHandle | null };

/**
 * How the shell gets hold of the form the engine owns.
 *
 * ## The problem
 *
 * `FormRenderer` creates its `useForm` internally and publishes it through
 * react-hook-form's `FormProvider`, which sits *inside* the renderer. It takes
 * no `children` and returns no handle. So a "Fill with sample data" button —
 * which needs `getValues` to read the visitor's branch and `reset` to apply the
 * sample — cannot reach the form from where the button belongs, which is the
 * shell's own chrome, outside the questions.
 *
 * `reset` rather than a series of `setValue` calls, incidentally, is not a
 * stylistic choice: `beneficialOwners` is a `group`, backed by `useFieldArray`,
 * and only `reset` resynchronises a field array's internal row keys. `setValue`
 * on the array leaves the rendered rows behind.
 *
 * ## The mechanism
 *
 * Context flows down, so a provider the shell puts *above* `FormRenderer` is
 * readable from *inside* it. Every field component the shell registers is
 * wrapped in `withFormHandle`, which reads `useFormContext()` — legal there,
 * inside the provider — and writes it into the sink the shell owns. One line of
 * indirection instead of editing the engine or bending the config.
 *
 * ## Why every field rather than one chosen mount point
 *
 * There is no field that renders on every step: `visibleWhen` can empty a whole
 * step (the documents step before an account type is chosen), and the review
 * step renders no inputs at all — only the submit button, which is itself
 * registered and therefore also wrapped. Wrapping the registry uniformly is the
 * only version of this with no "except when…" clause.
 *
 * ## Why it is written once and not re-published on every render
 *
 * The published object is a spread of `useForm`'s return, so its identity
 * changes on every render of `FormRenderer`, but the methods on it are stable
 * and read live state through the same `control`. Capturing on mount is
 * therefore both sufficient and considerably cheaper than forty fields
 * reassigning the same handle on every keystroke.
 *
 * The sink is intentionally a plain ref rather than state: nothing in the shell
 * should re-render because a field mounted, and the handle is only ever read
 * inside an event handler or an effect.
 */
const FormHandleContext = createContext<FormHandleSink | null>(null);

export const FormHandleProvider = FormHandleContext.Provider;

export function withFormHandle(
  Component: ComponentType<FieldComponentProps>,
): ComponentType<FieldComponentProps> {
  function FieldWithFormHandle(props: FieldComponentProps) {
    const sink = useContext(FormHandleContext);
    const form = useFormContext<FormValues>();

    useEffect(() => {
      if (sink) sink.current = form;
      // Deliberately mount-only: see the note on handle identity above.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return <Component {...props} />;
  }

  FieldWithFormHandle.displayName = `withFormHandle(${Component.displayName ?? Component.name ?? "Field"})`;
  return FieldWithFormHandle;
}
