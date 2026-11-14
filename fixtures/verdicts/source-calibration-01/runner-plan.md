# Public source-basis experiment runner

Candidate commit: `2e60d90` in `/workspace/stack-17`. Production remains unwired.

The first comparison schedules all 48 predeclared core units once per arm, in
identical six-unit batches: 16 actual Jev attempts maximum. The separately
preserved eight genuine boundary units are not included. No retries or second
passes are allowed. Three independently disputed core labels remain scheduled
but are excluded from primary metrics and reported with sensitivity bounds.

Baseline extracts the actual current seven-way content-basis question through an
offline `createJudge` request capture. Both arms receive exactly the same state
and retained bytes. Only the baseline's unit-scoping prefix is added. This is an
isolated rubric comparison, not a measurement of the production joint judge or
end-to-end factual coverage. Candidate genre is diagnostic; its content pass
requires `substantive` and P(substantive) >= .85. Production directness, scope,
risk, origins, copied families, privacy and corroboration gates are untouched.

`prepare` requires frozen adjudication with `frozen:true` and
`independentReviewComplete:true`. It validates each label's exact retained span
and source-family split, then saves complete request bodies, template hashes,
code hashes, input/label hashes and the fixed limits before any provider calls.
`execute` rechecks those hashes and refuses an existing output directory.

Limits: 16 consumed Jev attempts, 0 Exa calls, 150,000 measured input tokens with
24,000 pending reserve before each call, 65,536 bytes/request, 1 MiB total request
bytes, 120 seconds wall time. Unknown or invalid usage fails closed; the attempted
unit result/failure remains durable and subsequent calls stop. The reserve is a
pre-request admission rule, not a provider-enforced token cap; unexpected measured
overrun is reported and stops the campaign. Actual consumed attempts, started
fetches, bytes, input tokens, unknown-usage counts and partial failures are logged.
Jev USD remains unknown; Exa cost is zero.

Each attempt is preceded by a flushed JSONL journal entry. Responses, failures and
the final split-specific confusion matrices are persisted without silent reruns.
Development and validation metrics remain separate; missing/failed units remain
visible. Strata and probability bins are descriptive small-sample diagnostics.

Offline checks:

```sh
node --import /workspace/stack-17/node_modules/tsx/dist/loader.mjs --test /workspace/task-evidence/source-calibration/runner.test.ts
```

Preparation (after final filenames are confirmed):

```sh
node --import /workspace/stack-17/node_modules/tsx/dist/loader.mjs /workspace/task-evidence/source-calibration/runner.ts prepare CORE_UNITS ADJUDICATED_LABELS FROZEN_ADJUDICATION NEW_PLAN_PATH
```

Execution requires a separate explicit root instruction, a `JEV_API_KEY` in the
environment, the frozen plan path and a new output directory. The CLI prints only
a concise budget/status summary and report path, never the full response report.
