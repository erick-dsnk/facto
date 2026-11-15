---
name: ticketize
description: Turn the plan in the conversation into small GitHub issues that agents can work in parallel, each with acceptance criteria, owned files, a wave and a routing label. Use at kickoff after the plan is agreed.
disable-model-invocation: true
---
# Ticketize the plan

Input: the plan just agreed in this conversation. Keep the plan outside the public repository. If no plan was supplied, say so and stop.

1. **Split** the plan into issues that each do one thing and take an agent 15-60 minutes. Aim for 15-40 issues. Each should be checkable on its own.
2. **Assign file ownership.** No two issues in the same wave may own the same file. Put shared foundations (DB schema, shared types, API contracts, layout shell) in **wave 1**, owned by one issue each, so later waves build on them instead of racing for them.
3. **Route** each issue with exactly one label:
   - `human`: architecture decisions, foundations in wave 1, demo-critical UX, anything ambiguous.
   - `agent:cloud`: well-specified feature work. `scripts/dispatch.sh` sends it to a Claude Code cloud session.
   - `agent:copilot` or `agent:codex`: bounded, mechanical work (CRUD, tests, copy, seed data, small UI pieces).
4. **Show the full table** (title, wave, route, owned files) and wait for approval before creating anything.
5. **Create** each issue with `gh issue create --title "<title>" --label "<route>,wave:<n>" --body-file <tmp>`, using this body:

```
## Goal
<one or two sentences: the user-visible outcome>

## Acceptance criteria
- [ ] <observable check, e.g. "POST /api/x with {..} returns 201 and the row appears on /dashboard">
- [ ] `npm run check` passes

## Files owned
- path/to/file.ts
- path/to/dir/

## Context
<links to plan section, related issues, API shapes, gotchas>

## Out of scope
<what not to touch>
```

Run `scripts/bootstrap-labels.sh` first if the labels are missing.
