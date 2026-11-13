# Trusted Trade Agents: competitive intelligence (Agent B)

**Summary**
- The standards layer already exists and is public: AP2 (Google, Apache 2.0, moved to FIDO), UCP (Google and Shopify), ACP (Stripe and OpenAI). Judges who follow agentic commerce will have seen "MCP server over a catalog plus approval button" many times. Building on those standards is expected, not differentiating.
- Commercial B2B MCP products (Optimizely, Virto Commerce, others) already do search, price, cart and order. Most lack approvals. Optimizely lists approval chains only as planned. The gap is the governance model, not the lookup.
- I found no record of past Junction results for Valio Aimo challenges (searches returned nothing), so there is no winner pattern to copy. Estimate: crowding is medium, driven by the "agent + MCP + approval" idea being easy to reach.
- To stand out: signed, time-boxed fixed-price quotes, machine-readable mandates (AP2-style), a separate buyer agent, real exceptions on the sponsor's mock data, and a verifiable audit trail.

Evidence rule: facts below carry a URL I opened, or CHALLENGES.md line refs. Items marked "estimate" are my inference. Several searches returned snippets only; those are labelled "search snippet only".

## 1. What the challenge asks (for context)
Core: lookup, inquiry-to-fixed-price order, permission and human-approval management (CHALLENGES.md:L553-L559 region; Agent A's report lists L557-L559). Prize 4,000 / 2,000 / 1,000 EUR (CHALLENGES.md:L681-L693 per Agent A). Stated non-goal: replacing the UI with a chatbot (CHALLENGES.md:L573 region, "Impact" paragraph).

## 2. Previous winners of the same sponsor or similar challenges
- **Valio Aimo at Junction (prior years):** unknown. Two searches (Valio/Aimo winner; Junction 2025 Zero-Fail Logistics) returned nothing on Valio. The challenge text itself says last year's Zero-Fail Logistics challenge covered failed deliveries in depth (CHALLENGES.md, Optional section). Winner not found. Check hackjunction.com / Devpost galleries manually.
- **Junction overall winners (not Valio-related, general pattern only):** 2018 Oneiro (Ensto EV charger UX, 20,000 EUR) https://ensto.com/company/newsroom/company-news/junction-2018-hackathon-won-with-enstos-challenge/?bu=DSO ; Junction 2022 final winner chosen by participant peer evaluation plus partner judging https://view.asiae.co.kr/en/article/2022111311381508794 (search snippet only). Junction 2025 had 1,500+ participants and 291 projects per search snippet (Aalto/Wikipedia result pages, not opened): https://en.wikipedia.org/wiki/Junction_(hackathon). Lesson (estimate): overall winners tend to be polished, user-facing demos, not protocol work.
- **Similar agentic-commerce hackathons:** a Mastercard-hosted "36 hours to build trust in machine driven commerce" event exists https://www.mastercard.com/us/en/news-and-trends/stories/2026/36-hours-to-build-trust-in-machine-driven-commerce.html (page returned 403; title only from search, content unverified). Arc agentic commerce hackathon on lablab.ai; first-place on-site winner was NewsFacts, not procurement (search snippet only) https://lablab.ai/ai-articles/from-hackathon-to-reality-arc-agentic-commerce . START Hack 2026 entry "Sift" appeared in results, unopened.

## 3. Similar hackathon submissions (found; none confirmed as winners)
- S2PNexus, Devpost: source-to-pay with procurement agent and workflow/approval agent, autonomous routine ops, human oversight for high-risk (search snippet only; page 403) https://devpost.com/software/s2pnexus
- Limen, lablab.ai: per-deal procurement ceiling enforced in an on-chain escrow contract the agent cannot change (search snippet only; link redirects to starfieldlabs.ai) https://lablab.ai/submissions/wuohqamd53bk1dud5cyamy4d
- ProcureGuard AI, lablab.ai: eight agents reviewing vendor credentials with a human procurement lead (snippet only) https://lablab.ai/ai-articles/lablab-hackathon-success-stories-part-5
- Outbox, procurement copilot with human-in-the-loop gate for event purchasing (LinkedIn snippet only).
- Pattern (estimate): "multi-agent + human approval gate" is a common hackathon shape. Enforcement outside the LLM (Limen's contract) is rarer.

## 4. Open-source implementations
- procureflow-agent (GitHub): LangGraph/DeepAgents multi-agent, 8 MCP tools over a FastAPI ERP with 54 endpoints, stops at human approval before writes. 0 stars, 1 commit, no stated license. https://github.com/Running-hue/procureflow-agent (opened). Buyer-internal ERP assistant, not a seller-side interface.
- procurement-agent-mcp: early WIP, three local mock backends (search snippet only) https://github.com/njsav26/procurement-agent-mcp
- AP2 reference: Apache 2.0, spec and SDK, four A2A sample scenarios (human-present and human-not-present, cards or x402) https://ap2-protocol.org/ (opened). Mandates are signed verifiable credentials with open (constraints) and closed (final) stages; Checkout Mandate goes to the merchant. Standardisation continues in FIDO Alliance groups.
- UCP: open standard, discovery at `GET /.well-known/ucp`, capabilities (checkout, fulfillment, discount), MCP/REST/A2A transports. The page did not describe B2B capabilities. https://www.shopify.com/in/ucp (opened)
- ACP (Stripe and OpenAI): Apache 2.0, product feed, checkout, delegated payment with single-use shared payment tokens scoped to merchant, amount and time (search snippets) https://stripe.com/newsroom/news/stripe-openai-instant-checkout . Consumer and card oriented; fit for an invoiced wholesaler is unknown.

## 5. Commercial products
- Optimizely MCP server: catalog search, pricing with tier and VAT, inventory, PunchOut handoff, cart, order submission. Approvals not available; "approval chain automation" planned. https://world.optimizely.com/blogs/vaibhav/dates/2026/5/introducing-the-optimizely-mcp-server/ (opened)
- Virto Commerce onX adapter: search, pricing, cart, order as MCP tools; page describes no approval workflow. https://virtocommerce.com/integrations/ai-tools-and-agents (opened)
- Others (search snippets only, unverified): Merka2a (wholesale search, negotiate, order), Reqo/Cintra RFQ MCP, Vortex IQ PunchOut MCP, BuyingMesh connector. See search results referenced from https://www.pkgstats.com/pkg:@merk.a2a/mcp-server and https://glama.ai/mcp/servers/ifxc06bn81
- Takeaway: lookup-and-order over MCP is commodity. Approval and mandate governance is thin in the products I could verify. That is where the sponsor's judging weight sits (autonomy and controls 20%, per Agent A).

## 6. What most teams will build first (estimate)
1. A chatbot or LLM agent calling the mock `/api/price` and `/api/availability`, wrapped as an MCP server.
2. Natural-language parsing of "1,000 L lactose-free milk by Monday" to a product search.
3. Cheapest-in-stock ranking, maybe with a CO2 or delivery-reliability column.
4. An approval rule such as "orders over X EUR go to human", shown as a Slack/email/UI approve button.
5. A dashboard showing the order and a log.
6. Pitch: "open standards, MCP, human in the loop".

## 7. Obvious ideas to avoid (judges will have seen them)
- Chat UI over the catalog (the sponsor explicitly says this is not the point, CHALLENGES.md "Impact").
- Single-agent demo where one process plays both buyer and seller.
- A hardcoded euro threshold as the whole "permission model".
- An approval button with no cryptographic or structural link to what the agent was allowed to do.
- Free-form LLM log lines as the "audit trail".
- Generic "MCP server for catalog" with no pack-size, allergen or lactose-free correctness.
- A marketplace, negotiation or bidding features (out of scope per Agent A: L549, L557, L616).
- Name-dropping AP2/UCP/ACP without implementing any of their data structures.

## 8. Expected crowding (estimate)
Estimate: **medium**. Reasoning: Agentic AI track, concrete sponsor-provided mock API and datasets lower the entry cost, and the team stack (TypeScript, LLM agents) matches what most Junction teams use. The theme is also topical. Against that: Agent A rates difficulty 5 and the scoring rewards end-to-end plus controls, which filters out chat-only teams. Many teams will submit similar "agent + MCP + approval" builds, so the field is wide but shallow. I could not find prior participation counts per Valio challenge (unknown). Junction 2025 had about 291 projects overall (snippet).

## 9. How to look different (estimate/recommendation)
- Seller-side first: publish a discovery document (`/.well-known/`-style profile, OpenAPI plus MCP) so any buyer agent can onboard. Demo with a separate buyer agent from a different framework.
- Machine-readable mandate per buyer (AP2-style open/closed stages): spend caps, category allow-list, delivery window, allergen constraints, substitution policy, expiry. The seller validates it, not just the buyer UI.
- Signed, time-boxed fixed-price quotes (the challenge forbids negotiated quotes, so a quote must be a firm offer) with idempotent order commit.
- Deterministic decision engine outside the LLM that returns auto-commit / needs-approval / reject with reason codes. The LLM only proposes.
- Hard exceptions shown live: partial stock, late date, sales block, sponsor substitutions list (189 products per Agent A), pack-size maths for 1,000 L.
- Hash-chained, human-readable audit trail with a "why" for each decision, verifiable independently.
- Note the mock has no order or approval endpoint (Agent A), so the order and approval service must be ours; building it cleanly is itself the differentiator.
- Side-prize angle: using real AP2 data structures is a credible "open standards" story.

## 10. Gaps and unknowns
- Valio Aimo prior Junction winners: not found.
- Contents of Mastercard hackathon, S2PNexus, Limen pages: not verified (403/redirect).
- Whether ACP/UCP fit invoiced B2B wholesale: unknown.
- AP2 "human-not-present" maturity: site shows samples; 2025 secondary sources said planned (search snippet).

<!-- complete -->
