/** Vertical rhythm between the major blocks of a stepper layout — the step
 *  list, the field grid, the Back/Next row. Kept here rather than inline
 *  because the same three-breakpoint token triple is needed on both sides of
 *  the rail/panel split, and the two must not drift apart. */
export const STACK_GAP_CLASS =
  "gap-[var(--fb-space-12,6.408vw)] tablet:gap-[var(--fb-space-12-tablet,3vw)] desktop:gap-[var(--fb-space-12-desktop,1.248vw)]";

export const FLAT_GRID_CLASS =
  "grid grid-cols-12 gap-[var(--fb-space-8,4.272vw)] tablet:gap-[var(--fb-space-8-tablet,2vw)] desktop:gap-[var(--fb-space-8-desktop,0.832vw)] [&_*]:shadow-none [&_*]:[--tw-ring-shadow:0_0_#0000]!";
