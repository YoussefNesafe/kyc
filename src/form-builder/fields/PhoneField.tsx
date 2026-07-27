"use client";

import { useId, useState, type ComponentProps } from "react";
import { Controller, useFormContext } from "react-hook-form";
import PhoneInput, { getCountryCallingCode, type Country } from "react-phone-number-input";
import flags from "react-phone-number-input/flags";
import { Check, ChevronDown } from "lucide-react";
import { Button } from "../components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { cn } from "../internal/cn";
import type { FieldComponentProps } from "../core/registry";
import type { FieldConfig } from "../core/types";
import { useFieldDisabled, useFieldRuntime } from "../components/FieldRuntime";
import { FieldWrapper, fieldAriaDescribedBy } from "../ui/FieldWrapper";
import { SKIP_SYNC, useSourceSync } from "../hooks/useSourceSync";
import { applyCountryToPhoneValue } from "./phoneCountrySync";

type PhoneFieldConfig = Extract<FieldConfig, { type: "phone" }>;

function BareInput({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      {...props}
      className={cn(
        "h-full w-full min-w-0 bg-transparent pe-[var(--fb-space-6,3.204vw)] tablet:pe-[var(--fb-space-6-tablet,1.5vw)] desktop:pe-[var(--fb-space-6-desktop,0.624vw)] text-[var(--fb-space-7,3.738vw)] tablet:text-[var(--fb-space-7-tablet,1.75vw)] desktop:text-[var(--fb-space-7-desktop,0.728vw)] outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed",
        className,
      )}
    />
  );
}

function CountryFlag({ country }: { country?: string }) {
  const Flag = country ? flags[country as Country] : undefined;
  if (!Flag) return <span aria-hidden>🌐</span>;
  return (
    <span aria-hidden className="inline-flex w-[var(--fb-space-10,5.34vw)] tablet:w-[var(--fb-space-10-tablet,2.5vw)] desktop:w-[var(--fb-space-10-desktop,1.04vw)] overflow-hidden rounded-[var(--fb-space-1,0.534vw)] tablet:rounded-[var(--fb-space-1-tablet,0.25vw)] desktop:rounded-[var(--fb-space-1-desktop,0.104vw)]">
      <Flag title="" />
    </span>
  );
}

function callingCode(country: string): string {
  try {
    return `+${getCountryCallingCode(country as Country)}`;
  } catch {
    return "";
  }
}

type CountrySelectProps = {
  value?: string;
  onChange: (value?: string) => void;
  options: { value?: string; label: string }[];
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
  emptyMessage?: string;
};

