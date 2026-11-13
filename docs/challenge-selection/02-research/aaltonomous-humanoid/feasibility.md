# Aaltonomous Humanoid: technical feasibility (Agent D)

**Summary**
- **The core can be built in 40 h.** The organisers ship a classical baseline that already passes the sim gate, scores 76-82 % of objects on the nominal sim and comes as a ready submission image ([baseline README](https://github.com/zupermiez/aaltonomous-humanoid/blob/main/aaltonomous/baselines/classical/README.md)). A strong entry is that baseline hardened for randomised scenes, plus an offline instruction parser for rung 2, faster two-arm execution and real-data calibration. All of this is software work in Python we know well. Estimate: about 7/10 that a strong core ships.
- **The live result is out of our hands.** We cannot run anything on the real robot before the Sunday finals (RULES §6). We only get there if we place in the top ~5 on a held-out sim we cannot see. Then the organisers run 3 episodes with no reruns. Neither the baseline README nor the FAQ reports a full autonomous real-robot sort (see section 6). Estimate: about 4/10 that we reach the robot and it sorts well.
- **Hardware work for us is zero.** The work is real manipulation engineering: IK, grasp physics, calibration and sim-to-real. Nobody on the team has hands-on manipulation experience. That gap, not electronics, is the main skills risk.
- **Infrastructure:** Isaac Sim needs RTX-class cloud GPUs (not A100/H100). One sim trial takes about 75 s, so evaluation throughput limits how fast we can iterate. Verda credits per team are **unknown**.

Sources: CHALLENGES.md:L1143-L1279, the starter repo at commit `a2d1dee` (2026-11-13), which was cloned and read in full for the docs below, Verda pricing, and Isaac-GR00T. Short names used below: RULES = [RULES_AND_SCORING.md](https://github.com/zupermiez/aaltonomous-humanoid/blob/main/aaltonomous/docs/participants/RULES_AND_SCORING.md), SUBMISSION = [SUBMISSION.md](https://github.com/zupermiez/aaltonomous-humanoid/blob/main/aaltonomous/docs/participants/SUBMISSION.md), INTERFACE = [INTERFACE.md](https://github.com/zupermiez/aaltonomous-humanoid/blob/main/aaltonomous/docs/participants/INTERFACE.md), FAQ = [FAQ.md](https://github.com/zupermiez/aaltonomous-humanoid/blob/main/aaltonomous/docs/participants/FAQ.md), PATHS = [STARTER_PATHS.md](https://github.com/zupermiez/aaltonomous-humanoid/blob/main/aaltonomous/docs/participants/STARTER_PATHS.md), QS = [cloud/QUICKSTART.md](https://github.com/zupermiez/aaltonomous-humanoid/blob/main/aaltonomous/cloud/QUICKSTART.md), BASE = [baselines/classical/README.md](https://github.com/zupermiez/aaltonomous-humanoid/blob/main/aaltonomous/baselines/classical/README.md).

---

## 1. What the system has to do (the hard constraints)

| Constraint | Value | Source |
|---|---|---|
| Inputs | head RGB + aligned depth (640x480, mm, 0 = invalid), two wrist RGB images, `arm_q`/`arm_dq`/`hand_q` (14 each), instruction string, `t` | INTERFACE §2; CHALLENGES.md:L1173 |
| Outputs | absolute `arm_q_target` and `hand_q_target`, shape (14,) or (k,14) chunks, at 30 Hz | INTERFACE §3 |
| Safety filter | arms ≤1 rad/s and hands ≤3 rad/s on the *change of command*; joint limits; workspace box; counter keep-out (wrist and palm z < 0.03 m); abort after more than 30 clips. **The sim gate allows 0 clips** | INTERFACE §5; RULES §4 |
| Not covered by the filter | self-collision and fingertips touching the table. "On the real robot staff will stop the run" | INTERFACE §5 |
| Rate | ≥27 Hz command rate, measured on the sim clock **and** against our own wall-clock latency (`policy_hz_rt`) | RULES §4 |
| Slow thinking | a single call may take ≤30 s, but holds the runner inserts don't count toward the rate. Slow models must therefore run in a background thread while `act()` returns holds | SUBMISSION §3; INTERFACE §3 |
| Container | linux/amd64, CUDA ≥12.8 (finals GPU is an RTX 5090, 32 GB), port 8000, listening within 120 s, weights baked in, ≤40 GB, no volumes | SUBMISSION §1; FAQ "Compute" |
| Network | "we provide no network". A failed API call counts as a failure, with no reruns | FAQ; SUBMISSION §1 |
| Episode | 3-5 objects, yaw ±45°, ≥8 cm apart, 120 s. Finals settings (objects, layout, time limit) are **not announced** | RULES §2, §5 |
| Scoring | sort_fixed +1 per object. sort_language +2 per object. Wrong bin −1, knocked off −1 | RULES §3 |
| Finals | 3 real episodes: fixed; language with a training template; language with an unseen instruction and layout ×1.5. Final ranking = real-robot score, with sim as tiebreak | RULES §5 |

Geometry that matters: the bin centres are at x = 0.505 m, beyond comfortable reach (about 0.40 m comfortable, about 0.55 m with a straight arm), so objects are released in the near part of each bin. The Dex3 index and middle fingertips are about 57 mm apart, so a 45 mm object can wedge between them and the grasp must pinch thumb against fingers (INTERFACE §4, §7).

## 2. Architecture a credible entry needs

Our recommendation (an estimate): a **modular/hybrid pipeline built on the baseline**. Not a VLA-first approach.

```
instruction ──► mapping parser (deterministic rules → small local LLM fallback, baked in) ──► {colour→bin}
head RGB-D ──► perception (HSV/learned seg + depth → object pose + yaw, pelvis frame) ──┐
                                                                                        ▼
                         task planner (order objects, assign arm by side, both arms in parallel, time budget)
                                                                                        ▼
            skill layer: yaw-aware pinch grasp → lift → carry → release in near half of bin → home
            (Pinocchio IK, trajectories pre-checked against SafetyFilter offline → 0 clips)
                                                                                        ▼
            policy server: background planning thread; act() always returns a hold or the next chunk at once
            optional: wrist-camera grasp verification / regrasp; hand_q check for "is something in the hand"
```

Why this shape:
- **The baseline already does the plumbing correctly.** It passes the gate at 30 Hz with 0 clips. It plans in a background thread and returns holds meanwhile. It comes as a CPU-only image of about 1.5 GB that starts in under 2 s (SUBMISSION §7; BASE). Starting there removes the most common way to be disqualified.
- **Its known weaknesses are listed**, and they are where the points are. Triangles slip in the pinch. Objects near the centre line need the arm on the other side. Each pick takes about 10-20 s against a 120 s budget. It handles rung 1 only (PATHS Route 1). Most misses are triangles and the time limit (FAQ "The baseline").
- **Rung 2 is worth twice as much per object** (RULES §3), and its language side is small. The bins are always named left/center/right, the colours are red/yellow/blue only, and there are 8 training templates (`aaltonomous/interface/tasks.py` `TEMPLATES`). A deterministic parser that finds each colour and its nearest bin word covers the templates. Estimate: a small local LLM (a few GB, inside the image) as a fallback covers paraphrases. Harder held-out knobs exist ("colour + shape, negation, held-out paraphrases"), but the finals values are **not announced** (PATHS "Difficulty knobs").
- **A VLA (π0/GR00T) as the main policy is the 30 % bet, not the 95 % build.** There are only about 20 real demos per rung, deliberately raw (PATHS Route 3). Fine-tuning needs 80 GB GPUs (PATHS Route 3). GR00T recommends 40 GB+ for fine-tuning ([Isaac-GR00T README](https://github.com/NVIDIA/Isaac-GR00T)). The sim-to-real visual gap is named as the main risk (PATHS Route 3). Use it, if at all, as a parallel exploration track by one person.

Generality and originality (45 % of the sponsor criteria, CHALLENGES.md:L1253-L1263) can come from:
- open-vocabulary segmentation in place of HSV, such as Grounding DINO or SAM 2, which PATHS Route 1 suggests;
- a real2sim story: fitting HSV, depth noise and friction to the Drop 1 captures (PATHS Route 5);
- our own held-out ablations under `AALTO_DR=train`.

These are estimates of what the judges will value. How the weighted criteria combine with the real-robot score is **unknown**. The rules say ranking = real-robot score (RULES §5).

## 3. Critical dependencies and how we get them

| Dependency | How we get access | Risk |
|---|---|---|
| Sim Docker image `aalto-sim:v1` (Isaac Sim 6.2 + Isaac Lab 3.0, about 30 GB) | "download location shared at kickoff" (CHALLENGES.md:L1220; QS §2). Bare-metal fallback takes about 30-40 min (QS §2b) | Medium. It is a 30 GB pull per instance. Shaders compile on first start in about 5-10 min, measured at 9 min on a busy 5090 (QS §2) |
| RTX-class GPU with ≥24 GB, driver ≥580.65.06, ≥8 CPU cores, ≥32 GB RAM, ≥80 GB disk | Verda. "we don't allocate compute" (FAQ). Free Verda credits per team via the Junction Platform Hackerpacks (CHALLENGES.md:L2180; [verda.com/blog/junction-2026](https://verda.com/blog/junction-2026)). The **amount of credit is unknown** | Medium-high. A100/H100 "will not render" (CHALLENGES.md:L1215). Verda lists RTX PRO 6000 at $2.81/h, L40S at $2.00/h and RTX A6000 at $0.88/h on demand ([verda.com/pricing](https://verda.com/pricing)). Availability during a hackathon rush is **unknown**. Spot instances are forbidden by advice (FAQ) |
| Persistent block volume | Verda | Low. The docs advise it, because instances die (FAQ) |
| Real data: Drop 0 (Fri evening teleop demos), Drop 1 (Sat: venue lighting, empty-scene RGB-D, depth noise) | Hugging Face, with links posted on Discord (participants [README](https://github.com/zupermiez/aaltonomous-humanoid/blob/main/aaltonomous/docs/participants/README.md) timeline) | Medium. The timing is "Fri evening" and "Sat", with no hour given. The licence is still a template placeholder in the [DATA_CARD](https://github.com/zupermiez/aaltonomous-humanoid/blob/main/aaltonomous/data/DATA_CARD.md) |
| Calibration updates (wrist camera extrinsics are `null`, head extrinsics are "Provisional") | Versioned updates during the event, announced on Discord (INTERFACE §6) | **High for real-robot accuracy.** Calibration is baked into the image, so we must rebuild after each update (BASE) |
| Container registry (Docker Hub/GHCR, public, digest-pinned) and the Discord web form | Our own accounts (SUBMISSION §6) | Low. A ≤40 GB push from a cloud box is fine. Keep the image small |
| G1 URDF and Pinocchio | Bundled in the repo and the baseline Dockerfile (SUBMISSION §7) | Low. `pin` 3.3.1 needs numpy ≥2.2 and libgomp1 (SUBMISSION §7) |
| Discord challenge channel | Junction Discord | Required. The deadline time, data links, sim versions and the form link all live there |

No external API is needed. Rely on none: there is no network at the finals (FAQ).

## 4. Documented limits, latency and reliability problems

- **Sim throughput:** one baseline trial takes about 75 s (QS §2), and the sim runs slower than real time. The baseline README measured about 0.65x with 2-3 instances on one host. Estimate: a 20-trial evaluation costs about 25-30 min per sim instance. Running one sim per instance is advised, because training on the same cores starves the sim and fails the rate gate (QS §4). Estimate: we need 2-3 RTX instances running in parallel to iterate quickly. At RTX PRO 6000 rates that is about $8.40/h for 3, or about $250 for 30 h. Whether credits cover that is **unknown**.
- **Wall-clock rate check:** a policy that keeps up only because the sim is slow fails the gate (RULES §4). Any GPU model must answer from a background thread.
- **The sim is "deliberately rough"**. Physics (Dex3 friction, PD gains) is "not yet fitted to the real robot" (PATHS Route 4). A grasp tuned in sim may fail in reality, and that is the main technical risk.
- **The baseline numbers conflict across the docs.** SUBMISSION §7 still says "0/24 sorted (grasps slip)". BASE says that was the old config and the same day's fix gives 29/38 (76 %) through the evaluator. FAQ says 76-82 %. All of these are nominal sim with DR off. **There is no published number for the randomised or held-out variant.**
- **Real-robot track record:** BASE says "Real robot: not run yet (M8)". FAQ says "On the real robot it has done a pick into a bin." No full autonomous real-robot sort is documented.
- **Camera quirks:** a camera with no frame yields an all-zero image, which we must handle. Real observation latency is "not measured yet" (INTERFACE §2). Depth has holes on the dark mat and near the bin walls (DATA_CARD known issues template; PATHS Route 1).
- **Finals hardware:** RTX 5090 (Blackwell). Our image must use CUDA ≥12.8 if it uses the GPU (SUBMISSION §1). GR00T reports torch.compile problems on some Blackwell variants ([Isaac-GR00T](https://github.com/NVIDIA/Isaac-GR00T)). This is another reason to keep the core CPU-only, like the baseline.
- The safety values for the finals "may be tuned on the real robot; they will not get looser" (INTERFACE §5). Estimate: run at about 0.8-0.9 rad/s, not at the cap, to leave margin.

## 5. Integration complexity for our team

| Piece | Our fit | Estimate of effort |
|---|---|---|
| Policy server, Docker, threading, msgpack | Strong (full-stack) | Small. The template exists |
| Instruction parser plus a local LLM fallback | Strong (LLM/agents) | Small (≤4 h), including a paraphrase test set we generate ourselves |
| Perception tuning (HSV/segmentation, depth → pelvis frame, yaw from the depth cloud) | Strong (CV/ML) | Medium (6-10 h) |
| Grasp redesign for triangles and cylinders, regrasp detection from `hand_q` and the wrist camera | **Weak**. Contact manipulation is new to us | Large and uncertain (10-15 h of trial and error in a slow sim) |
| Two-arm parallel scheduling without arm-arm collision (the filter does not check this) | Medium | Medium (6-8 h) |
| Sim-to-real calibration from the drops | Medium (data pipelines) | Medium. It depends on when the drops arrive |
| VLA fine-tune (optional track) | Medium (ML) | Large. 80 GB GPUs, and data arrives late on Friday |

The overall complexity is high, but almost all of it is in Python we can run in parallel across agents. The bottleneck is **sim wall time and grasp physics intuition**, not typing speed. Running many agents in parallel helps less here than it does on web challenges, because each experiment needs about 75 s of sim per trial on scarce RTX GPUs (estimate).

## 6. Does it fit in 40 h? The smallest complete version

**Smallest complete version (MVP), estimated at 10-14 h:**
1. Copy the baseline submission and get the sim running on a Verda RTX instance (about 1-2 h, including the 30 GB pull and shader compile).
2. Add a rung-2 parser: deterministic rules for colour→bin plus a fallback to the fixed mapping. Return `done` when nothing sortable is left.
3. Re-tune for `AALTO_DR=train` so it still passes the gate with 0 clips. Build, run `replay --synthetic`, run `evaluate` for 20 trials on both tasks, then submit by digest.

This is a legal, gate-passing entry that covers both scored rungs. It probably does **not** reach the top 5 on its own, because every team can copy the baseline (estimate).

**Strong version (target, 30-36 h):** the MVP, plus:
- yaw-aware pinch grasps that fix triangles;
- both arms working in parallel and faster trajectories, to fit 5 objects in 120 s;
- grasp verification and one regrasp;
- HSV and depth fitted to Drop 1;
- a small local LLM fallback for paraphrases (negation, shape words);
- our own held-out DR evaluation and an ablation table for the pitch.

Leave about 4 h of margin before the Sunday deadline, whose time is **unknown**, for the final build, gate check and submission.

**Suggested split (estimate):**
- Person A owns the server, the parser, the build pipeline and the eval harness. Set up continuous 20-trial evaluations from hour 2.
- Person B owns perception and calibration against the drops.
- Person C owns grasp and motion.
- Optional from Saturday: whoever is ahead runs a small ACT/Diffusion Policy experiment on the drops for the originality story. It must never block the submission.

## 7. Likelihood of a successful live demo, and what would make it fail

"Live demo" here means the organisers run our image on Väiski on Sunday. We cannot rehearse it (RULES §6). The estimated chain of probabilities:

| Step | Estimate | Main failure modes |
|---|---|---|
| Image passes the pre-check and the sim gate | about 90 % | One clipped step anywhere (e.g. a target beyond the URDF limit on the Dex3, or a velocity spike on replan). Wall-clock rate under 27 Hz. Startup over 120 s if we bake in a large model. A crash on an all-zero frame |
| Top ~5 on the held-out sim (different textures, lighting, camera jitter) | about 40-55 % | HSV tuned to training textures. Other strong teams. Number of competing teams **unknown** |
| Real robot sorts most objects in 3 episodes without negative points | about 40-50 % given we are a finalist | Provisional calibration leaves a 1-2 cm offset, which misses a 45 mm object. Venue lighting washes out HSV (BASE: lit tops are already washed out in sim). Depth holes. Triangles slip. Knocked-off objects (−1 each). Self-collision or fingertips on the table cause an e-stop (not filtered). The time limit changes. The unseen instruction (×1.5) uses negation or shape and our parser misreads it (−1 per wrong bin) |

Estimated combined chance that we reach the real robot and do well: about 15-25 %. Estimated chance that a finals run shows *something* working (at least one correct sort), given we qualify: about 70 %. If we do not qualify, the presentation can only show sim videos. That weakens the 40 % real-world criterion and the overall-jury story.

## 8. What to ask the sponsor on site before committing (Friday, at kickoff)

1. Has the baseline (or any autonomous policy) sorted a full episode on the real robot yet? What success rate did it reach on the real robot versus in sim?
2. Are there **any practice or dry-run slots** on the real robot for teams, or replays of our image against recorded real observations? Is the "finals dry run" (SUBMISSION §7) open to teams?
3. What is the exact Sunday submission deadline, and when will finalists be picked? Can we resubmit after the finalist cut?
4. When exactly do Drop 0 and Drop 1 land, and when do the wrist camera extrinsics and the head AprilTag calibration land?
5. Finals settings: number of objects, time limit, and whether the unseen instruction uses negation, shape or distractors.
6. How do the 40/25/20/15 criteria combine with the raw real-robot score? Is there a separate pitch, and how long is it?
7. How many teams are registered for this challenge?
8. How many Verda credits does each team get, and are RTX PRO 6000 or L40S instances actually available on demand this weekend?
9. Will the finals PC have any network? (We plan none.)
10. What is the licence of the drops? Can demo videos from the real robot be used in our overall-final pitch?

## 9. Verdict

- **Buildability: good.** The starter kit is unusually complete, and the work fits our ML, CV and full-stack skills.
- **Reliability: poor, and not under our control.** Two gates (the held-out sim ranking and an unrehearsed 3-episode real run) sit between us and a win. The sponsor's own baseline has no documented full real-robot sort.
- Choose this challenge only if the team accepts a roughly 15-25 % chance at the partner prize (estimate), in exchange for a very strong overall-jury story if it works.
- Before committing, get answers to questions 1, 2 and 7.

<!-- complete -->
