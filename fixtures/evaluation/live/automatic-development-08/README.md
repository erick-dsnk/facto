# Automatic presentation development 08

This package preserves one six-scenario actual-provider campaign on immutable source `aefb9e7c5f0f3d0e332eea5d8748878b3f6cf75c`. See [the report](../../../../docs/automatic-development-2026-11-14.md). Original action scoring remains **five passes, one inconclusive, zero failures**. AD02 delivered an actual selected-topic notification. AD03 abstained, so it did not exercise the intended supported-fact silence branch.

- `preparation/`: frozen six-case catalog, isolated projections, exact executed wrapper, cap plan, source-label references, tests and independent pre-execution review. The wrapper is execution provenance and can make paid calls if explicitly run in live mode.
- `runs/`: byte-identical sanitized first-run report and its durable journal. Neither was rerun or modified during packaging.
- `computed/original-action-scoring.json`: original outcome snapshot, written before citation inspection. Its pending-source-review labels are preserved as history.
- `computed/publication-summary.json`: subsequent source-review status and copy hashes; it does not revise the five-pass/one-inconclusive action result.
- `computed/query-audit.json`: all six search queries and nine search/contents instruction digests matched the frozen current-public-span helpers.
- `review/`: strict 14-reference review array, exact excerpt alignment, source reasoning, validation and original proof timestamps. All 14 occurrences across six selected URLs were verified; they represent four result occurrences but only two unique existing facts.
- `review/origin-inspection/`: copied response metadata and extracted text. `raw-retention.json` identifies the external immutable raw-body archive; original absolute proof paths remain provenance, not links to files claimed to be inside this package.
- `offline/`: pure metric snapshot and recomputation script. It imports no provider adapter or live runner.

`preparation/PACKAGING.json` records byte-identical filename changes for the archived native tests (`*.check.mts`) so repository Vitest does not discover them. Original author hash manifests retain their original names and are provenance records; the outer package manifests use the packaged names.

From the repository root:

```sh
node --import tsx fixtures/evaluation/live/automatic-development-08/offline/recompute.mjs
```

This recalculates scenario-occurrence metrics from saved reports and strict source reviews without provider calls. The generic presentation-action metric matches all six observed actions; the stricter predeclared scenario score also requires the expected factual branch and therefore remains five passes and one inconclusive. Do not substitute the generic action count for that result.

Verify package integrity from this directory with `sha256sum -c SHA256SUMS`. `MANIFEST.json` also identifies the companion documentation and immutable source hashes. No result in this action diagnostic enlarges the factual-accuracy denominator. AD07, if reported separately, cannot replace AD03 or change this original campaign's score.
