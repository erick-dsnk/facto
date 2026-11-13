# Rethinking Recruitment (City of Espoo): challenge intelligence

**Summary**
- The City of Espoo wants a prototype that gives companies and jobseekers at its recruitment and matchmaking events (online, in person, hybrid) "stronger signal and less noise", at a time when CVs and job ads are both written and read by AI (CHALLENGES.md:L1752, L1766, L1792).
- Judging: Impact & Relevance 45%, Innovation & UX 35%, Responsible & Feasible Execution 20%. Prizes are €1,500 / €1,000 / €500. The winner also presents to Espoo's business development leaders and the national talent-attraction city network (CHALLENGES.md:L1822, L1870-L1894).
- Hard constraints: no automated profiling or automated decisions about individuals without a human involved, synthetic data only, minimal personal data, and a demonstrated route to EU AI Act compliance (CHALLENGES.md:L1806-L1808, L1828).
- Software only, with no hardware work at all. No sponsor API, dataset or SDK is provided. The ESCO skills API is public and keyless (verified below).
- Estimate: the build is easy for this team. Winning depends on product insight, UX and responsible-AI framing, not on technical depth.

---

## 1. Database record

| Field | Value | Source |
|---|---|---|
| Challenge | Rethinking Recruitment | CHALLENGES.md:L1744 |
| Slug / page | rethinking-recruitment, https://hackjunction.app/participate/45/challenges/319 | CHALLENGES.md:L1746 (when opened, the page rendered only "Junction Platform" with no content, so no extra detail was retrievable) |
| Sponsor | City of Espoo | CHALLENGES.md:L1748 |
| Track | Data Track (section heading at CHALLENGES.md:L1629; the next track heading is FinTech at L2028) | CHALLENGES.md:L1629 |
| Main requirement | "imagine and prototype new ways to help companies and talent find more relevant, efficient and meaningful connections in recruitment and matchmaking events organized by the City of Espoo". It can cover any stage before, during or after an event, or the whole journey | CHALLENGES.md:L1768 |
| Judging emphasis and weights | Impact & Relevance 45%; Innovation & User Experience 35%; Responsible & Feasible Execution 20% | CHALLENGES.md:L1870-L1880 |
| Qualitative judging notes | Improve matching, discovery and communication. Consider privacy, transparency, fairness and inclusion. Avoid unnecessary personal data. Do not rely on automated decision-making about individuals | CHALLENGES.md:L1828 |
| Prize | 1st €1,500 cash plus an "exclusive opportunity to present" to Espoo's business development and innovation leaders and the national network of cities working on talent attraction and retention. 2nd €1,000; 3rd €500. Runners-up get Espoo swag, a feature on the city's channels and "a presentation to the cities of Helsinki and Vantaa" | CHALLENGES.md:L1822-L1824, L1884-L1894 |
| Provided APIs/data | No sponsor API or dataset. Espoo provides SME access, "example scenarios and user journeys based on real matchmaking events", concept feedback and responsible-AI/privacy guidance. Public sources are suggested only as examples: Duunitori, The Hub, Work in Finland, Job Market Finland, Tavata, Brella, ESCO, the National Forum for Skills Anticipation, the Suomi.fi PTV Open API and Business Espoo | CHALLENGES.md:L1796-L1804, L1834-L1858 |
| Provided hardware | None | CHALLENGES.md:L1794-L1858 (no hardware listed) |
| Data rule | "Teams should use synthetic data" | CHALLENGES.md:L1808 |
| Submission requirements | unknown. The challenge text gives no deliverable format (video, repo, live URL). By analogy with other challenges, submission is assumed to go through the Junction platform, where peer review and judging take place (CHALLENGES.md:L820 says this for Arduino). That is an inference, not a stated rule for this challenge | — |
| Mentors / contact | Mentors from Espoo's International Working Life Services and Business Services teams, on site and on Discord. Main contact: Melissa Arni-Hardén, International Working Life Services team lead | CHALLENGES.md:L1814-L1816 |
| Post-event | "open to continuing collaboration beyond the hackathon. A great idea here could be the beginning of a real pilot in Espoo!" | CHALLENGES.md:L1864 |

Text inconsistencies, kept as found: the company blurb says "By participating in Junction 2025" (CHALLENGES.md:L1864), which looks like copy left over from 2025. The prize paragraph calls 2nd place the "second runner up", while the list says "2nd Overall" (CHALLENGES.md:L1822 vs L1888). I read both as €1,000 for 2nd place.

