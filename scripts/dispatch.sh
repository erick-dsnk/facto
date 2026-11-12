#!/usr/bin/env bash
# Send open, undispatched issues of a wave to agents.
#
# Default: route each issue by its label.
#   agent:cloud   → Claude Code cloud session (`claude --cloud`, runs on YOUR plan)
#   agent:copilot → assigned to the Copilot cloud agent (YOUR Copilot plan)
#   agent:codex   → @codex comment posted as you (YOUR Codex plan)
# --all cloud  : every non-`human` issue in the wave → `claude --cloud`
# --all action : every non-`human` issue in the wave → `claude` label, which the
#                GitHub Action picks up (repo secret; progress visible on the issue)
#
# Usage: scripts/dispatch.sh [--dry-run] [--all cloud|action] <wave>
set -euo pipefail
DRY=0; ALL=""
while [ $# -gt 1 ]; do
  case "$1" in
    --dry-run) DRY=1; shift ;;
    --all) ALL="${2:?--all needs cloud or action}"; shift 2 ;;
    *) break ;;
  esac
done
WAVE="${1:?usage: dispatch.sh [--dry-run] [--all cloud|action] <wave>}"
case "$ALL" in ""|cloud|action) ;; *) echo "--all must be cloud or action" >&2; exit 1 ;; esac
run() { if [ "$DRY" = 1 ]; then echo "  would: $*"; else "$@"; fi; }

cloud_prompt() { echo "Use the work-issue skill to implement GitHub issue #$1. Read AGENTS.md first. Open a PR that closes #$1."; }

# shellcheck disable=SC2016  # $l is a jq variable
gh issue list --state open --label "wave:$WAVE" --limit 200 --json number,title,labels \
  --jq '.[] | [.labels[].name] as $l
        | select(($l | index("dispatched") | not) and ($l | index("human") | not))
        | "\(.number)\t\(([$l[] | select(startswith("agent:"))] | first) // "none")\t\(.title)"' |
while IFS=$'\t' read -r num route title; do
  target="${ALL:-${route#agent:}}"
  echo "#$num [$target] $title"
  case "$target" in
    cloud)   run claude --cloud "$(cloud_prompt "$num")" ;;
    action)  run gh issue edit "$num" --add-label claude >/dev/null ;;
    copilot) run gh issue edit "$num" --add-assignee "@copilot" ;;
    codex)   run gh issue comment "$num" --body "@codex implement this issue following AGENTS.md and open a PR that closes #$num." ;;
    *)       echo "  skipped: no agent:* label (add one, or use --all)"; continue ;;
  esac
  run gh issue edit "$num" --add-label dispatched >/dev/null
done
