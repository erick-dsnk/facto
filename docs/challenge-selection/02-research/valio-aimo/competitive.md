# Valio Aimo "Trusted Trade Agents": competitive intelligence (Agent B)

**Summary**
- Prior art for the *parts* is abundant: open agent-commerce protocols (ACP, AP2), many MCP "procurement/order" servers, and last year's Valio Aimo case. Prior art for the *whole combination* in a foodservice-wholesale setting is thin as far as I could find, but my search was cut short (see Limits).
- Expect most teams to build "chatbot + tool calls over the mock APIs + approve button". That is the baseline judges will see repeatedly.
- Crowdedness estimate: medium-high (estimate, reasoning below). Differentiate on the guardrail/trust layer (signed mandate, verifiable quotes, audit log) running end to end on real catalogue data.
- Hardware: none.

## Limits of this research
- The shared web search budget ran out mid-task. I could not search for Devpost entries from other hackathons, nor open the LinkedIn post that names the 2025 winner. "Not found" below means not searched or not found, not proven absent.
- Challenge facts come from CHALLENGES.md (lines 541-693) only.

## What the challenge asks (CHALLENGES.md)
- Core: structured product/price/availability lookup; inquiry-to-order at fixed prices; permission and human-approval management (L555-559).
- Scoring: end-to-end demo 30%, user need 20%, autonomy and controls 20%, exception robustness 15%, openness/path to production 15% (L659-679).
- Preferred tech: agent frameworks, open interop standards, recommendation logic, optional verifiable credentials; x402/Nevermined named as "relevant context but not required" (L626).
- The challenge explicitly says it is "not about replacing today's e-commerce UI with a chatbot" (L573). A chatbot front end is therefore the most predictable thing to avoid.

## Same-sponsor history: Junction 2025
- Valio Aimo's 2025 case was delivery reliability ("Zero-Fail Logistics"): use AI so shortages are caught before delivery. Top three listed by Valio Aimo (order within the three is not stated in the article): Omni-Valio / NP Incomplete; Helmi / A to Z; Valio Aimo Zero-Fail / Kolmen Kopla. Article dated 17 Nov 2025. https://www.valioaimo.fi/artikkelit/pinnalla-nyt/junction-hackaton-2025/ (opened). The article does not describe the solutions or jury reasoning.
- A search result snippet (not opened) says a LinkedIn post names Omni-Valio as winner; treat as unverified.
- One public repo for that case, "Snack Overflow": React/TypeScript/Vite frontend, FastAPI + MySQL backend, Groq LLM flows, product reliability score at checkout, substitute suggestions, support chatbot, AI image validation of orders. Placement not stated in the repo. https://github.com/pasiones/Hackathon2025 (opened). A portfolio page (not opened) reportedly claims 6th place for a different "Zero-Fail Logistics Solution" using XGBoost and LangChain; single unverified source.
- Inference (estimate): the 2025 pattern was ML prediction plus substitution plus customer-facing assistant. The 2026 brief deliberately moves away from that: substitution is "not scored as core" because last year covered it (L564). Re-presenting substitution as the headline would look repeated.

## Existing open protocols (the "open standards" the judges will expect to hear)
| Item | What it is | URL |
|---|---|---|
| Agentic Commerce Protocol (OpenAI + Stripe) | Apache 2.0, beta. Checkout API and Delegate Payment API as OpenAPI, JSON schemas, RFCs; latest stable 2026-04-17 (cart, feed, orders, authentication, MCP). Consumer-checkout oriented. | https://github.com/agentic-commerce-protocol/agentic-commerce-protocol (opened) |
| Agent Payments Protocol AP2 (Google) | Apache 2.0. Signed mandates: Intent Mandate (price limits, timing, rules) and Cart Mandate (exact items and price), signed with verifiable credentials. Google names B2B autonomous procurement as a possible use. Repo has Python/Go/Android samples. | https://cloud.google.com/blog/products/ai-machine-learning/announcing-agents-to-payments-ap2-protocol/ (opened), https://github.com/google-agentic-commerce/AP2 (opened) |
| MCP | Tool protocol the brief hints at ("MCP-style", L616). Not opened separately. | n/a |

