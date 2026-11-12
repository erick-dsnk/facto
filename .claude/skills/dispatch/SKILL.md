---
name: dispatch
description: Fan out ready GitHub issues of a wave to agents, either by each issue's agent:* label or all of them to one Claude lane (--all cloud | --all action). Use when the team says to dispatch a wave.
disable-model-invocation: true
argument-hint: <wave-number> [--all cloud|action]
---
# Dispatch wave: $ARGUMENTS

Modes (`human` issues and issues already labelled `dispatched` are always skipped):
- **Default** routes each issue by its label. `agent:cloud` goes to `claude --cloud`, `agent:copilot` is assigned to Copilot, and `agent:codex` gets an `@codex` comment. Every one of these runs on the account of whoever runs dispatch.
- **`--all cloud`** sends every issue in the wave to its own Claude Code cloud session. They run on your plan, and you can steer them or `--teleport` them back.
- **`--all action`** adds the `claude` label to every issue in the wave. The GitHub Action works each one using the repo secret, and the whole team can watch progress on the issue.

Steps:
1. Parse the wave number and any `--all <mode>` from the arguments. Run `scripts/dispatch.sh --dry-run [--all <mode>] <wave>` and show the output.
2. Check that no two issues in the wave own the same file, using each issue's "Files owned". If any do, list the conflicts and stop.
3. Check that at most ~5 agent issues are open and unmerged at once. If the wave is bigger, propose a split.
4. Once the user confirms, run the same command without `--dry-run`.
5. Report what went where, and any failures.
