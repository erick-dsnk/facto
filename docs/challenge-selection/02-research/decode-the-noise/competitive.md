# Decode the Noise (Hostinger): competitive intelligence

Agent B. Research date 2026-11-13. Challenge text: CHALLENGES.md:L11-100.

## Summary
- Crowdedness: **medium-high** (estimate). Every "fake news / propaganda classifier" idea has been built many times at hackathons, and most teams will reach for "LLM prompt plus web UI". The sponsor, though, asks for measured precision / false-positive rate and live deployment on Hostinger (CHALLENGES.md:L29, L43, L76-79), which most hackathon entries do not deliver.
- No public record found of previous Hostinger challenge winners at Junction (searches returned nothing). Prior-winner evidence is therefore indirect: other disinformation and bot-detection hackathons.
- Mature open-source (CooRnet/CooRTweet, Anubis, CrowdSec, SemEval repos) and commercial (Cyabra, Graphika, Blackbird.AI, Cloudflare) solutions exist. A submission that merely re-wraps them will look familiar.
- To stand out: pick a narrow, measurable slice, publish a labelled eval with precision/recall/FP rate against a baseline, include an abstain band, and show evidence-linked explanations. The "Clean the traffic" and "Spot the swarm" directions are the least likely to be a prompt wrapper (estimate).

## 1. Previous winners and similar hackathon submissions

| Finding | What it shows | URL |
|---|---|---|
| Hostinger challenge winners at Junction | Not found. Searches surfaced only Hostinger's own 21-Day Startup Challenge (prizes 2000/1000/500 USD, MVPs on Hostinger products) and an internal staff AI hackathon. Hostinger's prior hackathon track record at Junction: **unknown**. | https://www.hostinger.com/blog/21-day-startup-challenge/ ; https://www.hostinger.com/blog/hostingers-ai-agents-hackathon/ |
| Osavul, first place at 1991 Media Hackathon | Built a coordinated-inauthentic-behaviour (CIB) detection suite; later folded into its CommSecure product. Shows CIB is a winning theme for judges, and that it can become a company. Date and prize not stated on the page. | https://www.osavul.cloud/osavul-won-in-1991-media-hackathon |
| 2023 Canadian AI Misinformation Hackathon, first place ReadProbe | Lateral-reading tool for website credibility, a "Trust the source" analogue. | https://socialmedialab.ca/?p=21741 |
| Devpost fake-news projects (Foolproof, TruthScan, Unmask AI, TruthLens, Prism) | Typical entries: Flask/Next app, Bing or vector search, LLM verdict, OCR. Their own write-ups note the lack of evaluation and that fake-news detection depends on context and framing. These are the repeated pattern. | https://devpost.com/software/foolproof ; https://devpost.com/software/truthscan ; https://devpost.com/software/unmask-ai-xoi0vm ; https://devpost.com/software/prism-5j2tda |
| ukr.ai, 36-hour Russia-Ukraine misinformation detector | Same pattern in a hackathon setting. | https://ics.uci.edu/2022/03/22/ukr-ai-develops-ai-model-to-detect-misinformation-on-russia-ukraine-war/ |
| DARPA Twitter Bot Challenge (2015) | Early benchmark showing bot detection is a feature-engineering plus network problem. | https://www.arxiv.org/pdf/1601.05140 |
| Clemson Media Forensics Hub, 2nd, DIU/NSIN Cyber Innovators Challenge | Platform for malign coordinated influence. Not a hackathon, but shows the theme is funded. | https://news.clemson.edu/media-forensics-hub-wins-second-place-in-cyber-innovators-challenge/ |

Caveat: search snippets only; I did not open every Devpost page, so project details are as summarised by the search tool.

## 2. Open-source implementations

- **SemEval-2020 Task 11** (propaganda span and 14-technique classification). Task paper: https://arxiv.org/pdf/2009.02696. Top systems used pretrained Transformers and ensembles. Participant code: https://github.com/hawkeoni/Semeval2020_task11 , http://github.com/aschern/semeval2020_task11 , https://github.com/cicl-iscl/CyberWallE-propaganda-detection (not verified as maintained).
- **LLM vs specialised models on propaganda**: NYU study found GPT-3.5/GPT-4 and Claude 3 Opus below a RoBERTa-CRF baseline on six techniques, weaker on fear appeal and flag-waving. This implies a pure LLM prompt will be measurably worse than a fine-tuned model, and a team that shows this comparison has a real story. https://engineering.nyu.edu/news/large-language-models-fall-short-detecting-propaganda
- **Coordination detection**: CooRnet / pycoornet (coordinated link sharing, original relied on CrowdTangle which is shut down), CooRTweet (R, CRAN), Coordination Network Toolkit, OSoMe tools (Coordiscope, Botometer X, limited coverage). https://pypi.org/project/pycoornet ; https://search.r-project.org/CRAN/packages/CooRTweet/readme/README.html ; https://osome.iu.edu/research/blog/exploring-the-latest-osome-tools
- **Bot traffic**: Anubis (proof-of-work AI-scraper firewall, 24.2k GitHub stars; blunt, blocks some legitimate bots) https://github.com/TecharoHQ/anubis ; CrowdSec (log-based behaviour detection, community blocklist, bot detection added in 1.8.0) https://helpnetsecurity.com/2026/09/01/crowdsec-1-8-0-bot-detection/ ; SafeLine WAF; ai.robots.txt user-agent list (https://www.cloudflare-cn.com/learning/ai/how-to-detect-which-ai-bots-crawl references this lineage).

