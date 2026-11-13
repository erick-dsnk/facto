# Make Unicorns Real (Cala): challenge intelligence

**Summary**
- Cala wants a focused, complete product for founders and/or investors. The product must be built on Cala's sourced knowledge graph of companies, people, funding rounds and investors, queried through REST or MCP (CHALLENGES.md:L281, L285).
- Judging uses four criteria at 25% each: Real need, Execution, Originality and Use of Cala. Cala must be core to the product, and a fresh angle beats a generic idea (CHALLENGES.md:L287).
- First prize is the "Cala Comet" hackathon-travel package plus €1,000 in Cala credits. It is not cash (CHALLENGES.md:L289, L346). Credits are free with the promo code. No hardware is involved.
- This is pure software (TypeScript, LLM and agent work), which is the team's core strength. The main risk is originality: "investor matcher" ideas are the obvious default, and the judges say they penalise ideas they have seen many times (CHALLENGES.md:L287).

---

## 1. Database record

| Field | Value | Source |
|---|---|---|
| Challenge | Make Unicorns Real | CHALLENGES.md:L273 |
| Sponsor | Cala (cala.ai). A third-party directory lists it as based in Barcelona and founded in 2025 (unverified) | CHALLENGES.md:L277, L323; https://startup-seeker.com/company/cala~ai (search snippet only, not opened) |
| Track | unknown. The extract has no track heading above L273. The original page is https://hackjunction.app/participate/45/challenges/350 (CHALLENGES.md:L275; not opened, needs login) | — |
| Main requirement | "Build a product on top of Cala's data that solves a real need for founders, investors, or both." | CHALLENGES.md:L285 |
| Judging emphasis and weights | Real need 25%, Execution 25%, Originality 25%, Use of Cala 25% | CHALLENGES.md:L287, L317, L325-341 |
| Prize, 1st | "Cala Comet" for each member: for three months, one hackathon of the member's choice per month, with travel and accommodation paid. Stated as "worth around €5,000 for a team of four". The team also gets €1,000 in Cala credits and Cala merch. A later section phrases it as "5,000€ to attend any hackathon on the planet + 1,000€ in Cala credits + Cala Merch" | CHALLENGES.md:L289, L345-347 |
| Prize, runner-up | Two conflicting descriptions: "€500 in Cala credits and Cala merch" (L289) and "500€ + Cala Merch" (L351). Whether the €500 is cash or credits is **unknown**. L289 reads as credits | CHALLENGES.md:L289, L349-351 |
| Prize value for our three-person team | Estimate: about €3,750 in travel value (€5,000 × 3/4) if the value is per member. Not cash. Whether it scales by team size is unknown | inference from CHALLENGES.md:L289 |
| Provided APIs/data | Cala API and MCP: an "agent-first database of the world, built on a knowledge graph where every data point is sourced and connected". Unlimited build credits ("all the credits it needs") via promo code `MAKEUNICORNSREAL` in console.cala.ai → Billing → Extra credits → Add promo code, with no payment details | CHALLENGES.md:L291, L313 |
| API surface | REST at `api.cala.ai`, auth with an `X-API-KEY` header. Endpoints: `POST /v1/knowledge/search` (markdown answer + `context` KnowBits with `origins` source/document URLs + `explainability` reasoning steps that reference KnowBit ids), `POST /v1/knowledge/query` (typed JSON rows via a natural-language question or the "Cala QL" dot-notation, e.g. `startups.location=Spain.funding>10M.funding<=50M`, plus `order_by`, `limit`, `return(...)`), `/v1/entities` (fuzzy name search), `/v1/entities/lookup` (by LEI/CIK/SIREN), `/v1/entities/{id}`, and entity introspection (field schema per entity) | https://docs.cala.ai, https://docs.cala.ai/api-reference/query.md, https://docs.cala.ai/api-reference/search.md |
| MCP | `https://api.cala.ai/mcp/`. Tools: knowledge_search, knowledge_query, entity_search, entity_introspection, entity_retrieval. Claude Desktop connects via OAuth | https://docs.cala.ai/integrations/mcp.md |
| Other integrations | Agent Skill, n8n, a LangChain provider, and an OpenAPI spec at https://api.cala.ai/openapi.json | https://docs.cala.ai/llms.txt |
| Entity types relevant here | Company, Organization, Person, FundingRound, PrivateCompanyFundingRound, FundingRoundTranche, Industry, location types. **No separate Investor type is listed.** Investors appear to be reachable through filters such as `investors=A AND B` | https://docs.cala.ai/api-reference/query.md |
| Data caveats | Numeric values may be approximate strings such as "over 100M". An empty result means no match, not a syntax error. A 429 rate limit exists, with no published threshold. Per-call credit cost: unknown | https://docs.cala.ai/api-reference/query.md, search.md |
| Data coverage depth (e.g. Nordic seed rounds, recency) | unknown. Test it at the start of the event | — |
| Hardware | None | CHALLENGES.md:L281-313 (nothing mentioned) |
| Submission requirements | unknown. The challenge text states no specific deliverables beyond the product. General Junction submission rules are not in this extract | — |
| Support | Mentors on site throughout the event, including Issey Masuda (co-founder and CTO) and Cala engineers. Contact: Elies Delgado, elies@cala.ai. Workshop "Tips & tricks to Make Unicorns Real" on Saturday at 11:00, covering "how to build things web search can't, and what our judges will be looking for" | CHALLENGES.md:L309-315 |

## 2. What Cala is actually trying to encourage

**Reading:** Cala is a young data-infrastructure startup selling to agent builders. It wants showcase products that prove a structured, sourced, connected graph beats web search plus an LLM. It also wants the demos to be credible to the Slush crowd of founders and VCs, who are its next audience and possible users or investors. This reading is an inference, supported by the following:

