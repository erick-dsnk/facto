---
name: dispatch
description: Fan out ready GitHub issues to agents. Claude cloud sessions for agent:cloud, Copilot for agent:copilot, Codex for agent:codex. Use when the team says to dispatch a wave.
disable-model-invocation: true
argument-hint: <wave-number>
---
# Dispatch wave $ARGUMENTS

1. Run `scripts/dispatch.sh --dry-run $ARGUMENTS` and show the output.
2. Check that no two issues in the wave own the same file, by reading each issue's "Files owned". If any do, list the conflicts and stop.
3. Check that at most ~5 agent issues are open and unmerged at once. If the wave is bigger, propose a split.
4. Once the user confirms, run `scripts/dispatch.sh $ARGUMENTS`.
5. Report what went where, and any failures.
