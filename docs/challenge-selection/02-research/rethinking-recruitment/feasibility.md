# Rethinking Recruitment (City of Espoo): technical feasibility (Agent D)

## Summary
- **Technically easy for this team (estimate 9/10 buildable in 40 h).** It is a pure web and LLM app. No hardware, no sponsor API and no credentials are needed (CHALLENGES.md:L1794-L1808). The only external data service worth using, the EU ESCO skills API, is public, keyless and answered in 0.4-0.7 s in tests on 2026-11-13.
- **Credible architecture:** a mobile-first web app with three role views (company, candidate, organizer). The LLM turns free text into structured, ESCO-coded "need briefs" and "capability evidence". Suggestions come from a **deterministic, explainable** overlap rule that needs mutual opt-in and never ranks people. A counterfactual fairness test runs on synthetic data, and the app ships an AI Act and privacy note.
- **Main risks are not technical.** They are (1) a design or pitch read as "automated profiling" (L1806), (2) looking like a Brella clone, and (3) live-demo fragility from venue Wi-Fi, LLM latency or a voice step. All three can be mitigated: cache ESCO locally, pre-seed the synthetic event, keep a recorded fallback, and make voice optional.
- **Unusable data sources:** the Job Market Finland (Työmarkkinatori) job-posting APIs are tied to a Finnish business ID and need KEHA-keskus approval, so they are out for a weekend. Whether Duunitori, The Hub or Brella have usable APIs is **unknown** (the shared web-search budget ran out). None of them is needed.
- **Estimated demo reliability 8/10** if the demo runs on pre-seeded data with one live LLM call per step and a cached fallback.

**Research note:** the session-wide web-search budget ran out during this task. Claims below come from pages opened directly by URL, from live `curl` calls, and from Agent A's and Agent C's reports. Anything not verified is marked unknown or estimate.

---

## 1. What a credible entry must contain

The architecture follows from the hard constraints:

| Constraint | Architectural consequence | Source |
|---|---|---|
| No automated profiling or decisions about individuals without a human involved | No per-person score, ranking, shortlist or auto-reject anywhere in the UI or API. Suggestions are explainable and need **both** sides to opt in. The organizer can override them | CHALLENGES.md:L1806, L1828 |
| Synthetic data only | A synthetic population generator, which also feeds the fairness test | L1808 |
| Minimise personal data and show AI Act compliance | A data model with no name, age, photo or nationality fields in matching, retention and deletion, an AI-use disclosure, and a written design note | L1808 |
| Avoid bias across nationality, language, education and career path | Multilingual input (ESCO labels), plus a counterfactual swap test with one visible number | L1792 |
| Tied to Espoo events (before, during or after) | The data model is built around an **event** with company needs, candidate opt-ins, slots and follow-up | L1768 |
| Judging gives 45% to Impact, 35% to Innovation & UX and 20% to Responsible & Feasible execution | UX polish and a clear organizer before/after matter more than technical depth | L1870-L1880 |

### Proposed architecture (estimate, sized for 3 people and 40 h)

```
Phone/laptop browser (Next.js or Vite + React, mobile-first, QR/link entry, no login)
 ├─ Company view: guided need interview (chat; voice optional) → Need Brief
 │     tasks, essential vs learnable ESCO skills, real language requirement, conversation topics
 ├─ Candidate view: answer 1–3 task prompts derived from published Need Briefs
 │     (text, own language; voice optional) → Capability Evidence in own words + ESCO tags
 │     the candidate confirms or removes (candidate-owned, no score)
 ├─ Event-day view: topic-based suggestions with a "why" line, mutual accept, capacity caps
 └─ Organizer view: event setup, capacity and rotation controls, override, fairness metric,
       aggregate follow-up stats, retention timer
Backend (Node/TypeScript, one service)
 ├─ LLM module (one file, with a mock): structured JSON output (need → brief, answer → evidence,
 │     brief → prompts, ESCO label mapping, translation)
 ├─ ESCO module: local cache of a skill/occupation subset (JSON) with the live API as fallback
 ├─ Suggestion engine: DETERMINISTIC set overlap of confirmed ESCO skill URIs + topic tags,
 │     with an explanation string, no learned model and no hidden score shown
 ├─ Fairness harness: generate twins (name, nationality, answer language, career path swapped)
 │     → rerun the engine → share of suggestions unchanged
 └─ DB: SQLite or Postgres (one DB), seeded with a synthetic TalentMatch event
```

Why the deterministic suggestion engine: the LLM only *structures text a human wrote and then confirmed*. Matching is a transparent rule over confirmed tags, which makes the "no automated decision, explainable, human confirms" story defensible, and the fairness test then measures something stable. An embedding or LLM ranker would be easier to attack under L1806 and would vary between runs during the live demo (estimate).

