# Decode the Noise (Hostinger): opportunity discovery (Agent C)

Research date 2026-11-13. Challenge text: CHALLENGES.md:L11-100. Builds on Agent A (`01-challenge-intelligence/decode-the-noise.md`), Agent B (`competitive.md`) and Agent D (`feasibility.md`) in this folder.

## Summary
- The biggest gaps are in **behaviour, not content**. Two kinds of traffic now break the usual detectors. LLM-written swarms vary their wording, so copy-paste coordination detectors miss them. AI browser agents send a stock Chrome user agent, so user-agent dashboards (including Hostinger's own AI Audit) cannot see them. Both gaps are recent, poorly served, and testable in 40 hours with traffic we generate ourselves.
- The sponsor's most **underused capability** is the Hostinger VPS API and MCP: firewall create, atomic rule replacement and sync, Docker logs, VM metrics, Monarx malware-scan metrics and an "agent readiness" scanner. A detector can close the loop by detecting, explaining and then *enforcing* through Hostinger's own firewall. That turns "deployed on Hostinger" from a checkbox into the product.
- The best demo pattern is the same in every area: a **live before/after** (naive baseline vs our detector on the same stream), an **abstain band**, and a **public "try to fool it" page** that updates precision and false-positive numbers in front of judges. This matches the sponsor's 40% detection-quality weight (CHALLENGES.md:L43, L76).
- Honest stacks: Codex and Tiger Data (low effort), Aiven, Gemma (as an on-VPS fallback explainer) and Oxylabs (only for the provenance direction). Avoid Vultr and Modal for serving, because the product must run on Hostinger (CHALLENGES.md:L49).
- Estimates: differentiation **7/10**, demo **7/10**, overall-jury fit **6/10**.

---

## What the sponsor actually offers (capability inventory)

| Capability | What it enables | Source |
|---|---|---|
| KVM 2 VPS: 2 vCPU, 8 GB, root, Docker, free domain, Ollama/n8n templates | Our own real web endpoint that attracts real scanner traffic | CHALLENGES.md:L51 |
| AI Router: one key, 150+ models, OpenAI/Anthropic-SDK compatible, shared balance | Explanations and red-team traffic generation; also embeddings (`/embeddings`, per feasibility.md) | CHALLENGES.md:L52; [LiteLLM docs](https://docs.litellm.ai/docs/providers/hostinger_router) (via feasibility.md) |
| **VPS firewall API**: `vps_firewall_create`, `vps_firewall_create-rule`, `vps_firewall_replace-all-rules-in-group` ("in a single atomic operation"), `vps_firewall_sync-to-all-assigned-v-ms`, activate/deactivate. The firewall "drops all incoming traffic" by default | Detector pushes block rules to Hostinger's network firewall, not just to nginx. Atomic replace means a rollback is one call | [hostinger/api-mcp-server README](https://raw.githubusercontent.com/hostinger/api-mcp-server/main/README.md) (opened, firewall section) |
| `vps_docker_logs`, `vps_docker_list/create/restart` | Ingest container logs through the official API; redeploy the stack | same README |
| `vps_virtual-machines_metrics` (CPU, memory, disk, network, uptime) | Correlate bot bursts with resource cost ("this scraper cost you X% CPU") | same README |
| `vps_monarx_scan-metrics` ("number of scans, detected threats") | A second, independent signal of compromise on the host | same README |
| `agent-readiness_scans_run` ("how ready a public website is for AI agents to discover, read and act on") | Evidence that Hostinger is investing in the *good-agent* web, see area 2 | same README |
| Hostinger AI Audit (CDN): shows and blocks AI crawlers, based on logs of 5M sites. The page does not say how crawlers are identified or whether user-initiated agents are separated | Defines what not to rebuild, and shows where the product stops | [hostinger.com/blog/cdn-ai-audit](https://www.hostinger.com/blog/cdn-ai-audit/) (opened) |
| Rate limits, API token scopes, whether the hackathon account has API access | **unknown**; ask at the booth | n/a |

None of the competitive research (competitive.md) found a hackathon or open-source tool that uses the Hostinger firewall API as an enforcement target. That is an inference from absence, not proof.

---

## Opportunity areas

### 1. Closed-loop site defence: detect, explain, then enforce through Hostinger's firewall ("Clean the traffic")
- **Gap.** Existing tools split into two halves. Log-based detectors (CrowdSec, fail2ban) enforce locally with little explanation. Dashboards (Hostinger AI Audit, Cloudflare) explain at the CDN, keyed mostly on crawler identity (competitive.md §2-3). A small site owner on a VPS gets neither a *measured* verdict nor a reversible, explainable block at the provider's own firewall. Blocking also carries a false-positive risk that most tools hide, such as a venue NAT flagged as a swarm (feasibility.md §6.5).
- **Evidence.** The firewall API supports atomic rule-group replacement and sync ([MCP README](https://raw.githubusercontent.com/hostinger/api-mcp-server/main/README.md)). CrowdSec only added bot detection in 1.8.0 ([helpnetsecurity](https://helpnetsecurity.com/2026/09/01/crowdsec-1-8-0-bot-detection/), via competitive.md). The brief explicitly asks for "a monitoring service for site owners" and "a clear, actionable view" (CHALLENGES.md:L27, L39).
- **New combination.** Calibrated behavioural classifier + abstain band + LLM explanation citing log lines + **Hostinger firewall API as the actuator**. Only verdicts above the high-precision threshold become rules, and each rule has a TTL, a one-click undo and its evidence attached. The policy is "never block what you cannot explain".
- **Before/after demo.** A scripted credential-stuffing burst hits the login page and succeeds against the naive setup. With the loop on, it is flagged and explained, the rule appears in hPanel's firewall, and the next request is dropped at the network edge. A judge on venue Wi-Fi lands in "uncertain", not "blocked".
- **Why Hostinger cares.** It hosts "millions of websites" and sees the noise (CHALLENGES.md:L23). This is their own customers' problem, solved on their own infrastructure and API (inference). It also dogfoods the MCP/API they list as a resource (CHALLENGES.md:L54-57).
- **Overall jury.** The named user is clear (small VPS owner), the end-to-end loop is legible, and enforcement is real. Risk: "bot blocker" sounds familiar on the peer floor. The distinctive insight has to be the measured FP policy, not the blocking itself (estimate).
- **Data/eval.** Zenodo CC BY 4.0 web-robot logs with UA-derived labels (feasibility.md §3, so exclude UA features) plus our own labelled attack and human traffic.

### 2. Three-way traffic triage: humans vs legitimate AI agents vs abusive bots (agentic-era traffic)
- **Gap.** The bot/human binary is outdated. AI browser agents (Comet, ChatGPT's agent browsing) reportedly send a **standard Chrome user agent** and produce no mouse or scroll events, so UA checks and analytics cannot tell them apart from bounced humans. Vendor detection is "still emerging" (search summaries of [HUMAN Security](https://www.humansecurity.com/learn/blog/state-of-agentic-traffic-june-2026-browser-agent-tooling-for-developers-is-catching-on-fast/), [Digiday](https://digiday.com/media/when-bots-look-like-buyers-agentic-traffic-causing-new-publisher-headaches), [CJR](https://cjr.org/analysis/how-ai-browsers-sneak-past-blockers-and-paywalls.php); not opened, treat as unverified). On the other side, **Web Bot Auth** (RFC 9421 HTTP Message Signatures for bots, keys at `/.well-known/http-message-signatures-directory`) is an IETF draft ([datatracker](https://datatracker.ietf.org/doc/html/draft-ietf-webbotauth-httpsig-protocol), search result) with edge verification at Cloudflare ([Cloudflare docs](https://developers.cloudflare.com/bots/reference/bot-verification/web-bot-auth/index.md), search result). Small-host origin servers have almost no tooling for it (inference).
- **Why now.** Signed agents and Chrome-identical agent browsers both arrived in 2025-26. A rule list cannot cover them. A behavioural model plus signature verification plus an LLM summary of *intent* ("this session read pricing pages in 4 s each and never loaded fonts") was impractical before.
- **Before/after demo.** The same three visitors hit our site: a teammate, an AI browser agent doing a task, and a scraper spoofing Chrome. The UA-based view (AI Audit style) shows three "Chrome" humans. Our view separates them, verifies a signed agent if one is available, and lets the owner choose a policy per class (allow agents to buy, block scrapers).
- **Why Hostinger cares.** Hostinger ships an `agent-readiness` scanner in its API ([MCP README](https://raw.githubusercontent.com/hostinger/api-mcp-server/main/README.md)) and an AI-crawler audit ([blog](https://www.hostinger.com/blog/cdn-ai-audit/)). It clearly wants its customers to welcome good agents and repel bad ones (inference). The challenge sits in the Agentic AI Track (CHALLENGES.md:L9).
- **Overall jury.** This area has the most "new insight" for the jury: it is a 2026 problem, it is easy to explain ("your analytics think AI agents are people"), and it has a named user. Risk: ground truth is thin. Labels would come from agents we drive ourselves, and whether real signed-agent traffic will appear on our VPS is **unknown**.
- **Data/eval.** Self-generated sessions from Playwright scrapers, agent-driven browsers (via LLM through the AI Router, or Claude/Codex computer-use) and humans. Report per-class precision and recall, and confusion between "agent" and "human" specifically.

### 3. Paraphrase-robust swarm detection ("Spot the swarm" for LLM-written campaigns)
- **Gap.** Classic coordination detectors (CooRnet, CooRTweet; competitive.md §2) key on identical links or text. LLM swarms rewrite each post. Alethea's "PromptPasta" report found 400+ X accounts whose prompt-generated wording varied, so the network was caught through *behaviour* (batch creation, reused images, identical replies) ([Alethea PDF](https://alethea.com/hubfs/PromptPasta%20-%20Stirring%20the%20Pot%20of%20Political%20Discourse.pdf), search summary). A *Science* paper (Jan 2026) warns that "malicious AI swarms" can "fabricate consensus" by "adaptively mimicking human social dynamics" ([arXiv 2506.06299](https://arxiv.org/abs/2506.06299), opened). The search found **no head-to-head benchmark** of paraphrase-resistant CIB detection (search, unverified absence).
- **New combination.** Semantic embeddings (AI Router `/embeddings`) for "same message, different words", combined with timing synchrony and account-feature similarity in a graph, with clusters explained in plain language. Self-play red-teaming: an LLM generates a paraphrased swarm hidden inside organic posts at controlled difficulty. This creates labelled ground truth in hours, which was impractical before LLMs (estimate).
- **Before/after demo.** Inject a 30-account paraphrased campaign into a stream. An exact-text-reuse baseline finds 0-2 accounts. Our detector finds the cluster, plots it, and explains it ("these 23 accounts posted the same claim in 11 phrasings within 6 minutes"). A recall-vs-paraphrase-strength curve is the headline chart (estimate).
- **Why Hostinger cares.** This is the brief's first-listed direction (CHALLENGES.md:L35) and the most "propaganda"-flavoured one, which may suit judges who expect the social angle (feasibility.md §6.6, unknown).
- **Overall jury.** It has a strong societal stake, a memorable cluster visualisation, and an honest synthetic-data caveat. Weaknesses: the user is vaguer (trust and safety teams, researchers), and real social data has ToS and licence issues (feasibility.md §2, §6.7). Evaluation on synthetic swarms can look circular unless the generator and detector are clearly separated and a held-out real dataset exists (**unknown** whether one is obtainable in time).

### 4. Falsifiable detection: a live adversarial eval as the product surface (cross-cutting)
- **Gap.** Hackathon detectors almost never expose their error rates. Agent B lists "LLM yes/no with no eval" as the most common entry (competitive.md §4-5). An NYU study found GPT-4 and Claude 3 Opus below a RoBERTa-CRF baseline on propaganda techniques ([NYU](https://engineering.nyu.edu/news/large-language-models-fall-short-detecting-propaganda), via competitive.md). So a measured comparison is itself news.
- **Angle.** A public "try to fool it" page on the Hostinger URL. Judges and peers submit an attack (a spoofed bot session, a paraphrased post, a propaganda snippet) or flag a false positive. The page shows the live confusion matrix, the FP gallery, the abstain rate and the baseline comparison as they change. It can attach to area 1, 2 or 3.
- **Why Hostinger cares.** It answers their stated ask word for word: "show your precision and false-positive rate, not just a demo that works on the happy path" (CHALLENGES.md:L43; also L29).
- **Overall jury.** It maps directly onto the rubric line "honest measured evidence (baseline, failure cases, a metric that cannot be gamed)" (00-rules-and-jury.md). On the peer floor it is interactive: a visitor tries to beat it within 60 seconds (estimate). Risk: hostile inputs on a public form need rate limits and moderation. Every LLM call costs shared credits, so verdicts must stay on a non-LLM path (feasibility.md §6.2).

### 5. Provenance of hosted pages: cloned sites and content farms ("Trust the source")
- **Gap.** Domain age and WHOIS checkers are common (competitive.md §4). What is missing is *link-network and clone* provenance, for example "this news site is a near-copy of 40 others built from one template, all registered the same week, all citing each other". AI-text detectors have known FP problems (feasibility.md §2), so provenance should lean on structural signals, not "is this AI-written".
- **Why Hostinger cares (inference).** A host is partly responsible for abuse on its platform, such as phishing clones and spam farms. Whether Hostinger wants this framed around its own customers is **unknown**, and it could be sensitive. Ask at the booth before choosing it.
- **Overall jury.** It is relatable ("who is really behind this page?"). Ground truth is hard, and accusing real named sites publicly is an ethics and legal risk (Agent A disqualifier list). This is the weakest of the five for a measured 40-hour eval (estimate). It is the only area where Oxylabs and Context.dev stack naturally.

### Ranking (estimate)
| Area | Sponsor fit | Differentiation | Demo before/after | Eval feasibility in 40 h | Overall-jury legibility |
|---|---|---|---|---|---|
| 1 Closed-loop firewall | high | medium | high | high | medium |
| 2 Human / agent / bot triage | high | **high** | high | medium | **high** |
| 3 Paraphrase-robust swarms | high | high | high | medium (synthetic) | medium |
| 4 Live adversarial eval | **high** (L43) | medium alone, high as a layer | high | high | high |
| 5 Provenance / clones | medium | medium | medium | low | medium |

The strongest combination is likely **2 + 1 + 4**: three-way traffic triage, enforced through the Hostinger firewall API, shown through a live falsifiable eval page (estimate). The later idea-generation stage should test this.

---

## Stackable tech challenges (honest fit)
Requirements are taken from `01-challenge-intelligence/_tech-challenges.md`.

| Tech challenge | Fit here | Note |
|---|---|---|
| Best Use of Codex | Honest, low effort | Development-workflow use only; does not affect the product |
| Best Use of Tiger Data | **Natural** | Access logs and sessions are time-series; it would have to run alongside (or replace) local storage. Whether a managed Tiger Cloud DB breaks "runs on Hostinger" is **unknown**, so self-hosting TimescaleDB on the VPS may be needed |
| Best Use of Aiven | Plausible | Managed Kafka/ClickHouse/Postgres for the log stream; same "runs on Hostinger" caveat (estimate) |
| Best Use of Gemma | Plausible | Small Gemma on the VPS via the Ollama template as a fallback explainer when the AI Router balance runs out (feasibility.md §4 notes CPU-only speed limits) |
| Best Use of Gemini API | Possible | Only if Gemini does a meaningful step (e.g. via AI Router, if offered there: **unknown**) |
| Best agentic usecase of Oxylabs | Only area 5 (or 3 for public posts) | Requires live /search or /scrape at runtime with sources shown |
| Best Use of Context.dev | Only area 5 | Company/brand data for provenance |
| Best Use of MongoDB Atlas | Weak | Possible but adds nothing over the log store |
| Verda / Modal | Training only, risky | Serving elsewhere conflicts with CHALLENGES.md:L49; use only for offline training, if at all |
| Vultr | **Avoid** | Hosting on Vultr contradicts "runs on Hostinger" (CHALLENGES.md:L49) |
| CRACI, Entire | Possible | Development-workflow stacks, unrelated to detection |

---

## Estimates (with reasons)
- **Differentiation potential: 7/10.** The field is crowded with LLM text classifiers (competitive.md). Areas 2 and 3 address problems that appeared in 2025-26 and that existing tools, including the sponsor's own AI Audit, do not visibly cover. Using the Hostinger firewall API as an actuator is something we found no precedent for. The score is capped because "bot detection" sounds familiar and other strong teams may also pick behaviour-based approaches.
- **Demo potential: 7/10.** Every area has a visible before/after on a live public URL that judges can attack themselves. The score is capped because live traffic may be quiet (feasibility.md §6.4) and the visuals are dashboards, not physical wow.
- **Overall-jury fit: 6/10.** The challenge rewards exactly what the grand-jury rubric weights: baseline, failure cases and a metric that cannot be gamed (00-rules-and-jury.md), plus a credible path forward ("continue the conversation with our engineering team", CHALLENGES.md:L66). It is weaker on peer-floor wow and on "worthwhile problem for a specific user" unless area 2's agentic-traffic framing lands. The sponsor prizes are modest (2000/1000/500 EUR, CHALLENGES.md:L87-97).

## Unknowns
- Whether the hackathon Hostinger account has API tokens with firewall scope, and the API rate limits.
- AI Router credit size and whether `/embeddings` is enabled.
- Whether any real signed (Web Bot Auth) agent traffic will reach a fresh VPS.
- Whether managed external databases (Tiger, Aiven, Mongo) count as "runs on Hostinger".
- Hostinger judges' preference between the traffic and social/propaganda directions.

<!-- complete -->
