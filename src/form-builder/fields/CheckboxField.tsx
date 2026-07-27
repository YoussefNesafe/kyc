"use client";

import { useId } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { Checkbox } from "../components/ui/checkbox";
import { Switch } from "../components/ui/switch";
import { Label } from "../components/ui/label";
import { Field, FieldDescription, FieldError, FieldLabel } from "../components/ui/field";
import type { FieldComponentProps } from "../core/registry";
import type { FieldConfig, Option } from "../core/types";
import { useFieldDisabled } from "../components/FieldRuntime";
import { FieldWrapper, fieldAriaDescribedBy } from "../ui/FieldWrapper";
import { RequiredMark } from "../ui/RequiredMark";

type CheckboxFieldConfig = Extract<FieldConfig, { type: "checkbox" | "switch" }>;

function toggleValue(current: unknown, value: Option["value"]): Option["value"][] {
  const list = Array.isArray(current) ? (current as Option["value"][]) : [];
  return list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];
}

export function CheckboxField({ field }: FieldComponentProps) {
  const config = field as CheckboxFieldConfig;
  const { control } = useFormContext();
  const disabled = useFieldDisabled(config);
  const id = useId();

  const isGroup = config.type === "checkbox" && !!config.options?.length;

  return (
    <Controller
      name={config.name}
      control={control}
      render={({ field: rhf, fieldState }) => {
        if (isGroup) {
          return (
            <FieldWrapper
              id={id}
              asGroup
              label={config.label}
              description={config.description}
              required={config.required}
              disabled={disabled}
              error={fieldState.error}
            >
              <div
                role="group"
                aria-describedby={fieldAriaDescribedBy(id, {
                  description: config.description,
                  error: fieldState.error,
                })}
                className="flex flex-col gap-[var(--fb-space-4,2.136vw)] tablet:gap-[var(--fb-space-4-tablet,1vw)] desktop:gap-[var(--fb-space-4-desktop,0.416vw)]"
              >
                {config.options?.map((option, index) => {
                  const optionId = `${id}-${option.value}`;
                  const checked = Array.isArray(rhf.value) && (rhf.value as Option["value"][]).includes(option.value);
                  return (
                    <div key={option.value} className="flex items-center gap-[var(--fb-space-4,2.136vw)] tablet:gap-[var(--fb-space-4-tablet,1vw)] desktop:gap-[var(--fb-space-4-desktop,0.416vw)]">
                      <Checkbox
                        ref={index === 0 ? rhf.ref : undefined}
                        id={optionId}
                        checked={checked}
                        disabled={disabled || option.disabled}
                        aria-invalid={!!fieldState.error}
                        onCheckedChange={() => rhf.onChange(toggleValue(rhf.value, option.value))}
                        onBlur={rhf.onBlur}
                      />
                      <Label htmlFor={optionId}>{option.label}</Label>
                    </div>
                  );
                })}
              </div>
            </FieldWrapper>
          );
        }

        const ToggleControl = config.type === "switch" ? Switch : Checkbox;
        return (
          <Field data-disabled={disabled || undefined}>
            <Field orientation="horizontal">
              <ToggleControl
                ref={rhf.ref}
                id={id}
                checked={!!rhf.value}
                disabled={disabled}
                aria-invalid={!!fieldState.error}
                aria-describedby={fieldAriaDescribedBy(id, {
                  description: config.description,
                  error: fieldState.error,
                })}
                onCheckedChange={(checked) => rhf.onChange(checked === true)}
                onBlur={rhf.onBlur}
              />
              {config.label && (
                <FieldLabel htmlFor={id}>
                  {config.label}
                  {config.required && <RequiredMark />}
                </FieldLabel>
              )}
            </Field>
            {config.description && (
              <FieldDescription id={`${id}-description`}>{config.description}</FieldDescription>
            )}
            <FieldError id={`${id}-error`} errors={fieldState.error ? [fieldState.error] : undefined} />
          </Field>
        );
      }}
    />
  );
}
