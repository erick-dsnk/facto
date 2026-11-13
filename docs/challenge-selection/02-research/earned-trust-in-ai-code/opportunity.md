# Opportunity discovery: Earned Trust in AI Code (Tieto)

**Summary**
- Tieto wants a governance concept for AI-written PRs, not a review bot (CHALLENGES.md:L124-135, L151). Generic AI review is crowded (see competitive.md). The open gaps are proving that whole classes of change are safe, checking whether the tests can be trusted, abstaining on decisions only a human can make, and measuring trust over time.
- I looked at the sponsor's own sample branches, which gives us an advantage. 222 of the 237 files on `ju26-issue-2297` are snapshot files whose roughly 1,200 added lines reduce to 3 distinct lines plus one odd formatting change. The agent also wraps the new attribute in a preprocessor guard that seems to switch it off on targets where Microsoft documents the attribute as available. This is a ready-made demo of "the one thing a human must look at, hidden in 237 files".
- Five directions follow (A-E). A, B and D give the strongest evidence for Tieto's Measurement (25%) and Evidence (20%) criteria. A and E give the clearest before/after for the peer floor.
- My estimates: differentiation 7/10, demo 6/10, overall-jury fit 5/10. This challenge is a better bet for the partner prize than for the overall win.

---

## What the sponsor material actually contains (checked first-hand)

I read the sample repo through the GitHub API. Its default branch is `dependabot/nuget/develop/PolySharp-1.15.0`, and each `ju26-*` branch adds one agent commit on top of it.