- "Make it rely on what makes Cala different: structured, sourced data on companies, funding rounds and investors, and the connections between them." (L285) Relationships and multi-hop queries are the point, not single lookups.
- The workshop promises "how to build things web search can't" (L315). The real test is whether the product could have been built with Perplexity or Google. If so, it scores poorly on Use of Cala.
- "aim for a complete product they could start using the day after the hackathon", timed against Slush (L285). They want something demo-able to real founders and investors next week.
- "Enterprise clients already use Cala in agentic workflows across finance, pharma and legal. We're at Junction to see what builders create when reliable data is no longer the bottleneck." (L291) This is a developer-relations and marketing play, and it uncovers use cases.
- The prize is hackathon travel (L289). They are recruiting builders as community ambassadors (inference).
- The docs emphasise provenance: KnowBit `origins` and explainability steps that reference sources (https://docs.cala.ai/api-reference/search.md). Surfacing citations in the UI is the easiest way to show "sourced" data.

## 3. Explicit requirements (quoted)

- "Build a product on top of Cala's data that solves a real need for founders, investors, or both." (L285)
- "Don't try to cover everything: one need solved in an original, well-executed way beats a platform that does ten things halfway." (L285)
- "aim for a complete product they could start using the day after the hackathon." (L285)
- "Make it rely on what makes Cala different: structured, sourced data on companies, funding rounds and investors, and the connections between them." (L285)
- "a fresh angle on a real need scores higher than a generic version of an idea we've seen many times. Focus beats breadth" (L287)
- "Use of Cala (25%): Cala is core to the product, not an add-on" (L287)

Seed ideas, which they say are "starting points rather than a menu" (L295): raising money smarter (finding active lead investors), reading a market, investing with confidence (early discovery and sourced background checks), and beyond funding (first customers among recently funded companies, market sizing, mapping acquirers) (L297-303). They add: "We'd love to see needs we haven't thought of." (L305)

## 4. What a mediocre submission looks like

- A chat UI ("Ask Cala anything about startups") that wraps `knowledge_search` and adds nothing. This is generic, and Cala is a pass-through rather than a product.
- An "investor matcher for founders" that ranks VCs by sector keyword. This is the most-seen idea, and the challenge text even lists it (L297). It scores low on Originality unless the angle is sharp, for example lead-only investors, recency-weighted, with co-investor graph paths to a warm intro.
- A dashboard covering market maps, investor search, due diligence and CRM all at once. The judges reject breadth explicitly (L285, L287).
- An app that uses Cala once for enrichment, then does the real work with web scraping or LLM hallucination, and shows no sources. That fails "core, not add-on".
- A slick UI that breaks on live queries because nobody checked data coverage, or because approximate numeric strings ("over 100M") were not parsed.

## 5. What an exceptional submission would demonstrate

Estimates, based on the rubric and the sponsor's framing:
- **One named user and one job.** Example: "a first-time Nordic seed founder needs a shortlist of 10 leads who led a pre-seed or seed round in their vertical in the last 12 months, and how to reach them". It starts from a real pain and ends with a concrete action.
- **Graph-native value.** Multi-hop queries that web search cannot answer in one go, such as investor → rounds led → co-investors → portfolio overlap → competitor exposure, or "companies that just raised Series A in X" → likely buyers of my product. Show the query and the traversal.
- **Provenance visible.** Every claim in the UI links to its Cala KnowBit origin URL. A trust or recency indicator is a strong signal for the "sourced" pitch.
- **A side-by-side against web search.** A short baseline showing ChatGPT or Perplexity getting it wrong or stale while Cala is right and sourced. This also suits the jury's interest in baselines and evaluation (jury guide PDF, Daksh Raghuvanshi row: "Baseline comparison").
- **A complete, deployable flow.** Onboarding, then a result, then an export or action, all usable "the day after" at Slush. Ideally a few real founders or investors try it during the event.
- **An original angle.** Examples: an acquirer map for exits, a "who's still actively deploying" detector for zombie funds, or first-customer prospecting among recently funded companies (L303). These are ideas, not validated against coverage.

## 6. Constraints that could disqualify or sink a project

- **Not built on Cala data** (L285). This is effectively disqualifying for this prize, and at minimum costs 25% of the score.
- Not aimed at founders or investors (L285). Out of scope.
- Formal eligibility rules (team size, prior code, open-source licence, submission format or deadline): **unknown** from the challenge text. Check the Junction general rules.
- Practical risks (estimates): data coverage gaps for niche or recent rounds; a 429 rate limit with no published threshold (https://docs.cala.ai/api-reference/query.md); approximate numeric values; no explicit Investor entity type, so investor-centric features need early validation.
- Healthcare is out of scope for the team, and this challenge has no healthcare aspect, so that constraint does not apply.

## 7. Physical hardware work

**None.** The product is a web or agent product on a REST/MCP data API (CHALLENGES.md:L291, L313). No devices, sensors or kits are mentioned. Optional consumer-device angles, such as a phone or glasses for "who am I talking to at Slush" lookups, are possible but not required. That idea is an estimate, not part of the brief.

## Sources opened
- /Users/ciprian/code/Junction 26/docs/JUNCTION_2026_CHALLENGES.md L273-353
- https://docs.cala.ai
- https://docs.cala.ai/llms.txt
- https://docs.cala.ai/api-reference/query.md
- https://docs.cala.ai/api-reference/search.md
- https://docs.cala.ai/integrations/mcp.md
- /Users/ciprian/code/Junction 26/docs/00-Jury-profiles-and-pitch-guide.pdf (pdftotext; overall jury, not Cala judges)

<!-- complete -->
