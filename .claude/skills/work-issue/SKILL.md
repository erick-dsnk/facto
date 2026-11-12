---
name: work-issue
description: Work one GitHub issue end to end. Read it, branch, implement only within its owned files, verify, and open a PR that closes it. Use when given an issue number to implement, locally, in a worktree or in a cloud session.
argument-hint: <issue-number>
---
# Work issue #$ARGUMENTS

1. `gh issue view $ARGUMENTS --comments`. Note the acceptance criteria, **Files owned** and Out of scope. If the issue is too vague to verify, comment on it asking one specific question and stop.
2. `git fetch origin && git switch -c claude/$ARGUMENTS-<short-slug> origin/main`. In a cloud session, the branch may already be set up for you, so use it.
3. Implement the smallest change that meets the criteria, inside the owned files only. If a shared file (schema, shared types, contracts) must change, don't change it. Note it in the PR under **Needs integrator**.
4. Verify with the `verify` skill. Collect evidence for each acceptance criterion.
5. Commit, push, then `gh pr create --title "#$ARGUMENTS <summary>" --body "<body>"` with this body:
   - `Closes #$ARGUMENTS`
   - What changed (3 bullets max)
   - Evidence per acceptance criterion (command output, test name, screenshot path, preview URL)
   - **Needs integrator:** shared-file changes or follow-ups, or "none"
6. Stop. Do not merge. In a cloud session, leave auto-fix on so CI failures and review comments get handled.
