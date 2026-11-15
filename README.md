# Junction 2026 starter: agent-ready repo

The stack isn't chosen yet. This repo holds the agent setup: shared context, guardrails, skills, issue-to-agent dispatch and CI review.

Start with **[docs/PLAYBOOK.md](docs/PLAYBOOK.md)**.

| Path | What it is |
|---|---|
| `AGENTS.md` (and the `CLAUDE.md` symlink) | Shared context for Claude, Codex and Copilot |
| `REVIEW.md` | Rules that keep AI review to blocking issues only |
| `.claude/settings.json`, `.claude/hooks/` | Permissions and hooks for deps, format and typecheck |
| `.claude/skills/` | `/ticketize`, `/dispatch`, `/work-issue`, `/verify` |
| `.claude/agents/reviewer.md` | Read-only reviewer subagent |
| `.github/workflows/` | CI gate, @claude/label → PR, Claude Review, Copilot setup |
| `scripts/` | `bootstrap-labels.sh`, `dispatch.sh` |
| `docs/research.md` | Research report with sources |

## Self-hosted admission and privacy

The API can use a self-hosted Laya admission gate while keeping Jev for evidence judgment. Within the fact-checking pipeline, Laya checks candidates before external retrieval or Jev judgment. Candidates flagged as containing private data are skipped; those flagged as personal experiences take a terminal path without search or judgment. Missing or malformed privacy scores stop processing before retrieval. Source queries use the admitted candidate's checked text and subject; Jev judgment receives the checked claim and retained evidence. These payloads exclude the original transcript and surrounding context.

Enable this combination in the API environment:

```dotenv
PIPELINE_MODE=live
DECISION_PROVIDER=jev
ADMISSION_PROVIDER=laya
LAYA_URL=http://127.0.0.1:8765
LAYA_API_KEY=<separate Laya server secret>
```

Keep `JEV_API_KEY` and the retrieval credentials configured as described below. Set `LAYA_URL` to the address reachable from the API; the localhost example assumes both services run on the same host. The [Laya hosting guide](docs/jev-laya-evaluation.md) covers downloading the saved admission model, verifying it, starting an authenticated inference server and connecting the app. This configuration is opt-in and does not deploy the model automatically.

Self-hosting keeps admission inputs on infrastructure you control and reduces the private content exposed to search providers and Jev. The pinned Laya inference server processes requests in memory and has no built-in request-history store. That does not cover the API's session state or host and proxy logging: the API holds input and context in memory until session deletion or expiry (five minutes by default). Keep `DEBUG_TRANSCRIPTS` off to avoid transcript logs and the optional debug feed, and configure host and proxy logs without request bodies. Audio transcription uses Deepgram **before** admission, so this gate does not prevent audio from reaching Deepgram.

The privacy gate is a safeguard, not a guarantee: a classifier can miss private content, and a nonpersonal statement can still contain confidential information. Passing admission does not establish that information is publicly available. The saved fine-tune is experimental and supervises claim kind, private data and personal experience; it has not established the reliability of the entire admission contract. Admitted claims and their evidence still leave the self-hosted boundary for retrieval and Jev judgment.

## Deploy (Cloudflare)

