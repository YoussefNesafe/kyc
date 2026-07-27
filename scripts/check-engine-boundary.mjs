#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Machine-checks this repo's central architectural claim: `src/form-builder/`
 * is a VENDORED COPY of a generic, config-driven form engine, and it could be
 * lifted out of this repo and published without a rewrite.
 *
 * That claim is easy to assert in a README and easy to break in a hurry —
 * one `import { JURISDICTIONS } from "@/config/jurisdictions"` inside a field
 * component, added at 2am to make a demo requirement land, and the engine is
 * now a fork of itself. Nothing about that edit looks wrong in review; it
 * type-checks, it builds, it ships. So the claim is enforced here instead of
 * being trusted.
 *
 * Two rules, both scoped to ENGINE_DIR:
 *
 *   1. No mention of the fictional brokerage this demo is built for, in any
 *      casing. The engine must not know whose form it renders. This is a
 *      substring scan over file CONTENT and PATHS, not an import scan — a
 *      hardcoded label, a comment, a CSS class or a filename all count.
 *
 *   2. No import reaching back into demo code. `@/components/ui/*` is the one
 *      allowed alias: shadcn primitives are the engine's documented
 *      foundation, and a published copy expects a consumer to supply them.
 *      Everything else under `@/` is demo code by construction — `@/config`,
 *      `@/lib`, `@/app`, `@/fields`, and any `@/components/*` that is not
 *      `ui/`. Relative specifiers that climb OUT of ENGINE_DIR are the same
 *      breach wearing a different spelling (`../../lib/utils` reaches
 *      `src/lib/utils` just as surely as `@/lib/utils` does), so they are
 *      resolved and checked too.
 *
 * Note the CLI installer rewrites every `@/components/ui/*` import to a
 * relative path into the engine's own vendored `components/ui/` on the way
 * in, so a freshly-installed tree has ZERO `@/` imports of any kind. Rule 2's
 * allowance therefore protects a case that does not currently arise — kept
 * because it is the engine's documented contract upstream, and a
 * hand-written engine file could legitimately use it.
 *
 * Run by `yarn lint` (alongside ESLint, which carries the same import rules
 * as an editor-visible `no-restricted-imports` override — see
 * eslint.config.mjs; that override cannot see rule 1 or relative escapes,
 * which is why this script is the authority and ESLint is the fast feedback).
 *
 * Exits 0 on a clean engine, 1 on any violation or on a missing engine dir
 * (a check that cannot find what it guards must not report success).
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ENGINE_DIR = path.join(ROOT, "src", "form-builder");

/** The brokerage this demo is for. The engine must never name it. */
const DEMO_BRAND = "meridian";

/** Alias imports the engine may legitimately reach for. Prefix match on the specifier. */
const ALLOWED_ALIAS_PREFIXES = ["@/components/ui/"];

const TEXT_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".css", ".json", ".md"]);

/**
 * Matches both static (`import x from "y"` / `export * from "y"`) and dynamic
 * (`import("y")`) forms, plus `require("y")`. Captures the specifier. Kept
 * deliberately loose about what precedes the specifier so a reformatted
 * multi-line import list cannot slip past on whitespace.
 */
const SPECIFIER_RE = /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*)["']([^"']+)["']/g;

function listFiles(dir) {
  const out = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const abs = path.join(current, entry.name);
      if (entry.isDirectory()) walk(abs);
      else if (entry.isFile()) out.push(abs);
    }
  };
  walk(dir);
  return out.sort();
}

const rel = (abs) => path.relative(ROOT, abs).split(path.sep).join("/");

/** 1-indexed line number of `index` within `source`. */
function lineOf(source, index) {
  return source.slice(0, index).split("\n").length;
}

function checkBrand(absPath, source, violations) {
  const relPath = rel(absPath);
  if (relPath.toLowerCase().includes(DEMO_BRAND)) {
    violations.push({
      file: relPath,
      line: 0,
      message: `filename mentions "${DEMO_BRAND}" — the engine must not know which brand it renders for`,
    });
  }
  const re = new RegExp(DEMO_BRAND, "gi");
  let match;
  while ((match = re.exec(source))) {
    violations.push({
      file: relPath,
      line: lineOf(source, match.index),
      message: `mentions "${match[0]}" — the engine must not know which brand it renders for; move this into demo code (src/config, src/components, ...) and pass it in as configuration`,
    });
  }
}

function checkImports(absPath, source, violations) {
  const relPath = rel(absPath);
  let match;
  SPECIFIER_RE.lastIndex = 0;
  while ((match = SPECIFIER_RE.exec(source))) {
    const specifier = match[1];
    const line = lineOf(source, match.index);

    if (specifier.startsWith("@/")) {
      if (ALLOWED_ALIAS_PREFIXES.some((prefix) => specifier.startsWith(prefix))) continue;
      violations.push({
        file: relPath,
        line,
        message: `imports "${specifier}" — that alias resolves into demo code. The engine may only reach ${ALLOWED_ALIAS_PREFIXES.map((p) => `"${p}*"`).join(", ")}; anything else has to arrive as a prop or config value`,
      });
      continue;
    }

    if (specifier.startsWith(".")) {
      const resolved = path.resolve(path.dirname(absPath), specifier);
      const insideEngine = resolved === ENGINE_DIR || resolved.startsWith(ENGINE_DIR + path.sep);
      if (!insideEngine) {
        violations.push({
          file: relPath,
          line,
          message: `imports "${specifier}", which resolves to ${rel(resolved)} — outside the engine. A relative path out of src/form-builder/ is the same boundary breach as an "@/" import into demo code`,
        });
      }
    }
    // Bare specifiers ("react", "zod", ...) are npm packages — the engine's
    // declared dependencies, not demo code. Not this check's concern.
  }
}

function main() {
  if (!fs.existsSync(ENGINE_DIR)) {
    console.error(
      `check-engine-boundary: ${rel(ENGINE_DIR)} does not exist. Either the engine was never installed (run the form-builder CLI) or ENGINE_DIR in this script is stale — a boundary check that cannot find the boundary must fail, not pass.`,
    );
    process.exit(1);
  }

  const files = listFiles(ENGINE_DIR).filter((abs) => TEXT_EXTENSIONS.has(path.extname(abs)));
  if (files.length === 0) {
    console.error(`check-engine-boundary: ${rel(ENGINE_DIR)} contains no scannable source files — refusing to report a pass.`);
    process.exit(1);
  }

  const violations = [];
  for (const abs of files) {
    const source = fs.readFileSync(abs, "utf8");
    checkBrand(abs, source, violations);
    checkImports(abs, source, violations);
  }

  if (violations.length > 0) {
    console.error(
      `check-engine-boundary: ${violations.length} boundary violation(s) in ${rel(ENGINE_DIR)}.\n` +
        `This directory is a vendored copy of a standalone form engine. It must stay liftable: nothing in it may name this demo's brand or import this demo's code.\n`,
    );
    for (const v of violations) {
      console.error(`  ${v.file}${v.line > 0 ? `:${v.line}` : ""}\n    ${v.message}`);
    }
    process.exit(1);
  }

  console.log(
    `check-engine-boundary: OK — ${files.length} file(s) in ${rel(ENGINE_DIR)}, no "${DEMO_BRAND}" mention and no import reaching into demo code.`,
  );
}

main();
