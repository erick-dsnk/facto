# Pre-Hackathon Agent Environment Playbook (Nov 2026)

*Synthesized from 7 parallel research angles: official docs, GitHub repos, Hacker News, Reddit, blogs and social posts, cloud task assignment, and CI review. "Corroboration" counts how many of the 7 angles found the practice on their own. Claims that rest on one source are marked **[single source]**.*

---

## 1. TL;DR: the highest-leverage moves, ranked

1. **Before the event, split the idea into small tickets that each do one thing.** Write a PRD, turn it into 20-50 issues, and give each issue acceptance criteria and pointers to the files it touches. Every 2026 Anthropic hackathon winner write-up describes doing this, and it is what makes fan-out to parallel agents work. One example is the Opus 4.8 Build Day winner, who ran about 50 Notion tickets with a separate workflow per ticket. (5/7 angles)
2. **Install `anthropics/claude-code-action@v1` with `/install-github-app`.** This gives you `@claude` on issues and PRs, plus `label_trigger: "claude"` and `assignee_trigger: "claude"`, so labelling or assigning an issue starts an agent. Setup takes about 5 minutes. Leave out `github_token`, or CI won't run on Claude's commits. (7/7 angles)
3. **Fan out cloud sessions from the terminal.** Agree on a plan in plan mode, then run `claude --cloud "<task>"` once per ticket. Bring a session back to your machine with `--teleport`. Turn on `/autofix-pr` so an agent fixes CI failures and responds to review comments. (6/7 angles)
4. **Pre-bake the cloud environment the day before.** Write a cached setup script that finishes in 5 minutes or less (the cache lasts about 7 days), plus a `SessionStart` hook gated on `CLAUDE_CODE_REMOTE`. If you use Copilot, do the same with `copilot-setup-steps.yml`. Without this, every cloud agent spends its first minutes installing dependencies. (4/7 angles)
5. **Use one AI reviewer and limit it to blocking issues.** For example, the `code-review@claude-plugins-official` plugin in CI with `--comment`, Codex `@codex review` (which flags only P0 and P1 issues by default), or CodeRabbit with a "blocking only" instruction. Exclude anything lint or typecheck already catches. (6/7 angles)
6. **Use hooks, not prose, for anything that must always happen.** A PostToolUse formatter, a Stop hook that requires typecheck to pass, a committed permission allowlist, and deny rules for `.env`. Claude Code hooks run every time; instructions in CLAUDE.md are hit and miss. (5/7 angles)
7. **Keep CLAUDE.md or AGENTS.md short and focused on commands, and share one file across tools.** Aim for under about 200-300 lines covering commands, conventions and gotchas, plus a "Done When" section. Symlink `CLAUDE.md` to `AGENTS.md` so Claude, Codex, Cursor and Copilot all read the same file. (5/7 angles)
8. **Give each agent its own git worktree, run at most about 3-5 agents per repo, and have one person merge.** Use `claude -w` / `--worktree`, a `.worktreeinclude` file for `.env`, and decide up front which agent owns which files. The bottleneck is review, not code generation. (6/7 angles)
9. **Install a small set of skills or plugins and read them first.** Use a curated marketplace (anthropics/skills, claude-plugins-official, or a trimmed-down ECC), plus your own `/deploy`, `/scope` and `/verify` skills. Share them with the team through a project-scoped plugin marketplace. (5/7 angles)
10. **Have a working scaffold and deploy pipeline before the clock starts, and let agents check their own work against a preview URL.** That means auth, database and hosting already wired, a preview deploy for every PR, and a browser skill such as agent-browser or Playwright. (4/7 angles)

---

## 2. Sections

### 2.1 Automated task assignment to cloud agents

**What people actually do**

| Mechanism | Concrete config or command | Corroboration |
|---|---|---|
| **claude-code-action (issue to PR)** | `/install-github-app`, then `.github/workflows/claude.yml` with `on: issues: [opened, assigned, labeled]` + `issue_comment`; inputs `label_trigger: "claude"`, `assignee_trigger: "claude"`, `track_progress: true`, `branch_prefix`, `claude_args: "--max-turns 5 --model claude-sonnet-5"`. Permissions: contents, PRs and issues `write`, `id-token: write`, `actions: read`. Auth uses `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN` (from `claude setup-token`). Do **not** pass `github_token: ${{ secrets.GITHUB_TOKEN }}`. | 7/7 |
| **Claude Code cloud sessions** | `claude --permission-mode plan`, commit `docs/plan.md`, then one `claude --cloud "<task>"` per task (`--remote` is a deprecated alias). Steer with `claude -p "msg" --cloud <id>`. Pull back with `claude --teleport <id>`, `/tp` or `/tasks`. `/autofix-pr` watches CI and review comments. Repos without the GitHub App: `CCR_FORCE_BUNDLE=1` (under 100 MB). | 6/7 |
| **Cloud environment pre-bake** | A setup script in claude.ai/code environment settings is snapshotted if it finishes in about 5 minutes, and reused for about 7 days. Run installs in parallel with `&` and `wait`. In `.claude/settings.json`, a `SessionStart` hook (matcher `startup\|resume`) runs a script that starts with `[ "$CLAUDE_CODE_REMOTE" != "true" ] && exit 0`. Put keys in **network secrets**, not env vars. The cache holds files only, so start the DB and services in each session. | 4/7 |
| **Scheduled tasks ("Routines")** | Created with `/schedule` or at claude.ai/code/routines. Triggers are cron (at most hourly), an API `POST .../routines/<trig_id>/fire` (beta header `experimental-cc-routine-2026-04-01`), or GitHub events with branch, label and title filters. The fire payload arrives wrapped in `<routine-fire-payload>`, so the prompt must say explicitly to act on it. Uses: nightly triage, a deploy smoke check called from CD, a reviewer triggered on every opened PR. | 6/7 |
| **Copilot cloud agent** | Assign the issue to Copilot, or `gh agent-task create -F task.md --follow` (gh 2.80+). Environment comes from `.github/workflows/copilot-setup-steps.yml`, a job named exactly `copilot-setup-steps` with timeout 59 minutes or less. Context goes in `.github/copilot-instructions.md`. Automations (since June 2026) are configured in the UI or API only. Each session costs 1 premium request plus Actions minutes. | 6/7 |
| **GitHub Agent HQ (multi-vendor)** | `gh issue assign 142 --assignee @codex`, or `@codex`, `@claude` or `@copilot` in PR comments. Agents cannot merge their own PRs. | 2/7 |
| **Codex cloud** | Assign Linear issues to Codex, or comment `@Codex fix this in org/repo`. To auto-delegate, add a Linear triage rule set to Delegate > Codex. `codex cloud exec --attempts 1-4` gives best-of-N **[third-party blog only]**. | 4/7 |
| **Linear as dispatcher** | Settings > Code & reviews. Assign or @mention Codex, Cursor, Copilot or Devin. "Coding sessions" (June 2026) run Claude Code or Codex in a sandbox. Needs AI credits; the sandbox costs about $0.125-$0.50 per 20 minutes. The open-source Cyrus is a Claude Code runner for Linear. | 4/7 |
| **Cursor Automations** | `.cursor/environment.json` (`snapshot` or `build.dockerfile`, `install`, `start`, `terminals`). Triggers: PR events, CI completed, labels, Slack, Linear, Sentry, PagerDuty, webhooks, cron. | 4/7 |
| **Slack to agent** | `@Claude`, `@Codex` or `@cursor` in a thread starts a cloud task that posts the PR link back to the thread. Lets non-coding teammates file small fixes. | 1/7 angle (4 official sources) |
| **Google Jules** | Label an issue `jules`. Click "Run and Snapshot" on the environment. Scheduled tasks, a v1alpha REST API, and `ihildy/jules-task-queue` for hitting concurrency limits. Generous free tier, so it works as a cheap extra worker. | 3/7 |
| **gh-aw (GitHub Agentic Workflows)** | Markdown workflows compiled with `gh aw compile`. `safe-outputs: assign-to-agent: {name: copilot, max: 1}` lets a triage workflow hand issues to Copilot. | 3/7 |
| **Ticket decomposition tools** | `automazeio/ccpm` (PRD, epic, GitHub sub-issues, then parallel agents), `eyaltoledano/claude-task-master` (`prd.txt`, then `tasks.json` with dependencies, run as MCP), `github/spec-kit`, `obra/superpowers`. | 5/7 |
| **"Every issue gets an agent attempt"** | A startup's rule: whoever opens an issue assigns it to Copilot, and unused PRs are deleted. A solo dev files issues from the GitHub mobile app and reads the PR about 20 minutes later. | 1/7 (HN, several commenters) |

