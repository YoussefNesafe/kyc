"use client";

/**
 * The two things the shell has to tell a visitor about their own progress.
 *
 * ## Why they are `role="status"` and not toasts
 *
 * Both appear as a consequence of something the visitor did not do — a draft
 * came back, or a URL they asked for was not available yet. A toast that fades
 * after four seconds is exactly the wrong shape for that: it is read by nobody
 * who scans a page slowly, it is gone before a screen-reader user has finished
 * the step announcement queued ahead of it, and a timed disappearance is a
 * WCAG 2.2.1 problem for no benefit. So these sit inline, above the form, and
 * announce politely once. Nothing here is on a timer: each retires on an action
 * by the visitor — dismissing it, or moving off the step it is about — which the
 * shell decides, since only the shell knows which step that was. Dismissal is a
 * real button, not a hover-revealed cross.
 *
 * ## Why they are not `role="alert"`
 *
 * Nothing failed. `alert` is assertive and interrupts whatever is being read;
 * "we put your answers back" is not worth interrupting for. `status` queues.
 */

function NoticePanel({
  children,
  onDismiss,
}: {
  children: React.ReactNode;
  onDismiss: () => void;
}) {
  return (
    <div
      role="status"
      className="flex items-start gap-4 rounded-md border border-border bg-card px-4 py-3"
    >
      <p className="min-w-0 flex-1 text-detail text-pretty">{children}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="-me-1 min-h-11 shrink-0 rounded-sm px-2 text-detail font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
      >
        Dismiss
      </button>
    </div>
  );
}

/**
 * Raised by `onDraftRestore`. `filesCleared` is not a guess about what the
 * visitor had attached — the draft never holds a file at all, by design — it is
 * simply true whenever they had got as far as the step that asks for them, and
 * saying so up front is kinder than letting them find an empty dropzone.
 */
export function ResumedNotice({
  filesCleared,
  onDismiss,
}: {
  filesCleared: boolean;
  onDismiss: () => void;
}) {
  return (
    <NoticePanel onDismiss={onDismiss}>
      <span className="font-medium">Your answers are back.</span> This tab still
      had a part-finished application in it, so it has been restored.
      {filesCleared
        ? " Files are never kept, so any documents you had chosen need choosing again."
        : ""}
    </NoticePanel>
  );
}

/**
 * Raised by the progress guard when a URL named a step further on than the
 * answers so far allow. It names both ends of the correction: without the
 * "you are now on…" half, a visitor who typed `/apply/review` and landed on
 * `/apply/account-type` has no way to tell a guard from a bug.
 */
export function ProgressNotice({
  requestedTitle,
  landedTitle,
  onDismiss,
}: {
  requestedTitle: string;
  landedTitle: string;
  onDismiss: () => void;
}) {
  return (
    <NoticePanel onDismiss={onDismiss}>
      <span className="font-medium">“{requestedTitle}” is not open yet.</span>{" "}
      Each step unlocks as the one before it is answered, so you have been taken
      to “{landedTitle}”.
    </NoticePanel>
  );
}
