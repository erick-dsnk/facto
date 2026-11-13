# The Robot Teleoperation Challenge (Rokoko): challenge intelligence

**Summary**
- Rokoko wants a project that uses its motion-capture suits and gloves to teleoperate robot hands, arms or humanoids, **either on real hardware or in simulation** (CHALLENGES.md:L1054). The brief is open ("Surprise us", L1060). Judging weights are technical execution 35%, originality 25%, usefulness 25% and demonstration of human-controlled robotics 15% (L1111-L1125).
- The prizes are Rokoko hardware rather than cash: 1st is Smartgloves II, an SDK licence and a blog feature, valued at €4,990 (L1131).
- The sponsor's real interest, from the brief and Rokoko's robotics page, is gloves as a **teleoperation and robot-learning data source**: precise manipulation, and human demonstrations used to train autonomous policies (L1066-L1068).
- Hardware burden (estimate): **moderate**. The mocap gear is wearable consumer-like kit with an SDK that streams over TCP/IP. A simulation-only path is explicitly allowed, which needs no electronics work. Physical robot time is shared and constrained.

## 1. Database record

| Field | Value | Source |
|---|---|---|
| Challenge | The Robot Teleoperation Challenge | CHALLENGES.md:L1038 |
| Sponsor | Rokoko | L1042, L1105-L1107 |
| Track | Hardware Track by Arduino. This is the `##` heading the challenge sits under, from L780 until the Healthcare track at L1282. | CHALLENGES.md:L780 |
| Main requirement | "Build an impressive application of robotic teleoperation using Rokoko's motion capture technology to control robotic hands, arms, or entire humanoid robots – either physically or in simulation." | L1054 |
| Judging emphasis and weights | Technical execution 35% ("Quality of the implementation – physical or simulated"); Originality & creativity 25%; Usefulness & potential impact 25%; Demonstration of human-controlled robotics 15% | L1111-L1125 |
| Prize | 1st: Smartgloves II pair, SDK licence, featured Rokoko blog post and extended support (valued at €4,990). 2nd: Smartsuit Pro II (€2,295). 3rd: Smartgloves I pair and merch (€1,095). No cash. | L1129-L1139 |
| Provided hardware | Smartgloves II, Smartsuit Pro II, Coil Pro, access to a Unitree G1 with dexterous hands (shared with the humanoid challenge team), and possibly a Booster T1 "depending on availability" | L1082-L1087 |
| Number of glove/suit units, and how they are shared between teams | unknown | (not stated) |
| Provided software | Rokoko Device SDK (L1085). Existing integrations "may be available", including an Inspire robotic hand integration by Aalto Robotics Club (L1090). | L1085, L1090 |
| SDK capabilities | Low-latency IMU, positional and rotational data. A solved 26-joint hand. Up to 83 Hz for gloves and 200 Hz for the suit. About 19-20 ms latency over USB or Wi-Fi. A TCP/IP protocol usable from any language. Runs on Windows, macOS and Linux x64/Arm64. ROS 2 bridge, Isaac Lab 2.3.0 integration, OpenXR output. | https://sdk.rokoko.com/ |
| Access process | Create a Rokoko ID, submit it through the Google Form, get accepted, then activate the SDK licence | L1092-L1097 |
| Support | Victoria Stein (Rokoko) on site, and Aalto Robotics Club mentors trained on Rokoko tech | L1088, L1101 |
| Provided data | None stated. The team records its own demonstrations. | (not stated) |
| Submission requirements | unknown. The brief lists no deliverables, video or repo requirements. Junction-wide submission rules are not in CHALLENGES.md. | (not stated) |
| Related side challenge | Verda "Best Use of Verda" explicitly names "Turn demonstrations into a brain… from Rokoko motion-capture teleoperation data" | L2139 |

## 2. What the sponsor is actually trying to encourage

**Reading:** Rokoko is moving from animation mocap into robotics. It wants evidence and showcase content that its gloves and suit are a practical **teleoperation interface and robot-learning data pipeline**, and ideally a blog-worthy demo (the 1st prize includes a "featured post on Rokoko's blog", L1131).

Evidence:
- The introduction frames teleoperation as a way to "control robots, collect training data, and accelerate the development of intelligent machines" (L1050). "Why it matters" repeats that it generates "the training data needed for increasingly autonomous systems" (L1076).
- The stated interests are precise manipulation of fragile objects, tools and liquids; **collecting human demonstrations to train autonomous robot policies**; and creative or entertainment uses (L1066-L1070).
- Rokoko's robotics page positions the product for "real-time teleoperations, detailed object-handling, and high-volume motion datasets". It promotes a "Data-first workflow for ML/AI pipelines", cites Stanford DexCap training policies "from 30 minutes of human glove mocap data", and lists robot-hand integrations, some shipped and some "coming soon" (Inspire is "coming soon") (https://rokoko.com/use-cases/robotics). Aalto's Inspire integration (L1090) therefore fills a gap in Rokoko's own lineup (inference).
- The rubric gives 35% to execution and only 15% to "demonstration of human-controlled robotics" (L1111-L1125). Judges want a polished, working system more than a teleop gimmick (inference).

