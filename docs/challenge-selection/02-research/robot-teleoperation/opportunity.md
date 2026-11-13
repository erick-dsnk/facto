# Robot Teleoperation (Rokoko): opportunity discovery (Agent C)

**Summary**
- The plain story, where a glove drives a hand, we record demos and train a policy, is already Rokoko's own showcase (YAAK.ai: 221 demos, reliability rising from 73.5% to 99.3%). The gaps sit *around* that loop: the **quality** of the human data, the **missing sense of touch** (the gloves have no haptics), the **handoff** between human and policy, and **embodiment portability** of the human hand data.
- Five directions are below. The strongest for the sponsor *and* the overall jury (estimate) are **(1) live demonstration-quality coaching** and **(3) human-takes-over-when-the-policy-is-unsure**. Each produces a measured before/after and needs no electronics work.
- All five can run in local simulation (allowed, CHALLENGES.md:L1054, L1090), with a real robot only as a stretch goal. **Verda** stacks honestly (the brief names Rokoko data, L2139). **Tiger Data**, **Codex** and possibly **Gemini/Gemma** or **Nemotron** stack depending on the direction.
- Estimates: differentiation 7/10, demo potential 7/10, overall-jury fit 6/10.

Context for a teammate: Rokoko provides Smartgloves II (finger tracking), the Smartsuit Pro II (full body) and the Coil Pro (absolute hand position), plus an SDK. Teams must use this mocap gear to teleoperate robot hands, arms or humanoids, on real hardware or in simulation (L1054, L1082-L1090). Judging weights: execution 35%, originality 25%, usefulness 25%, demonstration of human-controlled robotics 15% (L1111-L1125). The prizes are Rokoko hardware, and 1st place includes a Rokoko blog feature (L1129-L1139). Rokoko lists three interests: precise manipulation (fragile objects, tools, liquids), human demonstrations for training policies, and creative uses (L1066-L1070).

## Facts the opportunities rest on

| Fact | Source |
|---|---|
| Gloves "do not give tactile or haptic feedback" | https://www.rokoko.com/use-cases/robotics (FAQ) |
| Rokoko pitches "Turn demonstrations into training data" and "high-volume motion datasets". Its Studio software exports BVH/FBX/CSV and covers capture, segmentation and looping. | https://www.rokoko.com/use-cases/robotics |
| In YAAK.ai's Rokoko rig, control reliability rose from 73.5% to 99.3% over the session, and non-experts produced usable demos after familiarisation. The write-up reports no metric for the trained policy and says nothing about failed or discarded demos. Coil Pro had a mirrored-solution glitch, and tracking degraded beyond about 1.1 m or within about 50 cm of the coil. | https://www.rokoko.com/insights/collecting-robot-training-data-with-rokoko-smartgloves |
| Hand integrations are listed as shipped for Tesollo, BrainCo, Wuji, Robotis and Robotera, and "coming soon" for Inspire, Seed and Linkerbot. The FAQ contradicts this. | https://www.rokoko.com/use-cases/robotics |
| The SDK outputs a 26-joint hand skeleton at up to 83 Hz per glove and 200 Hz for the suit, with about 19-20 ms latency. It ships Isaac Lab and ROS 2 integrations; the ROS 2 bridge does no retargeting, and the `DexRetargeter` in the Isaac example is a stub. Heading drifts about 8° over 10 s. | https://sdk.rokoko.com/ , https://sdk.rokoko.com/examples/isaac/ (via Agent D's feasibility report) |
| An Inspire hand integration by Aalto Robotics Club "may be available". The G1 is shared with the humanoid challenge, whose robots run only through a runner and safety filter. | L1086, L1090, L1241 |
| Verda's bounty names "Turn demonstrations into a brain… from Rokoko motion-capture teleoperation data" | L2139 |
| Ignite × Intel gives each of its teams an SO-101 arm with a leader arm for teleop (25 stations) | L963, L981-L982 |
| Jury guide: wants a visible before/after, "a baseline that makes the difference visible", and evidence including failure cases | 00-Jury-profiles-and-pitch-guide.pdf p.1 |

---

## Opportunity 1: Demonstration-quality coaching during collection

