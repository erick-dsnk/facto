# Jev versus locally hosted Laya in the fc-port pipeline

Evaluation date: 14 November 2026. Experiment branch: `codex/jev-laya-eval`, based on `claude/fc-port` at `c14a232554c8a25f00f2305090a0f569f78ec70a`.

**The current Laya English checkpoint is not a useful direct replacement for Jev with the existing prompts and rules.** It rejected most eligible statements at admission and abstained on every evidence judgment. Jev answered half the known true/false claims correctly and abstained on the rest in this small replay. Laya does provide a real privacy advantage for the decision calls when hosted locally, but its defaults discard substantial parts of these long Jev prompts and evidence states. This experiment measures compatibility with this pipeline, not Laya's achievable accuracy after adaptation or training.

## Main result: 20 less ambiguous public cases

The main cohort excludes four context-sensitive “misleading” examples, P17–P20. It contains eight correlated true/false pairs and four unresolved hypotheses. Correctness counts every case: abstentions, skips, speculation and errors remain in the denominator. Definitive coverage means a final true/false/misleading answer. The four correctly unresolved cases count toward correctness but are not definitive answers.

| Trial | Correct / 20 | Definitive coverage | Correct among definitive | Can't verify | Skipped / speculation | Errors / timeout | p50 / p95 seconds |
|---|---:|---:|---:|---:|---:|---:|---:|
| Jev, admission through pipeline | 12 / 20 (60%) | 8 / 20 (40%) | 8 / 8 | 12 | 0 / 0 | 0 / 0 | 0.783 / 2.266 |
| Laya, admission through pipeline | 0 / 20 (0%) | 0 / 20 | — | 0 | 17 / 3 | 0 / 0 | 0.399 / 0.435 |
| Jev, judgment with admission bypassed | 12 / 20 (60%) | 8 / 20 (40%) | 8 / 8 | 12 | 0 / 0 | 0 / 0 | 1.206 / 4.543 |
| Laya, judgment with admission bypassed | 4 / 20 (20%) | 0 / 20 | — | 20 | 0 / 0 | 0 / 0 | 2.877 / 2.935 |

Laya's short pipeline duration is time to reject or mark a statement speculative; it is not faster successful fact-checking. Its actual evidence judgments took about 2.9 seconds and produced no definitive answer. Jev had the lower median judgment latency and the wider observed tail. The single pass cannot establish a stable latency distribution or general accuracy ranking.

Jev's eight missed known facts were P05–P08, P11–P12 and P15–P16. Both providers received the same acquired excerpts; source-quality and verdict rules can suppress a plausible raw model answer. For example, a model choosing “supported” is not sufficient when the selected sources fail the existing content-basis, independence or corroboration requirements. Per-call model answers and final policy outcomes are retained in the result JSON so these effects can be inspected.

## Admission on the existing 59-case everyday set

This is binary eligibility accuracy, separate from final truth-label accuracy. There are 51 expected eligible claims and eight expected negatives. This existing development set is not a blind test, and includes synthetic device-context cases.

| Provider | Eligibility correct | Eligible recalled | False positives / 8 | Admission p50 / p95 seconds | Errors |
|---|---:|---:|---:|---:|---:|
| Jev | 55 / 59 (93.2%) | 48 / 51 (94.1%) | 1 / 8 | 0.248 / 2.277 | 0 |
| Laya | 22 / 59 (37.3%) | 14 / 51 (27.5%) | 0 / 8 | 0.335 / 1.007 | 0 |

Laya's zero false positives came with 37 missed eligible claims. That is a poor tradeoff for this fact-checking flow. The admission trials ran serially per provider; they were not interleaved and should not be used to claim a small speed advantage.

## All 24 cases and ambiguity sensitivity

| Trial | Strict correct / 24 | Correct with predeclared alternative labels | Definitive answers | Can't verify | Skipped / speculation | p50 / p95 seconds |
|---|---:|---:|---:|---:|---:|---:|
| Jev pipeline | 12 / 24 | 12 / 24 | 8 | 16 | 0 / 0 | 0.874 / 4.457 |
| Laya pipeline | 0 / 24 | 0 / 24 | 0 | 0 | 21 / 3 | 0.403 / 0.435 |
| Jev judgment | 12 / 24 | 12 / 24 | 8 | 16 | 0 / 0 | 1.009 / 4.543 |
| Laya judgment | 4 / 24 | 4 / 24 | 0 | 24 | 0 / 0 | 2.885 / 2.946 |

