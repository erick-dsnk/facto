# Public broader-development candidate08

Completed repeated OPEN development at frozen commit `aefb9e7c5f0f3d0e332eea5d8748878b3f6cf75c`: **6/12 correct definitive unique facts**, **4/12 with every selected source verified**, **5 abstentions**, and **1 operational failure**. All 13 eligible public occurrences were admitted and all 16 inputs received terminal events. BDC04 repeats BD07: it adds one occurrence, no unique fact.

Read [the candidate report](../../../../docs/broader-development-candidate08.md). This is neither blind nor held out, and the comparison does not isolate component effects from provider/index/cache/model variation.

## Preserved inputs and references

- `runs/`: all four original reports and journals, byte-for-byte.
- `freeze/`: exact candidate freeze record and install/check/evaluate logs, plus read-only verification of the frozen clone's HEAD, cleanliness, source hash and declared log hashes. These are saved validation results, not new test runs.
- `baseline-references.json`: exact path/hash references into the existing [baseline bundle](../broader-development-01/README.md), including authored v2 corpus, source ground truth, review, pure metrics snapshot, wrapper, limits and baseline results. Corpus bytes are not duplicated here.
- `review/`: exact 19-row citation review and selected-source packet, original audit details/reuse/limitations, source metadata and bounded proof contexts.
- `comparison/`: original offline acquisition comparator output/findings and a mechanical reproduction check. Its recorded assessment qualification is not independent source verification.
- `computed/`: offline metrics for 13 eligible occurrences and 12 unique facts; reconciled usage, latencies and operational outcomes; and reproduced acquisition comparison.
- `offline/`: recomputation driver and copied network-free comparator.
- `MANIFEST.json`, `SHA256SUMS`, `package-validation.json`: package integrity and source-copy checks.

## Offline metrics

From the repository root:

```sh
node --import tsx fixtures/evaluation/live/broader-development-08/offline/recompute.mjs
```

The driver verifies referenced baseline hashes, imports the immutable baseline pure metrics snapshot (identical to frozen08 metrics.ts), and reads saved reports/reviews. It does not import a live runner, provider adapter or environment credentials. Generated computation timestamps change on rerun; intentionally regenerate package hashes afterward. The immutable source reports/reviews/baseline files remain untouched.

Verify this frozen bundle from its directory with `sha256sum -c SHA256SUMS`.

## External origin archive

**Raw HTTP entity bodies/PDFs are not included in this repository bundle.** They remain at `/workspace/task-evidence/broader-candidate08-citation-work/origin-fetches/`. The complete audit archive is `/workspace/task-evidence/broader-candidate08-citation-work/`, with `MANIFEST.json` and `SHA256SUMS`. `review/external-audit-archive-manifest.json` and `review/external-audit-archive-SHA256SUMS` preserve that archive inventory; their raw-body paths refer to the external archive, not missing package files. This package retains source statuses/headers/timestamps, hashes, selected excerpts and bounded verification contexts. Full extracted texts and the rendered page used for OCR verification remain in the external archive; their hashes are retained here.

The selected IOC PDF is 44,695,465 bytes. An initial 16 MiB truncated capture and a complete 64 MiB-bounded retry are both in the external archive. Bartleby 403 and Olympics.com 503 remained inaccessible on the audit path. Exactly one Federal Register proof reuses baseline's identical URL/excerpt hash, preserving the old 04:19:05.217388 fetch time; all changed/new selected excerpts received exact-URL requests. No indexed result is called a fresh origin fetch, and CDN caching remains possible.
