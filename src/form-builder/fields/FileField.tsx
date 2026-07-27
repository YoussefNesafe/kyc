"use client";

import { useId, useRef, useState } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { X } from "lucide-react";
import { Button } from "../components/ui/button";
import type { FieldComponentProps } from "../core/registry";
import type { FieldConfig } from "../core/types";
import { acceptedFormatsLabel } from "../core/fileAccept";
import { BYTES_PER_KB, BYTES_PER_MB } from "../core/units";
import { useFieldDisabled, useFieldRuntime } from "../components/FieldRuntime";
import { FieldWrapper, fieldAriaDescribedBy } from "../ui/FieldWrapper";
import { FileDropzone } from "../ui/FileDropzone";

type FileFieldConfig = Extract<FieldConfig, { type: "file" }>;

const MIN_DISPLAYED_KB = 1;

function formatSize(bytes: number): string {
  if (bytes >= BYTES_PER_MB) return `${(bytes / BYTES_PER_MB).toFixed(1)} MB`;
  return `${Math.max(MIN_DISPLAYED_KB, Math.round(bytes / BYTES_PER_KB))} KB`;
}

type FileErrorLike = { message?: string };

/**
 * The per-index shape: a sparse array. A narrowing predicate rather than a cast,
 * so the two shapes stay two types instead of one intersection asserting that
 * every error is both at once — which is the thing that is not true.
 */
function isPerFileErrors(error: unknown): error is ArrayLike<FileErrorLike | undefined> {
  return Array.isArray(error);
}

/** The `message` of an error object, for any shape that carries one. */
function messageOf(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("message" in error)) return undefined;
  const { message } = error;
  return typeof message === "string" && message !== "" ? message : undefined;
}

type FileErrors = {
  /** Why the file at `index` was rejected, or undefined when nothing is wrong with it. */
  reasonAt: (index: number) => string | undefined;
  /** What the field-level error region should show, in `FieldWrapper`'s shape. */
  fieldError: { message: string } | undefined;
};

const NO_FILE_ERRORS: FileErrors = { reasonAt: () => undefined, fieldError: undefined };

/**
 * The one place this component reads react-hook-form's error for a file field.
 *
 * RHF types `fieldState.error` as a `FieldError` — an object with a `message`.
 * A multi-file field does not produce that. `core/validation.ts` reports one
 * issue per index, and RHF maps those onto a *sparse array* keyed by index
 * (measured: `Object.keys` returns only the failing indices, and the array's
 * own `message` is `undefined`). Reading `.message` off it — which is what this
 * component used to pass straight to `FieldWrapper` — therefore rendered
 * nothing at all for every multi-file rejection.
 *
 * Three shapes reach here, and each has a test that renders it:
 * - a sparse array, from per-index issues on a multi-file field;
 * - a plain `FieldError`, from a single-file field, whose one message is that
 *   one file's reason (its issues are reported at the field's own path);
 * - a plain `FieldError`, from a list-level rule on a multi-file field, which
 *   today means only `min(1)` — emptying a required list.
 *
 * `multiple` is what tells the last two apart. Note what it is and is not: with
 * `min(1)` as the only list-level rule, a list-level message and a rendered row
 * cannot coexist — the rule fails only on an empty list — so nothing observable
 * changes if the check is dropped, and no test can defend it.
 *
 * ## What this function cannot survive, and what it costs
 *
 * A *second* list-level rule — a cap on how many files, say — breaks it
 * outright, and the `multiple` check above does not save it. Measured, by
 * temporarily adding `.max(1)` to the array schema and dropping two files with
 * one bad type: RHF merges an issue at `["docs"]` and one at `["docs", 1]` into
 * a single plain object, `{ 1: {...}, message: "Too many files", type, ref }`.
 * `Array.isArray` is false, so the non-array branch runs, and every per-file
 * reason on every row disappears — the rendered field went from naming the
 * TIFF to showing only "Too many files". That is the same class of silent total
 * blanking this function exists to fix, arriving through the other door.
 *
 * So whoever adds that rule has to teach this function the fourth shape: an
 * object that is *both*, whose numeric keys are per-file reasons and whose
 * `message` is the list-level one. It is not written now because there is no
 * way to produce it from a config today, and a branch no config can reach is a
 * branch no test can defend — but the failure is specific, so it is named here
 * rather than left as a warning that something might go wrong.
 *
 * Only the *first* issue per path survives RHF's default `criteriaMode:
 * "firstError"`, which is why a file that is both the wrong type and too large
 * reports the type — `fileIssueReporter` emits type first deliberately.
 */
