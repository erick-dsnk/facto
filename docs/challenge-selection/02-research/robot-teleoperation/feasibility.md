# Robot Teleoperation (Rokoko): technical feasibility (Agent D)

**Summary**
- **Feasible for us, if we stay in simulation on our own laptops.** A credible core is a short pipeline: Smartgloves II over USB, Rokoko's `rokoko-sdk` driver and `rkk-hand-solver`, a Python TCP client, `dex-retargeting`, then a MuJoCo hand or arm doing a fragile-object task. All of it is documented software with no electronics work (https://sdk.rokoko.com/, https://sdk.rokoko.com/examples/isaac/). Estimate: about 12-16 hours to a working live teleop and about 30 hours with demonstration recording, metrics and a trained policy.
- **The gating dependencies are human, not technical.** We need SDK licence acceptance from Rokoko reps (CHALLENGES.md:L1094-L1097), a glove kit for most of the 40 hours (the number of kits is unknown), and a magnetically clean, non-Wi-Fi-dependent demo spot.
- **Real-robot teleop is a gamble.** The G1 is shared with a challenge whose rules say "Teams never control the robot directly" (L1241). An Inspire integration "may be available" (L1090). Treat real hardware as a stretch goal and never as the demo's critical path.
- **Biggest documented demo risks:** magnetic heading drift (about 8° over 10 s, per Rokoko's own Isaac example), Coil Pro distortion near ferrous metal or motors, Wi-Fi limited to WPA2/WPA3-Personal or open networks, and roughly 99 ms RTT if the sim runs on a remote GPU. Each has a known mitigation, listed below.
- Estimates: buildable 7/10; live-demo reliability 7/10 for local sim and about 3/10 for a live real-robot demo.

---

## 1. What the sponsor provides (facts)

| Item | Detail | Source |
|---|---|---|
| Mocap hardware | Smartgloves II, Smartsuit Pro II, Coil Pro | CHALLENGES.md:L1082-L1084 |
| Software | Rokoko Device SDK | L1085 |
| Robots | Unitree G1 "with dexterous hands", shared with the humanoid challenge; Booster T1 "depending on availability" | L1086-L1087 |
| G1 hands | The humanoid challenge says the G1 has **Dex3 three-fingered hands** | L1200 |
| Sim path | Explicitly allowed; "Inspire robotic hand integration developed by Aalto Robotics Club" may be available | L1054, L1090 |
| Support | Victoria Stein (Rokoko) on site, plus Aalto Robotics Club mentors | L1088, L1101 |
| Access steps | Rokoko ID, Google form, acceptance by reps, licence activation | L1094-L1097 |
| Number of glove/suit kits, lending rules | unknown | not stated |
| Submission deliverables | unknown | not stated |

## 2. The Rokoko SDK as documented (facts, https://sdk.rokoko.com/ and sub-pages)

- **Architecture.** A local driver executable, `rokoko-sdk`, handles discovery and streaming. Commands go over a TCP protocol (RCSP) and data over a binary stream (RGMP). Any language that can open a TCP socket can use it (https://sdk.rokoko.com/, https://sdk.rokoko.com/guides/quick-start/).
- **Hand solver.** `rkk-hand-solver` turns raw sensor data into a 26-joint hand skeleton in local, world or OpenXR layout. The data path is driver → solver on TCP 12276 → consumer on TCP 12277. The solver must be started with `--emit-openxr` for the Isaac and ROS 2 consumers (https://sdk.rokoko.com/examples/isaac/, https://sdk.rokoko.com/integrations/ros2/). A pure-Python hand solver example also exists, but the Isaac device does **not** work with it (https://sdk.rokoko.com/examples/isaac/).
- **Rates and latency.** Up to 83 Hz per glove and 200 Hz for the suit. Glove latency is about 19 ms over USB and about 20 ms over Wi-Fi with jitter (https://sdk.rokoko.com/). The marketing page says "~12 ms processing latency via USB" (https://rokoko.com/use-cases/robotics).
- **Platforms.** Windows 10 1903+, macOS 14+ on **Apple silicon**, and Ubuntu 22.04 or Debian 12 on x64 and Arm64. The examples need Python 3.12+ (https://sdk.rokoko.com/guides/quick-start/). USB streaming works on **Smartgloves II only**; the suit streams over Wi-Fi (https://sdk.rokoko.com/).
- **Wi-Fi.** Each device is configured over USB with `network_configuration.py`, using SSID, receiver address and port (default 14041). Security modes are WPA2 (default), WPA3_Personal or Open (https://sdk.rokoko.com/guides/wifi-setup/). No enterprise or captive-portal mode is documented, so a venue's WPA2-Enterprise network probably will not work (inference).
- **Coil Pro (EMF positioning).** Gives the gloves an absolute position in a fixed frame, with a range of just under 5 m. There is a roughly 50 cm saturation zone around the coil. Ferrous metal, electric motors and large electronics distort the field, and plastic or wooden tables are recommended. Coil Pro is used by the gloves only, not the suit (https://sdk.rokoko.com/guides/tech-overview-emf-imu/, https://sdk.rokoko.com/).
- **Integrations.**
  - Isaac Lab 2.3.0 on Isaac Sim 5.1.0, through `RokokoGloveDevice`, which impersonates Isaac's OpenXR device. It is shipped for Fourier GR1T2 hands (via dex-retargeting) and for a Franka stack task (yaw only plus a pinch gripper). `DexRetargeter` is an unimplemented stub (https://sdk.rokoko.com/examples/isaac/).
  - ROS 2 bridge for Humble, Jazzy and Lyrical. Apache 2.0. Needs SDK 0.10.0 or newer. Supports one left and one right glove at a time. Publishes hand joints but does **no retargeting** (https://github.com/Rokoko/rokoko-ros2-bridge, https://sdk.rokoko.com/integrations/ros2/).
- **Pricing and licence.** Not published; it is quote-based. The licence is tied to a Rokoko ID team (https://sdk.rokoko.com/). How activation works, and whether it needs internet, is **unknown** (the quick-start page does not say).
- **No haptics.** The gloves "do not give tactile or haptic feedback" (https://rokoko.com/use-cases/robotics).
- **Integrated robot hands.** Rokoko lists Tesollo, BrainCo, Wuji, Robotis and Robotera as integrated. It lists Inspire, Seed and Linkerbot as "coming soon". Unitree is not mentioned (https://rokoko.com/use-cases/robotics).

### Documented problems (directly from Rokoko's Isaac example page)
1. Heading is referenced to magnetic north with an arbitrary session zero. **Heading drift measured about 8° over 10 seconds**, so yaw calibration is required, and `isaac_teleop_record.py` does not call `calibrate()`.
2. `FixedWristAnchor` gives **no arm travel**: position deltas are zero until a tracked anchor is implemented. Out of the box, the hand cannot be moved through space in Isaac.
3. The gripper retargeter responds to pinches only, not a fist.
4. A remote GPU host gave about **99 ms RTT**: "acceptable for recording but noticeable in closed-loop teleop". Isaac Sim WebRTC streaming allows **only one client** per instance.
5. Driver 580 worked; **driver 595 crashed the Isaac Sim 5.1 renderer**. NVIDIA's current Isaac Sim requirements page lists 595 as the tested driver (https://docs.isaacsim.omniverse.nvidia.com/latest/installation/requirements.html), which is a version trap on fresh cloud images (inference).
6. `EXPORT_ALL` can write an empty trailing episode group after an auto-reset.

## 3. Architecture a credible entry needs

### Recommended: "local sim first, real robot optional"
```
Smartgloves II (USB) + Coil Pro          [Smartsuit optional, Wi-Fi via our own router]
        │ rokoko-sdk driver (local laptop, macOS 14 / Ubuntu)
        ▼
rkk-hand-solver --emit-openxr  ──TCP 12277──►  Python client (RGMP parser)
        ▼
Retargeting: dex-retargeting (MIT, pip) to the robot hand
             + wrist pose (Coil Pro position + orientation) → arm IK (or a floating hand)
             + filters: One-Euro or low-pass smoothing, yaw re-zero hotkey, grip-force limiter
        ▼
MuJoCo scene running locally (task: fragile object / tool / pouring)
        ├─► live viewer for the stage demo, with latency and grip-force HUD
        └─► episode recorder (LeRobot dataset format)
                     ▼
        Train ACT or Diffusion policy (LeRobot) on a Verda GPU → autonomous rollout in the same scene
```
- **Why MuJoCo locally rather than Isaac Lab.** Isaac Sim does not run on macOS. It needs an RTX-class GPU with RT cores (A100/H100 are unsupported) and at least 16 GB VRAM (https://docs.isaacsim.omniverse.nvidia.com/latest/installation/requirements.html; also CHALLENGES.md:L1215). A remote Isaac instance adds the about 99 ms RTT noted above plus the one-client WebRTC limit. MuJoCo runs natively on our laptops, and MuJoCo Menagerie provides Leap, Allegro and Shadow hands, a Franka Panda, UR5e and SO101 (https://github.com/google-deepmind/mujoco_menagerie). This is an engineering judgement (estimate): it trades Rokoko's ready-made Isaac example for local, low-latency, demo-safe rendering.
- **Retargeting.** `dex-retargeting` is MIT-licensed and installs with pip. Its hand models come from dex-urdf, which includes **Inspire**, Leap, Allegro, Shadow, Ability, SCHUNK SVH and others, but **not Unitree Dex3** (https://github.com/dexsuite/dex-retargeting, https://github.com/dexsuite/dex-urdf). Unitree's own `xr_teleoperate` does retarget to Dex3 and Inspire using dex-retargeting, with an Isaac Lab sim mode, but its inputs are XR headsets, not Rokoko (https://github.com/unitreerobotics/xr_teleoperate). Its Dex3 config could be borrowed if the G1 path opens (inference).
- **Choosing the hand.** Pick the **Inspire** hand so that sim work transfers to the Aalto integration and to any physical Inspire hand on site. Unitree documents Inspire as 6 DoF with position control only, over DDS `rt/inspire/cmd` (search-result summary of Unitree developer docs; not opened directly, so treat as unverified). Leap or Allegro in Menagerie are the fallback if Inspire's MuJoCo model gives trouble.
- **Precedent.** ETH's ORCA hand paper used Rokoko gloves for "absolute wrist tracking and finger pose estimation" with energy-based retargeting. It collected 214 demonstrations in about 2.5 hours and trained a diffusion transformer in about 4 hours on one RTX 4090 (https://arxiv.org/html/2504.04259v2). This shows the glove → demonstrations → policy loop is real, and its numbers are a useful time budget.

### Optional real-hardware branches (all depend on answers on site)
- **Aalto's Inspire hand integration** (L1090). Whether it drives a real hand or a sim, and whether its code can be handed over, is unknown.
- **G1 with Dex3** (L1086, L1200). The humanoid challenge sends commands only through its runner and safety filter, with a watchdog and at least 27 commands per second, and requires code to pass sim safety checks first (L1233, L1241). Live teleop through that path is unconfirmed.
- **SO-101 arm from the Ignite × Intel challenge** (L963, L982). L1058 allows combining "with other hardware and challenges at the event", but those arms are per-team stations for Ignite entrants. Whether we can use one is unknown.

## 4. Critical dependencies and how we get them

| Dependency | How we get it | Risk |
|---|---|---|
| Rokoko ID plus SDK licence acceptance | Fill in the form **in the first hour** (L1094-L1097). Ask Victoria Stein to approve it on the spot. | Manual approval; turnaround unknown. Blocks all real-glove work. |
| SDK installer, version 0.10.0 or newer | From the licence tile at id.rokoko.com (https://sdk.rokoko.com/). The ROS bridge needs ≥0.10.0. | Low. |
| A glove kit for most of the 40 h (Smartgloves II plus Coil Pro) | From Rokoko. Count and lending policy unknown. | **High.** Without our own kit for long stretches, iteration stops. |
| A laptop that meets the SDK minimums | macOS 14 on Apple silicon or Ubuntu 22.04, Python 3.12+ | Low. |
| A Wi-Fi router (only if we use the suit or wireless gloves) | Bring our own travel router (WPA2-Personal) | Medium. Venue Wi-Fi is probably enterprise or crowded (inference). |
| GPU for policy training | Verda free compute (L2128-L2133) | Low. A small ACT model trains in a few hours (estimate, ORCA reference above). |
| Real robot time | Negotiate with Rokoko and the Aalto team | High and unknown. |

Pricing: the SDK has no published price (https://sdk.rokoko.com/). It is presumably free for the event, but that is unknown. Model API costs: none needed.

## 5. Integration complexity for our team (estimate)

- **Easy for us:** TCP client and data plumbing, Python, the recording pipeline, LeRobot training on Verda, the HUD and metrics, and the pitch UI.
- **New to us but tractable (about 4-8 h):** retargeting parameter tuning, frame conventions (the glove frame is Y-up; Isaac and MuJoCo are Z-up, https://sdk.rokoko.com/examples/isaac/), yaw calibration, and wrist-to-arm IK.
- **Genuinely hard:** making grasps of fragile or soft objects look right in MuJoCo contact physics (sim tuning); getting a policy to succeed from about 50 demonstrations; and any real-robot debugging (joint limits, latency, safety-filter rejections). We have little robotics experience, so the Aalto mentors (L1088) are an important resource.

## 6. Time plan and the smallest complete version (estimate)

| Hours | Milestone | Fallback if late |
|---|---|---|
| 0-2 | Register for the licence; install the SDK; run `rcsp_cmd_example.py`; MuJoCo hand scene runs on a laptop using **recorded** glove data or mocked frames | Build a glove-data mock so the sim work is not blocked by the licence |
| 2-10 | Live glove → retarget → MuJoCo hand mirrors the fingers; yaw calibration hotkey | Use Leap or Allegro instead of Inspire |
| 10-16 | Wrist position from Coil Pro drives a floating hand or Panda IK; the task scene works (grasp and place a fragile egg or cup without exceeding a force threshold) | Fixed wrist, finger-only task |
| 16-24 | Assistive layer: smoothing, force limiter, visual "haptic" substitute; metrics for latency, success rate, and comparison against a keyboard or mouse baseline | Drop the baseline and keep the metrics |
| 24-32 | Record 50-100 demonstrations; train ACT on Verda; run the policy autonomously in the sim | Show the dataset and training curve only, without autonomy |
| 32-38 | Stretch: real Inspire or G1 if a sponsor slot exists; otherwise polish. Record a backup video. | Video |
| 38-40 | Pitch rehearsal on the actual demo table | |

**Smallest complete version (about 16 h):** a glove-driven simulated dexterous hand completes a fragile-object task live, with on-screen latency and grip force and a recorded set of demonstrations. It meets the mandatory requirement (L1054, L1090) and hits "precise manipulation" (L1066). Adding the trained policy brings in "demonstrations to train policies" (L1068) and the Verda bounty (L2139).

## 7. Live-demo likelihood and what would make it fail

Estimate: **about 7/10 for the local sim demo with mitigations; about 3/10 for a live real-robot demo.**

| Failure mode | Evidence | Mitigation |
|---|---|---|
| Yaw drift makes the hand point the wrong way mid-demo | About 8° per 10 s (https://sdk.rokoko.com/examples/isaac/) | Recalibrate with one hotkey before each run; use the Coil Pro; keep demo runs under 60 s |
| Coil Pro field distorted on stage (metal table, speakers, motors, the robot itself) | https://sdk.rokoko.com/guides/tech-overview-emf-imu/ | Test at the actual judging spot; bring a wooden or plastic board; keep the coil about 50 cm or more from the hands; have a finger-only fallback mode |
| Wireless dropouts or the device cannot join the network | Only WPA2/WPA3-Personal or Open supported (https://sdk.rokoko.com/guides/wifi-setup/) | Run the gloves over USB (SGII only, https://sdk.rokoko.com/); use our own router if the suit is used |
| Licence not activated in time, or activation needs internet at the demo | Manual acceptance (L1096); activation details unknown | Register at kickoff; ask whether the licence works offline; keep a replay of recorded glove data as an emergency mode (clearly labelled as replay) |
| Remote-GPU lag makes teleop feel bad | About 99 ms RTT, one WebRTC client (https://sdk.rokoko.com/examples/isaac/) | Run the sim locally in MuJoCo; use the GPU only for training |
| Isaac version or driver hell, if we use Isaac | Driver 595 crashed Isaac Sim 5.1 (same page); Isaac Lab 3.0 support still "in progress" (https://sdk.rokoko.com/) | Avoid Isaac on the critical path; if used, pin container 2.3.0 and driver 580 |
| The kit is shared or taken back | Counts unknown | Agree glove hours in writing on day 1; record a large raw dataset early so sim work continues without gloves |
| Trained policy fails live | Few demos; sim contact physics | Present the policy as a stretch; show a pre-recorded successful rollout plus live teleop |
| Real robot unavailable, or safety filter rejects commands | L1086, L1233, L1241 | The core demo is never on the robot |
| Glove fit and calibration for a new wearer (for example, a judge tries it) | Inferred | One trained operator does the demo; optionally a short guided try with recalibration |

## 8. Questions to ask Rokoko and the Aalto mentors before committing

1. How many Smartgloves II, Coil Pro and suit kits are there? Can one team keep a kit for the whole event and overnight?
2. How fast is SDK licence approval? Does activation need internet, and does it survive offline use at the demo table?
3. Which SDK version will be provided (we need ≥0.10.0 for the ROS bridge and OpenXR joints)? Does it run on macOS Apple silicon in practice?
4. Is the Aalto Inspire integration a sim or a real hand? Is code available, and which sim (Isaac or MuJoCo)? Is a physical Inspire hand present?
5. Can a team **live-teleoperate** the G1 (Dex3) with gloves, or only through the humanoid challenge's runner and safety filter (L1241)? Are there time slots, and when? Is the Booster T1 actually coming?
6. Can a **sim-only** entry win, or do judges weight physical demos higher in practice? L1113 says "physical or simulated".
7. Where and how is judging done? At our table or a stage? Is there metal nearby? Is there power and a wired connection?
8. What are the submission deliverables (video, repo, slides)? Currently unknown.
9. Is there a known-good retargeting config for a specific hand, beyond GR1T2 in the Isaac example?
10. Are there venue Wi-Fi rules about running our own router?

## Sources opened
- /Users/ciprian/code/Junction 26/docs/JUNCTION_2026_CHALLENGES.md: L951-L1002, L1038-L1141, L1143-L1280, L2125-L2160
- /Users/ciprian/code/Junction 26/docs/challenge-selection/01-challenge-intelligence/robot-teleoperation.md
- https://sdk.rokoko.com/
- https://sdk.rokoko.com/guides/quick-start/
- https://sdk.rokoko.com/examples/isaac/
- https://sdk.rokoko.com/integrations/ros2/
- https://sdk.rokoko.com/guides/tech-overview-emf-imu/
- https://sdk.rokoko.com/guides/wifi-setup/
- https://github.com/Rokoko/rokoko-ros2-bridge
- https://rokoko.com/use-cases/robotics
- https://github.com/dexsuite/dex-retargeting
- https://github.com/dexsuite/dex-urdf
- https://github.com/unitreerobotics/xr_teleoperate
- https://github.com/google-deepmind/mujoco_menagerie
- https://github.com/huggingface/lerobot
- https://arxiv.org/html/2504.04259v2 (ORCA hand, Rokoko glove teleop)
- https://docs.isaacsim.omniverse.nvidia.com/latest/installation/requirements.html

<!-- complete -->
