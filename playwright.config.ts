import { defineConfig, devices } from "@playwright/test";

/**
 * Browser flows (`yarn test:e2e`). Two specs, both of them acceptance criteria
 * this demo would otherwise have to claim rather than demonstrate:
 * `keyboard-flow` completes an application without a mouse, and
 * `no-data-egress` proves that filling it in puts nothing on the network.
 *
 * `webServer` builds and serves the production output rather than running
 * `next dev`: the flows this demo cares about (a11y, no network egress,
 * Lighthouse-adjacent behaviour) are properties of the shipped bundle, and
 * dev-mode overlays and unminified React would mask them. `reuseExistingServer`
 * locally, so a `yarn start` already running is used as-is instead of costing a
 * rebuild on every run; CI always builds its own.
 *
 * `--pass-with-no-tests` is deliberately NOT set. An e2e suite quietly
 * reporting success with zero specs is the exact failure this file exists to
 * prevent — these flows are what prove the deployed artifact works, and losing
 * them all should be loud. (vitest.config does set passWithNoTests, because a
 * unit suite is grown continuously and a red `yarn test` from commit one is
 * just noise.)
 *
 * Helpers live in `e2e/support/`, which the default `testMatch` — `*.spec.ts` /
 * `*.test.ts` — does not collect, so they are imported and never run as empty
 * suites.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "yarn build && yarn start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
