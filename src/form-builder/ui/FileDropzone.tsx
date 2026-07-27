"use client";

import { useRef, useState, type DragEvent, type Ref } from "react";
import { Upload } from "lucide-react";
import { cn } from "../internal/cn";

/**
 * A drag-and-drop target for files. Presentation only: it hands whatever the
 * user picked to `onFiles` and knows nothing about validation, form state or
 * why a file might be unacceptable — `FileField` owns all of that.
 *
 * ## Why there is no click handler
 *
 * The control is a real `<input type="file">`. It carries `accept`, `multiple`
 * and `disabled`, it opens the platform file picker on Enter or Space with no
 * JavaScript, and assistive tech announces it as a file-upload control — which
 * is what it is. A `<label>` pointed at it turns the prompt into a second way
 * to reach the same control, again with no JavaScript and no invented ARIA.
 *
 * The outer `<div>` exists only to catch drag events, which is why it has no
 * role, no tabindex and no click handler: it is a drop surface, not a control.
 * Dragging deliberately has no keyboard equivalent because it needs none — the
 * input already offers the same capability to a keyboard user, so there is
 * nothing here that only a mouse can do.
 *
 * ## Naming
 *
 * `input[type=file]` maps to no ARIA role, so it cannot be found by role at
 * all — tests must query it by its accessible name. That name is assembled
 * from *every* label pointing at the input, in DOM order: `FieldWrapper`'s
 * field label first, then this one's `prompt`, joined by a space (measured in
 * jsdom: "Identity documents Drag files here, or browse"). So the field label
 * stays the leading words a screen-reader user hears, and `prompt` reads as the
 * affordance that follows it.
 *
 * `hint` names the accepted formats and the size ceiling, which belong in the
 * *description* — a name that grew every time `accept` did would be unusable.
 * It therefore sits outside the `<label>`, as a sibling referenced by
 * `aria-describedby`. Marking it `aria-hidden` inside the label would compute
 * to the same two strings, but only by way of a rule about hidden nodes being
 * exposed when referenced; keeping it out of every label means the name is
 * whatever the labels say and nothing has to be reasoned about. The cost is
 * that the hint line itself is not a click target — the prompt above it is.
 */
export type FileDropzoneProps = {
  /** Id of the file input. The hint element derives its own id from this. */
  id: string;
  /**
   * The dropzone's own contribution to the input's accessible name, appended
   * after any field label already pointing at `id`.
   */
  prompt: string;
  /**
   * Constraints as prose ("PDF, JPG or PNG, max 5 MB"). Reaches assistive tech
   * as a description, never as part of the name. An empty string renders
   * nothing and contributes no `aria-describedby` id.
   */
  hint?: string;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  /**
   * Ids to describe the input with, placed *after* this component's own hint.
   * The resulting order is hint, then whatever these carry — which for
   * `FieldWrapper` means description then error, so the input reads as
   * constraints, guidance, problem. Error last is what the shadcn primitives
   * already do; the hint leads because it is the one part that is true before
   * the user has done anything.
   */
  describedBy?: string;
  /** Called with a non-empty list every time the user picks or drops files. */
  onFiles: (files: File[]) => void;
  onBlur?: () => void;
  /** Forwarded to the input, so react-hook-form can focus the field on error. */
  ref?: Ref<HTMLInputElement>;
};

const ROOT_CLASS =
  "flex flex-col items-center justify-center gap-[var(--fb-space-3,1.602vw)] tablet:gap-[var(--fb-space-3-tablet,0.75vw)] desktop:gap-[var(--fb-space-3-desktop,0.312vw)] rounded-[var(--fb-space-5,2.67vw)] tablet:rounded-[var(--fb-space-5-tablet,1.25vw)] desktop:rounded-[var(--fb-space-5-desktop,0.52vw)] border border-dashed px-[var(--fb-space-6,3.204vw)] tablet:px-[var(--fb-space-6-tablet,1.5vw)] desktop:px-[var(--fb-space-6-desktop,0.624vw)] py-[var(--fb-space-10,5.34vw)] tablet:py-[var(--fb-space-10-tablet,2.5vw)] desktop:py-[var(--fb-space-10-desktop,1.04vw)] text-center";

