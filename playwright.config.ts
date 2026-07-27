import { defineConfig, devices } from "@playwright/test";

/**
 * Browser flows (`yarn test:e2e`). Deliberately minimal for now — the
 * keyboard-only walkthrough and the network-egress guard land later; this
 * exists so the script in package.json points at a real, runnable config
 * rather than being decorative.
 *
 * `webServer` builds and serves the production output rather than running
 * `next dev`: the flows this demo cares about (a11y, no network egress,
 * Lighthouse-adjacent behaviour) are properties of the shipped bundle, and
 * dev-mode overlays and unminified React would mask them.
 *
 * NOTE: e2e/ is empty right now, so `yarn test:e2e` exits 1 with "No tests
 * found". That is on purpose and `--pass-with-no-tests` is deliberately NOT
 * set. An e2e suite quietly reporting success with zero specs is the exact
 * failure this whole file exists to prevent -- these flows are what prove the
 * deployed artifact works, and losing them all should be loud. (vitest.config
 * does set passWithNoTests, because a unit suite is grown continuously and a
 * red `yarn test` from commit one is just noise.)
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