**Caveats and pushback**
- **Quota and caps.** Cloud sessions and Routines draw on the individual account's plan, and tasks are **not shared** with the team. Sources disagree on Routine caps. The docs give 100 scheduled runs per hour per account and 30 run-now or API fires per hour per task. A blog cites daily caps of Pro 5, Max 15 and Team 25. An April 2026 HN comment cites 15 per day. **Check before relying on any of these.**
- **Output quality tracks issue quality.** Narrow issues that do one thing work. Broad ones produce approaches that don't fit together. The Copilot agent forgets earlier decisions after about 20-30 turns **[single source]**.
- **Billing.** The GitHub Action bills the API wallet unless you use `CLAUDE_CODE_OAUTH_TOKEN`; one HN user was surprised by a bill of $50+. Cursor Automations always use the full context window. Each Copilot session is 1 premium request.
- **Projects (claude.ai/code).** Threads read `CLAUDE.md` but **not** repo skills, `.claude/settings.json` or `.mcp.json`. They default to Opus at high effort, which drains plans fast. Pro, Max and Ultra only; public beta.
- **Linear and Cursor integration bugs.** Users report duplicate agents per @mention and a "No default repository configured" error. Test this the week before.
- **Pushback.** "Check in unreviewed slop." Agents pull in tiny random dependencies. The ccpm style of ticketing gets "So we're doing waterfall again?"

### 2.2 CI/CD automated agent review

**What people actually do**

| Mechanism | Concrete config or command | Corroboration |
|---|---|---|
| **Review plugin in CI** | `on: pull_request: [opened, synchronize, ready_for_review, reopened]` with `plugin_marketplaces: "https://github.com/anthropics/claude-plugins-official.git"`, `plugins: "code-review@claude-plugins-official"`, `prompt: "/code-review:code-review --comment ${{ github.repository }}/pull/${{ github.event.pull_request.number }}"`, `claude_args: '--allowedTools "mcp__github_inline_comment__create_inline_comment"'`. That last line is **required** to start the inline-comment server. For a repo skill, check out the repo and set `prompt: /skill-name`. | 5/7 |
| **CI-failure auto-fix** | `examples/ci-failure-auto-fix.yml`: `workflow_run` on CI `completed`, with the condition `conclusion == 'failure' && !startsWith(head_branch, 'claude-auto-fix-ci-')`. That guard prevents infinite fix loops. | 2/7 |
| **Cloud auto-fix** | `/autofix-pr`, or the Auto-fix toggle on the claude.ai/code Changes card. It can't detect merge conflicts, and it replies under **your** GitHub user, which can trigger comment-driven automation such as Atlantis. | 4/7 |
| **Managed Claude Code Review** | Turned on by an org Owner. Levels are Quick, Standard and Deep. `@claude review` on demand. Tuned with a root `REVIEW.md` (e.g. "Report at most five Nits", "Do not report: anything CI already enforces; src/gen/; *.lock"), which can include up to 8 `@file.md` references and is read from the protected base branch. Results come as a non-blocking check run. **Team and Enterprise only.** About $15-25 and about 20 minutes per review **[press, Reddit and HN only; not official pricing]**. | 4/7 |
| **Local pre-push review** | `/code-review` (`--fix`, `--comment`, effort levels, `--max-findings`). `/pr-review-toolkit:review-pr` runs specialized subagents. `/code-review ultra` is a cloud fleet that takes 5-15 minutes, with 3 free runs on Pro, Max and Ultra. `/security-review`. | 3/7 |
| **Codex review** | Turn on Automatic review at chatgpt.com/settings/code-review, or comment `@codex review` or `@codex security review`. Add a `## Review guidelines` section to `AGENTS.md`; nested AGENTS.md files scope rules to their folders. By default it flags only P0 and P1. `codex review --base main` works as a local gate. `openai/codex-action@v1` with `sandbox: read-only` and `allow-users`. | 5/7 |
| **Cross-model review (Claude writes, GPT reviews)** | `/plugin marketplace add openai/codex-plugin-cc`, then `/plugin install codex@openai-codex`, `/codex:review --background` and `/codex:adversarial-review`. A Stop-hook loop: `hamelsmu/claude-review-loop`. Tip: give the reviewer only the diff. | 3/7 |
| **Copilot code review** | Turn on automatic review in a branch ruleset. Since July 2026 it reads `REVIEW.md`, `CLAUDE.md` and `AGENTS.md` from the **head** branch. Supports `.github/skills/*/SKILL.md` and MCP (GA July 29, 2026). "Fix batch with Copilot" hands several comments to the cloud agent. | 2/7 |
| **Cursor Bugbot + Autofix** | Rules in `.cursor/BUGBOT.md` (path not verified by the CI-review angle). Autofix fixes and tests its own findings in a VM. Cursor reports the resolution rate rose from 52% to 76%. | 3/7 |
| **CodeRabbit** | `.coderabbit.yaml` with `path_filters` excluding lockfiles and generated code, and `path: '**/*'` with "Only comment on issues that would block merging". Pro is reportedly free for public repos **[aggregator claim]**. | 3/7 |
| **Quieter review wrappers** | The bot resolves its own stale comments, injects only rules that match changed paths, and is told no praise or emojis and to comment only with a quoted rule plus a runtime impact. | 1/7 (Reddit) |
| **Fan-out reviewer at scale** | Cloudflare uses a coordinator plus up to 7 specialized sub-reviewers, a "What NOT to flag" section, filtered diffs and XML severity tags. About 1.2 findings per review; median cost $0.98 over 131k reviews. | **[single source: Cloudflare blog via HN]** |
| **Security lane** | `anthropics/claude-code-security-review@main` with `comment-pr: true`. Its README says it is not hardened against prompt injection, so use it on trusted PRs only. | 2/7 |
| **Thin required gate** | Lint, typecheck, unit tests and a secret scan block the merge; the AI review only advises. Add CODEOWNERS entries for `CLAUDE.md`, `AGENTS.md` and `.cursor/`. | 2/7 |

