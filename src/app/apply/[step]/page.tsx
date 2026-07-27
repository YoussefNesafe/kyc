import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { STEP_SLUGS, STEP_TITLES, stepIndexForSlug, type StepSlug } from "@/config/steps";

type StepParams = { params: Promise<{ step: string }> };

/**
 * The five step URLs, prerendered. Read from `STEP_SLUGS` rather than written
 * out, so the route table and the wizard cannot disagree about how many steps
 * there are — and so `router.prefetch` in the shell has something static to
 * warm.
 */
export function generateStaticParams(): Array<{ step: StepSlug }> {
  return STEP_SLUGS.map((step) => ({ step }));
}

/**
 * Nothing outside the five is a step. `false` means a slug that is not in
 * `generateStaticParams` is a 404 without ever rendering this component, which
 * is both cheaper and harder to get wrong than a runtime check alone — the
 * check below stays anyway, because it is what makes the rule true in
 * development and readable to the next person.
 */
export const dynamicParams = false;

export async function generateMetadata({ params }: StepParams): Promise<Metadata> {
  const { step } = await params;
  const title = STEP_TITLES[step as StepSlug];
  return title ? { title } : {};
}

/**
 * Deliberately renders nothing.
 *
 * This is not an oversight and not a stub. The form lives in `../layout.tsx`,
 * which Next keeps mounted across navigation between sibling `[step]` values —
 * that is what lets five URLs share one react-hook-form instance instead of
 * emptying it on every Next. A page that rendered the form instead would remount
 * it five times and lose the application on the first click.
 *
 * What this file is for: naming the route, prerendering the five valid slugs,
 * titling the tab, and turning an unknown slug into a real 404 rather than a
 * blank step. `stepIndexForSlug` returns `undefined` for anything that is not a
 * step, which is the 404 signal — no second list of valid slugs to keep in sync.
 */
export default async function ApplicationStepPage({ params }: StepParams) {
  const { step } = await params;
  if (stepIndexForSlug(step) === undefined) notFound();
  return null;
}
