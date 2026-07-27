"use client";

import { useId } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { Label } from "../components/ui/label";
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group";
import type { FieldComponentProps } from "../core/registry";
import type { FieldConfig } from "../core/types";
import { useFieldDisabled } from "../components/FieldRuntime";
import { FieldWrapper, fieldAriaDescribedBy } from "../ui/FieldWrapper";

type RadioFieldConfig = Extract<FieldConfig, { type: "radio" }>;

export function RadioField({ field }: FieldComponentProps) {
  const config = field as RadioFieldConfig;
  const { control } = useFormContext();
  const disabled = useFieldDisabled(config);
  const id = useId();

  return (
    <Controller
      name={config.name}
      control={control}
      render={({ field: rhf, fieldState }) => (
        <FieldWrapper
          id={id}
          asGroup
          label={config.label}
          description={config.description}
          required={config.required}
          disabled={disabled}
          error={fieldState.error}
        >
          <RadioGroup
            value={String(rhf.value ?? "")}
            onValueChange={(selected) =>
              rhf.onChange(config.options.find((option) => String(option.value) === selected)?.value)
            }
            onBlur={rhf.onBlur}
            disabled={disabled}
            aria-describedby={fieldAriaDescribedBy(id, {
              description: config.description,
              error: fieldState.error,
            })}
          >
            {config.options.map((option, index) => {
              const optionId = `${id}-${option.value}`;
              return (
                <div key={option.value} className="flex items-center gap-[var(--fb-space-4,2.136vw)] tablet:gap-[var(--fb-space-4-tablet,1vw)] desktop:gap-[var(--fb-space-4-desktop,0.416vw)]">
                  <RadioGroupItem
                    ref={index === 0 ? rhf.ref : undefined}
                    id={optionId}
                    value={String(option.value)}
                    disabled={option.disabled}
                  />
                  <Label htmlFor={optionId}>{option.label}</Label>
                </div>
              );
            })}
          </RadioGroup>
        </FieldWrapper>
      )}
    />
  );
}
