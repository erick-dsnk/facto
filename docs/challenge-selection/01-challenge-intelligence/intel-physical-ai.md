# Intel Physical AI Challenge (intel-physical-ai): challenge intelligence

**Summary**
- Ignite Next and Intel give each team a robot station: an SO-101 arm with a leader arm, cameras, a Panther Lake laptop and Duplo bricks. The task is fixed. Teleoperate the arm to record demonstrations, fine-tune a VLA policy in Physical AI Studio, train an Anomalib defect detector, then run the full pick → inspect → sort loop autonomously on the laptop with OpenVINO (CHALLENGES.md:L963-L965).
- Judging is 30% task success, 30% Intel technology integration, 20% dataset and pipeline quality and 20% system efficiency. Prizes are €5,000, €3,000 and €2,000 (CHALLENGES.md:L1004-L1034). Novelty and business value are not scored.
- This is a benchmark-style engineering challenge, not an ideation challenge. You win by getting a reliable, fast loop running on the NPU and GPU, with clean data and metrics. Our ML, data-pipeline and agent skills fit well. The hardware is supplied and pre-integrated (no soldering or wiring), but the work is physical: collecting teleop data, recalibrating, and dealing with lighting and grasp failures on a real arm.
- Overall-win potential (estimate): moderate to low. All 25 teams build the same task, so it is hard to stand out with peer reviewers and the main jury unless the twist is strong. The pitch guide asks physical AI teams to "show a reproducible real-world loop and disclose any simulated component" (jury PDF p.6).

## 1. Database record

