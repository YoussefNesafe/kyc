import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

/**
 * Unit/component tests (`yarn test`). Playwright owns the browser flows —
 * see playwright.config.ts — and its specs live under e2e/, excluded here so
 * the two runners never try to collect each other's files.
 *
 * The `@` alias is duplicated from tsconfig.json rather than read from it:
 * Vitest resolves modules itself and does not consult tsconfig paths.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    // Green on an empty suite so `yarn lint && yarn typecheck && yarn test`
    // is a usable gate from the first commit, before any test exists.
    passWithNoTests: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
