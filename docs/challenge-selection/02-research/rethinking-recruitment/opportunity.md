# Rethinking Recruitment (City of Espoo): opportunity discovery (Agent C)

## Summary
- Most teams will build a CV-to-job embedding matcher with a score, or an "AI polishes your CV" tool. The first probably breaks the no-automated-profiling rule (CHALLENGES.md:L1806) and the second adds the synthetic text the brief complains about (L1784). The open space is **upstream** (company needs arrive late and vague, L1764, L1776), in **demonstrated capability rather than text** (L1784), and in **matching on needs and topics instead of ranking people**.
- There are five opportunity areas: (1) a company need-elicitation interview that gives the company a useful deliverable; (2) candidate-owned capability evidence built around the companies' real tasks; (3) "needs-first" event-day conversation routing that never ranks people and caps overwhelm; (4) a fairness layer across languages and career paths, with a counterfactual bias test as measurable evidence; (5) post-event follow-up that gives the city proof of its value under strict data minimisation.
- The strongest single entry is estimated to be 1 + 2 + 3 as one journey, with 4 as the evidence slide. Honest stacks: Gemini API or Gemma, ElevenLabs (voice interview), Codex, Aiven (EU Postgres), and possibly Context.dev or Oxylabs (company-side public data only).
- Estimates: differentiation 6/10, demo 7/10, jury fit 6/10. It is cheap to build and the partner prize is reachable, but it is a modest prize. Overall-jury wow depends on a sharp before/after.

**Research note.** The session's shared web-search budget ran out before this task started, so no new search queries were possible. Claims below rely on pages opened directly by URL (listed under each area), on live calls to the ESCO API, and on Agent A's report. Agent B's competitive report for this challenge does not exist (the input was `null`), so claims about what competitors do are limited to Brella's homepage and are otherwise marked unknown or estimate.

## What the sponsor and public sources actually offer (inputs to the gaps)

| Input | What it gives | Source |
|---|---|---|
| Espoo TalentMatch and recruitment service | "several TalentMatch recruitment events annually", free to employers, a pool of "18 000 jobseekers"; "Nearly half" are developing their Finnish; many have academic and international experience | https://www.espoo.fi/en/we-are-here-support-you (opened) |
| How companies submit needs today | No structured intake is described: contact by phone or email; Espoo "tailor[s] recruitment events to meet your specific needs, inviting job seekers who match your hiring profile" | https://www.espoo.fi/en/business-espoo-helping-companies-thrive/recruitment-assistance-0 (opened) |
| Sponsor support | SMEs, example scenarios and user journeys from real events, concept feedback, responsible-AI and privacy guidance; no API or dataset | CHALLENGES.md:L1796-L1804 |
| ESCO API | Public and keyless. Verified 2026-11-13: Finnish skill search `text=ohjelmointi&language=fi` returned 56 skills (for example "ICT-järjestelmän ohjelmointi"); the occupation "software developer" links to 23 essential and 63 optional skills (`hasEssentialSkill`, `hasOptionalSkill`). Note: a Finnish search for the English tech term "kotlin" returned 0, so the multilingual labels do not cover every niche tech term | `https://ec.europa.eu/esco/api/search`, `/resource/occupation` (curl); https://ec.europa.eu/esco/api/doc/esco_api_doc.html (via Agent A) |
| Incumbent event platform | Brella: "Intent-based, customizable matchmaking", "AI-driven approach drives high meeting acceptance rates", meeting ratings and organizer analytics. Its listed segments are associations, corporations, tradeshows, conferences and academic events; recruitment events are not mentioned | https://www.brella.io/ (opened) |
| Job-ad sources | Duunitori, The Hub, Work in Finland, Job Market Finland are listed as examples. Whether any of them has an open API usable at the hackathon is **unknown** (not checked; search budget exhausted) | CHALLENGES.md:L1838-L1843 |

