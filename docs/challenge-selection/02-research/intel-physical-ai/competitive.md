# Competitive intelligence: Stop Simulating, Start Moving (Intel Physical AI)

Challenge text: CHALLENGES.md:L947-L1037. Agent A's report: `docs/challenge-selection/01-challenge-intelligence/intel-physical-ai.md`.

**Summary**
- The challenge is highly *prescribed* (same kit, same stack, same pick-inspect-sort task for every team), so there is no "novel idea" space; teams are separated by execution quality and measurement rigour, not concept.
- Public prior art for each piece exists (LeRobot SO-101 ACT/VLA tutorials, Anomalib+OpenVINO defect tutorials, Intel's own hackathon kit). I found no public project doing the full loop (SO-101 + Anomalib + sort + OpenVINO NPU), but a lablab.ai team plans a very similar pipeline (snippet only, unverified).
- Estimated crowding: medium-high in *concept*, but self-limited by 25 stations (L981) and a hardware-wary participant base. Fewer teams than a software challenge, all with identical demos.
- To stand out: measured reliability on shifted/cluttered layouts, honest INT8/FP16 x CPU/iGPU/NPU latency-power-thermal table, anomaly-triggered recovery, and a success-vs-demo-count curve.

## Evidence limits (read first)
- Junction winners for any Intel, robotics or Arduino-track challenge: **unknown**. Searches found no such records (searches for "Junction Intel challenge winner" returned only other events). I did not open junction.fi/Devpost winner pages.
- lablab.ai project pages (percept2act, one-army, edgevla-lite, synelar bimanual) all 301-redirected to an unrelated site when fetched, so for those I only have **search-result snippets**, not opened pages. Treat them as "reported plans", not outcomes.
- Pages actually opened are marked [opened]; search-snippet-only are marked [snippet].

## 1. Prior winners and hackathon submissions

| Event / project | What it was | Relevance | URL |
|---|---|---|---|
| Embodied AI Hackathon (Circuit Launch / Seeed, Mountain View), winner "Firebreathing Rubber Duckies" [opened] | Two SO-ARM100 arms, collaborative bowl-to-bowl pick-and-place; teleop demos, trained GR00T N1, ACT, Pi0; dataset on HF, code on GitHub | Same hardware family, same teleop->VLA recipe. Winning angle was dual-arm cooperation plus open datasets, not the basic pick | https://www.hackster.io/news/embodied-ai-hackathon-winners-announced-2dc69c76942e |
| AMD Robotics Innovation Challenge winners [opened] | Five startups (e.g. Phuc Labs "Vision Valve" image-based particle sorting; Black-I palletizing arm) | Sorting by vision is a known winning theme, but these were company products, not 40-hour builds | http://www.robotics247.com/article/amd_massrobotics_announce_amd_robotics_innovation_challenge_winners |
| AMD Open Robotics Hackathon recap [snippet] | Task: pick small object, place in bin | Same basic task as the baseline here | https://www.amd.com/en/developer/resources/technical-articles/2025/amd-open-robotics-hackathon-recap.html |
| LeRobot Worldwide Hackathon winners space [snippet, page unreadable] | Official winners list for a global SO-101/SO-100 hackathon | Worth the team opening manually to see winning styles | https://www.huggingface.co/spaces/LeRobot-worldwide-hackathon/all-winners/blob/main/index.html |
| lablab.ai AI Infra Summit hackathon, Intel Robotics/Physical AI track [snippet] | Entries: "percept2act" (Anomalib defect detection + Physical AI Studio VLA reasoning + OpenVINO on Core Ultra Series 3 + SO-101 response); "EchoGrasp" (voice-directed bimanual arm); "intelai bimanual table setting"; "edgevla-lite"; "one army" | Closest public analogue to this exact stack. Descriptions are plans; outcomes/prizes unknown | https://lablab.ai/ai-hackathons/ai-infra-summit-hackathon/percept2act (redirects away), https://lablab.ai/ai-hackathons/ai-infra-summit-hackathon/edgevla-lite |
| SO-101 hackathon HIL-SERL project [snippet] | Cube picking via human-in-the-loop RL on SO-101 | Shows RL-on-real-arm as an alternative angle | https://trunc8.github.io/projects/hil-serl-lerobot |
| Previous Junction results | Main prizes went to varied software/product teams; Movesense (hardware sensor) challenges ran in 2017/2018 [snippet] | No Intel/robotics winner found. Junction history: unknown for this track | https://www.movesense.com/news/2018/11/movesense-shined-in-junction-hackathon/ |

## 2. Open-source implementations (the building blocks)
- **OpenVINO Physical AI** [opened]: one API for cameras/robots/policies (ACT, SmolVLA, PI0.5), SO-101 and RealSense supported, async + Real-Time Chunking, CPU/GPU/NPU scheduling, safety hooks. https://www.intel.com/content/www/us/en/developer/tools/openvino-toolkit/physical-ai.html ; repo github.com/openvinotoolkit/physicalai (listed there, not opened).
- **Intel Robotics AI Suite hackathon resources** [snippet]: install scripts for NPU/iGPU drivers, Physical AI Studio, OpenVINO 2026.3, Anomalib v2.6.0, LeRobot (page redirected when fetched). https://docs.openedgeplatform.intel.com/dev/edge-ai-suites/robotics-ai-suite/resources/hackathon_resources.html
- **Anomalib + OpenVINO defect tutorial** [snippet]: train, test, export to OpenVINO; example used a Dobot arm. https://www.intel.com/content/www/us/en/developer/articles/training/defect-detection-with-anomalib.html and https://medium.com/openvino-toolkit/hands-on-lab-how-to-perform-automated-defect-detection-using-anomalib-5c1cfed666b4
- **SO-ARM101 ACT case study** [opened]: 30 demos gave 5/5 from a fixed start; 50 demos with varied poses gave 3/7 on new starts (conditions differ, not a fair comparison). Gotchas: camera index swaps, object-pose sensitivity, calibrate first. https://openelab.io/sv/blogs/learn/so-arm101-pick-and-place-lerobot-act-case-study
- Searches found **no existing repo** combining SO-101 + Anomalib + sort (one search, may have missed niche repos).

## 3. Commercial products already solving this
- Trossen Robotics on Core Ultra Series 3: adaptive sorting of mixed components, kitting, imitation learning [snippet]. https://builders.intel.com/docs/networkbuilders/enabling-physical-ai-with-trossen-robotics-on-the-intel-core-ultra-series-3-processors-1773151936.pdf
- Intel's own Physical AI Studio demo with two SO-101 arms doing imitation learning (ITmedia report) [snippet]. https://monoist.itmedia.co.jp/mn/articles/2608/06/news022_2.html
- Industrial pick-and-inspect cells (vision QC + robot sorting) are an established category; the Phuc Labs Vision Valve above is one example. Specific vendors beyond these: not researched.

## 4. What most teams will reach for first (estimate)
Inferred from the mandated task (L965) and the public tutorials above:
1. Follow Intel's install script, record ~30-50 teleop episodes, train ACT/SmolVLA, get a pick-and-place working, bolt on Anomalib as a separate "classifier" step, report one OpenVINO export on whichever device works.
2. Fixed brick position, fixed lighting, one or two demo runs shown live, success quoted as "it worked N/M times".
3. Defects = obvious (missing stud, wrong colour, broken piece) so Anomalib scores trivially.
4. Latency table with only CPU vs GPU, or just "runs on NPU" with no power/thermal numbers.

## 5. Obvious ideas to avoid
- Plain "teleop -> ACT -> pick brick -> Anomalib good/bad -> two bowls" with no extra evidence.
- Adding an LLM voice command layer ("sort the red ones") on top: seen at lablab (EchoGrasp-style) and unrelated to the 30% task / 30% Intel criteria (L1004-L1020).
- Bimanual or table-setting variants: the kit is one follower arm (L982); also seen at lablab.
- Sim-to-real pitch: the challenge title is literally "Stop Simulating".
- Slick UI dashboard as the differentiator: scored on neither axis.

## 6. Crowding estimate (estimate, not sourced)
**Medium-high concept overlap, medium team count.**
- Limiter: only 25 stations (L981); allocation process unknown. Past hackathons with SO-101 kits (Embodied AI, LeRobot Worldwide) drew many teams, but those were robotics-focused events; Junction is software-leaning, and the team brief says many participants avoid hardware work.
- Booster: EUR 5,000 first prize (L1022) is substantial, and every team gets identical, guided hardware, which lowers the barrier. Intel engineers on site (L988) and the Saturday 12:00 session (L992) help beginners.
- Net: expect most of the 25 stations to be claimed, with maybe 10-25 teams, nearly all producing the same demo. Rubric (L1004-L1020) rewards measurable depth, so the median team will score mid-range on task success and low on efficiency data.

## 7. How to look different
1. **Reliability evidence**: 20+ bricks, shifted and cluttered layouts, reported success rate with counts and failure taxonomy (the OpenELAB case study shows how fragile naive policies are).
2. **Real Intel integration depth**: VLA on iGPU, Anomalib on NPU, INT8 vs FP16 table of latency, power, thermals (maps to the 30% + 20% criteria).
3. **Closed loop**: anomaly score triggers re-grasp/re-inspect, not just a sort decision.
4. **Dataset story**: success-vs-demo-count curve, dataset published on Hugging Face (Firebreathing Rubber Duckies did this).
5. **One twist**: few-shot new defect type introduced live at the demo.
Caveat: all rubric weights may be restated at kick-off (Terms §3 per Agent A), and the single biggest risk is physical hardware/arm calibration time, not ideas.

<!-- complete -->
