"use client";

import { useFormContext } from "react-hook-form";
import { Button } from "../components/ui/button";
import type { FieldComponentProps } from "../core/registry";
import type { FieldConfig } from "../core/types";
import { useFieldDisabled } from "../components/FieldRuntime";

type SubmitFieldConfig = Extract<FieldConfig, { type: "submit" }>;

export function SubmitField({ field }: FieldComponentProps) {
  const config = field as SubmitFieldConfig;
  const { formState } = useFormContext();
  const disabled = useFieldDisabled(config);

  return (
    <Button
      type="submit"
      variant={config.variant}
      disabled={disabled || formState.isSubmitting || !formState.isValid}
    >
      {config.text}
    </Button>
  );
}
