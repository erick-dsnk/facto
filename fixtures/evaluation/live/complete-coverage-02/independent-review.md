# Complete coverage 02 — independent preparation review

Scope: read-only review and own eight prospective input controls, offline preflight/executor checks. No provider requests, production edits, or protected historical/private/heldout evaluation-body access. This is a newly prepared OPEN development cohort, not a blind evaluation or continuation of the consumed OR first run.

## Independent controls

Authored `controls.json` before provider observation: CT01–02 synthetic personal finance/medical-record details; CT03–04 private lived experiences; CT05–06 opinions; CT07–08 unresolved building/population referents. First six prospectively expect skip, last two needs_confirmation. All eight are manual/final inputs expecting respond, with empty allowed public spans and expected claims. No real user details are used. Strict repository case validation passes eight inputs; authoring hash is recorded in `independent-review-controls.json`.

## Preparation findings and resolutions

- Initial proposed 256KiB cap was not a maximum valid normalizer-path bound. A raw4096-UTF16-unit URL can percent-expand to over36k normalized characters. Six such URLs plus worst escaped source content serialize to362,773 bytes. Root accepted a512KiB per-request cap with128MiB cumulative across two batches.
- Part C initially reused Gibraltar and Magna Carta factual subjects from immediately observed OR cases with opposite asserted values. Root agreed to replace those two before freeze; final corpus review must verify the replacement and no returned provider observation precedes the freeze.
- Wrong factual labels are test observations and will be recorded without halting unrelated inputs in this campaign. Unsafe/private query attempts, authentication failures, actual budget exhaustion, source/plan mismatch, checkpoint/accounting failures and cancellation failures remain stopping conditions. No source or truth threshold is lowered by this test-completion policy.

## Revised budget capacity review

Proposed revised global limits:512KiB request,128MiB cumulative request bytes,96Jev/48search/72contents attempts,16M charged input tokens,128k unknown/pending reservation per Jev attempt,600s campaign. Two16-input batches each have48Jev/24search/36contents,64MiB cumulative bytes and8M tokens, with a shared global ledger.

216 maximum wire attempts at512KiB total108MiB, below128MiB. Each108-attempt batch totals at most54MiB, below64MiB.96 pending reservations of128k total12.288M, below16M (48 reservations6.144M below8M per batch). Reservations are declared accounting allowances, not tokenizer or provider-use upper bounds; actual usage remains charged and actual overruns still stop.32 ordinary ten-second input deadlines total320s, below600s before bounded observation/setup overhead. Existing provider retry attempts consume declared allowances. This supplies headroom for completing the declared ordinary cohort, not a promise against all possible provider/resource failures.

## Final plan, freeze and offline checks

Final combined plan declares24facts balanced12true/12false, plus the exact eight independently authored controls, in two disjoint16-input batches. All32labels are unique, every fact has one expected exact public proposition, controls have no allowed public spans, and all original truth-preparation hashes match. Two potentially reused subjects were replaced prospectively with Quito and the1799RosettaStone discovery before any new provider observation. No claim of blind evaluation is made.

The globalwall review found and root corrected two missing executor guards: second-batch time now uses the remaining global deadline, and each predispatch progress callback checks the global deadline before and after persistence; authentication errors now persist the case/stop marker and throw so no later batch dispatch occurs. Wrong factual labels remain measured observations without a stop. A run directory is exclusively reserved once and cannot be reused; fatal failures preserve the last durable checkpoint.

Sixteen independent freeze/batch/budget sandbox checks pass. Seven additional full offline executor integration cases pass: complete32-case aggregate accounting; one wrong label recorded while all32continue; incomplete first batch prevents second; unknown usage prevents second; authentication saves checkpoint/stop and halts; expired globalwall blocks dispatch; repeated execution failsEEXIST without replacing the original report. These use copied executor modules with only external runner/time/root paths replaced, a fake runLiveCampaign stub, temporary synthetic Git repositories, synthetic environment keys and a global fetch prohibition. No actual campaign namespace or provider was used. The full-test synthetic metrics are control-flow results, not source accuracy.

Final real preflight rerun passed with zero network: maximum measured normal4096-normalizedURL request167,551bytes and expanded valid rawURL request362,773bytes both fit512KiB. All source/qualifier/context fields are preserved. Final preflight additionally validates ready-plan counts and budgets. Its exact result is frozen, not rewritten during execution.

Actual executor --check only passed32cases at clean commit4f507f84d9f7f8881af62d9a9ae5a82aa0099ceb, scoped sourceSHA256d81de5984903f607d4e6b8342f1777b3dc105f893f27e2739c98308d86f57147. PlanSHA2562ef968ffc05b3859791417da853a219bdc015250faea43251103891c2f12789c; executorSHA25647426d69570ffc972246a6837497079d628755db6a231b9e34fc2fdcf5fafde1; preflightSHA256ee0e620f823a6761dbd019ee8f1a0a4a859179dcfcf223f2c5454ec752c4f8fb. All three current bytes match freeze.json. Initial unexecuted preflight-freeze mismatch was correctly refused and archived before root refroze the final receipt; no live attempt was dispatched under that mismatch.

Decision: PASS for root's one scoped prospective OPEN run. Existing unchanged-source684-test/36development/21presentation validation remains separately applicable; no redundant full gate was rerun. Validator made zero provider requests. Preserve all original outcomes and denominators; capacity or test-completion success is not factual usefulness, source independence or readiness.
