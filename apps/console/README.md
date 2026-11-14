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

For real typed text, set `PIPELINE_MODE=live`, `JEV_API_KEY` and `EXA_API_KEY` in `.env` and restart. The implementation calls Jev's System One endpoint and Exa's official SDK. No live provider smoke test has been recorded yet. Keep all keys on the server; no Deepgram key is required until the app owner supplies an ASR adapter.

For a phone connection, configure the explicit allowed browser origins and a reachable HTTPS/WSS address. `TLS_CERT_PATH` and `TLS_KEY_PATH` support direct TLS; a TLS reverse proxy is another option. Set `HOST=0.0.0.0` only when intentionally exposing the service. No remote endpoint is deployed by this branch.

## Parallel work and current scope

The backend imports no iOS code. The app owner can consume `packages/contracts/schemas/` and `packages/contracts/fixtures/` immediately, then connect to this service. Keep native capture/rendering under `apps/ios/` and the ASR implementation under `services/api/src/input/asr/`; those paths are untouched. Core dependencies are injected through `PipelineAdapters`, `ProviderContext`, and the audio adapter boundary.

| Assigned issue | Implemented starting point | Still needs validation or extension |
| --- | --- | --- |
| #12 | Session auth, HTTP/WS, contracts, console, audio framing and adapter boundary | Swift decoding review, reachable HTTPS endpoint and real ASR adapter |
| #15 | Exact spans, batched Jev admission, private-subspan veto, wait/clarification | Live semantic evaluation, native continuation assembly |
| #16 | Official Exa adapter, cancellation, bounded passages and source grouping | Live source inspection and freshness evaluation; optional alternate query |
| #17 | Typed judgment, conservative verdict/source gates and retained citations | Expand reviewed source rubric only with evidence; live demo citation inspection |
| #18 | Pure notification policy and action fixtures | App delivery/repeat/mute validation; explicit topic matching remains unset |
| #20 | Deadlines, bounded queues/cache, epoch/revision cancellation, attempt budgets and sanitized in-memory diagnostics | Venue load testing; provider retries are deliberately absent, 429 returns an operational error |
| #24 | 48-case manifest, 12 reserved held-outs, deterministic runner, evaluation/deck drafts | Live and hardware measurements, human citation review and joint rehearsal |

Run `npm run evaluate` for the development fixture report. It measures deterministic control flow, not provider accuracy. The issue set remains open because the live/native acceptance criteria are not yet fulfilled.

Dependencies are limited to the selected stack: Fastify/WebSocket transport, Zod wire validation, official Exa SDK and `tldts` Public Suffix List grouping; TypeScript/tsx, ESLint and Vitest provide the local gate. Versions and transitive dependencies are pinned by the lockfile.
