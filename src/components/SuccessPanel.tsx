"use client";

/**
 * The last screen, and the one the whole demo is arguing towards.
 *
 * Everything before this can be read as a competent multi-step form. This is
 * where the claim underneath it is either made plainly or fudged: a KYC
 * application asked for a date of birth, a tax number and a photo ID, and none
 * of it went anywhere. So the panel says that in the fewest words that can
 * carry it, and says it about the reference too — the one thing on screen that
 * *looks* like it came back from a server.
 *
 * ## Why there is a reference at all
 *
 * Because a submitted application with no reference reads as a form that did
 * nothing, and the demo would rather look like the real thing and then explain
 * itself than look like a prototype. It is mono, like every other
 * machine-generated value in this codebase, and the sentence under it removes
 * any doubt about where it came from.
 */

/**
 * Crockford's base32 alphabet: no I, L, O or U, so a reference can be read down
 * a phone without a spelling alphabet and cannot accidentally spell anything.
 * Exactly 32 symbols, which is also what makes the `% length` below uniform —
 * 256 divides by 32, so no symbol is favoured. Shorten it and that stops being
 * true.
 */
const REFERENCE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const REFERENCE_BLOCK = 4;

/**
 * A new application reference.
 *
 * Called once, from the submit handler, and held in state from there — not
 * derived during render, which would mint a different reference on every
 * repaint, and not derived from the answers, which would make it a hash of
 * personal data.
 *
 * `crypto.getRandomValues` rather than `Math.random` for no cryptographic
 * reason whatsoever: this identifies nothing and protects nothing. It is here
 * because it is the same one line and it never has to be revisited by someone
 * wondering whether it should have been.
 */
export function newApplicationReference(): string {
  const bytes = new Uint8Array(REFERENCE_BLOCK * 2);
  crypto.getRandomValues(bytes);
  const symbols = [...bytes].map((byte) => REFERENCE_ALPHABET[byte % REFERENCE_ALPHABET.length]);
  return `MM-${symbols.slice(0, REFERENCE_BLOCK).join("")}-${symbols.slice(REFERENCE_BLOCK).join("")}`;
}

export function SuccessPanel({
  reference,
  onRestart,
}: {
  reference: string;
  onRestart: () => void;
}) {
  return (
    /*
     * `role="status"`, not `role="alert"`: this replaces the form in the same
     * commit, so a screen-reader user has just had the page change under them
     * and there is nothing to interrupt. Polite queues behind the focus move
     * the submit itself caused.
     */
    <div
      role="status"
      className="flex flex-col items-start gap-6 rounded-md border border-border bg-card p-6 tablet:p-8"
    >
      <div className="flex flex-col gap-3">
        <h2 className="text-h3">Application submitted</h2>
        <p className="max-w-[var(--measure)] text-detail text-muted-foreground text-pretty">
          Every answer was validated against the same schema the configuration
          describes — the one a server would use — and then the application
          ended here, in this tab.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-note font-medium text-muted-foreground uppercase tracking-[0.08em]">
          Your reference
        </p>
        {/*
          The reference is selectable text rather than an image or a
          `user-select: none` flourish, because the first thing anyone does
          with a reference is copy it.
        */}
        <p className="font-mono text-h3 tabular-nums">{reference}</p>
      </div>

      <div className="flex flex-col gap-3 border-t border-border pt-5">
        <p className="max-w-[var(--measure)] text-detail text-pretty">
          <strong className="font-medium">No data was transmitted.</strong> Nothing
          you typed left this browser, no document you attached was uploaded or
          read, and there is no server, database or log with any of it in.
        </p>
        <p className="max-w-[var(--measure)] text-detail text-muted-foreground text-pretty">
          The reference above was generated in this tab a moment ago and is
          recorded nowhere — close the page and it is gone, along with the draft
          the tab was holding, which has already been cleared.
        </p>
      </div>

      <button
        type="button"
        onClick={onRestart}
        className="min-h-11 rounded-md bg-primary px-5 text-ui font-medium text-primary-foreground transition-colors hover:bg-[var(--primary-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
      >
        Start another application
      </button>
    </div>
  );
}
