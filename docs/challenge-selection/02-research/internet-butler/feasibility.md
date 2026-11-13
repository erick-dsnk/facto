# Internet Butler (Exa): technical feasibility (Agent D)

**Summary**
- **Buildable: yes, with high confidence.** This is a pure software challenge: a web app, an LLM orchestrator and Exa's HTTP API. It needs no hardware (CHALLENGES.md:L705-L727), and it sits squarely in the team's strongest skill, TypeScript agents. The smallest complete version is roughly 12 to 16 hours of focused work (estimate).
- **The risk lies in the demo and in the score, not the build.** 20% of the score is "works on live queries, including ones the judges try themselves" (CHALLENGES.md:L755-L757). That means the latency of deep search (4-12 s, and 12-50 s for deep-reasoning), Exa's rate limits (10 QPS on search, 5 QPS on deep) and venue Wi-Fi all hit us live, in front of the judges.
- **Credits are enough if we stay disciplined.** We get $50 per person (CHALLENGES.md:L721, L729). The Agent API at `high` effort costs $0.50 per run and Agent Ultra up to $20 per run, so either can drain credits quickly. Stick to `/search` with `auto` or `deep` plus `/contents`.
- **Avoid Websets as a core dependency.** Their API "requires a paid Websets plan", and the free plan caps results at 25 (docs.exa.ai/websets/api/overview).
- **Estimates:** 9/10 that the core ships in 40 hours, and 7/10 that the live demo survives judge queries if it is designed for them (both estimates).

---

## 1. What the challenge technically demands

| Requirement | Source | Technical implication |
|---|---|---|
| A personal agent that finds information across the web, works out next steps and gets the task "as close to done as it can", with the user giving final approval | CHALLENGES.md:L709 | Multi-step pipeline: understand the task, plan searches, retrieve, reason, draft an action (letter, email, form or checklist), then an approval gate. Irreversible actions stay behind a human click. |
| Demo on a real case | CHALLENGES.md:L709 | We need one concrete case prepared, with real documents and real URLs. |
| Built on Exa | CHALLENGES.md:L715, L739-L741 | Exa must be the retrieval layer. The pitch should show information that a bare LLM could not produce. |
| Clear sources | CHALLENGES.md:L747-L749 | Claim-level citations in the UI. Exa's `output.grounding` gives per-field citations and confidence for free (docs.exa.ai/reference/search). |
| Live queries, including the judges' own | CHALLENGES.md:L755-L757 | The input must be open, not a canned script. Behaviour must stay robust on queries outside our niche. |
| Repo, video and submission form requirements | not in CHALLENGES.md | **unknown** |

## 2. Architecture a credible entry needs

```
[Next.js UI] --SSE--> [Orchestrator (TS, LLM w/ tool calls)]
   |  task intake form (user facts: city, rent, dates, docs)
   |                         |-- tool: exa.search (type auto|deep, includeDomains, startPublishedDate,
   |                         |         contents.highlights, outputSchema -> output.grounding)
   |                         |-- tool: exa.getContents (full text of key statute / policy pages, maxAgeHours)
   |                         |-- tool: rules/eligibility reasoner (LLM, structured JSON, cites ids)
   |                         |-- tool: draft action (letter/email/claim form, filled from facts + sources)
   |  <-- streamed steps: queries issued, sources found, claims with [n] citations
   |  approval gate: "Send / Download / Edit" (no auto-send; mailto or PDF download is enough)
   '-- "Baseline" toggle: same question to bare LLM, show what it got wrong or stale (Use-of-Exa proof)
```

Key design choices (estimates and inferences, ours):
- **Exa as tools behind one module with a mock.** CLAUDE.md requires this anyway. It gives us a cached replay mode for when the network or Exa fails.
- **Our own LLM for orchestration** (Claude or OpenAI, with our own API key). Exa's Agent API (`/agent/runs`) is an alternative orchestrator. It is "higher-latency and async by design", and the docs give no typical run time (exa.ai/docs/reference/agent-api-guide), so it is a poor fit for a snappy live demo. At most, use it for one optional "deep dive" button.
- **Domain whitelists per vertical.** For example, finlex.fi, kela.fi, vero.fi and the EU travel-rights pages, passed through `includeDomains`. This improves precision and makes the sources authoritative. `includeDomains` accepts up to 1200 entries (docs.exa.ai/reference/search).
- **Freshness as a visible feature.** Pass `maxAgeHours: 0` (live fetch within 60 s) and `startPublishedDate`, then show "fetched today" next to each source (docs.exa.ai/reference/search). `snapshotAsOf` can show how a page changed over time, which is a strong Use-of-Exa moment.
- **Structured output with grounding.** `outputSchema` returns `output.content` plus `output.grounding[]`, where each entry has a field path, citations and confidence. It adds about 2 s, and is limited to 10 properties and 2 nesting levels (docs.exa.ai/reference/search). That is enough for a checklist like "eligible? / deadline / amount / required docs".