function readFileErrors(error: unknown, multiple: boolean | undefined): FileErrors {
  if (!error) return NO_FILE_ERRORS;

  if (!isPerFileErrors(error)) {
    const message = messageOf(error);
    if (!message) return NO_FILE_ERRORS;
    return {
      reasonAt: (index) => (multiple || index !== 0 ? undefined : message),
      fieldError: { message },
    };
  }

  const reasonAt = (index: number) => messageOf(error[index]);
  // The field-level region repeats the first rejection rather than summarising
  // the set. It is the only part of the field with `role="alert"`, so it is what
  // announces that something went wrong, and a concrete sentence says more than
  // a count; every reason is still on its own row for the rest.
  //
  // Accepted cost: with one file rejected, that sentence is on screen twice and
  // spoken twice — once by the alert, once by the row it also sits in. The
  // alternative is a count ("1 file can't be uploaded"), which announces without
  // saying anything and sends the user hunting for the row. Repetition is the
  // cheaper of the two, but it is a real cost, not an oversight: if this field
  // ever grows a summary line, that is the thing to reach for instead.
  let first: string | undefined;
  for (let index = 0; index < error.length && first === undefined; index += 1) {
    first = reasonAt(index);
  }
  return { reasonAt, fieldError: first ? { message: first } : undefined };
}

/**
 * The single-vs-multiple difference, stated once. Every other part of this file
 * reads `files` and calls `add`/`remove`, so the two shapes of `rhf.value` — a
 * `File` or a `File[]` — are decided here and nowhere else.
 *
 * `add` returns what it could not take alongside the new value. A single-file
 * field can hold exactly one, and a drop can carry any number of files
 * regardless of `multiple`: `handleDrop` reads `dataTransfer.files`, which the
 * attribute does not filter. Returning the remainder rather than discarding it
 * inside here is the point — the caller has to decide what to say about it,
 * where before it silently vanished. (The picker cannot reach this: without
 * `multiple` the OS dialog only lets one file be chosen. Drag-and-drop is the
 * whole reason the case exists.)
 */
function fileValue(value: unknown, multiple: boolean | undefined) {
  const files: File[] = multiple
    ? Array.isArray(value)
      ? (value as File[])
      : []
    : value instanceof File
      ? [value]
      : [];

  return {
    files,
    add: (incoming: File[]): { value: File | File[] | undefined; notTaken: File[] } =>
      multiple
        ? { value: [...files, ...incoming], notTaken: [] }
        : { value: incoming[0], notTaken: incoming.slice(1) },
    remove: (index: number): File | File[] | undefined =>
      multiple ? files.filter((_, i) => i !== index) : undefined,
  };
}