The API runs as one Cloudflare Container behind a Worker (issue #43). The Worker sends every request, HTTP and WebSocket alike, to one Durable Object named `api`, which owns the only container, because sessions live in memory. Files: `Dockerfile`, `.dockerignore`, `wrangler.jsonc`, `deploy/cloudflare/` (Worker code and a pinned `wrangler`).

- **URL:** `https://actually-api.<account-subdomain>.workers.dev` (`wss://` on the same host). It comes from `name` in `wrangler.jsonc` and stays the same across deploys and restarts. Don't rename the Worker.
- **Lifetime:** an open WebSocket keeps the instance up. After the last request the container runs for 6 more hours (the maximum inactivity timeout), then stops. The next request cold-starts it in a few seconds.
- **What drops sessions:** a deploy closes open WebSockets right away (`code_update_strategy: immediate`), so clients reconnect. If the image, a var or a secret changed, the first request after the deploy replaces the container, which drops every session. A Worker-only change keeps the container and its sessions.

### Prerequisites

- **Workers Paid plan** ($5/month). Containers aren't available on Free. The instance is `standard-1` (1/2 vCPU, 4 GiB): left running all day it uses the included memory in about a day, then costs roughly $0.85 per day.
- **Docker running** locally (`docker info`). `wrangler deploy` builds the image for linux/amd64 and pushes it to Cloudflare's registry.
- **Logged in:** `cd deploy/cloudflare && npm ci && npx wrangler login`. Every command below runs from `deploy/cloudflare`, so it uses the pinned wrangler.

### Configuration

Vars in `wrangler.jsonc`, committed: `PIPELINE_MODE=live`, `TRUST_PROXY=1`, `DEEPGRAM_KEYTERMS` (optional comma list of extra names for Deepgram keyterm prompting, added to Facto, Anthropic, Nvidia, Jensen Huang, Meta, Ray-Ban and OpenAI; empty adds nothing) and `DEBUG_TRANSCRIPTS` (empty, so off; `1` logs every final Deepgram result with per-word confidence as `[asr:final]` lines, which includes what bystanders said, so an operator sets it only for a debugging session). The in-memory feed at `GET /v1/debug/feed` additionally needs the secret `DEBUG_FEED_KEY` (16+ characters, sent as `x-debug-key`). The join code never opens it, without the key the route does not exist and nothing is recorded, and a session's entries are purged when it is deleted or expires. The Worker also sets `HOST=0.0.0.0` and `PORT=8080` for the container.

Secrets, set once each with `npx wrangler secret put <NAME> --config ../../wrangler.jsonc`. Wrangler prompts for the value. Never commit or paste values anywhere:

| Name | Value |
|---|---|
| `JEV_API_KEY` | Jev key (live mode refuses to start without it) |
| `EXA_API_KEY` | Exa key (same) |
| `DEEPGRAM_API_KEY` | Deepgram key (without it `/health` shows `"asr":"not_configured"`) |
| `GOOGLE_FACTCHECK_API_KEY` | Optional Google Fact Check Tools key. Without it the fact-check source is skipped |
| `DEMO_JOIN_CODE` | 8+ characters |
| `DEMO_JOIN_EXPIRES_AT` | ISO timestamp after the demo, e.g. `2026-12-31T23:59:00Z` |
| `ALLOWED_ORIGINS` | `https://actually-api.<account-subdomain>.workers.dev` (for the `/` console page; the iOS app sends no `Origin`) |

To test without the Exa key, deploy in fixture mode with `npx wrangler deploy --config ../../wrangler.jsonc --var PIPELINE_MODE:fixture`. The next deploy without `--var` goes back to live. Leave `TLS_CERT_PATH` and `TLS_KEY_PATH` unset: Cloudflare terminates TLS.

### Deploy

Deploy from an up-to-date `main` checkout (the Deepgram adapter and `TRUST_PROXY` are on `main` since #38 and #39 merged):

```sh
cd deploy/cloudflare && npm ci && npm run deploy
```

First time: deploy, then set the secrets above. Until they exist, requests get `503 {"error":"backend_unavailable"}`. Setting a secret creates a new version, and the next request starts the container with it. The first deploy can take a few minutes before container requests succeed.

`npm run check` in `deploy/cloudflare` typechecks the Worker and runs `wrangler deploy --dry-run`, which builds the image locally and uploads nothing.

### Verify

```sh
BASE=https://actually-api.<account-subdomain>.workers.dev
read -rs JOIN && export JOIN   # paste the join code; it stays out of shell history
```

1. Health, live with ASR. Expect `"mode":"live"` and `"asr":"configured_unverified"`:
   `curl -s $BASE/health`
2. Join. Expect `201` with the code and `401` with a wrong one:
   `curl -s -o /dev/null -w '%{http_code}\n' -X POST $BASE/v1/sessions -H 'content-type: application/json' -d "{\"joinCode\":\"$JOIN\"}"`
   `curl -s -o /dev/null -w '%{http_code}\n' -X POST $BASE/v1/sessions -H 'content-type: application/json' -d '{"joinCode":"wrong-code"}'`
3. Typed check, live verdict. Join and keep the session:
   `S=$(curl -s -X POST $BASE/v1/sessions -H 'content-type: application/json' -d "{\"joinCode\":\"$JOIN\"}"); SID=$(echo "$S" | node -pe 'JSON.parse(require("fs").readFileSync(0)).sessionId'); TOKEN=$(echo "$S" | node -pe 'JSON.parse(require("fs").readFileSync(0)).token')`
   Open the stream in a second terminal (verdicts arrive there as `claim.result`) and leave it open for step 4:
   `npx wscat@6.1.0 -c "wss://${BASE#https://}/v1/sessions/$SID/stream" -s actually-v1 -H "Authorization: Bearer $TOKEN"`
   Then send the check. Expect `202`:
   `curl -s -w ' %{http_code}\n' -X POST $BASE/v1/sessions/$SID/checks -H 'content-type: application/json' -H "authorization: Bearer $TOKEN" -d "{\"schemaVersion\":1,\"requestId\":\"req-cf-1\",\"sessionId\":\"$SID\",\"sessionEpoch\":1,\"revision\":1,\"mode\":\"typed\",\"text\":\"The Eiffel Tower opened in 1889.\",\"language\":\"en\",\"capturedAt\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"capture\":{\"source\":\"typed_fixture\",\"segmentId\":\"typed-1\",\"confidence\":1,\"final\":true},\"context\":[],\"userInitiated\":true}"`
4. WebSocket: the `wscat` session from step 3 should stay connected for 3 minutes (the server closes it when the 5-minute session ends). wscat doesn't ping, so type something every minute or so to stay under Cloudflare's idle timeout; the app pings every 2 s.
5. Join limit counts real clients. From network A (e.g. Wi-Fi), 10 bad joins, then an 11th. Expect `401` ten times, then `429`:
   `for i in $(seq 1 11); do curl -s -o /dev/null -w '%{http_code} ' -X POST $BASE/v1/sessions -H 'content-type: application/json' -d '{"joinCode":"wrong-code"}'; done; echo`
   Within 60 s, from network B (e.g. a phone hotspot), the step 2 good join still returns `201`. If network B also gets `429`, the proxy chain adds an address, so set `TRUST_PROXY` to `2`, redeploy and retest.
6. One instance and a stable URL: `npx wrangler containers list` shows one application, `npx wrangler containers instances <ID>` shows one instance, and `$BASE` is unchanged after a redeploy. Only a redeploy (or a changed secret) drops sessions.

If a request gets Cloudflare error 1010 (Browser Integrity Check on `workers.dev`), send a normal User-Agent, e.g. `curl -A 'actually-smoke/1.0'`.

### Redeploy and logs

- Redeploy: run the same deploy command. Clients reconnect and rejoin if the container was replaced.
- Live logs from the Worker and container: `npx wrangler tail --config ../../wrangler.jsonc`, or the Worker's Logs tab in the dashboard (observability is on).
- Container state: `npx wrangler containers list`, then `npx wrangler containers instances <ID>`.

## Deploy (Railway)

The API runs as one Railway service in EU West. `railway.json` sets the start command (`npm start`, which runs `tsx`, now a runtime dependency), the `/health` healthcheck and a single replica, because sessions live in memory.

1. Create the service from this repo and enable auto-deploy from `main`.
2. Set these variables in the Railway dashboard (never in the repo): `HOST=0.0.0.0`, `PIPELINE_MODE=live`, `JEV_API_KEY`, `EXA_API_KEY`, `DEEPGRAM_API_KEY`, optionally `GOOGLE_FACTCHECK_API_KEY` and `DEEPGRAM_KEYTERMS`, `DEMO_JOIN_CODE` (8+ characters), `DEMO_JOIN_EXPIRES_AT` (ISO timestamp), `ALLOWED_ORIGINS`. Railway provides `PORT`. On Railway an unset `HOST` falls back to `0.0.0.0` and `TRUST_PROXY` to `1`, so the join limit counts each client address instead of the proxy's. Raise `TRUST_PROXY` only if another proxy, such as a CDN, sits in front of Railway.
3. Leave `TLS_CERT_PATH` and `TLS_KEY_PATH` unset. Railway terminates TLS, so clients use `https://` and `wss://` on the Railway domain.
4. Check `GET /health` on the public domain. It reports mode and provider readiness without credentials.

`.env.example` lists every variable.
