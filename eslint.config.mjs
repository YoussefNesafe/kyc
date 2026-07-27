import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // src/form-builder/ is a VENDORED COPY of a standalone, config-driven form
    // engine (installed by the form-builder CLI, shadcn-style). This repo's
    // architectural claim is that the directory could be lifted back out and
    // published without a rewrite -- which holds only while nothing inside it
    // imports this demo's code.
    //
    // This override is the EDITOR-VISIBLE half of that rule: it red-underlines
    // the bad import while it is being typed, when undoing it is free.
    // scripts/check-engine-boundary.mjs is the AUTHORITY -- it also catches
    // brand names in prose and filenames, and relative paths that climb out of
    // the directory (`../../lib/utils`), neither of which no-restricted-imports
    // can express. Both run under `yarn lint`; if the two ever disagree, the
    // script wins.
    //
    // @/components/ui/* is exempt on purpose: shadcn primitives are the
    // engine's documented foundation upstream. A CLI-installed tree contains
    // none of these imports at all -- the installer rewrites them to relative
    // paths into the engine's own vendored copy of the primitives -- so the
    // allowance covers hand-written engine files only.
    files: ["src/form-builder/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/config",
                "@/config/**",
                "@/lib",
                "@/lib/**",
                "@/app",
                "@/app/**",
                "@/fields",
                "@/fields/**",
                "@/hooks",
                "@/hooks/**",
              ],
              message:
                "src/form-builder/ is a vendored copy of a standalone form engine and must not import this demo's code. Pass the value in as a prop or a FormConfig entry instead. Enforced in CI by scripts/check-engine-boundary.mjs.",
            },
            {
              // Gitignore semantics: a "!" entry cannot re-include something
              // whose PARENT is still excluded, so `@/components/ui` has to be
              // un-excluded before `@/components/ui/**` can be. Writing this as
              // a single ["@/**", "!@/components/ui/**"] silently bans the
              // shadcn primitives too -- established by probe, not assumed.
              group: ["@/components/**", "!@/components/ui", "!@/components/ui/**"],
              message:
                "src/form-builder/ may import @/components/ui/* (shadcn primitives are the engine's documented foundation) but no other demo component. Enforced in CI by scripts/check-engine-boundary.mjs.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
