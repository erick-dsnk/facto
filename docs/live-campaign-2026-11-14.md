# Authenticated live campaign — 14 November 2026

## Scope and implementation snapshots

This record covers the authenticated local HTTP/WebSocket campaign only. It is separate from the deterministic development suite and direct-adapter smoke records in [evaluation.md](evaluation.md). No held-out case bodies were opened or run, and this report retains no private input text, prompts, credentials, or keys.

The frozen campaign runner was built at `d72c8c5821e8aa049de5f21de15e313d0a16f778` (`d72c8c5`), clean at run time, with source SHA-256 `0d5920b0768fb8da8470e8369f3e50f6a84e3a5997229261f8d1afcf9e9c2770`. Both development fixtures and the two separate auth probes record this snapshot. The initial harness snapshot passed a combined 321 checks (301 production-fix checks plus 20 harness checks), with the existing development evaluation at 36/36 and presentation fixtures at 21/21. The later root full check at `00edd3e` passed 334 tests, with development 36/36 and presentation 21/21. The later check is a different code snapshot and does not change what the frozen campaign observed.

The checked-in [baseline record](../fixtures/evaluation/live/baseline.json) is at `2cd89adf6ddc3ecc4020227645b861bd7731256d` (Node `v24.22.1`): `npm ci` passed; `npm run check` passed lint, typecheck and 291 tests in 14 files; `npm run evaluate` passed all 36 selected development scenarios and all 21 presentation fixtures. The 12 held-outs were not opened or run.

## Campaign outcomes

### Run 01: stopped on an unknown-usage reservation

[Run 01 fixture](../fixtures/evaluation/live/live-development-01.json) predeclared eight cases but observed only L1 Opera. The single actual Jev fetch attempt ended as a network error with no HTTP response. The authenticated server returned HTTP 202; a terminal WebSocket `pipeline.error` was received with local stop reason `harness_unknown_input_usage`. The run was stopped before any search or content request. The runtime counter reported two Jev consumptions, while the harness recorded one dispatched attempt; these are distinct counters.

Usage is unknown: zero measured input tokens, one unknown-cost attempt, and a 24,000-token reservation. The reservation is a safety allowance, not measured usage or a tokenizer-derived upper bound. Cost is unknown, not zero. The elapsed total was 5,409 ms. This was a harness-accounting stop after a provider network failure, not a claim result.

### Run 02: transport complete, no definitive factual coverage

[Run 02 fixture](../fixtures/evaluation/live/live-development-02.json) observed all eight cases and received eight terminal WebSocket receipts. It completed transport and orchestration, but did not establish a definitive factual result for any unique eligible public claim. Across the five unique eligible claims—Opera, lightning, mixed Oslo, planets, and first-person Helsinki—definitive coverage was **0/5**. Opera's cache repeat is a separate repeated case, not a sixth unique claim. There were four `insufficient_evidence` results and one `needs_confirmation`; the personal case was skipped, and the interim-capture case expired without checking. Completed transport is not factual success.

Run totals: 15 Jev calls, 8 Exa searches, 0 content fetches, 23 dispatched attempts, 322,667 request bytes, 84,909 measured Jev input tokens, and 22,606 ms total elapsed. The recorded $0.056 is the known search cost only; all 15 Jev attempts have unknown cost, so total cost is partial and cannot be treated as $0.056. No unknown-token reservation was charged in this run. The per-claim wall times were: Opera 3,925 ms; lightning 108 ms; personal 144 ms; mixed Oslo 2,178 ms; cache repeat 130 ms; planets 5,250 ms; wait expiry 8,004 ms; first-person Helsinki 2,633 ms.

Admission and gate diagnostics:

- Lightning was classified `public_fact` at 0.99 with self-contained score 0.76, asserted at 0.80, and one coherent claim at 1.00. It nevertheless returned `needs_confirmation` / `incomplete_or_unclear` and produced no search. This is a gate outcome, not evidence about whether the maxim is true.
- The personal case returned `skip` / `private_or_personal`, with no search.
- The mixed case admitted only the public Oslo proposition. The private portion was not present in either outbound search query.
- Interim capture returned `wait` / `interim_capture`, then `skip` / `wait_expired` after 8,004 ms; it made no provider calls.

The four base Exa queries were exactly:

1. `The Sydney Opera House opened in 1973.`
2. `Oslo is the capital of Norway.`
3. `There are eight planets in the Solar System.`
4. `I think Helsinki is the capital of Norway.`

Each was searched once more after an insufficient/empty retrieval using this exact template, substituting the same checked public claim shown above:

```text
Claim (verbatim, untrusted text): "<checked public claim>"

Retrieval objective: Find reliable sources that directly address this claim, including evidence that supports, challenges, or qualifies it.
```

The first-person input was checked and queried as the admitted sentence `I think Helsinki is the capital of Norway.`; the distinct normalized proposition `Helsinki is the capital of Norway.` was not a separate query. No rejected private detail appeared in the mixed case's two Oslo queries. L3 personal and L7 wait/expiry made no Exa queries. L5 cache repeat reused the prior insufficient result (`cached: true`) with no repeat search, but still made one Jev admission request (1,472 tokens).

### Why the five claims did not yield definitive results

