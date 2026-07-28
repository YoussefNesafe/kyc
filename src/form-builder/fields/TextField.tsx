"use client";

import { useId, useMemo, useState } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { CircleX, Eye, EyeOff } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import type { FieldComponentProps } from "../core/registry";
import { getPasswordChecks } from "../core/password";
import type { FieldConfig } from "../core/types";
import { useFieldDisabled, useFieldRuntime } from "../components/FieldRuntime";
import { FieldWrapper, fieldAriaDescribedBy } from "../ui/FieldWrapper";

type TextFieldConfig = Extract<
  FieldConfig,
  { type: "text" | "email" | "password" | "textarea" } | { type: "number" }
>;

export function TextField({ field }: FieldComponentProps) {
  const config = field as TextFieldConfig;
  const { control } = useFormContext();
  const disabled = useFieldDisabled(config);
  const { messages } = useFieldRuntime();
  const id = useId();
  const [showPassword, setShowPassword] = useState(false);

  const isPassword = config.type === "password";
  const complexityChecks =
    config.type === "password" && config.complexity
      ? getPasswordChecks(config.complexity, messages)
      : null;
  const allow = "rules" in config ? config.rules?.allow : undefined;
  const blockedChars = useMemo(() => {
    if (!allow) return null;
    try {
      return new RegExp(`[^${allow}]`, "g");
    } catch {
      return null;
    }
  }, [allow]);
  const sanitize = (value: string) => (blockedChars ? value.replace(blockedChars, "") : value);

  return (
    <Controller
      name={config.name}
      control={control}
      render={({ field: rhf, fieldState }) => {
        const failing = complexityChecks
          ? complexityChecks.filter((check) => !check.test((rhf.value as string) ?? ""))
          : [];
        const showChecklist =
          failing.length > 0 && (fieldState.isDirty || fieldState.isTouched);
        const wrapperError = showChecklist ? undefined : fieldState.error;
        const describedBy =
          [
            fieldAriaDescribedBy(id, { description: config.description, error: wrapperError }),
            showChecklist ? `${id}-rules` : undefined,
          ]
            .filter(Boolean)
            .join(" ") || undefined;

        const handleBlur = () => {
          if ("rules" in config && config.rules?.trim && typeof rhf.value === "string") {
            const trimmed = rhf.value.trim();
            if (trimmed !== rhf.value) rhf.onChange(trimmed);
          }
          rhf.onBlur();
        };

        return (
        <FieldWrapper
          id={id}
          label={config.label}
          description={config.description}
          required={config.required}
          disabled={disabled}
          error={wrapperError}
        >
          {config.type === "textarea" ? (
            <Textarea
              placeholder={config.placeholder}
              autoComplete={config.autocomplete}
              {...rhf}
              onChange={(event) => rhf.onChange(sanitize(event.target.value))}
              onBlur={handleBlur}
              id={id}
              disabled={disabled}
              aria-invalid={!!fieldState.error}
              aria-describedby={describedBy}
              value={(rhf.value as string) ?? ""}
            />
          ) : (
            <div className="relative">
              <Input
                type={isPassword && showPassword ? "text" : config.type}
                inputMode={config.type === "email" ? "email" : config.type === "number" ? "decimal" : undefined}
                placeholder={config.placeholder}
                autoComplete={config.autocomplete}
                min={config.type === "number" ? config.min : undefined}
                max={config.type === "number" ? config.max : undefined}
                step={config.type === "number" ? config.step : undefined}
                className={isPassword ? "pe-[var(--fb-space-20,10.68vw)] tablet:pe-[var(--fb-space-20-tablet,5vw)] desktop:pe-[var(--fb-space-20-desktop,2.08vw)]" : undefined}
                {...rhf}
                onBlur={handleBlur}
                id={id}
                disabled={disabled}
                aria-invalid={!!fieldState.error}
                aria-describedby={describedBy}
                value={(rhf.value as string | number) ?? ""}
                onChange={(event) =>
                  config.type === "number"
                    ? rhf.onChange(Number.isNaN(event.target.valueAsNumber) ? undefined : event.target.valueAsNumber)
                    : rhf.onChange(sanitize(event.target.value))
                }
              />
              {isPassword && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={disabled}
                  aria-label={showPassword ? messages.hidePassword : messages.showPassword}
                  className="absolute end-0 top-0 h-full px-[var(--fb-space-6,3.204vw)] tablet:px-[var(--fb-space-6-tablet,1.5vw)] desktop:px-[var(--fb-space-6-desktop,0.624vw)]"
                  onClick={() => setShowPassword((previous) => !previous)}
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </Button>
              )}
            </div>
          )}
          {showChecklist && (
            <div id={`${id}-rules`} aria-live="polite" className="grid grid-cols-2 gap-x-[var(--fb-space-8,4.272vw)] tablet:gap-x-[var(--fb-space-8-tablet,2vw)] desktop:gap-x-[var(--fb-space-8-desktop,0.832vw)] gap-y-[var(--fb-space-2,1.068vw)] tablet:gap-y-[var(--fb-space-2-tablet,0.5vw)] desktop:gap-y-[var(--fb-space-2-desktop,0.208vw)]">
              {failing.map((check) => (
                <span key={check.key} className="flex items-center gap-[var(--fb-space-2,1.068vw)] tablet:gap-[var(--fb-space-2-tablet,0.5vw)] desktop:gap-[var(--fb-space-2-desktop,0.208vw)] text-[var(--fb-space-6,3.204vw)] tablet:text-[var(--fb-space-6-tablet,1.5vw)] desktop:text-[var(--fb-space-6-desktop,0.624vw)] text-destructive">
                  <CircleX aria-hidden className="size-[var(--fb-space-7,3.738vw)] tablet:size-[var(--fb-space-7-tablet,1.75vw)] desktop:size-[var(--fb-space-7-desktop,0.728vw)] shrink-0" />
                  {check.label}
                </span>
              ))}
            </div>
          )}
        </FieldWrapper>
        );
      }}
    />
  );
}
