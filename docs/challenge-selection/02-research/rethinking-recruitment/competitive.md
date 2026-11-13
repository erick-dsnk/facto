# Rethinking Recruitment (City of Espoo): competitive intelligence

**Summary**
- The solution space is crowded at the "AI CV/job matcher" level (many hackathon entries, plenty of commercial tools) but thin at the specific angle Espoo asks for: event-stage signal-vs-noise, with human-in-the-loop and an EU AI Act story.
- Expect most teams to build a CV-to-job or candidate-to-company matcher with LLM scoring. That conflicts with the "no automated profiling or decision-making without a human" rule (CHALLENGES.md:L1806), so those entries should lose on the 20% responsible-execution criterion and on relevance.
- Crowding estimate: medium to high team interest (estimate). Prize is small (EUR 1,500 first, CHALLENGES.md:L1822), but the topic is easy to understand and needs no hardware.
- Research limits: the web search budget ran out partway, and several Devpost pages returned HTTP 403. I found no verified past winner for this exact challenge. Items marked "(search snippet only)" were not opened.

## 1. Past winners of the same sponsor or similar challenges
- Espoo has sponsored earlier Junction and Aalto-run hackathon challenges. Aalto Ventures Program lists "Buddy Challenge" as winner of an Espoo challenge about engaging citizens in the SDGs; year not shown (search snippet only, page redirected and not read): https://avp.aalto.fi/?p=961
- Espoo took part in a 2023 sustainability hackathon with a Junction golden-ticket prize (search snippet only): https://www.espoo.fi/en/news/2023/03/city-espoo-participates-sustainable-development-hackathon
- Junction 2018 had an Espoo challenge, "Business at Your Fingertips" (https://open-ecosystem.org/challenges/business-your-fingertips, search snippet only; winner unknown).
- The challenge text itself says "Junction 2025" (CHALLENGES.md, company info), so this challenge was probably reused or lightly adapted from 2025. I found no 2025 results. Winner of the 2025 version: **unknown**.
- Takeaway (inference): Espoo challenges are civic-service themed and judged by city staff. Judges appear to favour pilotable service concepts over technical depth (estimate, not verified).

## 2. Similar hackathon submissions (all seen only as search results; 403 on Devpost fetches)
- Evidra, explainable evidence-first technical hiring (FastAPI, pgvector, Llama-3): https://devpost.com/software/evidra
- DevHunt, matches developers using hackathon track records: https://devpost.com/software/devhunt-3zl927
- CoMatch: https://devpost.com/software/comatch
- Torin AI, skills-based hiring: https://devpost.com/software/torin-ai
- Resmatch, "truth-first" resume tailoring agent: https://kelaenderkoe.pages.dev/Using-https-devpost.com/software/resmatch-app
- ResuLens resume screener: https://www.hackquest.io/es/projects/HackTheFlag-ResuLens-Automated-Resume-Screener
- ScreenSmart: https://devfolio.co/projects/screensmart-31c1
- AI Resume Matching and Skill Tracker (claims a "Bias-Free Score"): https://devfolio.co/projects/ai-resume-matching-and-skill-tracker-e5a3
- Smart Hire AI: https://www.commudle.com/builds/smart-hire-ai-be9dbb01-c3a0-46b7-8fef-2869295a94c6
- SmartFit AI recruitment platform: https://lablab.ai/ai-hackathons/ai-genesis/brainspark/smartfit-ai-recruitment-platfrom
- Pattern: resume screener, resume-to-JD scorer, "bias-free score", interview chatbot. I did not verify whether any won prizes.

## 3. Open-source implementations
- esco-skill-extractor (MIT, 32 stars): extracts ESCO skills and ISCO occupations from CVs or job text via sentence embeddings (all-MiniLM-L6-v2, cosine thresholds 0.6/0.55); pip, Docker, REST. Opened: https://github.com/KonstantinosPetrakis/esco-skill-extractor
- nestauk/ojd_daps_skills, skill extraction to ESCO or Lightcast taxonomy (snippet only): https://github.com/nestauk/ojd_daps_skills
- Tabiya livelihoods classifier, linked from a 2025 ESCO/EQF linking paper (snippet only): https://arxiv.org/pdf/2512.03195 (the cited repo is tabiya-tech/tabiya-livelihoods-classifier)
- CV-to-job matching on ESCO (IJCAI 2024, snippet only): https://ijcai.org/proceedings/2024/1011.pdf
- Implication: ESCO mapping is commodity and a one-hour task. It is not a differentiator on its own.

## 4. Commercial products
- Brella (named by Espoo as a resource, CHALLENGES.md:L1846-L1850): AI matchmaking from attendee interests and intents, learns from choices, 1:1 meeting booking. Vendor-claimed acceptance rates of 31-39%. Its blog describes no recruiting-specific feature; "finding employment" is just one attendee goal. https://brella.io/blog/ai-matchmaking-future-of-events
- Tavata, event networking platform (named by Espoo, L1846; not opened).
- Duunitori, The Hub, Work in Finland, Job Market Finland: job boards named by Espoo (L1838-L1844); not opened.
- Other general AI screening and sourcing tools exist (not researched in detail; I did not verify any specific product). Recruitment-focused products mostly rank candidates, the thing Espoo's brief excludes.
- Gap (inference from Brella page): intent matchmaking exists, but nothing I found does pre-event company need elicitation plus capability evidence under a human-in-the-loop, public-sector constraint.

## 5. Approaches most teams will reach for first (estimate)
1. CV upload, LLM parses, scores against a job description, ranked list.
2. Chatbot or "AI coach" that rewrites CVs or helps prepare for the event.
3. Embedding-based two-sided matcher with a swipe or recommendation UI.
4. "AI detector" for AI-written CVs.
5. Dashboard for the organiser showing match scores.
6. Multilingual translation layer for international talent.

## 6. Obvious ideas to avoid
- Ranking or scoring candidates (violates L1806 and Annex III high-risk framing).
- CV rewriting or AI-CV detection (doubles down on the AI-vs-AI problem the brief names, L1760).
- Generic job board or Tinder-style matcher not tied to Espoo events (L1768).
- A "bias-free score" badge with no real audit.
- A bare ESCO tagger with no event workflow.

## 7. Crowding estimate (estimate, not measured)
Medium to high. Reasons: (a) no hardware, low barrier, every team can build an LLM matcher; (b) the topic is relatable; (c) offsetting factors: small prize, a Data Track label, and a text-heavy brief with compliance rules that put off teams wanting flashy demos. Likely 5-12 teams out of the Junction field (my guess; Junction team counts per challenge are unknown). Most will be variants of approaches 1-3.

## 8. What would look different
- Reframe from matching people to improving signals: structured, early company need elicitation (the brief says companies give needs too late, L1736-ish "too late, only just before the event day") and candidate work-sample or capability evidence rather than text.
- Both sides opt in to each meeting; the system suggests conversations, never ranks people, and explains each suggestion in plain language.
- Organiser console with human approval gates, load/overload control for companies (L1779) and capacity-aware scheduling (platform crash at start, L1783).
- Bias test shown live (swap nationality or language, show suggestions unchanged) plus a one-page AI Act and GDPR design note using synthetic data only (L1808).
- A before/after metric and a concrete Espoo pilot plan with the International Working Life Services team, since mentors are on site (L1815).
- Weak spot to watch: Espoo judges weight Impact 45% (L1870), so a clear user story from a real organiser beats model sophistication.

<!-- complete -->
