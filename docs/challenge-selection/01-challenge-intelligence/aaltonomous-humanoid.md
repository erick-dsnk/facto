# Aaltonomous Humanoid (Aalto University)

**Summary**
- The task is to write an autonomous policy for Aalto's Unitree G1 humanoid ("Väiski"). It has to sort 3-5 coloured 4.5 cm blocks into three fixed boxes within 120 s. It sorts by a fixed colour mapping (rung 1) and by a free-text instruction (rung 2) (CHALLENGES.md:L1163-L1170). You hand in a Docker policy server. It answers at 30 Hz with head RGB-D, two wrist RGB images and joint states as input, and returns joint targets (CHALLENGES.md:L1173, L1179).
- How the prize is decided: the organisers score submissions in a held-out Isaac Sim variant, about 5 finalists run on the real robot on Sunday, and **the best real-robot score wins** (CHALLENGES.md:L1180, L1277). The sponsor criteria are real-world result 40%, generality 25%, originality 20% and presentation 15% (CHALLENGES.md:L1253-L1267). The prize is €2,000 plus a visit to the Aalto robotics lab (CHALLENGES.md:L1273).
- Physical hardware work for us is **zero**. Teams never touch the robot (CHALLENGES.md:L1241). This is still a hard sim-to-real robot-learning problem with GPU-heavy infrastructure. Our ML, data and agent skills apply directly. The risk is grasp physics and calibration, not electronics.
- My estimate: it is technically very hard (8/10), and the published classical baseline sorts 0/24 objects in the sim runner. A single robust real-robot run is a vivid demo for the overall jury. This challenge also stacks naturally with the Verda compute tech challenge.

---

## 1. Database record

