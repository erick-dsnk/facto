# Broader open development baseline 01

This bundle preserves the public development corpus and four completed live baseline reports from frozen backend commit `3cfdfb13d8e6d37ab956e781206d892786ba441f`. It is open development evidence, not a blind or held-out assessment. See [the report](../../../../docs/broader-development-2026-11-14.md).

## Files

- `corpus/`: original authored v1 files, source ground truth, bounded source records and immutable hashes. Original v1 latency fields correctly describe its pre-run authoring state.
- `corpus/v2/`: immutable v2 amendment, strict executable manifest, four balanced batches, original hashes and separate source/label review. V2 changes only the manual incomplete control's terminal expectation.
- `runs/`: four original reports and four original JSONL journals, copied byte-for-byte.
- `execution/`: exact executed wrapper and explicit limits/provenance account. The wrapper is archived execution provenance; running it in live mode can call providers.
- `review/`: original selected-citation packet and eight-row citation review; `origin-inspection/` retains fresh inspection metadata, extracted text, bounded verification context, limitations and raw-archive hashes.
- `computed/metrics-occurrences.json`: current pure metrics function evaluated on all 16 inputs / 13 eligible occurrences.
- `computed/metrics-unique-facts.json`: the same function evaluated on BD01–BD12 only, with matching reviews. BDC04 repeats BD07 and receives no unique-fact credit.
- `computed/observations.json`: reconciled attempt counts, tokens, costs, limits, latencies, terminal events and public search queries.
- `offline/`: pure metrics snapshot and offline recomputation script; no provider adapter or live runner import.
- `MANIFEST.json` and `SHA256SUMS`: package integrity, including the companion report.

## Offline recomputation

From the repository root, with the existing development dependencies installed:

```sh
node --import tsx fixtures/evaluation/live/broader-development-01/offline/recompute.mjs --snapshot
```

Omit `--snapshot` to use current `apps/console/src/live/metrics.ts`; the command checks that its bytes still match the archived snapshot. It reads saved artifacts and invokes only the pure metric function. Source-groundtruth original files, reports, journals and reviews are not rewritten. Generated computed artifacts have a new computation timestamp when rerun, so package hashes must then be intentionally regenerated.

To verify the frozen package from this directory:

```sh
sha256sum -c SHA256SUMS
```

## Raw origin archive

Original public HTTP entity bodies remain at `/workspace/task-evidence/broader-baseline-origin-fetches/`, along with `artifact-manifest.json` and `SHA256SUMS`. `review/origin-inspection/raw-archive-artifact-manifest.json` preserves that archive manifest byte-for-byte; its `.body` entries refer to the external archive, not missing package files. This package keeps all six extracted texts, response status/headers, timestamps, body/text SHA-256 hashes and relevant bounded contexts. A fresh exact-URL response may still come from a CDN cache; none is described as proof of uncached backend-origin state.

## Main denominators

Twelve unique facts: 3 correct definitive, 8 abstentions, 1 admission miss; 2 correct results have every selected reference verified. Thirteen eligible occurrences: 4 correct definitive, 8 abstentions, 1 admission miss; 3 have every selected reference verified. All 16 inputs received a terminal event. Total cost and output tokens remain unknown; the known partial cost is $0.163.
