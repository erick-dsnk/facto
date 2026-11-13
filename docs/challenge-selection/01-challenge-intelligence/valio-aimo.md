# Valio Aimo: "Trusted Trade Agents" (slug `valio-aimo`)

**Summary**
- Build the **interface and operating model** that lets an external AI purchasing agent (for example, a hotel chain's agent) look up products, prices and availability at Valio Aimo, place an order at a fixed price, and send the decisions it is not allowed to make to a human. It must use open standards, not a proprietary black box (CHALLENGES.md:L543, L549, L555-559).
- Judging: working end-to-end demo 30%, fit to the buyer's need 20%, guardrails/autonomy/audit 20%, exception handling 15%, openness and path to production 15% (CHALLENGES.md:L661-679). Prizes: €4,000, €2,000 and €1,000 (CHALLENGES.md:L683-693).
- No hardware. It is a pure TypeScript/LLM-agent build against a live mock API (price and availability) plus a 17.5k-product synthetic catalogue. **The mock API has no order endpoint**, so we must build the order/approval side ourselves (verified in the portal's OpenAPI spec).
- Estimate: this fits the team's strongest skills (agents and full-stack). The sponsor wants an end-to-end demo with visible guardrails and an audit trail, so polish and good exception handling will matter more than novelty.

---

## 1. Database record

| Field | Value | Source |
|---|---|---|
| Challenge | "Trusted Trade Agents" (company section headed "Valio Aimo®") | CHALLENGES.md:L535, L575 |
| Original page | https://hackjunction.app/participate/45/challenges/327 (not opened; transcribed in CHALLENGES.md) | CHALLENGES.md:L537 |
| Sponsor | Valio Aimo (Valio's food-service wholesale arm: 20,000 professional customers, 25,000 product names, 700 suppliers) | CHALLENGES.md:L539, L581-584 |
| Track | Agentic AI Track | CHALLENGES.md:L9 (track heading over L11-696) |
| Main requirement | Enable (1) structured product/price/availability lookup, (2) a defined flow from inquiry to order at fixed prices, (3) permission and human-approval management | CHALLENGES.md:L555-559 |
| Judging emphasis | Working end-to-end demo 30%; Solving the problem/user need 20%; Autonomy and controls 20%; Robustness to exceptions 15%; Openness and credible path to production 15% | CHALLENGES.md:L661-679 |
| Prize | 1st €4,000, 2nd €2,000, 3rd €1,000 | CHALLENGES.md:L683-693 |
| Provided data/APIs | A synthetic catalogue, simulated suppliers and mock APIs (price, availability, lead times, certificates/labels; carbon ranges as a stretch goal) | CHALLENGES.md:L622-623 |
| Resource portal | https://junction26.valioaimo.fi/ (password-gated; the password and API key are in CHALLENGES.md:L637, L643) | CHALLENGES.md:L635-645; portal opened 2026-11-13 |
| Webshop test accounts | "will be shared separately once available": **unknown** whether they ever arrive | CHALLENGES.md:L647 |
| Mentoring | Marketplace/commercial, online sales, IT integrations and data governance (named mentors) | CHALLENGES.md:L624, L628-632 |
| Preferred tech | Agentic/tool-use frameworks, open data/interop standards, recommendation logic, optional verifiable credentials or a trust layer. x402 and Nevermined are "relevant context but not required" | CHALLENGES.md:L626 |
| Hardware | None | CHALLENGES.md:L616, L622 |
| Submission requirements | **Unknown.** The challenge text names no deliverable format (repo, video, etc.). The judging criterion implies a demo of the full request → lookup → order/approval flow in the mocked environment | CHALLENGES.md:L663 |
| Past winners of this sponsor's challenges | **Unknown.** A web search found nothing ([search](https://www.aalto.fi/en/news/aalto-students-and-researchers-shape-together-how-we-age-with-ai-at-junction-hackathon-2025) and other results did not mention Valio Aimo). L564 mentions a "Zero-Fail Logistics" challenge last year that covered failed deliveries | CHALLENGES.md:L564 |

### What is actually in the resource portal (verified by logging in on 2026-11-13)
Portal home page: https://junction26.valioaimo.fi/ (behind a login). OpenAPI spec: https://junction26.valioaimo.fi/openapi.json.
- **Endpoints** (all under `/api` need an `X-API-Key` header): `GET /api/ping`, `POST /api/availability`, `POST /api/price`, plus download links for products, delivery reliability and carbon footprint. **There is no order, cart, customer or search endpoint.** Product search has to run over the static file, and order placement and approval have to be mocked by us.
- Request body for price and availability: `{customer, requestedDate, products[1..1000]}`. A live call to ping returned `{"status":"ok"}`. Availability returns `salesBlock`, `closingTime`, `logisticModel` and `scheduleLines[{availableAmount, availableDate, salesUnit}]`. Price returns catalog, list, comparison and with-tax prices, tax rate, `netPriceFound` and `error`.
- The spec's own warning: *"solutions should not be based on frequently retrieving prices and availabilities for **all** products … prices and availabilities are customer specific … Query the APIs only when you have narrowed down the products … Undisclosed rate limits are in place."* The design must therefore filter the catalogue first and call the API second.
- **Product data**: 17,546 products, about 87 MB of JSON. Fields include `allowedLotSize`, `baseUnit`, `salesUnit`, `units` (packaging hierarchy with GTINs), `category` (a code only, with no names), `countryOfOrigin`, `temperatureCondition` (a code only), `vendorName`, `deposits`, `substitutions` (189 products have explicit substitute rules), and `synkkaData` (GS1 Synkka manufacturer data: names, ingredients, allergen and nutrition classifications, labels and claims; almost all products have an allergen classification group). The portal says data quality varies: fresh produce often lacks allergen and nutrition data.
- **Gotcha**: Python's `json.load` failed on the product file around character 42.6M. Replacing `NaN` tokens made it parse (observed; plan to use a tolerant parser).
- **Delivery reliability CSV**: about 4,425 products, with values from 0 to 1. **Carbon footprint CSV**: about 11,033 products, giving an average kg CO2-eq per kg *for the product group*.
- The product data must not be used outside the event (product schema title).

## 2. What the sponsor is actually trying to encourage

Our reading (an inference): Valio Aimo wants to **define the agent-facing contract for a B2B food wholesaler before a big platform defines it for them**, and to keep control of its data and the customer relationship. They want a demo they can take internally as a credible blueprint: an open protocol, a guardrail policy and an audit format. A clever consumer chatbot is not what they are after.

Evidence:
- "This is not about replacing today's e-commerce UI with a chatbot. It is about defining how a European food-service wholesaler can be safely and openly readable by autonomous agents – before that interface gets defined by someone else's platform." (CHALLENGES.md:L573)
- Exposure to agents "becomes existential for data ownership, trust, and who owns the customer relationship" (CHALLENGES.md:L547).
- "built on **open, verifiable standards** rather than a single platform's black box" (CHALLENGES.md:L549). Openness carries 15% of the score and asks for "Open, documented standards rather than a proprietary format" (CHALLENGES.md:L679).
- The problems they list are about trust and governance: a trust protocol, a guardrails model, response logic and an audit trail (CHALLENGES.md:L594-600). Controls are worth 20% (CHALLENGES.md:L671).
- They are also exploring their own sell-side agent ("Proactive selling agent", CHALLENGES.md:L610), so both sides of an agent-to-agent exchange are of interest.
- Recipe logic shows up in three scenarios (CHALLENGES.md:L604-608), which suggests they value food-domain intelligence (substituting by what the recipe needs) over swapping one SKU for another.

## 3. Explicit requirements (quoted)

Core, "your solution must enable" (CHALLENGES.md:L555-559):
> - **Product, price & availability lookup:** a structured way for an external agent to search for and retrieve what's available and at what price.
> - **Requesting price & availability, then placing an order:** a defined interaction for moving from inquiry to commitment, based on fixed prices rather than a negotiated quote.
> - **Permission & human-approval management:** what the agent may decide on its own, and what must go to a human for sign-off.

Optional, "not required to win" (CHALLENGES.md:L561-565): delivery time and sustainability comparison; substitution and exception handling ("isn't scored as core"); traceability and explainability. Note that exception handling still has its own 15% judging criterion (CHALLENGES.md:L673-675). The two passages pull in different directions, and the weighted criterion should win.

Canonical example (CHALLENGES.md:L569-571):
> *"I need 1,000 litres of lactose-free milk by Monday. Find an option that meets our requirements based on price and availability."* … Your solution returns products, prices and availability in structured form; the agent places the order within its authority or sends it to a human for approval.

Scope note (CHALLENGES.md:L616): "we are mocking a structured data/API interface. Whether … production interface eventually becomes a traditional API, an MCP-style agentic interface or a full service agent of its own is outside the scope."

Judging criterion 1 (CHALLENGES.md:L663): "runs through a full request → lookup → order/approval flow in the mocked environment, not just isolated pieces."

## 4. What a mediocre submission looks like (estimate)

- A chat UI where an LLM is given a few tools (search, price, availability) and answers "here are some milk options". There is no real order commitment and no approval step. That is exactly the "chatbot replacing the UI" framing that L573 rejects.
- Guardrails written as one hard-coded "if total > €X ask human" rule, with no policy model, no reason codes and no log a buyer could read.
- Only the happy path: it ignores lot sizes (`allowedLotSize`), sales units against base units (litres versus cases), `closingTime` cut-offs, `salesBlock`, and partial `scheduleLines`.
- It bulk-queries price and availability for the whole catalogue and hits the undisclosed rate limits (see the OpenAPI description).
- It uses an invented proprietary JSON format and has no story about standards (MCP, OpenAPI, schema.org/GS1, verifiable credentials).

## 5. What an exceptional submission would demonstrate (estimate)

- **A live end-to-end run of L569**: a buyer agent (ideally a separate process talking over an open protocol such as MCP or A2A, described in OpenAPI) parses "1,000 L lactose-free milk by Monday" and filters 17.5k products by GS1 allergen and claim data. It then makes a narrow price and availability call and converts litres into sales units and lot multiples. Finally it either commits an order within its mandate or sends it for approval with a clear diff ("over €2k threshold" or "substitute outside stated preference").
- **A declarative guardrail policy** (a machine-readable mandate per buyer covering spend caps, approved categories, allergen hard constraints and substitution tolerance), plus a human-approval UI that shows what was requested, what is proposed and why.
- **Exception handling with real data**: partial availability split across dates, explicit `substitutions` used first and recipe- or nutrition-compatible alternatives second, ranked good / better / best (CHALLENGES.md:L598). It should respect allergen constraints for the school/hospital scenario (CHALLENGES.md:L612) and use delivery reliability and carbon as tie-breakers.
- **A trust layer**: quotes signed by Valio Aimo (for example JWS, or W3C verifiable credentials for price, stock and origin claims with an expiry date) that the buyer agent verifies before it commits. This answers the "trust protocol" problem directly (CHALLENGES.md:L594, L626).
- **An audit trail** that both sides can read: a human-readable log plus a structured log with hashes or signatures (CHALLENGES.md:L600).
- **A credible path to production**: an assumptions list, a statement of what is mocked, and next steps (CHALLENGES.md:L679). A stretch goal is the sell-side "proactive selling agent" or standing-order drift detection (CHALLENGES.md:L610, L614).

## 6. Constraints that could disqualify or sink a project

- Explicit disqualification rules: **unknown**. None are stated in the challenge text.
- A demo of isolated pieces instead of the full request → lookup → order/approval flow loses up to 30% (CHALLENGES.md:L663). This is not a stated disqualifier.
- Proprietary formats cost points on the openness criterion (CHALLENGES.md:L679).
- Data use: the product data "must not be used for anything outside of Junction 2026" (product schema title and portal text). Do not publish the raw dataset in a public repo (an inference from that wording).
- Rate limits are undisclosed, and bulk polling of prices and availability is explicitly discouraged (OpenAPI description). A demo that gets throttled live is a practical risk.
- Webshop test accounts are not yet available (CHALLENGES.md:L647). Do not plan around them.
- Production integration is out of scope (CHALLENGES.md:L616, L623). All data is synthetic.

## 7. Physical hardware work

**None.** Everything is a synthetic catalogue plus mock HTTP APIs (CHALLENGES.md:L616, L622-623, L649). It is pure software, which suits the team's agent and full-stack strengths.

<!-- complete -->
