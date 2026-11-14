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

## Deploy (Railway)

The API runs as one Railway service in EU West. `railway.json` sets the start command (`npm start`, which runs `tsx`, now a runtime dependency), the `/health` healthcheck and a single replica, because sessions live in memory.

1. Create the service from this repo and enable auto-deploy from `main`.
2. Set these variables in the Railway dashboard (never in the repo): `HOST=0.0.0.0`, `PIPELINE_MODE=live`, `JEV_API_KEY`, `EXA_API_KEY`, `DEEPGRAM_API_KEY`, `DEMO_JOIN_CODE` (8+ characters), `DEMO_JOIN_EXPIRES_AT` (ISO timestamp), `ALLOWED_ORIGINS`. Railway provides `PORT`.
3. Leave `TLS_CERT_PATH` and `TLS_KEY_PATH` unset. Railway terminates TLS, so clients use `https://` and `wss://` on the Railway domain.
4. Check `GET /health` on the public domain. It reports mode and provider readiness without credentials.

`.env.example` lists every variable.
