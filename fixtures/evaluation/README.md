# Evaluation fixtures

`cases.json` is a metadata-only manifest with IDs, categories and the split for 48 synthetic scenarios frozen on 14 November 2026: 12 personal/opinion/nonclaims, 12 public propositions, 8 mixed/ambiguous, 8 capture/correction and 8 service/lifecycle scenarios. Twelve cases were reserved as held-out before tuning. Their bodies are kept in `cases-heldout.json`; the default runner filters the manifest to `development` before opening `cases-development.json`, so held-out inputs are not loaded by the default evaluation. The split preserved all 12 held-out records unchanged: their canonical JSON SHA-256 before and after separation is `16f927c84ed3703356280f02241b4354d35ef6337288d3495ef08b7969aa37bb`.

Blind status is qualified: a prior accidental search over the legacy combined corpus may have exposed held-out text in a tool result. It was not an intentional held-out run and the output was not used to tune policy, but exposure cannot be ruled out. Do not claim blind-held-out accuracy from this set. The fresh replacement set prepared in an earlier session is no longer available in the current worktree or its temporary-file area. Once the implementation and thresholds are frozen, a new independent set must be authored and reviewed, then held outside this development fixture directory and run by a separate blind executor. Do not claim a blind evaluation until that process completes.

The semantic answers in `modelFixture` and exact `candidateModelFixtures` are scripted model responses, separate from the expected actions. The harness passes these through the real Jev response validator and classifier, then runs the real verdict and presentation policies. It does not compare expected fields with themselves. Changing an expected action causes the report to fail; the harness test demonstrates this.

Synthetic evidence at `example.org` and `example.net` exists only to test source gates. Those passages are not live citations or evidence for the public statements. Expected verdicts describe a response to the supplied evidence fixture, not a human fact-check label. Labels and sources must be independently reviewed before a live accuracy study.

From the repository root:

```sh
npm run evaluate
npm run --silent evaluate > fixtures/evaluation/development-results.json
```

This is a fixed-clock, no-provider-network run. E33 correction sequencing and E43 deadline behavior use injected deterministic providers through a real local Fastify HTTP server and authenticated WebSocket; their wall-clock timings include the 10-second runtime deadline where applicable. All other development cases use scripted model answers and synthetic evidence. A `not_run` case is never counted as passing. This harness does not measure provider semantics, live retrieval, audio stopping, or outbound-query leakage.

`development-results.json` records the latest explicitly executed development run. The report also consumes the shared B7 action cases at `../actions/presentation-cases.json` and reports their denominator separately.

The `npm run evaluate -- --heldout` command remains available for exploratory checks, but this set cannot support a blind-accuracy claim because prior exposure cannot be ruled out. Do not tune on it or present it as a formal blind result. After thresholds and policy are frozen, create and independently review a new sealed set for formal evaluation. The initial implementation did not intentionally execute held-out cases.

No recordings, genuine personal statements or API credentials belong in this directory. Live runs need a separate record with provider/model/policy versions, actual source inspection, capture route, timings and costs; see `docs/evaluation.md`.
