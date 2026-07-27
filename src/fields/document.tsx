"use client";

/**
 * The demo's document upload: the engine's dropzone and its per-file verdicts,
 * with a simulated upload on top.
 *
 * ## Nothing here uploads anything
 *
 * There is no `fetch`, no `FormData`, no object URL, and no read of a file's
 * contents. A `File` is a handle to something on the visitor's disk and this
 * component never opens one — it holds the handle, shows the name and size the
 * handle already carries, and lets the schema judge it. The bar below is a
 * `setInterval` counting to 100 against a duration invented from the file's
 * size. It is labelled "Simulated upload" in the field itself, not only in this
 * comment, because a demo whose banner promises that no file is uploaded cannot
 * then put the word "Uploading" in one of its fields.
 *
 * Progress lives here rather than in `src/form-builder/` on the engine's own
 * advice: `FileField` documents uploading as the host's job, done from
 * `onSubmit`. Where the upload would live, its progress lives.
 *
 * ## Why this is registered for `file` rather than adding a `document` type
 *
 * The plan for this task called for a new `document` field type, and the engine
 * does support custom types — `validateFormConfig` accepts any `type` string
 * that is in the registry (`core/schema.ts:365`). What it will not do is
 * validate them: `buildFieldsSchema` hands every non-built-in field
 * `z.unknown().optional()` (`core/validation.ts:468`). That is a reasonable
 * engine default and a disastrous one for these particular fields. Moving
 * `identityDocument` onto a custom type would silently drop `required`,
 * `accept` and `maxSizeMB` together: the required photo ID would stop gating
 * Submit, and a TIFF would be accepted without a word.
 *
 * It would also remove this component's own foundation. Every per-file verdict
 * below is read out of react-hook-form's per-index errors, and those exist only
 * because the engine's schema raised one issue per index. Under a custom type
 * there would be nothing to read, and the only way back would be to judge the
 * files here — which is precisely what `fileMatchesAccept` is deliberately
 * unexported to prevent.
 *
 * So the registry is used for the other thing it is for, and the one the README
 * can actually recommend: the host puts its own component behind a type the
 * engine already knows how to validate. One line in `registerBuiltInFields.ts`
 * changes which component renders every `file` field in the config, and nothing
 * else in the demo moves.
 *
 * ## What it borrows from the engine, and why each one
 *
 * - `FileDropzone` — the drop surface and the real `<input type="file">` behind
 *   it, including the accessible-name assembly this field would otherwise have
 *   to re-derive.
 * - `FieldWrapper` / `fieldAriaDescribedBy` — the label, required mark, badge,
 *   description and `role="alert"` error region every other field in the form
 *   uses. Re-implementing them here would make this the one field that drifts.
 * - `acceptedFormatsLabel` — `accept` as prose. Never re-split `accept` at a
 *   call site; the label and the check have to come from the same reading of it.
 * - `useFieldDisabled` / `useFieldRuntime` — the gate-resolved disabled state,
 *   and the message bundle, so the shared copy here is the same string every
 *   other file field shows and stays overridable through `messages`. Only the
 *   two sentences about simulation are host copy, because they describe
 *   something the engine has no concept of.
 */

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { useFieldDisabled, useFieldRuntime } from "@/form-builder/components/FieldRuntime";
import { acceptedFormatsLabel } from "@/form-builder/core/fileAccept";
import type { FieldComponentProps } from "@/form-builder/core/registry";
import type { FieldConfig } from "@/form-builder/core/types";
import { BYTES_PER_KB, BYTES_PER_MB } from "@/form-builder/core/units";
import { FieldWrapper, fieldAriaDescribedBy } from "@/form-builder/ui/FieldWrapper";
import { FileDropzone } from "@/form-builder/ui/FileDropzone";

type DocumentFieldConfig = Extract<FieldConfig, { type: "file" }>;

const MIN_DISPLAYED_KB = 1;

/** How often the simulated upload repaints. Fast enough to read as motion. */
const TICK_MS = 90;
/** Even a one-byte file gets a visible upload; even a huge one ends. */
const MIN_DURATION_MS = 700;
const MAX_DURATION_MS = 2600;
/** The invented line rate the duration is drawn from: half a megabyte a second. */
const SIMULATED_BYTES_PER_SECOND = BYTES_PER_MB / 2;