## 3. Commercial products

- Cyabra (coordinated campaign detection; behavioural, network, language, amplification signals; vendor claims) https://cyabra.com/product/coordinated-campaigns-detection/
- Graphika, Blackbird.AI, Alethea (network and narrative intelligence, per a comparison site) https://us.fitgap.com/search/disinformation-detection-tools
- NATO StratCom COE evaluation: commercial manipulation is cheap; AI-generated accounts evade detection when activity is spread out. Useful for the "honest limits" angle. https://stratcomcoe.org/publications/download/Social-Media-Manipulation-FINAL-FILE.pdf
- Cloudflare bot management (per-request bot score 1-99; AI Crawl Control) https://developers.cloudflare.com/reference-architecture/diagrams/bots/bot-management/ ; https://www.cloudflare.com/lp/pg-security-block-ai-bots/
- **Hostinger itself already ships an AI Audit CDN feature** showing and blocking AI crawlers, built from logs of 5M sites. A "which AI crawlers hit me" dashboard duplicates the sponsor's own product. https://www.hostinger.com/blog/cdn-ai-audit/
- Hostinger AI Router (OpenAI/Anthropic-compatible gateway, base URL reported as https://router.hostinger.com/v1; credit-based). https://www.hostinger.com/ai-router ; https://docs.litellm.ai/docs/providers/hostinger_router

## 4. What most teams will build first (estimate, based on the patterns above)
1. Paste-text box: LLM prompt returns "propaganda: 87%" plus a paragraph of reasoning. Direction "Name the technique", no measurement.
2. Fake-news / credibility scorer for a URL using an LLM and search.
3. Twitter/X-style bot-account classifier on a Kaggle dataset, with a dashboard.
4. Apache/nginx log parser that flags user agents and request rates, with a chart.
5. Browser extension highlighting loaded language.
6. A WHOIS/domain-age checker for "Trust the source".

## 5. Obvious ideas to avoid
- LLM-only propaganda yes/no classifier with a UI and no eval.
- "Fake news detector" for single claims (fact-checking is a different problem from this brief).
- Kaggle Twitter bot classifier with a headline accuracy number on a balanced set.
- AI-crawler user-agent dashboard (duplicates Hostinger AI Audit and ai.robots.txt).
- Rate-limit-and-block log analyser, a re-skin of CrowdSec/fail2ban.
- Wrapping Botometer or CooRnet without adding anything (their data sources are partly dead).

## 6. Crowdedness estimate
**Medium-high** (estimate, not data). Reasoning:
- The brief is broad (four directions), topical, needs no hardware, and has a clear 2000 EUR first prize; it sits in the Agentic AI Track (CHALLENGES.md:L9), where many AI-experienced teams will look. Number of Junction teams per challenge: unknown.
- Counter-pressure: mandatory live deployment on a Hostinger VPS (L29) and a detection-quality weight of 40% (L76) filter out lightweight wrappers. Expect many entries but few with a real eval.
- No prior Junction winner list for Hostinger was found, so priors on what Hostinger judges reward are weak.

## 7. What would make a submission look different
- Evaluation as the headline: labelled set, precision/recall/FP rate vs a simple baseline and vs an LLM-only baseline, with confidence intervals and an abstain band (L29, L43).
- Behaviour over content: coordination across accounts or requests (timing, text reuse, link sharing) rather than single-post verdicts (L35). Content-only tools do not detect CIB (comparison source above).
- Evidence-linked explanations: every verdict points at the matching spans, clusters or log lines.
- Dogfooding on the team's own Hostinger VPS: ingest its real access logs or a honeypot page seeded with synthetic bad traffic, so the "live on Hostinger" requirement is part of the demo rather than a box ticked.
- Show failure honestly: a false-positive gallery and a "what this misses" panel (e.g. low-and-slow AI accounts per NATO StratCom).
- Hybrid architecture: a cheap fine-tuned or classical model does the bulk of work, with the LLM via AI Router only for explanation. Controls the shared-credit risk and mirrors the NYU finding.
- Licensing hygiene: check dataset terms before using any corpus (PTC is reported academic-use only in Agent A's report; I did not verify).

## Unknowns
- Past Hostinger-at-Junction winners, number of teams, AI Router credit size, dataset terms, general Junction eligibility rules.

<!-- complete -->
