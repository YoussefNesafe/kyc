# Lighthouse baseline — 2026-07-29

5 runs per URL. Lighthouse mobile defaults: simulated throttling at 150 ms RTT,
1.6 Mbps and 4× CPU, headless Chrome, a fresh browser per run.

No INP: it is a field metric with no lab equivalent, and TBT below is the
stand-in rather than a rename of it. See `scripts/measure.mjs` for why field
data is not collected here.

### `https://kyc-six.vercel.app/apply/account-type`

| Metric | Median | Min | Max |
|---|---|---|---|
| Score | **90** | 84 | 91 |
| FCP | **1.09 s** | 935 ms | 1.53 s |
| LCP | **3.04 s** | 1.83 s | 3.49 s |
| TBT | **261 ms** | 223 ms | 335 ms |
| CLS | **0.000** | 0.000 | 0.000 |
| Transfer | **489 KiB** | 489 KiB | 489 KiB |

Runs: 91 / 90 / 90 / 89 / 84

### `https://kyc-six.vercel.app/`

| Metric | Median | Min | Max |
|---|---|---|---|
| Score | **98** | 98 | 99 |
| FCP | **960 ms** | 954 ms | 1.11 s |
| LCP | **2.30 s** | 1.85 s | 2.31 s |
| TBT | **58 ms** | 37 ms | 71 ms |
| CLS | **0.000** | 0.000 | 0.000 |
| Transfer | **272 KiB** | 272 KiB | 272 KiB |

Runs: 98 / 98 / 98 / 99 / 99

---

## What changed

*Added by hand after the run. Everything above is the script's output, unedited.*

Two changes since `2026-07-29-after-prefetch-fix.md`: `country`, `phone`, `date`
and `file` are code-split out of the first step's bundle
(`src/fields/deferred.ts`), and the shell warms them on the visitor's first
interaction rather than on idle.

### `/apply/account-type`, against the 2026-07-28 baseline

| Metric | Baseline | Now | |
|---|---|---|---|
| Score (median) | 87 | **90** | first time on the line |
| Score (min) | 79 | **84** | tail improved |
| TBT (median) | 406 ms | **261 ms** | −36 % |
| Transfer | 577 KiB | **489 KiB** | −88 KiB |
| Unused JS on step one | ~186 KiB | **24 KiB** | |
| LCP (median) | 2.28 s | 3.04 s | **worse — see below** |
| CLS | 0 | 0 | |

**LCP moved the wrong way and I am not going to explain it away.** The medians
say 2.28 s → 3.04 s. The distributions say something less certain: the range was
2.14–3.79 s before and is 1.83–3.49 s now, so both the best and the worst run
improved while the middle got worse. Five samples put the median almost anywhere
inside a spread that wide, and nothing in the change plausibly delays the LCP
element — step one renders `static`, `radio` and `select`, none of which are
deferred, and `ssr` is left on so the prerendered HTML is byte-identical in the
parts that paint.

The honest position is that this is unresolved, not that it is fine. It needs
more runs than five to call, and it is the first thing to look at next.

### The idle-warm regression, recorded because it was mine

The first version of the warm used `requestIdleCallback`, and a deployed
measurement rejected it:

| | Unsplit | Split + idle warm | Split + interaction warm |
|---|---|---|---|
| Transfer | 577 KiB | 591 KiB | **489 KiB** |
| TBT | 406 ms | 460 ms | **261 ms** |

Idle arrives early on a page this small — inside the window blocking time is
measured over — so step one split four chunks out and then immediately parsed
all four while it was still becoming interactive. It was measurably worse than
not splitting at all. Waiting for a real interaction is what turned the split
into a gain.

### The landing page, unchanged by design

98 median, and TBT drifted 75 → 58 ms. Nothing in this change targets `/`; it no
longer loads any of these chunks at all. Recorded to show it did not regress.

## What is left

- **The LCP question above.** Ten runs a side would settle whether it is real.
- 24 KiB still reported unused on step one, down from ~186 KiB. Small enough
  that the next split would cost more in pop-in risk than it returns.
- The form route now clears 90 at the median but its floor is 84, so the spread
  is still wider than the distance to the target. That was true at the baseline
  and remains the honest summary of this route.

