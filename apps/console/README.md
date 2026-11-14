# Pipeline console

Current integration passes lint/typecheck and **525 tests across 25 files**, but later per-target extraction fallback/status diagnostics, richer contained-highlight retention and stream-lifecycle fixes are not covered by the completed frozen08 live cohorts. [Candidate08](../../docs/broader-development-candidate08.md), frozen at `aefb9e7` / source `09c18944f1eba27dd09293a31511824014cbea0f92057c7c7e5b6445fcb70d42`, produced **6/12 correct definitive unique facts**, **4/12 fully source-verified**, five abstentions and one operational error; 13/13 eligible occurrences were admitted and all 16 inputs had terminal feedback. The separate [baseline](../../docs/broader-development-2026-11-14.md) remains 3/12 correct and 2/12 fully source-verified. This repeated OPEN comparison is neither blind nor causal; mixed/cache repeats add no unique facts.

[Actual-provider automatic evidence](../../docs/automatic-development-2026-11-14.md) retains five action passes and one inconclusive result, plus a separate AD07 supported-silence followup that adds no new fact or replacement pass. [Earlier public campaigns](../../docs/live-campaign-2026-11-14.md) and the [first](../../docs/blind-evaluation-2026-11-14.md), [second](../../docs/blind-evaluation-2026-11-14-02.md), and [third](../../docs/blind-evaluation-2026-11-14-03.md) sealed results remain separate immutable histories: 2/8, 4/8 and 2/8 correct definitive on different inputs/freezes, not a pooled or causal series. Agent source review is disclosed as agent review; there is no additional human sign-off gate. Current evidence does not establish readiness. Native/iOS/ASR/deployment/device measurements remain deferred.

Run `npm ci`, configure the server's `.env` using `.env.example`, then `npm run dev` from the repository root. Open `http://localhost:3000`, enter the demo join code, connect and submit public text. The console uses the same session, WebSocket and text contracts as iOS. It is a typed-input debugging tool, not proof of glasses capture.

The server reports fixture versus live mode in `/health`. Fixture results are canned contract demonstrations. Live mode requires server-side Jev and Exa keys. Never place provider keys in this page or enter them as a join code. Session credentials stay in memory; stop deletes the session and clears visible data. A disconnected tab clears data and requires explicit reconnection.

Manual requests and automatic input use the same checker but different presentation decisions. The events panel shows silent results so the app builder can inspect them. Native clients must never promote `presentation.action = silent` to a warning.

For integration, use [the shared contracts](../../packages/contracts/README.md). The separate `evaluate.ts` runner is documented in the evaluation report.

## Local setup

Use Node 22.12+ or Node 24 LTS. Copy `.env.example` to `.env`, choose an 8+ character `DEMO_JOIN_CODE`, and set `DEMO_JOIN_EXPIRES_AT` to a future ISO timestamp with timezone. The join code expires at that timestamp; individual sessions last five minutes. Start with `PIPELINE_MODE=fixture`, then run:

```sh
npm ci
npm run check
npm run dev
```

Fixture mode accepts these exact examples: `Helsinki is the capital of Finland.`, `Lightning never strikes the same place twice.`, `There is not enough fixture evidence.`, and `I felt tired after lunch.`. Text ending in `...` demonstrates incomplete input. Other text requests clarification; no live lookup happens. Synthetic evidence and `modelVersion: fixture` must remain labelled in demos.

For real typed text, set `PIPELINE_MODE=live`, `JEV_API_KEY` and `EXA_API_KEY` in `.env` and restart. The implementation calls Jev's System One endpoint and Exa's official SDK. In this managed cloud, use Node 24 with `NODE_USE_ENV_PROXY=1` for provider requests through the configured outbound proxy; do not print proxy credentials. A bounded direct-adapter smoke test on 14 November 2026 verified actual Jev/Exa wire parsing, two public-only queries, one cited supported result, one conservative abstention and distinct HTTP 401 errors. See [evaluation](../../docs/evaluation.md); that historical direct-adapter smoke is separate from the authenticated campaigns linked above and did not exercise a native client. Keep all keys on the server; no Deepgram key is required until the app owner supplies an ASR adapter.

For a phone connection, configure the explicit allowed browser origins and a reachable HTTPS/WSS address. `TLS_CERT_PATH` and `TLS_KEY_PATH` support direct TLS; a TLS reverse proxy is another option. Set `HOST=0.0.0.0` only when intentionally exposing the service. No remote endpoint is deployed by this branch.

## Parallel work and current scope

The backend imports no iOS code. The app owner can consume `packages/contracts/schemas/` and `packages/contracts/fixtures/` immediately, then connect to this service. Keep native capture/rendering under `apps/ios/` and the ASR implementation under `services/api/src/input/asr/`; those paths are untouched. Core dependencies are injected through `PipelineAdapters`, `ProviderContext`, and the audio adapter boundary.

