import { describe, expect, it } from "vitest";
import { latestDobForAge } from "./age";

describe("latestDobForAge", () => {
  it("returns the date exactly N years before the reference date", () => {
    expect(latestDobForAge(18, new Date("2026-07-27T00:00:00Z"))).toBe("2008-07-27");
  });

  it("handles a 29 February reference date without producing an invalid date", () => {
    expect(latestDobForAge(18, new Date("2024-02-29T00:00:00Z"))).toBe("2006-02-28");
  });

  it("keeps 29 February when the target year is also a leap year", () => {
    expect(latestDobForAge(4, new Date("2024-02-29T00:00:00Z"))).toBe("2020-02-29");
  });

  it("zero-pads month and day", () => {
    expect(latestDobForAge(18, new Date("2026-01-05T00:00:00Z"))).toBe("2008-01-05");
  });

  it("reads the reference date in UTC, not the host timezone", () => {
    // 23:30 UTC is already "tomorrow" in Berlin. The answer must not move with
    // the machine running the test.
    expect(latestDobForAge(18, new Date("2026-07-27T23:30:00Z"))).toBe("2008-07-27");
  });

  it("is a pure function of its arguments — the same reference gives the same answer", () => {
    const reference = new Date("2026-07-27T00:00:00Z");
    expect(latestDobForAge(18, reference)).toBe(latestDobForAge(18, reference));
  });

  it("rejects a non-integer or negative age", () => {
    const reference = new Date("2026-07-27T00:00:00Z");
    expect(() => latestDobForAge(17.5, reference)).toThrow();
    expect(() => latestDobForAge(-1, reference)).toThrow();
  });

  it("rejects an unparseable reference date", () => {
    expect(() => latestDobForAge(18, new Date("not a date"))).toThrow();
  });
});