**Regulatory facts that shape the design space (opened):**
- Annex III 4(a) makes recruitment AI that filters applications or evaluates candidates high-risk (via Agent A: https://ai-act-service-desk.ec.europa.eu/en/ai-act/annex-3).
- Article 6(3) lets an Annex III system escape high-risk status if it performs a "narrow procedural task", "improve[s] the result of a previously completed human activity" or does "preparatory" work. **But the exceptions do not apply if the system performs profiling of natural persons** (https://artificialintelligenceact.eu/article/6/). Design consequence (inference): build the AI around *needs, tasks and conversations*, not profiles of people, and the argument for staying out of high-risk becomes defensible. That reframing is a sharper story than "we have a human in the loop".
- Article 14 human oversight asks for the ability to understand limitations, guard against "automation bias", "disregard, override or reverse the output", and a stop procedure. The page states it applies from 2 December 2027 for Annex III systems (https://artificialintelligenceact.eu/article/14/). A real Espoo pilot would therefore land just before that date (estimate), which makes "AI Act-ready by design" a timely pitch.
- Article 50 requires people to be told when they interact with AI, and AI-generated text to be marked; the page says it applies from 2 August 2026 (https://artificialintelligenceact.eu/article/50/). Any chatbot or voice interview must disclose itself.

---

## Opportunity 1: fix the input, not the matcher (company need-elicitation)

**Gap.** The brief says companies "do not always know how to describe their talent or service needs" and send them "too late, only just before the event day" (CHALLENGES.md:L1764, L1776). Espoo's public page offers only a phone number and an email for employers (recruitment-assistance page above). Brella's model is "intent-based" matchmaking (brella.io), which assumes attendees can already state intents. No tool found addresses the step *before* intent exists: turning "we need a developer" into concrete first-90-day tasks, must-have versus learnable skills and an honest description of the language requirement. (Whether a competitor product does this is unknown; Agent B's report is missing.)

**Directions (not finished ideas).**
- A short guided interview, by chat or voice, for the hiring manager that produces a structured "need brief": real tasks, ESCO-coded skills split into essential and trainable, the Finnish level actually needed, and what a good first conversation would cover. Estimate: 5-10 minutes per company.
- Challenge the need: ESCO shows that an occupation has 23 essential skills and 63 optional ones (verified above). The interview could flag over-specified requirements ("is Finnish really required for this role?"), a direct lever on the bias concern in L1792.
- Nudges with deadlines (weeks before the event) and a progress view for the organizer.

**Why Espoo would care (inference).** It attacks two named pains at once: late or vague needs (L1764) and company engagement. Companies doubt a free public service (L1774), and a crisp role brief they can reuse in their own job ad is an immediate, tangible return for showing up. Profiling a *company's need* is not profiling a natural person, so this step sits outside the riskiest part of the AI Act (inference from Article 6(3) above).

**How the overall jury reads it (estimate).** It is a clear user (an SME hiring manager), the before/after is legible (a vague one-line need becomes a structured brief), and it is quick to understand. On its own it may look like "a form with an LLM"; it gets stronger when the brief visibly drives areas 2 and 3.

## Opportunity 2: capability evidence that AI text cannot fake (candidate side)

**Gap.** The brief's headline is that both sides now interact through "machine-generated interpretations" and "synthetic representations rather than genuine capabilities" (L1766, L1784), and that professionals struggle to express transferable skills (L1782). Polished CVs are the problem, so another CV generator makes it worse. The gap is a lightweight, candidate-owned signal grounded in *the companies' own tasks*: the candidate answers a few scenario prompts drawn from the area-1 need briefs, ideally by voice and in their own language, and keeps control of what is shared.

**Directions.**
- Task-anchored prompts ("a customer escalates X, walk us through it") generated from the company briefs, answered by voice or text, then summarised into the *candidate's own words* with ESCO skill tags the candidate confirms or removes.
- Transferable-skill translation: map a career path from another country or sector to ESCO skills in the candidate's language. ESCO search returned Finnish labels (verified), and English-to-other-language label lookup is built in (ESCO `language` parameter, via Agent A).
- Keep it evidence, not assessment: no score, no pass/fail, no ranking. A human (the company rep or the organizer) reads it. AI output is marked as AI-assisted (Article 50).

**Why Espoo would care (inference).** It answers the AI-on-AI problem directly, it helps the "nearly half" of the pool who are still developing Finnish (espoo.fi page), and the main contact leads International Working Life Services (L1816).

**Risk.** Anything that *evaluates* candidates falls under Annex III 4(a). The design must keep the system preparatory and candidate-controlled, and the pitch must say so plainly. Mentors offer responsible-AI guidance (L1804); use it early on Friday.

**How the overall jury reads it (estimate).** It is distinctive. "We match on what you can do, not on what ChatGPT wrote for you" is a one-line insight peers understand instantly, and a live voice answer in a non-English language is memorable.

## Opportunity 3: needs-first event-day routing that never ranks people

**Gap.** Companies are "overwhelmed by large volumes of largely irrelevant candidate approaches" (L1780). Matching platforms are "cumbersome" and "may crash" at login peaks (L1786-L1788). The obvious fix, a ranked candidate list per company, is what the brief forbids (L1806). The open direction is to match people to *topics and needs* rather than ranking people for companies: each company publishes its need briefs as conversation topics, candidates opt in to the topics where their confirmed evidence fits, both sides accept a slot, and each company sets a capacity so it is never flooded.

**Directions.**
- Mutual opt-in with an explanation of every suggestion ("you both mention customer escalations in logistics"), shown symmetrically to both sides. No hidden score.
- Capacity limits and a fair-rotation rule set by the organizer, which is a human control in the Article 14 sense (override and stop).
- A no-login, link or QR based, offline-tolerant mobile web flow, which speaks to the crash complaint (L1788). Estimate: a static-first PWA plus a small queue avoids the login stampede.
- Hybrid support (online, in person, hybrid formats per L1760).

**Why Espoo would care (inference).** Fewer irrelevant approaches per company is the most direct "signal over noise" measure (L1792), and it is something an organizer can pilot at one TalentMatch event.

**How the overall jury reads it (estimate).** It is the most demo-able part: two phones on the table, a company and a candidate, a suggestion appears with its reason and both tap accept. On its own it resembles Brella; the novelty comes from areas 1 and 2 feeding it.

## Opportunity 4: fairness as a measured feature (language, nationality, career path)

**Gap.** The brief asks teams to avoid disadvantaging people by nationality, language, education or career path (L1792), and the judging asks for fairness and inclusion (L1828). Most hackathon entries handle this with a slide. A gap exists for a *visible, measurable* fairness check on synthetic data: generate synthetic candidate twins that differ only in name, nationality, language of answer or non-linear career path, run them through the suggestion pipeline, and show whether suggestions change.

**Directions.**
- A counterfactual swap test with a single number (for example, the share of suggestions that stay the same under the swap) shown on an organizer page.
- Requirement auditing: flag company needs where a language or degree requirement is not supported by the tasks (connects to area 1).
- Synthetic data is required anyway (L1808), so the synthetic population generator does double duty as the test harness.

**Why Espoo would care (inference).** A public body must be able to show it treats international jobseekers equally. A test it can rerun before each event is a concrete governance artefact for a pilot.

**How the overall jury reads it (estimate).** It maps directly to the jury rubric's "honest measured evidence" (15%, a metric that cannot be gamed) in 00-rules-and-jury.md. It is a supporting slide, not a headline; on its own it is not a product.

## Opportunity 5: after the event, proof of value with minimal data

**Gap.** The city's business problem is that companies question the quality of a free public service (L1774), yet the brief describes no follow-up mechanism. The journey explicitly includes "following-up after an event" (L1768). A gap exists for structured follow-up (did the conversation lead to a next step?) that produces aggregate, privacy-minimised proof for the city ("12 of 15 company needs got at least one relevant conversation") while deleting individual data after a fixed period.

**Directions.**
- One-tap follow-up for both sides, with consent and a retention timer that is visible in the UI.
- Aggregate reports for Espoo's business services, plus a demand signal of the skills companies asked for, which ties to the National Forum for Skills Anticipation listed in the resources (L1853). Estimate.
- A data-protection design note: which fields are never collected (photo, age, nationality as a field), where data lives (EU region), and deletion.

**Why Espoo would care (inference).** It turns the prize presentation to business development leaders and the national city network (L1822) into a pitch with metrics. The prize itself rewards something the city can reuse across cities.

**How the overall jury reads it (estimate).** It is weak as a demo but strong for "credible path forward" (15%): a named first user (the Espoo TalentMatch organiser), a reason to return (the next event), and a bounded scale step (other Talent Boost cities). Keep it to one screen.

---

## Combinations that are newly practical (estimate)
- **Multilingual voice interview + ESCO normalisation.** Speech-to-text and LLM summarisation in many languages, then grounding on ESCO's multilingual taxonomy, make it cheap to capture capability in a candidate's own language and present it in the recruiter's language. Before 2023-era LLMs this needed human interpreters or rigid forms.
- **LLM-generated scenario prompts from a company brief.** Turning a free-text need into role-specific scenario questions on the fly is new, and it is what makes area 2 possible without a question bank.
- **Synthetic population generation for fairness tests.** LLMs can now generate realistic, diverse synthetic profiles quickly, which the synthetic-data rule (L1808) needs anyway.

## Live-demo before/after (estimate)
Show the same synthetic event twice. **Before:** a company receives 40 AI-polished CVs that all look alike, and its rep cannot tell them apart. **After:** the company completes a 3-minute need interview, a candidate answers one scenario by voice in Ukrainian or Arabic, and both phones receive a mutually explained suggestion; a counter shows irrelevant approaches per company falling and the fairness swap metric staying stable. It is readable in under 60 seconds if rehearsed.

## Stackable tech challenges (honest assessment)

| Tech challenge | Fit | Note |
|---|---|---|
| Best Use of Gemini API | Good | The interview, summarisation and scenario generation need an LLM anyway. Must include the four-point written explanation; all members 18+ (_tech-challenges.md, L2490-L2518 there). |
| Best Use of Gemma | Good, and adds to the story | Self-hosted open weights are a credible data-residency argument for a public body (estimate). Can be hosted on Modal or Verda. Whether Gemini and Gemma can both be entered is unknown. |
| Best Use of ElevenLabs | Good if voice is used | Multilingual voice interview or read-back. Criteria unknown. |
| Best Use of Codex | Good | Development-process stack; low effort. |
| Best Use of Aiven | Good | EU-hosted managed Postgres with a deletion and retention story; criteria weight "meaningful use" 40%. |
| Context.dev or Oxylabs | Possible, company side only | Enrich a company's need brief from its public website or open job ads (not personal data). Must visibly drive the demo; Oxylabs needs a paid-plan setup and cancellation. Pick one at most. |
| Modal or Verda | Weak to medium | Only if Gemma is self-hosted; the workload is not compute-heavy. |
| MongoDB Atlas, Tiger Data, Vultr, Cloudinary | Weak | Possible but would not add to the story; one database is enough. |
| Solana, Arduino, Atech, Nemotron, CRACI, Entire | Not a natural fit | Hardware or on-chain stacks would be forced; skip. |

## Estimates
- **Differentiation potential: 6/10 (estimate).** The obvious entries (matcher with scores, CV rewriter) are weak and partly off-rule, so a needs-first, evidence-not-text design stands out within the challenge. The ceiling is limited because the domain is familiar to the overall jury and the problem is organisational more than technical (Agent A rates technical difficulty 3).
- **Demo potential: 7/10 (estimate).** Two-phone mutual-accept and a multilingual voice answer are live and legible, with a clean before/after. It loses points because it is a web app without a physical wow factor and part of the value (follow-up, governance) does not show on stage.
- **Jury fit: 6/10 (estimate).** It is good on "specific user" (an Espoo organiser and an international jobseeker), "path forward" (a stated pilot invitation, L1864, and a presentation prize, L1822) and "measured evidence" (fairness swap, irrelevant-approach reduction). It is weaker on "distinctive technical depth" (20%) unless the fairness harness or the Gemma data-residency story is substantial. The partner prize is small (€1,500, L1822), but the field is probably less crowded than headline challenges (estimate; the number of competing teams is unknown).

<!-- complete -->
