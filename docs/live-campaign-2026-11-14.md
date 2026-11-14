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

## Runs 04 and 05: selected results and citation review

The [run 04 fixture](../fixtures/evaluation/live/live-development-04.json) used clean commit `66bc69b36bb88d643782c900510b899322d61f95`, source SHA-256 `d11ae679124e1e309a694505feb010c5aa0848a54e58a41714a86de023c6b35b`. The [run 05 fixture](../fixtures/evaluation/live/live-development-05.json) used clean commit `b66fa5dcbc1e4a58665bc110cb0ab1b6dccf950f`, source SHA-256 `71f6fb9504e9045763f081b885fdf63fbcccfc8b138f845953b1575b5b2072e3`; the full check at this snapshot passed 341 tests, development 36/36, and presentation 21/21. Each live run observed all eight cases and received eight terminal receipts, with no transport failures, local stops, or provider errors.

Each run returned `supported` / `qualifying_evidence` for two of the five unique public claims: the Sydney Opera House opened in 1973, and there are eight recognized planets under the IAU classification. The other three unique public claims (lightning, Oslo, first-person Helsinki) abstained as `insufficient_evidence` / `insufficient_independent_evidence`. Personal input was skipped and interim capture expired without checking. The Opera cache repeat returned the same cached result and is not a sixth claim. These two reviewed propositions in one bounded sample do not estimate general precision or accuracy.

| Run | Snapshot | Terminal cases | Definitive unique claims | Calls (Jev / search / content) | Measured Jev input tokens | Known cost and unknown cost |
|---|---|---:|---:|---:|---:|---|
| 01 | `d72c8c5` | 1/8; local stop after network error | 0/5 | 1 / 0 / 0 dispatched | 0; 24,000 reserved, usage unknown | Unknown; Jev cost unknown |
| 02 | `d72c8c5` | 8/8 | 0/5 | 15 / 8 / 0 | 84,909 | $0.056 known search cost; all 15 Jev attempts cost unknown |
| 03 | `00edd3e` | 8/8 | 0/5 | 17 / 10 / 15 | 109,816 | $0.085 known search/content cost; all 17 Jev attempts cost unknown |
| 04 | `66bc69b` | 8/8 | 2/5 | 16 / 9 / 12 | 111,951 | $0.075 known search/content cost; all 16 Jev attempts cost unknown |
| 05 | `b66fa5d` | 8/8 | 2/5 | 16 / 9 / 12 | 113,843 | $0.075 known search/content cost; all 16 Jev attempts cost unknown |
| 06 | `7e27890` | 8/8 | 1/5 | 17 / 10 / 15 | 127,158 | $0.085 known search/content cost; all 17 Jev attempts cost unknown |
| 07 | `3cfdfb1` | 9/9 | 2/5 | 17 / 9 / 12 | 115,542 | $0.075 known search/content cost; all 17 Jev attempts cost unknown |

Costs are partial in every provider campaign; unknown costs are not zero. Run 01's 24,000-token allowance is an uncertainty reservation, not measured usage. Runs 02–07 measured the listed Jev tokens and charged no unknown-token reservation. Repeated run outputs and cached results are not extra unique claims.

The [run 04 citation review](../fixtures/evaluation/live/citation-review-04.md) attempted all eight unique selected URLs for Opera and planets; the L5 cache repeat added no URLs. Seven article pages opened; the Queen Elizabeth Digital Memorial URL returned HTTP 403 and remains unverified. Both the National Museum of Australia and Sydney Opera House pages directly describe the 1973 opening. They are distinct institutions, though the museum cites the ABC/Sydney Opera House history project, so some underlying source overlap is possible; do not describe them as wholly independent primary records. For the planet claim, all five accessible selected pages state eight planets under the IAU definition. The two NASA/JPL URLs are one source family. IAU Office of Astronomy for Education, Timeanddate, and Sky & Telescope are distinct editorial families, but the classification derives from the same IAU definition. This supports the recognized-planet count under that definition, not the absence of an undiscovered planet.