Neither provider answered the four ambiguous misleading cases definitively, so allowing their predeclared alternative true/false labels did not change the scores. There were zero runtime/provider errors or timeouts in the complete 96-observation primary comparison. Earlier two-case smoke output includes a Laya timeout; that smoke preceded the quiet, serial restart and is retained as a smoke artifact, not pooled into the primary metrics.

## What was held constant

The experiment uses the real `createClassifier`, `createJudge`, `PipelineRuntime`, source ranking, admission validation, provider attempt limits, retry rules and deterministic verdict policy. Default production provider selection remains Jev; Laya is opt-in. Each pipeline trial gets a fresh session and claim cache, so cross-provider or earlier-case answers cannot leak through a cache. A trial waits for the entire runtime request to settle, retains actual accepted span count/text and all terminal events, and rejects changed or multiple admitted propositions. A partial first result cannot score as a completed request.

The public cohort and expected labels were authored and reviewed against primary references before model outputs. References/rationales from `cohort.json` are never provided to either model. The cohort is exploratory and open, with correlated pairs, a science/health/geography skew and science-heavy unknowns. One pass per case is evidence about these inputs only, not an independent leaderboard or proof of safety.

Evidence was acquired once from live Exa: 24 primary and 24 balanced alternate searches, zero errors, $0.336 provider-reported acquisition cost, 83.926 seconds serial acquisition time. Original normalized retained excerpts are frozen in `frozen-evidence.json`; both providers replay exactly those records. Replay validates the proposition and subject before returning evidence, consumes the production search allowance and applies site exclusions. A different admitted span cannot silently receive another claim's evidence.

**This is an Exa-only frozen-evidence retrieval ablation.** The replay returns no free-source evidence and omits live retrieval network latency. It does not measure the full free-first network pipeline. Pipeline trials may run the existing alternate-evidence path against frozen alternate records; isolated judgment uses the same ranked primary evidence for both providers and bypasses admission. Jev network latency and local Laya HTTP/inference latency are included. Startup, downloads and cold model loading are excluded. Every primary request retains the existing 10-second deadline unless a Laya run passes `--laya-deadline-ms`. A timeout is an error, distinct from an insufficient-evidence answer.

The primary 24-case run interleaves Jev then Laya for each case, serially, with one GPU inference caller. Laya runs with `LAYA_MAX_CONCURRENT=1`; after a local timeout the evaluator can use a non-inference routing barrier to wait for the canceled server forward to finish before another local request. No full test suite ran during inference. Results are flushed after every observation. p50/p95 use nearest-rank order statistics, with all outcomes included.

## Why the drop-in Laya version struggles

The tested open English checkpoint is a 421M ModernBERT decision model. Laya 0.4.32 and source commit `af8ada066685d66b3fc0b31e6c56b96def23fe2f` are pinned, as is `convaiinnovations/laya` revision `85cc74ddae6109077ebe2853a9b3077fb6606a78`. It ran on an NVIDIA RTX 3050 Laptop GPU with 4 GB VRAM; server health confirmed CUDA and zero CPU fallbacks. Exact Python and dependency versions are in `runtime.json`. The checkpoint's defaults are `max_len=512`, `head_max_len=192`, BF16. The server's startup warning about clamping the choice:11+ temperature bucket is recorded; no evaluated question has more than eight options, so that particular bucket was not exercised.

All 24 primary Laya judgment requests reported **state truncation**, often dropping thousands of tokens. The evidence being judged is consequently incomplete. The server-reported `truncated` flag is narrower than full input preservation: it covers state clipping, not all question-head clipping.

An independent offline tokenizer audit reconstructed 1,248 question heads from 24 unchanged classifier and 24 unchanged judgment requests and checked every reconstructed token sequence against Laya's own `build_head`. It found:

- 307 / 1,248 instruction heads clipped: 120 / 252 admission heads and 187 / 996 judgment heads.
- 1,240 / 4,318 option descriptions clipped across 188 questions; zero token-span option collisions.
- The eight-option evidence `content_basis` questions retained only about 16 instruction tokens and 21 text tokens per option. Trailing evidence rules can disappear.
- This clipping can occur when the API reports `truncated: false`. Therefore admission's zero reported truncated calls does not mean its full prompts survived.

