/**
 * The persistent demo-safety notice.
 *
 * ## Why it looks like this
 *
 * Every regulated broker in Europe carries a risk warning pinned above its
 * page — full width, small type, never dismissible, in the same place on every
 * screen. Borrowing that form is the point: a visitor who has opened a real
 * brokerage account recognises the shape before reading a word, and what the
 * strip actually discloses here is that none of this is real.
 *
 * ## Why there is no close button
 *
 * This form asks for a date of birth, a taxpayer number and a photograph of a
 * passport, and it is convincing enough that somebody will start filling it in
 * for real. A dismissible notice is a notice that is gone by the time it
 * matters — by step 3, on the upload screen, with a passport in hand. So there
 * is no control here at all, and the strip renders from the root layout so it
 * survives every route including the success screen. If a future change adds a
 * dismiss affordance, it removes the only thing standing between a stranger
 * and a real passport number on a public URL.
 *
 * ## What it says, and what it does not
 *
 * Three facts, plainly: nothing is transmitted, nothing is uploaded, nothing is
 * stored on a server. That division is deliberate — the intro copy on the first
 * step of the form (`config/fields/shared.ts`) does not repeat any of them. It
 * answers the question this strip leaves open: if the answers do not go to a
 * server, where do they go? Global claim here, local mechanism there.
 */
export function DemoBanner() {
  return (
    <aside
      aria-label="Demonstration notice"
      // z-40, below the z-50 the overlay primitives use: an open dropdown
      // should sit over the notice, not under it.
      className="sticky top-0 z-40 border-b border-white/10 bg-[var(--notice-surface)] text-[var(--notice-foreground)]"
    >
      <p className="shell flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2 text-note">
        <span className="rounded-sm border border-current/40 px-1.5 py-0.5 text-eyebrow font-semibold uppercase tracking-eyebrow text-[var(--notice-tag)]">
          Demo
        </span>
        <span className="min-w-0 flex-1 text-pretty">
          Meridian Markets is a fictional brokerage and this account application
          is a portfolio demonstration.{" "}
          <strong className="font-medium text-[var(--notice-emphasis)]">
            Nothing you type is sent anywhere, no file you choose is uploaded,
            and nothing is stored on a server.
          </strong>{" "}
          Please don&rsquo;t enter real personal details.
        </span>
      </p>
    </aside>
  );
}
