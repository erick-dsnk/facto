# Opportunity discovery: Stop Simulating, Start Moving (Intel Physical AI)

**Summary**
- The task is fixed. Every team builds the same pick → inspect → sort loop on the same SO-101 station (CHALLENGES.md:L963-L965), so there is no "new idea" space. The open space lies in the gaps the sponsor's own stack leaves open, which are also the things Intel asked for in its "Insight" paragraph (L969).
- Biggest gaps (sourced below): (1) the stack has no failure detection or recovery; (2) the NPU and INT8 paths are unverified or missing from Studio, and there are no published SO-101 latency numbers on Core Ultra; (3) there are no tools that say *which* demonstrations to record, although "how few demonstrations are enough" is Intel's headline question; (4) Anomalib now ships few-shot and VLM models, so a defect type a judge invents can be learned live; (5) the policy and the inspection use their cameras separately and the policy ignores depth, which caps cycle time and clutter robustness.
- Best fit for the jury: area 1 (a cell that notices and fixes its own failures) combined with area 3 (an operator who teaches it fast). Both give a visible before/after and a measured metric that cannot be gamed.
- Stacks honestly: **Verda** (its brief names this exact challenge, L2140), **Codex** (dev process). **Gemma** only with a real on-device VLM role; whether that counts is unknown. My estimates: differentiation 6/10, demo 7/10, jury fit 6/10.

Inputs: official text L947-L1037; Agent A `01-challenge-intelligence/intel-physical-ai.md`; Agent B `competitive.md`; feasibility report `feasibility.md` (same folder, which holds the bug and issue citations reused here); jury digest `00-rules-and-jury.md`.

---

## What everyone will build (the baseline to beat)
Agent B's estimate (competitive.md §4):
- ~30-50 teleop episodes, then ACT or SmolVLA
- a fixed brick position, then Anomalib as a separate good/bad step and two bowls
- "runs on NPU" with no power or thermal numbers, and a success rate quoted loosely

Every area below is defined against that baseline.

