# Cloud handoff: fact-checking backend

Continue from the current remote state; fetch before changing anything. Preserve local edits. Do not merge PRs or close issues. The backend is substantially hardened, but its measured factual coverage is insufficient for a readiness claim.

## Repository and review stack

Repository: https://github.com/erick-dsnk/junction-2026

1. #31 / #16 / `codex/16-retrieval-stack`
2. #32 / #17 / `codex/17-source-quality-stack`
3. #33 / #15 / `codex/15-classification-stack`
4. #34 / #24 / `codex/24-runtime-evaluation-stack`
5. #35 / #20 / `codex/20-runtime-stack`
6. #36 / #24 / `codex/24-live-evaluation-stack`

The sixth draft follows #35 because the live evaluator depends on its retry and alternate-retrieval interfaces. Later merges preserve issue-specific dependencies without force-pushing. Follow-up #17/#15 fixes are not yet combined or live-validated, as described below. Review owner is water / erick-dsnk; intended reviewer is grass / Davidtzuke. No review notification was requested. PR #28 was already merged.

Read `AGENTS.md`, `docs/plan.md`, `apps/console/README.md`, `packages/contracts/README.md`, `docs/evaluation.md`, `docs/live-campaign-2026-11-14.md`, `docs/blind-evaluation-2026-11-14.md`, current issues and PRs before acting. The existing shared app/API schemas, `packages/contracts/`, `apps/ios/` and `services/api/src/input/asr/` are frozen. Glasses, native decoding, actual ASR, deployment and device measurements remain deferred.

## Frozen implementation and validation

The earlier live citation replays used clean commit `b66fa5dcbc1e4a58665bc110cb0ab1b6dccf950f`, source SHA-256 `71f6fb9504e9045763f081b885fdf63fbcccfc8b138f845953b1575b5b2072e3`, with 341 tests passing. The latest completed public-development freeze is `7e278906bd20e4460c431eeef4b6dd93f76a0acb`, source SHA-256 `631ec1c3f1a9330cdbd6a714cbc98059cff14d16af088169db196ec895bd823a`; it includes an extraction tie-break and Unicode evidence-window correction. Its full gate passed **356 tests**, development **36/36**, and presentation **21/21**. E33/E43 were 939/10,094 ms under parallel local checks. Check the exact remote head rather than assuming this is the final code or documentation snapshot.

The first five predecessor branch gates passed **185 / 261 / 283 / 283 / 321** tests respectively. Their exact commits and counts are in `fixtures/evaluation/live/final-stack-validation.json`. The live branch snapshot at `b66fa5d` passed 341, and the latest completed freeze at `7e27890` passed 356. Exact validation artifacts preserve each snapshot. A harness-reporting change also records presentation fields on future non-result events; it does not retrospectively enrich earlier live reports.

- The durable live runner is `apps/console/src/live/run.ts`; preview with `npm run evaluate:live -- --plan`. Its original 20 offline harness checks cover separate budgets, actual attempts, unknown usage, retries, content fetches, local stops, correlated terminals, cancellation, waiting/expiry, cache counters and authentication. Nine later checks cover non-result presentation projection and terminal feedback.
- The original 12 reserved bodies remain byte-for-byte unchanged and unrun. Their earlier possible-exposure caveat remains; do not use them for blind accuracy claims or tuning.

## Current live evidence

The latest authenticated development replay at `7e27890` completed 8/8 terminal receipts but returned a cold definitive result for only **1/5 unique eligible public claims**. The planet-count claim was supported; Opera, lightning, Oslo and first-person Helsinki abstained. This is a regression from the 2/5 results at runs 04/05, where Opera and planets were supported. The cached Opera repeat is not an additional unique claim. Public-run diagnostics identify a preferred-citation quality veto followed by retry merge evicting Opera's otherwise qualifying pair; a retention correction is in progress and awaits independent safety review. Do not present run 06 as evidence that the correction is fixed. The run's usage and partial costs are recorded in `docs/live-campaign-2026-11-14.md`; Jev cost remains unknown.

