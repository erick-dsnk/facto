# Aaltonomous Humanoid: opportunity discovery (Agent C)

**Summary**
- Most teams will pick one of the organisers' five starter routes and tune it (competitive.md §4). The open gaps are in the parts around that work. The sim physics is deliberately unfitted to the real robot. The roughly 20 real demos per rung are raw and unlabelled for quality. The ×1.5 unseen instruction punishes misreads. Nothing in the starter kit checks whether a grasp actually worked.
- Five opportunity areas follow: (1) measured real-to-sim calibration from the real data drops, (2) treating the raw demos as a source of grasp parameters instead of imitation targets, (3) closed-loop self-verification with safe abstention, (4) a typed, offline, abstaining instruction compiler, (5) a throughput and bimanual scheduling layer. Areas 1-3 are where the originality and generality points are. Areas 4-5 are where the score points are.
- Honest stacking: Verda Compute (strong, because the sim cannot run on a laptop), Codex (dev process), Gemma (only if a small Gemma model is baked into the image as the offline parser). Anything that calls a cloud API at run time conflicts with the "no network" rule.
- Estimates: differentiation 6/10, demo 6/10, overall-jury fit 5/10. The visual is excellent, but the real-robot run is organiser-controlled and cannot be rehearsed, and the "specific user" story is weak.