The [run 05 citation review](../fixtures/evaluation/live/citation-review-05.md) reused the same eight selected URLs and the run 04 access findings, with two fresh HTTP 200 inspections for changed passage excerpts. It does not add any URL, citation, or independent corroborator. Timeanddate's excerpt extended to include the same IAU criteria; Sky & Telescope's excerpt added a Pluto/New Horizons paragraph while retaining the dwarf-planet context. Neither change altered the proposition or stated scope. The Queen Elizabeth page remained blocked, and unchanged URLs were not freshly reopened. The review found no incorrect context in the relevant accessible passages. This is a bounded source-and-passage review for two propositions, not broad factual-accuracy evidence.

## Run 06: public-development replay after extraction fixes

The [run 06 fixture](../fixtures/evaluation/live/live-development-06.json) used clean freeze `7e278906bd20e4460c431eeef4b6dd93f76a0acb`, source SHA-256 `631ec1c3f1a9330cdbd6a714cbc98059cff14d16af088169db196ec895bd823a`. The full gate passed 356 tests; the new development artifact passed 36/36 and presentation fixtures 21/21. E33/E43 measured 939/10,094 ms under parallel local checks. This snapshot included public-development-only extraction tie-break and Unicode corrections; it is not a new blind evaluation and makes no inference about any sealed set. Older run reports remain unchanged.

Run 06 completed all eight terminal receipts with no local stops, transport failures, or provider errors, but cold definitive coverage regressed to **1/5 unique eligible public claims**: the planet-count claim was `supported` / `qualifying_evidence`; Opera, lightning, mixed Oslo, and first-person Helsinki abstained as `insufficient_evidence` / `insufficient_independent_evidence`. The Opera cold claim that was supported in runs 04/05 now abstained; its L5 cached repeat reused that same abstention and is not another unique claim. Personal input was skipped and the interim capture expired without checking. Public evidence audit found that every first-pass Opera excerpt was shorter than 2,000 code points, so the new centering loop did not execute there. Retrieval and model assessments varied: the preferred NMA record's substantive confidence fell from 0.86 to 0.84, below the unchanged 0.85 gate, while two other retained sources still qualified. Policy rejected the preferred citation before using that qualifying pair. The subsequent alternate merge dropped both qualified records and ended in abstention. This identifies citation-selection and retry-retention weaknesses; it does not justify attributing the regression to centering or lowering thresholds.

Run totals were 17 Jev calls, 10 searches, 15 content fetches (42 attempts), 527,054 request bytes, 127,158 measured Jev input tokens, and 26,815 ms total elapsed. The known $0.085 consists of ten searches at $0.007 and fifteen content fetches at $0.001; all 17 Jev costs remain unknown, so total cost is partial. No unknown-token reservation was charged. Case elapsed times were Opera 4,324 ms, lightning 3,561 ms, personal 113 ms, mixed Oslo 2,920 ms, cache repeat 148 ms, planets 3,584 ms, wait expiry 8,011 ms, and first-person Helsinki 3,933 ms. The run's 1/5 result is a bounded development observation, not a precision or accuracy estimate.

The [run 06 citation review](../fixtures/evaluation/live/citation-review-06.md) found the same five selected planet URLs. Two changed windows were reopened and matched; three unchanged passage inspections were explicitly reused from the same-day earlier reviews. No new source or independent corroborator was counted.

Run 06 also retains post-evaluation presentation diagnostics for future no-result cases. Those fields do not turn an abstention into a factual outcome or revise prior artifacts.

## Run 07: integrated citation, admission and retention corrections

The [run 07 fixture](../fixtures/evaluation/live/live-development-07.json) ran once on clean freeze `3cfdfb13d8e6d37ab956e781206d892786ba441f`, full source SHA-256 `e6f36587593f39415f161a64a02f0946f4758b9a90b5c2c0ac40399adfb8de85`. The combined gate passed lint, typecheck and **429 tests**; the runtime branch passed **400**. The default evaluator remained **36/36** (34 scripted plus two injected-runtime scenarios) and presentation **21/21**; E33/E43 measured 258/10,033 ms. The live campaign appended one predeclared pure-opinion control to the existing eight requests. That makes nine requests and still five unique eligible factual claims.

