# Competitive intelligence: Make Unicorns Real (Cala)

**Summary**
- The founder/investor-tooling space is crowded with funded commercial products (Crunchbase, Harmonic, Fundable, Fundraisly, Metal), and even Crunchbase now ships an MCP server. A generic "find investors for my startup" or "VC due-diligence agent" will look like a rerun.
- No public winner list was found for any Cala-sponsored challenge, so "what Cala judges have rewarded before" is unknown. The only other Cala hackathon track found (MEGATHON) weights integration depth at 30% and asks whether Cala replaced scraping or a paid API.
- Estimate: this challenge will draw high interest and a high rate of near-identical ideas (investor matchmaker, DD agent, market map). Slush timing and the "real need" framing make it an obvious pick.
- To stand out: one named user, one narrow job, a multi-hop graph question that web search cannot answer, every claim linked to its Cala source, and a deployed product with a live side-by-side against a web-search LLM.

## 1. Previous winners of Cala or similar challenges

| Finding | Source | Note |
|---|---|---|
| MEGATHON "Best Use of Cala" track: 1st = EUR1,000 cash + paid trip to Barcelona + 6 months Cala Build plan; runner-up = 6 months Cala Explore. Judging weights Depth of Cala Integration 30%, plus data displacement, product fit, demo clarity. Requires a Cala API key in the production build. | https://megathon.fluxzero.io/tracks/cala (seen only in search snippets; direct fetch failed, DNS error) | Unverified against the official page. No winners found. |
| "{Tech: Europe} x Cala Hackathon, The Summer Lock-In", Barcelona, 60 participants, Cala co-host. No themes or winners listed. | https://luma.com/barcelona-summer-lock-in (opened) | Cala sponsors hackathons often. No results published. |
| Junction 2025: over 1,500 participants; main prize reportedly team WAVELET; partner list (n8n, Supercell, Figma, Wolt, 40+) does not name Cala. | https://en.wikipedia.org/wiki/Junction_(hackathon) (via search snippet; WAVELET claim single-sourced) | Cala is new at Junction. No prior Junction winner for this sponsor. |
| Junction scale and format (judging by partner judges, then overall) | CHALLENGES.md:L287, L325-341 | |

Unknown: winners and project descriptions for any Cala challenge. Cala's own site and socials were not found to publish any. Ask Cala mentors on Saturday at 11:00 workshop (CHALLENGES.md:L315) what past teams built.

## 2. Commercial products that already solve parts of this

| Product | What it does | Gap relevant to us | URL |
|---|---|---|---|
| Crunchbase (+ official MCP) | Company, funding, investor data; MCP lets Claude/ChatGPT screen companies, analyze funding, map markets. All accounts can connect, tokens per tier. | Self-reported data, lag; not a fundraising workflow (per a Metal-authored comparison, biased) | https://data.crunchbase.com/docs/mcp-overview ; https://www.metal.so/guides/the-best-tools-to-find-investors-for-your-startup-raise-in-2026/ |
| Harmonic (Scout agent, Claude connector) | NL research over private-market data, warm-intro paths; claims 35M companies | Paid, vendor-authored claims | https://harmonic.ai/blog/harmonic-vs-grata ; https://claude.com/connectors/harmonic |
| Fundable | 149k+ rounds, 67k+ investment firms, API + MCP, from $0.06/credit | Data vendor, no end-user product | https://www.tryfundable.ai/data |
| Fundraisly | AI fundraising agent: 300k+ investors, active-investor matching, warm intros, outreach. #1 Product Hunt of the month June 2026 | Exactly the "raising money smarter" insight bullet (CHALLENGES.md:L297) already shipped | https://www.producthunt.com/posts/fundraisly-4 |
| Metal | Investor discovery, lead-investor data, warm-intro mapping, CRM, call prep | Paid | https://www.metal.so/guides/the-best-tools-to-find-investors-for-your-startup-raise-in-2026/ |
| PitchBook, OpenVC, AngelList, Affinity, Visible | Institutional data, free directory, syndicates, CRM, reporting | See Metal article above | same |
| Alby Investor Match, Lessie, Evalyze, InvestorFinder | Agent-based or AI investor scouting, pay per run | | https://getalby.com/ai-tools/investor-match ; https://lessie.ai/investor-scouting |

Implication: judges (Cala staff, plus Slush-crowd context) know this landscape. Beating Crunchbase's own MCP on raw lookup is not credible in 40 hours; the angle must come from Cala's sourced, connected graph and a sharp workflow.

