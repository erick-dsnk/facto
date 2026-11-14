# Candidate09 OPEN development evidence

This new package combines two separately owned, preserved sets: the execution package under `execution/` and independent citation evidence under `citations/`. It records **4/12 correct definitive unique facts, 3/12 with every selected reference verified**, eight abstentions and no wrong definitive or operational result. All 16 inputs reached terminals and all 13 eligible public occurrences were admitted. The mixed BD07 repeat abstained and adds zero unique facts: occurrence results are 4/13 raw and 3/13 fully verified. This is repeated OPEN development, neither blind nor a causal experiment.

Authoritative final citation rows are [review-v2.json](citations/review-v2.json); final source metrics are [offline-metrics-v2.json](citations/offline-metrics-v2.json). Eleven selected references include ten verified and one inaccessible. `review-v1.json`, its original audit summary and the execution-only source-credit-pending summary are historical snapshots, not the latest source-access observation. The separately dated [Olympics access supplement](citations/olympics-access-02/access-observation.json) records a new HTTP 503 failure, preserving the earlier failed-access record. It changes no source credit.

- [execution/README.md](execution/README.md) describes the exact 9a5e80d freeze, fresh 525-test gate, immutable four reports/journals, manifests/wrapper, original guard halt and reviewed versioned continuation of only batches 2–4. Original batch 1 was never reissued. The whole execution subpackage is byte-identical to its frozen external package; its internal manifests/copy map remain untouched.
- [references.json](references.json) binds the unchanged baseline v2 corpus, wrapper, earlier packages and documents. Ground truth, source records and v1/v2 authorship remain in the [baseline corpus](../broader-development-01/corpus/); this run changes no truth labels or public spans.
- [independent-actuals.json](independent-actuals.json) separately recomputes actual counts, usage, caps and latency. Runtime nearest-rank P50 and arithmetic median are both retained rather than conflated.
- [citations/selected-citations.json](citations/selected-citations.json) binds exact selected URL/excerpt-SHA pairs to the four original report hashes. Eight positive origin proofs reuse exact prior matches with original access times. Two changed reef excerpts were freshly checked; the unchanged Olympics citation received one separately bounded fresh request and remained inaccessible. No unselected source substituted for a selected gap.
- [review/independent-citation-consistency-review.json](review/independent-citation-consistency-review.json) checks all 11 rows, original proof timestamps, raw hashes and the separate fresh 503 supplement. It is AI-agent review, not human inspection or external protocol registration.
- [external archive locations](citations/external-archive-locations.json) identify preserved full raw origin bodies/texts and manifests outside Git. This repository contains exact selected quotes, bounded origin excerpts and metadata/hashes; it does not contain every raw origin page/PDF.
- [execution/comparison/](execution/comparison/) contains the corrected 0.85 substance/common-origin vs 0.8 stance acquisition comparison with 08. Its `baseline` field means candidate08. Recorded-assessment yield is not source verification, complete policy eligibility, independent origin count or retrieval recall.

The later 530-test integration and deferred-variant fallback fix are outside the actual 525-test frozen09 source and receive no live credit here. Existing baseline/candidate08 packages and documents remain unchanged. See the [campaign document](../../../../docs/broader-development-candidate09.md) for scope, outcomes, costs and limitations.

The top [MANIFEST.json](MANIFEST.json) and [SHA256SUMS](SHA256SUMS) bind the complete package. Check copied execution integrity without network calls:

```sh
python3 execution/verify.py
```

Recompute final metrics offline from the pure frozen metric snapshot and saved reports/review rows; an optional output directory must be outside this immutable package:

```sh
node --experimental-strip-types offline/recompute.mjs /tmp/candidate09-metrics
```

These checks never import provider adapters or the live runner. Total billing and output-token counts remain unknown; no new provider calls are needed.
