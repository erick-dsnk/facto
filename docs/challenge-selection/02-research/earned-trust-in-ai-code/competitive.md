# Competitive intelligence: Earned Trust in AI Code (Tieto)

**Summary**
- The generic "AI reviews the PR and posts comments" idea is a crowded commercial category (CodeRabbit, Qodo, Greptile, Copilot) and a staple of hackathon entries. It is not a differentiator.
- The sponsor's brief already asks for something those products do not centre: a named human owner, a signed record of what was checked / not checked / residual risk, explicit abstentions, risk-routed review depth, and per-area trust that is withdrawn after escapes (CHALLENGES.md:L165-203).
- Closest existing work is early-stage provenance/claim-verification tooling (Proofrail, OpenFab, AIIR). No tool found combines requirement-ID traceability, abstention and an owner sign-off with measured catch rates.
- Estimated crowding: medium-high among Agentic-track teams (estimate, reasoning below). Winning depends on a measured, honest evidence dossier rather than on a novel model pipeline.
- Evidence for past Tieto-challenge winners at Junction is thin: nothing found for 2023-2025.

## 1. Previous winners and similar hackathon entries

| Finding | What it tells us | URL |
|---|---|---|
| Tieto appears only as a 2016 Junction partner (UPM supply-chain track won by FindMyPaperRoll; Tieto x ISS track with €2,000/€1,000/€500 prizes, winners not named in what I saw). No Tieto/Tietoevry Junction challenge results found for 2017-2025 (absence of results in search, not proof none existed). | No usable prior Tieto winner to imitate. This challenge appears new. | https://upm.com/news-and-stories/blogs/2016/11/supply-chain-did-go-mobile-tracking-application-the-winning-solution-in-junction ; https://www.electronicspecifier.com/?p=58527 ; https://en.wikipedia.org/wiki/Junction_(hackathon) |
| Junction overall winners 2015-2025 (e.g. 2024 BREAKDANCE, 2025 WAVELET) are product/consumer or hardware-flavoured projects, not developer-tooling or governance concepts. I did not verify what each project does. | Overall-jury wins are not obviously won by dev-tool entries; a code-governance concept is a long shot for the overall prize (estimate). | https://en.wikipedia.org/wiki/Junction_(hackathon) |
| Junction 2025: 1,500+ participants, 291 projects, 40 partners. | Rough base rate for the number of teams. Teams per challenge unknown. | https://en.wikipedia.org/wiki/Junction_(hackathon) |
| GitLab AI Hackathon 2026 (Devpost): winners include Gitdefender (opens code review with fixes), DocSync (opens a review only when confident, else files an issue for a human), Compliance Sentinel (risk-scores merge requests, blocks critical), MR Compliance Auditor (maps MR evidence to SOC 2). | Confidence-gated "agent or human" routing, risk scores and compliance mapping have already been done and rewarded in a recent hackathon. | https://about.gitlab.com/blog/gitlab-ai-hackathon-2026-meet-the-winners/ |
| Sentinel Action (Devpost): GitHub Action sends diffs to parallel specialist agents plus a synthesis agent that writes one review comment. Hackathon and result not verified (page blocked, 403; summary from search snippet only). | The "multi-agent specialist reviewers + synthesiser" design is a common first idea. | https://devpost.com/software/sentinel-action |
| lablab.ai entries "PR Shield" and "Smart PR" (IBM Bob hackathon), HackGPT 2.0 code-review platform (2nd runner-up per team's own write-up), AITinkerers "PR Review Copilot". Not opened in full; titles/snippets only. | Many small hackathon PR-review bots exist. Only one place-finish seen, self-reported. | https://lablab.ai/ai-hackathons/ibm-bob-hackathon/geek-sauvages/smart-pr ; https://dev.to/souravdey777/winning-the-hackgpt-20-hackathon-2nd-runner-up-position-iac ; https://seattle.aitinkerers.org/hackathons/h_x_n9rN2gpzc/entries/ht_a1vFfzbg6IE |

## 2. Commercial products already in the space

| Product | Relevant behaviour | URL |
|---|---|---|
| CodeRabbit | Sandboxed clone, code graph, linters; verifies each finding against evidence before posting; explicitly positions itself as evidence supply, humans make the final call. Directly overlaps "advice with evidence". | https://coderabbit.ai/blog/why-agentic-change-management-starts-with-independent-ai-code-review |
| Qodo | Claims spec-linked "evidence sections", rankings with reasons on a versioned policy, auto-generated rules. Overlaps requirement traceability and policy. | https://www.qodo.ai/features/qodo-git |
| Greptile | Whole-repo context; auto-approve only at 5/5 confidence with low risk, excluding auth/secrets/billing (as described by Augment). Reported "faster velocity, diminishing trust" study. | https://www.augmentcode.com/guides/ai-agents-pull-request-approval-guardrails ; https://www.greptile.com/reports/ai-code-review-for-modern-engineering-teams?format=markdown |
| GitHub Copilot code review | Leader on GitHub's ReviewBench (219 PRs, 187 repos); RuntimeWire questions independence because Copilot supplied 1,185 of 2,623 golden-set findings. A claim in one search summary that Copilot can now submit an approving review was not confirmed on a second search; treat as unverified. | https://github.blog/ai-and-ml/github-copilot/reviewbench-an-open-benchmark-for-ai-code-review/ ; https://runtimewire.com/article/github-launches-reviewbench-an-open-benchmark-for-ai-code-re-4528d7 |
| Graphite, Cursor Bugbot, Sourcery, Ellipsis | Comparison roundups only; I did not open vendor pages. Vendor benchmarks conflict (Greptile 82% catch vs Qodo claiming top F1). | https://particula.tech/blog/greptile-vs-coderabbit-vs-qodo-ai-code-review-2026 ; https://www.techplained.com/best-ai-code-review-tools |

Implication: the vendor benchmarks are self-serving. A judge who knows this field will respond to a small, honestly measured experiment on the sample branches more than to "we beat CodeRabbit".

## 3. Open-source and research work

| Project | What it does | Maturity | URL |
|---|---|---|---|
| PR-Agent (Qodo origin, now community org, Apache-2.0) | /review, /describe, /improve on PRs; runs in CI or self-hosted | Established (per secondary source) | https://jimmysong.io/ai/pr-agent |
| Kodus (AGPLv3 community edition) | Self-hosted AI review with team "Kody Rules" | Established (per secondary source) | https://kodus.io/en/ai-code-review-tools/ |
| Proofrail | Checks an agent's claims against a git commit range with deterministic checks; verdicts verified / contradicted / unsupported / human_review_required; does not prove a passing test exercises the claim. | Public alpha 0.1.0a2, Apache-2.0 (opened) | https://pypi.org/project/proofrail/ |
| OpenFab | Spec with machine-checkable acceptance criteria, signed in-toto/SLSA-style attestation, N-of-M human approval gate | Experimental (opened) | https://todogroup.org/blog/2026-07-14-verifiable-provenance-ai-assisted-contributions/ |
| AIIR (AI Integrity Receipts) | Content-addressed receipts for commits, in-toto wrapping | Not opened; search summary only | https://pypi.org/project/aiir/ |
| JFrog Agentic Process Evidence | Proposed open standard for signed evidence of agent actions and human review | Vendor proposal; not opened in full | https://jfrog.com/blog/governing-the-agentic-sdlc/ |
| DevOps.com "pipeline disposes" article | Signed attestations of model, task spec, tools, tests run; independent eval suite so agents cannot certify themselves by editing tests | Opinion/pattern; summary from search only | https://devops.com/the-agent-proposes-the-pipeline-disposes-controls-for-ai-authored-change/ |
| Empirical study, MSR 2026 (arXiv 2605.22534) | 9,799 closed agent PRs; about 79% of sampled merged PRs showed no feedback loop or reviewer commits; merge/reject labels are a poor capability measure | Peer-reviewed dataset study (opened) | https://arxiv.org/html/2605.22534 |
| ReviewBench (GitHub) | Open benchmark: 219 PRs, grounded F1 | Released; independence questioned | https://github.blog/ai-and-ml/github-copilot/reviewbench-an-open-benchmark-for-ai-code-review/ |

## 4. Practitioner thinking judges may already have read
- Augment: approval authority needs repo-aware scope, a precision threshold at the blocking gate, an auditable record (change ID, trigger, commit SHA reviewed, decision, merge evidence), human routing for auth/billing/migrations/CI, advisory-mode rollout with false-approve rate from reverts. Opened. https://www.augmentcode.com/guides/ai-agents-pull-request-approval-guardrails
- tianpan.co: automation bias; "the agent suggested it" is not a defence; track author class; route by risk via CODEOWNERS; re-audit past agent merges; reviewer states what would make the change wrong. Opened. https://tianpan.co/blog/2026/05/14/ai-told-me-so-defense-code-review

Overlap with Tieto's own principles is large (CHALLENGES.md:L165-203, L210-215), so a team that writes these ideas up as a concept card will look similar to every other team that read the brief.

## 5. What most teams will reach for first (obvious ideas to avoid)
1. A GitHub App / Action that runs an LLM on the diff and posts comments or a summary.
2. Multi-agent "security + performance + style" reviewers merged by a synthesiser (the Sentinel Action pattern).
3. A single risk score or confidence percentage per PR (CHALLENGES.md:L196 explicitly rejects a risk score nobody can explain).
4. Auto-approve when confidence is high, with a human fallback (the DocSync / Greptile pattern; also conflicts with L193).
5. A dashboard of review stats with traffic-light badges.
6. A "PR explainer" that narrates the diff in plain English.
7. A classifier that labels code "needs human" vs "fine" (named as an option at L205-208, so many teams will take it).
8. Comparing models' bug-catching on the sample PRs and reporting a leaderboard.
9. Signed attestation bolted on as the headline (already covered by OpenFab / AIIR / JFrog).
10. Pitching "we reduce review time by X%" with no measurement.

## 6. Crowding estimate (estimate, not sourced)
**Medium-high.** Reasoning:
- Junction 2025 had 291 projects across about 40 partners (Wikipedia), so a typical partner challenge draws a handful to a dozen teams; the exact number per challenge is unknown.
- Teams here are developers by definition, the topic is a daily pain point, there is no hardware or regulated data, and the starter repo is provided. That is likely to attract more teams than average, and AI-tooling-heavy teams will bias toward the Agentic track.
- Deliverables are conceptual plus a demo, so entry cost is low, which attracts teams that want an achievable build.
- Offsetting factors: the brief is long and demanding (concept card, measurement, failure-mode log), the sample repo is C#, and 40 hours is short for a rigorous experiment. Many teams will under-deliver on Measurement (25%) and Evidence (20%).
- For the overall prize, a governance concept is hard to make visually compelling in a peer-voted demo (estimate).

## 7. What would make a submission look different
1. **Lead with measurement, not a model.** Seed known defects (and a known-clean control) into the four sample branches (4, 4, 28, 237 files), run the reviewer against a baseline (plain LLM review and a vendor tool if allowed), and report catch rate, false positives, abstentions, and human minutes. This maps to the 25% Measurement criterion that most teams will answer only with claims.
2. **Make abstention first-class and tested.** Show cases where the system said "cannot decide" and that the abstentions were correct (compare Proofrail's unsupported / human_review_required labels, which stay at claim level, not requirement level).
3. **Requirement-ID evidence dossier.** For each requirement, show a test that fails before the change and passes after, and what it does not prove. Go beyond Proofrail's own stated gap (a passing test may not exercise the claim).
4. **Owner sign-off as a real artifact.** Checked / not checked / residual risk, bound to a commit SHA, with a stale-on-push rule (Augment's fixed-SHA idea), not a screenshot of a button.
5. **Risk routing shown across all four branches**, including how a 237-file change is decomposed instead of read.
6. **Per-area trust ledger** that demotes an area after a seeded escape, since "trust earned per area, withdrawn after escapes" (L180) is the part least covered by existing tools.
7. **Name the concept** and show an honest failure-mode log, including where the system itself was wrong; this answers "what would make you not trust your own output?" (L217-ish questions section).
8. **Avoid the independence trap** (CodeRabbit's point that a reviewer should be separate from the author and that tests can share the author's wrong assumption): use a different model family for review and check that tests were not edited by the author.

## Unknowns
- Past Tieto Junction challenge winners and how Tieto judges score: unknown.
- How many teams choose this challenge: unknown.
- Whether the C# sample repo's tests can run in the hackathon environment: unknown (not investigated).
- Vendor product details from search snippets (Graphite, Bugbot, Sentinel Action, PR Shield) were not verified on the vendor pages.

<!-- complete -->
