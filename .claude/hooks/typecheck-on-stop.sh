#!/usr/bin/env bash
# Before the agent stops, make sure typecheck passes. On failure, exit 2 feeds
# the errors back to the agent. stop_hook_active stops a retry loop.
input=$(cat)
[ "$(printf '%s' "$input" | jq -r '.stop_hook_active // false')" = "true" ] && exit 0
cd "$CLAUDE_PROJECT_DIR" || exit 0
[ -f package.json ] && grep -q '"typecheck"' package.json || exit 0
# Skip when nothing changed (e.g. a Q&A turn).
git diff --quiet HEAD -- 2>/dev/null && [ -z "$(git ls-files --others --exclude-standard)" ] && exit 0
out=$(npm run --silent typecheck 2>&1) || { printf 'Typecheck failed. Fix before finishing:\n%s\n' "$(printf '%s' "$out" | tail -40)" >&2; exit 2; }
exit 0