Implication: "Intent mandate = spend/substitution limits, cart mandate = approved order" maps almost one to one onto the Core requirement "what the agent may decide alone". Any team that reads AP2 will reach for it, so merely citing it is not a differentiator; implementing it against real constraints would be.

## Existing open-source / commercial implementations (parts of the problem)
- ERP-lite MCP server (MIT): read-only ERP tools plus a purchase-requisition workflow. Agent creates requisitions in `pending_approval`, cannot approve its own; approval via separate human-only admin REST endpoint; append-only audit log. This is the propose-only + audit pattern a team would copy. https://glama.ai/mcp/servers/dttqxqwrg2 (opened; README/tool-schema discrepancy noted there).
- Merka2a MCP server (MIT): buyer-side search, negotiate, order, cancel, refund, for GPU compute (not wholesale food; the search snippet said electronics, the opened page says GPU). No approval controls or spend limits documented. https://glama.ai/mcp/servers/xgshnt8fz5 (opened).
- Other hits from search, not opened, so only existence is claimed: procurement-agent-mcp (mock-service procurement workflow), Reqo/Cintra Supply hosted RFQ-and-quote MCP, Optimizely B2B commerce MCP server, Coupa MCP architecture guide. Found via https://glama.ai/mcp/servers/g47tggbbt4 and the other result links in my search; treat as leads only.
- Not searched: hospitality or foodservice ordering products from large wholesalers (for example Sysco, Metro) and procurement startups. Unknown whether any offers an agent-facing interface.

## Approaches most teams will reach for first (estimate)
1. Chat UI over the three mock endpoints, LLM tool-calling, "approve" button above a euro threshold.
2. A product-search RAG/embedding layer over the 17,546 products.
3. Substitution by embedding similarity or the 189 provided rules, shown as a ranked list.
4. Wrapping the mock APIs as an MCP server and calling it "open standard".
5. A dashboard showing orders and an LLM-written "explanation" as the audit trail.
6. Recipe/menu-to-order scenario from L604, since it demos well.
7. Mock order endpoint with no persistence or lifecycle.

## Obvious ideas to avoid (as headline)
- Chatbot or voice front end for ordering (contradicts L573).
- "Just an MCP server" with no trust or controls story.
- Generic spend-threshold approval with no policy language.
- LLM-narrated audit log that is not a structured, verifiable record.
- Delivery-reliability prediction/substitution as the main idea (2025 territory).
- Recipe-planner demo with weak data grounding.

## Crowdedness estimate
Estimate: medium-high among teams that pick this track.
- For: concrete sponsor with real data, API key in the brief, clear scoring rubric, prize €4k/€2k/€1k (L683-693), agentic AI is the dominant hackathon theme, and all three agent frameworks teams know are directly applicable. Last year the same sponsor drew several documented entries.
- Against: the brief is abstract (an "interface and operating model", not an app), the ordering endpoint does not exist and must be mocked, and it rewards protocol and governance thinking that many teams find less exciting than a visible product.
- I have no data on how many teams enter any challenge; Junction 2025 had over 1,500 participants (valioaimo.fi article above), so even a few percent choosing this means many entries.

## What would look different
- Make the trust layer the product: a declarative, machine-readable mandate (limits, allowed categories, allergens, substitution tolerance, approval rules) that Valio Aimo's side enforces, mirroring AP2 Intent/Cart mandates, shown on screen.
- Signed or verifiable price/availability quotes with validity windows, checked by the agent before ordering (addresses "Trust protocol", L594). Note this must be our own layer over the mock APIs; the mock has no order endpoint, per Agent A's summary.
- Real catalogue grounding: GS1 allergen filtering and unit/lot conversion on the supplied product data for the 1,000 L lactose-free milk example (L569), including a case where the naive answer is wrong.
- A shared audit log both buyer and Valio Aimo can read (L600), structured and tamper-evident, not only prose.
- Failure-first demo: partial availability, price change between quote and order, allergen conflict, mandate breach routed to approval; this feeds the 15% exception criterion without leaning on substitution as the story.
- Two-sided view: also show the seller-side agent or policy (proactive suggestion, L610), since Valio Aimo's goal is controlling its own interface.
- Package as an open spec plus reference implementation (OpenAPI/MCP, documented assumptions and a production path) to score the 15% openness criterion.

<!-- complete -->