### Verified external context
- **Espoo's existing service:** the city "organizes several TalentMatch recruitment events annually to help employers and international talents find and meet each other". It "provides recruitment services to employers free of charge" and can search "our pool of 18 000 jobseekers". Espoo is part of the national Talent Boost network and offers the Talent Boost Index self-assessment for employers ([espoo.fi/en/we-are-here-support-you](https://www.espoo.fi/en/we-are-here-support-you)). This matches the challenge's point about companies doubting a free public service (CHALLENGES.md:L1774).
- **Espoo recruitment assistance page:** mentions recruitment events and browsing jobseeker profiles on JobMarket Finland ([espoo.fi recruitment assistance](https://www.espoo.fi/en/business-espoo-helping-companies-thrive/recruitment-assistance-0)).
- **ESCO API:** the public search endpoint works without a key. `GET https://ec.europa.eu/esco/api/search?text=python&type=skill&language=en` returned JSON with multilingual `preferredLabel`s (tested with curl on 2026-11-13). Endpoints include `/resource/occupation`, `/resource/skill` and suggest/search, plus a `language` parameter ([ESCO API doc](https://ec.europa.eu/esco/api/doc/esco_api_doc.html)). The default version is v1.0.9, and later versions are selectable via `selectedVersion` ([ESCO web-service API page](https://esco.ec.europa.eu/en/use-esco/use-esco-services-api/esco-web-service-api)).
- **EU AI Act:** Annex III point 4(a) lists as high-risk "AI systems intended to be used for the recruitment or selection of natural persons, in particular to place targeted job advertisements, to analyse and filter job applications, and to evaluate candidates" ([AI Act Service Desk, Annex III](https://ai-act-service-desk.ec.europa.eu/en/ai-act/annex-3)). This is why Espoo bans automated profiling and decisions: a ranking or shortlisting tool would fall in the high-risk category.
- **Incumbent product:** Brella already offers "Intent-based, customizable matchmaking that highlights attendee interests and goals", meeting booking from both parties' preferences, check-ins and organizer dashboards ([brella.io](https://www.brella.io/)). Espoo itself calls current matching platforms "cumbersome" and liable to crash at login peaks (CHALLENGES.md:L1786-L1788).
- **Past winners:** unknown. A web search found no record of a City of Espoo challenge winner at Junction 2025.

## 2. What the sponsor is actually trying to encourage (inference)

My reading is that Espoo wants a **credible, pilotable public-service concept that restores trust in the signal** exchanged at its events. It does not want a smarter ranking algorithm. The evidence:

1. **The problem is framed as information quality and timing, not search.** Companies describe needs "too late, only just before the event day". Candidates cannot articulate their strengths, and CVs "may not provide an accurate picture of either side" (CHALLENGES.md:L1764). The asks are about *eliciting* needs early and *expressing* capability.
2. **The AI-on-AI problem is the headline.** It appears in the question itself and is repeated twice: "machine-generated interpretations rather than genuine understanding" and "synthetic representations rather than genuine capabilities" (CHALLENGES.md:L1752, L1766, L1784). The sponsor wants evidence of real capability, such as work samples, conversations or demonstrated skills, rather than more polished text.
3. **Employer engagement is a business problem for the city.** Companies doubt that a free public service has suitable candidates (CHALLENGES.md:L1774). A solution that makes companies *want* to come (better-defined needs, fewer irrelevant approaches, L1780) helps Espoo's own KPIs.
4. **Humans stay in the loop, by regulation.** The ban on automated profiling and decisions (L1806, L1828) plus the EU AI Act reference (L1808) mean the system should *support* conversations and decisions. It should not make them.
5. **They want a pilot, not a demo.** "Realistic enough to be further developed for real-world use" (L1880), "beginning of a real pilot in Espoo" (L1864), and a prize that is a presentation to decision makers (L1822). Feasibility within a city's procurement, privacy and accessibility constraints matters.
6. **International talent is the core audience.** The main contact leads International Working Life Services (L1816), and L1790 lists language, culture, relocation and compliance. Fairness across nationality, language and career path is named explicitly (L1792).

## 3. Explicit requirements (quoted)

- "Your challenge is to imagine and prototype new ways to help companies and talent find more relevant, efficient and meaningful connections in recruitment and matchmaking events organized by the City of Espoo." (CHALLENGES.md:L1768)
- "The solution can focus on any stage of the journey before, during or after a matchmaking event or address the entire process, registering to, attending and following-up after an event." (CHALLENGES.md:L1768)
- "Solutions should consider how to avoid reinforcing bias or systematically disadvantaging people based on nationality, language, educational background, career path or other characteristics unrelated to the actual opportunity." (CHALLENGES.md:L1792)
- "automated profiling or automated decision-making about individuals without human involvement should not be a part of the solution." (CHALLENGES.md:L1806)
- "Teams should use synthetic data. Solutions should minimise personal data processing and demonstrate how privacy would be protected in a real-world deployment in compliance with the EU AI Act." (CHALLENGES.md:L1808)
- "Teams should consider privacy, transparency, fairness and inclusion when designing their concepts. Solutions should avoid unnecessary personal data processing and should not rely on automated decision-making about individuals." (CHALLENGES.md:L1828)
- "Teams are not expected to use any specific technology, dataset or methodology. The focus should remain on solving the underlying problem rather than implementing a predefined technical solution." (CHALLENGES.md:L1858)

## 4. What a mediocre submission looks like (estimate)

- A CV/job-ad embedding matcher that outputs a ranked candidate list or a "match score" per person. This is a weaker Brella clone, and it probably breaches the no-automated-profiling rule (L1806). Under AI Act Annex III 4(a) it is exactly the high-risk use case.
- "AI rewrites your CV / job ad better". This adds more synthetic text, which is the very problem the brief names (L1784).
- A chatbot wrapper with no event context: it ignores the before/during/after event journey, the late-company-input problem (L1764) and the organizer's view.
- Real scraped LinkedIn or CV data, or a privacy section that is one slide saying "GDPR compliant".
- A polished UI that does not show what changes for the organizer, the company or the candidate on event day (Impact is 45%).

## 5. What an exceptional submission would demonstrate (estimate)

- **One concrete Espoo event journey, end to end.** Use a TalentMatch-style event with synthetic companies and international jobseekers. Show early, structured need-elicitation for companies (for example, a short guided interview that turns a vague need into ESCO-coded skills and real tasks), capability evidence for candidates (micro work samples or a guided skills interview, mapped to ESCO in their own language), and an event-day agenda of suggested conversations that *both humans accept*.
- **Signal over synthetic text.** The prototype privileges verifiable or demonstrated signals (task-based prompts, transferable-skill mapping, structured conversation starters) over AI-polished CVs, and explains why this resists AI-generated materials (L1784).
- **Human-in-the-loop by design.** Recommendations are explainable ("you both mention X"), opt-in on both sides and never rank or reject people. The organizer keeps control. There is an explicit AI Act/GDPR note covering the risk classification reasoning, data minimisation (for example, no nationality, age or photo fields, and data deleted after the event), transparency notices and a bias check across language and nationality on the synthetic data.
- **The organizer's pain is addressed.** Show fewer irrelevant approaches per company (L1780), a lightweight UX that will not crash at a login peak (L1786-L1788), and post-event follow-up.
- **Measurable before/after on synthetic data**, for example the share of suggested meetings that are relevant to a stated need, plus a pilot plan (who runs it, which event, what success metric). The jury PDF also notes that at least one jury member asks "How does this get into a real user's hands, and what happens next?" (00-Jury-profiles-and-pitch-guide.pdf, Umar Noor row).
- Multilingual support (Finnish, Swedish, English and common immigrant languages) as a fairness feature, which the ESCO multilingual labels make cheap.

## 6. Constraints that could disqualify or sink a project

- **Automated profiling or decision-making about individuals without human involvement** "should not be a part of the solution" (CHALLENGES.md:L1806, L1828). Any auto-reject, auto-shortlist or opaque candidate score is the main risk. Whether this is a formal disqualification or only a heavy judging penalty is unknown. Treat it as disqualifying.
- **Real personal data.** "Teams should use synthetic data" (L1808). Scraping real CVs or profiles is risky.
- **No privacy/AI Act story.** The text requires solutions to "demonstrate how privacy would be protected ... in compliance with the EU AI Act" (L1808).
- **Bias** across nationality, language, education or career path (L1792).
- **Off-scope:** a generic job board that is not tied to Espoo's recruitment and matchmaking events (L1768).
- Formal submission rules (deadline, video, repo, live demo): unknown in the challenge text. Check the Junction platform rules.

## 7. Physical hardware work required

**None.** The challenge provides no hardware and requires none (CHALLENGES.md:L1794-L1858). It is a pure software, AI and UX challenge. An optional consumer-device touch is possible, for example a mobile check-in or QR flow on event day, but nothing in the brief asks for it (estimate).

<!-- complete -->