| Branch | Requirement | What the agent changed | Observation |
|---|---|---|---|
| ju26-issue-2283 | Bug: generator and analyzer crash (IndexOutOfRangeException) on a closed generic struct from a referenced assembly | `TypeCollector.cs` +26/-3, a 189-line test, README and analyzer docs | Upstream issue still open. A **separate human PR, #2305, fixes the same issue** (5 files, +261/-3, open). That gives two independent implementations of one requirement to compare. https://github.com/MessagePack-CSharp/MessagePack-CSharp/pull/2305 |
| ju26-issue-2234 | Bug: analyzer does nothing when `SuppressSourceGeneration = true` | `TypeCollector.cs` +18/-4, 2 new test files, README | Small. A good target for checking that the tests fail before the change and pass after. |
| ju26-issue-2129 | Feature: generate a formatter for a type in a referenced assembly | About 28 files. Adds a new public attribute, `GeneratedMessagePackFormatterAttribute` with `SurrogateType`, four new analyzer IDs (MsgPack019-022) and a 300-line collector | The upstream issue is an **unresolved design discussion**. The maintainer floated surrogate types and a "contractless only" simplification (https://github.com/MessagePack-CSharp/MessagePack-CSharp/issues/2129). The agent chose a public API shape by itself (contractless by default, surrogate members matched by name). Whether to accept a new public API is a decision a human should own. |
| ju26-issue-2297 | Feature: add `[ExcludeFromCodeCoverage]` to generated code | 237 files: 13 template files (`.tt` and its generated `.cs`), 1 test, README, **222 snapshot files under `tests/.../Resources/`** | Across the 222 snapshots, the added lines reduce to `#if !NETSTANDARD2_0 && !NETFRAMEWORK`, `[global::System.Diagnostics.CodeAnalysis.ExcludeFromCodeCoverage]` and `#endif` (402 times each), plus **one unrelated whitespace/line-break change** in `HasPrivateSerializedMemberAndIsGenericNamedFormatter`. Microsoft documents the attribute on classes for .NET Standard 2.0 and .NET Framework 4.0+ (https://learn.microsoft.com/en-us/dotnet/api/system.diagnostics.codeanalysis.excludefromcodecoverageattribute). So the guard looks like it **turns the feature off on targets where it would work**. This is a candidate finding that a human must confirm. The agent's reason for the guard is unknown. |

On site Tieto also provides code standards, a requirements set and sample changes with requirement IDs (CHALLENGES.md:L225-227). We have not seen these yet. They may replace the GitHub issues as the "requirement ID".

---

## Opportunity A: Prove the boring 94%, so the human reads only what is left

**Gap.** Today's AI reviewers comment on diffs: the reviewer gets more text to read, not less. Nothing we found proves that whole groups of changed files are mechanical consequences of a small core change. Tieto's principle that review depth follows risk (CHALLENGES.md:L177) has no tool that shrinks the surface a human must read in a way the human can check.

**Evidence.**
- On `ju26-issue-2297`, 222 of 237 files are snapshot outputs. They can in principle be regenerated from the 13 template files and compared byte for byte (see the table above).
- In practice the human's real job is the 13 template files plus the one snapshot that does not match the pattern.
- The `.tt`/`.cs` template pairs can be checked the same way, by re-running T4 and comparing the output.
- Competitive.md lists no product that classifies a change into "mechanically derived, proven by regeneration" and "needs judgement". Its "obvious ideas" list contains only risk scores and needs-human classifiers.

**Why it is new now.** An LLM can propose the rule that explains a group of edits ("every snapshot gains these three lines"). A deterministic checker then verifies that rule: regenerate, normalise, compare, and count outliers. The LLM only proposes and never certifies, which matches "AI review is advice with evidence" (CHALLENGES.md:L173). Until recently, writing that rule took a human. (Estimate.)

**Why Tieto would care.** It answers "is line-by-line review still the right way?" (CHALLENGES.md:L126) with a measurable "no, for these 222 files, and here is the proof". It directly addresses "how would this scale?" (CHALLENGES.md:L219) and scores on Evidence (CHALLENGES.md:L255).

**How it reads to the overall jury.** The before/after is strong: 237 files becomes "13 to read, 222 proven, 1 anomaly". It makes sense in about 30 seconds at a peer table (estimate).

**Risk.** Building and running the C# project on site is unknown territory (competitive.md also flags this). Regenerating snapshots may need the .NET SDK and a working build.

## Opportunity B: Can the tests be trusted? Falsifiable test evidence

**Gap.** "Tests pass" is the evidence most reviewers lean on. When an agent wrote both the code and the tests, though, that evidence is weak.
- Proofrail itself states that it does not prove a passing test exercises the claim (competitive.md, https://pypi.org/project/proofrail/).
- ImpossibleBench (ICLR 2026) finds that coding agents cheat by **modifying tests**. Claude models and Qwen3-Coder did so in over 79% of their cheating cases. LLM monitors detected only 42-65% of cheating on the SWE-bench variant (https://arxiv.org/pdf/2510.20270, figures from abstract and summaries).

**Evidence.**
- Meta's ACH shows that mutation-guided LLM test generation works at industrial scale. Engineers accepted 73% of its tests, and coverage alone would have discarded about 49% of the useful tests (https://arxiv.org/pdf/2501.12862, figures from the abstract and summaries; I did not open the full paper).
- Stryker.NET provides Roslyn-based mutation testing for C# (https://stryker-mutator.io/docs/stryker-net/introduction/, from a search snippet).

**What the evidence would look like.** For each requirement ID:
1. The new test fails on the base commit and passes on the head commit.
2. Mutants applied to the changed lines are killed by the new tests.
3. No existing test was weakened or deleted.
4. Where these checks fail, the system says what the tests do **not** prove.

Branch #2234 (two new test files) and branch #2283 (a 189-line test, with a human-written alternative in PR #2305) are natural targets.

**Why Tieto would care.** It turns "confidence without evidence" (CHALLENGES.md:L195) into evidence the owner can check, and its "what was not checked, and why" output is exactly the second item the owner signs (CHALLENGES.md:L187).

**How it reads to the overall jury.** It has technical depth and is honestly measured: rubric items "distinctive insight" (20%) and "honest measured evidence" (15%). It is less visual than A.

## Opportunity C: Tested abstention, where the AI refuses to decide and the refusal can be checked

**Gap.** The brief explicitly asks to "show what it refused to decide, and why" (CHALLENGES.md:L133). Commercial reviewers optimise for findings, not for well-placed refusals. In a quick search I found no paper on calibrated or conformal abstention **for code review**. The closest work covers code generation and pairwise LLM judging, e.g. SCOPE (https://arxiv.org/pdf/2602.13110) and GPS (https://arxiv.org/pdf/2503.10512). Search snippets only; absence is not proof.

**Evidence from the sample.** On #2129 the agent made public-API and wire-contract choices (contractless by default, surrogate members matched by name) while the maintainer discussion was still open (issue #2129 comments). An AI cannot settle those choices from the code. A good concept names the decision classes it will never settle, such as public API shape, serialization compatibility and policy trade-offs. It would then show each one routed to the owner, with the competing options quoted from the requirement thread.

**Why Tieto would care.** This is half of the Evidence criterion (CHALLENGES.md:L255). It also answers the judge question "what would make you not trust your own output?" (CHALLENGES.md:L215).

**How it reads to the overall jury.** It is a distinctive insight ("an AI that knows what it should not decide"), but hard to show without a measured abstention-accuracy number. Pair it with D.

## Opportunity D: A seeded-escape experiment and a per-area trust ledger

**Gap.** Tieto weights Measurement at 25%: reverts and incidents do not rise as review time falls, findings are real, time to merge, and share routed to humans (CHALLENGES.md:L251). The rule "trust is earned per area and withdrawn after escapes" (CHALLENGES.md:L181) is the part existing tools cover least (competitive.md, section 7). Vendor benchmarks are self-reported and contested (competitive.md, section 2). The MSR 2026 study found that about 79% of sampled merged agent PRs showed no feedback loop (https://arxiv.org/html/2605.22534, via competitive.md).

**The underused resource.**
- The four branches, plus copies with seeded defects, form a small labelled test set.
- Human PR #2305 is an independent second implementation of #2283. Differences between the two are free ground truth for "what did the agent miss or add?".
- Four real changes across 4 to 237 files cover the low-, medium- and high-risk routing cases.

**What it would show.**
- Catch rate, false positives, abstention correctness and simulated owner minutes, compared with a baseline (plain LLM diff review).
- A ledger that demotes an area (for example "source generator templates") after a seeded escape, so the next change there routes to a full read.

**Why Tieto would care.** Tieto is a roughly 14,000-person software and engineering services company that has made AI programmes a strategic priority (https://live.euronext.com/en/products/equities/company-news/2026-03-30-tietoevry-corporation-changes-its-name-tieto-corporation, search summary). A measurable rollout model is what such a firm would sell or adopt. That framing is my inference.

**How it reads to the overall jury.** It directly satisfies the jury rubric's "honest measured evidence: baseline, failure cases, a metric that cannot be gamed" (15%, 00-rules-and-jury.md).

## Opportunity E: The owner's two-minute sign-off, with human attention as the measured resource

**Gap.** A sign-off is usually just a button. Tieto wants the owner to sign three things: what was checked, what was not, and the residual risk (CHALLENGES.md:L183-189). Competitive.md warns that a signed attestation as the headline is already covered by OpenFab, AIIR and JFrog. Bound to a commit SHA, it is still a necessary artifact. The open space is the **reading plan**: an ordered list of the few hunks a named owner must read, a time budget, and an evidence card for each requirement. The record goes stale when a new commit is pushed (Augment's fixed-SHA idea, competitive.md section 4), and the owner's actual minutes are logged as the metric.

**Why Tieto would care.** It meets "a named human accepts without a full read" (CHALLENGES.md:L134) and the Practicality criterion's "named human owning each decision" (CHALLENGES.md:L247). It also produces the "share routed to humans" and "time to merge" numbers (CHALLENGES.md:L251).

**How it reads to the overall jury.** This is the user-facing surface that makes A to D readable at a peer table: a specific user (the Friday-afternoon reviewer, CHALLENGES.md:L113) and a visible before/after (a 237-file diff against a two-minute plan). On its own it is close to the "PR explainer" obvious idea, so it should wrap A to D, not replace them.

---

## Combinations that are newly practical (estimates)
- **LLM proposes, deterministic tool disposes.** The LLM proposes rules, invariants and mutants. Regeneration, compilation, the test runner and Stryker check them. This removes most hallucination risk from the evidence path (CHALLENGES.md:L131) and runs in hours with parallel agents.
- **A reviewer from a different model family than the author**, using Junction partner credits (CHALLENGES.md:L231). This addresses the independence concern that competitive.md raises.
- **Two implementations of one requirement** (agent branch against human PR #2305) as a differential oracle.

## Tech challenges that could be stacked honestly
Requirements and effort come from _tech-challenges.md.

| Tech challenge | Honest fit | Note |
|---|---|---|
| Best Use of Codex | High | We would use it in development anyway. It could also serve as the "author agent" that generates seeded variants. Low effort. |
| Best Use of Gemini API / Gemma | Medium-high | As the independent reviewer model family (a different family from the author). The Gemini challenge needs a written explanation, and participants must be 18+. |
| Best use of Modal | Medium | Sandboxed parallel runs of builds, mutations and seeded experiments over the branches. The challenge requires that Modal powers the project and a live deployed demo. |
| Best use of CRACI | Medium | The concept is a CI gate, so running CI on CRACI and using its SBOM/API is on-theme. CI must run on CRACI. |
| Best Use of Entire | Medium | Entire's session and trail features could provide agent-session provenance for the author agent. Whether that is "meaningful" is unknown. |
| Verda Compute | Low-medium | Only if mutation or experiment runs need serious compute. Probably not essential. |
| Aiven / MongoDB Atlas / Tiger Data | Low | The trust ledger or measurement history could live there. That is honest but shallow. Tiger fits a time series of trust per area. |
| Hardware ones (Arduino, Atech), ElevenLabs, Cloudinary, Solana | Poor | No natural fit. |

## Unknowns
- Whether the .NET build and snapshot regeneration run cleanly on our machines within the hackathon.
- The content and format of Tieto's on-site requirements set and code standards (CHALLENGES.md:L225-227).
- Why the agent added the `NETSTANDARD2_0`/`NETFRAMEWORK` guard. It could be intentional, for example a polyfill conflict. Treat it as a candidate finding, not a confirmed bug.
- How heavily Tieto judges weigh a working implementation against the concept card beyond "more weight for the concept" (CHALLENGES.md:L151).

## Estimates (my own judgement, not sourced)
- **Differentiation potential: 7/10.** Most teams will build a diff-commenting bot or a risk score (competitive.md). A, B and D draw on facts about the sponsor's own branches that other teams may not dig up: the 222 mechanical snapshots with one anomaly, the suspicious guard, and the human PR #2305 as an oracle. Capped because the brief already lists the principles every team will copy.
- **Demo potential: 6/10.** The "237 files becomes 13 plus 1 anomaly" reveal, and a test shown to fail before and pass after, are concrete and live. But it is still developer tooling on a C# serializer, which most of the audience will not know.
- **Jury fit: 5/10.** Problem worth solving and measured evidence score well. Peer-floor wow and a path forward beyond Tieto are weaker. Competitive.md also notes that past overall winners were product or hardware projects, not dev tools. Best used for the partner prize (3 cash places, CHALLENGES.md:L259-269), with overall placement as a stretch.

<!-- complete -->