**Caveats and pushback**
- **Noise is the main complaint.** A test of four bots on one PR produced 60 line comments. In one January 2026 test Copilot made 37 comments on a PR, of which about 55% were acted on. Greptile found that learning from past upvotes and downvotes raised the share of comments addressed from 19% to more than 55%. Drop any reviewer whose comments you act on less than about 40% of the time.
- **Auto-fix loops.** Agents spin on flaky tests, and PR monitors treat their own replies as new feedback. Use `allowed_bots` (bots are rejected by default), branch-prefix guards and iteration caps.
- **Forks.** On public repos, fork PRs get no secrets, so only same-repo branches get reviewed. That is fine for a team working in one repo.
- **Skepticism.** "PR reviews were never the bottleneck." "Claude reviewing code Claude wrote." People call $15-25 per review "insane", and one Reddit estimate puts it at about $300 a day for 10-15 PRs.

### 2.3 Skills, slash commands, subagents and context files

**What people actually do**

- **Lean context file** (5/7). Keep it under about 200 lines (official docs) or under 300, with HumanLayer's own under 60. Limit it to Commands, Conventions and Gotchas. Bootstrap with `/init`, then trim with `/doctor prompt-audit` and check what loaded with `/context all`. Put path rules in `.claude/rules/api.md` with `paths:` frontmatter. Personal preferences go in a gitignored `CLAUDE.local.md`.
- **One shared brain across tools** (4/7). Run `ln -s AGENTS.md CLAUDE.md`, or make CLAUDE.md just `@AGENTS.md`. Claude Code reads AGENTS.md when no CLAUDE.md exists. Copilot review now reads `CLAUDE.md`, `AGENTS.md` and `REVIEW.md` too.
- **Sprint-spec AGENTS.md** with sections for Stack, Conventions ("stub auth for the demo"), Build & Test (exact ports) and **Done When** (the core flow works end to end and DEMO.md exists), which stops over-engineering **[single source: Vaughan Codex playbook]**.
- **Compressed docs index beats skills** **[single source: Vercel eval]**. In Vercel's eval, the baseline scored 53% and skills alone also 53%, because skills were never invoked in 56% of cases. Skills with explicit instructions scored 79%, and an AGENTS.md docs index scored 100%. To generate the index: `npx @next/codemod@canary agents-md`.
- **Skills for procedures** (5/7). Use `.claude/skills/<name>/SKILL.md`, with `disable-model-invocation: true` for side-effecting skills like `/release`. Typical hackathon skills are `/scope`, `/systematic-debugging`, `/deploy-<app>` and `/commit-push-pr`. The Opus 4.6 winner (CrossBeam) used 13 skills with 28 reference files, and a router that loaded only 3-5 of them per query **[counts from a secondary blog]**.
- **Read-only reviewer subagent**: `.claude/agents/reviewer.md` with `tools: Read, Grep, Glob`, told to report correctness gaps only. Boris Cherny's subagents are code-simplifier, verify-app, build-validator and code-architect.
- **Share skills through a plugin marketplace** (official docs). Create `.claude-plugin/marketplace.json`, check it with `claude plugin validate`, then `claude plugin marketplace add your-org/your-marketplace --scope project` and commit the settings. Loading the same plugins in CI through the action's `plugins` input means local and CI review use identical skills.
- **Curated catalogs** (4/7): `anthropics/skills` (about 193k stars), `claude-plugins-official` (about 47k), `hesreallyhim/awesome-claude-code`, `wshobson/agents`, `VoltAgent/awesome-claude-code-subagents`, `openai/skills`, `multica-ai/andrej-karpathy-skills` (a single drop-in CLAUDE.md), `npx skills add`, `npx claude-code-templates`.
- **Hackathon-winner config pack: ECC** (`affaan-m/everything-claude-code`, renamed `affaan-m/ECC`) (3/7). Install with `/plugin marketplace add affaan-m/everything-claude-code`, then `/plugin install everything-claude-code@everything-claude-code`. It came from the winners of the Anthropic x Forum Ventures NYC hackathon. Its MCP rule: under 10 MCPs and under 80 tools active.
- **Reference layout**: `ChrisWiles/claude-code-showcase` has CLAUDE.md, `.mcp.json`, a hooks `settings.json`, agents, commands, skills, a skill-suggestion `UserPromptSubmit` hook, and scheduled GitHub workflows.
- **Context files as a judged artifact.** `beck-source/claude-code-hackathon` requires `CLAUDE.md` and a Claude-generated `presentation.html` **[single source]**.

**Caveats and pushback**
- "Claude often ignores CLAUDE.md." People test this with the "Mr Tinkleberry" canary trick. The file is read on load and gets lost as context grows. An arXiv study from February 2026 questions how much AGENTS.md helps, and a bad one can be worse than none.
- Skills don't fire reliably unless you call them explicitly. Subagents don't get CLAUDE.md.
- **ECC is heavy.** Different versions list 27-47 agents and 64-181 skills. People worry about token use and say it is "too complex for what most people need". Trim it to 5-10 pieces. The star counts quoted (70k-153k) are unverified.
- There is overlap fatigue: five overlapping ways to "review code" (command, skill, subagent, plugin, just asking). Persona subagents get called "theatre". Boris Cherny's own setup is reportedly only lightly customized.
- Read community skills before installing them. Popular lists contain unvetted content.

