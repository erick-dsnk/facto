# Evaluation fixtures

`cases.json` contains 48 synthetic scenarios frozen on 14 November 2026: 12 personal/opinion/nonclaims, 12 public propositions, 8 mixed/ambiguous, 8 capture/correction and 8 service/lifecycle scenarios. Twelve are reserved as held-out cases before tuning; default evaluation excludes them.

The semantic answers in `modelFixture` and exact `candidateModelFixtures` are scripted model responses, separate from the expected actions. The harness passes these through the real Jev response validator and classifier, then runs the real verdict and presentation policies. It does not compare expected fields with themselves. Changing an expected action causes the report to fail; the harness test demonstrates this.

Synthetic evidence at `example.org` and `example.net` exists only to test source gates. Those passages are not live citations or evidence for the public statements. Expected verdicts describe a response to the supplied evidence fixture, not a human fact-check label. Labels and sources must be independently reviewed before a live accuracy study.

From the repository root:

```sh
npm run evaluate
npm run --silent evaluate > fixtures/evaluation/development-results.json
```

This is a fixed-clock, no-network run. `not_run` means a scenario requires runtime orchestration or hardware; it is never counted as passing. Presentation suppression tests inject state and do not prove that audio stopped. Admission-only cases do not claim to test delivery of manual clarification/status events. Outbound private-query leakage remains unmeasured here; exact public-span preservation is tested separately.

`development-results.json` records the latest explicitly executed development run. The report also consumes the shared B7 action cases at `../actions/presentation-cases.json` and reports their denominator separately.

After thresholds and policy are frozen, an intentional held-out run is available with `npm run evaluate -- --heldout`. Do not tune using its outcomes; record any later tuning as contamination and choose a fresh held-out set. The initial implementation did not execute held-out cases.

No recordings, genuine personal statements or API credentials belong in this directory. Live runs need a separate record with provider/model/policy versions, actual source inspection, capture route, timings and costs; see `docs/evaluation.md`.
