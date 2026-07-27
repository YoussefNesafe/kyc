/**
 * The five steps, in order, and the slug ↔ index mapping the `/apply/[step]`
 * router needs.
 *
 * The count is fixed on purpose and nothing may change it at runtime. The
 * engine's `FormStepper` creates its stepper store once per mount with
 * `steps.length` and clamps every move against that initial bound, so a config
 * that grew or shrank a step would keep the old ceiling. Branching is done with
 * field-level `visibleWhen` inside these five, never by adding or removing an
 * entry — which also keeps the route table static and `generateStaticParams`
 * honest.
 */
export const STEP_SLUGS = [
  "account-type",
  "personal-details",
  "tax-residency",
  "documents",
  "review",
] as const;

export type StepSlug = (typeof STEP_SLUGS)[number];

export const STEP_TITLES: Record<StepSlug, string> = {
  "account-type": "Account type",
  "personal-details": "Your details",
  "tax-residency": "Tax residency",
  documents: "Documents",
  review: "Review and submit",
};

/** The index a slug addresses, or `undefined` for a slug that is not a step. */
export function stepIndexForSlug(slug: string): number | undefined {
  const index = (STEP_SLUGS as readonly string[]).indexOf(slug);
  return index === -1 ? undefined : index;
}

/** The slug for an index, or `undefined` when the index is off the end. */
export function slugForStepIndex(index: number): StepSlug | undefined {
  return STEP_SLUGS[index];
}
