# Broader OPEN development, candidate09

Candidate09 produced **4/12 correct definitive unique facts and 3/12 with every selected reference verified**, with eight abstentions, no wrong definitive result and no operational error. All 13 eligible public occurrences were admitted and all 16 inputs reached terminals. This repeats the same OPEN development corpus available for tuning; it is neither blind nor a causal experiment, and it does not establish readiness.

| Saved cohort | Correct definitive /12 unique facts | Every selected reference verified /12 | Other unique-fact outcomes |
| --- | ---: | ---: | --- |
| [Baseline](broader-development-2026-11-14.md) | 3 | 2 | Eight abstentions; one incorrect private skip |
| [Candidate08](broader-development-candidate08.md) | 6 | 4 | Five abstentions; one operational error |
| Candidate09 | 4 | 3 | Eight abstentions |

The candidate09 definitive facts are BD03, BD08, BD10 and BD12. BD03, BD10 and BD12 have every selected reference verified. BD08 retains an inaccessible Olympics reference. BD01, BD02, BD04, BD05, BD06, BD07, BD09 and BD11 abstained. The mixed BDC04 control repeats BD07 and also abstained: **4/13 correct definitive occurrences and 3/13 fully verified**, with nine occurrence abstentions. It contributes zero additional unique facts. The corpus remains 12 facts, balanced 6 true/6 false, plus four controls. Admission actions match 16/16 expectations; this is separate from automatic-presentation campaign results.

## Freeze, inputs and execution record

The clean freeze is `9a5e80d88bd1d93e4a1c194d23bc1a59662af135`, scoped source SHA-256 `9de0531baa85af7bac2d1940b28c91136dce6c455bcafe24e3cf7b1d8739f9ad`. A fresh install and lint/typecheck/test gate passed **525 tests across 25 files**, followed by 36/36 development scenarios and 21/21 presentation fixtures. The original 12 heldouts remained reserved; these counts supply no additional live factual credit.

Later integration `e88b41e` passed 530 tests across 25 files plus lint/typecheck and includes a further deferred-variant fallback fix. That later change is outside this 525-test candidate09 freeze and has no live success credit from this cohort.

This freeze jointly includes validated per-target acquisition recovery, richer acquired-text retention when a shorter contained highlight arrives, sanitized per-URL status diagnostics and stream-lifecycle fixes. Provider/model/index/cache/timing differences and the joint changes prevent attributing the observed coverage difference to any one fix. Candidate08's saved BD06 `exa_content_failed`, five abstentions and two inaccessible selected citations remain unchanged. Candidate09's BD06 ended in abstention after a retained `SOURCE_NOT_AVAILABLE` 403 target diagnostic; that observation cannot reconstruct the missing underlying candidate08 status.

Inputs and expected labels are the unchanged [baseline v2 manifest](../fixtures/evaluation/live/broader-development-01/corpus/v2/live-manifest.json), SHA-256 `d10e403f76240b40e5c124644ff38643e7212339e8d6c64fb94ce73e73e81512`. The executed [wrapper](../fixtures/evaluation/live/broader-development-01/execution/run-open-development.mts) remains SHA-256 `57d1c86425ba493fd400f3a03fcf4efcb2f31ad3021ac04fcdde6f15040ccbb8`. No case, expected action, public span or privacy allowlist changed. In particular, manual incomplete BDC03 still requires terminal `needs_confirmation`.

Four batches each used the same independent caps: 16 Jev / 8 search / 12 contents attempts, 140,000 charged input tokens, 24,000 input-token reservation per pending/unknown Jev attempt, 65,536 bytes per request, 650,000 total request-body bytes and 90,000 ms wall. Batch 4 includes four eligible occurrences; no cache discount was assumed. Unknown completed input usage, unsafe capture, local/transport stop or incomplete delivery blocks further dispatch. The reserve is not a tokenizer-derived upper bound; total billing remains unknown where Jev cost is absent.

The original predispatch plan declared the exact freeze and fresh output paths. After batch 01 had started, independent review requested explicit guard equality checks against the declared freeze-file hash, commit and source hash; versioned revision 02 added them. The initial continuation guard then stopped before batch 02 because it incorrectly treated any nonempty public-span diagnostic array as an issue, even when every row had `issue:null`. Revision 03 requires an explicit null issue on each well-formed row and rejects actual, missing or malformed issues. Eleven offline checks exercised the completed batch 01 plus synthetic schema/privacy/budget/source/auth/local-stop failures. Root authorized only the unstarted batches 02–04 after independent review. **Batch 01 was preserved and never rerun**; original plan/guard bytes, the halt, review and corrections remain in the package. No case labels, budgets or source changed during this artifact-only correction. A separate prelaunch attempt stopped on an already-existing authorization file before invoking the wrapper or providers; that file remained unchanged. This was agent review within the session, not independent external protocol registration.

