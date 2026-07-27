import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { APPLICATION_ENTRY_PATH, APPLICATION_ROUTE_IS_LIVE, stepPath } from "./routes";
import { STEP_SLUGS } from "./steps";

const APP_DIR = path.resolve(__dirname, "..", "app");

describe("application routes", () => {
  it("sends a visitor to the first step, whatever that step is called", () => {
    expect(APPLICATION_ENTRY_PATH).toBe(stepPath(STEP_SLUGS[0]));
    expect(APPLICATION_ENTRY_PATH).toBe("/apply/account-type");
  });

  /**
   * The guard that makes `APPLICATION_ROUTE_IS_LIVE` safe to ship as `false`.
   *
   * The landing page hides its primary call to action while the flag is down.
   * If the shell lands and nobody flips it, the demo has a working application
   * that nothing links to — a silent failure, and the worst kind, because
   * everything renders. So the filesystem is the source of truth and the
   * constant has to agree with it.
   */
  it("claims the flow is live exactly when the route exists", () => {
    expect(APPLICATION_ROUTE_IS_LIVE).toBe(existsSync(path.join(APP_DIR, "apply")));
  });
});
