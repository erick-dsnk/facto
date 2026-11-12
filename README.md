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