const PERCENT_COMPLETE = 100;

function formatSize(bytes: number): string {
  if (bytes >= BYTES_PER_MB) return `${(bytes / BYTES_PER_MB).toFixed(1)} MB`;
  return `${Math.max(MIN_DISPLAYED_KB, Math.round(bytes / BYTES_PER_KB))} KB`;
}

/**
 * How long this file "takes". Derived from its size so that two files uploaded
 * together finish at different moments — a fixed duration makes every bar move
 * in lockstep, which reads as an animation rather than as progress.
 */
function simulatedDurationMs(file: File): number {
  const ms = (file.size / SIMULATED_BYTES_PER_SECOND) * 1000;
  return Math.min(MAX_DURATION_MS, Math.max(MIN_DURATION_MS, ms));
}

type FileErrorLike = { message?: string };

/**
 * Reading react-hook-form's error for a file field, which is two shapes.
 *
 * A multi-file field's issues are reported one per index, and RHF maps those
 * onto a *sparse array* whose own `message` is `undefined` — so `.message` on
 * it renders nothing at all. A single-file field reports at the field's own
 * path and is a plain `FieldError` whose one message is that one file's reason.
 *
 * This is the sanctioned route to a per-file verdict, and the only one: put the
 * file in the value, let the schema judge it, read the reason back by index.
 * There is no matcher to call — `fileMatchesAccept` is not exported, and size
 * and type are two rules, so a component checking one of them itself would
 * disagree with the schema about half the rejections.
 */
function isPerFileErrors(error: unknown): error is ArrayLike<FileErrorLike | undefined> {
  return Array.isArray(error);
}

function messageOf(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("message" in error)) return undefined;
  const { message } = error;
  return typeof message === "string" && message !== "" ? message : undefined;
}

type FileErrors = {
  reasonAt: (index: number) => string | undefined;
  fieldError: { message: string } | undefined;
};

const NO_FILE_ERRORS: FileErrors = { reasonAt: () => undefined, fieldError: undefined };

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
  let first: string | undefined;
  for (let index = 0; index < error.length && first === undefined; index += 1) {
    first = reasonAt(index);
  }
  return { reasonAt, fieldError: first ? { message: first } : undefined };
}

