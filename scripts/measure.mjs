#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import lighthouse from "lighthouse";
import * as chromeLauncher from "chrome-launcher";

/**
 * Runs Lighthouse N times against one or more URLs and reports the MEDIAN, the
 * MIN and the MAX for each metric.
 *
 * ## Why the spread is the point
 *
 * The performance section of the README reached a soft conclusion for a
 * defensible reason: the form route scored 79, 90 and 89 on three runs, and FCP
 * was bimodal at roughly 1.1 s and 3.0 s. Any single number drawn from that
 * distribution is true and useless — 79 and 91 are both real, and quoting either
 * one alone is a choice about what to believe rather than a measurement.
 *
 * Two candidate optimisations were then rejected partly because the evidence for
 * them did not survive repetition. That was the right call and it was expensive
 * to reach by hand. This script is the tool that was missing when it was made.
 *
 * ## Settings
 *
 * Lighthouse defaults: mobile form factor, simulated throttling (150 ms RTT,
 * 1.6 Mbps, 4× CPU). Deliberately unchanged, so numbers from this script are
 * comparable to the ones already written into the README rather than a new
 * baseline nobody can line up against the old one.
 *
 * A fresh Chrome is launched for every run. Lighthouse resets storage between
 * runs anyway, but a fresh process also drops JIT state and any profile-level
 * caching, and the run-to-run variance being investigated here is exactly the
 * kind of thing a shared process can quietly smooth over.
 *
 * ## What this does NOT measure
 *
 * INP. It is a field metric and there is no lab equivalent; TBT is the stand-in
 * and it is reported as TBT, not relabelled. Collecting real INP would mean
 * shipping a beacon that POSTs from the page, which fails
 * `e2e/no-data-egress.spec.ts` and falsifies the landing page's claim that
 * nothing phones home. Those are worth more than the number.
 *
 * ## Usage
 *
 *   node scripts/measure.mjs <url> [<url> ...] [--runs=5] [--out=<file>]
 *   yarn measure https://kyc-six.vercel.app/ https://kyc-six.vercel.app/apply/account-type
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const METRICS = [
  { key: "score", label: "Score", unit: "score" },
  { key: "first-contentful-paint", label: "FCP", unit: "ms" },
  { key: "largest-contentful-paint", label: "LCP", unit: "ms" },
  { key: "total-blocking-time", label: "TBT", unit: "ms" },
  { key: "cumulative-layout-shift", label: "CLS", unit: "raw" },
  { key: "total-byte-weight", label: "Transfer", unit: "bytes" },
];

function parseArgs(argv) {
  const urls = [];
  let runs = 5;
  let out = null;

  for (const arg of argv) {
    if (arg.startsWith("--runs=")) runs = Number.parseInt(arg.slice("--runs=".length), 10);
    else if (arg.startsWith("--out=")) out = arg.slice("--out=".length);
    else if (arg.startsWith("--")) throw new Error(`Unknown flag: ${arg}`);
    else urls.push(arg);
  }

  if (urls.length === 0) {
    throw new Error(
      "No URL given.\n  usage: node scripts/measure.mjs <url> [<url> ...] [--runs=5] [--out=<file>]",
    );
  }
  if (!Number.isInteger(runs) || runs < 1) {
    throw new Error(`--runs must be a positive integer, got "${runs}"`);
  }

  return { urls, runs, out };
}

/**
 * The middle value, or the mean of the two middle values on an even count.
 *
 * The mean is used for the even case rather than the lower-middle because these
 * are continuous measurements, not ranks — and an odd `--runs` is the normal
 * case anyway.
 */
function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function format(value, unit) {
  if (!Number.isFinite(value)) return "—";
  switch (unit) {
    case "score":
      return String(Math.round(value));
    case "ms":
      return value >= 1000 ? `${(value / 1000).toFixed(2)} s` : `${Math.round(value)} ms`;
    case "bytes":
      return `${Math.round(value / 1024)} KiB`;
    case "raw":
      return value.toFixed(3);
    default:
      return String(value);
  }
}

async function runOnce(url) {
  const chrome = await chromeLauncher.launch({
    chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu"],
  });
  try {
    const result = await lighthouse(
      url,
      { logLevel: "error", output: "json", onlyCategories: ["performance"], port: chrome.port },
      // No config override: Lighthouse's own mobile defaults, for comparability.
    );
    if (!result?.lhr) throw new Error(`Lighthouse returned no result for ${url}`);

    const { lhr } = result;
    const sample = { score: (lhr.categories.performance?.score ?? 0) * 100 };
    for (const { key } of METRICS) {
      if (key === "score") continue;
      sample[key] = lhr.audits[key]?.numericValue ?? Number.NaN;
    }
    return sample;
  } finally {
    // On Windows, chrome-launcher removes the temporary user-data directory it
    // created, and Chrome frequently still holds a handle to it for a moment
    // after exit — the removal then fails with EPERM. That is a cleanup race in
    // the launcher, not a bad measurement: the run above already completed and
    // its numbers are sound. Letting it propagate aborts the whole sweep partway
    // through, discarding the runs that succeeded, so it is swallowed here. A
    // stray directory in %TEMP% is the entire cost.
    try {
      await chrome.kill();
    } catch (error) {
      process.stderr.write(`    (ignored: could not clean up Chrome — ${error.message})\n`);
    }
  }
}

/** One markdown table per URL: median, min and max side by side. */
function tableFor(url, samples) {
  const lines = [
    `### \`${url}\``,
    "",
    "| Metric | Median | Min | Max |",
    "|---|---|---|---|",
  ];

  for (const { key, label, unit } of METRICS) {
    const values = samples.map((sample) => sample[key]).filter(Number.isFinite);
    if (values.length === 0) {
      lines.push(`| ${label} | — | — | — |`);
      continue;
    }
    lines.push(
      `| ${label} | **${format(median(values), unit)}** | ${format(Math.min(...values), unit)} | ${format(Math.max(...values), unit)} |`,
    );
  }

  const scores = samples.map((sample) => sample.score).filter(Number.isFinite);
  lines.push("", `Runs: ${scores.map((score) => Math.round(score)).join(" / ")}`, "");
  return lines.join("\n");
}

async function main() {
  const { urls, runs, out } = parseArgs(process.argv.slice(2));

  const sections = [];
  for (const url of urls) {
    const samples = [];
    for (let run = 1; run <= runs; run += 1) {
      process.stderr.write(`  ${url} — run ${run}/${runs}\n`);
      samples.push(await runOnce(url));
    }
    sections.push(tableFor(url, samples));
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const document = [
    `# Lighthouse baseline — ${stamp}`,
    "",
    `${runs} runs per URL. Lighthouse mobile defaults: simulated throttling at 150 ms RTT,`,
    "1.6 Mbps and 4× CPU, headless Chrome, a fresh browser per run.",
    "",
    "No INP: it is a field metric with no lab equivalent, and TBT below is the",
    "stand-in rather than a rename of it. See `scripts/measure.mjs` for why field",
    "data is not collected here.",
    "",
    ...sections,
  ].join("\n");

  console.log(`\n${document}`);

  if (out) {
    const target = path.isAbsolute(out) ? out : path.join(ROOT, out);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, `${document}\n`, "utf8");
    process.stderr.write(`\nWritten to ${path.relative(ROOT, target).split(path.sep).join("/")}\n`);
  }
}

main().catch((error) => {
  console.error(`measure: ${error.message}`);
  process.exit(1);
});