/**
 * ## Rejected files are kept, not refused
 *
 * A file that fails `accept` or `maxSizeMB` still enters the value and renders
 * as a rejected row carrying its own reason. Dropping it on the floor would be
 * easier, but the schema only has something to say about files that are *in*
 * the value — refuse them at the door and the user gets silence where the
 * reason should be, plus a field that looks empty for no stated cause.
 *
 * Nothing is read from the file to decide this. A `File` is a handle, and the
 * engine never opens it: uploading is the host's job, in `onSubmit`, which a
 * rejected file never reaches because the field is invalid. So an oversized
 * file is turned away before anything processes it, and is still able to
 * explain itself.
 *
 * The same principle covers files a single-file field has no room for: dropping
 * three files on one holds the first and *says so*, rather than keeping one and
 * letting two disappear. That message is not a validation error — nothing is
 * wrong with the value — so it goes through the status region beside the count,
 * not through the schema.
 *
 * Validation is re-run eagerly on every add and remove, which overrides the
 * form's `mode` for this one field. Deliberate, and the same call `useOtpFlow`
 * makes: a file's verdict depends on nothing the user can still be in the
 * middle of typing, so waiting for a blur that may never come would leave a
 * rejected row sitting there unexplained.
 */
export function FileField({ field }: FieldComponentProps) {
  const config = field as FileFieldConfig;
  const { control, trigger } = useFormContext();
  const disabled = useFieldDisabled(config);
  const { messages } = useFieldRuntime();
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  // Not derivable from the value: it records what did *not* become part of it.
  // Cleared by the next change, so it never outlives the action it describes.
  const [notTaken, setNotTaken] = useState<string | undefined>(undefined);

  const hint = messages.fileHint(acceptedFormatsLabel(config.accept), config.maxSizeMB);

  return (
    <Controller
      name={config.name}
      control={control}
      render={({ field: rhf, fieldState }) => {
        const value = fileValue(rhf.value, config.multiple);
        const { files } = value;
        const errors = readFileErrors(fieldState.error, config.multiple);

        // Both refs want the same node: react-hook-form's, so it can focus the
        // field when a submit fails, and ours, so removing a row can put focus
        // back somewhere that exists. Declared per render, so React detaches and
        // reattaches it every time — which costs nothing here: RHF's own ref
        // ignores a null argument, and `inputRef` is only ever read from an
        // event handler, long after the commit has settled it on the node.
        const setInputRef = (node: HTMLInputElement | null) => {
          inputRef.current = node;
          rhf.ref(node);
        };

        const acceptFiles = (incoming: File[]) => {
          const { value: next, notTaken: refused } = value.add(incoming);
          rhf.onChange(next);
          setNotTaken(
            refused.length && next instanceof File ? messages.oneFileOnly(next.name) : undefined,
          );
          void trigger(config.name);
        };

        const removeFile = (index: number) => {
          rhf.onChange(value.remove(index));
          setNotTaken(undefined);
          // The removed row held the focus, so without this it lands on <body>
          // and a keyboard user restarts from the top of the page.
          inputRef.current?.focus();
          void trigger(config.name);
        };

        return (
          <FieldWrapper
            id={id}
            label={config.label}
            description={config.description}
            required={config.required}
            disabled={disabled}
            error={errors.fieldError}
          >
            <FileDropzone
              ref={setInputRef}
              id={id}
              prompt={config.placeholder ?? messages.dropFiles}
              hint={hint}
              accept={config.accept}
              multiple={config.multiple}
              disabled={disabled}
              invalid={!!errors.fieldError}
              describedBy={fieldAriaDescribedBy(id, {
                description: config.description,
                error: errors.fieldError,
              })}
              onFiles={acceptFiles}
              onBlur={rhf.onBlur}
            />
            {/*
             * Rendered whether or not there are files, because a live region
             * has to be in the document *before* its content changes for the
             * change to be announced — created and populated in the same commit,
             * the first selection would go unspoken.
             */}
            <div
              role="status"
              className="flex flex-col gap-[var(--fb-space-1,0.534vw)] tablet:gap-[var(--fb-space-1-tablet,0.25vw)] desktop:gap-[var(--fb-space-1-desktop,0.104vw)] text-[var(--fb-space-7,3.738vw)] tablet:text-[var(--fb-space-7-tablet,1.75vw)] desktop:text-[var(--fb-space-7-desktop,0.728vw)] text-muted-foreground"
            >
              {files.length > 0 && <span>{messages.filesSelected(files.length)}</span>}
              {/*
               * Files a single-file field had no room for. It rides in the same
               * region as the count because it is a fact about the same action,
               * and because that region is already the polite announcement
               * channel — a second one would race it.
               */}
              {notTaken && <span>{notTaken}</span>}
            </div>
            {files.length > 0 && (
              <ul className="flex flex-col gap-[var(--fb-space-3,1.602vw)] tablet:gap-[var(--fb-space-3-tablet,0.75vw)] desktop:gap-[var(--fb-space-3-desktop,0.312vw)] text-[var(--fb-space-7,3.738vw)] tablet:text-[var(--fb-space-7-tablet,1.75vw)] desktop:text-[var(--fb-space-7-desktop,0.728vw)]">
                {files.map((file, index) => (
                  <FileRow
                    /*
                     * Position, not identity. Files carry no id and duplicates
                     * are reachable — dropping the same file twice makes two
                     * rows that are equal in every readable way — so a
                     * name/size key would claim a stability it does not have.
                     * Rows hold no state of their own, so reuse is free.
                     */
                    key={index}
                    file={file}
                    reason={errors.reasonAt(index)}
                    disabled={disabled}
                    removeLabel={messages.removeFile(file.name)}
                    rejectedText={messages.fileRejected}
                    onRemove={() => removeFile(index)}
                  />
                ))}
              </ul>
            )}
          </FieldWrapper>
        );
      }}
    />
  );
}

