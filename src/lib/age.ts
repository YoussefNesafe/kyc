/**
 * The latest date of birth that still satisfies a minimum age, as an ISO
 * `YYYY-MM-DD` string — the value a `date` field's `maxDate` wants.
 *
 * `reference` is a parameter rather than `new Date()` read inside, for two
 * reasons. A helper that reads the clock cannot be tested against a fixed
 * expectation without freezing time, and the caller (`buildFormConfig`) needs
 * to pin the reference anyway so the config — and therefore `draftConfigHash`
 * — is stable across calls within a session.
 *
 * The reference is read in UTC. Reading it in local time would make the answer
 * depend on the machine: 23:30 UTC on 27 July is already 28 July in Berlin, and
 * an age cutoff that shifts by a day depending on who rendered it is a bug that
 * only shows up in one timezone.
 *
 * 29 February is the case worth naming. Subtracting 18 years from 2024-02-29
 * lands on 2006-02-29, which does not exist; `new Date(2006, 1, 29)` silently
 * rolls it forward to 1 March, which would let someone one day short of 18
 * through. The day is clamped to the last day of the target month instead, so
 * the answer is 2006-02-28 — the stricter, correct direction.
 */
export function latestDobForAge(minimumAgeYears: number, reference: Date): string {
  if (!Number.isInteger(minimumAgeYears) || minimumAgeYears < 0) {
    throw new RangeError(`minimumAgeYears must be a non-negative integer, got ${minimumAgeYears}`);
  }
  const time = reference.getTime();
  if (Number.isNaN(time)) {
    throw new RangeError("reference must be a valid Date");
  }

  const year = reference.getUTCFullYear() - minimumAgeYears;
  const month = reference.getUTCMonth(); // 0-indexed
  const day = Math.min(reference.getUTCDate(), daysInMonth(year, month));

  return `${pad(year, 4)}-${pad(month + 1, 2)}-${pad(day, 2)}`;
}

/** Day 0 of the following month is the last day of this one. */
function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, "0");
}
