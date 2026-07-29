import type { Metadata } from "next";
import { StartApplicationLink } from "@/components/StartApplicationLink";
import { JURISDICTIONS } from "@/config/jurisdictions";
import { APPLICATION_ROUTE_IS_LIVE } from "@/config/routes";
import { absoluteUrl, landingStructuredData, SITE_DESCRIPTION } from "@/config/seo";
import { STEP_SLUGS, STEP_TITLES } from "@/config/steps";

/**
 * No `title` here on purpose. `LANDING_TITLE` is already a whole sentence and it
 * is the root layout's `title.default`; setting it again in this segment would
 * push it through `TITLE_TEMPLATE` and produce the attribution twice.
 */
export const metadata: Metadata = {
  description: SITE_DESCRIPTION,
  alternates: { canonical: absoluteUrl("/") },
};

/**
 * The landing page.
 *
 * ## Why this is a page and not a redirect to `/apply/account-type`
 *
 * The obvious move for a demo is to send `/` straight into step one, and it is
 * the wrong one here. This URL is linked from an Upwork profile and pasted into
 * proposals, so the person opening it is deciding whether to hire someone — not
 * opening a brokerage account. Dropped into step one they get a form asking for
 * an account type, with no idea what they are looking at, how far it goes, or
 * what is worth noticing. The interesting parts of this project (requirements
 * held as data, a guarded engine boundary, accessibility and demo-safety
 * treated as constraints) are all invisible from inside a single step, and a
 * client who bounces at step one never sees any of them.
 *
 * So: a page that answers "what is this and why should I care" in about five
 * seconds, and then hands over a way in. It also gives every later screen
 * somewhere to come back to, which a redirect cannot.
 *
 * ## Why the content is read from the config
 *
 * The step list and the jurisdiction list below are the same objects the form
 * is built from — not a copy written out in JSX. A landing page that describes
 * five steps while the form renders four is a worse advertisement than no
 * landing page, and this is the cheapest way to make that impossible. It also
 * quietly demonstrates the claim it is making: adding a country really is one
 * file and one line, and this page updates itself when someone does it.
 */

const HIGHLIGHTS = [
  {
    title: "Requirements held as data",
    body: "A jurisdiction is one file and one line in a registry. The builder stamps the visibility guard and the “Required in Germany” badge onto every field it contributes, so no component knows a country exists — and adding one changes no component code.",
  },
  {
    title: "A vendored engine, with the boundary enforced",
    body: "The form engine is a standalone, config-driven package vendored into this repo. It must stay liftable, so a check in the lint step fails the build if engine code names this brand or imports anything from the demo.",
  },
  {
    title: "Accessibility as a requirement, not a pass at the end",
    body: "Labels, descriptions and errors are wired to their controls, focus is handled on every step change, and the palette is held to WCAG contrast by tests that fail if a token drifts — including the 3:1 non-text bar for control borders.",
  },
  {
    title: "Demo safety as a design constraint",
    body: "It looks real enough that somebody would type a real passport number into it, so nothing leaves the browser, the draft lives in sessionStorage rather than localStorage, files are never persisted, and the notice above cannot be dismissed.",
  },
];

const STACK = [
  "Next.js 16 (App Router)",
  "React 19",
  "TypeScript",
  "Tailwind CSS v4",
  "react-hook-form + Zod",
  "Vitest",
];

/**
 * A jurisdiction's `label` is written to sit inside a sentence — the form
 * renders "Required in the United States" — so it arrives lower-cased where the
 * article leads. Sentence-casing it here is a presentation concern of this list
 * and belongs here, not in the config, where changing it would reword a badge.
 */