/**
 * The single-vs-multiple difference, stated once, so the rest of the component
 * only ever sees a `File[]`.
 *
 * `add` returns what it could not take. A drop carries whatever the pointer was
 * holding regardless of the `multiple` attribute, so a single-file field has to
 * decide what to say about the files it has no room for rather than letting
 * them vanish.
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
    add: (incoming: File[]): { next: File | File[] | undefined; kept: File[]; notTaken: File[] } =>
      multiple
        ? { next: [...files, ...incoming], kept: incoming, notTaken: [] }
        : { next: incoming[0], kept: incoming.slice(0, 1), notTaken: incoming.slice(1) },
    remove: (index: number): File | File[] | undefined =>
      multiple ? files.filter((_, i) => i !== index) : undefined,
  };
}

export function DocumentField({ field }: FieldComponentProps) {
  const config = field as DocumentFieldConfig;
  const { control, trigger, getFieldState } = useFormContext();
  const disabled = useFieldDisabled(config);
  const { messages } = useFieldRuntime();
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  // Not derivable from the value: it records what did *not* become part of it.
  const [notTaken, setNotTaken] = useState<string | undefined>(undefined);

  /**
   * Percent complete per file, keyed by `File` identity rather than by name or
   * index. Names collide — dropping the same file twice is reachable — and an
   * index shifts under a removal, which would hand a half-finished bar to the
   * wrong row. The handle is the only stable identity a `File` has.
   *
   * A file with no entry is complete, not stalled: that is what a row looks
   * like after the step has been navigated away from and back, since this
   * component remounts while the value in the form does not. Every file that is
   * genuinely still going has an entry, written before its first paint.
   */
  const [progress, setProgress] = useState<ReadonlyMap<File, number>>(() => new Map());
  const timers = useRef(new Map<File, ReturnType<typeof setInterval>>());

  const stopUpload = useCallback((file: File) => {
    const timer = timers.current.get(file);
    if (timer !== undefined) clearInterval(timer);
    timers.current.delete(file);
  }, []);

  // Timers outlive a render but must not outlive the mount: navigating to the
  // review step unmounts this field mid-upload, and an interval still calling
  // `setProgress` after that is a leak with a warning attached.
  useEffect(() => {
    const running = timers.current;
    return () => {
      for (const timer of running.values()) clearInterval(timer);
      running.clear();
    };
  }, []);

  const startUpload = useCallback(
    (file: File) => {
      const duration = simulatedDurationMs(file);
      const startedAt = Date.now();
      // Driven by elapsed time rather than by counting ticks, so a backgrounded
      // tab — where timers are throttled to once a second — resumes at the
      // percentage the clock says instead of crawling from where it was frozen.
      const timer = setInterval(() => {
        const ratio = Math.min(1, (Date.now() - startedAt) / duration);
        setProgress((previous) => new Map(previous).set(file, Math.round(ratio * PERCENT_COMPLETE)));
        if (ratio >= 1) stopUpload(file);
      }, TICK_MS);
      timers.current.set(file, timer);
    },
    [stopUpload],
  );

  const forgetUpload = useCallback(
    (file: File) => {
      stopUpload(file);
      setProgress((previous) => {
        if (!previous.has(file)) return previous;
        const next = new Map(previous);
        next.delete(file);
        return next;
      });
    },
    [stopUpload],
  );

  const hint = messages.fileHint(acceptedFormatsLabel(config.accept), config.maxSizeMB);

  return (
    <Controller
      name={config.name}
      control={control}
      render={({ field: rhf, fieldState }) => {
        const value = fileValue(rhf.value, config.multiple);
        const { files } = value;
        const errors = readFileErrors(fieldState.error, config.multiple);
        const anyUploading = files.some((file) => (progress.get(file) ?? PERCENT_COMPLETE) < PERCENT_COMPLETE);

        const setInputRef = (node: HTMLInputElement | null) => {
          inputRef.current = node;
          rhf.ref(node);
        };

        /**
         * Rejected files are kept, not refused at the door.
         *
         * Everything the visitor picked enters the value, including the TIFF.
         * The schema only has something to say about files that are *in* the
         * value, so turning one away here would leave an empty-looking field
         * and silence exactly where the reason belongs.
         *
         * The order below is the whole point of the field: put the files in,
         * mark them pending so nothing paints as finished before it started,
         * let the schema judge them, and only then start a simulated upload for
         * the ones that survived. A rejected file never shows an upload,
         * because refusing to upload it is the correct behaviour and not a
         * cosmetic detail.
         */
        const acceptFiles = async (incoming: File[]) => {
          const { next, kept, notTaken: refused } = value.add(incoming);
          rhf.onChange(next);
          setNotTaken(
            refused.length && next instanceof File ? messages.oneFileOnly(next.name) : undefined,
          );
          setProgress((previous) => {
            const pending = new Map(previous);
            for (const file of kept) pending.set(file, 0);
            return pending;
          });

          // Eager, overriding the form's `mode` for this one field, and the same
          // call the engine's own file field makes: a file's verdict depends on
          // nothing the visitor could still be in the middle of typing, so
          // waiting for a blur that may never come would leave a rejected row
          // sitting there unexplained.
          await trigger(config.name);

          // Read back through the same per-index channel the rows render from,
          // rather than re-deciding here. `getFieldState` with no second
          // argument reads react-hook-form's live internal state, which is what
          // the trigger just wrote — the `fieldState` in this closure is a
          // render-time snapshot from before it.
          const judged = readFileErrors(getFieldState(config.name).error, config.multiple);
          const after = next instanceof File ? [next] : (next ?? []);
          after.forEach((file, index) => {
            if (!kept.includes(file)) return;
            if (judged.reasonAt(index)) forgetUpload(file);
            else startUpload(file);
          });
        };

        const removeFile = (index: number) => {
          const removed = files[index];
          rhf.onChange(value.remove(index));
          setNotTaken(undefined);
          if (removed) forgetUpload(removed);
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
              onFiles={(incoming) => void acceptFiles(incoming)}
              onBlur={rhf.onBlur}
            />
            {/*
              Rendered whether or not there are files, because a live region has
              to be in the document *before* its content changes for the change
              to be announced.

              The percentages deliberately do not come through here. A bar that
              announced itself nine times a second would bury the one sentence
              in this region that matters — the reason a file was rejected.
            */}
            <div role="status" className="flex flex-col gap-1 text-note text-muted-foreground">
              {files.length > 0 && <span>{messages.filesSelected(files.length)}</span>}
              {notTaken && <span>{notTaken}</span>}
            </div>
            {files.length > 0 && (
              <ul className="flex flex-col gap-3 text-note">
                {files.map((file, index) => (
                  <DocumentRow
                    /*
                     * Position, not identity: files carry no id and duplicates
                     * are reachable, so a name/size key would claim a stability
                     * it does not have. The rows hold no state of their own —
                     * progress is keyed by the `File` itself, one level up — so
                     * reuse is free.
                     */
                    key={index}
                    file={file}
                    reason={errors.reasonAt(index)}
                    percent={progress.get(file) ?? PERCENT_COMPLETE}
                    disabled={disabled}
                    removeLabel={messages.removeFile(file.name)}
                    rejectedText={messages.fileRejected}
                    onRemove={() => removeFile(index)}
                  />
                ))}
              </ul>
            )}
            {/*
              Host copy, and the only line in this field that is. It appears
              exactly while a bar is moving, which is the one moment a visitor
              could reasonably conclude that something is being sent.
            */}
            {anyUploading && (
              <p className="text-note text-muted-foreground">
                Simulated — nothing is being uploaded and no file leaves this tab.
              </p>
            )}
          </FieldWrapper>
        );
      }}
    />
  );
}