The audit is in `head-truncation-audit.json`. It covers first classifier calls and primary-evidence judge questions, not every alternate call or all 59 admission contexts. Laya's probabilities also are not calibrated for this pipeline's existing Jev-derived thresholds. These results show an input-budget and calibration mismatch as well as poor observed decisions; they do not isolate the effect of model size or prove fine-tuning cannot work.

## Bounded larger-context diagnostic

A separate diagnostic attempted the first two isolated judgments with the same evidence/questions and 10-second SLA, changing only `max_len=1024` and `head_max_len=512`. It stopped after the **first** request: the 4 GB GPU ran out of memory (176 MiB allocation failed), Laya silently fell back to CPU, and the request hit the 10-second deadline. A subsequent non-inference drain barrier remained busy for 60 seconds; the server was terminated rather than submitting a second case. No accuracy result can be inferred from that failed diagnostic. The result JSON records the timeout and health-reported OOM/fallback explicitly. This is evidence about this laptop's memory limit with this many question heads, not a universal limit on Laya context length. The GPU model server is stopped after the experiment.

## Privacy and operating tradeoffs

Self-hosting Laya keeps the decision inputs—captured text/context and assembled evidence—inside infrastructure you control, rather than sending that payload to hosted Jev. Laya provides configurable local model paths and the tested serving path ran with Hugging Face offline mode after setup. That is a substantial privacy advantage for the decision stage.

It does not make this application fully private: live Exa queries disclose the claim, free-source requests may disclose derived queries, and any hosted speech transcription, application logs, telemetry or remote infrastructure still need their own treatment. These trials used public fixtures, not sensitive user recordings. The replay made no live search requests during scoring because the original Exa calls had already happened.

Jev currently provides much better useful coverage with this pipeline and no model-serving operations. Laya avoids a hosted decision API and can work offline after model acquisition, but adds GPU/CPU provisioning, model downloads, concurrency control, patching and tuning. A local model has electricity/hardware/hosting costs; it is not zero-cost simply because there is no per-call vendor bill. Exa acquisition cost above is known; Jev monetary usage was not exposed in the parsed responses, so no decision-dollar comparison is established.

## Fine-tuning feasibility on this laptop

