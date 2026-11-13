# Robot Teleoperation (Rokoko) - competitive intelligence

**Summary**
- No past Junction or Devpost winner for a Rokoko or mocap-glove teleoperation challenge turned up in my searches. "Unknown" is the honest answer, not "none exists". Rokoko sponsoring a hackathon robotics challenge is also not found.
- The solution space is well covered by open-source academic stacks (AnyTeleop, Open-TeleVision, Open Teach, TWIST, HumDex) and by Rokoko's own showcase (YAAK.ai: glove teleop, 221 demos, trained policy). The "glove drives a robot hand, record demos, train a policy" idea is already Rokoko's own marketing story, so it will look familiar to the sponsor judge.
- Expected crowding (estimate): medium. Rokoko hardware is gated (form and SDK licence, CHALLENGES.md:L1092-L1097), kit counts are unknown, and the challenge sits in a hardware track. Differentiation must come from the task and the evidence, not from "gloves control a hand".

Challenge text: CHALLENGES.md:L1038-L1141. Judging: execution 35%, originality 25%, usefulness 25%, teleop demonstration 15% (L1111-L1125).

## 1. Previous winners and similar events

| Finding | Relevance | URL |
|---|---|---|
| Searches for Junction winners found no teleoperation or Rokoko winner. Junction 2025 result only showed an Aalto ageing-with-AI challenge. | Gap in evidence: unknown whether Rokoko or a similar challenge ran at Junction before. | https://www.aalto.fi/en/news/aalto-students-and-researchers-shape-together-how-we-age-with-ai-at-junction-hackathon-2025 |
| WaveArm, 1st prize, Robotic Agents Hackathon (Milan): gesture-controlled robot arm using hand tracking (not mocap gloves). | Typical "gesture controls arm" winner shape. | https://www.interhuman.ai/showcase/wavearm |
| Embodied AI Hackathon winners (Circuit Launch): LeRobot SO-ARM100 pick-and-place. | Typical embodied-AI hackathon winner: cheap arm plus imitation learning. | https://www.hackster.io/news/embodied-ai-hackathon-winners-announced-2dc69c76942e |
| LeRobot Worldwide Hackathon, "Spice Terminator" (Most Novel Solution): SO-101 leader-follower, imitation learning, wipes plates. | Shows teleop-to-policy demos already win "novel" at LeRobot events. | https://darthgera123.github.io/blogs/hackathon/robot |
| Human Operator, MIT Hard Mode 2026 (Learn Track): electrical muscle stimulation to move a body, not a robot. | Example of an inverted-teleop twist that won a track. | https://letsdatascience.com/news/mit-hackathon-team-builds-wearable-ai-that-moves-limbs-eac3840b |
| Rokoko's own contests found are animation challenges only. | No prior Rokoko robotics hackathon found. | https://www.rokoko.com/es/animation-challenge/rokoko-tv-intergalactic |

Not verified: whether the winner pages above name every winning project; I only saw search summaries.

## 2. Existing implementations with Rokoko or similar gloves

- **YAAK.ai rig on Rokoko's blog** (the sponsor's own showcase): 2 Smartgloves II + Coil Pro driving 2 AgileX Nero arms and 2 BrainCo Revo2 hands, RGMP protocol, six-direction calibration, clutch, damped least squares IK, Rerun sim check, MCAP recording, 221 demos, control reliability 73.5% to 99.3%, a policy that ran autonomously. Limitations: Coil Pro mirror-orientation glitch, tracking degrades beyond about 1.1 m or within 50 cm, a failed thumb motor. https://www.rokoko.com/insights/collecting-robot-training-data-with-rokoko-smartgloves
- **Rokoko robotics page**: about 12 ms latency claim, SDK supports ROS 2, Isaac Lab, OpenXR, Linux/macOS/Windows; hand integrations Tesollo, BrainCo, Wuji, Robotis, Robotera (Inspire, Seed, Linkerbot listed as "coming soon", FAQ conflicts); customers Stanford DexCap, ETH Zurich, Figure AI, etc. Vendor marketing, not independently verified. https://www.rokoko.com/use-cases/robotics
- **ETH Zurich 16-DOF tendon hand teleoperated with Rokoko gloves** for imitation learning (student portfolio page). https://fhunist.github.io/project5.html
- **DexJoCo** (MuJoCo, Allegro hand): Rokoko gloves plus Vive trackers, learned fingertip retargeting. https://dexjoco.github.io/
- ROS support is contradictory: Rokoko's page lists ROS 2 support, a reseller says ROS plugins are on the roadmap (https://www.knoxlabs.com/products/smartgloves-ii-size-l). Check with mentors before relying on it.

## 3. Open-source and academic stacks (teams can copy these)