type FileRowProps = {
  file: File;
  /** Present exactly when this file is the reason the field is invalid. */
  reason: string | undefined;
  disabled: boolean;
  removeLabel: string;
  rejectedText: (reason: string) => string;
  onRemove: () => void;
};

function FileRow({ file, reason, disabled, removeLabel, rejectedText, onRemove }: FileRowProps) {
  return (
    <li
      data-slot="file-row"
      /*
       * Always present, both values spelled out, rather than a boolean
       * `data-rejected` that is absent when false: styling the accepted case
       * off an absence forces `:not([data-rejected])` on the consumer. This is
       * not the engine's `flag || undefined` convention (`data-dragging`,
       * `data-disabled`) because it is not a flag — it is one of two states,
       * and both are worth naming.
       */
      data-status={reason ? "rejected" : "accepted"}
      className="flex flex-col gap-[var(--fb-space-1,0.534vw)] tablet:gap-[var(--fb-space-1-tablet,0.25vw)] desktop:gap-[var(--fb-space-1-desktop,0.104vw)]"
    >
      <div className="flex items-center gap-[var(--fb-space-4,2.136vw)] tablet:gap-[var(--fb-space-4-tablet,1vw)] desktop:gap-[var(--fb-space-4-desktop,0.416vw)]">
        <span className="truncate">{file.name}</span>
        {/* Mono, like every other machine-generated value in this codebase. */}
        <span className="font-mono text-muted-foreground">{formatSize(file.size)}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled}
          className="ms-auto size-[var(--fb-space-12,6.408vw)] tablet:size-[var(--fb-space-12-tablet,3vw)] desktop:size-[var(--fb-space-12-desktop,1.248vw)]"
          aria-label={removeLabel}
          onClick={onRemove}
        >
          <X className="size-[var(--fb-space-6,3.204vw)] tablet:size-[var(--fb-space-6-tablet,1.5vw)] desktop:size-[var(--fb-space-6-desktop,0.624vw)]" />
        </Button>
      </div>
      {/*
       * The verdict is a sentence in the row, not a red border on it: read
       * aloud, the row is "scan.tiff, 1 KB, Rejected: scan.tiff isn't in a
       * format we accept (TIFF) — please upload PDF". The colour is the
       * duplicate channel here, not the only one.
       */}
      {reason && <span className="text-destructive">{rejectedText(reason)}</span>}
    </li>
  );
}