| Field | Value | Source |
|---|---|---|
| Challenge | Aaltonomous Humanoid | CHALLENGES.md:L1143 |
| Sponsor | Aalto University. The starter brief names the organisers as "DigiTwin (Aalto)" | CHALLENGES.md:L1147; [README.md](https://github.com/zupermiez/aaltonomous-humanoid/blob/main/aaltonomous/docs/participants/README.md) "Contact" |
| Track | Hardware Track by Arduino. This is the nearest `##` heading above the challenge. The challenge itself has nothing to do with Arduino | CHALLENGES.md:L780 |
| Main requirement | "Make the G1 sort objects into boxes on its own, without a human controlling it." | CHALLENGES.md:L1163 |
| Judging emphasis and weights | Real-world result 40% ("How well it works on the real robot"), Generality 25% ("Holds up when things change"), Originality 20%, Presentation 15% | CHALLENGES.md:L1253-L1267 |
| How the winner is actually picked | The starter repo's rules say: "Final ranking = real-robot score. Sim score breaks ties." The challenge page says "The best real-robot score wins". How the four weighted criteria combine with the raw robot score is **unknown**. My reading is that the robot score dominates | CHALLENGES.md:L1180; [RULES_AND_SCORING.md §5, §8](https://github.com/zupermiez/aaltonomous-humanoid/blob/main/aaltonomous/docs/participants/RULES_AND_SCORING.md) |
| Prize | Winner: 2,000€ + a visit to the Aalto robotics lab. Top ~5 (chosen by sim performance): run live on the real G1 (not a cash prize) | CHALLENGES.md:L1271-L1277 |
| Provided hardware | A real Unitree G1 with Dex3 three-fingered hands at the venue. Teams have no direct access | CHALLENGES.md:L1200, L1241 |
| Provided software | A Docker image with Isaac Sim, Isaac Lab and the challenge scene. Starter code: robot interface, safety filter, classical baseline, policy-server and Dockerfile templates, sim evaluator | CHALLENGES.md:L1201, L1204 |
| Starter repo | https://github.com/zupermiez/aaltonomous-humanoid (MIT licence, last pushed 2026-11-13 per the GitHub API) | CHALLENGES.md:L1209 |
| Provided data | Real-robot teleop demos in LeRobot format on Hugging Face, released during the event (Drop 0 Friday evening, more on Saturday). There are about 20 per rung, and they are raw (failed and messy episodes included) | CHALLENGES.md:L1178, L1203; [FAQ.md "Data"](https://github.com/zupermiez/aaltonomous-humanoid/blob/main/aaltonomous/docs/participants/FAQ.md); [STARTER_PATHS.md Route 3](https://github.com/zupermiez/aaltonomous-humanoid/blob/main/aaltonomous/docs/participants/STARTER_PATHS.md) |
| Compute | GPUs from Verda. The sim needs an RTX-class GPU with ≥24 GB and "will not render on A100 or H100". The repo FAQ says "we don't allocate compute", so teams get their own GPUs from Verda | CHALLENGES.md:L1202, L1215; FAQ.md "Compute" |
| Mentors | Erkka Lehtonen and Viktor Solianoi on site, plus about 30 Aalto Robotics Club volunteers | CHALLENGES.md:L1205, L1237 |
| Submission | A Docker image (linux/amd64, CUDA ≥12.8) that serves a websocket/msgpack policy server on port 8000. It must be listening within 120 s, carry its weights inside the image, fit in 32 GB VRAM (RTX 5090) and be ≤40 GB. Push it to a registry and submit the digest through a web form linked on Discord. The last image before Sunday's deadline is the one that runs | CHALLENGES.md:L1179, L1233; [SUBMISSION.md §1, §6](https://github.com/zupermiez/aaltonomous-humanoid/blob/main/aaltonomous/docs/participants/SUBMISSION.md) |
| Final deadline time | "Sunday, time announced by the organisers". The exact time is **unknown** | SUBMISSION.md §6 |
| Pitch/presentation format for this challenge | **unknown** (only the 15% presentation criterion is stated) | CHALLENGES.md:L1265-L1267 |

Note: the "Company Info" blurb describes an unrelated Aalto project, AR4U, a voice AI companion for older adults (CHALLENGES.md:L1247). It looks like boilerplate and does not bear on this challenge.

## 2. What the sponsor is actually trying to encourage

My reading: Aalto/DigiTwin want to see **data-efficient sim-to-real robot learning**, that is, getting a real humanoid to do dexterous manipulation from mostly simulation plus a handful of real demos. They also want teams to push past their own weak baseline.

Evidence:
- The brief's tagline is "**Sim is free, reality is scarce.**" It describes the method as "using mostly simulation and a handful of real demonstrations. Then it has to survive reality" ([README.md "The pitch"](https://github.com/zupermiez/aaltonomous-humanoid/blob/main/aaltonomous/docs/participants/README.md)).
- "What we'd love to see": "Solutions that still work when the real world doesn't match the simulation exactly", "General ideas that could work beyond a single task", and "Clever ways to do a lot with very little real-world data" (CHALLENGES.md:L1188-L1194).
- The sim is "deliberately rough", and "making it match reality ... is part of the challenge" (README.md "Sim and data: rough on purpose"). The real data is "scarce on purpose" (STARTER_PATHS.md Route 3). There is "deliberately **no skill API**" (STARTER_PATHS.md intro).
- The judges hold out a sim variant with different textures, lighting and poses, and the hardest final episode (an unseen instruction) is weighted ×1.5 (RULES_AND_SCORING.md §4-§5). Both reward generalisation over overfitting.
- The method is open: "Any approach is welcome ... Combinations will probably work best" (CHALLENGES.md:L1186).
- Inference: a research lab gets free exploration of methods (VLA fine-tuning, real2sim, VLM planners) on its own robot, plus recruiting exposure ("a visit to the Aalto robotics lab").

## 3. Explicit requirements (quoted)

From CHALLENGES.md:
- "Make the G1 sort objects into boxes on its own, without a human controlling it." (L1163)
- "The robot has to put every object into the right box within **2 minutes**." (L1167)
- "**Fixed sorting:** red objects go into the left box, yellow into the centre box, blue into the right box." (L1169)
- "**Sort by instruction:** a text instruction defines which box each object goes into ... Expect phrasings you haven't seen before." (L1170)
- "**Stretch goal:** put each object through the matching hole in a lid on one box." (L1171)
- "Your policy sees the head camera (colour + depth), both wrist cameras, the joint states and the instruction, and sends back target positions for all arm and finger joints, 30 times a second." (L1173)
- "**Submit a Docker image:** your solution runs as a small policy server in a container." (L1179)
- "To run on the real robot, a solution must pass our safety check in simulation: no crashes or safety stops, no commands over the joint and speed limits, and at least 27 commands per second." (L1233)
- "Code has to pass the safety checks in simulation before it runs on the real robot." (L1241)

From the starter repo:
- Scoring per object: +1 correct (rung 1), +2 correct (rung 2), −1 wrong bin, −1 knocked off, 0 left on the counter. Insert-shapes scores +3 or −1 ([RULES_AND_SCORING.md §3](https://github.com/zupermiez/aaltonomous-humanoid/blob/main/aaltonomous/docs/participants/RULES_AND_SCORING.md)).
- Finals: "**3 episodes**, scored on the real robot only: 1. `sort_fixed` 2. `sort_language` with a known (training) template 3. `sort_language` with an unseen instruction and layout — **weight ×1.5**" (RULES_AND_SCORING.md §5).
- Sim gate: "**0 clipped steps** ... every target must already respect the safety limits, including the velocity cap" (1 rad/s for arms, 3 rad/s for hands). The command rate must be ≥27 Hz, measured against **wall time** as well as the sim clock (RULES_AND_SCORING.md §4, §6).
- Per call: "up to **30 s per call** ... a longer call ends the episode", and "1 s of errors ends the episode" (SUBMISSION.md §2).
- "Weights | **Inside the image.** No downloads at startup"; "Must fit in **32 GB VRAM**"; "Listening **within 120 s**" (SUBMISSION.md §1).

## 4. What a mediocre submission looks like

Estimate, based on the baseline numbers in the repo:
- A lightly tuned copy of the classical baseline (HSV colour thresholding, depth, IK, top-down claw grasp). It handles rung 1 only and maybe adds a regex parser for the 8 training templates.
- The baseline reaches 76-82% of objects sorted in the nominal sim in-process. The same baseline scores "**0/24 sorted** (grasps slip)" in the Isaac runner with randomisation ([FAQ.md "The baseline"](https://github.com/zupermiez/aaltonomous-humanoid/blob/main/aaltonomous/docs/participants/FAQ.md); SUBMISSION.md §7). A mediocre team ends up somewhere in that range on the held-out variant.
- Or: an ambitious VLA fine-tune (π0/GR00T) on about 20 real demos that never reliably grasps. Or a VLM planner that blows the 27 Hz gate or depends on venue Wi-Fi with no offline fallback (FAQ.md warns: "Have an offline fallback").
- Either way it probably fails the 0-clip gate or does not reach the top ~5 sim ranking, so it never runs on the real robot. That leaves about 40% of the score unreachable (my inference from CHALLENGES.md:L1180, L1253-L1255).

## 5. What an exceptional submission would demonstrate

Estimate:
- **Reliable real-robot sorting.** All objects land in the right bins in all 3 final episodes, including the ×1.5 unseen-instruction episode, with zero knocked-off objects. Robust grasps on triangles and cylinders, where the baseline slips. Both arms used in parallel to beat the 120 s budget (STARTER_PATHS.md Route 1 lists these failure modes).
- **Generality by design.** Open-vocabulary perception (e.g. Grounding DINO/SAM 2), a language-to-mapping step that handles paraphrases and harder knobs (negation, colour plus shape; STARTER_PATHS.md "Difficulty knobs"), and a policy that does not depend on exact poses or lighting. Shown with held-out ablations of our own.
- **A sim-to-real story built on very little real data.** Examples: fitting the sim to the Drop 0/1 captures (textures, depth noise, Dex3 friction), domain randomisation, or Mimic-generated synthetic demos. The quantitative evidence would be a sim-versus-real success table (STARTER_PATHS.md Routes 3-5).
- A hybrid architecture is the likely winner. For example: a classical or learned skill layer for precision, an RL-refined grasp, and an LLM/VLM or a small local model for instruction parsing, all run asynchronously so the policy keeps returning targets at ≥27 Hz. The organisers say "hybrids are probably where the best results come from" (STARTER_PATHS.md intro).
- Optionally, rung 3 (insert shapes) working in sim, shown as a bonus.
- A clear 3-minute presentation of why it generalises (15%).

## 6. Constraints that could disqualify a project

From the rules, any of these keeps a team off the real robot or out of contention:
- Failing the sim gate: any safety abort, watchdog or safe stop, a policy call over 30 s, a crash, a lost connection, **any clipped step**, or a command rate under 27 Hz in sim time or in the team's own wall-clock latency (RULES_AND_SCORING.md §4).
- Failing the pre-check: an image that is not linux/amd64, is over 40 GB, does not listen within 120 s, or fails the synthetic replay at ≥27 Hz (SUBMISSION.md §6).
- Weights downloaded at startup instead of baked into the image, or exceeding 32 GB VRAM (SUBMISSION.md §1).
- "Not allowed": commanding the robot outside the organisers' runner; training or tuning on the held-out sim variant or its seeds; trying to reverse-engineer held-out configs, seeds or templates; "Using privileged sim state (scene service object poses) inside a submission"; "Hard-coding layouts" (RULES_AND_SCORING.md §7).
- Relying on an external API with no fallback. "we provide no network", and "a failed call counts as a failure ... no reruns" (SUBMISSION.md §1; FAQ.md).
- Missing the Sunday deadline (time **unknown**, announced on Discord; SUBMISSION.md §6).
- Not reaching the top ~5 in sim means no real-robot run. You are not disqualified, but you cannot win, because the final ranking is the real-robot score (CHALLENGES.md:L1277; RULES_AND_SCORING.md §5).
- Whether Junction's general rules (e.g. a Devpost/project submission) also apply to this challenge is **unknown** from these sources.

## 7. How much physical hardware work this demands

- **Hands-on hardware: none.** "Teams never control the robot directly." The organisers run our Docker image through their safety filter while staff stand at the e-stop (CHALLENGES.md:L1241). "Nobody touches the robot. Teams never get direct access to Väiski, DDS, SSH or the robot network" (RULES_AND_SCORING.md §6). There is no wiring, soldering, firmware or device debugging.
- **But it is real robotics in software.** Teams handle inverse kinematics (Pinocchio/URDF), 30 Hz joint-space control under velocity caps, camera calibration and extrinsics (the wrist cameras' poses are "Unknown yet"; INTERFACE.md §6), grasp contact physics, and sim-to-real transfer. My estimate is that this is closer to ML research than to embedded work. It suits our ML and data science strengths, but nobody on the team has hands-on manipulation experience.
- **Infrastructure overhead (estimate):** cloud RTX GPUs from Verda, where on-demand instances are required because spot instances can vanish (FAQ.md). The first sim start takes 5-10 min (CHALLENGES.md:L1226), and the bare-metal setup takes 30-40 min (CHALLENGES.md:L1231). VLA fine-tuning needs 80 GB GPUs (STARTER_PATHS.md Route 3). Real-world feedback is limited to the data drops and the finals run itself. We cannot test our own policy on the real robot before the finals, as far as the sources say; whether there are practice slots is **unknown**.
- **Hardware dependence rating:** "provided-kit". The physical robot is essential to the outcome (40% of the score, and it decides the winner), but the team's interaction with it is fully mediated by the organisers.

## Side notes for later stages

- **Stacking:** the Verda Compute tech challenge rewards projects that need GPUs. Its examples mention robot demonstrations (_tech-challenges.md, citing CHALLENGES.md:L2138-L2142), so it pairs naturally with this challenge (my inference).
- **Overall-win angle (estimate):** a humanoid sorting blocks live from a typed instruction is very demo-able on stage. The risks are that the real-robot slot happens on Sunday under organiser control, and that it may fail on the day.
- The jury PDF (00-Jury-profiles-and-pitch-guide.pdf) has no robotics-specific judge content for this challenge (grep for "humanoid" and "robot" returned nothing relevant).

<!-- complete -->