- AnyTeleop (vision-based arm-hand teleop, sim and real): https://yzqin.github.io/anyteleop/
- Open-TeleVision (VR streaming, Unitree H1 with hands): https://robot-tv.github.io/
- Open Teach (NYU/Meta, about $500 VR teleop): https://open-teach.github.io/
- BEAVR (bimanual VR teleop): https://github.com/ARCLab-MIT/BEAVR-Bot
- TWIST (mocap whole-body teleop for Unitree G1): https://arxiv.org/html/2505.02833v1 ; TWIST2 (PICO, no mocap): https://arxiv.org/html/2511.02832v1
- HumDex (IMU system, G1 plus two 20-DoF hands): https://arxiv.org/pdf/2603.12260 , code github.com/physical-superintelligence-lab/HumDex
- IMU-suit whole-body teleop of G1 with sim2sim/sim2real: https://arxiv.org/pdf/2605.12347
- somehand (retargeting to 20+ hands incl. Inspire, UDP mocap input): github.com/BotRunner64/somehand (seen via a mirror; original unverified)
- Xsens teleop pipeline guide using G1: https://www.xsens.com/hubfs/Downloads/Manuals/Robotics_Teleoperation_Pipeline_Guide.pdf
- LeRobot (SO-101 leader-follower, datasets, policies): https://nvidia.github.io/IsaacTeleop/main/getting_started/lerobot/index.html (NVIDIA Isaac Teleop integration page)

## 4. Commercial products

- Manus Metagloves (Quantum, Pro, Pro Haptic; about $7,475 for the haptic pair per one retailer): Isaac Lab 2.3 native support, Sharpa Wave and Tesollo demos. Vendor material. https://www.knoxlabs.com/blogs/articles/manus-gloves-robotics-hand-data-ai-training-teleoperation , https://www.manus-meta.com/use-cases/tesollo-demonstrates-robotic-hand-teleoperation-with-manus-metagloves-pro-haptic
- Xsens suit pipeline (above), Brainbot teleoperation-and-learning platform (https://letsdatascience.com/news/brainbot-integrates-teleoperation-and-learning-platform-dd3f6692, not opened beyond the headline).
- Not researched: Apple Vision Pro / Meta Quest teleop products. Unknown.

## 5. What most teams will reach for first (estimate)
1. Glove fingers to a robot hand mirror, "pick up a cup".
2. Suit or glove to a simulated humanoid or hand in Unity/MuJoCo (the safe path if hardware is contested).
3. Record demos and "train a policy" with LeRobot/ACT, often with little eval.
4. Gesture-controlled arm for a themed use case (hazard handling, kitchen, remote surgery-adjacent).
5. Gaming or puppeteering demo (boss-fight, dance mimic, Unitree G1 copying the suit).
6. Add an LLM voice layer on top of teleop.

## 6. Obvious ideas to avoid
- Plain mirroring of fingers onto a hand with no hard task.
- Pick-and-place of a cube or cup.
- "Dance or copy me" humanoid mimic (TWIST and others already show it).
- Teleop plus "AI copilot" chat wrapper with no control benefit.
- Hazardous-environment or telemedicine pitch decks without measured results.
- Policy trained on a few dozen demos with no baseline, held-out trials or failure analysis.

## 7. Crowding estimate (estimate, with reasoning)
- Medium. Pushes up: it is an obvious flashy "robots" challenge, and a possible direct comparison with the humanoid challenge sharing the G1 (CHALLENGES.md:L1086). Pushes down: Rokoko access needs a form and approval (L1092-L1097), hardware quantities unknown, simulation path is allowed (L1054) which lets weaker teams in but caps their ceiling, and most teams lack robotics skills. Likely a handful of serious teams, most doing sim or a mirror demo.
- Competition for prizes is hardware, not cash (L1129-L1139): a motivation filter that may lower interest among prize-driven teams.

## 8. What would look different
- Pick a task that exposes the glove's strengths and has a measurable metric (fragile, liquid, tool use; L1066), and report success rate, latency and operator-skill comparison against a baseline such as keyboard, VR or a webcam hand tracker.
- Close the loop: record demos, train, show the policy run alone, and show it failing and recovering. YAAK did a version of this, so beat it on rigor, not novelty.
- Add something absent from the stacks above: e.g. correction-in-the-loop (operator takes over when the policy is uncertain, logged as new data), shared autonomy, or a data-quality scoring tool for demonstrations.
- Make the stage demo live and legible in under 90 seconds (15% criterion, L1123).
- Have a simulation fallback ready, since real G1 access is shared and gated (L1086).
- Verify Rokoko SDK activation immediately; treat ROS support as unconfirmed.

<!-- complete -->
