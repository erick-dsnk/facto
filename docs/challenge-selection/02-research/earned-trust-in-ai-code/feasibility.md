# Earned Trust in AI Code (Tieto): technical feasibility (Agent D)

**Summary**
- **Buildable: yes, with high confidence.** The challenge needs no hardware and no proprietary API. It is a TypeScript and LLM pipeline over a public C# repo plus a web walkthrough, which is squarely in our skill set. A strong core fits in roughly 20 to 25 of our 40 hours (estimate), which leaves time for the concept card and the pitch, and those carry most of the score (CHALLENGES.md:L151, L241-255).
- **The only hard technical dependency is a working .NET 8 build of the sample repo.** We need it to produce "test fails before, passes after" evidence. `global.json` pins SDK `8.0.402` with `rollForward: patch`, .NET 8 reached end of support on 2026-11-10, and nobody on the team has `dotnet` installed locally. It is solvable in about an hour with the official Docker image (details in §3), but we should do it in the first hour.
- **Demo reliability is high if we precompute.** The live walkthrough should replay stored dossiers, with at most one small live re-run. The main risks are not technical: a generic "LLM comments on a PR" concept, unmeasured trust claims, and requirement IDs from Tieto on site that do not match the four branches.
- **Unknowns to settle with Tieto before committing:** what the on-site requirement IDs and standards look like, which partner models and credits we get (CHALLENGES.md:L231 names neither), and whether they expect a live run or accept a replayed one.

---

## 1. What a credible entry has to be (architecture)

The challenge wants a concept plus a reference implementation that is explicitly "not a product" (CHALLENGES.md:L124-126, L159). Requirements 1-6 (L130-135) and the deliverables (L155-157) mean the build has to produce **evidence artifacts**, not a polished tool. Below is the architecture we propose (our design, an estimate of what judges reward).

```
requirement (ID, intent, acceptance criteria)  +  agent branch diff  +  base branch
        │
 [1] Ingest & classify ── deterministic: file kinds (src / test / docs / .tt template /
        │                  generated .g.cs snapshot), size, public-surface touch, out-of-scope files
 [2] Deterministic evidence ── dotnet build; run the new tests on BASE (expect fail) and HEAD (expect pass);
        │                       full existing suite on HEAD; template/output consistency checks
 [3] AI claims per acceptance criterion ── LLM maps hunks to criteria, writes claims with file:line citations
 [4] Verifier ── second pass (other model or re-check against [2]) keeps only checkable findings;
        │         discards are logged; anything un-checkable becomes an ABSTENTION with reason
 [5] Risk router ── explainable rules (not an opaque score) → tier: light / targeted / full read,
        │            plus "share routed to human"
 [6] Dossier + owner sign-off record ── checked (by what), not checked (why), residual risk, named owner
 [7] Measurement ── seeded-defect run: catch rate, false positives, abstentions, human minutes vs baseline;
                     per-area trust ledger that downgrades an area after an escape
```

- **Language and stack (estimate):** a Node/TypeScript CLI that orchestrates `git`, `dotnet` (in Docker) and LLM calls, and writes JSON plus markdown. A small static web page or Next.js page renders the dossier and the routing table for the walkthrough. Optionally, post the dossier as a PR comment on our own fork with `gh`.
- **Why [2] matters most:** the judges reject "confidence without evidence" (CHALLENGES.md:L195) and want evidence traceable to a requirement (L255). A fail-before/pass-after test result is evidence a human can check in seconds, while LLM prose is not. This is our strongest differentiator and also our only real technical risk.
- **Why [5] uses rules:** "a risk score nobody can explain" is explicitly not accepted (L195). Rules such as "touches a public attribute → targeted read" or "only generated snapshots plus one template → light check plus invariant" explain themselves. The LLM can propose a tier, but the rule table decides and records why.

