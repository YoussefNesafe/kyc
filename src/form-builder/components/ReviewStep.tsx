"use client";

import { useFormContext, useWatch } from "react-hook-form";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
import { evaluateCondition, hiddenStepFieldNames } from "../core/conditions";
import type { AnyFieldConfig, FormConfig, FormValues } from "../core/types";
import { useFieldRuntime } from "./FieldRuntime";
import { formatReviewValue } from "./reviewValue";

function ReviewRow({
  field,
  value,
}: {
  field: AnyFieldConfig;
  value: unknown;
}) {
  const runtime = useFieldRuntime();
  const label = field.label || field.name;

  if (
    field.type === "signature" &&
    typeof value === "string" &&
    value.startsWith("data:image/")
  ) {
    return (
      <div className="flex flex-col gap-[var(--fb-space-2,1.068vw)] tablet:gap-[var(--fb-space-2-tablet,0.5vw)] desktop:gap-[var(--fb-space-2-desktop,0.208vw)]">
        <span className="text-[var(--fb-space-6,3.204vw)] tablet:text-[var(--fb-space-6-tablet,1.5vw)] desktop:text-[var(--fb-space-6-desktop,0.624vw)] text-muted-foreground">
          {label}
        </span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={value}
          alt={label}
          className="h-[var(--fb-space-24,12.816vw)] tablet:h-[var(--fb-space-24-tablet,6vw)] desktop:h-[var(--fb-space-24-desktop,2.496vw)] w-fit max-w-full rounded-[var(--fb-space-4,2.136vw)] tablet:rounded-[var(--fb-space-4-tablet,1vw)] desktop:rounded-[var(--fb-space-4-desktop,0.416vw)] border border-border bg-background"
        />
      </div>
    );
  }

  if (field.type === "group" && Array.isArray(value)) {
    const inner = (field as { fields: AnyFieldConfig[] }).fields;
    return (
      <div className="flex flex-col gap-[var(--fb-space-3,1.602vw)] tablet:gap-[var(--fb-space-3-tablet,0.75vw)] desktop:gap-[var(--fb-space-3-desktop,0.312vw)]">
        <span className="text-[var(--fb-space-6,3.204vw)] tablet:text-[var(--fb-space-6-tablet,1.5vw)] desktop:text-[var(--fb-space-6-desktop,0.624vw)] text-muted-foreground">
          {label}
        </span>
        {value.length === 0 && (
          <span className="text-[var(--fb-space-7,3.738vw)] tablet:text-[var(--fb-space-7-tablet,1.75vw)] desktop:text-[var(--fb-space-7-desktop,0.728vw)]">
            {runtime.messages.notAnswered}
          </span>
        )}
        {value.map((row, index) => (
          <div
            key={index}
            className="flex flex-col gap-[var(--fb-space-2,1.068vw)] tablet:gap-[var(--fb-space-2-tablet,0.5vw)] desktop:gap-[var(--fb-space-2-desktop,0.208vw)] rounded-[var(--fb-space-4,2.136vw)] tablet:rounded-[var(--fb-space-4-tablet,1vw)] desktop:rounded-[var(--fb-space-4-desktop,0.416vw)] border border-border p-[var(--fb-space-4,2.136vw)] tablet:p-[var(--fb-space-4-tablet,1vw)] desktop:p-[var(--fb-space-4-desktop,0.416vw)]"
          >
            {inner
              .filter(
                (innerField) =>
                  innerField.type !== "static" && innerField.type !== "submit",
              )
              .map((innerField) => (
                <div
                  key={innerField.name}
                  className="flex items-baseline justify-between gap-[var(--fb-space-6,3.204vw)] tablet:gap-[var(--fb-space-6-tablet,1.5vw)] desktop:gap-[var(--fb-space-6-desktop,0.624vw)]"
                >
                  <span className="text-[var(--fb-space-6,3.204vw)] tablet:text-[var(--fb-space-6-tablet,1.5vw)] desktop:text-[var(--fb-space-6-desktop,0.624vw)] text-muted-foreground">
                    {innerField.label || innerField.name}
                  </span>
                  <span className="text-[var(--fb-space-7,3.738vw)] tablet:text-[var(--fb-space-7-tablet,1.75vw)] desktop:text-[var(--fb-space-7-desktop,0.728vw)] text-end break-words">
                    {formatReviewValue(
                      {
                        ...innerField,
                        name: `${field.name}.${index}.${innerField.name}`,
                      },
                      (row as FormValues)?.[innerField.name],
                      runtime,
                    )}
                  </span>
                </div>
              ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-baseline justify-between gap-[var(--fb-space-6,3.204vw)] tablet:gap-[var(--fb-space-6-tablet,1.5vw)] desktop:gap-[var(--fb-space-6-desktop,0.624vw)]">
      <span className="text-[var(--fb-space-6,3.204vw)] tablet:text-[var(--fb-space-6-tablet,1.5vw)] desktop:text-[var(--fb-space-6-desktop,0.624vw)] text-muted-foreground">
        {label}
      </span>
      <span className="text-[var(--fb-space-7,3.738vw)] tablet:text-[var(--fb-space-7-tablet,1.75vw)] desktop:text-[var(--fb-space-7-desktop,0.728vw)] text-end break-words">
        {formatReviewValue(field, value, runtime)}
      </span>
    </div>
  );
}

export function ReviewStep({
  config,
  currentIndex,
  visibleIndices,
  goTo,
}: {
  config: FormConfig;
  currentIndex: number;
  visibleIndices: number[];
  goTo: (index: number) => void;
}) {
  const { control } = useFormContext();
  const { messages } = useFieldRuntime();
  useWatch({ control });
  const values = useFormContext().getValues();

  const steps = config.steps ?? [];
  const fieldsByName = new Map(
    config.fields.map((field) => [field.name, field]),
  );
  const stepHidden = hiddenStepFieldNames(config, values);

  const sections = visibleIndices
    .filter((index) => index < currentIndex && steps[index].review !== true)
    .map((index) => {
      const step = steps[index];
      const fields = (step.fieldNames ?? [])
        .map((name) => fieldsByName.get(name))
        .filter((field): field is AnyFieldConfig => field !== undefined)
        .filter(
          (field) =>
            !stepHidden.has(field.name) &&
            evaluateCondition(field.visibleWhen, values),
        )
        .filter((field) => field.type !== "static" && field.type !== "submit");
      return { index, step, fields };
    })
    .filter((section) => section.fields.length > 0);

  return (
    <div className="flex flex-col gap-[var(--fb-space-8,4.272vw)] tablet:gap-[var(--fb-space-8-tablet,2vw)] desktop:gap-[var(--fb-space-8-desktop,0.832vw)]">
      {sections.map((section, order) => (
        <section
          key={section.index}
          className="flex flex-col gap-[var(--fb-space-4,2.136vw)] tablet:gap-[var(--fb-space-4-tablet,1vw)] desktop:gap-[var(--fb-space-4-desktop,0.416vw)]"
        >
          {order > 0 && <Separator />}
          <div className="flex items-center justify-between">
            <h3 className="text-[var(--fb-space-7,3.738vw)] tablet:text-[var(--fb-space-7-tablet,1.75vw)] desktop:text-[var(--fb-space-7-desktop,0.728vw)] font-medium">
              {section.step.title}
            </h3>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              aria-label={`${messages.edit}: ${section.step.title}`}
              onClick={() => goTo(section.index)}
            >
              {messages.edit}
            </Button>
          </div>
          {section.fields.map((field) => (
            <ReviewRow
              key={field.name}
              field={field}
              value={values[field.name]}
            />
          ))}
        </section>
      ))}
    </div>
  );
}
