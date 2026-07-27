import { mergeMessages } from "@/form-builder/core/messages";
import type { FormConfig, FormValues } from "@/form-builder/core/types";
import { buildResolverSchema } from "@/form-builder/core/validation";

/**
 * How far into the wizard a given set of answers entitles someone to be.
 *
 * ## Why the router needs this at all
 *
 * Every step is a URL, which means every step is a thing a visitor can type,
 * bookmark, or arrive at from a browser Back after the tab was restored. The
 * wizard's own gate — `form.trigger` on the current step before Next moves —
 * only guards the Next button. It cannot guard `/apply/review` typed into the
 * address bar, and without a guard that URL renders a review of an empty
 * application over a Submit button that fails on fields the visitor has never
 * been shown.
 *
 * ## The rule
 *
 * The furthest available step is the FIRST step that does not yet validate.
 * Being *on* your first incomplete step is the normal state of affairs — that
 * is where the form is asking you for something — so the guard rejects only
 * indices strictly beyond it. All steps clean means the last step, the review.
 *
 * ## Why it is one parse, not one per step
 *
 * `buildResolverSchema` is the same schema the engine's own resolver builds,
 * over the same `visibleFieldsFor` set, so a field hidden by `visibleWhen`
 * cannot hold a step back — the German Steuer-ID does not block a French
 * applicant. Parsing once and bucketing the issues by step keeps this guard and
 * the Next button answering to one definition of "complete"; a second,
 * hand-rolled notion of completeness here would eventually disagree with the
 * engine, and the failure mode is a visitor bounced off a step the wizard was
 * perfectly happy to let them onto.
 *
 * Steps are matched by `fieldNames`, so the review step — which declares none —
 * is never itself the blocker; reaching it requires the four steps before it.
 */
export function furthestAvailableStep(config: FormConfig, values: FormValues): number {
  const steps = config.steps ?? [];
  if (steps.length === 0) return 0;
  const last = steps.length - 1;

  const result = buildResolverSchema(config, mergeMessages(), undefined, values).safeParse(values);
  if (result.success) return last;

  // `path[0]` rather than the whole path: an issue inside a group row arrives as
  // `["beneficialOwners", 0, "ownerName"]`, and it is the root name that a step
  // lists.
  const failed = new Set(result.error.issues.map((issue) => String(issue.path[0] ?? "")));
  const firstIncomplete = steps.findIndex((step) =>
    (step.fieldNames ?? []).some((name) => failed.has(name)),
  );

  return firstIncomplete === -1 ? last : firstIncomplete;
}