All **9/9** correlated terminal receipts arrived, with zero local stops, provider errors or transport failures. All 38 dispatched provider requests returned HTTP 200; unauthorized local join/check/WebSocket probes returned 401. Opera and the planet-count claim were supported correctly; lightning, Oslo and first-person Helsinki abstained. Correct definitive coverage was **2/5**, with three abstentions and no wrong definitive label. The cached Opera repeat was supported without another search and adds no accuracy credit. This differs from run 06's 1/5 result, but fresh retrieval/model variation prevents attributing the entire difference to one change. The [offline captured-judgment replay](../fixtures/evaluation/live/citation-fallback-replay.md) separately isolates the citation-selection correction using identical public evidence and model scores; it is not a live result.

The personal control was skipped, the automatic incomplete capture waited then expired, and the new synthetic preference control was skipped as `not_eligible_public_fact` with a manual `respond` presentation. The preference took 98 ms, one Jev admission and zero Exa calls; it did not ask for clarification. Personal input and the cached repeat each used one admission and zero Exa calls; wait expiry used no providers. Mixed input exported only the exact public Oslo sentence. All admitted/result spans matched the predeclared allowlist, and the report contains no raw private input, full mixed input, provider prompts or configured credential value.

Actual attempts were **17 Jev / 9 search / 12 contents**: **476,147 request bytes**, **115,542 measured Jev input tokens**, zero unknown token reservations, and **24,575 ms** elapsed. Known cost was **$0.075**, partial because 17 attempts lacked cost. No limit was raised: 24 Jev / 12 search / 18 contents, 180,000 input-token stopping threshold, 24,000 pending-token reservation, 65,536 single-request bytes, 1,000,000 total bytes, and 150 seconds. The reservation is not a guaranteed input upper bound.

The [run 07 citation review](../fixtures/evaluation/live/citation-review-07.md) found retained records for every selected ID: nine references including the cached repeat, seven unique URLs. All seven were freshly attempted; six opened and were relevant, while the Queen Elizabeth memorial returned HTTP 403 and remains unverified. Opera's selected sources are the operator and memorial, so only **one selected Opera source family was independently opened**. The retained but unselected NMA source does not fill that selected-source verification gap. The five planet references represent four source families and share the IAU definition; NASA/JPL are one family. The five planet excerpt hashes match run 06. Opening through a connected service does not guarantee direct-origin freshness or constitute human demo sign-off.

Remaining development abstentions are substantive evidence limitations: lightning lacks sufficiently confident source/origin evidence under its stronger route; Oslo's final passages are bare assertions or unclear; Helsinki's retained original-record confidence was 0.73. The code does not lower thresholds or grant truth from official status to force these examples through. The freeze stayed clean before and after. Report SHA-256: `08568d66d77d0fd234bc66b3a4d8ab7afbcca67e4aa2e85dbb8cb89a5b090695`.

## Evidence boundary

The records establish that the listed authenticated requests and terminal WebSocket events were observed, that cache/wait/private-isolation paths behaved as recorded, and that the tested invalid-key paths stopped with sanitized terminal errors. Runs 04 and 05 also establish bounded selected-citation correspondence for seven accessible pages on two propositions, with one selected page blocked. They do **not** establish general fact-checking accuracy, general private-query leakage rates, total campaign cost, or native app/glasses behavior. Run 01 remains a failure to complete; runs 02 and 03 remain transport and orchestration evidence with 0/5 definitive coverage; runs 04 and 05 have 2/5 definitive unique-claim outcomes each; run 06 has 1/5, with the public Opera regression diagnosed as the citation-selection/alternate-retention chain above. Run 07 has 2/5 correct definitive unique-claim outcomes and the explicit selected-citation access limitation above. No general accuracy estimate is asserted.
