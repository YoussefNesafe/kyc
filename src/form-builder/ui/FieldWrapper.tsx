"use client";

import type { ReactNode } from "react";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "../components/ui/field";
import { useFieldRuntime } from "../components/FieldRuntime";
import { cn } from "../internal/cn";
import { fieldWrapperVariants, type FieldWrapperSize } from "./variants";
import { RequiredMark } from "./RequiredMark";

/**
 * Flat pill: border only, no shadow or fill, one step down from the label's
 * text size. Sits inside the label, so it must not read as a control. Restyle
 * it from the consumer side via `[data-slot="field-badge"]`, the same hook the
 * shadcn primitives around it expose.
 */
const BADGE_CLASS =
  "inline-flex items-center ms-[var(--fb-space-2,1.068vw)] tablet:ms-[var(--fb-space-2-tablet,0.5vw)] desktop:ms-[var(--fb-space-2-desktop,0.208vw)] rounded-[var(--fb-space-1,0.534vw)] tablet:rounded-[var(--fb-space-1-tablet,0.25vw)] desktop:rounded-[var(--fb-space-1-desktop,0.104vw)] border px-[var(--fb-space-2,1.068vw)] tablet:px-[var(--fb-space-2-tablet,0.5vw)] desktop:px-[var(--fb-space-2-desktop,0.208vw)] text-[var(--fb-space-6,3.204vw)] tablet:text-[var(--fb-space-6-tablet,1.5vw)] desktop:text-[var(--fb-space-6-desktop,0.624vw)] font-normal text-muted-foreground";

type FieldWrapperProps = {
  id?: string;
  label?: string;
  description?: ReactNode;
  /**
   * Overrides the `badge` on the field config `FieldGate` publishes. Field
   * components leave this alone — the point of the context channel is that they
   * don't have to pass it. It exists for a wrapper rendered by hand, outside a
   * gate, where there is no config to read.
   */
  badge?: ReactNode;
  required?: boolean;
  disabled?: boolean;
  size?: FieldWrapperSize;
  error?: { message?: string };
  className?: string;
  asGroup?: boolean;
  children: ReactNode;
};

/**
 * Whether React would render anything for this node. Not the same as
 * truthiness: `0` renders a literal "0" but is falsy, so a `&&` guard would
 * drop it. Both the description element and its id hang off this one predicate,
 * so a control can never point at an id that was never put in the DOM.
 */
function rendersContent(node: ReactNode): boolean {
  return node !== undefined && node !== null && node !== false && node !== true && node !== "";
}

export function fieldAriaDescribedBy(
  id: string | undefined,
  { description, error }: { description?: ReactNode; error?: { message?: string } },
): string | undefined {
  if (!id) return undefined;
  const ids = [rendersContent(description) && `${id}-description`, error && `${id}-error`].filter(Boolean);
  return ids.length ? ids.join(" ") : undefined;
}

export function FieldWrapper({
  id,
  label,
  description,
  badge,
  required,
  disabled,
  size,
  error,
  className,
  asGroup,
  children,
}: FieldWrapperProps) {
  // `badge` is the one piece of field config this wrapper reads for itself.
  // Every rendered field is wrapped in a `FieldGate`, which publishes its
  // config here — so a declarative annotation reaches every built-in field
  // type (and any custom one) without a prop threaded through each of them.
  const configBadge = useFieldRuntime().field?.badge;
  const resolvedBadge = badge ?? configBadge;
  const sharedClassName = cn(fieldWrapperVariants({ size }), className);

  // Built once so the <label> and <legend> branches can never drift apart.
  const labelContent = (
    <>
      {label}
      {required && <RequiredMark />}
      {rendersContent(resolvedBadge) && (
        <>
          {/*
           * A comma, not a space. Read aloud, "Tax identification number
           * Required in Germany" runs together as one phrase and is easy to
           * mishear as part of the name; the comma buys a pause.
           *
           * Hidden rather than written into the label, because the flex <label>
           * gaps every child equally — a visible comma would float detached
           * between the text and the pill.
           *
           * Only the comma itself is guaranteed, not the space around it. The
           * name algorithm trims each ELEMENT child's own contribution and then
           * prefixes a separator only for children whose computed display is
           * not `inline`, and `sr-only` blockifies this span by positioning it.
           * So a styled browser announces "number , badge" and an unstyled one
           * "number,badge". Inaudible either way — screen readers pause on the
           * comma and never voice the spacing — which is why the test matches
           * both rather than pinning the jsdom-only form.
           */}
          <span className="sr-only">,</span>
          <span data-slot="field-badge" className={BADGE_CLASS}>
            {resolvedBadge}
          </span>
        </>
      )}
    </>
  );

  const body = (
    <>
      {children}
      {rendersContent(description) && (
        <FieldDescription id={id ? `${id}-description` : undefined}>{description}</FieldDescription>
      )}
      <FieldError id={id ? `${id}-error` : undefined} errors={error ? [error] : undefined} />
    </>
  );

  if (asGroup) {
    return (
      <FieldSet data-disabled={disabled || undefined} className={sharedClassName}>
        {label && <FieldLegend variant="label">{labelContent}</FieldLegend>}
        {body}
      </FieldSet>
    );
  }

  return (
    <Field data-disabled={disabled || undefined} className={sharedClassName}>
      {label && <FieldLabel htmlFor={id}>{labelContent}</FieldLabel>}
      {body}
    </Field>
  );
}