| Assigned issue | Implemented starting point | Still needs validation or extension |
| --- | --- | --- |
| #12 | Session auth, HTTP/WS, contracts, console, audio framing and adapter boundary | Swift decoding review, reachable HTTPS endpoint and real ASR adapter |
| #15 | Exact coherent spans, batched Jev admission, private-subspan veto, wait/clarification | Latest OPEN admission matched 12/12 unique eligible facts plus the mixed repeat (13/13 occurrences). Earlier sealed admission remains 8/10, 9/10 and 10/10, with final exact spans 10/10; those different cohorts are not pooled. Native continuation assembly is deferred. |
| #16 | Official Exa adapter, bounded passages, source grouping and neutral alternate search with content enrichment | Candidate08 reviewed 19 selected references over 17 URLs: 17 verified, two inaccessible (Bartleby 403, Olympics.com 503). Earlier access failures and shared definitions remain in their dated reports. Domain diversity does not prove independent origins; coverage remains limited. |
| #17 | Typed judgment, explicit source assessments, conservative verdict gates and retained citations | Independent review found 5/5 citations relevant in campaign one, 9/9 in campaign two, and verified 5/6 selected citations as substantive and verdict-supporting in campaign three. One application-error page remains unverified; common-source standards limit independence. Candidate08 has only 4/12 fully verified selected-source sets. Continue independent content inspection with honest agent/human disclosure and broader coverage; no extra human sign-off gate. |
| #18 | Pure notification policy, action fixtures and enabled-topic literal phrase matching | Actual-provider original controls: five passes, one inconclusive; separate AD07 supported-silence followup. Native delivery/repeat/mute validation remains; no semantic topic inference. |
| #20 | Deadlines, bounded queues/cache, epoch/revision cancellation, attempt budgets and sanitized diagnostics | Candidate08 delivered 16/16 terminals with one operational exa_content_failed, five abstentions and six correct unique definitive results. Latest fallback/status diagnostics postdate that freeze and are not retroactively live-validated. Historical errors remain preserved; population failure rates/load are unmeasured. |
| #24 | 48-case split manifest, original 12 reserved held-outs, fixture runner, durable authenticated live campaigns and three independent sealed campaigns | Sealed sets returned 2/8, 4/8 and 2/8 correct definitive, with respective abstentions/clarification or timeout retained. They used different sets/freezes and cannot be pooled or causally compared. The original 12 held-out bodies' blindness remains qualified. |

Automatic selected-topic priority matches whole literal phrases in the admitted `checkedText` against currently enabled `selectedTopics`. Matching normalizes Unicode (NFKC), case and whitespace; it ignores empty or punctuation-only topics. It does not infer categories: selecting `weather` does not match a lightning sentence unless that phrase occurs in the admitted public span. Private rejected clauses/context do not enter matching, and a match grants no truth verdict or notification by itself. Automatic notifications still require an opted-in, current, healthy, qualifying contradiction and available budget; preference changes apply before delivery, including cached/in-flight results.

The archived fixture evaluator and frozen08 validation record retain 36/36 scenarios (34 scripted policy cases and two authenticated local HTTP/WebSocket scenarios using injected providers), plus 21/21 presentation fixtures. This default evaluator remains at 36 cases. The earlier combined freeze records E33/E43 durations of 258/10,033 ms. These checks measure control flow, not provider accuracy. By default the runner selects the development split before opening case bodies. The earlier run 07 live campaign had nine typed requests and five unique eligible factual claims: the cached Opera repeat adds no unique claim, and the ninth input is an opinion control. Run 07 returned two correct definitive results (Opera and planets), three abstentions and no wrong definitive labels. Its independent review found six relevant opened URLs among seven unique selected URLs; the unverified memorial page and shared IAU definition limit source confidence. Full usage, partial costs and historical regressions remain in the campaign record. See the [evaluation report](../../docs/evaluation.md) for exact snapshots, original held-out exposure, and remaining work. Native glasses and deployment are outside this continuation.

Historical context: the earlier combined freeze `3cfdfb13d8e6d37ab956e781206d892786ba441f` (source SHA-256 `e6f36587593f39415f161a64a02f0946f4758b9a90b5c2c0ac40399adfb8de85`) passed 429 tests across 21 files; the #35 runtime suite passed 400. The combined retention correction, #17 citation-selection fallback and #15 opinion guard were evaluated on the earlier combined freeze in the nine-request public campaign and the third sealed campaign. That earlier public cohort returned 2/5 unique factual claims; newer broader OPEN results are linked above. The third sealed set returned 2/8 correct definitive results, five abstentions and one timeout/no verdict, despite 10/10 admission and exact-span matches. One selected source page was unverifiable. The first and second sealed campaigns remain separate immutable results; no pooling or causal comparison is appropriate. Continue work on evidence coverage, source access and independence, latency, and timeout behavior. The original 12 held-out set remains qualified for possible exposure; native glasses, Swift decoding, ASR, deployment and device measurements remain deferred. Current evidence does not support a readiness claim.

