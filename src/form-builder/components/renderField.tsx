"use client";

import { getField } from "../core/registry";
import type { AnyFieldConfig } from "../core/types";
import { fieldWidthClass } from "../ui/variants";
import { FieldGate } from "./FieldRuntime";

export function renderField(field: AnyFieldConfig) {
  const Component = getField(field.type);

  if (!Component) {
    if (process.env.NODE_ENV === "production") return null;
    return (
      <div key={field.name} className="col-span-12 border border-destructive p-[var(--fb-space-4,2.136vw)] tablet:p-[var(--fb-space-4-tablet,1vw)] desktop:p-[var(--fb-space-4-desktop,0.416vw)] text-destructive">
        Unknown field type &quot;{field.type}&quot;
      </div>
    );
  }

  return (
    <FieldGate key={field.name} field={field}>
      {field.type === "hidden" ? (
        <Component field={field} />
      ) : (
        <div className={fieldWidthClass(field.width)}>
          <Component field={field} />
        </div>
      )}
    </FieldGate>
  );
}