## 2. Critical dependencies and how we get them

| Dependency | Needed for | Access during the event | Status / risk |
|---|---|---|---|
| **LLM API** (structured output) | Need interview, evidence summarising, prompt generation, ESCO label mapping, synthetic data | OpenAI: "$100 in credits per participant through unique redemption links distributed by Junction" (CHALLENGES.md:L2444; listed under Best Use of Codex, L2420). Gemini needs our own Google AI Studio key: the rate-limit page says limits are "per project" and shows Tier 1 limits as low as 8 RPM / 40 RPD for one Flash model ([aistudio.google.com/docs/rate-limits](https://aistudio.google.com/docs/rate-limits)). The free-tier limits of other models were not shown on that page (unknown). | Low risk. Note that the **Hostinger AI Router credits are only for the "Decode the Noise" challenge** ("Every team working on this challenge", CHALLENGES.md:L11, L48-L52), so do not count on them. |
| **ESCO API** | Multilingual skill taxonomy and essential/optional skills per occupation | Public and keyless. Tested 2026-11-13: `GET https://ec.europa.eu/esco/api/search?text=...&type=skill&language=xx` returned 200 in 0.43-0.66 s (5 calls). Finnish, Swedish, Estonian, Russian and Arabic worked. Default version is v1.0.9, with v1.1.2 and v1.2.0 selectable via `selectedVersion` ([ESCO web-service API](https://esco.ec.europa.eu/en/use-esco/use-esco-services-api/esco-web-service-api)) | **Gotcha found:** `language=uk` (Ukrainian) returns HTTP 500 (`undefined field label_uk_gen_m_ngram`) on the default version and works only with `selectedVersion=v1.2.0` (14 results for "java"; 75 for "програмування"). Always pin `selectedVersion=v1.2.0`. The page states **no** rate limit, SLA or terms of use (unknown). A Finnish search for the niche term "kotlin" returned 0 (Agent C), so niche tech terms need an English fallback. |
| ESCO bulk download (fallback) | Offline cache for the demo | CSV/ODS per language and RDF/TTL; free, but you must "accept a privacy statement and enter your email" to receive a link. Current version v1.2.1 ([ESCO download](https://esco.ec.europa.eu/en/use-esco/download)) | Do this on Friday evening. A "Local API" also exists but its page says it "is provided for reference only and will be replaced shortly" ([ESCO services](https://esco.ec.europa.eu/en/use-esco/use-esco-services-api)). Do not rely on it; a JSON subset in the repo is simpler. |
| Speech-to-text (optional) | Voice answer in the candidate's language | OpenAI `gpt-transcribe` with streaming deltas; files up to 25 MB; `whisper-1` and the `gpt-4o-*-transcribe` models are deprecated and shut down on 26 Feb 2027 ([OpenAI speech-to-text](https://developers.openai.com/api/docs/guides/speech-to-text)). ElevenLabs codes via MLH (CHALLENGES.md:L2404) | Whether Finnish, Ukrainian and Arabic are supported by `gpt-transcribe` was **not confirmed** (the page lists none of them). Test on Friday night or drop voice. |
| Espoo example scenarios and user journeys | Realistic synthetic event and pitch grounding | Provided on site and on Discord (CHALLENGES.md:L1798-L1800, L1814) | Format and timing unknown. Ask on Friday. |
| Job Market Finland (Työmarkkinatori) job-posting APIs | Real job ads (nice-to-have only) | Access "is tied to the user's business ID (Y-tunnus)". It needs an activation notice to KEHA-keskus, which "checks the organisation's right and suitability", and onboarding is two-stage (test, then production credentials) ([tyomarkkinatori.fi job-posting APIs](https://tyomarkkinatori.fi/ohjeet-ja-tuki/rajapinnat/tyopaikkailmoitusten-rajapinnat)) | **Not obtainable in 40 h (estimate).** Do not plan on it. |
| Duunitori, The Hub, Work in Finland, Brella, Tavata APIs | Not needed | Listed only as examples (CHALLENGES.md:L1838-L1848) | Whether any of them is publicly available is **unknown**. `developers.brella.io` did not resolve (DNS failure on 2026-11-13). Treat them all as unavailable. |
| Hosting | Live URL for judges and peers | Any (Vercel, Fly, a VPS). Rules say judges "may run, access, and interact with your Submission in a test environment you provide" (00-rules-and-jury.md:L22) | Low risk. Deploy by Saturday midday. |

**No device, hardware, sponsor credential or NDA is required** (CHALLENGES.md:L1794-L1858).

## 3. Limits, pricing, latency and reliability

- **ESCO:** measured latency was 0.4-0.7 s per search. The Ukrainian default-version 500 error is reproducible (above). No documented rate limit or uptime commitment was found, so the risk that an EU-hosted public endpoint slows or fails during a 3-minute demo is unknown. Mitigation: a local cache, using live calls only for unseen terms.
- **LLM:** a need-brief or evidence call with structured output takes several seconds (estimate: 3-10 s for a mid-size model; not measured). On stage, use a fast model, stream text, and pre-compute everything except one "live" moment. Gemini's documented Tier 1 limit of 8 RPM / 40 RPD for one Flash model ([rate-limits page](https://aistudio.google.com/docs/rate-limits)) is low enough to hit during synthetic-data generation. Use OpenAI credits for bulk generation, or check our real limits in AI Studio.
- **Cost:** €0-50 in total, covered by the $100-per-participant OpenAI credits (L2444) (estimate: generating 200-500 synthetic profiles plus testing costs a few dollars).
- **Speech-to-text:** batch transcription adds upload and processing time. Hall noise and accents lower accuracy (estimate). Streaming deltas exist for `gpt-transcribe` (OpenAI page above).
- **Venue network:** unknown quality. It is the largest single demo risk for any web app. Mitigation: a phone hotspot, plus a demo that runs on localhost with cached LLM responses.

## 4. Integration complexity for this team

| Piece | Complexity | Note |
|---|---|---|
| Three role views, responsive web UI | Low | Core skill set. Most of the hours go into UX polish, which is 35% of the score |
| LLM structured extraction (need brief, evidence, prompts) | Low | Use JSON-schema output and validate with zod |
| ESCO mapping (LLM proposes labels, then resolve to URIs via ESCO search or cache) | Low-medium | Multilingual edge cases, the `selectedVersion` pin, and niche terms missing from non-English labels |
| Deterministic suggestion engine with capacity and rotation | Low | A small set-overlap rule plus a greedy slot allocation |
| Synthetic population generator (companies, candidates, multilingual answers) | Low-medium | Needs to look realistic and diverse. Seed with Espoo's scenarios if they arrive in time |
| Counterfactual fairness harness | Medium (in thinking, not code) | The ML and data skill set fits. The metric must be honest: report it even if it is not 100% |
| Voice input | Medium | Optional. Adds demo risk |
| AI Act and GDPR design note, DPIA-lite | Medium (writing) | Agent C's Article 6(3) framing (no profiling of people → preparatory or procedural task) is the backbone. Validate it with an Espoo mentor (L1804) |

There are no unfamiliar SDKs, no auth and no payments.

## 5. Does the core feature fit in 40 hours?

Yes, with margin (estimate). With parallel coding agents, the build is about 12-18 person-hours of engineering. The rest goes to UX, data, the fairness evidence, the pitch and sponsor conversations.

### Smallest complete version (must ship by Saturday 18:00, estimate)
1. One seeded synthetic Espoo TalentMatch event with 8-10 companies and 40-60 candidates in at least 4 languages.
2. **Company:** a free-text need ("we need a developer who can handle customers") becomes a Need Brief with tasks, essential vs learnable ESCO skills and a "Finnish really required?" flag. The company edits and confirms it.
3. **Candidate:** answers one task prompt from a brief in their own language (text) and gets evidence in their own words plus ESCO tags they confirm. No score.
4. **Event day:** suggestions with a one-line "why", both sides accept, and per-company capacity caps.
5. **Organizer:** a dashboard with the irrelevant-approach count before and after (synthetic baseline vs. suggestions), the fairness swap metric, override controls, and the data and retention panel.
6. A one-page AI Act and privacy design note in the repo and on a pitch slide.

### Stretch, in order
Voice answer (multilingual) → post-event one-tap follow-up with aggregate city report → skills-demand export (ties to L1853) → Gemini or Gemma variant for a tech challenge.

### Suggested split (estimate)
- Person A (full-stack): app shell, role views, DB, deploy, demo mode.
- Person B (AI/agents): LLM module, ESCO mapping and cache, need-interview and evidence prompts.
- Person C (ML/data): synthetic generator, suggestion engine, fairness harness, metrics, AI Act note, and sponsor and mentor liaison.
- Freeze features **Sunday 06:00** to rehearse and record the fallback video before the 10:00 deadline (00-rules-and-jury.md:L5, L43).

## 6. Likelihood of a successful live demo, and what would break it

**Estimate: 8/10**, conditional on a pre-seeded demo mode.

| Failure mode | Likelihood (estimate) | Impact | Mitigation |
|---|---|---|---|
| Venue Wi-Fi slow or down | Medium | LLM and ESCO calls hang on stage | Phone hotspot; a `DEMO_MODE` that serves cached LLM and ESCO responses for the scripted path; run the app locally |
| LLM latency of 5-15 s in a 3-minute pitch | Medium | Dead air | Stream output; pre-compute all but one live call; use a fast model |
| LLM output that is malformed or mistags skills (wrong ESCO concept) | Medium | A visibly wrong tag undermines trust | Schema validation plus retry; the human-confirm step is the feature ("the candidate removes a wrong tag", shown deliberately) |
| ESCO API 500 or slow (as with Ukrainian on the default version) | Low with cache, medium without | Mapping fails | Pin `selectedVersion=v1.2.0`; local JSON cache |
| Voice transcription fails in hall noise or an unsupported language | Medium | The memorable moment fails | Voice optional; pre-recorded clip as input; type as fallback |
| Two-phone mutual-accept needs real-time sync | Low-medium | The suggestion does not appear on the second phone | Polling (simple) instead of websockets; test on venue Wi-Fi Saturday night |
| Judges read the suggestions as "automated profiling" | Medium | Possible disqualification or heavy penalty on 20% plus the L1806 rule | Never show a per-person number; match on needs and topics; mutual opt-in; say it explicitly in the first 30 seconds; get a mentor's view on Friday (L1804) |
| Read as "Brella with an LLM" | Medium | Innovation (35%) score drops | Lead with the upstream need interview and the AI-text-proof evidence; the matching is the least novel part |
| Synthetic data looks obviously fake or homogeneous | Medium | Impact story weakens | Base personas on Espoo's example scenarios (L1800) and the public pool facts (Agent C: many are still learning Finnish) |

Also check: the format of partner judging (live at the table, a video, or both) is **unknown** (00-rules-and-jury.md:L56). Prepare both a live path and a 2-3 minute recorded walkthrough.

## 7. Ask the sponsor on site before committing (Friday evening)

1. **Where is the line on L1806?** Is a *mutually opt-in, explainable topic suggestion* acceptable? Is it acceptable for a company to *see* a candidate's confirmed evidence before the event? Is the rule a hard disqualifier or a judging consideration?
2. **Which event format and stage matters most to them now:** pre-event company intake, event day, or follow-up? Online, in person or hybrid (L1760)? What is the size of a typical TalentMatch event (companies and candidates)?
3. **Example scenarios and user journeys (L1800):** when do we get them, in what format, and may we put derivatives in a public MIT repo (00-rules-and-jury.md:L53)?
4. **What does the city's data processing look like today** (which platform, what data is collected, retention)? Are there any procurement or hosting constraints (EU-only hosting, accessibility requirements) that a "realistic to develop" entry should respect (L1880)?
5. **What metric would convince Espoo's business services** that the pilot worked (company sign-ups, meetings per company, follow-up hires)?
6. **Languages:** which candidate languages dominate their pool (to prioritise in ESCO and STT testing)?
7. **Partner judging format:** is it a live demo at the table, a pitch, or a review of the submission video, and how long?
8. Is a candidate-side LLM interview considered "interacting with AI" that they would want disclosed in a specific way (Article 50, via Agent C)?

## 8. Verdict

Technically this is one of the safest challenges for this team: no hardware, no gated APIs, cheap LLM usage and well-understood stack. The 95% build is very achievable. The ways it fails are design and pitch failures (looking like a profiler, or like Brella), not engineering failures. Spend the saved engineering time on the need-elicitation UX, the fairness evidence and a rehearsed, network-independent demo.

### Sources opened for this report
- CHALLENGES.md:L1744-L1897 (challenge text); L11, L48-L52 (Hostinger credits are scoped to Decode the Noise); L2404 (ElevenLabs via MLH); L2420-L2444 (OpenAI credits)
- `/Users/ciprian/code/Junction 26/docs/challenge-selection/00-rules-and-jury.md` (schedule, submission and testability rules)
- https://esco.ec.europa.eu/en/use-esco/use-esco-services-api/esco-web-service-api
- https://esco.ec.europa.eu/en/use-esco/use-esco-services-api
- https://esco.ec.europa.eu/en/use-esco/download
- https://ec.europa.eu/esco/api/search (live curl tests, 2026-11-13)
- https://tyomarkkinatori.fi/ohjeet-ja-tuki/rajapinnat/tyopaikkailmoitusten-rajapinnat
- https://aistudio.google.com/docs/rate-limits
- https://developers.openai.com/api/docs/guides/speech-to-text
- Agent A and Agent C reports in this folder tree (Brella, Espoo service pages, AI Act articles)

<!-- complete -->