## Actual resource use

| Measurement | Candidate09 |
| --- | ---: |
| Provider attempts | 102: 41 Jev, 25 search, 36 contents |
| Charged input tokens | 329,197 |
| Serialized request-body bytes | 1,381,736 |
| Known partial Exa cost | $0.245 |
| Attempts with unknown billing cost | 41 Jev attempts |
| Sum of reported batch elapsed intervals | 39,806 ms |
| Unique-fact terminal median / nearest-rank P95 | 3,216.5 ms / 5,302 ms |

Every recorded provider HTTP response was 200 and 204 dispatch/settle journal rows reconcile with 102 attempts. HTTP success alone does not establish usable per-target contents; BD06's target 403 illustrates that distinction. End token/dispatch reservations were zero and all per-batch caps passed. Total cost and output-token counts are unknown. The summed batch intervals exclude the review pause and are not campaign wall time.

Latency uses all 12 unique factual typed-input terminals, including abstentions, measured from per-case harness start through correlated receipt and provider drain. The arithmetic median is 3,216.5 ms; runtime's separately defined nearest-rank P50 is 3,175 ms. All 16-input median is 2,483.5 ms. These outcome cohorts differ across runs; no speedup claim follows. All 13 factual outputs reported application `cached:false`; provider/index/CDN freshness is separate.

## Selected-source audit and limits

The [exact selected packet](../fixtures/evaluation/live/broader-development-09/citations/selected-citations.json) freezes 11 references across 11 URLs. [Original review](../fixtures/evaluation/live/broader-development-09/citations/review-v1.json) and [final review](../fixtures/evaluation/live/broader-development-09/citations/review-v2.json) retain 10 verified references and one inaccessible reference. Coverage requires every actually selected reference to verify; an unselected source does not fill a gap.

Nine selected URL/excerpt-SHA pairs exactly matched prior reviews. Eight provide reused positive source proof with original access/review times retained; Federal Register proof dates to 04:19:05 UTC and the other retained positive reviews to 04:33/04:38 UTC on 14 November 2026. No candidate09-time origin freshness is claimed for that proof. Shared provenance remains explicit: Kilimanjaro compilation and UNESCO/IUCN nomination overlap; Smithsonian histories share institution/legislation; the reef periodic report and nomination overlap; Marine Regions derives from GEBCO/ACUF. Fully verified references do not establish independent source families or full verdict-policy eligibility.

Both changed reef excerpts received bounded fresh GETs to their exact selected URLs: UNESCO document 162429 and Marine Regions MRGID 7579 returned substantive HTTP 200 bodies. Their explicit east/northeast coast descriptions establish the tested relation without relying only on coordinates. Two requests downloaded 669,925 bytes, with no redirects, retries or truncation. UNESCO returned a CDN cache hit; a fresh request is not proof of uncached origin state.

The unchanged Olympics URL had previously returned 503. A separately authorized fresh attempt used a 15 s timeout, 1 MiB limit, at most three redirects and no retry. It returned 503, an 85-byte upstream-reset body, zero redirects and 0.179451 s elapsed. The [dated observation](../fixtures/evaluation/live/broader-development-09/citations/olympics-access-02/access-observation.json) is separate from earlier failed-access records. Final review-v2 records this new failure and leaves coverage at 3/12; it never relabels the old access. No other origin was reopened in that supplement, and no project Jev/Exa call was made during citation review or packaging.

Inspection was by an independent AI agent, not a human. The repository contains bounded origin excerpts, exact selected quotes, access metadata and hashes. Full origin bodies/texts and prior raw proof remain in the external durable locations listed in [archive locations](../fixtures/evaluation/live/broader-development-09/citations/external-archive-locations.json), with hash manifests; the package does not claim to contain all raw source bytes. The separately corrected auxiliary comparator uses 0.85 substance/common-origin versus 0.8 stance and counts recorded assessments, not independent source verification or retrieval recall.

The [new package](../fixtures/evaluation/live/broader-development-09/README.md) preserves original reports/journals, validation/freeze records, guard chronology, corrected auxiliary comparison, independent citation rows and offline metrics. Original baseline/candidate08 packages and their historical documents remain byte-exact. Native/device, ASR, deployment and listening-time performance remain unmeasured by this cohort.
