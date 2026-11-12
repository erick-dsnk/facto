#!/usr/bin/env bash
# Send open, undispatched issues of a wave to agents based on their route label.
#   agent:cloud   → Claude Code cloud session (`claude --cloud`, uses your plan)
#   agent:copilot → assigned to the Copilot cloud agent
#   agent:codex   → @codex comment (needs the Codex GitHub connector on the repo)
# Usage: scripts/dispatch.sh [--dry-run] <wave>
set -euo pipefail
DRY=0; [ "${1:-}" = "--dry-run" ] && { DRY=1; shift; }
WAVE="${1:?usage: dispatch.sh [--dry-run] <wave>}"
run() { if [ "$DRY" = 1 ]; then echo "  would: $*"; else "$@"; fi; }

for route in cloud copilot codex; do
  gh issue list --state open --label "agent:$route" --label "wave:$WAVE" \
    --json number,title,labels \
    --jq '.[] | select([.labels[].name] | index("dispatched") | not) | "\(.number)\t\(.title)"' |
  while IFS=$'\t' read -r num title; do
    echo "#$num [$route] $title"
    case "$route" in
      cloud)
        run claude --cloud "Use the work-issue skill to implement GitHub issue #$num. Read AGENTS.md first. Open a PR that closes #$num." ;;
      copilot)
        run gh issue edit "$num" --add-assignee "@copilot" ;;
      codex)
        run gh issue comment "$num" --body "@codex implement this issue following AGENTS.md and open a PR that closes #$num." ;;
    esac
    run gh issue edit "$num" --add-label dispatched >/dev/null
  done
done
