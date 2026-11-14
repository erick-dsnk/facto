# Automatic presentation development cohort

Prepared before this cohort's provider execution. This is an open diagnostic of six presentation scenarios, using three previously reviewed public development propositions and one synthetic personal control. It adds **zero new facts** to any factual-accuracy denominator. BD10 appears three times deliberately. Known public baseline outcomes informed selection, as disclosed in `plan.json`.

Execute `run-cohort.mts`, which creates a new authenticated server/session for each case. Do not run the catalog `live-manifest.json` as a single shared-session campaign: a notification from AD02 could suppress a repeated BD10 later. The six `isolated/` files are reviewable projections; the wrapper uses the identical single-case arrays from the pinned catalog.

| Scenario | Reused case | Required event | Presentation |
| --- | --- | --- | --- |
| AD01 | BD10 | Cold contradicted result; default permission disabled | silent / notifications_disabled |
| AD02 | BD10 | Cold contradicted result; exact selected topic enabled | notify / selected_topic_contradiction |
| AD03 | BD09 | Cold supported result; notifications enabled | silent / automatic_noncontradiction |
| AD04 | BD10 | Cold contradicted result; numeric priority below 0.8; no selected topics | silent / insufficient_priority |
| AD05 | BDC01 | Personal skip; no admitted public span; zero Exa attempts; no claim.result | silent / private_or_personal |
| AD06 | BD07 | Permitted manual supported check while muted | silent / muted |

An abstention that happens to be silent does not exercise a verdict-dependent branch. Record it as **inconclusive**, retaining the factual abstention and all usage. A real `notify` receipt with the exact verdict, reason, span and current request correlation is required for AD02. No retries of scenarios or substitutions are allowed to produce a successful notification. Current selected references need independent inspection; the copied ground-truth sources do not pre-verify new runtime citations.

The cumulative cap is 24 Jev / 12 search / 18 contents calls, 180,000 charged input tokens, 1,000,000 request bytes, 65,536 bytes per request and 90 seconds. Unknown Jev usage keeps its 24,000-token reservation and stops subsequent scenarios. The wrapper subtracts prior usage before every new session. At least 4.1 seconds elapse after the previous automatic scenario completes before the next automatic scenario begins; this conservative spacing is included in cohort wall time and recorded separately from request processing latency.

After root supplies the final clean source freeze and SHA256, preview with:

```bash
NODE_USE_ENV_PROXY=1 /workspace/live-frozen-08/node_modules/.bin/tsx \
  /workspace/task-evidence/automatic-development/run-cohort.mts \
  /workspace/live-frozen-08 COMMIT SOURCE_SHA256 \
  /workspace/task-evidence/automatic-development/live-manifest.json \
  /workspace/task-evidence/automatic-development-first-run.json plan
```

The final `live` argument executes once; `plan` makes no provider calls and does not reserve an output. Both verify the clean commit, source hash and predeclared manifest hash. The live path requires a fresh output and fresh journal, with fsynced checkpoints before paid dispatch. Root must complete the frozen-source check first. API keys are read from the environment and never printed or persisted.

Accounting tests use only synthetic callbacks:

```bash
node --test /workspace/task-evidence/automatic-development/run-cohort.test.mts
```

All six tests pass. All seven manifests pass the strict development loader. Author provider calls: zero. No original heldout or private sealed case bodies were inspected. Independent pre-execution review is recorded separately; its AD05 correction preserves the initial scoring artifact and does not change the input manifest.
