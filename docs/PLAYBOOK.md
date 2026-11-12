# Junction 2026: agent playbook (team of 2-3)

The full research behind these choices, with sources, is in [research.md](research.md).

## Roles
- **Type cycle**: everyone builds and everyone reviews exactly one teammate. The reviewer approves and merges once CI is green.
  | Owner | Reviewed and merged by |
  |---|---|
  | 🔥 fire: Cipriamn | 💧 water: erick-dsnk |
  | 💧 water: erick-dsnk | 🌱 grass: Davidtzuke |
  | 🌱 grass: Davidtzuke | 🔥 fire: Cipriamn |

  The **Type Review Cycle** workflow labels each PR with its owner's type and requests the review. The type comes from the issue the PR closes, so agent PRs reach the right reviewer too, or failing that from the PR author.
- **Shared foundations** (schema, shared types, API contracts) are owned by one person in wave 1. Later PRs that need changes there flag it under **Needs owner** and don't make the change themselves.
- **Agents**: cloud sessions, Copilot and Codex take the `agent:*` issues. Keep **no more than ~5 agent PRs open** at once.

## Week before (~3-4 h total)
| | Task | Time |
|---|---|---|
| 1 | Create the GitHub repo from this folder and push. Protect `main`: require the **CI** check, and leave AI review advisory | 15 min |
| 2 | Pick the stack. Scaffold it with auth stubbed, the DB wired and a deploy working, plus **preview deploys on every PR**. Add `lint`, `typecheck`, `test` and `check` npm scripts | 2-3 h |
| 3 | Fill in the Stack and Commands sections of `AGENTS.md` | 15 min |
| 4 | In Claude Code, run `/install-github-app`. Then `claude setup-token` and save the result as the repo secret `CLAUDE_CODE_OAUTH_TOKEN` | 10 min |
| 5 | `scripts/bootstrap-labels.sh`. File a dummy issue labeled `claude` and check a PR comes back | 15 min |
| 6 | Open a dummy PR and check Claude Review posts at most 5 findings | 5 min |
| 7 | Cloud environment (claude.ai/code → environment settings): a setup script that runs `npm ci` in under 5 min, plus network access and secrets. Smoke test: `claude --cloud "run npm run check and report"` | 20 min |
| 8 | Copilot: turn on the coding agent for the repo and run the **Copilot Setup Steps** workflow once. Codex: connect the repo in ChatGPT → Codex, and in Code review settings either turn on automatic review or leave it off. **Choose one reviewer:** Claude Review (default here) or Codex | 15 min |
| 9 | Each teammate: check plan quotas for cloud sessions, Copilot premium requests and Codex. Run `/fewer-permission-prompts` after a practice session | 10 min |
| 10 | Optional: add a browser-verify skill (e.g. agent-browser) so agents can screenshot the UI as evidence | 20 min |

## Day of
1. **Plan (45-90 min, everyone):** write the PRD together in plan mode and save it as `docs/plan.md`. Decide the architecture yourselves, not the agents.
2. **Ticketize (15 min):** run `/ticketize`. Check the table: wave 1 holds the foundations, and no two issues in a wave own the same file. Approve it.
3. **Wave 1 (humans):** builders do the foundations locally (`claude -w <name>` per issue, then `/work-issue <n>`). Your reviewer merges.
4. **Dispatch waves 2+:** `/dispatch 2`. Cloud sessions, Copilot and Codex open PRs, and Claude Review comments on each.
5. **Review loop (everyone):** clear your review queue (`gh pr list --search "review-requested:@me"`) before you dispatch more work. CI must be green. Read the evidence in the PR body and fix or ask (`@claude <fix>` on the PR, or turn on auto-fix in the cloud session). Merge, then ask the next PRs in that area to rebase.
6. **Every ~4 h:** check you could demo right now. If not, stop dispatching and fix the main flow.
7. **Final 2 h:** freeze features. Polish the demo flow, run `/code-review` locally on the final diff, and rehearse.

## Cheat sheet
| Want | Do |
|---|---|
| Agent works an issue in the cloud | `/dispatch <wave>`, or `claude --cloud "Use work-issue for #12"` |
| Send a whole wave to Claude cloud sessions (your plan, steerable) | `/dispatch 2 --all cloud` |
| Send a whole wave to the GitHub Action (team can watch on the issues) | `/dispatch 2 --all action` |
| Local isolated session | `claude -w issue-12` → `/work-issue 12` |
| Pull a cloud session back to your machine | `claude --teleport` |
| Agent fixes a PR | comment `@claude <what to fix>` on the PR |
| Quick blocking-only review | ask Claude to "use the reviewer agent" before pushing |
| Hand a small task to Copilot or Codex | label the issue `agent:copilot` or `agent:codex`, then `/dispatch` |

## Guardrails already in place
- `.claude/settings.json` allows the common read, test and git commands. Push, merge and issue creation ask first. `.env*` reads, force-push, pushing to main and `rm -rf` are denied.
- Hooks: install deps in cloud sessions, format each edited file with prettier, and block stopping while typecheck fails.
- The GitHub Action responds only to users with write access. It never interpolates issue text into prompts and has no extra secrets.

## Don't
- Run more than one AI reviewer, or review on every push.
- Fan out vague tickets, or more than ~5 agents at once.
- Use `--dangerously-skip-permissions` outside a container.
- Install a mega config pack. Add a skill only when you find you need it.