## 3. Open-source implementations

| Project | What | URL |
|---|---|---|
| fastvc | 25 VC agents, thesis discovery, dilution modelling, warm intros; Apache-2.0, 1 star | https://github.com/predictivelabsai/fastvc |
| Frisque | Multi-agent VC due diligence (Google ADK hackathon entry) | https://dev.to/virgoalpha/frisque-using-ai-agents-for-due-diligence-4old |
| Axiom, Deep Diligence, due-diligence-agents | Startup/M&A DD agents, some use Crunchbase | https://dev.to/octanexyz/i-built-an-agent-that-does-vc-due-diligence-in-minutes-mbo ; https://github.com/zoharbabin/due-diligence-agents (listed in search) |
| Agno Startup Analyst cookbook | Funding/growth research template; notes private-company data is thin | https://docs.agno.com/production/applications/startup-analyst |
| Academic paper | Multi-agent VC due diligence framework | https://arxiv.org/pdf/2605.13110 |

Teams can clone these patterns in an hour, so a "DD memo generator" is the most-duplicated shape.

## 4. Similar hackathon submissions
Targeted searches (Devpost, hackjunction, AI Tinkerers) surfaced no directly comparable Cala submissions (unknown). Many AI Tinkerers and Devpost agent hackathons exist (https://paris.aitinkerers.org/hackathons/h_bpGwQrAPaWs/results) but no investor-matching winners were identified. Absence of evidence is weak: treat these ideas as common (estimate), since the challenge text itself lists them.

## 5. Ideas most teams will reach for (avoid as the headline)
Derived from the Insight section of the challenge (CHALLENGES.md:L295-303) and the products above:
1. Investor matchmaker for founders (find lead investors in my sector/stage) - Fundraisly-style.
2. Company background-check / due-diligence memo agent.
3. Market map / competitor landscape with "who just raised" feed.
4. Funding-round news digest or alerts for a sector.
5. Founder-investor matching chat bot ("agent that connects the right founders and investors", named in the challenge itself).
6. "Chat with Cala" dashboard wrapper, or MCP-in-Claude demo with a pretty UI.
7. Find first customers among companies that just raised (named in the challenge as "Beyond funding"; less crowded than 1-5 but still listed).
8. Warm-intro path finder (Harmonic/Metal already do it; needs person-level data Cala may not cover - unknown).

## 6. Crowding estimate (estimate, not sourced)
- Expected Junction team interest: **high**. Reasons: no hardware, pure software matches most teams' skills; clear user; Slush hook; explicit "unlimited credits" lowers cost; the prize (3 months of paid hackathon travel) is attractive; ideas 1-5 are handed to teams in the text.
- Saturation of solution space: **high** for the suggested needs, **medium** for novel angles.
- Counterweights: Cala is a young API with unknown coverage and a rate limit (per Agent A), which punishes shallow integrations and rewards teams who test data depth early. Originality is 25% of score, so generic submissions cap out.

## 7. What a submission needs to look different
- Pick a user nobody on the listed ideas names (e.g. a specific role: seed-stage fund associate, founder-in-residence, accelerator program manager, a corporate-development scout) and one job with a concrete output.
- Use graph structure that web search cannot: multi-hop queries (investor -> co-investors -> portfolio -> follow-on behaviour), recency of activity, lead vs follow roles. Show the query path, not just the answer.
- Every claim carries its Cala source link; show confidence and staleness. Provenance is Cala's stated differentiator (CHALLENGES.md:L287; https://docs.cala.ai).
- Live A/B: same question to a web-search LLM vs. the product, shown on screen, with the web-search answer wrong or unsourced.
- Be complete and deployed: working URL, onboarding with no setup, real data for real Slush-week companies, an artifact the user can act on (list, brief, email), matching the "day after the hackathon" bar (CHALLENGES.md:L285).
- Avoid a generic chat UI; a narrow workflow with an output the user takes away scores better on Real need and Execution.
- Check data coverage in the first hour (Cala mentors on site, CHALLENGES.md:L309); if the entity data is thin for your angle, switch early.

## Gaps and unknowns
- No Cala challenge winners found anywhere; MEGATHON page not directly verified.
- No Junction submission database or Devpost entries for this sponsor found.
- Cala data coverage depth is unknown (not tested here).

<!-- complete -->