### What the four sample branches give us (verified with `gh api` on 2026-11-13, against the default branch `dependabot/nuget/develop/PolySharp-1.15.0`)
| Branch | Files | Content | Natural risk tier (estimate) |
|---|---|---|---|
| `ju26-issue-2283` | 4 | `TypeCollector.cs` +26/−3, a new 189-line test in `GenericsFormatterTests.cs`, README and analyzer doc | Targeted: small fix with a clean fail-before/pass-after test. **Best primary sample.** |
| `ju26-issue-2234` | 4 | `TypeCollector.cs` +18/−4, two new test files, README | Targeted: second small sample, good for the seeded-defect run |
| `ju26-issue-2129` | 28 | New `GeneratedFormatterCollector.cs` (300 lines), new public attributes in `MessagePack.Annotations/Attributes.cs` (+36), four new analyzer IDs MsgPack019-022, templates, new test project | Full read on the public surface and analyzer behaviour; light on docs |
| `ju26-issue-2297` | 237 | Changes to 7 `.tt` templates and their `.cs` counterparts, plus about 220 regenerated `.g.cs` test snapshots | Light: check the templates, then verify that "every snapshot differs only by the attribute line" deterministically |

Each branch is a single commit authored as "Stelian Vultur" on top of the default branch (verified via `gh api repos/te-industry-tech-office/junction26-messagepack-csharp/commits`). Compared with `master`, #2283 is 2 commits and 5 files ahead, because the PolySharp bump comes along. That is a ready-made "out-of-scope change" finding (Agent A, §1a).

## 2. Critical dependencies and how to get them

