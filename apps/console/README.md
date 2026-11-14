# Pipeline console

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
| #15 | Exact spans, batched Jev admission, private-subspan veto, wait/clarification | Live semantic evaluation, native continuation assembly |
| #16 | Official Exa adapter, cancellation, bounded passages and source grouping; one alternate search is gated on the first policy-approved insufficient/empty retrieval | End-to-end live source relevance/freshness evaluation and human citation review pending |
| #17 | Typed judgment, explicit source assessments, conservative verdict gates and retained citations | One selected live citation inspected by agent; human demo review and broader source evaluation pending |
| #18 | Pure notification policy, action fixtures and enabled-topic literal phrase matching | App delivery/repeat/mute validation; no semantic topic inference |
| #20 | Deadlines, bounded queues/cache, epoch/revision cancellation, attempt budgets and sanitized in-memory diagnostics | Provider failure/retry behavior is offline-validated; live failure rates and load remain unmeasured |
| #24 | 48-case split manifest, 12 reserved held-outs, scripted policy runner plus authenticated HTTP/WebSocket runtime checks for correction cancellation and the 10 s deadline | Authenticated live-provider campaign was interrupted by harness defects and did not complete; human citation review and a new independent blind evaluation remain pending. Old held-out blindness is unverified. |

Automatic selected-topic priority matches whole literal phrases in the admitted `checkedText` against currently enabled `selectedTopics`. Matching normalizes Unicode (NFKC), case and whitespace; it ignores empty or punctuation-only topics. It does not infer categories: selecting `weather` does not match a lightning sentence unless that phrase occurs in the admitted public span. Private rejected clauses/context do not enter matching, and a match grants no truth verdict or notification by itself. Automatic notifications still require an opted-in, current, healthy, qualifying contradiction and available budget; preference changes apply before delivery, including cached/in-flight results.

Run `npm run evaluate` for the development report. The frozen integration commit `ecda5dafe6254d80d2c173adea4fe9435ce46e68` passed `npm run check` with 291 tests and the harness passed 36/36 cases (34 scripted policy fixtures and two local authenticated HTTP/WebSocket runtime scenarios using injected providers). The final stacked branch passed a fresh install, the same 291-test gate, and 36/36 development scenarios; latest E33/E43 runtimes were 139/10,018 ms. These checks measure control flow, not provider accuracy. By default the runner selects the development split before opening case bodies. Direct live adapter smoke and classification/source-assessment probes are separate historical evidence; the later authenticated live-provider campaign stopped before completion. See the [evaluation report](../../docs/evaluation.md) for the run boundaries, missing temporary artifacts, old held-out exposure caveat, and remaining work. Native glasses and deployment work are outside the current fact-checking scope.

Dependencies are limited to the selected stack: Fastify/WebSocket transport, Zod wire validation, official Exa SDK and `tldts` Public Suffix List grouping; TypeScript/tsx, ESLint and Vitest provide the local gate. Versions and transitive dependencies are pinned by the lockfile.