### 2.4 Parallelism and guardrails

**Parallelism: what people do**
- **Built-in worktrees** (6/7). `claude -w <name>` / `--worktree` creates `.claude/worktrees/<name>`. A `.worktreeinclude` file (gitignore syntax) copies `.env` into each worktree, and `worktree.symlinkDirectories` handles `node_modules`. `/batch <migration>` splits work across 5-30 isolated subagents that each open a PR. `claude agents` opens the agent view. Agent teams need `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`.
- **Manual pattern.** `git worktree add -b x ../path`, one tmux session per worktree, and a dev server on its own port in each.
- **Tools.** Worktrunk (`wt switch -c -x claude feat`, about 12.4k stars), claude-squad, ccmanager, parallel-code, dagger/container-use, Conductor and Imbue Sculptor. Vibe Kanban is sunsetting and now community-maintained. `funador/claude-code-merge-queue` lands work from 4-5 agents one at a time with tests.
- **A split hackathon teams have used.** Torq ran five Claude instances, each owning one domain, with a feedback script so each agent could iterate against its metric. The Opus 4.7 2nd-place team ran 5-6 agents, one per domain. A common laptop mix is 3 local worktrees plus 4 Codex Cloud tasks.
- **Headless fan-out.** Loop `claude --bare -p "..." --allowedTools "Read,Edit,Bash(git commit *)" --permission-mode dontAsk --max-turns 20`. `/loop 15m check CI ... fix and push` watches CI.
- **Ralph loop** **[Reddit only]**: `while :; do cat PROMPT.md | claude -p; done` against `implementation_plan.md`, with fresh context on each pass. Cap the iterations.

**Parallelism: caveats**
- Practical ceiling is about **3-5 agents per repo**. Beyond about 5, agents spend more time resolving conflicts than coding (4/7 angles).
- The main failure is one agent making a foundational change (shared types, schemas, migrations) that breaks the others. Assign file ownership up front.
- In Skeptrune's run, 1 of 4 parallel attempts saved time. Treat parallel runs as best-of-N, not 4x throughput.
- Muxin Li's April 2026 post on losing the Opus 4.7 hackathon describes git conflicts, fragmented context and over-built scaffolding from running too many sessions without a prioritized backlog.
- The review bottleneck is real: "Now you can do 4X more code reviews!" One power user allows only **one active PR** at a time.

**Guardrails: what people do**
- **Hooks** (5/7). A PostToolUse `Edit|Write` hook runs the formatter, e.g. `bun run format || true`. A Stop hook runs `pnpm tsc --noEmit 1>&2 || exit 2`. Use pre-commit for ruff, ty, tsc and tests, plus Claude Code hooks, because git hooks may not fire when Claude commits.
- **Permissions** (5/7). For example `allow: ["Bash(pnpm tsc --noEmit)", "Bash(bun run test:*)"]`, `ask: ["Bash(git push *)"]`, `deny: ["Read(./.env)", "Read(./secrets/**)"]`. Deny rules hold even in auto and bypass modes. `/fewer-permission-prompts` builds an allowlist from your transcripts. New sessions default to auto mode, where a classifier vets risky commands.
- **Sandboxes.** Use `--dangerously-skip-permissions` only inside a devcontainer or a container with no git push credentials: Anthropic's reference devcontainer, `trailofbits/claude-code-devcontainer`, sandclaude, or awesome-AI-sandbox. `manuelschipper/nah` is a classifying PreToolUse guard. `trailofbits/claude-code-config` is a full baseline you install once on each teammate's machine.
- **CI security guardrail** (the Clinejection incident, February-March 2026). Cline's triage workflow used `allowed_non_write_users: "*"`, broad `--allowedTools` and interpolated `${{ github.event.issue.title }}` into the prompt. A malicious issue title led to about 4k compromised developer machines downstream. Rules: allow only write-access users to trigger, keep `--allowedTools` minimal, put no secrets in agent jobs, protect branches, and never interpolate untrusted text. **[One research angle, 3 sources]**

**Guardrails: caveats.** Guards are not airtight: a rogue agent can write malicious code and run `npm test`, and a network allowlist that includes gist.github.com still allows data to leak out.

### 2.5 MCP, tooling and deploy pipelines

- **Prepared starter stack** (4/7). Have auth, database, hosting and a test harness wired up before the clock starts. One recommended stack is Next.js, shadcn/ui, Tailwind, Supabase and Vercel. Deploy by hour 6, even half-broken, and every 4 hours check you could demo right now. HN skeptics agree that agents work best on a codebase whose architecture a human set, so they follow it rather than invent one. The reskilll guides are low-signal SEO content.
- **Self-verification** (3/7). Boris Cherny says giving Claude a way to verify its work gives 2-3x the quality. Concretely: a preview deploy for every PR, plus a browser skill. For agent-browser: `npm i -g agent-browser && agent-browser install`, copy its skill into `.claude/skills/`, then `snapshot -i`, `click @e9` and `screenshot`. Pulumi measured 82.5% less context than Playwright MCP **[single source]**. Ramp's Inspect attaches before and after screenshots to PRs.
- **Keep MCP lean.** Enable only 5-6 MCPs per project, because a 200k context can shrink to about 70k **[single source: ECC guide]**. Common choices: GitHub, Linear or JIRA, Supabase or Neon, Vercel, context7, Playwright. Copilot ships with GitHub and Playwright MCP on by default, read-only.
- **Warm images** **[single source: Ramp]**. Ramp rebuilds one image per repo every 30 minutes and pre-warms sandboxes while the user is still typing. About 30% of merged PRs come from it. The hackathon version is the cached cloud setup script from section 2.1.
- **Model per role.** Opus plans, Sonnet orchestrates, Haiku does research subagents. Linear's coding agent lets an admin choose Claude Opus 5.5, Sonnet 5 or GPT.
- **Hackathon skill kits.** `bernieweb3/hackathon-ai-devkit` offers repo-bootstrap, task-planner and deployment-prep skills. It is of unknown quality, so read it first.

---

## 3. Pre-hackathon checklist

*Time costs are rough estimates from the reported setup effort.*