Runs 01–03 remain preserved: run 01 ended after a network failure and unknown usage reservation; runs 02/03 completed transport but had 0/5 definitive coverage. Separate invalid-key probes each produced one HTTP 401 from the target provider and sanitized terminal authentication error, without retry.

The run 04/05 independent citation review attempted all eight unique development URLs: seven pages opened with relevant passages, and one Queen Elizabeth memorial URL returned 403 and remains unverified. NASA/JPL URLs share one family; NMA references an Opera House history project, so distinct narratives are not proven independent primary records. Run 05 rechecked two changed passage excerpts only; it added no URL or independent corroborator. Human demo citation sign-off remains outstanding.

Two fresh, independent sealed factual sets have now been executed once each, at different code freezes. The first remains **2/8 correct definitive**, five abstentions and one clarification without factual verdict. The second produced **4/8 correct definitive**, zero wrong definitive, four abstentions, 9/10 semantic admission, and 9/9 independently reopened selected citations relevant. Conditional precision was 4/4, excluding the four unresolved eligible facts. These small purposive sets are separate: do not pool or compare their difference as a causal improvement. The first and second aggregate reports are [`docs/blind-evaluation-2026-11-14.md`](blind-evaluation-2026-11-14.md) and [`docs/blind-evaluation-2026-11-14-02.md`](blind-evaluation-2026-11-14-02.md); the second aggregate JSON is `fixtures/evaluation/live/blind-second-run-summary.json`. Case bodies and detailed reviews remain sealed. The follow-up #17/#15 changes below have not been evaluated on a new blind set.

## Next backend work

1. Verify current repository/CI state and the evidence records. Keep actual provider evidence separate from scripted tests; do not describe transport completion as factual success.
2. Finish the in-progress retention correction and its independent safety review. The #17 citation-selection fallback at `893e95965e12a60ab3f94558b7b0806493291a3b` and #15 opinion guard at `77c12e4254ce2520f76b7582bd3287875b0d1cc6` have been reviewed and gated individually, but have **not** yet been combined or validated in a live campaign. The added ninth opinion case belongs to the next authenticated live campaign, not the default fixture evaluator.
3. Combine those changes on one exact freeze, run the full gate and the default development evaluation (which remains 36 cases), then run the bounded authenticated campaign with nine typed requests and the same five unique eligible factual claims. Do not describe any of these fixes as live-validated before that campaign completes and its evidence is recorded.
4. Preserve exact admitted public text, private-query isolation, Unicode spans, source-family/copy grouping, risk-sensitive corroboration, authenticated terminal delivery and all budget/cancellation gates.
5. Evaluate precision and useful coverage together. Missing priority stays silent; selected topics are explicit normalized literal matches in admitted text, not inferred categories.
6. The third fresh set has already been independently reviewed and sealed. After the combined code freeze and public/live checks, record its exact source hash and execute that prepared set once. Preserve both prior blind reports and denominators; do not create another set, rerun or pool either set.
7. Keep each issue's changes and dependencies reviewable, run appropriate branch gates, record exact tested commits, update PR descriptions and retain all drafts until acceptance is supported. No merges or issue closures without fulfilled criteria and the human reviewer.

## Environment

Use Node 24 LTS (or supported Node 22.12+ for ordinary local use). Read provider secrets from the cloud environment, never chat or committed files. `JEV_API_KEY`, `EXA_API_KEY`, `ELEVENLABS_API_KEY` and `DEEPGRAM_API_KEY` were present; only Jev and Exa belong to this work scope.

This cloud requires its configured outbound proxy. On Node 24 run live commands with `NODE_USE_ENV_PROXY=1`. The harness generates a temporary local join code and future expiry itself; it does not need a committed `.env`. For interactive server setup use `.env.example` and a future `DEMO_JOIN_EXPIRES_AT`.

Each live run requires a new writable output path and its own explicitly bounded budget. The token threshold cannot retroactively cap a request: a completed unknown Jev usage blocks further dispatch, and returned usage exceeding a reservation is charged and stops the run. Partial costs stay partial. Never print keys or proxy credentials.