Dependencies are limited to the selected stack: Fastify/WebSocket transport, Zod wire validation, official Exa SDK and `tldts` Public Suffix List grouping; TypeScript/tsx, ESLint and Vitest provide the local gate. Versions and transitive dependencies are pinned by the lockfile.

## Bounded authenticated live development runner

`npm run evaluate:live -- --plan` prints the declaration and limits without starting a server or calling providers. The runner in `src/live/run.ts` starts the production Fastify service on loopback, creates an authenticated session, checks rejected HTTP/WebSocket credentials, and submits typed requests over actual HTTP while observing the authenticated WebSocket. Provider factories and retry logic are the production Jev/Exa implementations; offline tests inject provider HTTP responses at their fetch boundary. No evaluation corpus or held-out body is loaded.

The original predeclared eight-input diagnostic covered Sydney Opera House's opening year, the lightning maxim, a synthetic personal anecdote, synthetic private rent beside public Oslo context, the Opera cache repeat in the same session, a complete eight-planets proposition, automatic waiting through expiry, and a first-person Helsinki/Norway assertion. This is a small diagnostic campaign, not an accuracy benchmark. Explicit cancellation, two-claim receipt correlation, alternate retrieval, byte/token stops, retries, content fetches and provider authentication failures also have injected tests.

With server-side keys configured through the environment, execute a fresh campaign with a new durable output filename:

```sh
npm run evaluate:live -- --live --output artifacts/live/development-2026-11-14-01.json
```

In a managed environment that requires its configured HTTP(S) proxy, use Node 24 and enable Node's environment-proxy support for the runner:

```sh
NODE_USE_ENV_PROXY=1 npm run evaluate:live -- --live --output artifacts/live/development-2026-11-14-02.json
```

The default Node fetch may otherwise attempt a blocked direct connection even when proxy environment variables exist. A network failure with no provider response leaves usage unknown and triggers the runner's safety stop; preserve that report and choose a fresh filename after correcting connectivity. Never print proxy credentials or provider keys while diagnosing the environment.

The output path must be writable and absent before dispatch. The runner reserves it with mode `0600`, then atomically checkpoints sanitized dispatch reservations, completed attempts and completed cases. A final report replaces the checkpoints. Interrupted reports retain `completed: false`; a `dispatch_reserved` checkpoint means dispatch may or may not have happened and retains the conservative allowance. Reusing an existing filename fails before paid calls. Metadata records the current commit, dirty status and a SHA-256 of console/API/contracts source plus package manifests, including untracked harness files. Optional `--commit SHA` rejects a mismatched checkout; it does not hide a dirty tree.

Fresh campaign limits are 24 actual Jev attempts, 12 Exa search attempts, 18 content attempts, 150 seconds, 65,536 bytes per serialized provider request body and 1,000,000 total request-body bytes. Headers and URLs are excluded from byte totals. Every retry and content fetch is counted at the provider HTTP boundary. Runtime consumed allowances are recorded separately from actual dispatched requests, so a locally denied call cannot appear as a paid attempt.

The input-token stopping threshold is 180,000. Each pending Jev attempt reserves an explicit 24,000-token uncertainty allowance, independently of byte accounting; valid provider `usage.input_tokens` replaces it. This allowance is **not** a tokenizer-derived upper bound or a guarantee on provider charges: a response can report more tokens than reserved. An actual overrun stops future dispatch. Missing/invalid usage stays unknown and retains its reservation; once such an attempt finishes, all further provider dispatch is blocked. Returned numeric costs are partial when any cost is unknown; the runner never invents prices. Wall-clock stops, byte/call/token stops and persistence failures are classified separately from provider failures.

The runner always awaits the request/revision-correlated terminal WebSocket event, including after a local stop. `claim.waiting` is intermediate; expiry must arrive. Requests with two admitted claims need both result receipts unless a request-terminal error/cancellation occurs. Reports retain actual arrival times, fresh per-request stage timing/usage, exact admitted public queries, validated named Jev enum/probability/noul answers, retained public evidence, content/risk/origin assessments, selected citations and cache flags. They omit original/private text, rejected clauses, prompts, response bodies, credentials and keys. Outbound queries must equal the current admitted public proposition or its policy-generated alternate; a different predeclared proposition is insufficient.

Provider authentication probes use deliberately invalid dummy keys and the same HTTP/WebSocket path. Run each separately with its own output and fresh limits; the Exa probe uses a configured real Jev key for admission:

```sh
npm run evaluate:live -- --live --auth-probe jev --output artifacts/live/jev-auth-2026-11-14-01.json
npm run evaluate:live -- --live --auth-probe exa --output artifacts/live/exa-auth-2026-11-14-01.json
```

`completed` means all declared transport observations reached their correlated terminals; provider operational errors are reported separately and definitive labels still need citation inspection. The probe additionally requires the target provider's actual HTTP 401 and sanitized terminal authentication error. Check every abstention and independently open every definitive selected citation against the exact proposition before making demo claims. Run `npx vitest run apps/console/src/live` for offline verification; no live provider calls occur in these tests.