Sources: CHALLENGES.md:L1143-L1279 and the starter repo docs: [STARTER_PATHS.md](https://raw.githubusercontent.com/zupermiez/aaltonomous-humanoid/main/aaltonomous/docs/participants/STARTER_PATHS.md) (opened) and [FAQ.md](https://raw.githubusercontent.com/zupermiez/aaltonomous-humanoid/main/aaltonomous/docs/participants/FAQ.md) (opened). The RULES, INTERFACE, SUBMISSION and baseline README details are taken from Agent A's and Agent D's reports (`01-challenge-intelligence/aaltonomous-humanoid.md`, `feasibility.md`), which cite them. Everything labelled "estimate" or "inference" is my own judgement.

---

## Context a teammate needs (30 seconds)

- Task: an autonomous Docker policy server makes Aalto's Unitree G1 humanoid sort 3-5 coloured 4.5 cm blocks into three unmarked boxes (left, centre, right) in 2 minutes. The mapping is either fixed (red→left, yellow→centre, blue→right) or set by a free-text instruction with "phrasings you haven't seen before" (CHALLENGES.md:L1163-L1170).
- Inputs are head RGB-D, two wrist RGB cameras, joint states and the instruction. The output is arm and finger joint targets at 30 Hz (CHALLENGES.md:L1173).
- Finalists are chosen in a held-out sim. The winner is the best real-robot score on Sunday (CHALLENGES.md:L1180). The criteria are real-world 40%, generality 25%, originality 20% and presentation 15% (CHALLENGES.md:L1253-L1267).
- The sponsor's own wish list: "Solutions that still work when the real world doesn't match the simulation exactly", "General ideas that could work beyond a single task", "Clever ways to do a lot with very little real-world data" (CHALLENGES.md:L1188-L1194).

---

## Opportunity 1: Measured real-to-sim calibration from the data drops ("close the gap, and prove it")

**Gap.** The sim is rough on purpose, and the physics is not fitted to the real robot. STARTER_PATHS Route 5 lists what could be done: "re-texturing from drop captures, lighting, depth noise models, Gaussian splats of the counter, and Dex3 friction/PD fitting". It also says the organisers have only fixed basic calibration (camera mounts, intrinsics, dimensions) ([STARTER_PATHS](https://raw.githubusercontent.com/zupermiez/aaltonomous-humanoid/main/aaltonomous/docs/participants/STARTER_PATHS.md), opened). No published number shows how well sim success predicts real success. The baseline has done only "a pick into a bin" on the real robot ([FAQ](https://raw.githubusercontent.com/zupermiez/aaltonomous-humanoid/main/aaltonomous/docs/participants/FAQ.md), opened). Agent B expects most teams to apply domain randomisation "without numbers" (competitive.md §4-§6).

**Evidence that it is tractable now.**
- The real teleop demos give joint trajectories paired with real camera frames (LeRobot v3.0 with head depth; STARTER_PATHS Route 3). Replaying the *same* joint commands in sim and comparing the result (did the object move, slip or lift) gives a paired sim/real signal without ever touching the robot. That last step is my inference. Whether replaying a demo in sim is supported out of the box is **unknown**.
- Recent work turns paired sim/real video into physics-parameter updates. Vid2Sid puts a VLM in the system-identification loop: it compares paired sim and real videos, diagnoses mismatches and proposes parameter updates with rationales ([arXiv 2602.19359](https://arxiv.org/abs/2602.19359), opened). PolaRiS turns short video scans of real scenes into simulation environments that correlate more strongly with real policy performance than existing sim benchmarks ([arXiv 2512.16881](https://arxiv.org/abs/2512.16881), opened). A search snippet for a related paper reports r > 0.9 for Gaussian-splat real2sim evaluation against r = 0.649 for an Isaac Lab baseline ([arXiv 2511.04665](https://arxiv.org/abs/2511.04665), snippet only, not verified).
- Before VLMs could read video, this needed a hand-tuned optimiser or a human expert. A VLM-in-the-loop calibration is the "impractical before recent AI" angle (inference).

**Why the sponsor cares.** This is their headline: "Sim is free, reality is scarce" (participants README, per Agent A). A fitted Dex3 friction and PD model, or a depth-noise model, is something the DigiTwin lab could keep after the event (inference). It hits generality (25%) and originality (20%) directly, and it supports the real-world 40% by making sim results predict real ones.

**How it reads to the overall jury.** Strong on "honest measured evidence" (15%): a before/after chart of the sim-vs-real mismatch, with the number of real episodes used. A side-by-side video (real teleop clip next to the sim replay, before and after fitting) is legible in 30 seconds. The "specific user" is robotics labs that cannot afford real-robot time. That is credible but niche (estimate).

**Risk.** Data drops arrive "Friday evening, more on Saturday" (FAQ), which leaves maybe 24-30 h. Agent D notes that the wrist-camera extrinsics are still null and that calibration updates force image rebuilds (feasibility.md §3). Fitting physics in a slow sim (about 75 s per trial, feasibility.md §4) is compute-bound. Scope it to one or two parameters (pinch friction, depth noise) (estimate).

## Opportunity 2: Raw demos as a parameter source, not imitation targets ("learn from 20 messy demos")

**Gap.** The real data is "**raw**: successful, failed and messy episodes together", and "decide yourself what is good data" from the success label and warnings in `meta/aalto_episodes.jsonl` ([FAQ](https://raw.githubusercontent.com/zupermiez/aaltonomous-humanoid/main/aaltonomous/docs/participants/FAQ.md), opened). There are "About 20 per rung — scarce on purpose" (STARTER_PATHS Route 3). The obvious use, fine-tuning a VLA on them, needs 80 GB GPUs and is exposed to the visual sim-to-real gap (STARTER_PATHS Route 3; feasibility.md §2). Agent B lists "fine-tune GR00T/SmolVLA on the released demos" as the idea to avoid presenting as *the* idea (competitive.md §4).

**The underused angle.** Twenty human teleop grasps on the *real* Dex3 hold exactly what the classical baseline gets wrong. They show how a human closes the fingers on triangles and cylinders (the baseline's main failure: "most misses are triangles (the pinch slips)", FAQ), the approach yaw relative to the object, and the release height over the bin. Mining successful episodes for grasp parameters (finger closure profile, approach offsets per shape) and failed ones for anti-patterns gives a skill layer that real data has calibrated without imitation learning (inference). A VLM or automatic triage pass (success labels plus a vision check of whether the object ended in the bin) turns "judging which are good is part of the challenge" into a tool.

**Why the sponsor cares.** It answers "Clever ways to do a lot with very little real-world data" (CHALLENGES.md:L1194) more literally than a VLA fine-tune does. An automatic demo-quality scorer is reusable for any lab collecting teleop data (inference).

**How it reads to the overall jury.** The idea is clear ("we didn't copy the human, we learned *how* the human grips"), with a before/after grasp-success number on triangles. Peer reviewers will find it less flashy than Opportunity 3 (estimate).

**Risk.** Whether teleop joint trajectories transfer to the baseline's IK frame without calibration error is **unknown**. The number of successful triangle grasps among about 20 episodes per rung is **unknown**.

## Opportunity 3: Closed-loop self-verification and safe abstention ("a robot that knows when it failed")

**Gap.** The baseline is a waypoint state machine (competitive.md §1, citing STARTER_PATHS). Neither the starter docs nor the FAQ say anything about grasp verification or recovery (STARTER_PATHS fetch: "Not covered: wrist camera verification, recovery behaviour"). The scoring makes safe failure valuable. A wrong bin or a knocked-off object costs −1, while an object left on the counter scores 0 (RULES §3, per Agent A). The safety filter does not check self-collision or fingertips touching the table, and staff will stop the run (INTERFACE §5, per feasibility.md §1).

**Capability that makes it possible.** Two wrist RGB cameras and `hand_q` are already in the observation (CHALLENGES.md:L1173), yet the baseline does not use the wrist cameras for decisions (inference from STARTER_PATHS' baseline description: HSV plus head depth). Cheap checks are possible: "object between fingers" from the wrist camera plus finger-joint error, "object now inside bin region" from the head camera, and "instruction confidence". Together they allow a regrasp-or-skip policy. A small open-vocabulary detector or a VLM can run asynchronously from a background thread, because held ticks do not count toward the 27 Hz rate (STARTER_PATHS Route 2).

**Why the sponsor cares.** Robustness when "the real world doesn't match the simulation" (CHALLENGES.md:L1190) means detecting a mismatch and reacting to it. It also protects the real-world 40% from −1 penalties (estimate). It is general: verification applies to any pick-and-place task.

**How it reads to the overall jury.** This has the best visible before/after in the challenge. Show a clip of a slip, the robot noticing it and regrasping, next to the baseline dropping the triangle. "Self-awareness" is an intuitive story at the peer table in under 60 s (estimate). It also counts as distinctive technical depth.

**Risk.** Each regrasp costs time against 120 s (and a possible 90 s finals knob, STARTER_PATHS "Difficulty knobs"). Wrist-camera extrinsics are not yet published (feasibility.md §3), so the checks should be image-level, not geometric (estimate).

## Opportunity 4: A typed, offline, abstaining instruction compiler for the ×1.5 unseen instruction

**Gap.** Rung 2 scores +2 per object, and the final unseen-instruction episode is weighted ×1.5 (RULES §3, §5, per Agent A). STARTER_PATHS lists "held-out instruction paraphrases" as a harder knob, and Agent D adds colour plus shape and negation (feasibility.md §2). There is "no network" at the finals, so "Have an offline fallback" ([FAQ](https://raw.githubusercontent.com/zupermiez/aaltonomous-humanoid/main/aaltonomous/docs/participants/FAQ.md), opened). Frontier VLMs take "~10-20 s per call" (STARTER_PATHS Route 2). Most teams will do regex or a cloud LLM (competitive.md §4). A misread costs −1 per object, which is a worse outcome than leaving objects on the counter.

**What is new.** A small open-weights LLM baked into the image, decoding under constraints into a typed mapping (`{colour|shape → bin}`), checked by a deterministic consistency check (every object has exactly one bin; negations resolved), and able to abstain to the fixed mapping or skip an object when confidence is low. Its robustness can be measured on a self-generated adversarial paraphrase set (we must not touch the held-out templates; RULES §7 per Agent A). Inference: running this reliably on a local 32 GB GPU with no network only became practical with 2025-26 small models.

**Why the sponsor cares.** It is generality (25%) in its cleanest form, and it directly protects the most heavily weighted finals episode.

**How it reads to the overall jury.** It is legible: let a peer type a weird instruction at the table and watch the sim robot obey it. On its own it is not distinctive, because "LLM reads the instruction" is the obvious idea (competitive.md §4). It needs to be framed as "it never guesses" with a measured paraphrase accuracy (estimate).

**Stacking.** If the parser is a Gemma model baked into the image, it is an honest entry for Best Use of Gemma, whose text allows self-run Gemma models (_tech-challenges.md row 10, CHALLENGES.md:L2546-L2584). Whether Gemma's judges value an offline parser is **unknown**.

## Opportunity 5: Throughput and bimanual scheduling within the time budget

**Gap.** Each pick takes about 10-20 s against a 120 s budget, and time is one of the baseline's two main failure causes ("most misses are triangles ... and the 120 s limit", FAQ). Objects near the centre line need the other arm, and the baseline does not run both arms in parallel (STARTER_PATHS Route 1, per feasibility.md §2). The finals time limit may drop to 90 s (STARTER_PATHS "Difficulty knobs"). The safety filter caps arm velocity at 1 rad/s and the sim gate allows zero clipped steps (feasibility.md §1).

**Angle.** A planner that orders the objects, assigns each to an arm by reachability and bin side, and overlaps the two arms' trajectories without collision. Trajectories would be pre-checked offline against the safety filter, with a velocity margin (feasibility.md §4 suggests 0.8-0.9 rad/s). This is classical task and motion planning. It is a score lever, not an originality lever (estimate).

**Why the sponsor cares / jury.** It lifts the real-world 40% directly. To the overall jury, a humanoid using both hands at once looks impressive in a 20-second clip (estimate). On its own it reads as engineering polish.

## (Optional) Stretch: lid insertion (rung 3)

Rung 3 scores +3 per object (RULES §3, per Agent A). Its clearance knob may tighten from +10 mm to +3 mm (STARTER_PATHS). It is almost certainly a sim-only bonus for us (estimate), so I would not use it as a direction. It is worth one slide only if Opportunity 1's fitted physics makes it work.

---

## Combinations that produce something new (inference)

- **1 + 3: "calibrated self-checks".** Verification thresholds (for example how much finger-joint error means a slip) come from the real drops instead of from the sim. That links "little real data" to "robust when reality differs" in a single mechanism.
- **2 + 3: failure-aware skills.** Failed demos supply the negative examples that the slip detector needs.
- **4 + 3: abstention everywhere.** The same "don't guess, score 0 instead of −1" principle runs through language, perception and grasping. That makes a coherent story for the 15% presentation and for the jury's "distinctive insight".

## Stackable tech challenges (honest assessment)

| Tech challenge | Fit | Why |
|---|---|---|
| Verda Compute Track | **Strong** | The sim needs RTX-class cloud GPUs (CHALLENGES.md:L1215), and the brief already names Verda (CHALLENGES.md:L1202). Verda's criteria ask what compute enabled that a laptop could not, and its examples include robot demonstrations (_tech-challenges.md, CHALLENGES.md:L2138-L2142, L2184). Parallel sim calibration sweeps (Opp. 1) are a natural showcase. A Discord summary post is required (L2156). |
| Best Use of Codex | Good, low effort | Dev-process claim, explicitly stackable with any challenge (CHALLENGES.md:L2434). Scoring detail is **unknown**. |
| Best Use of Gemma | Conditional | Only if a Gemma model is the offline parser or verifier inside the image (Opp. 4). It must be central and visible (_tech-challenges.md row 10). |
| Best Use of Gemini API | Weak to conditional | It cannot run at finals (no network). It could only drive dev-time tooling such as demo triage (Opp. 2) or VLM sysID (Opp. 1). Whether that counts as "meaningful use" is **unknown**. Members must be 18+ (L2518). |
| Best Use of Nemotron | Weak | Nemotron must contribute to the core function (L2608-L2614). A large VL model at runtime conflicts with the 27 Hz and offline constraints. Fitting in 32 GB is **unknown**. |
| Best use of Modal | Weak | Modal requires a live, deployed app (L3221-L3223). The product is a Docker image run by the organisers. Isaac Sim's need for RTX ray tracing on Modal is **unknown**. |
| Others (MongoDB, Tiger Data, Aiven, ElevenLabs, etc.) | Not honest | Only an evaluation-log dashboard would use them, which would read as bolted on. |

## How this reads to the overall jury (from 00-rules-and-jury.md rubric)

- Worthwhile problem with a specific user (20%): **weak to medium**. It is a benchmark task. The best framing is "teaching a €50k humanoid a new chore from 20 demos" for labs and integrators (estimate).
- Distinctive insight and technical depth (20%): **strong** if Opportunities 1, 2 or 3 are the core.
- Working end-to-end live demo (15%): **risky**. The real run is organiser-operated, cannot be rehearsed, and we only get it if we reach the top ~5 in sim (CHALLENGES.md:L1277; feasibility.md §7). Whether the real run happens before Sunday's 10:30 peer review is **unknown**. Otherwise the table demo is a sim plus recorded video.
- Honest measured evidence (15%): **strong**. Sim-vs-real tables and paraphrase accuracy are exactly that.
- Peer-floor legibility and wow (15%): **strong** if there is a real-robot clip, **medium** with sim only.
- Credible path forward (15%): **medium**. The calibration and verification tools are reusable by the Aalto lab.

## Estimates

- **Differentiation potential: 6/10.** The starter routes are public and most teams will follow them (competitive.md). Measured real2sim with VLM-in-the-loop calibration, plus self-verification, is rare in hackathons, but strong robotics teams may do pieces of it, and the ranking still comes down to the raw real-robot score.
- **Demo potential: 6/10.** A humanoid recovering from a slip or obeying a strange instruction is a top-tier visual. But there is about a 15-25% chance of a strong real run (feasibility.md §7). Without a real run, the demo falls back to sim video, which is much weaker.
- **Jury fit: 5/10.** It scores high on depth and evidence and low on "specific user". The wow depends on a robot run we do not control, and on staffing a peer table without the robot present (inference: the robot is unlikely to be available at our table).

<!-- complete -->