function asListEntry(label: string): string {
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export default function Home() {
  return (
    <main className="flex-1 pb-20">
      {/*
       * Structured data, on this page only.
       *
       * It says: source code, written by a person, free to look at. That is the
       * one unambiguous signal available to a crawler that has just been handed
       * five screens of a brokerage application — see the note at the top of
       * `@/config/seo` for why it is typed this way and not as an organisation.
       *
       * `JSON.stringify` of an object this module built, never of anything a
       * visitor typed, so there is no injection surface here today. The `<`
       * escape is belt-and-braces against the day someone feeds this a string
       * from elsewhere: a literal `</script>` inside a JSON string would end the
       * block early, and `<` is still valid JSON that parsers read back
       * identically.
       */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(landingStructuredData()).replace(/</g, "\\u003c"),
        }}
      />

      {/* --- Hero ---------------------------------------------------------- */}
      <section className="shell pt-12 tablet:pt-16 desktop:pt-24">
        <p className="text-eyebrow font-semibold uppercase tracking-eyebrow text-muted-foreground">
          Portfolio demonstration
        </p>

        <h1 className="mt-4 max-w-[18ch] text-h2 tablet:text-h1">
          Account opening, from the first question to the last upload.
        </h1>

        <p className="mt-6 max-w-[var(--measure)] text-lede text-muted-foreground text-pretty">
          Meridian Markets is a fictional broker. The application behind it is
          not: it is a working, jurisdiction-aware KYC flow that changes the
          questions it asks — and the documents it demands — the moment you say
          where you are tax resident.
        </p>

        <div className="mt-9">
          {APPLICATION_ROUTE_IS_LIVE ? (
            /*
             * Not a plain `<Link>`: in the hero it is in the viewport at load,
             * and Next would prefetch the entire form engine before the visitor
             * has decided to open it — 291 KiB, measured as 100% unused on this
             * page. See the component for what replaces it.
             */
            <StartApplicationLink className="inline-flex min-h-11 items-center rounded-md bg-primary px-5 text-ui font-medium text-primary-foreground transition-colors hover:bg-[var(--primary-hover)]">
              Start the application
            </StartApplicationLink>
          ) : (
            /*
             * No dead button. The shell that serves `/apply/…` is the next
             * thing to land, and a primary call to action that 404s is worse
             * on this page than on any other — it is the only thing most
             * visitors will click.
             */
            <p className="max-w-[var(--measure)] rounded-md border border-border bg-card px-4 py-3 text-detail text-muted-foreground">
              <span className="font-medium text-foreground">
                The application flow is being wired up.
              </span>{" "}
              This page is live first, so the interface every step inherits can
              be reviewed in place. The five steps below are read from the
              configuration the form is built from.
            </p>
          )}
        </div>
      </section>

      {/* --- What to look at ------------------------------------------------ */}
      <section className="shell mt-16 tablet:mt-20" aria-labelledby="what-to-look-at">
        <h2
          id="what-to-look-at"
          className="text-eyebrow font-semibold uppercase tracking-eyebrow text-muted-foreground"
        >
          What this is meant to show
        </h2>

        <div className="mt-6 grid gap-px overflow-hidden rounded-md border border-border bg-border tablet:grid-cols-2">
          {HIGHLIGHTS.map((highlight) => (
            <article key={highlight.title} className="bg-card p-5 desktop:p-6">
              <h3 className="text-lede font-semibold">{highlight.title}</h3>
              <p className="mt-2 text-detail text-muted-foreground text-pretty">
                {highlight.body}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* --- The flow itself ------------------------------------------------ */}
      <div className="shell mt-16 grid gap-12 tablet:mt-20 desktop:grid-cols-[3fr_2fr] desktop:gap-16">
        <section aria-labelledby="the-steps">
          <h2
            id="the-steps"
            className="text-eyebrow font-semibold uppercase tracking-eyebrow text-muted-foreground"
          >
            The five steps
          </h2>

          <ol className="mt-5 border-t border-border">
            {STEP_SLUGS.map((slug, index) => (
              <li
                key={slug}
                className="flex items-baseline gap-4 border-b border-border py-3"
              >
                <span className="font-mono text-note text-muted-foreground tabular-nums">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="text-ui font-medium">{STEP_TITLES[slug]}</span>
                <span className="ms-auto font-mono text-note text-muted-foreground">
                  /{slug}
                </span>
              </li>
            ))}
          </ol>

          <p className="mt-4 max-w-[var(--measure)] text-note text-muted-foreground text-pretty">
            The count is fixed. Branching is done with per-field visibility
            rules inside these five, never by adding or removing a step, which
            keeps the route table static and the progress indicator honest.
          </p>
        </section>

        <section aria-labelledby="jurisdictions">
          <h2
            id="jurisdictions"
            className="text-eyebrow font-semibold uppercase tracking-eyebrow text-muted-foreground"
          >
            Jurisdictions configured
          </h2>

          <ul className="mt-5 border-t border-border">
            {JURISDICTIONS.map((jurisdiction) => (
              <li
                key={jurisdiction.code}
                className="flex items-baseline gap-4 border-b border-border py-3"
              >
                <span className="font-mono text-note text-muted-foreground">
                  {jurisdiction.code}
                </span>
                <span className="text-ui font-medium">
                  {asListEntry(jurisdiction.label)}
                </span>
              </li>
            ))}
            <li className="flex items-baseline gap-4 border-b border-border py-3">
              <span className="font-mono text-note text-muted-foreground">··</span>
              <span className="text-ui text-muted-foreground">
                Everywhere else falls back to a generic set, and is told so.
              </span>
            </li>
          </ul>
        </section>
      </div>

      {/* --- Colophon ------------------------------------------------------- */}
      <section className="shell mt-16 tablet:mt-20" aria-labelledby="built-with">
        <h2
          id="built-with"
          className="text-eyebrow font-semibold uppercase tracking-eyebrow text-muted-foreground"
        >
          Built with
        </h2>

        <ul className="mt-4 flex flex-wrap gap-2">
          {STACK.map((item) => (
            <li
              key={item}
              className="rounded-sm border border-border bg-card px-2.5 py-1 text-note"
            >
              {item}
            </li>
          ))}
        </ul>

        <p className="mt-8 max-w-[var(--measure)] border-t border-border pt-6 text-note text-muted-foreground text-pretty">
          Meridian Markets does not exist and this application cannot open one.
          Built as a public work sample by a freelance frontend engineer working
          on regulated-fintech interfaces. No analytics, no third-party
          requests, no backend — the fonts are self-hosted and nothing on this
          page phones home.
        </p>
      </section>
    </main>
  );
}