## Area 1: A self-checking cell (closed-loop failure detection and recovery)
**Gap.** Today a failed grasp, a dropped brick or an ambiguous anomaly score fails silently or is sorted wrongly.
- The OpenVINO Physical AI runtime describes no failure detection or recovery. It covers only connect/disconnect lifecycle, sync/async execution and a latency benchmark ([physicalai repo](https://github.com/openvinotoolkit/physicalai), opened).
- Intel's product page lists "action clamps and emergency stops" only as "future-ready hooks", not shipped features ([Intel Physical AI page](https://www.intel.com/content/www/us/en/developer/tools/openvino-toolkit/physical-ai.html), opened).
- Physical AI Studio has an open "Safety Return-to-Home / Reset-to-Zero" request (#1235, cited in feasibility.md §3).

**Evidence that it matters.**
- Intel explicitly asks for "using the anomaly score to trigger a re-grasp" (L969).
- Robustness to shifted or cluttered bricks is part of the 30% task-success criterion (L1006-L1008).
- Public SO-101 ACT case studies show sharp drops on new start poses: 3/7 with 50 varied demos ([OpenELAB case study](https://openelab.io/sv/blogs/learn/so-arm101-pick-and-place-lerobot-act-case-study), via Agent B).

**Direction (not yet an idea).**
- Treat each cycle as verify → act → verify:
  - Wrist or top camera confirms the brick is in the gripper.
  - The anomaly score lands in an accept, reject or "uncertain" band. An uncertain score triggers a rotate and re-inspect.
  - The top camera confirms the brick landed in the bowl.
- Log every recovery.
- Then report the success rate with and without recovery on the same brick layouts.

**Why Intel cares.** This closes the step from "lab demo" to "inspection cell", which is Intel's stated purpose (L959, L1002). It also exercises the one thing their runtime doesn't yet ship.

**How the jury reads it.** It gives a clear before/after ("62% → 90% end-to-end on 20 shuffled bricks", illustrative numbers) and visible failure cases, which matches the rubric's "honest measured evidence" (15%) and the PDF's "show a reproducible real-world loop" (jury PDF p.6). At a peer table it reads well: a judge knocks the brick out of the gripper and the arm picks it again.

## Area 2: An efficiency map of the edge hardware (heterogeneous CPU/iGPU/NPU deployment)
**Gap.**
- Studio hides the NPU ("We've not yet verified that running our models on NPU works") and does not expose INT8 (#1320). SmolVLA export from Studio fails (#1384). All three are cited in feasibility.md §3.
- No published SO-101 ACT or SmolVLA latency exists on Core Ultra for any device (feasibility.md §3, searched).
- Intel's own iGPU+NPU split for π0.5 is custom engineering. It notes that the two devices slow each other down through the shared memory controller ([Intel π0.5 paper](https://docs.openedgeplatform.intel.com/shared_media/publication-optimize-pi0.5-paper.pdf), via feasibility.md).
- The Robotics AI Suite catalogue lists pick-and-place and AMR *pipeline benchmarks* (latency, resource KPIs), but no power or thermal reference for manipulation ([Robotics AI Suite 2026.2 index](https://docs.openedgeplatform.intel.com/2026.2/_sources/ai-suite-robotics.md.txt), opened).

**Evidence that it matters.**
- Intel tech integration is 30% of the score and system efficiency 20%: latency, thermal headroom, power, NPU and iGPU offload (L1010-L1020).
- Intel explicitly asks for OpenVINO quantization and full-loop speed on CPU, GPU and NPU (L969).

**Direction.**
- Measure the full loop, not only the models:
  - device placement × precision (FP16/INT8)
  - cycle time, package power and temperature over a sustained 20-brick run
  - contention when the policy and Anomalib run at the same time
- Pick the placement from data.
- Optionally upstream a fix: the INT8 path or the SmolVLA export key mismatch.

**Why Intel cares.** These are exactly the numbers they need to sell "edge NPU/iGPU for robots" (sponsor-goal inference in Agent A). An upstream PR is adoption evidence.

**How the jury reads it.** It shows strong technical depth for the "credible technical progress" jurors (jury digest). On its own it is weak on legibility at a peer table. Pair it with a live power and latency gauge, or with Area 1 or 3.

## Area 3: Teaching that knows what to record next (data-efficient demonstration collection)
**Gap.**
- "How few demonstrations are enough" and "how well the policy copes with bricks in new positions" are Intel's lead questions (L969).
- Current guidance is generic rules of thumb: ~50 episodes, ~10 per position; 25 was "not enough" ([LeRobot SmolVLA docs](https://huggingface.co/docs/lerobot/smolvla), via feasibility.md). Intel's tutorial says 50-100 varied demos ([physicalai tutorials](https://github.com/openvinotoolkit/physicalai/tree/main/examples/tutorials), via feasibility.md).
- No tool tells the operator *where* coverage is missing. One search found no such Studio feature (estimate, not exhaustive).
- Every policy iteration costs 2-3 h of recording plus 2-5 h of training (feasibility.md summary). Wasted demos are the critical-path cost.

**Direction.**
- Use the top camera (RealSense D415, L983) to map the brick positions and orientations already covered by demos, together with where rollouts failed.
- Guide the next teleop session to the gaps.
- Report a success-vs-demo-count curve, comparing guided collection with random collection.
- Use spare cloud GPU capacity (L985, or Verda) for several training runs at different N.

**Why Intel cares.** Their pitch is "show a robot a task a few dozen times" (L959). Cutting teach-in time is the commercial claim behind Physical AI Studio. The 20% "dataset and pipeline quality" criterion (L1014-L1016) is scored on exactly this.

**How the jury reads it.** It has a specific user (a line technician re-teaching a cell for a new part, L959), a metric that cannot be gamed (success on held-out positions against the number of demos), and a credible next step (any new part). The table explanation is short: "it tells you which 10 demos to record."

**Risk.** A curve needs about 3 extra training runs (feasibility.md §5). Cloud GPU quota is unknown.

## Area 4: Defect types that change live (few-shot and VLM anomaly adaptation)
**Gap.**
- The brief invites "new defect types" (L965), and teams draw the defects themselves with markers (L963, L984). The baseline uses PatchCore or PaDiM trained once on good bricks, and its thresholds break when lighting changes (feasibility.md §6, failure mode 1).
- Anomalib v2.7 adds **FoundAD (few-shot)**, **RAD (retrieval-based)** and **WinCLIP** (vision-language) ([anomalib repo](https://github.com/open-edge-platform/anomalib), opened).
- **VLM-AD** runs zero-shot or few-shot through `k_shot` ([anomalib VLM-AD docs](https://anomalib.readthedocs.io/en/latest/markdown/guides/reference/models/image/vlm_ad.html), search result). Its documented example uses a hosted gpt-4o-mini, which would break the on-laptop rule (L965), so a local VLM is needed. Which local VLMs it supports beyond the LLaVA example is unknown.
- Whether these newer models compile on the NPU is unknown.

**Direction.**
- A judge marks a new kind of defect at the table. The cell learns it from a handful of examples within minutes and starts rejecting it, with a heatmap and a one-line reason.
- Recalibrate thresholds on site against hall lighting.

**Why Intel cares.** It shows Anomalib's newest models on Intel silicon, and "few-shot new defect types" is named in the brief (L965).

**How the jury reads it.** It is the most theatrical before/after available: the judge's own defect passes, then it is caught. That is strong for peer review, which needs about 60-90 s to be understood (jury digest §3). On its own it is shallow, so pair it with Area 1 or 3.

## Area 5: Faster and more robust cycles from shared cameras and depth
**Gap.**
- Intel explicitly suggests "sharing cameras between policy and inspection" (L969).
- In the baseline, a separate inspection pose costs cycle time, which is part of the 30% criterion (L1008).
- The D415 depth stream (L983) is unused by an RGB VLA policy.
- The Robotics AI Suite already ships **GraspNet** (6-DoF grasps from point clouds), **iDP3** (3D point-cloud policy) and RealSense segmentation tutorials ([Robotics AI Suite index](https://docs.openedgeplatform.intel.com/2026.2/_sources/ai-suite-robotics.md.txt), opened). These are suite components the 30% integration criterion names (L1012), and other teams will probably ignore them (estimate).

**Direction.**
- Inspect during transport, or pre-screen bricks on the pile from the top camera, so the inspection pose is only used for uncertain cases.
- Use depth to choose pick order and singulate cluttered piles before the VLA grasps.

**Why Intel cares.** It uses more of the Robotics AI Suite than ACT plus Anomalib. The judges list the suite explicitly (L1012).

**How the jury reads it.** It is mainly a partner-score lever: cycle time and clutter robustness. For the overall jury it is moderately legible ("twice as fast, handles a messy pile").

**Risk.** Mixing a depth heuristic with the VLA may read as "not fully learned" (feasibility.md §1, option c).

---

## Stackable tech challenges (honest fit)
| Tech challenge | Fit | Why |
|---|---|---|
| Verda Compute Track | **Good** | Its brief names this challenge: "Train imitation-learning or VLA policies from robot-arm demos in the Ignite × Intel challenge" (L2140). Area 3's multi-run curve truly needs compute. Requirements: document the process and post in the Verda Discord (L2153-2156). Unknown: whether the provided "cloud GPU instances" (L985) are Verda. |
| Best Use of Codex | Good | Dev-process use, stackable with any challenge (L2434). Effort is low. |
| Best Use of Gemma | Possible, unproven | Intel's π0.5 uses a PaliGemma VLM ([Robotics AI Suite index](https://docs.openedgeplatform.intel.com/2026.2/_sources/ai-suite-robotics.md.txt)), and a Gemma VLM could serve as the on-laptop defect explainer (Area 4). Whether PaliGemma or an incidental role counts is unknown, since the brief asks for "most innovative and impactful use" (L2554). π0.5 needs ≥40 GB VRAM to fine-tune (feasibility.md). |
| Tiger Data | Weak to moderate | Telemetry for Areas 1-2 is real time-series data. The criteria are prose only (_tech-challenges.md), so the fit is an estimate. |
| Arduino UNO Q | Possible but costly | Same Hardware Track by Arduino (L780). A separate UNO Q with Modulino sensors could monitor station light and temperature (Areas 2 and 4) without modifying the Intel kit. It requires an Arduino Project Hub post (L2717-2725). Effort is high and it is real hardware work. |
| Modal | Poor | It requires a live deployed app that judges can use (L3221-3223). Our demo is a physical station. |
| Gemini API, ElevenLabs, others | Poor | Off-laptop inference contradicts the on-device requirement (L965). Voice was flagged as an obvious, off-rubric add-on (competitive.md §5). |

## Estimates (mine, not sourced)
- **Differentiation potential: 6/10.** The concept is fixed for all teams (competitive.md), so differentiation is capped. But the sponsor's own stack leaves real, documented gaps in recovery, NPU/INT8, demo guidance and suite usage, and the median team will not reach them (competitive.md §4).
- **Demo potential: 7/10.** A real arm sorting bricks is visible and immediately understood. A live judge-made defect (Area 4) or a knocked-out brick (Area 1) gives a strong before/after. It is held back by a ~50% chance of a clean 10-brick live run (feasibility.md §6) and lighting sensitivity.
- **Overall jury fit: 6/10.**
  - Strengths: strong on the live loop, on measured evidence and on peer-table "wow".
  - Weaknesses: the problem and user are given by the sponsor rather than discovered, and every station shows the same demo, which weakens "distinctive insight" unless Areas 1 or 3 carry a clear measured result.
  - The path forward (teach a cell for a new part in under an hour) is credible but is the sponsor's story, not ours.
- **Hardware honesty:** no electronics, but the critical path is physical: calibration, camera mounts, lighting, teleop time (feasibility.md §4). Our parallel-agent speed does not shorten it.

<!-- complete -->
