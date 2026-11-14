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

The sixth draft follows #35 because the live evaluator depends on its retry and alternate-retrieval interfaces. The latest branch includes all changes; later merges preserve issue-specific dependencies without force-pushing. Review owner is water / erick-dsnk; intended reviewer is grass / Davidtzuke. No review notification was requested. PR #28 was already merged.

Read `AGENTS.md`, `docs/plan.md`, `apps/console/README.md`, `packages/contracts/README.md`, `docs/evaluation.md`, `docs/live-campaign-2026-11-14.md`, `docs/blind-evaluation-2026-11-14.md`, current issues and PRs before acting. The existing shared app/API schemas, `packages/contracts/`, `apps/ios/` and `services/api/src/input/asr/` are frozen. Glasses, native decoding, actual ASR, deployment and device measurements remain deferred.

## Frozen implementation and validation

Executable code was frozen at `b66fa5dcbc1e4a58665bc110cb0ab1b6dccf950f`; the campaign's source snapshot SHA-256 is `71f6fb9504e9045763f081b885fdf63fbcccfc8b138f845953b1575b5b2072e3`. Subsequent commits propagate the same fact-checking code and add documentation/artifacts. A post-evaluation harness-only change preserves validated action/reason fields on future non-result events; it changes no runtime behavior and does not enrich or rerun the frozen evidence. Check the exact remote head rather than assuming this is the final documentation commit.

- Fresh installs succeeded. The frozen combined gate passed lint, typecheck and **341 tests**; the subsequent harness-reporting gate passed **350 tests**.
- Development evaluator: **36/36** (34 scripted + 2 authenticated local HTTP/WebSocket scenarios with injected providers); presentation fixtures **21/21**. The refreshed JSON is committed.
- Final five predecessor branch gates passed **185 / 261 / 283 / 283 / 321** tests respectively. Their exact commits and counts are in `fixtures/evaluation/live/final-stack-validation.json`.
- The durable live runner is `apps/console/src/live/run.ts`; preview with `npm run evaluate:live -- --plan`. Its original 20 offline harness checks cover separate budgets, actual attempts, unknown usage, retries, content fetches, local stops, correlated terminals, cancellation, waiting/expiry, cache counters and authentication. Nine later checks cover non-result presentation projection and terminal feedback.
- The original 12 reserved bodies remain byte-for-byte unchanged and unrun. Their earlier possible-exposure caveat remains; do not use them for blind accuracy claims or tuning.

## Current live evidence

The final development replay completed 8/8 authenticated requests, with 16 Jev calls, 9 searches, 12 content fetches and 113,843 measured Jev input tokens. It returned correct definitive results for **2/5 unique eligible public claims**, with three abstentions; the cache repeat is excluded from that denominator. Known Exa cost was $0.075; Jev cost remains unknown. The personal case never searched, the mixed case exported only the exact public span, the repeat was cached without a new search, and incomplete capture expired after approximately eight seconds without a verdict.

The earlier connection failure and two zero-coverage campaigns are preserved, not replaced. A Node direct-fetch connection failure left one attempt's usage unknown; its 24,000-token allowance is an uncertainty reservation, not measured usage. Real separate invalid-key probes each produced one HTTP 401 from the target provider and the sanitized terminal authentication error, without retry.

Independent agent citation review attempted all eight development citation URLs: seven opened with matching relevant passages; one Queen Elizabeth memorial page returned 403 and remains unverified. NASA/JPL URLs share one family; NMA references an Opera House history project, so distinct published narratives are not proven independent primary records. Human demo citation sign-off is still outstanding.

The newly authored independent 10-case set was reviewed, sealed and executed **once** against the frozen code. It produced 10/10 terminal receipts and **2/8 correct definitive factual outcomes**, five abstentions and one missing verdict. Conditional definitive precision was 2/2, admission 8/10, and no forbidden-private query was observed in 12 searches. This small purposive sample exposes a substantial coverage/admission gap; it is not a population accuracy estimate or readiness pass. The full first-run report, journal and case bodies remain sealed outside the PR; public aggregates, methodology and hashes are committed. Do not inspect or tune against the sealed case bodies. No code was changed in response to them.

## Next backend work

1. Verify current repository/CI state and the evidence records. Keep actual provider evidence separate from scripted tests; do not describe transport completion as factual success.
2. Improve source acquisition and admission on independently authored **development** cases without consulting sealed bodies. Seek inspectable underlying records and attributable evidence, not simply more agreeing websites. Do not add source/domain exceptions or lower thresholds to force examples through. Official status alone never establishes truth.
3. Preserve exact admitted public text, private-query isolation, Unicode spans, source-family/copy grouping, risk-sensitive corroboration, authenticated terminal delivery and all budget/cancellation gates.
4. Evaluate precision and useful coverage together. Missing priority stays silent; selected topics are explicit normalized literal matches in admitted text, not inferred categories.
5. Freeze future changed code and commission a new independent set before another blind run. Retain this first run's failures and denominators. The existing sealed set must not be rerun as fresh blind evidence.
6. Keep each issue's changes and dependencies reviewable, run appropriate branch gates, record exact tested commits, update PR descriptions and retain all drafts until acceptance is supported. No merges or issue closures without fulfilled criteria and the human reviewer.

## Environment

Use Node 24 LTS (or supported Node 22.12+ for ordinary local use). Read provider secrets from the cloud environment, never chat or committed files. `JEV_API_KEY`, `EXA_API_KEY`, `ELEVENLABS_API_KEY` and `DEEPGRAM_API_KEY` were present; only Jev and Exa belong to this work scope.

This cloud requires its configured outbound proxy. On Node 24 run live commands with `NODE_USE_ENV_PROXY=1`. The harness generates a temporary local join code and future expiry itself; it does not need a committed `.env`. For interactive server setup use `.env.example` and a future `DEMO_JOIN_EXPIRES_AT`.

Each live run requires a new writable output path and its own explicitly bounded budget. The token threshold cannot retroactively cap a request: a completed unknown Jev usage blocks further dispatch, and returned usage exceeding a reservation is charged and stops the run. Partial costs stay partial. Never print keys or proxy credentials.
