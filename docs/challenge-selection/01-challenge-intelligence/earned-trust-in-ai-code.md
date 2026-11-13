# Earned Trust in AI Code (Tieto): challenge intelligence

**Summary**
- Tieto asks for an **AI code review concept** plus a small reference implementation, which must answer "how can AI review AI-written code so that a named human can trust it and stay accountable?" (CHALLENGES.md:L124, L151). It is explicitly "not a product" (CHALLENGES.md:L126, L159).
- Judging gives no separate weight to technical depth: Clarity 30%, Practicality 25%, Measurement 25%, Evidence 20% (CHALLENGES.md:L241-255). The text says it puts "more weight for the concept than only the technical implementation" (CHALLENGES.md:L151). Prizes are €2,000 / €1,000 / €500 (CHALLENGES.md:L259-269).
- Inputs are a public C# repo (a MessagePack-CSharp fork) with four agent-written branches that range from 4 to 237 files. Tieto will also bring a requirements set and coding standards on site (CHALLENGES.md:L141-149, L225-227).
- No hardware is involved. The challenge is a strong fit for our agent and full-stack skills. The risk is that many teams build "an LLM that comments on a PR". The differentiator is evidence traced to requirements, explicit abstentions and a trust measurement loop.

---

## 1. Database record

| Field | Value | Source |
|---|---|---|
| Challenge | Earned Trust in AI Code | CHALLENGES.md:L101 |
| Original page | https://hackjunction.app/participate/45/challenges/351. It rendered empty when fetched without login (only "Junction Platform"), so the transcription is the only source | CHALLENGES.md:L103 |
| Sponsor | Tieto (https://www.tieto.com/) | CHALLENGES.md:L105, L235-237 |
| Track | Agentic AI Track (main challenge) | CHALLENGES.md:L7-9 |
| Main requirement | "Design an **AI code review concept**, then show it works. Define the concept, principles, reference implementation and technology considerations, across frontend, backend and security." | CHALLENGES.md:L124 |
| Judging emphasis and weights | Clarity 30%, Practicality 25%, Measurement 25%, Evidence 20% | CHALLENGES.md:L241-255 |
| Extra weighting statement | "in our evaluation we put more weight for the concept than only the technical implementation" | CHALLENGES.md:L151 |
| Prize | 1st €2,000 cash; 2nd €1,000 cash; 3rd €500 cash | CHALLENGES.md:L259-269 |
| Provided code | Repo `te-industry-tech-office/junction26-messagepack-csharp` (teams must copy it) with branches `ju26-issue-2283` (4 files), `ju26-issue-2234` (4), `ju26-issue-2129` (28), `ju26-issue-2297` (237) | CHALLENGES.md:L141-149; verified via GitHub API (see §1a) |
| Provided on site | "Background on what good code means at Tieto: standards, security and quality"; "A requirements set: intent, functional and non-functional"; "Sample agent-written changes, each with its requirement ID". The contents are unknown until the event | CHALLENGES.md:L225-227 |
| Models | "partner credits on the Junction Platform"; any partner model may be connected. Which models and how many credits: unknown | CHALLENGES.md:L231 |
| Hardware | None | (no hardware mentioned in L101-269) |
| Deliverables | Concept card (recommendation, principles, trade-offs, limits); live walkthrough showing where trust comes from; lessons log; demo video or presentation | CHALLENGES.md:L155-157 |
| Platform submission mechanics (form fields, repo link, video length, deadline) | unknown. Not stated in the challenge text. Other challenges mention submitting "on the Junction platform, where peer review and judging take place" (CHALLENGES.md:L820) | — |
| Licence / IP terms | unknown. The repo's GitHub licence field reads NOASSERTION; upstream MessagePack-CSharp is MIT-licensed (estimate, not verified here) | GitHub API |
| Data rule | "Use synthetic or cleared sample data only." | CHALLENGES.md:L137 |
| Out of scope | "a finished product, model training and vendor selection" | CHALLENGES.md:L159 |

### 1a. What the sample repo actually contains (checked 13 Nov 2026 via `gh api`)
- The repo was created 2026-11-11. Its default branch is `dependabot/nuget/develop/PolySharp-1.15.0`, and each `ju26-*` branch is one agent commit on top of it. Compared with `master`, every branch also carries the unrelated PolySharp bump. That is a trap, or an opportunity, for scope checks: a reviewer should flag "change not traceable to the requirement".
- Diff sizes against the default branch:
  - #2283: 4 files, +225/−3
  - #2234: 4 files, +262/−4
  - #2129: 28 files, +1034/−9
  - #2297: 237 files, +1383/−9, mostly generated `.tt` and `.cs` templates
- The upstream issues are all open:
  - [#2283](https://github.com/MessagePack-CSharp/MessagePack-CSharp/issues/2283): generator and analyzer crash with `IndexOutOfRangeException` on a closed generic struct from a referenced assembly. The reporter points at `TypeCollector.GetObjectInfo` indexing `DeclaringSyntaxReferences[0]`, and the expected behaviour is a clean build with a generated resolver. This is the clearest "requirement → evidence" sample.
  - [#2234](https://github.com/MessagePack-CSharp/MessagePack-CSharp/issues/2234): the analyzer does not work when `SuppressSourceGeneration = true`.
  - [#2129](https://github.com/MessagePack-CSharp/MessagePack-CSharp/issues/2129): a feature request to generate formatters for a type in a referenced assembly.
  - [#2297](https://github.com/MessagePack-CSharp/MessagePack-CSharp/issues/2297): add `ExcludeFromCodeCoverage` to generated code. This one is big but mechanical, which makes it ideal for showing low-risk bulk changes being routed to light review.
- Estimate: the four branches span risk tiers (small bug fix, analyzer fix, feature, mass mechanical change). That looks deliberate, so that teams can show risk-based routing.

## 2. What the sponsor is actually trying to encourage

**Reading:** Tieto, an IT services company that ships code for clients, wants a **governance model for AI-written PRs** that it could defend to clients and auditors. The model should keep a named human accountable, cut review time and **measure whether trust is deserved**. They are scouting ideas and talent, not a tool. Evidence:
- "Humans stay accountable for every change" is the headline question (CHALLENGES.md:L109). The insight section repeats it: "AI reviews. Humans stay accountable." (L165), and "The AI review is advice with evidence, never the approval itself." (L173).
- They spell out what the owner signs: what was checked and by whom, what was not checked and why, and the residual risk accepted (L185-189). They reject "The AI said it was fine." and "a risk score nobody can explain" (L193-195). This is audit-trail language.
- The question "is line-by-line review still the right way to ensure quality?" (L126) invites a reframe, roughly "review a story, not a diff" (L113).
- Measurement carries 25%, and its criterion names concrete metrics: reverts/incidents not rising as review time falls, AI findings real and accepted, time to merge, share routed to humans (L251). Tieto wants a trust **feedback loop**, consistent with "Trust is earned per area, from track record, and withdrawn after escapes." (L181)
- "Out of scope: … model training and vendor selection" (L159) and "not a product" (L126) both say they do not want a polished CodeRabbit clone.
- Industry context supports this reading. Meta's RADAR paper (arXiv:2605.30208, opened) reports risk-aware layered auto-review across more than 535K diffs, with lower revert and incident rates for RADAR-reviewed diffs. The challenge's "What major vendors recommend" list (L199-203) mirrors exactly that pattern. A team that cites and positions against RADAR shows domain literacy (estimate of judging effect).

## 3. Explicit requirements (quoted)

From CHALLENGES.md:L130-137:
1. "**Define the concept:** what your team recommends the "PR review" factory should follow."
2. "**State its key principles**, including how it balances risk, hallucination, transparency, confidence and quality."
3. "**Illustrate it as a reference**, on one sample agent-written change with its requirement ID."
4. "**Show what the AI found**, what it refused to decide, and why."
5. "**Show how the evidence** lets a named human accept the change without a full read."
6. "**Name the failure modes** you saw, and keep a short log of decisions."
- "*Use synthetic or cleared sample data only.*"

Deliverables (L155-157): "**Concept card:** recommendation, principles, trade-offs, limits"; "**Live walkthrough** showing where the trust comes from"; "**Lessons log** and a demo video/presentation".

Scope (L124): "across frontend, backend and security". Note that the sample repo is a C# library with no frontend. Estimate: covering "frontend" probably means showing that the concept generalises, for example with a synthetic frontend change or a principle about how routing differs by area.

Judge questions (L215-219): "What would make you not trust your own output?", "Who owns the decision?", "How would this scale?"

Directions, which are optional (L207-211): a generalist reviewer, or a classifier that flags code that genuinely needs human review.

## 4. What a mediocre submission looks like
- An LLM is pointed at the diff, posts a list of review comments plus a "confidence: 87%" badge, and a slide claims "saves 80% of review time". That submission violates "Confidence without evidence, or a risk score nobody can explain" (L195) and has no measurement story (25% of the score).
- It reviews line by line, only faster, which does not answer the reframe question (L126).
- It has no abstentions ("what it refused to decide"), no requirement-ID traceability and no named human sign-off record.
- It is demoed only on the tiny #2283 branch, with no word on how it scales to the 237-file change.
- Its concept card is vague ("AI assists humans"), with no explicit trade-offs or limits (Clarity, 30%).
- It has no failure modes or decision log, although both are explicit requirements (L135).

## 5. What an exceptional submission would demonstrate (estimates)
- **A crisp concept with a name and a one-sentence recommendation**, for example: "Every agent PR ships an evidence dossier. The AI reviewer makes claims and attaches checkable evidence to each requirement; routing by risk decides how much of the dossier the human must read; the owner signs a checked / not-checked / residual-risk statement." Five or six principles map one-to-one to risk, hallucination, transparency, confidence and quality (L132).
- **Requirement → claim → evidence traceability.** Each acceptance criterion from the requirement ID is linked to concrete evidence: a test that fails before the change and passes after, the diff hunk, a static-analysis result, a reproduction build (for #2283, the `app.dll` now contains `GeneratedMessagePackResolver`). Claims without evidence are shown as "unverified", not as low-confidence prose.
- **Hallucination control.** A second agent or a deterministic check verifies each finding before it is posted (mirroring "verify findings before posting", L201), and the walkthrough shows a finding that was *discarded* as unverifiable.
- **Explicit abstentions.** A visible "AI refused to decide" list with reasons, for example "public API semantics change: needs maintainer intent", "unrelated PolySharp bump not in requirement scope", "security of generated code in AOT/trim scenarios not testable here" (L134).
- **Risk routing across all four branches.** For example, #2297's 237 files are classified as mechanical and template-generated, so the human checks one template plus a generated-output invariant. #2129 is a feature with a new public surface, so it goes to full read on the risky parts. Show the share routed to humans (L251).
- **A measurement plan, with a seeded-defect experiment run on site.** Inject known bugs into copies of the branches (synthetic data is allowed, L137), then report AI catch rate, false-positive rate, abstention rate and the human minutes needed to sign off, against a baseline (plain LLM review, or no AI). Define the production metrics (reverts, incidents, time to merge, finding acceptance rate) and a per-area trust ledger that downgrades an area after an escape (L179-181). The jury guide independently stresses baseline comparisons and showing how often things fail, not just the average (jury PDF p.3 finding 3; p.4 table, Daksh row).
- **A signed owner record** as an artifact (a PR comment or YAML) naming the engineer, what was checked by what, what was not, and the residual risk (L185-189).
- **An honest failure-mode log**, for example the AI reviewer agreeing with the agent author because of shared model bias, tests written by the same agent that "prove" the wrong behaviour, and a large diff exceeding context.
- **Side-challenge synergy (estimate):** "Best Use of Entire" (CHALLENGES.md:L2324-2345) describes Trails, in which an agent reviews a change against intent. Building the reference flow on it might qualify for that tech challenge too. Its eligibility rules are not verified here.

## 6. Constraints that could disqualify or sink a project
- Using non-synthetic or uncleared data (L137). Never feed real proprietary or client code.
- Presenting AI approval as the merge decision with no named human owner. Strictly this is not a disqualification rule, but it contradicts every directional option ("every option keeps a named human accountable", L207) and the rejected pattern "An unowned merge" (L193). Estimate: fatal with these judges.
- Missing deliverables: concept card, live walkthrough, lessons log, demo video/presentation (L155-157). Missing items probably cost points; whether they formally disqualify is unknown.
- Spending effort on out-of-scope work: model training, vendor comparison or productisation (L159). This is not stated as disqualifying, but it wastes weight.
- Not working on "one sample agent-written change with its requirement ID" (L133). The requirement IDs Tieto brings on site may differ from the upstream issue numbers (unknown).
- General Junction submission rules (deadline, repo visibility, team size, video limits): unknown from these sources. Check the Junction platform at the event.

## 7. Physical hardware work
**None.** This is pure software and concept work: an LLM agent pipeline, Git/GitHub integration, a C# build and test harness (the .NET SDK is needed to run the MessagePack tests; estimate) and a web UI for the walkthrough. No devices, sensors or kits are mentioned anywhere in CHALLENGES.md:L101-269.

---

### Sources opened
- CHALLENGES.md:L1-9, L101-269, L2324-2345 (local transcription)
- `docs/00-Jury-profiles-and-pitch-guide.pdf`, pp.1-4 (baseline and failure-frequency guidance)
- GitHub API: `repos/te-industry-tech-office/junction26-messagepack-csharp` (branches, compare) — https://github.com/te-industry-tech-office/junction26-messagepack-csharp
- https://github.com/MessagePack-CSharp/MessagePack-CSharp/issues/2283 (and the 2234, 2129 and 2297 titles via the GitHub API)
- https://arxiv.org/abs/2605.30208 (Meta RADAR, risk-aware automated code review)
- https://hackjunction.app/participate/45/challenges/351 (rendered empty without login)

<!-- complete -->
