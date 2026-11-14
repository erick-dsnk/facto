# Pipeline console

Current backend evidence: [authenticated live campaign](../../docs/live-campaign-2026-11-14.md) and [independent first run](../../docs/blind-evaluation-2026-11-14.md). The executable freeze passed 341 tests; a subsequent harness-only presentation reporting fix passes 350. Factual coverage remains limited (2/5 development and 2/8 independent eligible claims). Transport completion and green tests do not establish readiness. Earlier baseline records below are historical.

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

For real typed text, set `PIPELINE_MODE=live`, `JEV_API_KEY` and `EXA_API_KEY` in `.env` and restart. The implementation calls Jev's System One endpoint and Exa's official SDK. A bounded direct-adapter smoke test on 14 November 2026 verified actual Jev/Exa wire parsing, two public-only queries, one cited supported result, one conservative abstention and distinct HTTP 401 errors. See [evaluation](../../docs/evaluation.md); this did not exercise the authenticated live console or native client. Keep all keys on the server; no Deepgram key is required until the app owner supplies an ASR adapter.

For a phone connection, configure the explicit allowed browser origins and a reachable HTTPS/WSS address. `TLS_CERT_PATH` and `TLS_KEY_PATH` support direct TLS; a TLS reverse proxy is another option. Set `HOST=0.0.0.0` only when intentionally exposing the service. No remote endpoint is deployed by this branch.

## Parallel work and current scope

The backend imports no iOS code. The app owner can consume `packages/contracts/schemas/` and `packages/contracts/fixtures/` immediately, then connect to this service. Keep native capture/rendering under `apps/ios/` and the ASR implementation under `services/api/src/input/asr/`; those paths are untouched. Core dependencies are injected through `PipelineAdapters`, `ProviderContext`, and the audio adapter boundary.

| Assigned issue | Implemented starting point | Still needs validation or extension |
| --- | --- | --- |
| #12 | Session auth, HTTP/WS, contracts, console, audio framing and adapter boundary | Swift decoding review, reachable HTTPS endpoint and real ASR adapter |
| #15 | Exact coherent spans, batched Jev admission, private-subspan veto, wait/clarification | Independent admission matched 8/10 cases; semantic errors remain. Native continuation assembly is deferred. |
| #16 | Official Exa adapter, bounded passages, source grouping and neutral alternate search with content enrichment | Development citation review opened 7/8 selected URLs; one remains unverified. Source acquisition and useful coverage need improvement. |
| #17 | Typed judgment, explicit source assessments, conservative verdict gates and retained citations | Independent review found 5/5 blind selected citations relevant; source overlap limits independence. Human demo review and broader coverage remain. |
| #18 | Pure notification policy, action fixtures and enabled-topic literal phrase matching | App delivery/repeat/mute validation; no semantic topic inference |
| #20 | Deadlines, bounded queues/cache, epoch/revision cancellation, attempt budgets and sanitized diagnostics | Real invalid-key probes and complete authenticated campaigns passed transport; population failure rates and load remain unmeasured. |
| #24 | 48-case split manifest, original 12 reserved held-outs, fixture runner, durable authenticated live campaigns and an independent sealed first run | Blind factual coverage was 2/8 (25%); five abstentions and one missing verdict remain failures of usefulness. Original held-out blindness is unverified. |

Automatic selected-topic priority matches whole literal phrases in the admitted `checkedText` against currently enabled `selectedTopics`. Matching normalizes Unicode (NFKC), case and whitespace; it ignores empty or punctuation-only topics. It does not infer categories: selecting `weather` does not match a lightning sentence unless that phrase occurs in the admitted public span. Private rejected clauses/context do not enter matching, and a match grants no truth verdict or notification by itself. Automatic notifications still require an opted-in, current, healthy, qualifying contradiction and available budget; preference changes apply before delivery, including cached/in-flight results.

Run `npm run evaluate` for the development report: 36/36 scenarios (34 scripted policy cases and two authenticated local HTTP/WebSocket scenarios using injected providers), plus 21/21 presentation fixtures. The frozen continuation artifact records E33/E43 durations of 202/10,036 ms. These checks measure control flow, not provider accuracy. By default the runner selects the development split before opening case bodies. Earlier smoke and interrupted campaigns remain historical evidence; the completed durable campaigns and sealed first-run aggregates are linked above. See the [evaluation report](../../docs/evaluation.md) for exact snapshots, original held-out exposure, and remaining work. Native glasses and deployment are outside this continuation.

Dependencies are limited to the selected stack: Fastify/WebSocket transport, Zod wire validation, official Exa SDK and `tldts` Public Suffix List grouping; TypeScript/tsx, ESLint and Vitest provide the local gate. Versions and transitive dependencies are pinned by the lockfile.

## Bounded authenticated live development runner

`npm run evaluate:live -- --plan` prints the declaration and limits without starting a server or calling providers. The runner in `src/live/run.ts` starts the production Fastify service on loopback, creates an authenticated session, checks rejected HTTP/WebSocket credentials, and submits typed requests over actual HTTP while observing the authenticated WebSocket. Provider factories and retry logic are the production Jev/Exa implementations; offline tests inject provider HTTP responses at their fetch boundary. No evaluation corpus or held-out body is loaded.

The eight predeclared development inputs cover Sydney Opera House's opening year, the lightning maxim, a synthetic personal anecdote, synthetic private rent beside public Oslo context, the Opera cache repeat in the same session, a complete eight-planets proposition, automatic waiting through expiry, and a first-person Helsinki/Norway assertion. This is a small diagnostic campaign, not an accuracy benchmark. Explicit cancellation, two-claim receipt correlation, alternate retrieval, byte/token stops, retries, content fetches and provider authentication failures also have injected tests.

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
