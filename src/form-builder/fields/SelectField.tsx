"use client";

import { useId, useState } from "react";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import { Check, ChevronsUpDown } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { cn } from "../internal/cn";
import type { FieldComponentProps } from "../core/registry";
import type { FieldConfig, Option } from "../core/types";
import { useFieldDisabled, useFieldRuntime } from "../components/FieldRuntime";
import { SKIP_SYNC, useSourceSync } from "../hooks/useSourceSync";
import { FieldWrapper, fieldAriaDescribedBy } from "../ui/FieldWrapper";

type SelectFieldConfig = Extract<FieldConfig, { type: "select" }>;

function optionByString(options: Option[], selected: string): Option["value"] | undefined {
  return options.find((option) => String(option.value) === selected)?.value;
}

const isBlankSource = (value: unknown): boolean => value === undefined || value === null || value === "";

function branchFor(map: Record<string, Option[]>, sourceValue: unknown): Option[] {
  return isBlankSource(sourceValue) ? [] : (map[String(sourceValue)] ?? []);
}

function useSelectOptions(config: SelectFieldConfig): Option[] {
  const { control } = useFormContext();
  const source = config.optionsFrom?.field;
  const sourceValue = useWatch({ control, name: source ?? config.name, disabled: !source });
  if (config.optionsFrom) return branchFor(config.optionsFrom.map, sourceValue);
  return config.options ?? [];
}

function useOptionsFromReset(config: SelectFieldConfig) {
  const map = config.optionsFrom?.map;
  const multiple = config.multiple === true;
  useSourceSync(config.name, config.optionsFrom?.field, {
    seed: () => SKIP_SYNC,
    change: (sourceValue, currentValue) => {
      const allowed = new Set(branchFor(map ?? {}, sourceValue).map((option) => option.value));
      if (multiple) {
        if (!Array.isArray(currentValue) || currentValue.length === 0) return SKIP_SYNC;
        const kept = currentValue.filter((entry) => allowed.has(entry as Option["value"]));
        return kept.length === currentValue.length ? SKIP_SYNC : kept;
      }
      if (currentValue === undefined || currentValue === null || currentValue === "") return SKIP_SYNC;
      return allowed.has(currentValue as Option["value"]) ? SKIP_SYNC : undefined;
    },
  });
}

export function SelectField({ field }: FieldComponentProps) {
  const config = field as SelectFieldConfig;
  const { control } = useFormContext();
  const fieldDisabled = useFieldDisabled(config);
  const { messages } = useFieldRuntime();
  const id = useId();
  const [open, setOpen] = useState(false);
  const options = useSelectOptions(config);
  useOptionsFromReset(config);
  const disabled = fieldDisabled || (!!config.optionsFrom && options.length === 0);

  const useCombobox = !!config.searchable || !!config.multiple;

  return (
    <Controller
      name={config.name}
      control={control}
      render={({ field: rhf, fieldState }) => {
        const describedBy = fieldAriaDescribedBy(id, {
          description: config.description,
          error: fieldState.error,
        });

        const control_ = useCombobox ? (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                ref={rhf.ref}
                id={id}
                type="button"
                variant="outline"
                role="combobox"
                aria-expanded={open}
                aria-invalid={!!fieldState.error}
                aria-describedby={describedBy}
                disabled={disabled}
                onBlur={rhf.onBlur}
                className="w-full justify-between font-normal"
              >
                <span className="truncate">
                  {config.multiple
                    ? Array.isArray(rhf.value) && rhf.value.length
                      ? options
                          .filter((option) => (rhf.value as Option["value"][]).includes(option.value))
                          .map((option) => option.label)
                          .join(", ")
                      : (config.placeholder ?? "")
                    : (options.find((option) => option.value === rhf.value)?.label ??
                      config.placeholder ??
                      "")}
                </span>
                <ChevronsUpDown className="ms-[var(--fb-space-4,2.136vw)] tablet:ms-[var(--fb-space-4-tablet,1vw)] desktop:ms-[var(--fb-space-4-desktop,0.416vw)] size-[var(--fb-space-8,4.272vw)] tablet:size-[var(--fb-space-8-tablet,2vw)] desktop:size-[var(--fb-space-8-desktop,0.832vw)] shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
              <Command>
                {config.searchable && <CommandInput placeholder={config.placeholder} />}
                <CommandList>
                  <CommandEmpty>{messages.noOptions}</CommandEmpty>
                  <CommandGroup>
                    {options.map((option) => {
                      const selected = config.multiple
                        ? Array.isArray(rhf.value) && (rhf.value as Option["value"][]).includes(option.value)
                        : rhf.value === option.value;
                      return (
                        <CommandItem
                          key={option.value}
                          value={`${option.label} ${option.value}`}
                          disabled={option.disabled}
                          onSelect={() => {
                            if (config.multiple) {
                              const current = Array.isArray(rhf.value) ? (rhf.value as Option["value"][]) : [];
                              rhf.onChange(
                                selected
                                  ? current.filter((entry) => entry !== option.value)
                                  : [...current, option.value],
                              );
                            } else {
                              rhf.onChange(option.value);
                              setOpen(false);
                            }
                          }}
                        >
                          <Check className={cn("me-[var(--fb-space-4,2.136vw)] tablet:me-[var(--fb-space-4-tablet,1vw)] desktop:me-[var(--fb-space-4-desktop,0.416vw)] size-[var(--fb-space-8,4.272vw)] tablet:size-[var(--fb-space-8-tablet,2vw)] desktop:size-[var(--fb-space-8-desktop,0.832vw)]", selected ? "opacity-100" : "opacity-0")} />
                          {option.label}
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        ) : (
          <Select
            value={rhf.value === undefined || rhf.value === null ? "" : String(rhf.value)}
            onValueChange={(selected) => rhf.onChange(optionByString(options, selected))}
            disabled={disabled}
          >
            <SelectTrigger
              ref={rhf.ref}
              id={id}
              aria-invalid={!!fieldState.error}
              aria-describedby={describedBy}
              onBlur={rhf.onBlur}
              className="w-full"
            >
              <SelectValue placeholder={config.placeholder} />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={String(option.value)} disabled={option.disabled}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

        return (
          <FieldWrapper
            id={id}
            label={config.label}
            description={config.description}
            required={config.required}
            disabled={disabled}
            error={fieldState.error}
          >
            {control_}
          </FieldWrapper>
        );
      }}
    />
  );
}