### The week before
| # | Item | Time |
|---|---|---|
| 1 | Prepare the starter repo: framework, auth, DB, hosting, test harness, and a working deploy to production plus a preview for each PR | 2-4 h |
| 2 | Write a lean `AGENTS.md` (Stack, Conventions, Build & Test with exact commands and ports, Done When), then `ln -s AGENTS.md CLAUDE.md` | 30-45 min |
| 3 | Commit `.claude/settings.json`: allow/ask/deny permissions, a PostToolUse formatter hook, a Stop typecheck hook, and the `SessionStart` install hook gated on `CLAUDE_CODE_REMOTE` | 30-60 min |
| 4 | Run `/install-github-app`, then add `label_trigger` and `assignee_trigger`, `--max-turns`, a concurrency group and a timeout. Check you have **not** passed `github_token`. Test once with a dummy issue | 15-30 min |
| 5 | Add a review workflow (the code-review plugin with `--comment`), **or** turn on Codex automatic review with `## Review guidelines`, **or** CodeRabbit with a blocking-only config. **Choose only one.** | 15-30 min |
| 6 | Optional: copy `ci-failure-auto-fix.yml` and keep the branch-prefix loop guard | 15 min |
| 7 | Configure the cloud environment: a setup script under 5 minutes, network allowlist and secrets. If you use them, also `copilot-setup-steps.yml` or `.cursor/environment.json`. Run one `claude --cloud` smoke task | 30-60 min |
| 8 | Install the team skill set through a project-scoped plugin marketplace: the code-review plugin, a browser-verify skill, and your own `/deploy` and `/scope`. Read every third-party skill first | 1-2 h |
| 9 | Connect and test the Linear or Slack to agent integration, if you use one. Users report duplicate agents and "no default repo" errors | 30 min |
| 10 | Set up worktree tooling: `.worktreeinclude`, symlinked `node_modules`, a Worktrunk or tmux layout | 20 min |
| 11 | Protect `main` with lint, typecheck and tests required, AI review advisory only, and CODEOWNERS for the agent config files | 15 min |
| 12 | Check each teammate's plan quotas and caps: Routines, cloud sessions, Copilot premium requests. Set `--max-turns` and a cheap model in CI | 15 min |

### Day of
| # | Item | Time |
|---|---|---|
| 1 | Turn the idea into a PRD in plan mode, then into 20-50 issues that each do one thing, with acceptance criteria and file ownership. Use ccpm, Task Master or plain plan mode | 30-90 min |
| 2 | Choose one person to integrate and merge. Cap open PRs | 5 min |
| 3 | Dispatch: send the hard paths to local worktrees (3-5 at most), and the bounded or mechanical tickets to `claude --cloud`, `claude` labels, Copilot or Jules | ongoing |
| 4 | Turn on `/autofix-pr` for agent PRs. Ask for a rebase on conflicts, because auto-fix doesn't detect them | 1 min per PR |
| 5 | Optional: a Routine on `pull_request.opened`, or a nightly triage task while the team sleeps | 10 min |
| 6 | Steer in short cycles on small tasks. Run a few long sessions near the deadline. Polish the front end and demo | — |
| 7 | Run `/code-review` locally before each push. Save `/code-review ultra` for the final pre-demo merge | 5-15 min |

---

## 4. Anti-patterns and overkill for a 24-48 hour hackathon

