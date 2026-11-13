# Decode the Noise (Hostinger) — challenge intelligence

**Summary**
- Hostinger asks for an AI tool that detects propaganda, bots or bad actors online (text, social content or web-traffic logs), and it **must be deployed live on Hostinger infrastructure with a public URL** by the end of the event (CHALLENGES.md:L19, L27-29).
- Judging is weighted toward **detection quality: accuracy, false-positive handling and explainability (40%)**. Then come technical execution and live Hostinger deployment (25%), originality and impact (20%), and demo clarity (15%) (CHALLENGES.md:L76-79). The brief says outright that it cares about measured precision and false-positive rate more than a polished front end (CHALLENGES.md:L29, L43).
- Prizes are 2000 / 1000 / 500 EUR, plus one year of hosting and a domain, swag and a social media spotlight for all three winners (CHALLENGES.md:L83-97). Each team gets a free KVM 2 VPS and AI Router credits (CHALLENGES.md:L49-52).
- No physical hardware is involved. The work is ML and evaluation plus web deployment, which fits our team well. The main risks are getting labelled evaluation data and a deployment that is not on Hostinger.

---

## 1. Database record

| Field | Value | Source |
|---|---|---|
| Challenge | Decode the Noise | CHALLENGES.md:L11 |
| Sponsor | Hostinger | CHALLENGES.md:L15 |
| Track | Agentic AI Track | CHALLENGES.md:L9 |
| Main requirement | "Build an AI-powered tool that detects propaganda, bots and bad actors online – and deploy it live on Hostinger's infrastructure." | CHALLENGES.md:L19 |
| Judging emphasis and weights | Detection quality (accuracy, false-positive handling, explainability) 40%. Technical execution and live deployment on Hostinger 25%. Originality and real-world impact 20%. Demo clarity 15%. | CHALLENGES.md:L76-79 |
| Prize | 1st 2000 €, 2nd 1000 €, 3rd 500 €. All three winners also get one year of Hostinger hosting and a domain, Hostinger swag and a spotlight on Hostinger's social media. | CHALLENGES.md:L83-97 |
| Non-cash upside | "Teams that build something promising will have a path to continue the conversation with our engineering team after the event." | CHALLENGES.md:L66 |
| Provided compute | Hostinger VPS KVM 2 per team: 2 vCPU, 8 GB RAM, 100 GB NVMe, 8 TB bandwidth, root, Docker, free domain, one-click Ollama/n8n/Node.js/Python templates. Free for 1 month. | CHALLENGES.md:L49-51 |
| Provided models | Hostinger AI Router credits: one key and one shared balance for "150+ leading models", compatible with the OpenAI and Anthropic SDKs. The size of the credit balance is unknown. | CHALLENGES.md:L52 |
| Provided front-end tool | Hostinger AI Builder 1-month plan | CHALLENGES.md:L53 |
| Provided deploy tooling | Hostinger Connector, API, CLI and open-source MCP server | CHALLENGES.md:L54-57 |
| Provided data | **unknown**. The challenge text names no dataset. | CHALLENGES.md:L45-58 (none listed) |
| Provided hardware | None | CHALLENGES.md:L45-58 |
| Mentors | Minijus Savickas (VPS Product) and Emilis Strimaitis (Innovations, AI agents) at the booth, plus a help channel | CHALLENGES.md:L58, L62 |
| Submission requirements | A deployed, running product on Hostinger infrastructure "by the end of the hackathon, with a public URL the judges can open". Other submission format details (video, repo, Devpost-style form) are **unknown** from the challenge text. | CHALLENGES.md:L29 |
| Language/model restrictions | "Use any language, framework or model – open-source or hosted – as long as the final product runs on Hostinger." | CHALLENGES.md:L49 |
| Team size / eligibility | unknown from the challenge text | none |

### Notes on the provided resources (web)

