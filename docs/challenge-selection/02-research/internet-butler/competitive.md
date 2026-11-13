# Competitive intelligence: The Internet Butler (Exa)

**Summary**
- The "personal agent that researches the web and gets a task nearly done" space is crowded: general consumer agents (ChatGPT agent, Comet, Manus), many vertical products (EU261 flight claims, rent-increase checkers, benefits navigators) and a long tail of Exa-based hackathon projects (cover letters, learning roadmaps, dining agents, form-fill browser agents).
- Exa's own demo gallery already covers search chatbots, morning briefs, market monitors, places, shopping and enrichment, so those are known to the judges.
- The most likely first ideas (rent-law checker, benefits finder, flight-compensation claimer, date-night planner, generic "research then draft" chat agent) will each be built by several teams. Estimated crowding: high on idea overlap, medium-to-high on team interest (estimates, see reasoning below).
- Differentiation has to come from a narrow, local, high-stakes user group (e.g. Finnish/Helsinki-specific), claim-level citations, evidence of freshness vs a bare LLM, and a robust live-query demo, not from the task category.
- Caveat: web search tooling here returned mostly snippets; items marked (snippet) were not opened in full. No Junction/Exa-specific past-winner list for this exact challenge was found; Exa is unknown as a prior Junction sponsor.

## 1. Previous winners and similar hackathon entries

| Item | What it is | Source | Status |
|---|---|---|---|
| PennApps 2023, Exa-sponsored: Hire-Me-Pls (1st), SkillTree (2nd), SourceScanner (3rd) | Cover letter from LinkedIn plus company research via Exa; learning-roadmap curator; link-explainer for hard texts | https://exa.ai/blog/best-pennapps-projects-with-exa-search | Opened, date 30 Sep 2023 |
| SuperAI NEXT Hackathon 2026, Best Use of Exa: TableFor | Group dining agent using Exa, AWS Bedrock and Stripe; self-reported on LinkedIn | https://sg.linkedin.com/in/juninho-yeu | Snippet only, self-reported |
| Agents Everywhere Hackathon with OpenAI: Sidekick (1st), Arto (2nd) | Sidekick: AI meeting teammate/research and document builder (one source also says a browser agent that completes forms pausing for approval; sources conflict). Arto: browser agent on OpenRouter and Exa. | Search results summarising https://www.agno.com/articles/global-agent-hackathon-winners and related pages; I could not pin a primary URL | Snippet only, unverified detail |
| Agno Global Agent Hackathon: Flow | Daily planning/execution personal-productivity agent; Exa among ecosystem partners | https://www.agno.com/articles/global-agent-hackathon-winners | Snippet only |
| FutureStack GenAI Hackathon: Sure AI | Sub-agents using Exa API for web search; won Meta Track | https://dev.to/hibino_reddy/sure-ai-winning-the-meta-track-at-futurestack-genai-hackathon-by-wemakedevs-5h4 | Snippet only |
| Discovery AI Agent Hackathon (Exa x Anthropic x AWS x Lightspeed, SF, ~75 engineers) | Exa-hosted agents-that-discover event; winners not found | https://luma.com/sikose73 | Snippet only |
| Junction main-prize history | Past overall winners were mostly technical/novel concept projects (e.g. 2025 WAVELET, real-time electromagnetic simulation; 2018 Oneiro EV-charger rental; 2021 Nice-ify). No "research agent" overall winner is listed. | https://en.wikipedia.org/wiki/Junction_(hackathon) | Opened |

Takeaways (inference, labelled as such):
- Exa-flavoured winners are typically simple wrappers around a single concrete use (cover letter, roadmap, dinner). Judges at Exa events have seen many of these.
- Junction overall winners lean toward a striking, technically distinct demo, so a pure "chat with citations" butler is unlikely to be a finalist unless the demo is unusually vivid (estimate).

## 2. Exa's own examples (what judges already know)
Exa demo gallery, 23 demos: Exa vs Native Search, Token Savings, Web Chatbot, Voice Search, Search Terminal, Grounding Comparison, Content Retrieval, Agent Ultra Replay, Shopping Search, Image Search, Exa Places, Candidate Sourcing, Network Planning, People/Company Enrichment, GTM Intelligence, Adverse Media, Market Monitor, Morning Briefs, Paper Search, Research Map. Source: https://demos.exa.ai (opened; titles only, descriptions inferred from titles).
Also: open-source company-researcher and a Deepseek chat app at https://github.com/exa-labs (snippet), LiveKit voice Exa Deep Researcher example (https://exa.ai/integrations/livekit, snippet), LangGraph multi-agent write-up (https://blog.langchain.com/exa, snippet), and Exa's hosted MCP server with deep-researcher tools (https://github.com/exa-labs, snippet). Exa's Research API was reported as deprecated 1 May 2026 in favour of search with a deep-reasoning type (snippet, https://exa.ai/docs/reference/research/overview.md); verify before relying on it.
Implication: a "search chatbot", "morning brief" or "monitor" with Exa is a demo Exa has already shipped.

