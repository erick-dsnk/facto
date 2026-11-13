# Trusted Trade Agents (Valio Aimo): challenge intelligence

**Summary**
- Valio Aimo, a Finnish foodservice wholesaler, wants a prototype of the *interface and operating model* that lets an external buyer's AI purchasing agent search its catalogue, get price and availability, and place an order, either autonomously within its authority or after human sign-off (CHALLENGES.md:L541-L560).
- The judging is 30% for a working end-to-end request → lookup → order/approval demo, 20% for guardrails and auditability, 20% for matching the buyer's request, 15% for exceptions and 15% for openness and a path to production (CHALLENGES.md:L659-L679). The prizes are €4,000, €2,000 and €1,000 (CHALLENGES.md:L681-L693).
- The sponsor provides real-looking synthetic data: 17,546 products with allergens, labels and nutrition, a live mock Price and Availability API, and delivery-reliability and carbon CSVs. **No order-placement or approval API exists**, so the team must design and build that layer (verified in the resource portal's OpenAPI spec, see §1).
- It needs no hardware and fits our TypeScript, agents and LLM strengths almost exactly. The differentiator is protocol and trust design (open standards, signed mandates, audit trail), not raw agent capability.

---

## 1. Database record

| Field | Value | Source |
|---|---|---|
| Challenge | Trusted Trade Agents | CHALLENGES.md:L535 |
| Sponsor | Valio Aimo® (part of Valio, the Finnish dairy and food company) | CHALLENGES.md:L539, L575-L588 |
| Track | Agentic AI Track (the track heading at CHALLENGES.md:L9 covers L9-L779) | CHALLENGES.md:L9, L780 |
| Original page | https://hackjunction.app/participate/45/challenges/327. A WebFetch returned only the title "Junction Platform", so the page needs a logged-in browser. | CHALLENGES.md:L537 |
| Main requirement | Enable (a) product, price and availability lookup, (b) a defined inquiry-to-order interaction at fixed prices and (c) permission and human-approval management for an external purchasing agent | CHALLENGES.md:L555-L559 |
| Judging and weights | Working end-to-end demo 30%, solving the problem and user need 20%, autonomy and controls 20%, robustness to exceptions 15%, openness and a credible path to production 15% | CHALLENGES.md:L659-L679 |
| Prize | 1st €4,000, 2nd €2,000, 3rd €1,000. No non-cash prize is stated. | CHALLENGES.md:L681-L693 |
| Provided data and APIs | Synthetic catalogue, simulated suppliers and mock APIs (prices, availability behaviour, lead times, certificates and labels, plus carbon ranges as a stretch goal) | CHALLENGES.md:L622-L623 |
| Resource portal | https://junction26.valioaimo.fi/, protected by an event password that is in CHALLENGES.md:L637 (not copied here) | CHALLENGES.md:L634-L639 |
| API auth | `X-API-Key` header on everything under `/api`. The key is in CHALLENGES.md:L643. I did not copy it here, because it would be a secret in a repo file. | CHALLENGES.md:L641-L645; portal home page |
| Webshop test accounts | "will be shared separately once available": **unknown** whether they have arrived | CHALLENGES.md:L647 |
| Hardware | None | CHALLENGES.md:L616-L626 (the scope is a data/API interface) |
| Mentors | Marketplace/Commercial: Hanna Forsström, Pirjo Kaartinen. Online Sales: Minni Ruhtinas. IT, integrations and data governance: Tommi Nurmi-Aro, Ville Takanen, Riku Tapper. | CHALLENGES.md:L628-L632 |
| Preferred tech | Agentic/tool-use frameworks, open data and interop standards, recommendation logic, optional verifiable credentials or a trust layer. x402 and Nevermined are "relevant context but not required". | CHALLENGES.md:L626 |
| Submission requirements (challenge-specific) | **Unknown.** The challenge text lists no deliverables beyond what the judging implies, which is a demo running "in the mocked environment" (CHALLENGES.md:L663). The general Junction submission happens on the Junction platform, where peer review and judging take place (stated in another challenge's text, CHALLENGES.md:L820). Required video, repo or deck: **unknown**. | |
| Jury guide | The jury and pitch PDF does not mention Valio Aimo (I searched the pdftotext output for "valio", "aimo" and "agentic" and found nothing). | docs/00-Jury-profiles-and-pitch-guide.pdf |

### What the resource portal actually contains
I logged in with the event password on 13 Nov 2026 and opened the portal home page, `/openapi.json` and the data files:

- **Mock APIs** (OpenAPI 0.1.0):
  - `GET /api/ping`.
  - `POST /api/price` and `POST /api/availability`, each taking `{customer, requestedDate, products[1..1000]}`.
  - Three download-redirect endpoints for the data files.
  - **There is no order, cart, approval or substitution endpoint.** Order placement and approval must be built by the team, on top of or beside the mock.
- **API behaviour notes from the spec:**
  - "Solutions should not be based on frequently retrieving prices and availabilities for **all** products… Query the APIs only when you have narrowed down the products… Undisclosed rate limits are in place." Narrow candidates from the static catalogue first.
  - The customer number does not affect responses in this challenge.
- **Availability response fields:**
  - `closingTime` is the order cut-off.
  - `salesBlock`.
  - `logisticModel` is `Stock` or `Terminal`. For Terminal products the quantity is unknown and always reported as 999999.
  - `scheduleLines[]` holds `availableAmount`, `availableDate` and `salesUnit`. `availableDate` may differ from the requested date, and an empty array means the product is undeliverable.
- **Price response fields:** `catalogPrice`, `listPrice`, `priceWithTax`, `comparisonPrice` per KG or L, `tax`, the validity window, `netPriceFound` and `error`.
- **Live test:** I made a live call (ping, availability and price for product 460000) and got real-looking answers: Stock, 48 RAS available for 2026-11-16, cut-off at 17:00 the day before, and €1.96 excluding VAT at 13.5% VAT.
- **Product data:**
  - A JSON file of about 87 MB with **17,546 products**. Names are in en, fi and sv, along with ingredients, nutrition and storage data.
  - The `classifications` field covers `allergen`, `nonAllergen`, `nutritionalClaim` (for example `FREE_FROM_LACTOSE`), `packagingMarkedLabel` (for example `EU_ORGANIC_FARMING` or `GOODS_FROM_FINLAND_BLUE_SWAN`), packaging, vitamins and minerals.
  - Each product also has units with pack sizes, `allowedLotSize`, temperature, vendor and origin.
  - **189 products carry a sponsor-defined `substitutions` list.**
  - The portal says data quality varies: GTIN products have rich data, while fruit and vegetables often lack it. The data "must not be used for anything outside of this challenge".
- **Delivery reliability CSV:** about 4,425 products, with a value between 0 and 1.
- **Carbon footprint CSV:** about 11,033 products, giving an average kg CO2-eq/kg for the product group.
- **Example request feasibility:** 78 products have both "lactose" and "milk" in their English name, so the example request can be grounded in real catalogue data.

## 2. What the sponsor is actually trying to encourage

**My reading (an inference):** Valio Aimo is not shopping for a chatbot. It wants a defensible, *open* blueprint for how a wholesaler exposes itself to third-party buying agents. The aim is to avoid being commoditised by a platform-owned agentic-commerce layer, while keeping control of data, trust and the customer relationship. It also wants a credible artefact that its IT and governance people could take into the planned B2B marketplace work.

Evidence:
- "becomes existential for data ownership, trust, and who owns the customer relationship" (CHALLENGES.md:L547).
- "built on **open, verifiable standards** rather than a single platform's black box" (CHALLENGES.md:L549).
- "This is not about replacing today's e-commerce UI with a chatbot… before that interface gets defined by someone else's platform" (CHALLENGES.md:L573).
- 15% of the score goes to openness and a credible path to production, including "clear visibility of assumptions… credible view of next development steps" (CHALLENGES.md:L677-L679).
- Half of the mentor bench covers IT integrations and data governance (CHALLENGES.md:L632).
- The "Problems we'd love to see tackled" list is about trust and governance rather than raw AI: a trust protocol, a guardrails model, response logic and an audit trail (CHALLENGES.md:L594-L600).
- A secondary goal is selling. The "Proactive selling agent" scenario has Valio Aimo's own agent pitching to buyer agents (CHALLENGES.md:L610).

Context: the open standards that now exist in this space, all checked at the URLs listed:
- **UCP (Universal Commerce Protocol)**, Apache-2.0. It provides Checkout, Identity Linking (OAuth 2.0), Order and Payment Token Exchange capabilities, and is transport-agnostic across REST, MCP and A2A. It supports AP2 mandates and verifiable credentials (https://github.com/universal-commerce-protocol/ucp).
- **AP2 (Agent Payments Protocol)**. It uses cryptographically signed mandates that are Verifiable Digital Credentials, each with an "open" stage (constraints and budget) and a "closed" stage (a specific finalised checkout). The mandates are chained into an audit trail, and the protocol has human-present and autonomous flows (https://ap2-protocol.org/; repo https://github.com/google-agentic-commerce/AP2, Apache-2.0).
- **x402**. An HTTP 402 payment standard that the sponsor names as optional context (https://www.x402.org/).
- **Estimate:** AP2's open-mandate (constraints) → closed-mandate (approved cart) model maps almost one-to-one onto the challenge's "what the agent may decide alone vs. what goes to a human" requirement. Using it, or a documented subset of it, would score directly on "Openness".

Past Junction winners for Valio Aimo: the text references "last year's Zero-Fail Logistics challenge" (CHALLENGES.md:L564), but a web search found no record of its winners, so they are **unknown**.

## 3. Explicit requirements (quoted)

Core (CHALLENGES.md:L555-L559), "your solution must enable":
> - **Product, price & availability lookup:** a structured way for an external agent to search for and retrieve what's available and at what price.
> - **Requesting price & availability, then placing an order:** a defined interaction for moving from inquiry to commitment, based on fixed prices rather than a negotiated quote.
> - **Permission & human-approval management:** what the agent may decide on its own, and what must go to a human for sign-off.

Optional, "not required to win" (CHALLENGES.md:L561-L565):
> - **Delivery time & sustainability comparison:** not just price, but delivery reliability and the certificates/sustainability labels already shown in the webshop. *(Category-level carbon-footprint ranges are a stretch goal.)*
> - **Substitution and other exception handling:** what happens when the exact request can't be met. *(Last year's Zero-Fail Logistics challenge covered failed deliveries in depth, so this isn't scored as core.)*
> - **Traceability and explainability:** a human-readable record of what the agent did and why.

Note that exceptions are "not core", but "Robustness to exception situations" is still worth 15% of the score, and "Autonomy and controls" (20%) explicitly includes "how decisions are logged and auditable" (CHALLENGES.md:L669-L675). In practice, substitution and the audit trail are therefore scored.

Example request (CHALLENGES.md:L569-L571):
> *"I need 1,000 litres of lactose-free milk by Monday. Find an option that meets our requirements based on price and availability."* … Your solution returns products, prices and availability in structured form; the agent places the order within its authority or sends it to a human for approval.

Scope note (CHALLENGES.md:L616):
> we are mocking a structured data/API interface. Whether Valio Aimo's production interface eventually becomes a traditional API, an MCP-style agentic interface or a full service agent of its own is outside the scope of this challenge.

Judging (CHALLENGES.md:L661-L679):
> Working end-to-end demo (30%): The solution runs through a full request → lookup → order/approval flow in the mocked environment, not just isolated pieces.
> Solving the problem and user need (20%): how Precisely the agent matches what the buyer actually asked for, with the least manual correction needed.
> Autonomy and controls (20%): Quality of the guardrails design. What the agent can decide alone, what needs human sign-off, and how decisions are logged and auditable.
> Robustness to exception situations (15%): Handling of partial availability, substitutions and delivery constraints beyond the happy path.
> Openness and credible path toward production (15%): Open, documented standards rather than a proprietary format, clear visibility of assumptions, well-justified technical choices, and a credible view of next development steps

## 4. What a mediocre submission looks like (estimate)

- A chat UI with an LLM that calls `/api/price` and `/api/availability` as tools and prints a table. The sponsor explicitly says this is not the goal (CHALLENGES.md:L573).
- "Ordering" is a button that writes to local state. There is no defined order or commitment protocol, no idempotency, no price-validity or cut-off check, and the approval step is a hard-coded `if total > X`.
- Search is vector search on product names only. It ignores units and pack sizes, so it gets "1,000 litres" wrong: it confuses packs with litres, ignores `allowedLotSize`, and treats Terminal 999999 as real stock.
- It hammers the price API for many products, despite the warning about rate limits and narrowing first.
- Its own JSON format is undocumented, with no OpenAPI or MCP schema and no reference to UCP, AP2 or verifiable credentials, which scores near zero on Openness.
- The demo shows only the happy path, with no partial availability, sales block, late `availableDate` or substitution.
- The audit log is raw LLM transcripts.

## 5. What an exceptional submission would demonstrate (estimate)

1. **Two agents, one open interface.** Valio Aimo exposes a seller-side interface: an OpenAPI 3.1 spec, an MCP server and a UCP-style capability profile (for example at `/.well-known/...`) wrapping the mock APIs. A *separate*, unmodified buyer agent (for example a hotel chain's agent, possibly another vendor's LLM) discovers and uses that interface. This proves the interface is the product, not the agent.
2. **The full flow live, in under a minute:** a natural-language need (the lactose-free milk example) becomes structured intent, then catalogue narrowing from static data (the `FREE_FROM_LACTOSE` claim, comparison unit L, pack-size maths to reach 1,000 L in valid lot sizes), then targeted price and availability calls, then a ranked offer, then an order. The order is either auto-committed within policy or routed to a human approver, whose approval resumes the flow. This covers the 30% and 20% criteria directly.
3. **Machine-readable guardrails.** A policy document per buyer organisation sets spend thresholds, a category allow-list, allergen hard constraints, substitution tolerance and delivery-date slack. It is expressed as signed open and closed mandates in the style of AP2 (W3C VC-style JSON). The policy is shown changing behaviour live: under €X the order goes through, over it an approval is requested.
4. **Trust protocol.**
   - Offers come back as signed, time-boxed quotes. The quote is bound to the price `validFrom`/`validTo` and to the availability `timeNow`/`closingTime`.
   - The buyer agent verifies the signature, and the order references the quote hash.
   - Provenance fields (GTIN, origin, labels) let the agent trust stock, price and origin claims "without a manual check" (CHALLENGES.md:L594).
5. **Exceptions handled from real data:**
   - Partial availability is split across products or dates.
   - `availableDate` later than requested.
   - `salesBlock`.
   - Terminal products, where stock is unknown, are weighted by the delivery-reliability CSV.
   - Substitutions use the sponsor's own `substitutions` list first, then a good-better-best ranking within the assortment that respects allergens and nutrition. This covers CHALLENGES.md:L598 and L612.
6. **Audit trail for both parties.** An append-only, hash-chained log of intent → candidates → quote → policy decision → approval → order, with a one-paragraph human-readable "why" for each step. Buyer and Valio Aimo views of the same log.
7. **Openness write-up.** The README or pitch lists the standards used, the assumptions (prices are customer-agnostic in the mock, no real payment) and a three-step path to production. Optional extras: carbon and label comparison, standing-order drift detection (CHALLENGES.md:L614) and a Valio-side proactive selling agent (CHALLENGES.md:L610).

Fit with our team (estimate): this is full-stack TypeScript plus agent orchestration plus light data work, which is our strongest area. The 17.5k-product JSON is easy to index. The risk is that many teams in the Agentic track will build "an agent that orders". We would differentiate through protocol and trust design and a crisp two-agent demo.

## 6. Constraints that could disqualify a project or sink its score

- **Healthcare scope:** the allergen-safe "hospital kitchen" scenario (CHALLENGES.md:L612) is just an example. Our healthcare exclusion is a team choice, not a sponsor rule, so a school-kitchen framing avoids it entirely.
- **Data use restriction:** the portal states the product data "must not be used for anything outside of this challenge". Do not reuse it in other challenge submissions or publish it beyond the event. Whether a public repo containing the dataset is allowed is **unknown**, so keep the data files out of git (and they are 87 MB anyway).
- **Secrets:** the API key and portal password appear in CHALLENGES.md (L637, L643). Keep them in env vars, not in code (CLAUDE.md "Read secrets from env only").
- **Rate limits:** there are undisclosed API rate limits, and the spec warns against bulk retrieval. A demo that gets throttled live would fail the 30% criterion. Cache responses and narrow the candidate set first.
- **Scope traps:**
  - Building "a whole marketplace" is explicitly out of scope (CHALLENGES.md:L549, L553).
  - Negotiated quotes are out of scope, because the challenge specifies fixed prices (CHALLENGES.md:L557).
  - The production transport choice is out of scope (CHALLENGES.md:L616).
  - Spending time on these earns no credit.
- **Real systems:** everything must run against the synthetic mock (CHALLENGES.md:L623, L649). Do not try to scrape or integrate the real valioaimo.fi webshop.
- **Formal disqualification rules** specific to this challenge: **unknown**. None are stated in CHALLENGES.md:L535-L693.
- **Eligibility to combine with tech challenges:** this text says nothing, so it is **unknown** here. Several "Best Use of X" challenges state they are open to any team (for example CHALLENGES.md:L2699).

## 7. Physical hardware work

**None.** The challenge is entirely a software, data and API interface problem: "we are mocking a structured data/API interface" (CHALLENGES.md:L616). All resources are synthetic datasets and HTTP mock APIs (CHALLENGES.md:L622-L623, L639). No device, sensor or kit is mentioned, and none is needed.

<!-- complete -->
