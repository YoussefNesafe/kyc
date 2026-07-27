import { STEP_SLUGS } from "./steps";

/**
 * The application's URLs, derived from the step list rather than written out,
 * so the landing page and the router cannot disagree about where step one is.
 */

/** The path for a step slug. `/apply/[step]` is the shell's route. */
export function stepPath(slug: string): string {
  return `/apply/${slug}`;
}

/** Where "start the application" goes. */
export const APPLICATION_ENTRY_PATH = stepPath(STEP_SLUGS[0]);

/**
 * Whether `/apply/…` resolves yet.
 *
 * The application shell is the next task; until its route exists, a link to
 * `APPLICATION_ENTRY_PATH` is a 404 on the one page a visitor is most likely to
 * click. The landing page reads this and renders a short note instead of a dead
 * button — so the site is honest at every commit rather than briefly broken at
 * one of them.
 *
 * This is a lie-detector, not a feature flag: there is nothing to toggle and no
 * reason to ship it `false` once the route is there. `routes.test.ts` fails the
 * moment `src/app/apply/` exists and this still says `false`, so the commit that
 * adds the shell cannot forget to flip it.
 */
export const APPLICATION_ROUTE_IS_LIVE: boolean = false;
