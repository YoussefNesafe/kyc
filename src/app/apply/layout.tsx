import { ApplicationShell } from "@/components/ApplicationShell";

/**
 * Everything under `/apply/…`.
 *
 * The form is mounted HERE, above the `[step]` segment, because Next 16
 * promises that a layout survives navigation between its children: *"On
 * navigation, layouts preserve state, remain interactive, and do not rerender"*
 * (`node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md:43`).
 * That promise is the whole reason one route per step is affordable — the
 * react-hook-form instance, its validation state and the visitor's answers all
 * outlive the URL change.
 *
 * Do not add a `template.tsx` beside this file. A template is the same idea
 * with the opposite guarantee: it remounts on every navigation, which here
 * means every Next button silently empties the form.
 */
export default function ApplyLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex-1">
      <ApplicationShell />
      {/*
        The page renders `null` — see `[step]/page.tsx`. It is still rendered
        rather than dropped, because it is what raises the 404 for a slug that
        is not a step.
      */}
      {children}
    </main>
  );
}