type DocumentRowProps = {
  file: File;
  /** Present exactly when this file is the reason the field is invalid. */
  reason: string | undefined;
  /** 0–100. Anything below 100 means a simulated upload is still running. */
  percent: number;
  disabled: boolean;
  removeLabel: string;
  rejectedText: (reason: string) => string;
  onRemove: () => void;
};

function DocumentRow({
  file,
  reason,
  percent,
  disabled,
  removeLabel,
  rejectedText,
  onRemove,
}: DocumentRowProps) {
  const uploading = !reason && percent < PERCENT_COMPLETE;

  return (
    <li
      data-slot="document-row"
      /*
       * Both values spelled out rather than a boolean attribute that is absent
       * when false: styling the accepted case off an absence would force
       * `:not([data-status])` on anyone restyling this.
       */
      data-status={reason ? "rejected" : uploading ? "uploading" : "attached"}
      className="flex flex-col gap-1"
    >
      <div className="flex items-center gap-4">
        <span className="truncate">{file.name}</span>
        {/* Mono, like every other machine-generated value in this codebase. */}
        <span className="font-mono text-muted-foreground">{formatSize(file.size)}</span>
        <button
          type="button"
          disabled={disabled}
          aria-label={removeLabel}
          onClick={onRemove}
          className="ms-auto min-h-11 shrink-0 rounded-sm px-2 text-note font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)] disabled:opacity-50"
        >
          Remove
        </button>
      </div>

      {reason && <span className="text-destructive">{rejectedText(reason)}</span>}

      {uploading && (
        <div className="flex items-center gap-3">
          {/*
            A real `progressbar` rather than a decorated `div`: it carries the
            value, so a screen-reader user can query the progress instead of
            being told about it nine times a second by a live region. Named
            after the file, since a step may hold three of these at once.

            `aria-hidden` is wrong here and a bare bar with no name is worse;
            this is the one case where the ARIA is the accessible thing.
          */}
          <div
            role="progressbar"
            aria-label={`Simulated upload of ${file.name}`}
            aria-valuemin={0}
            aria-valuemax={PERCENT_COMPLETE}
            aria-valuenow={percent}
            className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted"
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-100 ease-linear"
              style={{ width: `${percent}%` }}
            />
          </div>
          <span className="w-12 shrink-0 text-end font-mono text-muted-foreground tabular-nums">
            {percent}%
          </span>
        </div>
      )}

      {!reason && !uploading && <span className="text-muted-foreground">Attached</span>}
    </li>
  );
}
