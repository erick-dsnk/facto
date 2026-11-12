---
name: verify
description: Prove a change works before a PR. Run the gate, exercise the feature for real (server, curl or browser), and collect evidence for each acceptance criterion. Use before opening any PR or saying a task is done.
---
# Verify

1. Run `npm run check`. If it fails, fix the cause; don't skip or weaken tests.
2. Exercise the change for real:
   - API: start `npm run dev` in the background on a free port, `curl -s` the endpoint, and keep the response.
   - UI: if a browser tool (agent-browser or Playwright MCP) is available, load the page, perform the flow and save a screenshot under `.evidence/`. If not, check the rendered HTML with curl and say that the UI was not checked visually.
   - Preview deploy: if the PR has a preview URL, check against it too.
3. Write evidence as a checklist: each acceptance criterion → ✅ or ❌, plus what you observed.
4. Report failures plainly. Do not claim a criterion is met without evidence.