Fine-tuning is possible in principle, but this evaluation did not train a model or measure training time. The [pinned training code](https://github.com/NandhaKishorM/laya/blob/af8ada066685d66b3fc0b31e6c56b96def23fe2f/laya/train.py) loads the checkpoint as float32 and uses AdamW. For approximately 421 million parameters, weights, gradients and two optimizer moments alone require about 6.7 GB decimal, before activations and temporary buffers. The shipped full-model training path therefore cannot fit entirely on this 4 GB GPU as configured.

The built-in `freeze_encoder=True` option trains only approximately 26.5 million head parameters. Roughly 0.4 GB of trainable weights/gradients/moments plus approximately 1.7 GB of frozen encoder weights makes a small-batch head-only experiment plausible; actual peak memory and throughput have not been measured. The larger-context inference OOM above makes a fitting smoke test essential before estimating training duration. CPU training or a larger rented GPU are other options, with separate time/cost tradeoffs. There is no evidence-backed hour estimate yet.

The first work should be compact, Laya-native prompts and evidence serialization, then a measured small training smoke test, followed by a disjoint held-out evaluation. Head-only tuning may help classification/calibration but cannot recover evidence or instruction tokens clipped before inference. Do not train on the 59 admission examples or the 24 public cases and then present their scores as independent evaluation. A useful training set needs separate labeled admission decisions, evidence-grounded verdicts, source-role/content-basis decisions, and examples of when to abstain; the existing tiny open cohorts are insufficient to establish generalization.

## Validation

`npm run check` passed after the experiments: lint, TypeScript and all **67 test files / 1,132 tests**. The evaluator tests cover proposition isolation, production search allowance, denominator handling, complete-request settlement and a later timeout overriding an earlier result. Artifact checks found 96 primary observations, one terminal per pipeline observation, zero admission proposition mismatches and zero acquisition errors. These local checks do not prove deployed or live microphone behavior. No commit, push, PR or merge was performed.

## Reproduce

The repository adds no Node dependency. `npm ci` and `npm run check` use the existing workspace. Credentials stay in `.env`: `JEV_API_KEY`, `EXA_API_KEY` when acquiring evidence, and `LAYA_URL=http://127.0.0.1:8765` for Laya. Do not commit `.env`.

For a fresh host with a compatible CUDA PyTorch installation, create a separate Python environment and install the pinned Laya source. The original run used a Python 3.13 environment with system-site-packages and the versions in `runtime.json`; its unused optional VegAML import path was not installed. Installing all declared Laya dependencies in a clean environment is also supported upstream, but is a different dependency environment.

```bash
uv venv --python 3.13 --system-site-packages /tmp/laya-eval/venv
git clone https://github.com/NandhaKishorM/laya /tmp/laya-eval/source
git -C /tmp/laya-eval/source checkout af8ada066685d66b3fc0b31e6c56b96def23fe2f
uv pip install --python /tmp/laya-eval/venv/bin/python '/tmp/laya-eval/source[serve]'
HF_HOME=/tmp/laya-eval/hf /tmp/laya-eval/venv/bin/python -c 'from huggingface_hub import snapshot_download; print(snapshot_download("convaiinnovations/laya", revision="85cc74ddae6109077ebe2853a9b3077fb6606a78"))'
```

Serve the local snapshot under the English alias. The local snapshot override is why `/health` reports a null revision field; the path itself contains the pinned hash. Keep this server in a dedicated terminal until trials finish (or run it through your own process manager).

```bash
HF_HOME=/tmp/laya-eval/hf HF_HUB_OFFLINE=1 \
LAYA_HOST=127.0.0.1 LAYA_PORT=8765 LAYA_DEVICE=cuda \
LAYA_MODELS=english LAYA_THREADS=2 LAYA_MAX_CONCURRENT=1 \
LAYA_EXTRA_MODELS='{"english":"/tmp/laya-eval/hf/hub/models--convaiinnovations--laya/snapshots/85cc74ddae6109077ebe2853a9b3077fb6606a78"}' \
/tmp/laya-eval/venv/bin/laya-serve
```

Check `/health` for CUDA, no CPU fallbacks and loaded English model before evaluating. CPU fallback changes the experiment substantially. Frozen evidence is already provided; acquiring it again changes the evidence set and incurs provider charges. Prompt variants, extra case files, a cross-process Laya lock and a metrics summary are described in [prompt-pack.md](prompt-pack.md).

```bash
npm run evaluate:providers -- --providers jev --modes admission --output fixtures/evaluation/provider-comparison/results/admission-jev.json
npm run evaluate:providers -- --providers laya --modes admission --output fixtures/evaluation/provider-comparison/results/admission-laya.json
npm run evaluate:providers -- --providers jev,laya --modes pipeline,judge --output fixtures/evaluation/provider-comparison/results/pipeline-judge.json
# Optional fresh evidence acquisition; requires EXA_API_KEY and writes to a new file (the frozen baseline is never overwritten):
npm run evaluate:providers -- --acquire --evidence-out fixtures/evaluation/provider-comparison/evidence-new.json
# Separate bounded context diagnostic; never pooled with the primary comparison:
npm run evaluate:providers -- --providers laya --modes judge --limit 2 --laya-max-len 1024 --laya-head-max-len 512 --output fixtures/evaluation/provider-comparison/results/context-diagnostic.json
```

Machine-readable artifacts live under `fixtures/evaluation/provider-comparison/`. `results/pipeline-judge.json` is the authoritative primary comparison; smoke files are diagnostic only. Result files contain public fixture/evidence text and model answers; the harness should not be pointed at private user data without choosing appropriate artifact handling.

Upstream implementation references: [pinned Laya serving API](https://github.com/NandhaKishorM/laya/blob/af8ada066685d66b3fc0b31e6c56b96def23fe2f/laya/serve.py), [pinned model routing and model sizes](https://github.com/NandhaKishorM/laya/blob/af8ada066685d66b3fc0b31e6c56b96def23fe2f/laya/router.py), [pinned checkpoint configuration](https://huggingface.co/convaiinnovations/laya/blob/85cc74ddae6109077ebe2853a9b3077fb6606a78/rl_agent_config.json).
