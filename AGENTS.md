# Junction 2026: Facto

Shared context for Claude Code, Codex and Copilot. `CLAUDE.md` is a symlink to this file. Keep it under ~150 lines and put style rules in linters and hooks, not here.

## Stack
- Backend: TypeScript on Node 22+, Fastify with HTTP and WebSocket (`services/api`), shared zod contracts (`packages/contracts`)
- iOS: Swift companion app built with XcodeGen and Meta's Device Access Toolkit (`apps/ios`)
- Web: React + Vite display HUD (`apps/glasses`), Vite landing page (`apps/landing`)
- DB: none. Sessions live in memory and expire.
- Hosting: API in one Cloudflare Container behind a Worker (`wrangler.jsonc`, `deploy/cloudflare`); landing page on a Cloudflare Worker at https://fact0.eu

## Commands
- Install: `npm ci`
- Dev server: `npm run dev` (port 3000; worktrees use `PORT=30xx`)
- Lint: `npm run lint`
- Typecheck: `npm run typecheck`
- Test: `npm test`
- **Gate (must pass before a PR):** `npm run check`. It runs lint, typecheck and test.

## How work flows
- One GitHub issue → one branch → one PR. Branch `<agent>/<issue#>-<slug>`, PR title `#<issue> <summary>`, body has `Closes #<issue>`.
- Each issue has a **Files owned** list. Stay inside it. If you need to change shared code (types, DB schema, migrations, API contracts), stop and say so in the PR rather than doing it.
- Don't add dependencies unless the issue needs them. Justify each one in the PR body.
- Do not merge your own PR. A teammate reviews it and merges once CI is green.

## Conventions
- Demo first: stub auth and payments, and put external APIs behind one module with a mock.
- Read secrets from env only. `.env.example` lists every variable.
- Keep the diff small. Don't refactor, rename or reformat outside the task.

## Done When
- The issue's acceptance criteria are met **and shown** in the PR (screenshot, curl output or test name).
- `npm run check` passes.
- The core demo flow still works end to end.

## Gotchas
<!-- Add things agents get wrong here, one line each. -->

## Review guidelines
Codex and Copilot review read this section, and REVIEW.md applies the same rules for Claude.
Flag only P0/P1: bugs, security holes, data loss, secrets in code, anything that breaks the demo flow, and edits outside the issue's owned files. Do not comment on style, naming or formatting, or on anything lint or typecheck already enforces.
