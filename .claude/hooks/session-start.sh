#!/usr/bin/env bash
# Cloud sessions only: install deps so the agent can run the gate right away.
# Local sessions already have node_modules.
[ "$CLAUDE_CODE_REMOTE" != "true" ] && exit 0
cd "$CLAUDE_PROJECT_DIR" || exit 0
if [ -f package-lock.json ] && [ ! -d node_modules ]; then
  npm ci --no-audit --no-fund >/dev/null 2>&1 || echo "session-start: npm ci failed" >&2
fi
exit 0
