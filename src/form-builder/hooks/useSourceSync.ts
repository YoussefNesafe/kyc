"use client";

import { useEffect, useRef } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { useFieldRuntime } from "../components/FieldRuntime";
import type { AnyFieldConfig } from "../core/types";

export const SKIP_SYNC: unique symbol = Symbol("form-builder.skip-sync");

type SyncCompute = (sourceValue: unknown, currentValue: unknown) => unknown;

export function useSourceSync(
  name: string,
  source: string | undefined,
  handlers: { seed: SyncCompute; change: SyncCompute },
) {
  const { control, getValues, setValue, getFieldState } = useFormContext();
  const { restoreGeneration } = useFieldRuntime();
  const watched = useWatch({ control, name: source ?? name, disabled: !source });
  const prev = useRef<unknown>(undefined);
  const mounted = useRef(false);
  const seenGeneration = useRef(restoreGeneration);
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    if (!source) return;
    if (!mounted.current) {
      mounted.current = true;
      prev.current = watched;
      const seeded = handlersRef.current.seed(watched, getValues(name));
      if (seeded !== SKIP_SYNC) setValue(name, seeded);
      return;
    }
    if (restoreGeneration !== seenGeneration.current) {
      seenGeneration.current = restoreGeneration;
      prev.current = watched;
      return;
    }
    if (watched === prev.current) return;
    prev.current = watched;
    const current = getValues(name);
    const next = handlersRef.current.change(watched, current);
    if (next === SKIP_SYNC || next === current) return;
    const { isTouched } = getFieldState(name);
    setValue(name, next, { shouldDirty: true, shouldValidate: isTouched });
  }, [watched, source, name, restoreGeneration, getValues, setValue, getFieldState]);
}

const isEmptyValue = (value: unknown): boolean =>
  value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);

const cloneValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return [...value];
  if (value && typeof value === "object") return { ...value };
  return value;
};

export function useCopyFromSync(field: AnyFieldConfig): void {
  const source = (field as { copyFrom?: string }).copyFrom;
  useSourceSync(field.name, source, {
    seed: (sourceValue, currentValue) =>
      isEmptyValue(currentValue) && !isEmptyValue(sourceValue) ? cloneValue(sourceValue) : SKIP_SYNC,
    change: (sourceValue, currentValue) =>
      sourceValue === currentValue ? SKIP_SYNC : cloneValue(sourceValue),
  });
}