export function FileDropzone({
  id,
  prompt,
  hint,
  accept,
  multiple,
  disabled,
  invalid,
  describedBy,
  onFiles,
  onBlur,
  ref,
}: FileDropzoneProps) {
  const [dragging, setDragging] = useState(false);
  /**
   * `dragenter`/`dragleave` fire again for every child element the pointer
   * crosses, so a plain boolean flickers off the moment the pointer moves from
   * the box onto the icon inside it. Counting entries and leaves is stable
   * whatever the box contains, and `drop`/`dragend` reset it outright so a
   * dropped-and-cancelled sequence cannot leave the count stuck above zero.
   */
  const depth = useRef(0);

  const hintId = hint ? `${id}-hint` : undefined;
  const description = [hintId, describedBy].filter(Boolean).join(" ") || undefined;

  const stopDragging = () => {
    depth.current = 0;
    setDragging(false);
  };

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    if (disabled) return;
    event.preventDefault();
    depth.current += 1;
    setDragging(true);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (disabled) return;
    // Without this the browser treats the drop as a navigation and replaces the
    // page with the dropped file. Nothing else here can compensate for it.
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
  };

  const handleDragLeave = () => {
    if (disabled) return;
    depth.current = Math.max(0, depth.current - 1);
    if (depth.current === 0) setDragging(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    if (disabled) return;
    event.preventDefault();
    stopDragging();
    const dropped = Array.from(event.dataTransfer?.files ?? []);
    if (dropped.length) onFiles(dropped);
  };

  return (
    <div
      data-slot="file-dropzone"
      data-dragging={dragging || undefined}
      data-disabled={disabled || undefined}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDragEnd={stopDragging}
      onDrop={handleDrop}
      className={cn(
        ROOT_CLASS,
        invalid ? "border-destructive" : "border-input",
        dragging && "border-primary bg-accent",
        disabled && "opacity-50",
        // The input is `sr-only`, so its own focus ring is invisible; the box it
        // labels has to show the focus instead or keyboard users lose their place.
        "has-[input:focus-visible]:border-primary",
      )}
    >
      <label
        htmlFor={id}
        className={cn(
          "flex flex-col items-center gap-[var(--fb-space-3,1.602vw)] tablet:gap-[var(--fb-space-3-tablet,0.75vw)] desktop:gap-[var(--fb-space-3-desktop,0.312vw)]",
          disabled ? "cursor-not-allowed" : "cursor-pointer",
        )}
      >
        <input
          ref={ref}
          id={id}
          type="file"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          className="sr-only"
          aria-describedby={description}
          aria-invalid={invalid || undefined}
          onChange={(event) => {
            const picked = Array.from(event.target.files ?? []);
            if (picked.length) onFiles(picked);
            // Lets the same file be picked twice in a row — without it the input's
            // value is unchanged the second time and `change` never fires.
            event.target.value = "";
          }}
          onBlur={onBlur}
        />
        <Upload
          aria-hidden="true"
          className="size-[var(--fb-space-12,6.408vw)] tablet:size-[var(--fb-space-12-tablet,3vw)] desktop:size-[var(--fb-space-12-desktop,1.248vw)] text-muted-foreground"
        />
        {prompt}
      </label>
      {hint && (
        <span
          id={hintId}
          className="font-mono text-[var(--fb-space-6,3.204vw)] tablet:text-[var(--fb-space-6-tablet,1.5vw)] desktop:text-[var(--fb-space-6-desktop,0.624vw)] text-muted-foreground"
        >
          {hint}
        </span>
      )}
    </div>
  );
}