| Field | Value | Source |
|---|---|---|
| Challenge | "Stop Simulating, Start Moving: See It. Detect It. Act on It. The Intel Physical AI Challenge" | CHALLENGES.md:L947 |
| Sponsor | Ignite Next x Intel. Ignite Next GmbH (Dresden) issues the terms, and Intel co-delivers | CHALLENGES.md:L951, L1000-L1002; [Challenge Terms PDF](https://drive.google.com/file/d/1nKs-e-4FNk-AoMq1fCeRKM_6mpIkArRt/view?usp=sharing) |
| Track | Hardware Track by Arduino. The challenge sits under the `## Hardware Track by Arduino` heading at L780, and the next track heading is at L1282 | CHALLENGES.md:L780 |
| Main requirement | The arm picks each brick, shows it to the inspection camera and drops it into the "good" or "defective" bowl fully autonomously, using a VLA policy fine-tuned in Physical AI Studio and an Anomalib model, both optimized with OpenVINO and run on the laptop's CPU, GPU and NPU | CHALLENGES.md:L965 |
| Judging and weights | Task success 30% (accuracy, cycle time, robustness to shifted or cluttered bricks). Intel technology integration 30% (OpenVINO Physical AI, Robotics AI Suite, offload to NPU and iGPU). Dataset and pipeline quality 20% (clean teleop data, fine-tuning in Physical AI Studio). System efficiency 20% (inference latency, thermal headroom, power on Core Ultra) | CHALLENGES.md:L1004-L1020 |
| Who judges | A jury appointed by Ignite Next, which may include Intel representatives, using "the criteria announced at the challenge kick-off". Its decisions are final | Terms §3 |
| Prize | 1st €5,000, 2nd €3,000, 3rd €2,000. It is unknown whether the amount is per team or split between members. Prizes cannot be exchanged for cash or transferred and may be replaced by equivalents | CHALLENGES.md:L1022-L1034; Terms §3 |
| Hardware provided | 25 stations, one per team. Each has a Core Ultra Series 3 (Panther Lake) laptop with 64 GB RAM, an SO-101 follower arm with wrist camera and a leader arm, two external cameras (at least one a RealSense D415), Duplo bricks, bowls and markers. The stations are in the Junction Hardware Lab | CHALLENGES.md:L979-L984 |
| Software, compute and data | Cloud GPU instances for policy training, Physical AI Studio, Anomalib, OpenVINO and OpenVINO Physical AI, and Intel's open-source Robotics AI Suite. No dataset is provided: teams record their own demonstrations and create their own defects | CHALLENGES.md:L965, L979, L985-L987 |
| Support | 3-5 Intel robotics and edge AI engineers on site every day, plus a hands-on technical session on Saturday at 12:00 | CHALLENGES.md:L988, L992 |
| Submission requirements | Unknown. No deliverable format (video, repo, live demo) is stated in the text or the terms. The terms only say "the jury may run and test your submission" (Terms §4). A live demo at the station is implied but not stated | Terms §4 |
| Station allocation | 25 stations, "one per team" (L981). How teams get a station (registration, first come or sign-up) is unknown | CHALLENGES.md:L981 |
| Contact | Marvin Müller, Ignite Next | CHALLENGES.md:L996 |

### Tools: what the sponsor docs say
- **Physical AI Studio** is an Apache-2.0 end-to-end imitation-learning framework with a web UI, a Python API and a CLI. Its workflow is record demos → `physicalai fit` → `benchmark` → `export --backend openvino` → `physicalai run --config runtime.yaml`. Policies listed: ACT, Pi0.5, SmolVLA, MolmoAct2, RLDX-1, XR0 and Cosmos3. No release version was shown. Source: [github.com/open-edge-platform/physical-ai-studio](https://github.com/open-edge-platform/physical-ai-studio)
- **OpenVINO Physical AI** is an open-source robotics deployment framework with a unified API for cameras, sensors, models and robot actions. It lists the SO-101 and RealSense as ready-to-deploy, does heterogeneous CPU/GPU/NPU scheduling, supports async and real-time action chunking, and can deploy exported LeRobot models. Sources: [intel.com physical-ai page](https://www.intel.com/content/www/us/en/developer/tools/openvino-toolkit/physical-ai.html) and the repo [openvinotoolkit/physicalai](https://github.com/openvinotoolkit/physicalai)
- **Anomalib** is an anomaly-detection library at v2.7.0. It includes PatchCore, PaDiM, STFPM, WinCLIP and the new few-shot FoundAD, and most models export to OpenVINO IR. Source: [github.com/open-edge-platform/anomalib](https://github.com/open-edge-platform/anomalib)
- **Robotics AI Suite** is Intel's open-source stack (SLAM, vision and control libraries, ROS 2, VLA models): [edge-ai-suites/robotics-ai-suite](https://github.com/open-edge-platform/edge-ai-suites/tree/main/robotics-ai-suite), as linked from the Intel page.
- **Precedent (not opened, seen in search results only):** lablab.ai's "AI Infra Summit Hackathon" apparently ran an Intel track with the same task (SO-101, Physical AI Studio, Anomalib, OpenVINO on Core Ultra Series 3). The page now redirects, so its winners and rubric are unknown.

## 2. What the sponsor is actually trying to encourage
The rest of this section is our reading (an inference), with evidence for each point.
- **Adoption and stress-testing of Intel's new open-source robotics stack on Panther Lake.** OpenVINO Physical AI and Physical AI Studio are recent: Intel announced the framework around May 2026, according to [SiliconANGLE](https://siliconangle.com/2026/05/31/intel-touts-130-plus-edge-design-wins-series-3-launches-openvino-physical-ai-framework/) (search-result title, not opened). 30% of the score is "Intel technology integration", and a further 20% is efficiency measured on Core Ultra (CHALLENGES.md:L1010-L1020). The terms say Intel may use teams' feedback on the tooling free of charge (Terms §4), so the event also doubles as a user test.
- **Proof that edge AI replaces the cloud and the GPU for robotics.** The challenge says you train "on cloud GPUs and run them on Intel Core Ultra" (L959), asks for "how fast the full loop runs on the laptop's CPU, GPU and NPU" (L969), and scores latency, thermal headroom and power (L1020). Teams that keep inference on a cloud or NVIDIA GPU work against the point of the challenge.
- **A low-cost industrial inspection cell story.** The challenge frames the problem as factory inspection that is still done by eye (L959) and asks "how few demonstrations are enough" (L969).
- **Recruiting and founder sourcing for Ignite Next,** a deep-tech scale-up programme: "We are at Junction to meet the builders behind Europe's next robotics companies" (L1002). The terms let Ignite Next nominate teams for follow-on programmes (Terms §3).
- **Explicit hints about what impresses them (L969):** "using the anomaly score to trigger a re-grasp, sharing cameras between policy and inspection, and quantizing models with OpenVINO."

## 3. Explicit requirements (quoted)
- "Start by teleoperating the arm to record demonstrations, then fine-tune a vision-language-action (VLA) policy in Physical AI Studio on cloud GPUs." (L965)
- "In parallel, train an Anomalib model that tells good bricks from defective ones at the inspection point." (L965)
- "the arm picks each brick, shows it to the inspection camera and drops it into the 'good' or 'defective' bowl, fully autonomously, with your models optimized with OpenVINO and running on the laptop's CPU, GPU and NPU." (L965)
- "Teams that get there early can push further with faster cycles, messier brick piles, new defect types or their own twist on the task." (L965)
- "Please read the Challenge Terms before taking part. **By participating in this challenge, you agree to these terms.**" (L975)
- From the terms: "Use the kit only for the challenge and only at the venue. Do not open, modify or remove it from the Hardware Lab." "Delete your files from the laptop before returning it." "Instances may be shut down after the challenge, so back up your work." "you must be at least 18 years old or have the written consent of a parent or guardian." (Terms §1-3)
- From the terms: the jury applies "the criteria announced at the challenge kick-off", so the weights could change at kick-off (Terms §3).

## 4. What a mediocre submission looks like (estimate)
- A policy trained on 50 or so demonstrations from one fixed brick layout. It works when the bricks are placed exactly as during recording and misses grasps when they are shifted. Cycle time is 30 seconds or more per brick.
- An Anomalib PatchCore model trained with default settings and a hand-tuned threshold. It catches the obvious marker defects but is confused by lighting or brick orientation.
- Everything runs on the CPU in PyTorch, or the policy runs through cloud inference. There are no NPU or iGPU numbers, no quantization, and no measurements of latency, power or thermals.
- The demo is one cherry-picked successful run on video, with no success rate over N trials.

## 5. What an exceptional submission would demonstrate (estimate)
- **Measured reliability.** For example, 20+ consecutive bricks with a reported accuracy, a cycle time in seconds per brick, and success rates on nominal, shifted and cluttered layouts, plus a short failure-case video. This maps to Task success (30%) and to the jury guide's "reproducible real-world loop".
- **A clear heterogeneous deployment.** For example, the VLA policy on the iGPU, Anomalib on the NPU and camera preprocessing on the CPU, using OpenVINO Physical AI with async or real-time chunking. Present an INT8 vs FP16 table of latency, accuracy, power (W) and package temperature over a sustained run. This maps to the two criteria worth 30% and 20%.
- **A closed-loop use of the anomaly score.** Low-confidence or ambiguous scores trigger a re-grasp, a rotate-and-reinspect, or a second view. The wrist or top camera is shared between the policy and inspection (the hints at L969).
- **A data-efficiency study.** A curve of success rate against the number of demonstrations (for example 10, 25 and 50), plus a clean, documented teleop dataset with episode filtering. This maps to Dataset and pipeline quality (20%) and to "how few demonstrations are enough" (L969). This is where our ML and evaluation skills give us an edge.
- **A twist that carries to the overall jury.** Examples: new defect types learned few-shot (FoundAD), language-conditioned sorting ("put cracked red bricks aside"), or an operator dashboard with live telemetry. Keep it subordinate to the reliability of the core loop.
- **Tooling feedback and upstream fixes** to Physical AI Studio or OpenVINO Physical AI. Intel values feedback (Terms §4). This is an estimate of judge appeal.

## 6. Constraints that could disqualify a project or cost heavily
- **Not using the mandated stack.** Swapping the VLA policy and Physical AI Studio for a scripted pick, or Anomalib for a generic classifier, or running inference off-laptop, probably forfeits large parts of the 30% integration and 20% pipeline scores. Whether it causes outright disqualification is unknown. A hard-coded pick routine probably fails "fully autonomously … VLA policy" (L965) in spirit.
- **Kit rules.** Do not open, modify or remove the kit from the Hardware Lab. Use it only for the challenge (Terms §1). Any project that needs custom grippers or mods is therefore risky.
- **Age.** Participants must be 18+ or have written parental consent (Terms §3).
- **Station availability.** There are only 25 stations (L981). The allocation process is unknown, and if they run out we cannot compete. Confirm at kick-off.
- **Criteria may change at kick-off** (Terms §3).
- **Combining with other challenges:** whether a team can also enter a second partner challenge with the same project is unknown from this text.
- **Cloud instances may be shut down** after the challenge, so back up checkpoints and data (Terms §2).
- **The deliverable format is unknown**, and so is the judging-session logistics (live at the station or a video).

## 7. How much physical hardware work it demands
**Level: provided-kit, high time-on-hardware but low electronics.**
- No soldering, wiring or embedded firmware is required. The arm, cameras and laptop are a pre-built station, and the SO-101 is listed as "ready-to-deploy" in OpenVINO Physical AI ([Intel](https://www.intel.com/content/www/us/en/developer/tools/openvino-toolkit/physical-ai.html)). Intel engineers are on site daily (L992).
- Physical work is unavoidable and sits on the critical path (estimates). Expect several hours of teleoperated demonstration recording at one shared station, arm calibration, camera mounting and lighting consistency, physically marking defective bricks, and many real-world trial runs to measure success rate and cycle time. Debugging is about grasp failures, servo or calibration drift and camera exposure rather than circuits.
- Parallelism is capped: there is one arm and one laptop per team (L981). Our usual "many agents in parallel" advantage applies to training scripts, OpenVINO export and benchmarking, dashboards and analysis, but not to data collection or physical evaluation. At least one person will effectively be a robot operator for much of the weekend (estimate).
- The work must happen at the venue, in the Hardware Lab (Terms §1).

<!-- complete -->
