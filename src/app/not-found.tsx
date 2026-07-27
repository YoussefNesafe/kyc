import Link from "next/link";
import { APPLICATION_ENTRY_PATH } from "@/config/routes";

/**
 * The 404.
 *
 * Written the moment `/apply/[step]` landed, because that route is the first
 * one in the project a visitor can miss by typing: five slugs are steps and
 * everything else is not, and `[step]/page.tsx` turns the rest into this. Next's
 * built-in 404 renders its own dark inline styles, which under a light theme and
 * a demo banner reads as a broken page rather than a missing one — and it offers
 * no way back, which on a five-step form is the only thing the visitor wants.
 */
export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="shell flex flex-1 flex-col items-start gap-6 py-20">
      <p className="font-mono text-note text-muted-foreground">404</p>
      <h1 className="text-h2">This page does not exist.</h1>
      <p className="max-w-[var(--measure)] text-detail text-muted-foreground text-pretty">
        The application has five steps and each one has its own address. If you
        typed or edited the URL, the step you named is not one of them.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link
          href={APPLICATION_ENTRY_PATH}
          className="inline-flex min-h-11 items-center rounded-md bg-primary px-5 text-ui font-medium text-primary-foreground transition-colors hover:bg-[var(--primary-hover)]"
        >
          Go to the first step
        </Link>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center rounded-md border border-border px-5 text-ui font-medium transition-colors hover:bg-card"
        >
          What is this demo?
        </Link>
      </div>
    </main>
  );
}
