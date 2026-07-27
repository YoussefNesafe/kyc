"use client";

import { useFieldArray, useFormContext, useFormState } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { Separator } from "../components/ui/separator";
import type { FieldComponentProps } from "../core/registry";
import type { AnyFieldConfig, ConditionSpec, FieldConfig } from "../core/types";
import { toConditionGroups } from "../core/conditions";
import { renderField } from "../components/renderField";
import { useFieldDisabled, useFieldRuntime } from "../components/FieldRuntime";
import { FieldWrapper } from "../ui/FieldWrapper";
import { buildDefaultValues } from "../core/defaults";

type GroupFieldConfig = Extract<FieldConfig, { type: "group" }>;

function prefixConditionSpec(spec: ConditionSpec | undefined, prefix: string): ConditionSpec | undefined {
  if (!spec) return undefined;
  return {
    anyOf: toConditionGroups(spec).map((group) =>
      group.map((condition) => ({ ...condition, field: `${prefix}.${condition.field}` })),
    ),
  };
}

export function withNamePrefix(field: AnyFieldConfig, prefix: string): AnyFieldConfig {
  return {
    ...field,
    name: `${prefix}.${field.name}`,
    visibleWhen: prefixConditionSpec(field.visibleWhen, prefix),
    disabledWhen: prefixConditionSpec(field.disabledWhen, prefix),
    enabledWhen: prefixConditionSpec(field.enabledWhen, prefix),
  };
}

export function GroupField({ field }: FieldComponentProps) {
  const config = field as GroupFieldConfig;
  const { control } = useFormContext();
  const disabled = useFieldDisabled(config);
  const { messages } = useFieldRuntime();
  const { fields: rows, append, remove } = useFieldArray({ control, name: config.name });
  const { errors } = useFormState({ control, name: config.name });
  const rootError = errors[config.name]?.root ?? errors[config.name];
  const groupError =
    rootError && typeof rootError.message === "string" ? { message: rootError.message } : undefined;

  const min = config.min ?? 0;
  const max = config.max ?? Number.POSITIVE_INFINITY;

  return (
    <FieldWrapper
      asGroup
      label={config.label}
      description={config.description}
      required={config.required}
      disabled={disabled}
      error={groupError}
    >
      <div className="flex flex-col gap-[var(--fb-space-8,4.272vw)] tablet:gap-[var(--fb-space-8-tablet,2vw)] desktop:gap-[var(--fb-space-8-desktop,0.832vw)]">
        {rows.map((row, index) => (
          <div key={row.id} className="flex flex-col gap-[var(--fb-space-8,4.272vw)] tablet:gap-[var(--fb-space-8-tablet,2vw)] desktop:gap-[var(--fb-space-8-desktop,0.832vw)]">
            {index > 0 && <Separator />}
            <div className="grid grid-cols-4 items-start gap-[var(--fb-space-8,4.272vw)] tablet:gap-[var(--fb-space-8-tablet,2vw)] desktop:gap-[var(--fb-space-8-desktop,0.832vw)]">
              <div className="col-span-3 grid grid-cols-12 gap-[var(--fb-space-8,4.272vw)] tablet:gap-[var(--fb-space-8-tablet,2vw)] desktop:gap-[var(--fb-space-8-desktop,0.832vw)]">
                {config.fields.map((inner) => renderField(withNamePrefix(inner, `${config.name}.${index}`)))}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={disabled || rows.length <= min}
                aria-label={messages.removeRow(index + 1)}
                onClick={() => remove(index)}
              >
                <Trash2 className="size-[var(--fb-space-8,4.272vw)] tablet:size-[var(--fb-space-8-tablet,2vw)] desktop:size-[var(--fb-space-8-desktop,0.832vw)]" />
              </Button>
            </div>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          disabled={disabled || rows.length >= max}
          onClick={() => append(buildDefaultValues(config.fields))}
          className="w-fit"
        >
          <Plus className="me-[var(--fb-space-4,2.136vw)] tablet:me-[var(--fb-space-4-tablet,1vw)] desktop:me-[var(--fb-space-4-desktop,0.416vw)] size-[var(--fb-space-8,4.272vw)] tablet:size-[var(--fb-space-8-tablet,2vw)] desktop:size-[var(--fb-space-8-desktop,0.832vw)]" />
          {config.placeholder ?? messages.addRow}
        </Button>
      </div>
    </FieldWrapper>
  );
}
