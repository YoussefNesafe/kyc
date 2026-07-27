"use client";

import { useId, useState } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import type { DateRange, Matcher } from "react-day-picker";
import { Button } from "../components/ui/button";
import { Calendar } from "../components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { cn } from "../internal/cn";
import type { FieldComponentProps } from "../core/registry";
import type { FieldConfig } from "../core/types";
import { useFieldDisabled, useFieldRuntime } from "../components/FieldRuntime";
import { FieldWrapper, fieldAriaDescribedBy } from "../ui/FieldWrapper";

type DateFieldConfig = Extract<FieldConfig, { type: "date" }>;

const CALENDAR_YEARS_BACK = 100;
const CALENDAR_YEARS_FORWARD = 10;
const JANUARY = 0;
const DECEMBER = 11;

type IsoRange = { from?: string; to?: string };

function parseIso(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return undefined;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function toDateString(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/**
 * Whether `minDate`/`maxDate` shape the calendar as well as the schema.
 * `"validate"` is the only way a user driving the picker can reach a bound
 * violation and be told why it fails.
 */
function restrictsPicker(config: DateFieldConfig): boolean {
  return config.pickerBounds !== "validate";
}

function dayMatcher(config: DateFieldConfig): Matcher[] | undefined {
  if (!restrictsPicker(config)) return undefined;
  const min = parseIso(config.minDate);
  const max = parseIso(config.maxDate);
  const matchers: Matcher[] = [...(min ? [{ before: min }] : []), ...(max ? [{ after: max }] : [])];
  return matchers.length ? matchers : undefined;
}

function calendarNavigation(config: DateFieldConfig) {
  const min = parseIso(config.minDate);
  const max = parseIso(config.maxDate);
  const now = new Date();
  const restricted = restrictsPicker(config);
  // The span to browse when nothing narrows it — a usable range around today
  // rather than every month react-day-picker would otherwise offer.
  const genericStart = new Date(now.getFullYear() - CALENDAR_YEARS_BACK, JANUARY);
  const genericEnd = new Date(now.getFullYear() + CALENDAR_YEARS_FORWARD, DECEMBER);
  // Unrestricted, the bounds may only *widen* the span, never replace it: dates
  // between a far-off bound and the generic edge are schema-valid, so the mode
  // whose job is reaching out-of-range dates must not hide in-range ones. Both
  // bounds count at both ends — a minDate past genericEnd has to pull the end
  // forward, or the only selectable dates are ones the schema rejects.
  const spread = [min, max].filter((d): d is Date => d !== undefined).map((d) => d.getTime());
  return {
    captionLayout: "dropdown" as const,
    startMonth: restricted ? (min ?? genericStart) : new Date(Math.min(genericStart.getTime(), ...spread)),
    endMonth: restricted ? (max ?? genericEnd) : new Date(Math.max(genericEnd.getTime(), ...spread)),
    // A landing month, not a bound, so it survives `"validate"` — and only
    // there does it carry weight: under `"restrict"`, endMonth already pins the
    // calendar to `max`. The condition targets the past-cutoff shape (a date of
    // birth, where opening a century back beats opening on today); every other
    // configuration keeps react-day-picker's own landing month of today.
    defaultMonth: max && max < now ? max : undefined,
  };
}

export function DateField({ field }: FieldComponentProps) {
  const config = field as DateFieldConfig;
  const { control } = useFormContext();
  const disabled = useFieldDisabled(config);
  const { locale } = useFieldRuntime();
  const id = useId();
  const [open, setOpen] = useState(false);
  const dateFnsLocale = locale?.dateFns;
  const display = (date: Date) => format(date, "PP", { locale: dateFnsLocale });

  return (
    <Controller
      name={config.name}
      control={control}
      render={({ field: rhf, fieldState }) => {
        const label = config.range
          ? (() => {
              const range = (rhf.value as IsoRange | undefined) ?? {};
              const from = parseIso(range.from);
              const to = parseIso(range.to);
              if (from && to) return `${display(from)} – ${display(to)}`;
              if (from) return `${display(from)} –`;
              return config.placeholder ?? "";
            })()
          : (() => {
              const date = parseIso(rhf.value as string | undefined);
              return date ? display(date) : (config.placeholder ?? "");
            })();

        return (
          <FieldWrapper
            id={id}
            label={config.label}
            description={config.description}
            required={config.required}
            disabled={disabled}
            error={fieldState.error}
          >
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  ref={rhf.ref}
                  id={id}
                  type="button"
                  variant="outline"
                  disabled={disabled}
                  aria-invalid={!!fieldState.error}
                  aria-describedby={fieldAriaDescribedBy(id, {
                    description: config.description,
                    error: fieldState.error,
                  })}
                  onBlur={rhf.onBlur}
                  className={cn("w-full justify-start font-normal", !label && "text-muted-foreground")}
                >
                  <CalendarIcon className="me-[var(--fb-space-4,2.136vw)] tablet:me-[var(--fb-space-4-tablet,1vw)] desktop:me-[var(--fb-space-4-desktop,0.416vw)] size-[var(--fb-space-8,4.272vw)] tablet:size-[var(--fb-space-8-tablet,2vw)] desktop:size-[var(--fb-space-8-desktop,0.832vw)]" />
                  {label}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                {config.range ? (
                  <Calendar
                    mode="range"
                    locale={dateFnsLocale}
                    {...calendarNavigation(config)}
                    selected={(() => {
                      const range = (rhf.value as IsoRange | undefined) ?? {};
                      const from = parseIso(range.from);
                      return from ? ({ from, to: parseIso(range.to) } satisfies DateRange) : undefined;
                    })()}
                    onSelect={(range) => {
                      rhf.onChange(
                        range?.from
                          ? { from: toDateString(range.from), ...(range.to && { to: toDateString(range.to) }) }
                          : undefined,
                      );
                      if (range?.from && range?.to) setOpen(false);
                    }}
                    disabled={dayMatcher(config)}
                  />
                ) : (
                  <Calendar
                    mode="single"
                    locale={dateFnsLocale}
                    {...calendarNavigation(config)}
                    selected={parseIso(rhf.value as string | undefined)}
                    onSelect={(date) => {
                      rhf.onChange(date ? toDateString(date) : undefined);
                      setOpen(false);
                    }}
                    disabled={dayMatcher(config)}
                  />
                )}
              </PopoverContent>
            </Popover>
          </FieldWrapper>
        );
      }}
    />
  );
}