## 3. Critical dependencies and how to get them

| Dependency | Access during the event | Risk |
|---|---|---|
| Exa API key and credits | Redeem EXA50JUNCTION at dashboard.exa.ai/billing, $50 per participant (CHALLENGES.md:L729) | Whether three codes can stack on one team account is **unknown**. Rate limits are team-wide across keys (docs.exa.ai/reference/rate-limits). |
| Exa JS SDK `exa-js` | npm, version 2.28.0, last modified 2026-11-06 (`npm view exa-js`) | Low. Plain REST works too. |
| LLM API (Claude or OpenAI) | Our own keys. Not provided by the challenge (CHALLENGES.md:L721-L727 lists only Exa resources) | Our own cost. Low risk. |
| Real-case data (a rent contract, a delayed-flight booking and so on) | A teammate's own real case, anonymised | Must be lined up before the build starts. |
| Websets, Monitors | Monitors cost $2 per 1k requests (exa.ai/pricing). The Websets API needs a paid plan (docs.exa.ai/websets/api/overview) | Ask on site whether event access covers Websets ("We will also provide Websets", CHALLENGES.md:L725). |
| Hosted MCP server | Mentioned at CHALLENGES.md:L725 | Optional. Not needed. |

## 4. Limits, pricing, latency, reliability (documented)

**Pricing** (exa.ai/pricing):
- Search `auto`/`fast`: $7 per 1k requests. `lite`/`instant`: $4 per 1k. `deep`/`deep-lite`: $12 per 1k. `deep-reasoning`: $15 per 1k.
- Contents: $1 per 1k pages, per content type. Summaries: +$1 per 1k pages. Answer: $5 per 1k.
- Agent: `minimal` $0.012, `low` $0.025, `medium` $0.10, `high` $0.50, `xhigh` $1.00 per run. Agent Ultra is billed up to a default $20 per run (exa.ai/docs/changelog/exa-deep-revamp).

**Budget estimate (ours).** One butler run of about 8 searches (a mix of `auto` and `deep`) plus about 30 pages of contents costs roughly $0.10-0.15. A $50 key buys about 300-500 runs, so $150 across the team is ample for development and the demo. The exceptions are a misused Agent at `high`/`ultra` or a test loop that hammers deep search. We should add a cost meter that reads `costDollars` from each response (docs.exa.ai/reference/search).

**Rate limits** (docs.exa.ai/reference/rate-limits), team-wide:
- `/search`: 10 QPS. Deep types: 5 QPS. `/contents`: 100 QPS. `/agent/runs`: 5 QPS and 50 active runs. `/websets`: 20 QPS.
- Inference: three developers running parallel agents, test suites and an eval loop against one key can hit 10 QPS easily. Use separate team accounts for development and the demo, or throttle the client.

**Latency:**
- `fast` p50 is under 425 ms. `instant` is under 150 ms. `deep` takes 4-12 s, and `deep-reasoning` 12-50 s (exa.ai/docs/changelog/exa-deep-revamp). `deep-lite` has a "consistent 4-second latency" (docs.exa.ai/reference/search). `outputSchema` adds about 2 s on top.
- The Agent API is async with polling (exa.ai/docs/reference/agent-api-guide).
- Estimate: a full multi-step butler run takes 20-60 s. This is acceptable only if steps stream visibly.

**Streaming:** `stream: true` currently applies only when `outputSchema` is set (docs.exa.ai/reference/search). Otherwise, our orchestrator streams its own progress events.

**Reliability:**
- We could not open status.exa.ai or the third-party tracker. Pingoru returned 403. Pingoru's search-result snippets mention a roughly 19-minute Search API outage on 2026-05-11, short blips in June 2026, and a roughly 5-hour Agents API incident on 2026-09-21. These are **unverified**. Treat them as a sign that outages of tens of minutes do happen.
- API churn: in April 2026 Exa retired `/research` and replaced it with deep-reasoning search. In October 2026 it added the `lite` type and marked `fast`, `instant` and `deep-reasoning` legacy (exa.ai/docs/changelog/exa-deep-revamp). Blog posts and older demo code may use dead parameters, including `livecrawl`, which `maxAgeHours` has deprecated (docs.exa.ai/reference/search). Read the current docs and do not trust LLM memory of the API.
- `lite` returns 400 errors for unsupported parameters (changelog). Do not use it with freshness options.

## 5. Integration complexity for this team

