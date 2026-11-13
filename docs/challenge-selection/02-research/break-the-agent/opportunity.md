# Break the Agent (AfterQuery): opportunity discovery

**Summary**
- The challenge asks for an MCP-served RL environment in which a frontier agent scores reproducibly below a stronger reference run. The gap must come from fair decisions, and the reward must survive a 15-minute exploit hunt (CHALLENGES.md:L429-433, L449-451). The idea matters less than whether we can *prove* the gap is fair and the reward is unhackable.
- The strongest openings are failure modes that 2025-26 research has documented but that no common hackathon environment targets. These are (1) agents that ignore experimental feedback under a budget, (2) confident false completion, (3) poor judgement about when to pay for information, and (4) failing to revise beliefs after a regime change in an expert workflow. Each one comes with a built-in ablation that proves the difficulty is fair.
- Two cross-cutting layers lift any direction: a published exploit ledger with automated red-teaming (25 points of the rubric), and a small-model training loop (the tiebreaker, L453). The training loop is also the honest route to stacking Verda, Modal and Gemma.
- The mentors, Daksh Raghuvanshi and Ved Vedere, are the authors of StoreBench. In that environment a scripted heuristic passes 97% of cells against 49% for the best model ([arXiv 2610.10942](https://arxiv.org/abs/2610.10942)). They already accept the "scripted reference beats frontier agent" pattern, and they will see through a commerce-sim clone at once.
- Estimates: differentiation 7/10, demo 6/10, overall-jury fit 5/10. Legibility to the peer reviewers is the weak spot.

---

## 0. What the sponsor values (context for every area)

- **Rubric:** gap 30, meaningful difficulty 30, reward integrity 25, craft 15. A gap caused by "unfairly withheld information, trick wording, impossible timing, or broken tools" scores 0 (CHALLENGES.md:L449). The starting points are planning, exploring an unfamiliar system, using tools, managing limited resources and adapting to new information (L459-467). "A small environment with a well-chosen challenge can be enough" (L471).
- **AfterQuery's business:** it sells "Agent Environments (API / MCP)", RL rubrics and SFT data to labs. Its focus domains are legal, finance (credit analysis), office work, code and computer use. It says "expert knowledge is not captured on the open internet" and that it values reasoning, decisions and trade-offs over final outputs ([afterquery.com](https://www.afterquery.com/)).
- **The mentors' own work:** StoreBench runs 7 frontier LLMs on 11 scenarios across 3 seeds. A scripted smart-triage policy passes 97% of task-seed cells and the best model passes 49%. The reward is "hardened against a catalogue of reward hacks". GRPO on 5 tasks lifts Qwen3.5-27B on held-out tasks from 0.136 to 0.373 ([arXiv 2610.10942](https://arxiv.org/abs/2610.10942); [summary](https://welcome.ai/content/storebench-evaluating-autonomous-agents-in-live-commerce-settings.md)).
- **Daksh on the overall jury:** his bio says he looks for "teams that can explain exactly why an agent fails in their world, and whose reward holds when someone tries to break it" (00-rules-and-jury.md, section 5).
- **Inference:** a commerce or inventory simulation competes head-on with the judges' own paper. A *different* decision bottleneck, measured with StoreBench-level rigour, is the opening.

## 1. Opportunity areas

### A. Budgeted experimentation: agents that ignore their own lab results
- **Gap:** in sequential experimental design, the agent picks the next experiment from noisy results under a budget, as in assay screening, process tuning or hyperparameter search. Here, LLM agents have been shown to be **insensitive to feedback**. "Replacing true outcomes with randomly permuted labels has no impact on performance", and "classical methods such as linear bandits and Gaussian process optimization consistently outperform LLM agents" (Gupta, Hartford, Liu, *LLMs for Bayesian Optimization in Scientific Domains: Are We There Yet?*, EMNLP Findings 2025, [PDF](https://aclanthology.org/2025.findings-emnlp.838.pdf), p.1). Newer benchmarks frame budgeted discovery, but the summaries we found report no frontier-agent failure analysis: ActiveSciBench ([arXiv 2605.24043](https://arxiv.org/html/2605.24043v1), search snippet only) and WhatWorkedBench (a secondary report only, [yage.ai](https://yage.ai/share/whatworkedbench-experimental-understanding-en-20260928.html), not opened). No hackathon or OpenEnv entry of this type turned up (competitive.md, section 4).
- **Why it fits the rubric:**
  - *Reference:* a deterministic GP or bandit policy using the same MCP tools is cheap, strong and fair. This is the StoreBench pattern.
  - *Meaningful difficulty:* the label-permutation ablation is a ready-made fairness proof. If the agent's score does not change when its feedback is scrambled, the failure lies in its decisions, not in missing information.
  - *Reward:* regret against the known optimum of the seeded hidden function. Do-nothing and stop-early score about 0 by construction.
- **Caveat (estimate):** the 2025 study tested older instruction-tuned models. Whether 2026 frontier agents with a code tool still fail is **unknown**, because OpenCode can write its own GP in Python. Pilot this by hour 12, or design the world so that doing well needs domain priors *plus* adaptive choices, not just fitting a curve.
- **Why AfterQuery would care:** "Scientific simulation" is named in the brief (L429), and the failure ("cannot do in-context experimental design") is a named, trainable skill that labs pay for (inference).
- **Overall jury:** legible as "an AI scientist that ignores its own lab results". There is a visible before/after: the agent's experiment trace drifts while the reference converges. That serves Daksh, Arturs and Beer. Kia and Otto will ask who the user is; the honest answer is "AI labs and lab-automation teams" (estimate: medium appeal).

### B. Confident false completion: an environment where checking your own work is the skill
- **Gap:** most agent failures end with the agent declaring success. On Terminal-Bench 3 hard tasks, 65.4% of 2,980 agent-attributed failures were "confident false completion". 98.2% of failures produced a usable but wrong artefact. Passing and failing trials ran validation at the same rate (76.4% vs 76.8%). The top causes were misreading scope and "a second source of state that the agent never opened" ([Turing blog](https://www.turing.com/blog/terminal-bench-3-confident-failure), industry, not peer-reviewed). Across tau2-bench and AppWorld, 45-48% (single-control) and 75.8% (AppWorld) of failures were false success, and LLM judges did not exceed 0.65 AUROC at detecting them ([arXiv 2606.09863](https://arxiv.org/abs/2606.09863)). The papers *diagnose* the problem. We found no environment that *trains* falsifying verification (the Turing authors say they "did not test" the remedies).
- **Direction:** a task in which the information that disproves a plausible first reading is reachable through the tools but has to be sought out. Examples: a second ledger, a tombstone table, a stated numeric threshold. The agent submits a result plus a confidence. The reward is outcome correctness, optionally adjusted by a proper scoring rule on the claim.
- **Risks (estimate):** it sits close to the obvious "fix the bug, hidden tests" idea (competitive.md, section 8). A hidden second state source can read as "withheld information" (L449), so the instruction must say explicitly that the tools expose everything. Any confidence term must not let "always abstain" beat a correct completion.
- **Why AfterQuery would care:** the failure transfers to the office, legal and finance workflows it sells ([afterquery.com](https://www.afterquery.com/)). "Calibrated completion claims" is a reward-design problem squarely in their remit (inference).
- **Overall jury:** strong story ("the agent said done; it wasn't"), relatable to every developer on the peer floor. Weaker wow unless the visual shows the claim against the true state.

### C. Paying for information: judging when to ask, inspect or probe
- **Gap:** HiL-Bench (Scale AI) shows that with full information, models pass 86-91% (SQL) and 67-85% (SWE). When the information is only reachable through an `ask_human()` tool, pass rates drop to about 5-39% and 1-9%. The authors write that "judgment, not raw capability, is the binding constraint". RL on a shaped reward improved a 32B model ([alphaXiv 2604.09408](https://www.alphaxiv.org/abs/2604.09408.md)). Separately, clarification value depends on timing. Goal clarification loses most of its value after about 10% of the trajectory, and models ask at poor times or never: Gemini 3 Flash never asked ([arXiv 2605.07937](https://arxiv.org/html/2605.07937)).
- **Direction:** a world with *costly* information actions, such as paid inspections, expert calls or tests with a charge. A Bayes-optimal or value-of-information reference policy exists and can be computed. The decision bottleneck is "is this information worth its price now?"
- **Fairness lever:** all information is purchasable and every price is stated, so nothing is withheld. The ablation gives the information for free, and the gap should close. That proves the failure is in judging when to pay.
- **Risk:** this is the area most exposed to the "withheld information" zero-score condition (L449) if the design is careless. Mentors should review it early (L493).
- **Overall jury:** good fit with Arturs ("where will it break next") and Daksh. The demo moment is "the agent spent the budget asking the wrong questions".

### D. Regime change in an expert workflow (belief revision, not a generic sim)
- **Gap:** long-horizon sims show agents misreading state and then spiralling (Vending-Bench, [arXiv 2502.15840](https://arxiv.org/pdf/2502.15840), via competitive.md, section 5). StoreBench adds suppliers that reprice or fail and shocks "with little or no warning" ([summary](https://welcome.ai/content/storebench-evaluating-autonomous-agents-in-live-commerce-settings.md)). The open space is a **non-commerce expert domain** where the correct response to new information follows a known professional procedure, so a scripted expert policy exists. Candidates (estimates, not researched): energy-market or grid dispatch, freight or ice-class shipping schedules, credit covenant monitoring (AfterQuery's credit domain), or clinical-free lab QA.
- **Why it is a gap:** AfterQuery says "each domain has its own failure patterns" and expert knowledge is missing from the internet ([afterquery.com](https://www.afterquery.com/)). Epoch notes that low-fidelity clones are a known pitfall ([epoch.ai](https://epoch.ai/gradient-updates/state-of-rl-envs), via competitive.md).
- **Risk (estimate):** domain fidelity takes research time, and the team has no domain expert. Mitigate by keeping the world small and the rules written in `instruction.md`.
- **Overall jury:** the highest "worthwhile problem, specific user" score of the five areas, because it names a real professional decision. The demo is a timeline: shock arrives, the reference adapts, the agent keeps the old plan.

### E. Cross-cutting layer 1: an exploit ledger with automated red-teaming
- **Gap:** BenchJack audited 10 agent benchmarks, found 219 flaws, and reached near-perfect scores without solving tasks on 9 of them. The top classes were isolation failure, answers shipped with the test, evaluator RCE and trusting agent-writable output. It recommends adversarial smoke tests and iterative patching ([arXiv 2605.12673](https://arxiv.org/html/2605.12673)). Harbor's shared verifier mode documents no protection against tampering (feasibility.md, section 2).
- **Direction:** ship `eval.sh --redteam`. A coding agent is instructed to *cheat* against our environment using the BenchJack V1-V8 checklist, and each attempt is logged with its score and patch status. This should be a layer on top of A-D, not the main entry: "reward-hacking detector" entries already exist (HackWatch, competitive.md, section 4).
- **Why AfterQuery would care:** reward integrity is 25 points and a 15-minute judge activity (L449-451). Handing the judges our own exploit log anticipates their hunt (inference).

### F. Cross-cutting layer 2: the small-model improvement loop (tiebreaker and stacking)
- **Gap:** the tiebreaker (L453) and the stretch goal (L439) ask for a smaller model that improves. The competitive report estimates few teams will have time (competitive.md, section 10). Harbor has no token-level capture for CLI agents, so SFT or rejection sampling on logged trajectories is the realistic path ([Harbor #1922](https://github.com/harbor-framework/harbor/issues/1922), via feasibility.md). StoreBench shows a measurable held-out gain from 5 tasks ([arXiv 2610.10942](https://arxiv.org/abs/2610.10942)).
- **Direction:** generate reference-policy and successful rollouts, fine-tune a small open model, and rerun it through Harbor on held-out seeds.
- **Why now:** Verda explicitly suggests "Run thousands of rollouts in your AfterQuery RL environment and fine-tune a smaller model on the experience" (CHALLENGES.md:L2140). Modal offers $100 per participant and the Modal Dojo RL library (CHALLENGES.md:L3189, L3195).

## 2. Combinations that are new (estimates)
- **Classical optimal policy + MCP world + frontier agent:** a GP, bandit or VOI solver serves as the reference, making the "stronger reference run" deterministic, cheap and reproducible on the judges' machine (feasibility.md, section 3, rule 4). Whether a scripted reference is accepted is **unknown**; ask the mentors first.
- **A built-in counterfactual ablation for every failure:** permuted feedback (A), free information (C), hint injection (B, D). This turns "meaningful difficulty" from an argument into a measurement. We found no hackathon entry doing this.
- **Agent-as-attacker red team + agent-as-player in the same harness:** this became practical only once coding agents could reliably write exploits (METR documents o3 tampering with scorers: [metr.org](https://metr.org/blog/2025-06-05-recent-reward-hacking), via competitive.md).

## 3. Live demo angles (before/after)
- A split screen: the reference trace against the frontier agent's trace on the same seed, with the reward accumulating over time. The bottleneck decision is highlighted where they diverge (A, C, D).
- An ablation flip: the same agent scores the same with real and scrambled feedback (A), or with paid and free information (C).
- Exploit replay: "here is the cheat the red-team agent tried, and the 0 it earned" (E).
- Small model before/after on a held-out seed (F).
- Physical hardware: none.

## 4. Tech challenges this could honestly stack
| Tech challenge | Honest fit | Why |
|---|---|---|
| Verda Compute Track | **Yes, if F is built** | Explicitly suggested (L2140). Needs a documented process and a Discord summary (CHALLENGES.md:L2155) |
| Best use of Modal | **Yes, if F is built** | Fine-tuning or RL with Modal Dojo; batch rollouts. Harbor multi-container tasks are *not* supported on Modal as a provider (feasibility.md, section 2), so use Modal for training, not for hosting the environment. A "live deployed demo" is required (_tech-challenges.md) |
| Best Use of Gemma | Yes, if the student model in F is Gemma | Stack only if Gemma is the model being trained (L2546-2570) |
| Best Use of Codex | Yes, low effort | Development use, stackable with any challenge (L2420-2440) |
| Best Use of Nemotron | Weak | Nemotron 3.5 Super VL could be a second agent under test, but the brief requires it to be "core functionality" (L2588-2615); being a benchmark subject is a stretch (estimate) |
| Gemini API | Weak to medium | Gemini as one of the agents compared, with a written explanation; "meaningful" is doubtful (estimate) |
| Entire, CRACI, Aiven, MongoDB | Possible but cosmetic | No natural need in an environment repo (estimate) |

## 5. Estimates (own judgement)
- **Differentiation potential: 7/10.** The obvious entries are commerce sims, CRM clones, SWE tasks and puzzles (competitive.md, section 7). Areas A-D target documented, under-environment-ised failure modes, and the built-in ablations plus the exploit ledger address the rubric directly. It is not higher because the judges build these for a living and have seen most domains.
- **Demo potential: 6/10.** Scoring comes from the judges' reruns, not the stage (L451), and the split-screen trace with the ablation flip is clear to specialists. To a general peer reviewer an RL environment is abstract, and each frontier run takes minutes, so a live run must be paired with a replay.
- **Overall-jury fit: 5/10.** It is strong on insight and depth, and on honest measured evidence; that is the rubric's 35%, and Daksh, Arturs and Beer sit there. It is weak on "worthwhile problem, specific user" and "credible path forward", because the user is AI labs, which Kia, Otto and Umar may find remote. Peer-floor legibility is the main risk to reaching the top 5. Area D, or framing A as "an AI scientist that ignores evidence", raises it. Whether a juror tied to a sponsor (Daksh) recuses himself is **unknown**.

## Unknowns
Whether a scripted reference counts as a "reference run". Which frontier model is under test, and therefore whether the 2025 experimental-design failure (A) still holds for it. How judges run stop-early. Whether judges rerun on local Docker. The scoring skeleton's format. GPU availability from AfterQuery for F (Verda and Modal credits cover it).

## Sources opened
CHALLENGES.md:L409-534, L2116-2175, L2420-2440, L2546-2615, L3163-3200; competitive.md; feasibility.md; 00-rules-and-jury.md; https://www.afterquery.com/ ; https://arxiv.org/abs/2610.10942 ; https://welcome.ai/content/storebench-evaluating-autonomous-agents-in-live-commerce-settings.md ; https://aclanthology.org/2025.findings-emnlp.838.pdf ; https://www.alphaxiv.org/abs/2604.09408.md ; https://arxiv.org/html/2605.07937 ; https://arxiv.org/abs/2606.09863 ; https://www.turing.com/blog/terminal-bench-3-confident-failure ; https://arxiv.org/html/2605.12673

<!-- complete -->