**Gap.** Rokoko sells gloves as a *data* source, but nothing in the sources I opened scores whether a recorded demonstration is good training data. Research is only now arriving: a May 2026 paper finds that novice teleop episodes often "succeed at the task but are poor training data" because of inefficient motion, repeated corrections and operation near joint limits. It gives operators post-episode feedback, but its pilot had only three operators and reports no numbers in the abstract (https://arxiv.org/abs/2605.26349). Offline curation methods report gains from filtering: SCIZOR +15.4% on average (https://arxiv.org/abs/2505.22626), and smoothness-based scoring +16% success with one-sixth of the data (https://arxiv.deeppaper.ai/papers/2604.23000v1, search summary only). Both are offline and not glove-specific. YAAK's rising reliability curve shows operators learn over a session, but the write-up says nothing about which demos were good.

**Underused sponsor capability.** The 83 Hz, 26-joint hand stream is far richer than the robot's 6-DoF command (estimate: Inspire is about 6 DoF). Human signals that the robot never sees, such as hesitation, tremor, finger jitter and re-grasps, are free quality features.

**Why now.** An LLM or VLM can turn telemetry and a clip into a plain-language coaching line ("you re-grasped twice; slow the approach") at hackathon speed. Before current models this needed a hand-built rule set (estimate).

**Why the sponsor would care.** It makes the gloves' main robotics pitch, a data pipeline, measurably better. It is also blog-ready: "same 30 minutes of glove time, X% better policy".

**How it reads to the overall jury.** Specific user: robot-learning teams and data-collection operators. Distinctive insight: score the human, not just the episode. Honest evidence: train the same policy on all demos versus the curated or coached set, then compare success rates. This fits the "measured evidence" lens directly. Risk: it is less visually dramatic, so the stage demo needs a live scoreboard and a side-by-side rollout.

**Stacks:** Verda (training, L2139); Tiger Data (an 83 Hz time-series store is a natural fit, though its criteria are prose only); Gemini or Gemma (feedback text); Nemotron VL if a VLM judges the episode video; Codex.

## Opportunity 2: Making up for the missing sense of touch on fragile tasks

**Gap.** The gloves have no haptics (Rokoko FAQ, above), yet Rokoko's first stated interest is fragile objects and liquids (L1066). Force feedback matters: in CDF-Glove's bottle-grasp test, success rose from 10% to 50% with force feedback when vision was blocked, and from 70% to 90% with vision (https://arxiv.org/pdf/2603.05804, search summary). Visual "haptics" overlays improved grasp-force control in MERL's work, but without a clean no-feedback baseline (https://merl.com/publications/docs/TR2021-063.pdf, search summary). For a sensory substitution layer on a commercial non-haptic mocap glove, I found no head-to-head result (unknown, not none).

**Opportunity.** Use contact forces from the sim, or from the BrainCo-style touch hands YAAK used, as an audio, visual or wrist cue. Add assistive autonomy too, such as a grip-force ceiling, slip detection or auto-stabilisation, so that an operator without haptics can handle an egg or a full cup.

**Why the sponsor would care.** It answers the most obvious objection to its product ("no haptics") with software. It also targets precise manipulation directly (L1066).

**How it reads to the overall jury.** Very legible: crush rate and spill rate with and without assist, with a judge invited to try it. The risk is that MuJoCo contact tuning for soft or fragile objects is hard (Agent D). The metric must not be gameable, for example by fixing the force threshold before the trials.

**Stacks:** ElevenLabs (audio cue; weak, earbud prize); Arduino UNO Q, which would need physical work and Arduino Project Hub posting. The kit lists Buzzer, Knob and Thermo Modulinos only (L2738), so there is no vibration motor. Tiger Data; Codex.

## Opportunity 3: Human takes over when the policy is unsure, and each takeover becomes training data

**Gap.** Teleop and autonomy are usually presented as separate phases. Rokoko's own showcase says a policy "performed the task autonomously" but gives no metric and no failure handling (YAAK page). Interactive imitation learning (HG-DAgger, RaC, RoboCopilot) shows that human corrections during rollouts beat batch demos. RaC reports outperforming full-demonstration and HG-DAgger-style collection on real bimanual tasks. The dexterous-hand versions are sparse according to a 2025 survey (https://arxiv.org/pdf/2506.00098, https://arxiv.org/pdf/1810.02890, search summaries). A glove fits handoff well because the operator's hand is always tracked. Agent B lists "correction-in-the-loop" as absent from the stacks it reviewed (competitive.md §8).

**Opportunity.** The policy runs. An uncertainty signal, such as ensemble disagreement or action variance, lights up. The gloved operator "grabs" control with a clutch gesture, since YAAK already uses a clutch. The correction is logged and the policy retrains, so over a few rounds intervention rate falls and success rises. Legible live loop: "the robot asked for help 6 times in round 1 and 2 times in round 3".

**Why the sponsor would care.** It fits the "teleop is how robots get smarter" thesis (L1050, L1076) and the human-control criterion (L1123). It is new content, not a repeat of the YAAK blog.

**How it reads to the overall jury.** Strong technical depth plus a curve that cannot easily be faked (interventions per episode over rounds). Real-world user: fleet operators supervising many robots. Risk: needs a working base policy by about hour 28 (estimate). Fallback: show the loop on a simpler task.

**Stacks:** Verda (fast retraining between rounds, L2139) or Modal (pick one primary); Tiger Data or MongoDB (episode and intervention log); Codex.

## Opportunity 4: Record the hand once, drive many robots (portable human-hand data)

**Gap.** The gloves capture a 26-joint human hand, but each robot hand needs its own retargeting. Rokoko's integration list is partial and inconsistent, with Inspire "coming soon" (robotics page), and the SDK ships no general retargeter: the ROS 2 bridge does none and the Isaac `DexRetargeter` is a stub (sdk.rokoko.com). `dex-retargeting` covers Inspire, Leap, Allegro and Shadow but not Unitree Dex3, the G1's hand (L1200; Agent D). No metric is reported for *how well* a retargeting preserves grasp intent across hands (unknown).

**Opportunity.** Treat the human recording as the asset. One live glove stream drives three different simulated hands side by side, with a grasp-intent preservation score per hand: the same object gets grasped by Inspire, Leap and Dex3. Recorded human demos are re-emitted as robot datasets for whichever hand a lab owns. Optional extra: a glove versus leader-arm comparison on the SO-101 that Ignite × Intel stations use (L981-L982); whether we may use those stations is unknown.

**Why the sponsor would care.** It directly widens Rokoko's addressable market (any hand, including "coming soon" ones) and supports the "data-first" pitch.

**How it reads to the overall jury.** Visually striking: one human hand drives three robot hands at once. Usefulness is clear to robotics labs but abstract to peers. Evidence: a per-hand success rate on a fixed grasp set. Risk: it can look like "just mirroring" unless the score and the task are prominent.

**Stacks:** Verda (only if policies are trained per hand); Codex. Fewer natural stacks.

## Opportunity 5: Whole-body suit plus gloves as an underused capability (creative or entertainment angle)

**Gap.** Rokoko lists a suit + gloves + Coil Pro robotics bundle but the page "doesn't describe how full-body data is applied to robots" (robotics page). Whole-body humanoid mimicry already exists (TWIST, HumDex, IMU-suit G1 papers in competitive.md), so "copy my dance" is crowded. Two uses are less covered (estimate): using the *body* to control a *non-humanoid* or bimanual system, such as torso lean for mobile-base or arm reach and fingers for grippers; and a performance or puppetry piece that fits the entertainment interest (L1070).

**Why the sponsor would care.** It showcases the suit, the second-place prize product (L1135), and Rokoko's animation roots crossing into robotics.

**How it reads to the overall jury.** High wow on the peer floor. Weaker on "worthwhile problem" and "measured evidence" unless tied to a real user, for example operator ergonomics with fatigue measured over a 10-minute task. Real G1 access is gated by the safety filter (L1241), so the demo would be in sim. Lowest jury fit of the five (estimate).

**Stacks:** Codex; ElevenLabs if it is a performance; little else that is honest.

---

## Stackable tech challenges (honest fit across directions)

| Tech challenge | Fit | Note |
|---|---|---|
| Verda Compute Track | **Strong** | Named explicitly for Rokoko teleop data (L2139). Requires documenting the process and posting a summary in Discord. |
| Best Use of Codex | Strong | Development-only use counts per the tech-challenge digest. |
| Tiger Data | Good for 1-3 | 83-200 Hz glove and suit telemetry is real time-series data. Judging criteria are prose only. |
| Gemini API / Gemma | Good for 1 | Natural-language coaching from telemetry. Gemini requires 18+ participants. |
| Nemotron 3.5 Super VL | Possible for 1 | Must be central: a VLM judging episode video would qualify. Otherwise it is a stretch. |
| Modal | Possible | Alternative to Verda for training. Stacking both is credible only if each has a distinct role (estimate). |
| MongoDB Atlas | Weak-OK | Episode metadata store. |
| ElevenLabs | Weak | Audio cue in Opportunity 2. |
| Arduino UNO Q | Weak, costly | Physical work and a Project Hub post. The kit has no vibration module (L2738). |

## Estimates (labelled as estimates)

- **Differentiation potential: 7/10.** The base loop is Rokoko's own showcase, so it differentiates poorly. Opportunities 1 and 3 add a layer that the sponsor's showcase and the open-source stacks lack, backed by 2025-2026 research that is still pilot-scale. That makes it plausible for us to be first at Junction, but these are not unknown ideas.
- **Demo potential: 7/10.** A live gloved operator is inherently watchable, and the sim path keeps reliability at about 7/10 (Agent D). Points come off for magnetic drift, Coil Pro distortion and a policy that could fail live. A real robot would raise the wow factor but drop reliability to about 3/10.
- **Overall-jury fit: 6/10.** Opportunities 1-3 score well on technical depth and measured evidence (baseline vs. assisted or curated, an intervention curve). "Worthwhile problem with a specific user" is narrower, since the user is robot-learning teams rather than the public, and peers who are not roboticists may need more than 60 seconds to get it unless the before/after is a single number on screen.

## Sources opened
- /Users/ciprian/code/Junction 26/docs/JUNCTION_2026_CHALLENGES.md L951-L1002, L1038-L1141, L1230-L1245, L2125-L2160, L2730-L2740
- /Users/ciprian/code/Junction 26/docs/00-Jury-profiles-and-pitch-guide.pdf p.1-2
- Agent A, B and D reports in /Users/ciprian/code/Junction 26/docs/challenge-selection/
- https://www.rokoko.com/insights/collecting-robot-training-data-with-rokoko-smartgloves
- https://www.rokoko.com/use-cases/robotics
- https://arxiv.org/abs/2605.26349
- Search-result summaries only (not opened in full): arXiv 2505.22626, 2604.23000, 2603.05804, MERL TR2021-063, 2506.00098, 1810.02890

<!-- complete -->
