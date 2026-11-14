# Public acquisition diagnostic 01

This acquisition-only run uses the three already-public checked propositions in
`live-development-07.json`: lightning, Oslo, and the Helsinki/Norway assertion.
Only `claim.result.checkedPublicText` matching each case's `admittedPublic` was
used as input. No private evaluation body or engine judgment was read or emitted
by the diagnostic. No production source gate or confidence threshold changed.

Before dispatch, the plan declared at most six searches, nine contents calls,
zero Jev calls, two searches/three contents per proposition, 256 KiB per request
and response, 1 MiB aggregate request bytes, and 60 seconds total wall time.
Actual cumulative use: **6 searches, 9 contents, 0 Jev; 10,633 request bytes and
263,236 response bytes**. The largest response was 38,743 bytes. Each claim used
two searches and three contents requests.

The original plan started at `2026-11-14T04:13:34.594Z`. A strict diagnostic
validator mistakenly expected the older contents field `ids`; installed
`exa-js@2.28.0` actually serializes `urls`. It stopped after the first successful
search and before any contents dispatch. That failed first segment is preserved
unchanged in [public-acquisition-01](../public-acquisition-01/plan.json), including
its stop and raw response. The validator was corrected, then this segment
replayed that saved search response without another provider call. Its plan
started at `04:14:17.780Z`; execution took 14,068.648 ms. Original-plan-to-finish
wall time was approximately **57,254.648 ms**, within the original 60-second cap.
No additional diagnostic campaign was run. The first attempt's raw files remain
in the sibling first-segment directory; this summary includes that attempt in
cumulative totals.

Every actual attempt has a durable pre-dispatch reservation and exact public
request/response body files, byte counts and SHA-256 hashes. API keys, headers and
private inputs were not recorded. `plan.json` records the acquisition source
hashes used for dispatch. A later sentence-regex hardening was verified with
[offline-replay-final.json](offline-replay-final.json): all 15 saved responses reproduce the
same initial, alternate and retained records, excluding retrieval timestamps,
with zero network calls. Its source hashes identify the final implementation.

The results show a narrow preservation improvement, not general retrieval or
verdict accuracy. The municipal page retains its opening city/country statement
and title. The PCGN factfile retains its country heading, Capital row and nearby
mapping-policy provenance. Lightning still mostly retrieves myth explanations,
student prose and an attributed book/FAQ exposition; the research observations
found separately through connected research were not discovered by this run.
TERMIUM retains record identity and Capital field but loses distant sources.
An alphabetical capitals-list slice loses the requested relation. Method-bearing
water/geology documents mention administrative facts incidentally; their research
methods do not establish those background facts.

All nine contents results report `source: cached`. Provider HTTP 200 is not
current origin access or freshness evidence. Eleven of 18 retained records are
still highlights. Requested highlight limits are not hard guarantees: one first
search highlight contained 6,313 characters despite `maxCharacters: 4000`; the
independent streamed 256-KiB response cap remains enforced.

The [independent review](independent-review/review.md) verified all 30 raw
request/response hashes and byte counts, all seven retained page-text passages'
exact contiguous provenance, and the 2,000-code-point bound for all 18 records.
It also identifies shared origins, missing keepers/updates, irrelevant relation
selection and limited accessibility evidence. That review made no provider calls
and saw no private cases or engine verdicts. Domain diversity and null echo
groups do not prove independence; no definitive-result claim follows from this
acquisition record.