| Dependency | Access during the event | Status |
|---|---|---|
| Sample repo `te-industry-tech-office/junction26-messagepack-csharp` | Public; we must make our own copy (CHALLENGES.md:L141). Fork or mirror with **full history**, because the build uses Nerdbank.GitVersioning (`Directory.Packages.props` lists `Nerdbank.GitVersioning 3.6.143`) and upstream CI clones with `fetch-depth: 0` "so nbgv can do its work" (`.github/workflows/build-debug.yml`). A shallow clone may fail versioning (estimate). | Available now |
| .NET SDK 8.0.4xx | `global.json`: `"version": "8.0.402", "rollForward": "patch"`. The repo's own devcontainer uses `mcr.microsoft.com/dotnet/sdk:8.0.402-jammy`; we confirmed that tag still resolves on MCR (HTTP 200, 2026-11-13). The .NET 8 release metadata reports `support-phase: eol`, `eol-date: 2026-11-10`, latest SDK `8.0.428` (https://builds.dotnet.microsoft.com/dotnet/release-metadata/8.0/releases.json). Microsoft's macOS page lists .NET 8 as "no longer supported" (https://learn.microsoft.com/en-us/dotnet/core/install/macos). Docker is installed on the lead machine; `dotnet` is not. | Use Docker. Native install via `dotnet-install.sh` is a fallback. |
| NuGet restore | `nuget.config` uses nuget.org plus the public `dotnet-tools` Azure feed; no credentials are needed (repo `nuget.config`). Restore needs venue Wi-Fi to work. | Pre-warm the NuGet cache before the event or in hour 1 |
| `net472` target | `src/MessagePack/MessagePack.csproj` targets `netstandard2.0;netstandard2.1;net8.0;net472`. The devcontainer Dockerfile notes that Mono is needed for `dotnet test` to work on net472 and is excluded by default. | Run tests with `-f net8.0` only, for the test projects we need (`MessagePack.SourceGenerator.Tests` is `net8.0`) |
| LLM access | "Partner credits on the Junction Platform" (CHALLENGES.md:L231); which models and how many credits: **unknown**. The Hostinger AI Router credits (CHALLENGES.md:L52) are stated for teams on the Hostinger challenge, so whether we would get them is **unknown**. | Bring our own Anthropic/OpenAI keys as a fallback |
| Tieto requirements set, standards, sample changes with requirement IDs | Brought on site (CHALLENGES.md:L225-227); contents **unknown** | Ask at kickoff |
| Entire (optional side challenge "Best Use of Entire") | Trails are Entire's PR replacement. They bundle intent, changes, sessions, review findings from configured review agents, and gates that can require human approval. CLI: `entire trail create`, `entire trail link`. A GitHub repo can be mirrored, but org-owned repos may need an installation owner (https://docs.entire.com/guides/trails/overview.md). The docs do not say whether findings can be posted through the API. Pricing and limits are not stated (https://docs.entire.com/). Claim code at mlh.link/junction-26 (CHALLENGES.md:L2337). | Optional; adds integration risk. See §6. |

## 3. Limits, pricing, latency, reliability

- **.NET build time:** unknown for this repo on our hardware. Upstream CI gives the whole build plus test job `timeout-minutes: 15` on `ubuntu-latest` (`build-debug.yml`), so a full cycle is under 15 minutes on a GitHub runner. Estimate: a cold restore plus build in Docker on an Apple Silicon Mac takes 5-15 minutes, and a filtered test run 1-3 minutes. Running x64 images under emulation would be much slower, so we must use the arm64 variant of the multi-arch image (estimate; check the `docker inspect` architecture).
- **Fail-before/pass-after cost:** each branch needs two builds (base plus the new tests, and head). With 4 branches and 10-20 seeded mutants, that is roughly 30-50 builds. At about 2-5 minutes each with incremental builds (estimate), that is 1-4 hours of machine time. It parallelises across our machines and worktrees, but we must budget for it and run it early on Saturday.
- **LLM cost and latency:** we found no documented Junction partner limits (unknown). Token volume estimate: #2283 and #2234 are about 250 changed lines each and fit easily in one context. #2129 is about 1,000 lines plus context. #2297 is 1,383 added lines, but most are repetitive snapshots, and we should **not** send it to the LLM whole; the deterministic invariant check handles it. Estimate: under a few hundred calls in total, so cost is not a concern on our own keys. Latency (tens of seconds per review pass) only matters for a live run, which is why we precompute.
- **LLM nondeterminism:** finding lists change between runs. That is a reliability problem for the demo and a credibility problem for the measurement. Mitigations: temperature 0 where supported, cached runs, reporting results over N≥3 runs, and showing the variance honestly. The jury guide asks how often things fail, not just the average (Agent A, citing the jury PDF p.3-4).
- **GitHub API:** used only for `gh` reads and maybe posting one PR comment on our fork. Rate limits are not a concern at this volume (estimate).

## 4. Integration complexity for our team

| Piece | Difficulty for us (estimate) | Notes |
|---|---|---|
| LLM claim and verifier agents in TypeScript | Low | Core skill |
| Git plumbing: base/head checkout, applying the new tests onto base | Low-medium | Use `git worktree`. Applying the test files onto base is the trick: copy the head's new test files into a base worktree. If the tests reference new APIs, they will fail to *compile* rather than fail at runtime, and that has to be reported correctly ("fails before" with a compile error is weaker evidence). |
| Running C#/Roslyn generator tests | Medium | None of us are confident in C#, but we only need to *run* tests, not write much C#. Seeded mutants are small edits to `TypeCollector.cs`, which an agent can produce. |
| Risk router rule table | Low | Paths, file kinds and public-surface heuristics |
| #2297 snapshot invariant ("each `.g.cs` diff adds only the ExcludeFromCodeCoverage attribute lines") | Low | A script over the diff. This is the most convincing "no full read needed" moment. |
| Seeded-defect experiment and metrics | Medium | Design matters more than code: mutants, baseline (a plain single-prompt LLM review), and a measure of human minutes. Human minutes can only be measured on ourselves with a stopwatch, which is small-n and has to be labelled that way. |
| Walkthrough UI | Low | A static page; no auth or database needed |

## 5. Does it fit in 40 hours? Smallest complete version

**Smallest complete version (meets all of L130-137 and L155-157), estimated at 18-22 person-hours of build time (wall-clock far less with three people and parallel agents):**
1. A concept card: name, a one-sentence recommendation, 5-6 principles mapped to risk, hallucination, transparency, confidence and quality, plus trade-offs and limits.
2. A dossier for **#2283** (or for the Tieto requirement ID given on site). It includes the acceptance criteria to claim to evidence table, the fail-before/pass-after test result, verified AI findings, discarded findings, an explicit **abstentions list with reasons**, and the out-of-scope PolySharp flag.
3. An owner sign-off record (YAML or markdown) with the named owner, what was checked by what, what was not checked and why, and the residual risk accepted (L185-189).
4. A routing table across all four branches showing each tier, the rule that fired, and the share of lines routed to a human.
5. A seeded-defect mini-experiment, for example 10-15 mutants on #2283 and #2234. It reports catch rate, false positives, abstentions and the baseline comparison, plus a proposed production metrics plan (reverts, incidents, time to merge, finding acceptance) and a per-area trust ledger (L251, L181).
6. A failure-mode log and decision log (L135), kept from hour 1.
7. A demo video and slides.

**Stretch goals, in priority order:** the #2297 invariant check, done live (high payoff, low cost); a #2129 dossier showing the "refuse to decide on new public API semantics" abstention; variance across repeated runs; posting the dossier as a PR comment on our fork; the Entire Trails integration.

**Verdict:** the core feature fits with a wide margin. The binding constraint is concept and pitch quality, not engineering. Plan for about 40% of team time on the concept card, the measurement design and the pitch (estimate).

## 6. Live demo: likelihood and failure modes

**Estimate: 8/10 if we follow the precompute plan.**

| Failure mode | Likelihood (estimate) | Impact | Mitigation |
|---|---|---|---|
| The .NET build does not work on our machines (SDK pin, nbgv shallow clone, arm64 image, restore on venue Wi-Fi) | Medium in hour 1, low after | Blocks all deterministic evidence | Set up Docker in hour 1. Fallback: run builds on a GitHub Actions runner in our fork (the workflow exists but triggers only on master/develop pushes, PRs and `workflow_dispatch`), and use cached results. |
| A live LLM call is slow, rate-limited or gives different findings on stage | Medium | Contradicts the recorded numbers | Walk through stored dossiers. At most one live run, on #2297's deterministic invariant or a cached LLM call. |
| Venue network fails | Low-medium | No live calls | Run everything offline from local JSON; the video is the backup |
| Tieto's on-site requirement IDs don't map to the four branches | Unknown | Requirement 3 (L132) must use "its requirement ID" | Keep requirement input as a plain JSON schema so any ID set plugs in; ask at kickoff |
| New tests fail on base with a compile error rather than an assertion | Medium | "Fails before" evidence is weaker or misleading | Classify it explicitly ("cannot compile on base: new API") and show it as a weaker evidence grade. This is itself good honesty material. |
| Agent-written tests "prove" the agent's own wrong behaviour | Real for any branch | Fake evidence | Name it as a failure mode; an abstention or a human check of the test oracle against the issue's expected behaviour |
| Seeded-defect numbers are small-n or look cherry-picked | High | Measurement criterion (25%) | Publish all mutants, the baseline, and run-to-run variance; label them as illustrative |
| Concept reads as generic "AI reviewer" | Medium | Clarity (30%) | Lead with the dossier and sign-off and with what the AI refused to decide, not with the model |

## 7. Ask Tieto on site before committing
1. What do the requirement IDs look like, and do they map to the four `ju26-*` branches or to new sample changes (CHALLENGES.md:L225-227)?
2. Can we see the "what good code means at Tieto" standards early, and should the reviewer enforce them as checkable rules?
3. Is a replayed or precomputed walkthrough acceptable as the "live walkthrough" (L156), or do they expect a fresh run on stage?
4. Which partner models and how many credits do we get (L231)? Is using our own API keys allowed?
5. Is a seeded-defect experiment on copies of the branches acceptable as "synthetic data" (L137)? (Estimate: yes.)
6. How do they weigh "frontend" in L124, given that the sample repo is a C# library? Would a synthetic frontend example help?
7. Can our fork and dossiers be public, given that the repo licence shows NOASSERTION on GitHub (Agent A §1)? Upstream `Directory.Build.props` declares `PackageLicenseExpression` MIT.
8. What is the judging format: pitch length, whether there is time for a live demo, and when deliverables are due?

---

### Sources opened
- CHALLENGES.md:L40-58, L101-272, L2324-2345 (local)
- Agent A report: docs/challenge-selection/01-challenge-intelligence/earned-trust-in-ai-code.md
- GitHub API on `te-industry-tech-office/junction26-messagepack-csharp` (2026-11-13): repo metadata, `compare` for the four branches, `global.json`, `Directory.Build.props`, `Directory.Packages.props`, `nuget.config`, `.github/workflows/build-debug.yml`, `.github/actions/setup-dotnet/action.yaml`, `.devcontainer/Dockerfile`, `src/MessagePack/MessagePack.csproj`, `tests/MessagePack.SourceGenerator.Tests/*.csproj`, commit list
- https://builds.dotnet.microsoft.com/dotnet/release-metadata/8.0/releases.json
- https://learn.microsoft.com/en-us/dotnet/core/install/macos
- https://mcr.microsoft.com/v2/dotnet/sdk/manifests/8.0.402-jammy (HTTP 200)
- https://docs.entire.com/ and https://docs.entire.com/guides/trails/overview.md

<!-- complete -->