function CountrySelect({ value, onChange, options, disabled, className, emptyMessage, ...rest }: CountrySelectProps) {
  const [open, setOpen] = useState(false);
  const countries = options.filter((option) => option.value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          role="combobox"
          aria-expanded={open}
          aria-label={rest["aria-label"]}
          disabled={disabled}
          className={cn("h-full shrink-0 gap-[var(--fb-space-2,1.068vw)] tablet:gap-[var(--fb-space-2-tablet,0.5vw)] desktop:gap-[var(--fb-space-2-desktop,0.208vw)] rounded-e-none ps-[var(--fb-space-6,3.204vw)] tablet:ps-[var(--fb-space-6-tablet,1.5vw)] desktop:ps-[var(--fb-space-6-desktop,0.624vw)] pe-[var(--fb-space-4,2.136vw)] tablet:pe-[var(--fb-space-4-tablet,1vw)] desktop:pe-[var(--fb-space-4-desktop,0.416vw)] font-normal", className)}
        >
          <CountryFlag country={value} />
          <ChevronDown className="size-[var(--fb-space-7,3.738vw)] tablet:size-[var(--fb-space-7-tablet,1.75vw)] desktop:size-[var(--fb-space-7-desktop,0.728vw)] shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--fb-space-144,76.896vw)] tablet:w-[var(--fb-space-144-tablet,36vw)] desktop:w-[var(--fb-space-144-desktop,14.976vw)] p-0" align="start">
        <Command
          filter={(itemValue, search) => (itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}
        >
          <CommandInput placeholder={rest["aria-label"]} />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {countries.map((option) => {
                const code = callingCode(option.value as string);
                return (
                  <CommandItem
                    key={option.value}
                    value={`${option.label} ${code} ${option.value}`}
                    onSelect={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn("me-[var(--fb-space-4,2.136vw)] tablet:me-[var(--fb-space-4-tablet,1vw)] desktop:me-[var(--fb-space-4-desktop,0.416vw)] size-[var(--fb-space-8,4.272vw)] tablet:size-[var(--fb-space-8-tablet,2vw)] desktop:size-[var(--fb-space-8-desktop,0.832vw)]", option.value === value ? "opacity-100" : "opacity-0")}
                    />
                    <span className="me-[var(--fb-space-4,2.136vw)] tablet:me-[var(--fb-space-4-tablet,1vw)] desktop:me-[var(--fb-space-4-desktop,0.416vw)]">
                      <CountryFlag country={option.value} />
                    </span>
                    <span className="truncate">{option.label}</span>
                    <span className="ms-auto ps-[var(--fb-space-4,2.136vw)] tablet:ps-[var(--fb-space-4-tablet,1vw)] desktop:ps-[var(--fb-space-4-desktop,0.416vw)] text-muted-foreground">{code}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function useCountryFromSync(config: PhoneFieldConfig) {
  useSourceSync(config.name, config.countryFrom, {
    seed: (sourceValue, currentValue) => {
      const iso = typeof sourceValue === "string" && sourceValue ? sourceValue : undefined;
      if (!iso || currentValue) return SKIP_SYNC;
      const next = applyCountryToPhoneValue("", iso);
      return next === null ? SKIP_SYNC : next;
    },
    change: (sourceValue, currentValue) => {
      const iso = typeof sourceValue === "string" && sourceValue ? sourceValue : undefined;
      if (!iso) return SKIP_SYNC;
      const current = typeof currentValue === "string" ? currentValue : "";
      const next = applyCountryToPhoneValue(current, iso);
      if (next === null) {
        if (process.env.NODE_ENV !== "production") {
          console.warn(
            `form-builder: phone "${config.name}" countryFrom received non-ISO value "${String(sourceValue)}"`,
          );
        }
        return SKIP_SYNC;
      }
      return next;
    },
  });
}

export function PhoneField({ field }: FieldComponentProps) {
  const config = field as PhoneFieldConfig;
  const { control } = useFormContext();
  const disabled = useFieldDisabled(config);
  const { messages, locale } = useFieldRuntime();
  const id = useId();
  useCountryFromSync(config);

  return (
    <Controller
      name={config.name}
      control={control}
      render={({ field: rhf, fieldState }) => {
        const isValid = fieldState.isTouched && !fieldState.error && !!rhf.value;
        return (
        <FieldWrapper
          id={id}
          label={config.label}
          description={config.description}
          required={config.required}
          disabled={disabled}
          error={fieldState.error}
        >
          <PhoneInput
            id={id}
            ref={rhf.ref}
            value={(rhf.value as string) || undefined}
            onChange={(value) => rhf.onChange(value ?? "")}
            onBlur={rhf.onBlur}
            disabled={disabled}
            placeholder={config.placeholder}
            defaultCountry={config.defaultCountry as Country | undefined}
            countryOptionsOrder={config.preferredCountries as ComponentProps<typeof PhoneInput>["countryOptionsOrder"]}
            international
            countryCallingCodeEditable={false}
            labels={locale?.countryLabels}
            inputComponent={BareInput}
            countrySelectComponent={CountrySelect}
            countrySelectProps={{ "aria-label": messages.country, emptyMessage: messages.noOptions }}
            className={cn(
              "flex h-[var(--fb-space-18,9.612vw)] tablet:h-[var(--fb-space-18-tablet,4.5vw)] desktop:h-[var(--fb-space-18-desktop,1.872vw)] w-full items-center gap-[var(--fb-space-2,1.068vw)] tablet:gap-[var(--fb-space-2-tablet,0.5vw)] desktop:gap-[var(--fb-space-2-desktop,0.208vw)] rounded-[var(--fb-space-4,2.136vw)] tablet:rounded-[var(--fb-space-4-tablet,1vw)] desktop:rounded-[var(--fb-space-4-desktop,0.416vw)] border border-input bg-transparent transition-colors",
              "focus-within:border-ring dark:bg-input/30",
              disabled && "opacity-50",
              fieldState.error && "border-destructive focus-within:border-destructive",
              isValid && "border-green-600 focus-within:border-green-600 dark:border-green-500",
            )}
            numberInputProps={{
              "aria-invalid": !!fieldState.error,
              "aria-describedby": fieldAriaDescribedBy(id, {
                description: config.description,
                error: fieldState.error,
              }),
            }}
          />
        </FieldWrapper>
        );
      }}
    />
  );
}