## 3. Commercial products already solving sub-problems
- **General agents** that research and pause for approval before consequential actions: ChatGPT Agent, Perplexity Comet, Manus (all snippet; reviews conflict on reliability). https://yourstory.com/ai-story/openai-rolls-out-chatgpt-agent-to-handle-complex-computer-tasks , https://echai.ventures/how-founders-use-ai/r/exclusive-review-comet-agentic-browser-by-perplexity--1696 , https://kanerika.com/blogs/agentic-browsers/. Judges will compare to these: "why not just ask ChatGPT?"
- **EU flight-disruption claims**: FlightClaimsAI, CompensaFly, FlyClaim.AI, Pine AI, a FlightCompensations Claude connector (monitoring, eligibility, pre-filled claims). https://www.toolmage.com/en/tool/flightclaimsai/ , https://techindex.law.stanford.edu/companies/flyclaim-ai , https://www.19pine.ai/blog/eu-261-compensation-claim , https://mcpservers.org/servers/flightcompensations-com-claude-connector (all snippets; vendor marketing).
- **Rent-increase checks**: AI Lawyer rent increase checker (US states), Landlord Assist AI (Canada), UK tenants' union tool, UChicago LeaseChat. https://ailawyer.pro/tools/rent-increase-checker , https://frontlobby.com/2026/01/landlord-assist-ai-for-landlord-and-tenant-laws-in-alberta-bc-ontario/ , https://www.property118.com/tenants-union-launches-tool-to-help-renters-challenge-rent-increases/ , https://www.nbcchicago.com/consumer/free-uchicago-ai-tool-aims-to-help-renters-better-understand-their-rights/3857550/?amp=1 (snippets). I found no Finnish-specific one in this search (not exhaustively checked; unknown).
- **Benefits**: Nava Labs form-filling assistant (caseworker side, open source), Kealu Benefits Navigator, BeNYfits benchmark. https://www.navapbc.com/labs/caseworker-ai-tools/form-filling-assistant , https://www.remoteopenclaw.com/mcp/Kealu-Labs/kealu-benefits-navigator , https://arxiv.org/pdf/2502.19610 (snippets). No Finland/Kela equivalent found in this search (unknown).

## 4. Open-source implementations
Exa company-researcher and chat examples, LiveKit voice research agent, LangGraph web-research agent, Kealu benefits navigator, Nava form-filling assistant, EU261 skill on Smithery (https://smithery.ai/skills/adriancasasizquierdo/geo360-eu261-flight-compensation-claim-hunter, snippet). Anyone can fork these in an hour, so base functionality is not a differentiator.

## 5. What most teams will build first (estimate)
Obvious ideas to avoid or radically sharpen:
1. Generic "ask anything, get cited answer" chat agent (Exa's Web Chatbot already exists).
2. Rent-increase legality checker (named in the challenge text, CHALLENGES.md:L707, and has existing tools). Likely the single most duplicated idea.
3. Benefits/"what am I entitled to" finder (CHALLENGES.md:L707).
4. Flight delay/travel disruption compensation claimer (CHALLENGES.md:L711; crowded commercial niche).
5. Restaurant/date/anniversary or event planner (CHALLENGES.md:L707).
6. Cover letter / job application / company research agent (PennApps 2023 winner pattern).
7. Learning roadmap / study planner.
8. Daily news or morning-brief digest (Exa demo exists).
9. Browser agent that fills forms (Nava, Arto-style).
10. Voice-fronted version of any of the above.
Every item in the challenge's own example list (L707, L711) will be picked by multiple teams, since teams read the same text.

## 6. Crowding estimate (estimate, not sourced)
- Interest: likely medium-to-high. Reasons: open-ended "general tasks" brief, no hardware, a $50 credit per person, sponsor prize is mid-sized ($2,500 cash, CHALLENGES.md:L761-L763), and Junction teams skew to AI-agent builds (2025 had 1,500+ participants, https://en.wikipedia.org/wiki/Junction_(hackathon)). Counter-pressure: other agentic-track challenges compete for the same teams. Exact team count: unknown.
- Idea overlap: high; most entries will be Exa search plus an LLM plus a draft output.
- Quality bar on the "working on live judge queries" criterion (20%, L755-L757) will eliminate many weak demos, so the real contest is among the few robust ones.

## 7. How to look different
- Pick a narrow user group tied to Finland/Helsinki (local law, Kela/municipal rules, HSL, Finnish-language sources). Global tools (ailawyer, EU261 vendors) do not serve this; verifying that no Finnish equivalent exists is still to be done.
- Show what a bare LLM cannot know: fresh or versioned pages, new decisions, local-language sources; include a side-by-side baseline (Exa's own gallery has a similar comparison, so the comparison must be on the user's real case).
- Claim-level citations: each sentence linked to a highlighted source passage, with date and a freshness indicator (maps to the 20% Clarity criterion, L747-L749).
- End state is an action awaiting approval: a drafted letter, form or claim, with a visible approve step, not another report (L709).
- Use Exa features beyond search: structured JSON output, past page versions, Monitors for follow-up ("tell me when the rule changes"), Websets lists (verify plan access first).
- Make the demo live-query-proof: handle judge-typed inputs, streaming progress, graceful "I could not verify this" outcomes, and a small accuracy test set to quote.
- Demo on a real person's real case with real documents, as the challenge asks (L709).
- Avoid reinventing: reuse existing open-source Exa examples for plumbing and spend time on the vertical knowledge and trust UX.

<!-- complete -->