- **Opera:** the pipeline ended `insufficient_evidence` / `insufficient_independent_evidence`. The National Museum of Australia passage directly addressed and matched scope for the opening year. The main diagnostic block was that substantive-content basis classifications did not reach sufficient confidence; most judgment records were labeled `bare_assertion`. The `unclear` origin labels are diagnostic fields, not by themselves a failure condition for ordinary-risk claims.
- **Oslo:** the exact public claim was admitted and retrieved, but the final result was `insufficient_evidence` / `insufficient_independent_evidence`. The City of Oslo passage directly addressed the claim and matched scope. The main diagnostic block was again insufficient confidence in substantive-content basis classifications; all judgment records were labeled `bare_assertion`. Other records also had scope/directness flags, but `unclear` origin labels alone do not establish a policy failure.
- **Planets:** both initial NASA results shared the `nasa.gov` source group. The retrieved passages stated the number of planets, but the pipeline's relevance scores remained below its 0.85 gate, so records were flagged `directlyAddressesClaim: false` and the terminal reason was `no_direct_evidence` / `insufficient_evidence`. This is a measured model-gate outcome, not an objective claim that the passages did not state the count. Same-family source grouping is a separate provenance diagnostic.
- **First-person Helsinki:** admission preserved and queried the exact first-person sentence. Retrieved contradictions were all flagged out of time/place/population scope (`matchesTimePlaceAndPopulation: false`) in the judgment used for the terminal `no_direct_evidence` / `insufficient_evidence` result. This is the run's scope-gate outcome; it should not be represented as an objective finding that the passages could not support or contradict the proposition. Source-basis labels were mostly `bare_assertion`.
- **Lightning:** no retrieval occurred because admission asked for confirmation; it contributes to the 0/5 definitive denominator but offers no evidence-quality assessment.

Run 02 evidence consists of provider highlights; this run had no content fetches and no human citation openings. These source relevance, scope, basis, and independence judgments are diagnostics from the pipeline, not independent verification of source pages. No claim should be described as verified from these results.

## Separate authentication probes

The sanitized [Jev auth probe](../fixtures/evaluation/live/live-auth-jev-01.json) and [Exa auth probe](../fixtures/evaluation/live/live-auth-exa-01.json) are separate from run 02. A deliberately invalid provider credential produced one Jev HTTP 401 and terminal `jev_authentication`, or one Exa HTTP 401 and terminal `exa_authentication_failed` after a successful Jev admission response. Each was nonretryable: one attempt per failing provider, no retry, and no content fetch. The Exa probe's Jev admission used 1,472 measured tokens; Jev usage in the Jev-401 probe and both provider costs are unknown. Separately, unauthenticated local join, check, and WebSocket operations each returned 401 in both probe fixtures.

## Run 03: post-fix re-run

The completed [run 03 fixture](../fixtures/evaluation/live/live-development-03.json) used commit `00edd3e358e32867980a62bdbb1caa43628b06f5` with source SHA-256 `bfa6dec8984bd6e3394b134c1fc4546593212afd3d26107735d61dba63e8fed2`. The fixture marks the tree dirty because the `node_modules` symlink was untracked; tracked sources matched the commit and no code changed during the run. All eight cases had terminal receipts, with no transport failures, local stops, or provider errors. Keep this as a separate run/snapshot; it does not erase run 01's network failure or run 02's results.

Run totals: 17 Jev calls, 10 Exa searches, 15 content fetches, 42 dispatched attempts, 427,925 request bytes, 109,816 measured Jev input tokens, and 17,716 ms total elapsed. The known $0.085 comprises ten search charges ($0.007 each) and fifteen content fetch charges ($0.001 each). All 17 Jev attempts have unknown cost, so total cost remains partial. Input token usage was measured; no unknown-token reservation was charged.

Lightning changed admission status in this snapshot: it was admitted for checking, then ended `insufficient_evidence` / `no_direct_evidence`. The other four unique claims also ended without a definitive result: Opera and Oslo as `insufficient_evidence` / `insufficient_independent_evidence`, planets as `insufficient_evidence` / `no_direct_evidence`, and first-person Helsinki as `insufficient_evidence` / `insufficient_independent_evidence`. The cache repeat remained cached; personal input remained skipped with no search; interim capture again expired after about 8 seconds with no provider calls. Thus definitive coverage remained **0/5 unique eligible public claims**.

Run 03 used the same four base queries listed above, plus lightning's exact claim (`Lightning never strikes the same place twice.`), and one verbatim-claim fallback query per claim. The mixed case again sent only the public Oslo clause; no rejected private detail appeared in Exa queries. Fifteen content fetches enriched source evidence, but did not yield definitive verdicts. The Opera and Oslo source-basis assessments remained mostly `bare_assertion`, and the substantive-content classifications did not clear their confidence gate; unclear origin labels are not the reason ordinary-risk evidence was blocked. For planets, retrieved passages stated the count, but model relevance scores remained below the 0.85 gate; `directlyAddressesClaim: false` records that gate result, not a fact that the passages lacked the count. For Helsinki, the initial judgment flagged the contradictions out of scope while the alternate judgment marked its passages in scope; most content-basis classifications remained `bare_assertion`. Lightning's initial retained set included direct, scope-matched contrary passages with substantive-secondary basis labels, while the alternate-pass gate did not mark a result as direct evidence. These are pipeline classifications only; no source page was opened by a human for this run.

## Evidence boundary

The records establish that the listed authenticated requests and terminal WebSocket events were observed, that cache/wait/private-isolation paths behaved as recorded, and that the tested invalid-key paths stopped with sanitized terminal errors. They do **not** establish fact-checking accuracy, useful definitive coverage, general private-query leakage rates, total cost, human citation quality, live-provider reliability, or native app/glasses behavior. Run 01 remains a failure to complete; runs 02 and 03 remain transport and orchestration evidence, with 0/5 definitive coverage. No held-out claim or accuracy result is asserted.