Low (estimate). Every piece is HTTP with JSON and an LLM tool-calling loop, which is the team's core skill. The genuinely hard parts are not integration:
1. **Domain correctness.** Finnish rent law and Kela benefits are subtle. The output must show its sources and avoid overclaiming. Judges will probe this.
2. **Coverage of Finnish-language official sources in Exa's index** is **unknown**. Test it in the first hour: `includeDomains: ["finlex.fi","kela.fi"]` with Finnish and English queries. If coverage is thin, use `getContents` on known URLs, which live-crawls them.
3. **Robustness to arbitrary judge queries.** We need an intent router that either handles the query or degrades gracefully to a "general research and checklist" mode with citations.

## 6. Does the core fit in 40 hours? Smallest complete version

**Smallest complete version (MVP, about 12-16 h of work, estimate; parallelisable across 3 people and their agents):**
1. Chat or intake UI with streamed steps and a citation panel (claim links to a source card showing highlight, URL and fetch date).
2. Orchestrator with three tools: `search`, `getContents` and `draft`. One vertical is deeply tuned, with a domain whitelist and a structured schema. All other queries fall back to the generic mode.
3. Draft action plus an approval gate (edit, then download PDF or open `mailto:`). Nothing sends automatically.
4. A "bare LLM vs. Exa" comparison toggle for the same question.
5. A replay cache of the real demo case, written to disk so it can be served if Exa or the network fails.

**Stretch (only after the MVP is green):** a Monitors-based "watch this for me" follow-up (for example, alert when a new tenancy ruling or a flight-rights update appears); `snapshotAsOf` diffs; a small accuracy eval with about 20 labelled cases to quote in the pitch; a second vertical.

Verdict: the core fits comfortably. The remaining time should go to the demo case, the eval, query robustness and pitch polish, not to more features.

## 7. Live-demo likelihood and failure modes

Estimate: about 7/10 that the demo is clean, including judge-typed queries, if the mitigations below are in place. About 4/10 without them.

| Failure mode | Likelihood (est.) | Mitigation |
|---|---|---|
| A judge's query falls outside our vertical, and the agent produces generic or hallucinated output | High | Generic fallback mode that always cites. Refuse explicitly when no sources are found. Rehearse 30 off-topic queries. |
| Deep search or a multi-step run takes 30-60 s, so judges get impatient | Medium-high | Stream every step. Run `auto` searches in parallel. Use `deep` only for one step. Never use deep-reasoning or Agent `high`/`ultra` in the live path. |
| 429 rate-limit errors because teammates or tests share the team key during judging | Medium | A separate demo account and key. Freeze tests during judging. Retry with backoff. |
| Venue Wi-Fi drops, or Exa has an outage | Low-medium | Hotspot backup. Cached replay of the real case, labelled honestly as cached. |
| Credits run out | Low-medium | Cost meter, a hard budget cap in code, no Agent `ultra`. |
| A legal or eligibility conclusion is wrong and a judge notices | Medium | Show confidence (`output.grounding` confidence). Phrase results as "likely / check with X". Link to the primary source. |
| Finnish sources are poorly indexed | unknown | Hour-1 spike. Fall back to a direct `getContents` crawl of known official URLs, or to an English or EU-level vertical such as EU261 flight compensation. |
| LLM refers to deprecated API parameters (`livecrawl`, `/research`) | Medium during the build | Pin the docs. Write the tool wrapper by hand from the current reference. |

## 8. Questions to ask Exa on site before committing

1. Can the three EXA50JUNCTION credits be combined on one team account? Can the event raise our QPS above 10 search and 5 deep?
2. Does event access include the Websets API without a paid plan, and what concurrency does it allow?
3. How good is index coverage of Finnish government and legal sites (finlex.fi, kela.fi, vero.fi, ara.fi), and of Finnish-language queries?
4. Which search type do Exa engineers recommend for an interactive agent in 2026: `auto`, `deep-lite` or `deep`? What latency should we expect at the venue?
5. What are the submission format and deadline (repo, video, live booth)? Will judges type queries on our machine or on their own? (Both are unknown from CHALLENGES.md.)
6. Does "built on Exa" allow a third-party LLM for orchestration, or do they prefer Exa Agent or Answer to be visible? (Inference: the third-party LLM is fine, but confirm.)
7. Is there a known-good evaluation set, or a type of query judges are likely to try?

## Sources opened
- /Users/ciprian/code/Junction 26/docs/JUNCTION_2026_CHALLENGES.md L697-L777
- https://exa.ai/pricing
- https://docs.exa.ai/reference/rate-limits
- https://docs.exa.ai/reference/search
- https://exa.ai/docs/changelog/exa-deep-revamp
- https://exa.ai/docs/reference/agent-api-guide
- https://docs.exa.ai/websets/api/overview
- https://demos.exa.ai (no personal-task agent demo is listed, which is mildly good for originality)
- `npm view exa-js` (2.28.0)
- Reliability: Pingoru search snippets only (https://pingoru.io/providers/exa-ai/outage-history returned 403). Unverified.

<!-- complete -->
