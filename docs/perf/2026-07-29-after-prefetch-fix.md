# Lighthouse baseline — 2026-07-29

5 runs per URL. Lighthouse mobile defaults: simulated throttling at 150 ms RTT,
1.6 Mbps and 4× CPU, headless Chrome, a fresh browser per run.

No INP: it is a field metric with no lab equivalent, and TBT below is the
stand-in rather than a rename of it. See `scripts/measure.mjs` for why field
data is not collected here.

### `https://kyc-six.vercel.app/`

| Metric | Median | Min | Max |
|---|---|---|---|
| Score | **98** | 97 | 99 |
| FCP | **954 ms** | 940 ms | 1.32 s |
| LCP | **2.30 s** | 1.84 s | 2.33 s |
| TBT | **75 ms** | 51 ms | 83 ms |
| CLS | **0.000** | 0.000 | 0.000 |
| Transfer | **272 KiB** | 271 KiB | 272 KiB |

Runs: 97 / 99 / 98 / 98 / 98

### `https://kyc-six.vercel.app/apply/account-type`

| Metric | Median | Min | Max |
|---|---|---|---|
| Score | **87** | 79 | 89 |
| FCP | **1.08 s** | 933 ms | 1.38 s |
| LCP | **2.28 s** | 2.14 s | 3.79 s |
| TBT | **406 ms** | 388 ms | 467 ms |
| CLS | **0.000** | 0.000 | 0.000 |
| Transfer | **577 KiB** | 577 KiB | 577 KiB |

Runs: 86 / 79 / 87 / 89 / 89

---

## What changed, and what did not

*Added by hand after the run. Everything above is the script's output, unedited.*

This measures one change: the landing page's call to action no longer prefetches
`/apply/account-type` on entering the viewport. It warms on hover, focus or
touch instead. See `src/components/StartApplicationLink.tsx`.

### The landing page, against 2026-07-28

| Metric | Before | After | |
|---|---|---|---|
| Score (median) | 98 | 98 | unchanged |
| Score (min) | 95 | **97** | tail improved |
| Transfer | 572 KiB | **272 KiB** | −52 % |
| TBT (median) | 110 ms | **75 ms** | −32 % |
| LCP (median) | 2.14 s | 2.30 s | noise |
| FCP (median) | 943 ms | 954 ms | noise |

**The median score did not move, and saying otherwise would be dishonest.** The
landing page was already at 98 across a 95–99 spread; there was no room above it
for 300 KiB of savings to show up in. A PageSpeed Insights run that scored this
page 80 prompted the work, and a local audit reproduced it at 80 with a 4.2 s
LCP — but five runs put the median back at 98 both before and after. That 80 was
a draw from the tail, not the site's score, and the fix should not be credited
with the recovery from it.

What the change genuinely bought:

- **Half the bytes.** 572 → 272 KiB. The page was downloading a 291 KiB chunk its
  own HTML never references, reported 100 % unused, requested at 2.3 s.
- **A third off blocking time.** 110 → 75 ms median, and the worst run improved
  from 156 ms to 83 ms — the parse and compile of the engine chunk was real work
  on the main thread even though nothing called into it.
- **A narrower distribution.** 95–99 became 97–99. Removing a large, late,
  low-priority download removes one of the things that made the bad runs bad.

That is a better page on a metered connection and on a slow device, which is
worth having on its own terms. It is not a better Lighthouse score, because the
score was already at its ceiling.

### The form route: untouched, as expected

87 median before and after. This change never touched it — `/apply/account-type`
genuinely needs the engine chunk, and its 577 KiB is not waste in the way the
landing page's 291 KiB was. Its TBT sits at 406 ms and remains the one real
performance problem in this project.

## What is left

The form route's chunk is the remaining lever, and it is a different kind of
work: splitting the heavy field types (calendar, combobox, dropzone, phone)
behind `next/dynamic` so step one stops paying for step four's controls. That
changes user-visible behaviour — a field type arriving late can flash or delay —
so it is a decision about the product, not a mechanical optimisation, and it is
not being made here.

Given the variance measured on that route (79–89 across five runs), any attempt
needs five runs either side. A single before/after pair on `/apply/account-type`
cannot distinguish a real gain from a good draw.

