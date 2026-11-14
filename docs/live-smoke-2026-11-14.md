# Bounded live provider smoke — 14 November 2026

This record covers production adapters at commit `394ae9c44b000f8e98da353a53d4cebfe1405d7c`, Node 22.22.1, Jev `jev-latest`, policy `glasses-p0.1` and the pinned official Exa SDK. Benign fabricated inputs were outside the evaluation manifest. No held-out cases were opened or run. Calls were fresh direct-adapter invocations, with no application cache, HTTP/WS session, native capture, ASR, deployment or glasses measurement.

## Wire compatibility and bounded usage

Actual successful responses: 3 Jev admissions, 2 Jev judgments and 2 Exa searches, all HTTP 200. Jev choice/probability/noul answers passed strict validation; Exa SDK results normalized into five retained highlight passages per public claim. No provider compatibility fix was required. There were zero content-fetch requests and zero automatic retries.

Recorded Jev input tokens totalled 14,933. Jev cost is unknown. The second Exa search reported $0.007; the first response’s numeric cost was not retained, so total search/provider cost is unknown.

## Observed cases

| Case | Admission and exact outbound Exa query | Result | Direct-adapter wall time |
|---|---|---|---:|
| LIVE-SMOKE-1: mixed synthetic personal/public input | Only public span `[26,57)` admitted; `Mount Fuji is located in Japan.` | Five retained passages; `insufficient_evidence`, reason `insufficient_independent_evidence`; no selected citation | 2,086 ms |
| LIVE-SMOKE-2: standalone synthetic personal anecdote | `skip`, reason `private_or_personal`; no search | No truth verdict or citation | 288 ms |
| LIVE-SMOKE-3: public historical fact | Span `[0,38)`; `The Sydney Opera House opened in 1973.` | Five retained passages; `supported`, reason `qualifying_evidence`; selected retained ID `ev-a38cbdd50b89785e9ddf` | 1,894 ms |

Both observed queries excluded personal context (2/2). Mixed-span separation and personal-only suppression were each observed once. These are smoke cases, not accuracy or privacy rates across users. Three isolated wall times are not latency statistics; presentation actions were not measured.

Fuji highlights included Wikipedia, NASA, Copernicus, Fujisan and Japan National Tourism Organization passages with relevant retained text. The model proposed support, but only one passage passed both relevance and scope gates. The deterministic policy conservatively abstained. No source registry, threshold or policy was tuned from this tiny sample; none of these pages was independently opened in this run.

## Citation inspection

The agent opened the selected [National Museum of Australia page](https://www.nma.gov.au/defining-moments/resources/sydney-opera-house) on 14 November 2026. Its retained passage reads: “Finally, the Sydney Opera House was opened by Queen Elizabeth II on 20 October 1973.” This matches the exact opening-year proposition and its historical scope. The page records an update on 15 April 2025. This is agent inspection; the existing human demo source review has not been recorded.

The agent also opened the [Sydney Opera House operator history](https://www.sydneyoperahouse.com/our-story) and confirmed the retained opening-year passage. That source was not the selected citation, and no official-site shortcut was used. The [Museums of History NSW page](https://mhnsw.au/opening-of-the-sydney-opera-house/) returned 403 on independent open, leaving its Exa highlight independently unverified. The remaining retained Sydney URLs were [extraordinary moments](https://www.sydneyoperahouse.com/our-story/50-years-extraordinary-moments) (same source group as the operator history) and [Queen Elizabeth Digital Memorial](https://www.queenelizabeth.com/moments/opening-of-sydney-opera-house); those were highlight-only observations. Provider highlights may contain ellipses, so their continuity with the complete page must not be assumed.

## Operational failure probes

One deliberate invalid-key request per provider returned actual HTTP 401. Jev mapped to `jev_authentication`; Exa mapped to `exa_authentication_failed`. Both errors were sanitized, nonretryable and consumed one attempt, with no truth output. These probes bypassed transport/runtime delivery. Live 429/5xx, malformed answers, empty retrieval, source conflict, cancellation and deadlines were not induced; existing automated fixture/runtime tests cover simulated behavior separately.

## Procedure and limits

The adapter runner and invalid-key probe were temporary files in `/tmp` and are no longer available. The original run composed the Jev client, classifier, Exa retriever, judgment adapter and verdict policy directly; it used a fixed per-call timeout and bypassed the runtime’s shared deadline and attempt-budget orchestration. Its command depended on the local main-worktree `.env` and a temporary script, so it is intentionally not presented as a reproducible repository command. The recorded outcomes above are historical operator evidence, not a result reproduced from this checkout. Any repeat needs a new reviewed runner, a fresh explicit provider budget, and a durable sanitized report; configure credentials through the session’s secret manager and never copy keys into a prompt or repository.

This smoke does not establish human-reviewed demo readiness, general semantic accuracy, authenticated live HTTP/WS compatibility, Swift decoding, venue reliability, listening false-alert rates or device output. A later authenticated transport campaign was interrupted by runner defects; it is described separately in [evaluation](evaluation.md). The 12 original reserved records remain unchanged and unrun, but their blindness is unverified because earlier text exposure cannot be ruled out. No replacement sealed dataset is currently available.
