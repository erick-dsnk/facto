#!/usr/bin/env bash
# Format the file that was just edited. Never blocks the agent.
file=$(jq -r '.tool_input.file_path // empty' 2>/dev/null)
[ -z "$file" ] || [ ! -f "$file" ] && exit 0
cd "$CLAUDE_PROJECT_DIR" || exit 0
[ -x node_modules/.bin/prettier ] && node_modules/.bin/prettier --write --log-level silent "$file" 2>/dev/null
exit 0
