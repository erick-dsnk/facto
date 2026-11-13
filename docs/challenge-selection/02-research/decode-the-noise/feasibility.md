# Decode the Noise (Hostinger): technical feasibility (Agent D)

**Summary**
- **Feasible and low-risk for us.** There is no physical hardware. The work is a Dockerised web app plus an ML/LLM detector on a Hostinger KVM 2 VPS (CHALLENGES.md:L49-51), which is squarely in our skills. Estimate: about 90% chance of a strong core feature in 40 hours, and about 85-90% chance the live demo works.
- **Recommended build (estimate): "Clean the traffic" with a measured detector.** A reverse proxy on our own VPS logs real traffic. A feature-based classifier, with rules plus gradient boosting, scores sessions, and an LLM through the Hostinger AI Router only *explains* verdicts. Precision, recall and false-positive rate are measured on a public CC BY 4.0 labelled web-log dataset ([Zenodo 3477932](https://zenodo.org/record/3477932)) and on attack traffic we generate ourselves. Text-propaganda options run into data-licence problems (the PTC is "academic purposes" only, [PTC](https://propaganda.math.unipd.it/ptc/)).
- **Main failure modes:** VPS, domain or TLS provisioning slips late; the AI Router balance (shared, size unknown) runs out or the Router stalls during judging; an evaluation looks inflated because the Zenodo labels come from user-agent heuristics; and the site lacks a working fallback when the LLM is down. Each has a cheap mitigation (section 6).
- **Ask on site before committing:** AI Router credit amount and rate limits, when the VPS and domain are handed over, whether an external LLM may be called from the VPS, and what exactly "end of the hackathon" means for uptime (section 8).

---

## 1. What has to exist (hard requirements)

| Requirement | Source |
|---|---|
| A tool that detects propaganda, bots or bad-actor behaviour from text, social content or web-traffic patterns | CHALLENGES.md:L19, L27 |
| Deployed and running live on Hostinger infrastructure by the end of the hackathon, with a public URL judges can open | CHALLENGES.md:L29 |
| The final product runs on Hostinger. Any language, framework or model is allowed, open-source or hosted. | CHALLENGES.md:L49 |
| Soft but heavily weighted: transparent and measurable, showing precision and FP rate | CHALLENGES.md:L43, L76 (40%) |

## 2. Recommended architecture (estimate)

The pick is direction 3, "Clean the traffic" (CHALLENGES.md:L39), with an optional thin slice of "Spot the swarm" coordination logic applied to IPs and sessions instead of social accounts (CHALLENGES.md:L35).

```
Internet (real scanners + judges + our attack generator)
        │
   Caddy / nginx  (TLS, JSON access logs)  ── on Hostinger KVM 2 VPS (Docker Compose)
        │                        │
   demo site + dashboard     log shipper (tail → SQLite/Postgres/DuckDB)
                                 │
                     Detector service (Python)
                       ├─ sessioniser (IP+UA, 30-min gap)
                       ├─ rule layer (known-bad paths /wp-login.php, /.env, rate bursts, login-fail ratio)
                       ├─ ML layer (LightGBM / sklearn on behavioural features — NOT user-agent)
                       ├─ coordination layer (IPs sharing request sequences/timing → clusters)
                       └─ calibrated score → {bot, human, uncertain} with abstain band
                                 │
                     Explainer (Hostinger AI Router LLM, cached, optional)
                       → plain-language "why" citing the exact log lines/features
                                 │
                     Dashboard: live feed, per-session verdict + evidence,
                     Evaluation page: P/R/FPR vs baseline, confusion matrix, failure cases
```

Design choices that matter for judging and reliability (estimates):
- **The verdict comes from deterministic, measurable models. The LLM only explains.** Precision and FP rate then do not depend on LLM non-determinism, evaluation over thousands of sessions costs no credits, and the live demo still produces verdicts if the Router fails.
- **Baseline comparison.** Report three systems side by side: a user-agent regex baseline, rules only, and rules plus ML. This is the "defensible insight with a baseline" the brief rewards (CHALLENGES.md:L43).
- **Abstain band.** Low-confidence sessions go to "needs review" and are not blocked. Report FP rate at the chosen operating point and coverage. This addresses "how you handle false positives" directly (CHALLENGES.md:L29).
- **Self-protection moment.** A fresh public IP or domain usually draws scanner traffic (wp-login, .env probes) within hours (estimate, unverified for this event). The dashboard can show real, non-staged bad actors hitting our own site during judging.

### Alternative directions (not recommended as the core, estimate)
- **"Name the technique" (text propaganda).** The fastest to prototype as an LLM prompt, and therefore the most crowded (Agent A estimate). The best labelled data, the PTC (about 550 articles, 18 techniques), needs registration and is "academic purposes" only ([PTC](https://propaganda.math.unipd.it/ptc/)). The Hugging Face mirror lists its licence as unknown and does not ship the data ([HF card](https://huggingface.co/datasets/sem_eval_2020_task_11/blob/main/README.md)). Whether hackathon use is allowed is unknown. Without labels, the 40% detection-quality criterion is hard to evidence.
- **"Spot the swarm" on social data.** Platform APIs and scraping raise terms-of-service problems. TwiBot-22 is obtained by emailing the authors, so it is unlikely to arrive in time (Agent A, [GitHub](https://github.com/LuoUndergradXJTU/TwiBot-22)). A synthetic coordinated-posting dataset is possible but weak as evidence (estimate).
- **"Trust the source."** This needs WHOIS or domain-age lookups and AI-text detection. AI-text detectors have well-known false-positive problems (estimate), and measuring them honestly in 40 hours is hard.

## 3. Critical dependencies and how we get them

| Dependency | What we know | How we get it during the event | Risk |
|---|---|---|---|
| Hostinger VPS KVM 2 (2 vCPU, 8 GB RAM, 100 GB NVMe, root, Docker, free domain) | CHALLENGES.md:L51. The Docker template is reported to be Ubuntu 24.04 with docker-ce and Compose preinstalled, and hPanel has a Docker Manager ("Compose manually / from URL / One Click Deploy") (search summary of [Hostinger support p=633](https://www.hostinger.com/support/?p=633) and [p=265](https://www.hostinger.com/support/?p=265). I could not open those pages myself because they timed out, so treat this as unverified). | Hostinger provisions it per team. The mechanism (voucher, account invite) and timing are **unknown**. Ask at kick-off. | Medium if handed out late; low otherwise |
| Free domain + TLS | Free domain included (CHALLENGES.md:L51). DNS propagation and Let's Encrypt timing are not documented for the event. The MCP README says SSL install is limited to 3 setups per domain per 7 days, with a 429 if repeated within a minute ([MCP README](https://raw.githubusercontent.com/hostinger/api-mcp-server/main/README.md)). | Register the domain in hour 1. Use Caddy auto-TLS on the VPS. Keep the raw VPS IP over HTTP as a fallback URL (estimate). | Medium: DNS can take hours |
| Hostinger AI Router | Base URL `https://router.hostinger.com/v1`, keys `sk-hstgr-…`, OpenAI and Anthropic SDK compatible. Per-key daily and monthly spend limits, per-key model allow-lists, a balance check before each request (declined, not overdrawn, when low), and automatic reroute if a model is unavailable ([Hostinger support](https://www.hostinger.com/support/?p=19146)). Endpoints are `/chat/completions`, `/responses`, `/messages` and `/embeddings`; example models are `claude-sonnet-5`, `gpt-5.2` and `text-embedding-3-small/large` ([LiteLLM docs](https://docs.litellm.ai/docs/providers/hostinger_router)). | One key and a shared credit balance per team (CHALLENGES.md:L52). **The credit amount is unknown.** | Medium: see section 4 |
| Labelled web-log data | "Web robot detection - Server logs" (Lagopoulos and Tsoumakas): CC BY 4.0. It contains `public_v2.json` (3.2 GB) plus `simple_features.csv` (15.9 MB) and `semantic_features.csv` (4.3 MB), with labelled sessions ([Zenodo](https://zenodo.org/record/3477932)). According to the search summary of the authors' paper, the labels come from user-agent lookups and bot regexes, with logged-in users labelled human: 67,484 sessions, about 56% robot. I did not open the paper, so this is unverified. | Download the small feature CSVs before the event or over venue wifi. Skip the 3.2 GB raw file unless needed. | Low for access. **High for evaluation validity** (see 6.3) |
| Our own ground truth | None exists yet. We generate it ourselves: scripted scrapers, credential stuffing against a fake login, and directory scans (labelled bot), plus team members' and volunteers' browsing (labelled human) (estimate). | Build during the event. | Low |
| Hostinger MCP / Connector (optional) | `npm i -g @hostinger/mcp` needs Node 24+, or use the hosted `https://mcp.hostinger.com`. Auth is `HOSTINGER_API_TOKEN` or OAuth ([MCP README](https://raw.githubusercontent.com/hostinger/api-mcp-server/main/README.md)). | Nice for the "deployed via agents" story. Plain SSH and `docker compose up` are enough. | Low; it is not on the critical path |

## 4. Documented and reported limits, pricing, latency and reliability

- **AI Router pricing.** Billed in prepaid Hostinger credits. Each model has its own credit cost, and no per-model rates are published in the support article ([support](https://www.hostinger.com/support/?p=19146)). The marketing page says pricing starts at $5.99 for 5 credits and contradicts itself on per-request versus per-token metering ([ai-router](https://www.hostinger.com/ai-router)). LiteLLM accounts 1 credit as $0.01 for its listed models ([LiteLLM](https://docs.litellm.ai/docs/providers/hostinger_router)). These figures conflict. Treat the real cost per call as **unknown** until we see hPanel usage.
- **Shared balance.** The credit balance is shared across all keys and with AI Builder, Hostinger Agent, Reach and GPU instances ([support](https://www.hostinger.com/support/?p=19146)). If we use AI Builder, it drains the same pool (inference).
- **Rate limits.** Configurable per key, but **no default numbers are documented** ([ai-router](https://www.hostinger.com/ai-router), [support](https://www.hostinger.com/support/?p=19146)). Unknown.
- **Latency and uptime.** No figures or SLA are published ([ai-router](https://www.hostinger.com/ai-router)). The router adds a hop in front of the upstream provider. Expect frontier-model latency of seconds per explanation (estimate). Response caching for repeated content is claimed ([ai-router](https://www.hostinger.com/ai-router)).
- **Model catalogue.** The challenge says "150+" (CHALLENGES.md:L52). Hostinger's page says "20+", listing 9 providers ([ai-router](https://www.hostinger.com/ai-router)). A third-party catalogue lists 4 (search result, not opened). The exact model IDs live in hPanel under AI Router → Models ([support](https://www.hostinger.com/support/?p=19146)). Unknown until we log in.
- **Hard stop on empty balance.** Requests are declined when the balance is too low ([support](https://www.hostinger.com/support/?p=19146)). In other words, the LLM features stop dead when credits run out, which makes a fallback mandatory (section 6).
- **Local model option.** An Ollama template exists (CHALLENGES.md:L51). On 2 vCPU and 8 GB RAM with no GPU, only small quantised models (about 1-4B parameters) are practical. They would produce a few tokens per second, too slow for concurrent judge traffic but usable as a cached or offline explainer (estimate, not benchmarked).
- **VPS capacity.** 2 vCPU and 8 GB is plenty for Caddy, a Python API, SQLite or DuckDB, and LightGBM inference over a hackathon's traffic volume (estimate). Avoid training large models or running Ollama on the same box as the demo during judging.

## 5. Integration complexity for our team (estimate)

| Component | Complexity | Notes |
|---|---|---|
| Docker Compose + Caddy on VPS | Low | Standard. The only unknowns are provisioning and DNS timing. |
| Log ingestion + sessionisation | Low | Parse JSON access logs into a table every few seconds. |
| Feature engineering + LightGBM + calibration | Low-medium | Data-science work we are confident in. The care is in leakage and honest splits. |
| Attack-traffic generator (labelled) | Low | Python or k6 scripts. Run only against **our own** server. |
| Coordination clustering (IP groups with shared sequences or timing) | Medium | A stretch goal. Cosine similarity on path-sequence vectors plus time-window co-occurrence. |
| LLM explanations via AI Router | Low | One OpenAI-SDK call with a base-URL change. Cache explanations per session. |
| Dashboard (live feed, evidence, eval page) | Low-medium | Next.js or a simple React/HTMX page. The brief values logic over polish (CHALLENGES.md:L29). |

Nothing here needs skills we lack. The parallel-agent workflow fits well: infrastructure, detector and evaluation, dashboard, and the attack generator are independent streams.

## 6. Failure modes (do not soften)

1. **The deployment is not live or not reachable at judging (fatal).** It is the one hard "must" (CHALLENGES.md:L29). Causes include the VPS being provisioned late, DNS not propagated, a Let's Encrypt failure, the container crashing, disk filling up from logs, or the venue network blocking the port. *Mitigation:* deploy a hello-world to the VPS in hours 0-3; `restart: unless-stopped`; log rotation; an uptime check pinging every minute; keep the IP URL as a backup; freeze deploys about 2 hours before judging.
2. **AI Router credits are exhausted or the Router stalls.** The balance is shared and of unknown size, and requests are declined at zero ([support](https://www.hostinger.com/support/?p=19146)). An evaluation loop that calls the LLM per sample could empty it overnight. *Mitigation:* the LLM never sits on the verdict path; set a per-key daily spend limit; cache explanations; fall back to template explanations generated from feature contributions; and run a separate key for development versus the demo, if the same balance allows multiple keys (it does, per the docs).
3. **The evaluation is inflated and a judge sees through it.** The Zenodo labels are derived from user agents (unverified summary of the paper), so a model that uses user-agent features will score near-perfectly and prove nothing. *Mitigation:* exclude user-agent features from the ML layer; state the label provenance on the eval page; add our own generated ground truth that includes UA-spoofing bots; and show the failure cases. The 40% criterion rewards exactly this honesty (CHALLENGES.md:L29, L43, L76).
4. **The live demo shows no interesting traffic.** Real scanners may not arrive on cue. *Mitigation:* a "replay" button that runs our attack generator live, as a scripted credential-stuffing burst, while judges watch it get flagged with evidence. Also pre-record the overnight real-traffic catch.
5. **False positives on judges.** Judges opening the site from venue wifi behind a shared NAT may be flagged as a bot swarm. That would be an embarrassing live false positive (estimate). *Mitigation:* the abstain band; flag-only, never block, in demo mode; and test from the venue network on day 2.
6. **Crowded field.** The brief is open, and many teams may submit LLM text classifiers (Agent A estimate). The traffic direction is less crowded but less "propaganda"-flavoured. Some judges may prefer the social angle (unknown).
7. **Legal and ethical.** Do not scan or attack third-party sites. Do not label real named social accounts publicly. Do not use academic-only data commercially (inference, see the PTC terms).

## 7. Scope: smallest complete version vs stretch

**Smallest complete version (target: done by about hour 20, estimate):**
- The VPS runs Docker Compose with Caddy, the demo site and the detector API, on the Hostinger domain over HTTPS.
- Live log ingestion and sessionisation; a rule layer plus a LightGBM model trained on the Zenodo feature CSVs (with user-agent features excluded) plus our generated sessions.
- A dashboard listing sessions with a verdict of bot, human or uncertain, a score, and the top contributing features plus raw log lines as evidence.
- An eval page with precision, recall and FPR for the UA-regex baseline, rules only and rules plus ML, a confusion matrix, the chosen threshold and 3-5 failure cases.
- An attack generator to trigger a live detection on demand.

**Stretch (hours 20-34):** LLM plain-language explanations via the AI Router with caching and a template fallback; coordination clustering ("these 14 IPs ran the same scan sequence within 90 s"); a site-owner action export (Caddy or nginx blocklist snippet, robots rules); an MCP-driven one-command deploy story.

**Buffer (hours 34-40):** freeze, rehearse the demo, record a backup video, and make sure the URL stays up through judging.

The core feature fits comfortably in 40 hours. The real risk sits in infrastructure handover and evaluation honesty, not in the volume of code (estimate).

## 8. Questions for the Hostinger booth before committing

1. How many AI Router credits does each team get, what are the default rate limits, and which model IDs are enabled? Can we create separate dev and demo keys with spend caps?
2. When and how are the KVM 2 VPS and free domain handed over? Is the domain ready for DNS and TLS immediately?
3. Is calling an external LLM provider (for example our own Anthropic key) from the VPS acceptable, or must model calls go through the AI Router to score on "live deployment on Hostinger"? (CHALLENGES.md:L49 says "open-source or hosted" is allowed, but the scoring view is unknown.)
4. Until when must the URL stay live: judging only, or after the event? Who pays after the 1-month free period (CHALLENGES.md:L49)?
5. Do they have any anonymised Hostinger traffic or abuse logs, or a labelled dataset we could use? (None is listed: CHALLENGES.md:L45-58.)
6. Would they rate a site-owner traffic detector as on-theme as highly as propaganda or social-bot detection? (The brief lists it as a direction, CHALLENGES.md:L39, but judge preference is unknown.)
7. Is there a submission format beyond the public URL (repo, video, form)? Unknown from the challenge text.

## 9. Scores (estimates)

- Buildable in 40 h (strong core feature): **9/10**
- Live demo reliability: **8/10** (the limiting factors are external: VPS and DNS handover and Router availability, all mitigated by early deploy and an LLM-free verdict path)
- Physical hardware work: **none**

<!-- complete -->
