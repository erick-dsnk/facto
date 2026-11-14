# Observed public acquisition differences: baseline vs candidate08

All four baseline reports use commit `3cfdfb13d8e6d37ab956e781206d892786ba441f`;
all four candidate08 reports use `aefb9e7c5f0f3d0e332eea5d8748878b3f6cf75c`.
The 16 declared public plans match. These are repeated OPEN development runs,
with possible source/index/cache/model variation, not causal evidence or a
held-out accuracy estimate. No additional provider calls were made to compare
them. Each input report and the offline script have recorded SHA-256 hashes in
`comparison.json`.

“Qualified” here is a recorded-assessment measurement, not an independently
verified source or complete verdict-policy result: directness and scope must be
true, stance confidence at least 0.8, and the recorded substantive-source
assessment confidence at least 0.8. Acquisition-stage values are linked to the
following judgment only for identical source-content fingerprints. Retained
records are capped application outputs, not the entire raw result pool.

| Public case | Observed engine transition | Last observed qualified / retained, baseline → candidate |
| --- | --- | --- |
| BD01 Great Fire | insufficient → supported | 1/6 → 2/6 |
| BD02 Magna Carta first issue | insufficient → insufficient | 0/6 → 1/6 |
| BD03 Kilimanjaro | insufficient → supported | 0/6 → 3/6 |
| BD04 Baikal | insufficient → insufficient | 1/6 → 1/6 |
| BD05 SI second | insufficient → insufficient | 2/3 → 1/4 |
| BD06 gold symbol | insufficient → operational `exa_content_failed` | 0/6 → 1/5 before failure |
| BD07 Panama Canal | supported → supported | 3/5 → 2/5 |
| BD08 first modern Olympics | insufficient → contradicted | 2/4 → 3/6 |
| BD09 UNESCO Constitution | supported → insufficient | 2/3 → 0/6 |
| BD10 Smithsonian | contradicted → contradicted | 2/4 → 4/4 |
| BD11 | admission changed; candidate insufficient | no baseline judgment → 1/5 |
| BD12 Great Barrier Reef | insufficient → contradicted | 0/6 → 4/6 |

The three exclusion controls have no acquisition stages in either run. The
Panama repeat control remains supported and repeats a fact already present in
BD07; it is not an additional independent fact. BD11's changed admitted span
blocks numeric acquisition deltas. BD06's last judgment is not a completed
factual result. Its provider response was HTTP 200 followed by a parser error;
the raw per-URL status/tag was not retained, so the historical failure remains
unclassified. Later handling changes must not relabel this frozen observation.

The candidate's alternate sources are often different, but not uniformly
stronger. BD03 adds a WCMC national-park document, a UNESCO document and a
bryophyte specimen record assessed as original records. BD08 adds Olympic
historical/library records instead of the baseline's trivia statement and
fabricated Paris winter-games page. BD12 adds UNESCO documents, a historical
Nature article and a Marine Regions gazetteer record. These are observed source
and assessment changes; they still require provenance, scope and independence
inspection. A document's institutional host or research methods do not prove
every background assertion it contains.

BD09 is a useful limit on a simple “better extraction” explanation. The
candidate's initial UN Treaty Collection highlight and alternate page-text
excerpt are the same 2,000 code points, retaining the Constitution title,
London 16/11/1945 conclusion field, separate 4 November 1946 entry-into-force
field, depositary and UNTS volume. The first judgment marks directness true;
the second marks it false while continuing to classify the source as an
original record. That record's loss of qualification is not explained by
excerpt clipping. The surrounding joint evidence, content-basis label and
model variability are possible contributors; this comparison does not isolate
them or justify relaxing a threshold.

Observed resource totals also differ:

| Resource | Baseline | Candidate08 |
| --- | --- | --- |
| Searches | 20 | 23 |
| Contents calls | 23 | 28 |
| Jev calls | 36 | 38 |
| Request bytes | 995,358 | 1,193,356 |
| Measured input tokens | 244,053 | 284,863 |
| Known partial provider cost | $0.163 | $0.215 |

These totals include changed admission, extra retrieval/rejudgment and an early
operational stop. Unknown provider costs remain unknown; the displayed costs
are not total billing. Reports preserve exact search-query text and candidate
objective/highlight hashes but not full wire request options. Missing options
are explicitly `not_retained`, rather than inferred as observed.

Per-stage basis/provenance/directness/scope, identical-content assessment
links, recorded source families, alternate group/URL churn, query hashes and
attempt costs are in `comparison.json`. Distinct source groups do not prove
independence, and cached extraction/provider HTTP success does not prove current
origin access or freshness.