- **Running 3-5 AI reviewers at once.** You get 60+ comments per PR and nobody reads them. Use one reviewer, limited to blocking issues.
- **Managed Claude Code Review on every push.** About 20 minutes and about $15-25 per review (press figures) is too slow for the merge loop. If you have it at all, use on-request mode only.
- **Installing a whole config pack.** Installing all of ECC means 27-181 skills plus many MCPs and burns context. Trim it.
- **More than 5 parallel agents per repo**, or vague tickets fanned out to many agents. You end up resolving conflicts instead of building.
- **Dynamic workflows with hundreds of agents** (for example Bun's Zig-to-Rust port). These suit well-specified bulk work only. Critics call them "an exciting new way to burn up as many tokens as possible" **[HN only]**.
- **5-round cross-model review loops.** They cost 3-5x a single pass, and the gains drop after round 1. Cap at 1-2 rounds.
- **Long, auto-generated CLAUDE.md files** full of style rules. Use linters and hooks for style instead.
- **Agent workflows triggered by untrusted users with broad tools and secrets** (the Clinejection pattern).
- **`--dangerously-skip-permissions` on a host that has push credentials.**
- **Enterprise metrics**: escaped-defect tracking, dual-review policies, a security-review lane when there is no auth or payments code.
- **Letting agents build the architecture from scratch.** Agents can write tests that amount to `expect(true)`. Judges complain about "vibe coded slop" and "nice UI with mock data". A real, working, verifiable product stands out.
- **Persona-heavy subagent "teams" that exist for show.** One winner's "AI team of engineers" was 20 skills.md files.

---

## 5. Gaps and unverified claims

- **Not researched or not verified:** Devin docs; Cursor background agents and Bugbot docs (pages undated, and some `.md` URLs returned 404); the `.cursor/BUGBOT.md` path; full Copilot review and custom-agent docs (taken from changelogs); Codex best-of-N and maintenance scripts; the exact JSON shape of `extraKnownMarketplaces`; the full Linear coding-sessions doc (404); the text of the Jules automate-github-issues skill; the Gemini Code Assist reviewer; the `@codex fix` flow.
- **Pricing and limits from secondary sources only:** Claude Code Review at $15-25 and about 20 minutes; CodeRabbit free for public repos; Routine daily caps, where three sources conflict; Codex `--attempts`.
- **Hackathon-specific evidence is thin.** No widely starred pre-hackathon setup repo exists; the hackathon kits found have 0-450 stars. There is no first-hand write-up of end-to-end issue-to-cloud-agent fan-out at a hackathon, and no write-up of a team wiring AI review into CI for one. The hackathon value ratings are researcher estimates.
- **Dated or doubtful items:** the Torq write-up's December 2024 date conflicts with the features it describes; the Godel agent-teams claim comes from search snippets only; Boris Cherny's thread was read through threadreaderapp and blog coverage; Reddit was read through a snapshot mirror, so dates are approximate; star counts are from 2026-11-11; the 633% merge-conflict and 79% multi-agent-failure figures are unverified.
- **Renames:** affaan-m/everything-claude-code is now affaan-m/ECC, forrestchang/andrej-karpathy-skills is now multica-ai/andrej-karpathy-skills, ruvnet/claude-flow is now ruvnet/ruflo, and sst/opencode is now anomalyco/opencode.
- **Research previews** that may change: scheduled tasks/Routines, Claude Projects, Slack integration, Codex security review.

---

## 6. Sources (deduplicated, grouped by section)

### Automated task assignment to cloud agents
- https://code.claude.com/docs/en/github-actions
- https://github.com/anthropics/claude-code-action
- https://github.com/anthropics/claude-code-action/blob/main/docs/usage.md
- https://github.com/anthropics/claude-code-action/blob/main/examples/claude.yml
- https://code.claude.com/docs/en/claude-code-on-the-web
- https://code.claude.com/docs/en/cloud-environments
- https://code.claude.com/docs/en/routines
- https://claude.com/blog/introducing-routines-in-claude-code
- https://claude.com/resources/articles/introducing-routines-in-claude-code
- https://codex.danielvaughan.com/2026/04/14/claude-code-routines-launch/
- https://makerkit.dev/blog/tutorials/claude-code-routines-guide
- https://news.ycombinator.com/item?id=47768133
- https://news.ycombinator.com/item?id=47772912
- https://code.claude.com/docs/en/claude-projects
- https://code.claude.com/docs/en/agents
- https://code.claude.com/docs/en/slack
- https://claude.com/blog/claude-code-and-slack
- https://siliconangle.com/2025/12/08/agentic-coding-comes-slack-anthropic-launches-claude-code-integration/
- https://codex.danielvaughan.com/2026/03/27/codex-slack-linear-cloud-tasks/
- https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/customize-the-agent-environment
- https://docs.github.com/en/copilot/how-tos/use-copilot-agents/cloud-agent/create-a-pr
- https://docs.github.com/en/copilot/how-tos/use-copilot-agents/cloud-agent/create-automations
- https://docs.github.com/en/copilot/using-github-copilot/coding-agent/using-copilot-to-work-on-an-issue
- https://github.blog/changelog/2026-06-02-schedule-and-automate-tasks-with-copilot-cloud-agent/
- https://github.blog/changelog/2025-09-26-kick-off-and-track-copilot-coding-agent-sessions-from-the-github-cli
- https://github.blog/changelog/2025-09-25-kick-off-and-track-copilot-coding-agent-sessions-from-the-github-cli
- https://github.blog/changelog/2025-11-27-a-mission-control-to-assign-steer-and-track-copilot-coding-agent-tasks/
- https://github.blog/changelog/2025-07-10-github-copilot-coding-agent-now-uses-one-premium-request-per-session/
- https://github.blog/changelog/2026-03-05-github-copilot-coding-agent-for-jira-is-now-in-public-preview/
- https://github.blog/changelog/2026-02-17-assign-issues-to-copilot-coding-agent-from-raycast/
- https://github.blog/ai-and-ml/github-copilot/onboarding-your-ai-peer-programmer-setting-up-github-copilot-coding-agent-for-success/
- https://github.blog/ai-and-ml/github-copilot/assigning-and-completing-issues-with-coding-agent-in-github-copilot/
- https://codex.danielvaughan.com/2026/03/28/codex-github-copilot-coding-agent-issue-assignment/
- https://enterprisedna.co/resources/blog/practitioner-github-copilot-agent
- https://reddit.sentinel-team.org/posts/1r6vcbi/snapshots/2026-02-27T16%3A24%3A57.212112Z
- https://news.ycombinator.com/item?id=46292682
- https://news.ycombinator.com/item?id=46913727
- https://news.ycombinator.com/item?id=46633170
- https://news.ycombinator.com/item?id=44031432
- https://learn.chatgpt.com/docs/third-party/linear
- https://linear.app/changelog/2025-12-04-openai-codex-agent
- https://linear.app/changelog/2026-06-11-coding-sessions
- https://linear.app/docs/linear-cloud-coding-agent
- https://linear.app/docs/assigning-issues.md
- https://linear.app/integrations/codex
- https://linear.app/integrations/merlin
- https://linear.app/enablement/guide/ai-agents
- https://hookdeck.com/webhooks/platforms/how-to-run-claude-code-as-a-linear-agent-with-cyrus-and-hookdeck-cli
- https://claudeissues.com/issue/12925-linear-integration-assign-issues-to-claude-code-to-trigger-cloud-agent-sessions
- https://reddit.sentinel-team.org/posts/1sgjtuw/snapshots/2026-04-09T16%3A41%3A00.47446Z
- https://cursor.com/blog/linear
- https://cursor.com/docs/integrations/linear
- https://forum.cursor.com/t/cursor-linear-integration-starting-two-background-agents-at-once/135033
- https://forum.cursor.com/t/linear-integration-not-working-no-default-repository-configured/146560
- https://cursor.com/docs/cloud-agents/setup
- https://cursor.com/docs/cloud-agents/automations
- https://cursor.com/docs/cloud-agent/automations
- https://cursor.com/docs/background-agent/api/overview
- https://www.spotdev.co.uk/blog/cursor-cloud-agents-and-automations
- https://jules.google/docs/changelog
- https://jules.google/docs/changelog/2025-06-26
- https://jules.google/docs/environment/
- https://github.com/ihildy/jules-task-queue
- https://rywalker.com/research/jules
- https://github.com/github/gh-aw
- https://github.github.com/gh-aw/
- https://github.github.com/gh-aw/reference/copilot-cloud-agent/
- https://codex.danielvaughan.com/2026/04/01/codex-cloud-exec-best-of-n-attempts/
- https://reddit.sentinel-team.org/posts/1qurbr4/snapshots/2026-02-06T23%3A42%3A08.373609Z
- https://news.ycombinator.com/item?id=46589842
- https://builders.ramp.com/post/why-we-built-our-background-agent
- https://github.com/automazeio/ccpm
- https://github.com/github/spec-kit
- https://github.com/eyaltoledano/claude-task-master
- https://github.com/obra/superpowers
- https://docs.task-master.dev/getting-started/quick-start/prd-quick.md
- https://tessl.io/blog/claude-task-master/
- https://news.ycombinator.com/item?id=44960594
- https://news.ycombinator.com/item?id=45013572
- https://news.ycombinator.com/item?id=47520220
- https://news.ycombinator.com/item?id=47720418
- https://simonwillison.net/2025/Oct/5/parallel-coding-agents/
- https://dev.to/battyterm/5-lessons-from-running-ai-coding-agents-in-parallel-53on
- https://claude.com/blog/meet-the-winners-of-our-claude-opus-4-8-build-day-hackathon
- https://www.claude.com/blog/meet-the-winners-of-built-with-opus-4-7-claude-code-hackathon
- https://reddit.sentinel-team.org/posts/1qlqaub/snapshots/2026-01-25T12%3A39%3A50.237835Z
- https://reddit.sentinel-team.org/posts/1rllmzu/snapshots/2026-03-06T19%3A10%3A04.592743Z

### CI/CD automated agent review
- https://code.claude.com/docs/en/github-actions?m=1
- https://docs.anthropic.com/en/docs/claude-code/github-actions
- https://alexcloudstar.com/blog/claude-code-github-actions-2026/
- https://github.com/anthropics/claude-plugins-official
- https://github.com/anthropics/claude-code-action/tree/main/examples
- https://github.com/anthropics/claude-code-action/blob/main/examples/ci-failure-auto-fix.yml
- https://raw.githubusercontent.com/anthropics/claude-code-action/main/examples/ci-failure-auto-fix.yml
- https://code.claude.com/docs/en/code-review
- https://code.claude.com/docs/en/code-review-customize
- https://code.claude.com/docs/en/code-review-local
- https://code.claude.com/docs/en/ultrareview
- https://claude.com/plugins/pr-review-toolkit
- https://dev.to/umesh_malik/anthropic-code-review-for-claude-code-multi-agent-pr-reviews-pricing-setup-and-limits-3o35
- https://reddit.sentinel-team.org/posts/1rp9dps/snapshots/2026-03-11T02%3A38%3A07.04491Z
- https://reddit.sentinel-team.org/posts/1r2rk0u/snapshots/2026-02-12T12%3A58%3A20.402383Z
- https://reddit.sentinel-team.org/posts/1rl9t53/snapshots/2026-03-05T08%3A53%3A45.24988Z
- https://reddit.sentinel-team.org/posts/1qybd2b/snapshots/2026-02-07T11%3A28%3A36.79336Z
- https://reddit.sentinel-team.org/posts/1rwkecs/snapshots/2026-03-20T20%3A10%3A12.107136Z
- https://news.ycombinator.com/item?id=48276152
- https://blog.cloudflare.com/ai-code-review/
- https://news.ycombinator.com/item?id=46346391
- https://news.ycombinator.com/item?id=47246843
- https://github.com/HutchApp/hutch-app
- https://news.ycombinator.com/item?id=49383330
- https://news.ycombinator.com/item?id=47313787
- https://news.ycombinator.com/item?id=44317780
- https://learn.chatgpt.com/docs/third-party/github
- https://learn.chatgpt.com/docs/third-party/github.md
- https://learn.chatgpt.com/docs/github-action
- https://developers.openai.com/codex/integrations/github
- https://developers.openai.com/codex/integrations/github.md
- https://developers.openai.com/codex/use-cases/github-code-reviews
- https://developers.openai.com/codex/cloud/code-review
- https://codex.danielvaughan.com/2026/03/27/codex-cli-code-review-pr-integration/
- https://codex.danielvaughan.com/2026/04/16/codex-as-github-coding-agent-agent-hq-model-selection-cloud-review/
- https://github.com/openai/codex-action
- https://github.com/openai/codex-plugin-cc
- https://reddit.sentinel-team.org/posts/1sflw5k/snapshots/2026-04-09T16%3A41%3A00.47446Z
- https://reddit.sentinel-team.org/posts/1tajg78/snapshots/2026-05-15T18%3A26%3A28.525889Z
- https://codex.danielvaughan.com/2026/04/17/automated-review-fix-loop-coderabbit-cross-provider-quality-gates/
- https://codex.danielvaughan.com/2026/04/07/cross-model-review-loop-automation/
- https://github.com/hamelsmu/claude-review-loop
- https://aident.ai/blog/stop-claude-code-pr-review-comment-loop
- https://github.com/marketplace/actions/pr-autofix-with-claude-code
- https://paddo.dev/blog/claude-code-auto-fix-pr-lifecycle/
- https://cursor.com/blog/bugbot-autofix
- https://forum.cursor.com/t/bugbot-autofix-runs-when-it-should-not/150318
- https://forum.cursor.com/t/allow-bugbot-autofix-to-fix-comments-from-other-bots/153206
- https://github.blog/changelog/2026-07-29-copilot-code-review-agent-skills-and-mcp-now-generally-available
- https://github.blog/changelog/2026-06-02-shape-copilot-code-review-around-your-team/
- https://github.blog/changelog/2026-07-17-copilot-code-review-customization-and-configurability-improvements/
- https://github.blog/changelog/2026-05-19-easily-apply-copilot-code-review-feedback-with-copilot-cloud-agent
- https://github.blog/changelog/2026-08-27-copilot-code-review-resolution-reasons-and-expanded-capabilities
- https://www.morphllm.com/copilot-code-review
- https://docs.coderabbit.ai/configuration/path-instructions
- https://kb.coderabbit.ai/articles/6354480875-yaml-configuration-how-to-reduce-verbosity-and-nitpicks-during-a-code-review
- https://www.coderabbit.ai/pricing
- https://dev.to/rahulxsingh/how-to-setup-coderabbit-complete-step-by-step-guide-2026-4115
- https://github.com/anthropics/claude-code-security-review
- https://developertoolkit.ai/en/cto-scorecard-guide/team-pr-review-automation/
- https://greptile.com/blog/make-llms-shut-up
- https://dev.to/adam-knitli/i-let-four-ai-code-reviews-fight-over-my-prs-17je
- https://tianpan.co/blog/2026-04-17-ai-code-review-at-scale-false-positive-trap
- https://addyosmani.com/blog/agentic-code-review/
- https://www.coderabbit.ai/guides/ai-pair-programming

### Skills, slash commands, subagents and context files
- https://code.claude.com/docs/en/best-practices
- https://code.claude.com/docs/en/plugin-marketplaces
- https://code.claude.com/docs/en/plugins/host-marketplace
- https://github.com/anthropics/skills
- https://github.com/hesreallyhim/awesome-claude-code
- https://github.com/wshobson/agents
- https://github.com/VoltAgent/awesome-claude-code-subagents
- https://github.com/openai/skills
- https://github.com/multica-ai/andrej-karpathy-skills
- https://github.com/ChrisWiles/claude-code-showcase
- https://github.com/davila7/claude-code-templates
- https://github.com/vercel-labs/skills
- https://github.com/agentsmd/agents.md
- https://github.com/leonvanzyl/agentic-coding-starter-kit
- https://github.com/colorfactory-studio/hackathon
- https://github.com/walklikeaman/glory-map
- https://github.com/RijksICTGilde/hackathon-claude-code
- https://github.com/beck-source/claude-code-hackathon
- https://news.ycombinator.com/item?id=46098838
- https://www.humanlayer.dev/blog/writing-a-good-claude-md
- https://news.ycombinator.com/item?id=46809708
- https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals
- https://news.ycombinator.com/item?id=49760187
- https://news.ycombinator.com/item?id=47034087
- https://news.ycombinator.com/item?id=48090276
- https://github.com/adamjgmiller/adamsreview
- https://news.ycombinator.com/item?id=47623101
- https://news.ycombinator.com/item?id=45642911
- https://news.ycombinator.com/item?id=48398925
- https://news.ycombinator.com/item?id=46871173
- https://news.ycombinator.com/item?id=47324022
- https://reddit.sentinel-team.org/posts/1sdvqtg/snapshots/2026-04-09T17%3A10%3A14.787593Z
- https://medium.com/@tentenco/everything-claude-code-inside-the-82k-star-agent-harness-thats-dividing-the-developer-community-4fe54feccbc1
- https://www.mintlify.com/affaan-m/everything-claude-code
- https://cdn.jsdelivr.net/gh/affaan-m/ECC@main/the-shortform-guide.md
- https://www.pulse.bot/ai/blogs/anthropic-hackathon-winners-claude-code-config-revealed-30447601-be37-4995-bd60-8dec92b4896f/
- https://paddo.dev/blog/how-boris-uses-claude-code
- https://www.infoq.com/news/2026/01/claude-code-creator-workflow
- https://venturebeat.com/technology/the-creator-of-claude-code-just-revealed-his-workflow-and-developers-are
- https://threadreaderapp.com/thread/2007179832300581177.html
- https://bushe.co/blog/claude-code-codex-same-repo/
- https://reddit.sentinel-team.org/posts/1sa11vz/snapshots/2026-04-03T23%3A00%3A15.436463Z
- https://reddit.sentinel-team.org/posts/1r0e3po/snapshots/2026-02-09T23%3A41%3A21.583084Z
- https://reddit.sentinel-team.org/posts/1rt36kc/snapshots/2026-03-14T02%3A20%3A30.190133Z
- https://reddit.sentinel-team.org/posts/1r0n1qz/snapshots/2026-02-10T21%3A32%3A33.91536Z
- https://codex.danielvaughan.com/2026/05/15/codex-cli-hackathon-sprint-playbook-rapid-prototyping-time-constrained-development/
- https://claude.com/blog/meet-the-winners-of-our-built-with-opus-4-6-claude-code-hackathon
- https://kaels-lab.pages.dev/ai/claude-code-hackathon-winners/
- https://ai.engineer/talks/VMemhtlsoNk-agents-dont-do-standups-building-post-engineer

### Parallelism and guardrails
- https://github.com/max-sixty/worktrunk
- https://github.com/smtg-ai/claude-squad
- https://github.com/kbwo/ccmanager
- https://github.com/johannesjo/parallel-code
- https://github.com/dagger/container-use
- https://container-use.com/
- https://github.com/BloopAI/vibe-kanban
- https://imbue.com/blog/containers
- https://github.com/funador/claude-code-merge-queue
- https://news.ycombinator.com/item?id=44116872
- https://www.skeptrune.com/posts/git-worktrees-agents-and-tmux/
- https://news.ycombinator.com/item?id=49104747
- https://news.ycombinator.com/item?id=46368739
- https://news.ycombinator.com/item?id=47140322
- https://news.ycombinator.com/item?id=47079718
- https://reddit.sentinel-team.org/posts/1qzduim/snapshots/2026-02-09T12%3A13%3A33.884596Z
- https://reddit.sentinel-team.org/posts/1t9tolw/snapshots/2026-05-16T01%3A22%3A27.604243Z
- https://reddit.sentinel-team.org/posts/1s978m3/snapshots/2026-04-03T23%3A00%3A15.436463Z
- https://inbarshirizly.substack.com/p/coming-soon
- https://hallofdreams.org/posts/agents-and-ants
- https://www.besthub.dev/articles/how-claude-code-s-native-git-worktree-support-enables-fully-parallel-multi-agent-workflows-16c4df35d4c3
- https://www.morphllm.com/claude-code-agent-teams
- https://www.godeltech.com/how-godel-turned-an-ai-hackathon-into-a-cyberpunk-story/
- https://dev.to/stevengonsalvez/claude-squad-run-multiple-ai-agents-in-parallel-without-the-mess-1hfl
- https://agentsroom.dev/blog/best-multi-agent-coding-tools
- https://codex.danielvaughan.com/2026/04/11/agentmaxxing-parallel-multi-cli-orchestration/
- https://adamtornhill.substack.com/p/why-merge-conflicts-became-the-new
- https://superset.sh/blog/parallel-coding-agents-guide
- https://thedailydeveloper.substack.com/p/stop-parallelizing-your-ai-agents
- https://news.ycombinator.com/item?id=48311705
- https://claude.com/blog/introducing-dynamic-workflows-in-claude-code
- https://github.com/trailofbits/claude-code-config
- https://github.com/disler/claude-code-hooks-mastery
- https://news.ycombinator.com/item?id=44429225
- https://news.ycombinator.com/item?id=48289950
- https://news.ycombinator.com/item?id=47343927
- https://github.com/binwiederhier/sandclaude
- https://github.com/webcoyote/awesome-AI-sandbox
- https://news.ycombinator.com/item?id=45647166
- https://news.ycombinator.com/item?id=46626836
- https://reddit.sentinel-team.org/posts/1t4qcqu/snapshots/2026-05-09T02%3A30%3A12.086538Z
- https://docs.anthropic.com/en/docs/claude-code/devcontainer
- https://news.ycombinator.com/item?id=47263595
- https://adnanthekhan.com/posts/clinejection/
- https://news.ycombinator.com/item?id=48718983

### MCP, tooling, deploy pipelines and hackathon cadence
- https://www.pulumi.com/blog/self-verifying-ai-agents-vercels-agent-browser-in-the-ralph-wiggum-loop
- https://skills.sh/svenja-dev/claude-code-skills/preview-testing
- https://www.skills.sh/bernieweb3/hackathon-ai-devkit/hackathon-repo-bootstrap
- https://skills.sh/bernieweb3/hackathon-ai-devkit/hackathon-deployment-prep/security/agent-trust-hub
- https://vercel.notion.site/02agentresources
- https://blogs.reskilll.com/hackathon-starter-kit-2026-copy-tech-stack-ship-24-hours/
- https://blogs.reskilll.com/hackathon-preparation-checklist-2026-before-during-after/
- https://news.ycombinator.com/item?id=49598886
- https://news.ycombinator.com/item?id=49327490
- https://news.ycombinator.com/item?id=48468766
- https://news.ycombinator.com/item?id=47082373
- https://news.ycombinator.com/item?id=46691243