- **AI Router.** Third-party LiteLLM docs give the base URL `https://router.hostinger.com/v1` and an API key created in hPanel. They show chat/completions, responses, messages and embeddings endpoints, with example models `claude-sonnet-5`, `gpt-5.2` and `text-embedding-3-small/large` ([LiteLLM docs](https://docs.litellm.ai/docs/providers/hostinger_router)). A web search summary said Hostinger's own marketing pages claim "20+" models, while the challenge says "150+" (CHALLENGES.md:L52). I did not open the marketing page, so the exact count is unverified. Confirm in hPanel.
- **MCP server.** Install it with `npm install -g @hostinger/mcp` (requires Node 24 or later) or use the hosted server at `https://mcp.hostinger.com` (OAuth). Auth is the `HOSTINGER_API_TOKEN` env var. There are scoped binaries for VPS (68 operations), DNS, domains and hosting deploy (`hosting_deploy`) ([README](https://raw.githubusercontent.com/hostinger/api-mcp-server/main/README.md)).
- **Connector.** This is an editor extension (VS Code or Cursor) that lets AI assistants manage websites, domains, DNS and VPS over MCP. Auth is OAuth or an API token ([docs.hostinger.com/hostinger-connector](https://docs.hostinger.com/hostinger-connector)).
- The original challenge page (https://hackjunction.app/participate/45/challenges/357) rendered only its title through fetch, so the transcription in CHALLENGES.md is the only source for the challenge text.

## 2. What the sponsor is actually trying to encourage

**Reading (inference):** Hostinger mainly wants proof that serious, working AI products can be **built and run on its VPS and AI Router**. That gives it showcase projects and social content for its "vibe coding → shipping" story. The detection theme is the vehicle, and it plays to a hosting company's real exposure to bots, scrapers and abuse. A secondary goal is to find teams or ideas worth continuing, which could become product features such as bot or traffic insights for site owners.

**Evidence:**
- Deployment on Hostinger is mandatory, is worth 25% on its own, and is framed as "a realistic requirement, not a stretch goal" (CHALLENGES.md:L29, L49, L78).
- Hostinger supplies its whole product stack: VPS, AI Router, AI Builder, Connector and MCP (CHALLENGES.md:L51-57). Its talk is about "shipping, securing and running your code in the real world" (CHALLENGES.md:L66).
- "At Hostinger we host millions of websites, so we see this noise up close" (CHALLENGES.md:L23). The "Clean the traffic" direction speaks directly to "site owners" (CHALLENGES.md:L39), which matches their customer base (inference).
- There is a "path to continue the conversation with our engineering team" (CHALLENGES.md:L66), plus the social spotlight (CHALLENGES.md:L85).
- Their engineering values are stated plainly: "strength and honesty of your detection logic – including how you handle false positives" and "show your precision and false-positive rate, not just a demo that works on the happy path" (CHALLENGES.md:L29, L43).

## 3. Explicit requirements (quoted)

- "Build an AI-powered tool that detects propaganda, bots and bad actors online – and deploy it live on Hostinger's infrastructure." (CHALLENGES.md:L19)
- "Build a tool that analyses text, social content or web-traffic patterns to detect signs of coordinated propaganda, bot-driven amplification or bad-actor behaviour online." (CHALLENGES.md:L27)
- "Whatever you build, it **must be deployed and running live on Hostinger's infrastructure** by the end of the hackathon, with a public URL the judges can open." (CHALLENGES.md:L29)
- "Use any language, framework or model – open-source or hosted – as long as the final product runs on Hostinger." (CHALLENGES.md:L49)
- Soft expectation, not a hard rule: "We're especially interested in approaches that are **transparent and measurable** – show your precision and false-positive rate" (CHALLENGES.md:L43).
- The four directions ("Spot the swarm", "Name the technique", "Clean the traffic", "Trust the source") are suggestions: "pick one, or combine them" (CHALLENGES.md:L33-41).

## 4. What a mediocre submission looks like (estimate)

- A text box that sends input to an LLM with a prompt like "is this propaganda?" and returns a label with a paragraph of explanation. It has no evaluation set, no precision or false-positive figures, and it is demoed on two obvious examples.
- A polished AI Builder front end over shallow logic. The brief says it values logic over polish (CHALLENGES.md:L29).
- Deployed on Vercel, Railway or similar with Hostinger used only for DNS, or not reachable at judging time. This loses most of the 25% and may fail the "must" (CHALLENGES.md:L29).
- Single-post bot classification when the brief explicitly asks for coordination signals "rather than from any single post" (CHALLENGES.md:L35).
- Expect many teams to build an LLM propaganda-technique classifier, because it is the easiest direction (estimate).

## 5. What an exceptional submission would demonstrate (estimate)

- **A measured detector.** A labelled evaluation set, either public or constructed with clearly stated provenance, with precision, recall and false-positive rate reported. It also shows **a baseline compared with our method** (for example, a plain LLM prompt compared with our pipeline), a threshold or operating-point choice, and failure cases shown honestly. This hits the 40% bucket directly.
- **False-positive handling as a feature.** That means calibrated confidence, an "uncertain / needs human review" band, abstention, and a live page that shows real errors.
- **Explainability a layperson can follow.** That means evidence-linked verdicts: the clustered accounts, the reused text spans, the timing histogram, the log lines that triggered a rule. "Why", not just "that" (CHALLENGES.md:L37).
- **Truly live on the Hostinger VPS.** That means Docker on KVM 2, the free domain, the AI Router for model calls and possibly Ollama for a local model, deployed via the Hostinger MCP/Connector. A strong demo point (inference): run "Clean the traffic" on **the team's own VPS's real access logs** during the event, since a public URL attracts real scanners. That gives live, non-synthetic data and an "it's protecting itself right now" moment.
- **Coordination over content.** Graph or temporal signals for swarms (text-reuse clustering with embeddings, synchronised posting) are rarer and more defensible than single-text LLM classification.
- **Credible continuation.** For example, a monitoring service for Hostinger site owners (CHALLENGES.md:L27, L39), which lines up with the jury guide's "plausible continuation" and "defensible insight with a baseline" ingredients (Jury PDF p.1).

**Data options (for the build team; verify licences):**
- Propaganda Techniques Corpus (SemEval-2020 Task 11): about 550 news articles, 18 techniques. Registration is required and use is "academic purposes" only ([propaganda.math.unipd.it/ptc](https://propaganda.math.unipd.it/ptc/)). Whether a hackathon counts as academic use is unknown, so ask organisers or mentors.
- TwiBot-22: the bot-detection benchmark is obtained by emailing the authors from an institutional address, so it is **unlikely to arrive within 40 hours** ([GitHub](https://github.com/LuoUndergradXJTU/TwiBot-22)) (estimate).
- Web logs: the team's own VPS logs, plus synthetic attack traffic we generate (credential stuffing, scrapers) against our own server, could serve as labelled ground truth. This is an estimate and needs no third-party access.

## 6. Constraints that could disqualify or sink a project

- **Not deployed or not running live on Hostinger, or no public URL by the end of the hackathon** (CHALLENGES.md:L29). This is the one hard "must". Mitigation (estimate): deploy on day 1, keep the server up through judging, and watch the credit and disk limits.
- **Hosting core logic elsewhere.** Models may be hosted externally ("open-source or hosted"), but "the final product runs on Hostinger" (CHALLENGES.md:L49). Calling an external LLM API from the Hostinger server is probably fine. Running the app itself on another platform is not (inference).
- **AI Router credit exhaustion.** It is a "shared credit balance" of unknown size (CHALLENGES.md:L52). Batch evaluation runs could drain it. Budget for this or use Ollama on the VPS, keeping in mind that 2 vCPU and 8 GB RAM only fits small models (estimate).
- **Data terms and ethics (inference, not a stated rule).** Scraping social platforms may breach their terms, and so may using academic-only datasets. Publicly labelling real named people or accounts as "bots" or "propagandists" in a live public demo carries defamation and false-accusation risk, which is exactly the false-positive concern the sponsor raises. Prefer public datasets, our own logs or anonymised demos.
- **General Junction rules** (team size, IP, code-originality, submission deadlines): unknown from this file. Check the event rules page.

## 7. Physical hardware work

**None.** There is no device, sensor or kit. All work is software: data and evaluation, an ML/LLM pipeline, a web UI and API, and Docker deployment on a remote VPS (CHALLENGES.md:L27, L51). "Hardware" here means a managed cloud VM with root access, which our full-stack and ML skills cover. Physical hardware dependence: none.

<!-- complete -->