## 3. Explicit requirements (quoted)

- "Build an impressive application of **robotic teleoperation** using Rokoko's motion capture technology to control robotic hands, arms, or entire humanoid robots – **either physically or in simulation**." (L1054)
- "You can work with the robotic hardware available at Junction, build your own simulated environment, or combine Rokoko's technology with other hardware and challenges at the event." (L1058)
- "You can also develop teleoperation applications **in simulation**, using Rokoko's physical motion capture equipment to control virtual robots." (L1090). Rokoko mocap input therefore appears to be mandatory, even in simulation.
- Platform access steps: "Create a Rokoko ID / Provide email and ID to Rokoko representatives via this form / Get accepted by Rokoko reps / Get access to SDK License and activate" (L1094-L1097)

## 4. What a mediocre submission would look like (estimate)

A glove streams finger angles into a simulated hand (for example the stock Isaac Lab glove example) or into the pre-built Inspire integration. Someone waves, the hand mirrors the wave, and that is the demo. Retargeting is naive joint-angle copying. There is no task, no measurement of precision or latency, and no story about who needs it. This scores low on originality and usefulness, and execution mostly reuses existing integration code.

## 5. What an exceptional submission would demonstrate (estimate)

- **A full teleop-to-autonomy loop.** Glove plus Coil Pro (and possibly the suit) teleoperates a dexterous hand or arm in sim, and on real hardware if the team can get access. The operator records a few dozen demonstrations of a precise task. An imitation or VLA policy is trained on them (Verda GPUs, L2139) and then performs the task autonomously. A before/after shows the teleop demo first, then the robot doing it alone. This hits L1068 directly, and a single project can also enter the Verda side challenge.
- **Measured quality.** Report end-to-end latency, task success rate and demonstrations-to-competence. Compare against a baseline interface such as keyboard or VR hand tracking. The jury guide rewards "a baseline that makes the difference visible" (jury PDF p.1).
- **Smart retargeting.** Map 26-joint human hands onto robot hands with fewer degrees of freedom (Inspire is 6 DoF, https://arxiv.org/html/2510.16931v1) in a way that preserves grasp intent. Add assistive autonomy, such as auto grasp stabilisation or tremor filtering. Visual feedback can partly substitute for the missing haptics: the gloves have no tactile feedback (https://rokoko.com/use-cases/robotics).
- **A live, legible stage demo.** A person in the suit and gloves performs a fragile or liquid task (L1066), the robot mirrors it, and the audience sees it working. This also plays well in peer review.

## 6. Constraints that could disqualify or sink a project

- **Not using Rokoko mocap.** It is the core of the brief (L1054, L1090). A project using a VR headset or webcam hand tracking alone would likely not qualify (inference).
- **SDK access gating.** The licence requires manual acceptance by Rokoko reps (L1096). Delays would block development. Register at kickoff.
- **Real-robot access is not guaranteed.** The G1 is "in coordination with the team running the separate humanoid robotics challenge" (L1086). That challenge states "Teams never control the robot directly. Our runner executes your Docker image through our safety filter" (L1241), and robot code must pass sim safety checks first (L1233). Whether live mocap teleop of the G1 is permitted, and for how long, is **unknown**. The Booster T1 depends on availability (L1087).
- **Shared equipment.** The number of glove and suit units is unknown. Hardware contention could limit dev time.
- **Submission format, deadlines and eligibility rules:** unknown from the provided sources.

## 7. Physical hardware work required

**Estimate: moderate, but no embedded electronics.**
- The mocap kit is wearable and streams over Wi-Fi or USB through a TCP/IP SDK usable from any language (https://sdk.rokoko.com/). Integration is software and calibration work, comparable to a consumer wearable SDK. There is no soldering or firmware.
- **Sim-only route (allowed, L1054/L1090):** the only physical work is wearing and calibrating the gloves and suit and handling Wi-Fi or USB connectivity. Everything else is Isaac Lab or MuJoCo software, which fits our team's skills.
- **Real-robot route:** we would depend on organiser-operated robots (G1, possibly T1, the Inspire hand), plus safety filters and shared time slots (L1086-L1087, L1241). Debugging real robot behaviour (joint limits, latency, grasp failures) is robotics work outside our comfort zone, but mentors from Aalto Robotics Club are offered (L1088). A hybrid plan is lower risk: build and record in sim, then attempt a short real-hardware demo if a slot is available.

## Sources opened
- /Users/ciprian/code/Junction 26/docs/JUNCTION_2026_CHALLENGES.md (L780, L1038-L1141, L1143-L1279, L2116-L2160)
- /Users/ciprian/code/Junction 26/docs/00-Jury-profiles-and-pitch-guide.pdf (p.1)
- https://sdk.rokoko.com/
- https://rokoko.com/use-cases/robotics
- https://arxiv.org/html/2510.16931v1 (Inspire hand degrees of freedom; seen only in search results)
- https://hackjunction.app/participate/45/challenges/326 (fetch returned no content)

<!-- complete -->
