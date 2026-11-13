# Make Unicorns Real (Cala): technical feasibility (Agent D)

**Summary**
- **Buildable: yes, comfortably.** It is a pure-software product: a TypeScript web app, an LLM orchestrator and the Cala REST/MCP API. That matches the team's core skills. No hardware is involved (CHALLENGES.md:L285, L313).
- **The hard limits come from the API, not from our skills.** Cala's free plan allows **10 requests per minute** and counts "1 credit = 1 query" (https://cala.ai). Cala's own agent skill warns that queries "can take up to 180 seconds" and says to halt on HTTP 429 rather than retry (https://raw.githubusercontent.com/cala-ai/cala-skill/main/SKILL.md). Whether the promo code also raises the rate limit is **unknown**.
- **The biggest unknown is data coverage.** The docs never name investor or funding relationship types, and coverage counts are not published. Whether the graph holds enough Nordic or European seed-round and lead-investor data for our idea is **unknown**. We must test it in the first 2 hours, before we commit to an idea.
- **Estimates:** a strong core feature ships in 40 hours with probability 8/10. A live demo works with probability 7/10 if we build a warm cache and a record-and-replay fallback, and about 4/10 if every demo step makes a live multi-hop call.

---

## 1. What the platform actually offers (verified)

| Item | Fact | Source |
|---|---|---|
| REST base | `https://api.cala.ai/v1`, `X-API-KEY` header. OpenAPI "version: Beta 1.0" | https://api.cala.ai/openapi.json (fetched 2026-11-13) |
| Endpoints | `/v1/knowledge/search`, `/v1/knowledge/query`, `/v1/entities` (fuzzy name), `/v1/entities/lookup` (LEI/CIK/SIREN, etc.), `/v1/entities/{id}/introspection`, `/v1/entities/{id}` | same OpenAPI paths list |
| `knowledge/query` | Input is natural language or "Cala QL" dot notation, for example `startups.location=Spain.funding>10M.funding<=50M`, with `order_by`, `limit`, `return(...)`. Returns `results` rows and `entities` | https://docs.cala.ai/api-reference/query.md |
| Funding and investor QL examples | `companies.investors=Sequoia Capital,Andreessen Horowitz`; `companies.sector=climate tech.funding_round.series=A,B.location=Southern Europe.return(name, funding, investors)` | SKILL.md (URL above) |
| `knowledge/search` | Markdown `content` plus `explainability` claims that reference `context` KnowBits. Each KnowBit has `origins` with source and document URLs. The only options are two boolean flags, with no depth or speed setting | https://docs.cala.ai/api-reference/search.md |
| Entity retrieval | With no body, returns the default properties. A projection body returns named properties, relationships (paginated with `limit`/`offset`) and time series. Every property carries `sources` (name, date, document) | https://docs.cala.ai/api-reference/entities.md |
| Introspection | Lists the properties, incoming and outgoing relationships, and metrics for one entity. The example Company shows `PARTICIPATES_IN_CORPORATE_EVENT`, `OPERATES_IN_INDUSTRY`, `IS_CEO_OF` and similar. **No investor or funding relationship name is documented** | https://docs.cala.ai/api-reference/entity-introspection.md |
| Entity types | `Company`, `Person`, `Organization`, `FundingRound`, `PrivateCompanyFundingRound`, `FundingRoundTranche`, `Industry`, and others. No `Investor` type | query.md, entities.md |
| MCP | `https://api.cala.ai/mcp/` over HTTP, `X-API-KEY` header or OAuth for Claude Desktop. Five tools. OpenAI clients need `strict: false` | https://docs.cala.ai/integrations/mcp.md |
| SDKs | No official TypeScript SDK was found. A Python `langchain-cala` package exists (`CalaRetriever`, default timeout 30s). An n8n node and an agent skill exist | https://docs.langchain.com/oss/javascript/integrations/providers/cala ; https://docs.cala.ai/llms.txt |
| Liveness | An unauthenticated POST to `/v1/knowledge/query` returned 401 in 0.33s on 2026-11-13, so the host is up. Authenticated latency was **not measured** because we have no key | own curl test |

## 2. Limits, pricing, latency, reliability

| Concern | What is documented | Impact (estimate) |
|---|---|---|
| Rate limit | Free plan: "10 requests per minute", 100 credits per month, "1 credit = 1 query". Enterprise: "dedicated capacity" with no figures (https://cala.ai) | **The most serious constraint.** An agent that fans out over 10 investors × 3 hops uses 30+ calls, which takes 3+ minutes at 10 rpm. Whether the promo code raises the rpm is **unknown**. Ask on site |
| Credits | The hackathon promo code `MAKEUNICORNSREAL` gives "all the credits it needs" with no card (CHALLENGES.md:L313) | Credits are probably fine. Under free-plan terms, the 100-credit monthly base would run out in an hour of development without the promo |
| Latency | "Queries can take up to 180 seconds… Retry once, then halt", and the guidance is to raise the client timeout to about 180s (SKILL.md) | Live multi-hop calls are not demo-safe. The LangChain default timeout of 30s is below this |
| 429 handling | "Halt and report. Do not retry." (SKILL.md). The API reference shows a 429 body but no threshold (query.md) | We need a client-side token bucket below 10 rpm and a shared cache across all three devs and agents |
| Data quality | "Numeric fields may come back as approximate strings" such as "over 100M"; an empty result "means no match, not a syntax error" (query.md; SKILL.md) | Parse ranges and never sort strictly on funding amounts. Empty results fail silently, so build an explicit "no data" UI state |
| QL grammar | "not a strict grammar — there is no syntax to get wrong" (search.md) | Behaviour is fuzzy, and results may change with wording. Pin the exact query strings that are proven to work |
| Maturity | API labelled "Beta 1.0" (openapi.json). The agent-skill repo has 13 commits and 3 stars (https://github.com/cala-ai/cala-skill). No public reports of uptime, latency or coverage were found (web search, 2026-11-13) | Expect rough edges. Cala's CTO and engineers are on site to help (CHALLENGES.md:L309) |
| Coverage | The README lists organisations, people (including investors), "Funding rounds and investor portfolios", M&A and SEC filings (github.com/cala-ai/cala-skill). The homepage gives no counts and lists sources such as SEC/EDGAR, sanctions and news (https://cala.ai) | **Unknown depth for private European early-stage rounds.** The SEC focus suggests US public-company data is strongest (inference) |

## 3. Architecture a credible entry needs

Estimate, sized for a single-flow product:

1. **Frontend:** a Next.js/React web app, deployed (Vercel or Cloudflare). It has one onboarding form, one results view showing a ranked list or graph with source links on every fact, and one export action (CSV, email draft or shareable link). Make it mobile-friendly, since the target users are walking around Slush.
2. **`cala` module (single integration point):** a TypeScript REST client generated from `openapi.json`. It includes:
   - a **token-bucket limiter** (for example 8 rpm per key) and request de-duplication;
   - a **persistent cache** (SQLite or Postgres, or KV) keyed by the normalised query string, with a TTL;
   - a **record-and-replay mock** that follows the CLAUDE.md "external APIs behind one module with a mock" rule;
   - a 180s timeout and one retry, with no retry on 429.
3. **Orchestrator:** an LLM (Claude) plans a small, *bounded* set of QL queries (for example at most 6 Cala calls per user request) and then synthesises the answer. Synthesis may only state facts that cite a Cala KnowBit or property `sources` entry. Post-check that every claim maps to a source id, and drop claims that do not. A deterministic pipeline (fixed query templates plus LLM ranking and explanation) is safer than a free-roaming MCP agent, because each request uses a known number of calls.
4. **Background jobs:** run long fan-out work asynchronously (job queue plus polling or SSE) and stream partial results, so the UI never blocks for minutes.
5. **Pre-warm script:** before judging, run the demo personas' queries and store the results, so judges see answers in under a second while a single live call is shown for authenticity.
6. **Optional:** a side-by-side "what web search plus an LLM says" panel as a baseline. Agent A noted that this suits the judges (01 report, section 5).

## 4. Critical dependencies and how to get them

| Dependency | Access during the event | Risk |
|---|---|---|
| Cala API key | Free account at console.cala.ai/api-keys (https://docs.cala.ai/quickstart.md). Then Billing → Extra credits → promo `MAKEUNICORNSREAL` (CHALLENGES.md:L313) | Low. Do it in hour 0. Get **one key per developer** if the rate limit is per key (unknown) |
| Raised rate limit | Only by asking Cala staff, since the free plan is 10 rpm (https://cala.ai) | **High until confirmed** |
| LLM API (Claude or similar) | Our own keys | Low |
| Hosting | Vercel or Cloudflare free tier | Low |
| Venue Wi-Fi for the demo | Junction network, with a phone hotspot as backup | Medium. The cache and replay fallback cover it |

## 5. Integration complexity for this team

Low to moderate (estimate). It is REST with JSON and one auth header, inside our core TypeScript/LLM skill set. The real effort goes into four areas:
- **Discovery:** finding which QL forms and relationships actually return investor, lead and round data. Introspection must be called per entity, and the docs give no funding edge names (entity-introspection.md). Budget about 3 to 4 hours.
- **Normalisation:** approximate numeric strings, entity disambiguation through `entity_search` descriptions, and merging rows with the `entities` list.
- **Throughput engineering** around 10 rpm and calls of up to 180s.
- **Provenance UI:** mapping explainability references to context origins (search.md).

## 6. Does the core fit in 40 hours? Smallest complete version

Yes, if the scope is one flow. Smallest complete version (estimate), using the "raising money smarter" example (CHALLENGES.md:L297) with a sharper angle:

> A founder types their company name. We resolve it with `entity_search` and pull the sector, stage and location. We then return **10 investors who led rounds at this stage in this sector recently**. Each investor card shows sourced evidence (the round, date and source URL) plus one co-investor path for a warm intro. The founder can export the list.

That is about 4 to 6 Cala calls per request, plus cached fan-out. Swap in any other angle that passes the coverage test.

Rough plan (estimate; three people and parallel agents):

| Hours | Work |
|---|---|
| 0–3 | Keys and promo. **Coverage spike**: run 20 to 30 probe queries for candidate angles (Nordic seed leads, recent Series A by sector, investor portfolios). Pick the angle the data actually supports. Ask the on-site questions (section 8) |
| 3–12 | `cala` module (limiter, cache, mock), query templates, ranking, provenance mapping; UI skeleton deployed |
| 12–24 | End-to-end flow, async jobs and streaming, export, empty and slow states |
| 24–32 | Pre-warm script, baseline comparison panel, 3 demo personas, user tests with other participants |
| 32–40 | Hardening, replay fallback, pitch, recorded backup video |

## 7. Live demo: likelihood and failure modes

**Estimate: 7/10 with mitigations, about 4/10 without.** Failure modes, stated plainly:
1. **A live query hangs for 30 to 180s on stage** (SKILL.md timeout guidance). Mitigation: serve the pre-warmed cache, and show at most one live call with a progress stream.
2. **A 429 during judging.** All teams on this challenge may hit the API at once, and every developer and agent on our key shares 10 rpm (https://cala.ai). Mitigation: a separate demo key that is unused during the build, the cache, and the limiter.
3. **Empty results for the judge's own company or fund.** Coverage is unknown, and empty means "no match" (query.md). Judges will likely type their own names. Mitigation: an honest "Cala has no data on X yet" state plus a curated list of suggested inputs. This remains a real risk.
4. **Wrong or approximate numbers** ("over 100M") shown as exact, or misresolved entities, such as two companies called "Cala" (our web search mixed up Cala Health and Cala Systems). Mitigation: show ranges and descriptions, and let the user confirm the entity.
5. **LLM hallucination** beyond the Cala facts damages the "sourced" pitch. Mitigation: enforce citations and drop unsourced claims.
6. **Beta API change or outage** (OpenAPI "Beta 1.0"). Mitigation: replay mode, clearly labelled as cached data, plus a backup video.
7. **Venue network failure.** Mitigation: a hotspot and local replay.

## 8. Ask the Cala team on site before committing

1. What is the **rate limit after the promo code is applied**? Is it per key or per account? Can a demo key get a higher limit for judging?
2. **Typical latency** of `query` and `search`, and which query shapes are slow or "too complex"?
3. **Coverage** of private-company funding rounds: European and Nordic seed and Series A, recency lag, and whether the **lead investor** is distinguished from participants.
4. The exact **relationship and property names** for investors, rounds and portfolios (for example on a `PrivateCompanyFundingRound`). Is there a recommended QL for "investors who led X-stage rounds in sector Y since date Z"?
5. Does the credit cost differ between `search` and `query` (only "1 credit = 1 query" is published)?
6. Are we allowed to **cache or persist** Cala results in our app, and to show source URLs publicly? Are there terms-of-use limits for a product "used the day after"?
7. What counts as "Cala core" for the judges, and does mixing in other data sources (for example LinkedIn, Crunchbase or our own scraping) hurt the Use of Cala score?
8. Submission deliverables and deadline for the challenge award (**unknown** from CHALLENGES.md).

## Sources opened
- /Users/ciprian/code/Junction 26/docs/JUNCTION_2026_CHALLENGES.md L273-353
- /Users/ciprian/code/Junction 26/docs/challenge-selection/01-challenge-intelligence/make-unicorns-real.md
- https://docs.cala.ai/llms.txt
- https://docs.cala.ai/quickstart.md
- https://docs.cala.ai/api-reference/query.md
- https://docs.cala.ai/api-reference/search.md
- https://docs.cala.ai/api-reference/entities.md
- https://docs.cala.ai/api-reference/entity-introspection.md
- https://docs.cala.ai/integrations/mcp.md
- https://docs.cala.ai/integrations/agent-skill.md
- https://cala.ai (pricing section)
- https://github.com/cala-ai/cala-skill and https://raw.githubusercontent.com/cala-ai/cala-skill/main/SKILL.md
- https://docs.langchain.com/oss/javascript/integrations/providers/cala
- https://api.cala.ai/openapi.json plus an unauthenticated curl probe (401, 0.33s, 2026-11-13)
- Not reachable: https://megathon.fluxzero.io/tracks/cala (DNS failure). A prior Cala hackathon track was seen only as a search snippet, unverified

<!-- complete -->
