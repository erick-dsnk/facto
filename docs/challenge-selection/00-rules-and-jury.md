# 00: Judging mechanism, rules and jury digest

**Summary**
- There are three separate award routes ([2026.hackjunction.com](https://2026.hackjunction.com/), Judging and FAQ sections). (1) Each Challenge Partner picks its own track winners against its own criteria. (2) Face-to-face peer review selects the overall top 5. (3) The top 5 pitch live and a seven-person grand jury picks the overall winner. The official text does not say that a challenge win is needed to reach the top 5.
- Key schedule points: final submissions close **Sunday 15 Nov at 10:00**, "Review time" starts at 10:30, and the Final Ceremony is at 14:00. It runs top-5 pitches, then challenge winners at 15:10 and the Junction winner at 15:50. Teams are **up to 4 people**. Submissions are open-sourced under MIT.
- The rule for entering one project in several *main* challenges is **unknown**. Tech challenges are explicitly stackable: "any team can take them on alongside their track."
- The panel rewards five things: a worthwhile problem for a named user, one distinctive insight shown against a baseline, a working end-to-end demo, honest measured evidence including failures, and a credible next step. Feature breadth and generic "vibe-coded" builds are explicitly discounted.
- Two jurors also sponsor or judge challenges: Daksh (AfterQuery, *Break the Agent*) and Beer (Context.dev, main challenge and tech challenge). Several others are linked to sponsors. This is relevant when picking a challenge.

---

## 1. How each award is decided (official)

| Award | Decided by | Source |
|---|---|---|
| Challenge (track) prizes | Each Challenge Partner "chooses their own track winners against their own criteria" | [2026.hackjunction.com](https://2026.hackjunction.com/) Judging section and FAQ "How is the Junction 2026 winner chosen?" |
| Overall top 5 (finalists) | "face-to-face peer review to select the top 5 projects" | same |
| Overall winner | "The top 5 pitch in front of a live audience, and a grand jury chooses the overall winner"; "Seven main judges choose the overall winner" | same |
| Tech challenges (Best Use of X) | Tech partners. "Companies provide credits to their platforms, and some of them award prizes to the best use cases of their technologies. Tech challenges run across every track, so any team can take them on alongside their track." | same, Challenge Tracks section |
| General | "Winners are selected at Junction's (or its appointed jury's) sole discretion, and decisions are final." | hackjunction.com Terms §5.5 (in the site bundle at [hackjunction.com/terms-of-service](https://www.hackjunction.com/terms-of-service)) |

The Terms (§8.7) give generic criteria that challenge-specific rubrics "typically consider": relevance to the brief, novelty/creativity, technical quality, user experience, completeness/demo-ability, and feasibility/impact. Under the Terms, Junction, the jury and partners "may run, access, and interact with your Submission in a test environment you provide", including binaries, demo endpoints and demo credentials.

Partner rubrics vary widely and sometimes change the process. Examples:
- Spread: only the top 10 by leaderboard margin present to its jury (CHALLENGES.md:L383).
- Break the Agent: 10-minute demo, then judges rerun the harness and spend 15 minutes hunting exploits (CHALLENGES.md:L451, L475).
- Aaltonomous Humanoid: simulation finals, then a real-robot run on Sunday (CHALLENGES.md:L1180).
- Green European Renaissance: also requires an Arduino Project Hub post (CHALLENGES.md:L820).

Each challenge's own file must preserve these.

The total prize pool is "€100,000 in prizes … Full prize breakdown coming soon" ([2026.hackjunction.com](https://2026.hackjunction.com/)). The **overall-winner prize amount is unknown**. The site says only that Google DeepMind has "Something special … planned for the winning teams."

## 2. Schedule, submission and demo requirements

**Official 2026 schedule** ([2026.hackjunction.com](https://2026.hackjunction.com/), "Preliminary schedule. Times may still shift"):

| When | What |
|---|---|
| Fri 13 Nov 19:30 | Hacking starts |
| Fri 23:59 | **Preliminary submission** |
| Sat 14 Nov 12:00 | Submissions open on the Junction Platform |
| Sun 15 Nov 10:00 | **Final submissions** |
| Sun 10:30 | Review time (peer review and partner judging, inferred from the 2024 pattern) |
| Sun 14:00 | Final Ceremony: Arduino and Verda keynotes, **top 5 pitches**, challenge winners at 15:10, Junction winner at 15:50 |

Fri 19:30 to Sun 10:00 is about **38.5 hours of build time**. Partner judging can be earlier: Spread's final is Sunday 08:00 (CHALLENGES.md:L381).

**Official 2026 rules found:**
- Team size is "up to 4 people" (site FAQ). Terms §8.3: "A participant may belong to only one team per challenge."
- Fair play (Terms §8.2): projects "must be built primarily during the Event". Pre-existing code, datasets or frameworks are allowed "only if clearly identified in your Submission".
- Submission (Terms §8.6): submit by the deadline on the designated platform, with no guarantee for late entries. "Teams are responsible for ensuring their project can be demonstrated in the format specified (e.g., live demo, video) and that any materials required for evaluation (e.g., readme, dependencies, limited demo credentials) are included."
- IP: "Submissions are open-sourced under the MIT licence" with the team credited (site FAQ). This matters if we want to keep anything proprietary.
- Arduino challenge text: "the Junction platform, where peer review and judging take place" (CHALLENGES.md:L820).

**Not found for 2026 (unknown):** the required fields of the submission form, video length, pitch length for the top 5, whether a demo must be live or can be recorded, and whether the repo must be public. The Junction Platform ([hackjunction.app](https://hackjunction.app/participate/45/challenges)) needs a login and could not be read.

**2024 precedent** (from the [Junction 2024 guidebook](https://junctionhq.notion.site/Reviewing-fff59a118137812eb17fdf07e797aed7), "Project Submission", "Pitching" and "Junction Rules" pages; *not* 2026 rules):
- The form asked for banner images, a name, punchline and description, **"challenge"** (a single field), technologies used, a **3-minute video pitch** (the rules page said 2 minutes, which contradicts it) or a pptx deck, demo and source links, and a table number.
- Draft projects were not reviewed.
- Finalist pitches were **exactly 3 minutes with the mics cut** afterwards. Everything, including demos, had to be inside the submitted pptx, not shown from the team's own laptop.
- Team size was 1–5, and teams had to "participate in at least one challenge".

## 3. Peer review: known vs unknown

**Known (2026 official):** it is "face-to-face", it selects the top 5, and it runs on the Junction Platform ([2026.hackjunction.com](https://2026.hackjunction.com/); CHALLENGES.md:L820). A "Review time" block starts at Sun 10:30.

**2024 precedent** ([Junction 2024 guidebook, Reviewing](https://junctionhq.notion.site/Reviewing-fff59a118137812eb17fdf07e797aed7)):
- Partner and peer review ran in parallel after submission.
- Each participant was asked to review **at least 15 projects**, and Junction could apply "a small penalty to your team's score" if a team did not review.
- It used a modified **Gavel** pairwise-comparison algorithm. Each reviewer judges whether a project is better or worse than the previous one, and votes cannot be taken back.
- Face-to-face review by walking to table numbers was an "Offline Bonus".
- In 2024 there were top 10 finalists and hackers voted for the winner. In 2026 there are top 5 and a grand jury ([Wikipedia](https://en.wikipedia.org/wiki/Junction_(hackathon)) also notes the history of peer review since 2018).

**Unknown for 2026:** whether Gavel or pairwise comparison is still used, the minimum number of reviews, any non-review penalty, whether projects are compared across all challenges or within tracks, how many minutes each visit lasts, and whether there is any jury or partner input into the top 5.

**Implication (estimate):** with roughly 2,000 builders ([site](https://2026.hackjunction.com/)), a reviewer probably sees each project for a few minutes in a head-to-head comparison. A project must be understood in **about 60–90 seconds at the table**, and a visible "wow" moment matters more here than in partner judging. A project that is hard to explain at a table may win its challenge but miss the top 5. Someone must staff the table during review.

## 4. Can one project enter several challenges?

- **Tech challenges: yes, explicitly.** "Tech challenges run across every track, so any team can take them on alongside their track" ([site](https://2026.hackjunction.com/)). Several individual briefs confirm it:
  - Verda: "Pick any challenge at Junction" (CHALLENGES.md:L2136).
  - Nemotron: "Applies to: Any track" (CHALLENGES.md:L2596).
  - Arduino: "teams working on any challenge" (CHALLENGES.md:L2707).
  - CRACI: "even a project made mainly for another challenge" (CHALLENGES.md:L2974).
- **Multiple main challenges: unknown.** The Terms say only that a participant may belong to one team *per challenge*. The 2024 form had a single "challenge" field, which suggests one main challenge. Ask organisers or check the platform form on site.

## 5. The seven grand-jury members

Sources are the official jury bios on [2026.hackjunction.com](https://2026.hackjunction.com/) (Judges section) and the jury PDF (`docs/00-Jury-profiles-and-pitch-guide.pdf`, cited as PDF p.N). In the PDF, the lenses for Kia, Daksh, Otto, Beer and Arturs come from explicit statements in their official bios. The lenses for Timo and Umar are *inferred from their careers*, because their official bios contain no judging statement (PDF p.4).

| Juror | Role (official) | What they say they look for (official bio, quoted) | Rehearsal question (PDF p.3–4) | Best evidence to prepare (PDF p.3–4) | Sponsor link (CHALLENGES.md) |
|---|---|---|---|---|---|
| **Kia Kanninen** | CEO, Founders House Helsinki; previously reviewed 1,000+ startups for Slush | "anyone can vibe code almost anything… teams that start from a problem worth solving, not just a feature that's easy to build" | Why is this worth building, and who cares enough to use it? | Concrete user/problem evidence, a consequential wedge, a believable next user | none found |
| **Daksh Raghuvanshi** | RL Lead, AfterQuery; lead author of StoreBench | "teams that can explain exactly why an agent fails in their world, and whose reward holds when someone tries to break it" | Does this beat a simple baseline, and can your metric be gamed? | Baseline comparison, held-out cases, explicit success criteria, an adversarial/failure example | AfterQuery mentor for *Break the Agent* (L413, L493, spelled "Raghuwanshi") |
| **Otto Söderlund** | AI Lead, Supercell; co-founded Speechly (YC, acquired by Roblox) | "start from a real user problem and ship something people want to come back to" | Why will anyone use this again after the impressive first demo? | Recurring trigger, interaction quality, observed use rather than hypothetical retention | none found |
| **Timo Ahopelto** | Managing Partner, Lifeline Ventures; founding CEO of CRF Health (unicorn); former Slush chair | No judging statement in bio. *Inferred:* globally differentiated tech, from insight to company | What is the distinctive insight, and how could it matter beyond this weekend? | Focused initial use case, credible advantage, specific path to larger impact | Lifeline backs Stoa (*Make Blueprints Talk*, L1581). Indirect only |
| **Umar Noor** | Developer Experience / GTM, Google DeepMind | No judging statement. Bio: "helping developers and founders go from first prototype to real world impact using AI" | How does this get into a real user's hands, and what happens next? | Short onboarding, identifiable first audience, integration/adoption plan | DeepMind runs *Best Use of Gemini API* and *Gemma* (L2474, L2550) and is the "special" winners' partner |
| **Hubertus "Beer" van der Drift** | CTO, Context.dev (YC S26); built a festival app used by 200k+ people | "teams that move fast, stay pragmatic, and have a knack for finding that one unique insight that solves a problem 10x faster or better" | What did you figure out that makes this materially better than the obvious approach? | The technical decision, a side-by-side result, simple end-to-end execution | Context.dev main contact for *The Web Is Your Real-Time Database* (L1683) and "challenge lead and lead judge" for *Best Use of Context.dev* (L2859) |
| **Arturs Polis** | CTO, Verda | "teams willing to tackle the hardest challenges and build prototypes with a clear path to production and scale" | Which hard constraint did you solve, and where will the system break next? | Useful completion rate, bottleneck measurement, failure handling, bounded scale plan | Verda runs the *AI Infrastructure Track* (L1561) and the *Verda Compute Track* tech challenge (L2116) |

**Sponsor links (inference):** two jurors (Daksh, Beer) personally judge or mentor partner challenges, and three more (Arturs, Umar, Timo) are linked to sponsors. Entering one of those challenges does not guarantee jury favour, and the PDF warns against predicting votes (PDF p.7). It does mean that some jurors will already know the brief and what good looks like. It also means jurors with deep expertise in the problem will look hard at its claims. Whether jurors recuse themselves is unknown.

## 6. What the panel rewards (PDF synthesis, labelled as inference)

The PDF says these are "our synthesis of the public evidence. They are not five official equally weighted judging categories" (PDF p.1):

1. **Specific value:** a named user, a meaningful problem or experience, and a way to check that it helps.
2. **A visible improvement:** one understandable before/after shown quickly.
3. **A defensible insight:** a concrete difference from the obvious solution, with a baseline.
4. **Evidence under realistic conditions:** representative inputs, failure cases and a complete working path. AI complexity must earn its place.
5. **A plausible continuation:** the next user, why they return, and what must change for deployment.

Findings from the PDF (p.3):
- Speed is common, so it should go into proof, not feature lists.
- Paying customers or enthusiasm are not the same as actual use (Otto, Beer).
- A better average can hide a lower pass rate. Show the frequency of failures (Daksh's StoreBench update). Do not quote the bio's "no frontier model matched" claim as current.
- Measure the cost, time and quality of one completed task, not model price (Beer, Arturs).
- Ambition should be shown through a narrow but consequential working slice (Kia, Timo, Arturs).

The PDF groups the jurors into overlaps: user value (Kia, Otto, Umar), credible technical progress (Daksh, Beer, Arturs), and a path forward (Timo, Kia, Arturs). It says these are not voting blocs (PDF p.4). Games, creative tools, hardware or infrastructure can all qualify (PDF p.5).

**Pitch template (PDF p.5–6; timing is not an event rule):** user and problem (0–20s), insight (20–35s), one complete demo (35–95s), baseline and result plus one limit (95–120s), hardest decision (120–145s), next user (145–165s), next step (165–180s). The PDF warns: "Do not fill the placeholders with invented user interviews, retention, savings or test results."

## 7. Overall-winner appeal rubric (for later agents)

Score each challenge–idea pair from 0 to 5 on each criterion and multiply by the weight. The weights are **our estimate**, derived from sections 3, 5 and 6.

| # | Criterion | Weight | What a 5 looks like | Jurors it serves |
|---|---|---|---|---|
| 1 | **Worthwhile problem, specific user** | 20% | A named user with a real, recurring problem or experience. Value can be checked during the event | Kia, Otto, Umar, Timo |
| 2 | **Distinctive insight and technical depth** | 20% | One non-obvious mechanism that beats the obvious approach "10x". Solves a genuinely hard constraint | Beer, Timo, Arturs, Daksh |
| 3 | **Working end-to-end demo** | 15% | Real input, action and useful result, live and reliable within 60–90s, with no faked steps | All (Terms §8.6–8.7) |
| 4 | **Honest, measured evidence** | 15% | Baseline comparison, held-out or failure cases, a metric that cannot easily be gamed | Daksh, Arturs, Beer |
| 5 | **Peer-floor legibility and wow** | 15% | A stranger "gets it" at the table in under a minute and remembers it. The demo has a visible moment | Peer review gate (section 3) |
| 6 | **Credible path forward** | 15% | A clear next user or pilot, a reason they return, and a bounded production/scale step without a fabricated TAM | Kia, Otto, Umar, Timo, Arturs |

**Reasons for the weights:**
- Criteria 1 and 2 are the two qualities stated most often across the official bios (5 of 7 jurors state a judging lens, and every lens is a form of either "real problem" or "distinctive/hard insight"), so they get the top weight.
- The demo (3) and evidence (4) are what make 1 and 2 believable to this panel. They are weighted slightly lower because they depend on execution rather than on choosing the challenge.
- Criterion 5 exists because **the jury only sees the top 5**. A project that is excellent but hard to grasp never reaches the jury, so peer legibility is a gate, not just a jury preference.
- Criterion 6 reflects the investor and operator half of the panel (Kia, Timo, Umar, Otto). It is capped at 15% because the PDF warns that market-size claims "add little proof".
- Tie-break: if criterion 5 or 3 scores 1 or lower, treat the overall chance as near zero, whatever the total.

**Combining with partner prizes (guidance):** a challenge whose own rubric already rewards criteria 1–4 lets one build serve both the partner and the jury. An example is Cala's Real need, Execution, Originality and Use of Cala at 25% each (CHALLENGES.md:L287). Leaderboard-only or hardware-run rubrics (Spread, Aaltonomous) may diverge from what the jury rewards. Score that divergence explicitly.

## 8. Official vs inferred

- **Official (site, Terms, CHALLENGES.md):** the three-stage mechanism, top 5, seven jurors and their bios, the schedule, team size of up to 4, MIT open-sourcing, fair play and pre-existing code disclosure, testability of submissions, tech challenges stackable across tracks, and per-challenge partner rubrics.
- **Precedent only (2024 guidebook):** Gavel pairwise review, 15-review minimum and penalty, 3-minute strict pitch with mic cut, slides-only stage pitch, single "challenge" form field.
- **Inferred (PDF or this report):** the lenses of Timo and Umar, the five shared qualities, the pitch template, the juror overlaps, the sponsor-link implications, and the rubric weights.

## 9. Open unknowns (ask organisers or check the platform on site)

1. Can one project enter more than one *main* challenge?
2. The 2026 peer-review mechanics: algorithm, review quota, penalty, and whether it spans all tracks.
3. Top-5 pitch length and format (live demo or slides only?), and the required video length.
4. The overall-winner prize and the DeepMind "special" offer.
5. Whether jurors with sponsor ties recuse themselves when a related project reaches the top 5.
6. The exact meaning of the "Preliminary submission" at Fri 23:59 (likely a draft registration).

<!-- complete -->
