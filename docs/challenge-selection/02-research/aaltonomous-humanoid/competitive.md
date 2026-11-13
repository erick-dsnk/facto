# Aaltonomous Humanoid: competitive intelligence (Agent B)

**Summary**
- No public record found of previous Junction winners for a robotics challenge or for this sponsor's humanoid challenge; the challenge is new (starter repo has 2 stars, 7 commits, no public solutions). The nearest evidence is from other robot hackathons (LeRobot, Embodied AI, Humanoid Hack Tokyo), where winners fine-tuned VLAs (GR00T, SmolVLA) on a few hundred demos.
- The organisers themselves publish five "starter paths" (classical, VLM planner, IL/VLA, RL, real2sim), so those are exactly what most teams will start from. Differentiation has to come from the real-robot result and the sim-to-real/generality story, not from picking a route.
- Estimated crowding: medium among teams that pick it (my estimate, reasoning in section 5), but the field is thinned by hard filters (GPU-heavy sim, Docker policy server, sim gate). The pool that actually reaches the real robot is about 5 teams.
- Estimated competitor quality is bimodal: many classical/VLM-skill submissions near the baseline (~76-82% of objects in nominal sim per the FAQ), and a few strong VLA/real-data teams.

Sources opened are marked (opened). Items seen only in search-result snippets are marked (snippet) and not verified by me.

## 1. What the organisers already hand out (the "floor" everyone starts from)
- Repo: 2 stars, 0 forks, 7 commits, MIT, no visible participant solutions (opened) https://github.com/zupermiez/aaltonomous-humanoid
- Classical baseline: HSV colour blobs + head depth, Pinocchio damped-least-squares IK, waypoint planner, state machine. Rung 1 only, no shape or instruction handling (opened) https://raw.githubusercontent.com/zupermiez/aaltonomous-humanoid/main/aaltonomous/docs/participants/STARTER_PATHS.md
- Baseline performance: about 76-82% of objects sorted in nominal sim seeds 0-7 with zero clips; failures mostly triangle pinch slips or the 120 s limit; completed one real-robot pick (opened) https://raw.githubusercontent.com/zupermiez/aaltonomous-humanoid/main/aaltonomous/docs/participants/FAQ.md
- Each pick takes about 10-20 s against a 120 s budget (STARTER_PATHS, opened). Implication: a correct but slow pipeline caps at roughly 6-12 objects of time, so 5 objects is feasible but with little margin for retries (my inference).
- Starter paths listed by the organisers: Classical, VLM planner + skills, IL/VLA (about 20 real demos per rung, LeRobot v3.0 and GR00T formats), RL (Isaac Lab, privileged state for training only), Real2sim (re-texturing, depth noise, Gaussian splats, Dex3 friction/PD fitting) (STARTER_PATHS, opened).
- Scoring: +1 per correct object (+2 in language mode), -1 wrong bin, -1 knocked off. Finals: 3 real episodes, the unseen instruction weighted x1.5; real score decides, sim breaks ties (RULES_AND_SCORING, opened) https://raw.githubusercontent.com/zupermiez/aaltonomous-humanoid/main/aaltonomous/docs/participants/RULES_AND_SCORING.md
- Number of finalists is not stated in the rules ("Top ~5" appears only in CHALLENGES.md:L1277).

## 2. Previous winners and similar hackathon projects
Junction / this sponsor
- Junction 2025 Aalto challenge was a voice assistant for older adults (winner "Tommin Teekkarit", ApprenticeCircle+), not robotics (snippet) https://www.aalto.fi/en/news/aalto-students-and-researchers-shape-together-how-we-age-with-ai-at-junction-hackathon-2025
- Junction past robotics winners: searches for Junction 2024/2025 robot challenge winners returned nothing; unknown. Treat this as a first-of-its-kind Junction challenge.
- Aaltoes x LeRobot Robotics Hackathon, 14 June 2025, Startup Sauna Espoo, 12 SO-101 arm sets; the page lists no tasks or winners (opened) https://www.aalto.fi/en/events/aaltoes-x-lerobot-robotics-hackathon. Local teams with LeRobot experience therefore exist.
- Four Aalto master's students won a Robotics Nation Physical AI Hackathon with VLAs they had never used before, beating PhD-level teams; they started a company on learning from demonstrations (snippet; event not confirmed as Junction) https://www.aalto.fi/en/news/prototyping-and-validation-grant-deployable. Lesson (inference): VLA fine-tuning is the proven winning pattern in this local scene.

Other hackathons
- LeRobot Global Hackathon 2025 London, 2nd overall and Technical Experts Award: plastic/paper sorting on a conveyor, SO-101, GR00T N1.5 fine-tuned on 124 episodes, after ACT from scratch and SmolVLA fine-tuning were tried first; no quantitative metrics given (opened) https://om-kulkarni.github.io/projects/waste-segregation-hackathon
- Embodied AI Hackathon (NVIDIA, Hugging Face, Seeed): winner "Firebreathing Rubber Duckies", two SO-ARM100 arms trained for collaborative pick-and-place (snippet) https://www.hackster.io/news/embodied-ai-hackathon-winners-announced-2dc69c76942e
- robo.innovate 2025 (TUM): overall winner "Picking Perfection", a sorting-of-components robot arm solution (snippet) https://mirmi.tum.de/en/mirmi/news/article/roboinnovate-hackathon-2025-advancing-robotics-and-ai-solutions
- Humanoid Hack Tokyo, 30-31 May 2026, Unitree G1: top prize to team BLACK AI for a mochi-pounding demo with a human partner, judged on cultural storytelling rather than benchmark score (snippet) https://ainews.washinmura.jp/ainews/en/article/robotmate-hub-com/2026-06-02-%E9%96%8B%E5%82%AC%E3%83%AC%E3%83%9D%E3%83%BC%E3%83%88-humanoid-hack-tokyo-%E4%BA%8B%E5%89%8D%E7%99%BB%E9%8C%B2100%E5%90%8D%E8%B6%85-uni. Contrast: Aaltonomous is a measured benchmark, so a story alone will not win, but presentation is 15% (CHALLENGES.md:L1265).
- Same sort of sorting task on cheap arms: VoiceSort, language-conditioned bimanual SO-101 (lablab submission; link redirected to an unrelated site, so contents unverified) https://lablab.ai/submissions/xqjcu43t37jkdcu7am3a6yh7; MediSort on Devpost (snippet) https://devpost.com/software/medisort-yqk9im
- A closely related public competition format: CVPR Humanoid-Object Interaction Challenge (snippet only) https://human-robot-scene.github.io/Humanoid-Object-Interaction-Challenge

## 3. Open-source implementations and commercial products
Open source
- NVIDIA Isaac GR00T, with UNITREE_G1 as a registered embodiment tag; checkpoint GR00T-N1.7-ApplePnP-V1 trained on 402 teleop demos on a G1; N1.6 checkpoint for apple-to-plate (snippets) https://github.com/NVIDIA/Isaac-GR00T and https://huggingface.co/nvidia/GR00T-N1.7-ApplePnP-V1
- NVIDIA end-to-end G1 workflow: teleop, collect, GR00T post-training, Isaac Lab-Arena eval, deploy; estimated 3-6 hours; only worked task is apple pick-and-place (opened) https://docs.nvidia.com/learning/physical-ai/gr00t-e2e-workflow/latest/index.html. A ready recipe teams will follow, but it targets Jetson Thor deployment and a different hand/scene, so only the recipe transfers (my inference).
- Community GR00T N1.5 LoRA fine-tune on 5 sim demos for a G1 chess placement task (snippet) https://discuss.huggingface.co/t/fine-tuning-gr00t-for-chess-setup-on-unitree-g1/172323
- LeRobot (ACT, Diffusion Policy, SmolVLA), openpi, Isaac Lab Mimic are named by the organisers (STARTER_PATHS, opened).
- Language-conditioned open-vocabulary planners: "Bounding Boxes as Goals" (GRASP, arXiv 2606.12910, training-free, GroundingDINO + VLM neuro-symbolic planning, sorting/arrangement) (snippet) https://arxiv.org/abs/2606.12910; RoboDexVLM (VLM planner with recovery for dexterous manipulation) https://arxiv.org/pdf/2503.01616; training-free task-oriented grasping with a grasp generator plus VLM filter https://arxiv.org/html/2502.04873v1 (snippets).
- Other G1 hackathon repo: https://github.com/sl628/g1_hackathon (snippet; contents unknown).

Commercial
- General-purpose robot brains with sort/pick-and-place demos exist (physical-intelligence pi0 family, Figure, etc.), but I did not open any page for them in this run, so I make no specific claims; the point (my inference) is that "VLA does pick-and-place" is no longer novel to judges.
- Unitree G1 itself ships with teleop/RL locomotion SDK, not manipulation autonomy; the brief states it has "very little autonomy" (CHALLENGES.md:L1157).

## 4. Approaches most teams will reach for first (and what judges will have seen)
Ranked by my estimate of popularity among teams that pick this challenge:
1. Tune the classical baseline: fix triangle/cylinder grasps, add speed, parse instruction with regex. Cheap, passes the sim gate, plateaus near baseline.
2. Fine-tune an off-the-shelf VLA (GR00T N1.x, SmolVLA, pi0, ACT) on the released real demos (about 20 per rung). Matches the pattern that won other hackathons. Risks: 80 GB GPUs needed for fine-tuning (STARTER_PATHS), sim-to-real visual gap, 27 Hz gate with a large model.
3. LLM/VLM planner (cloud API or local) parsing the instruction into a colour-to-box map, calling baseline skills. Cloud APIs are risky: no network guaranteed in finals, no reruns (FAQ, opened).
4. RL in Isaac Lab with privileged state: 40 h is short and Dex3 contact physics is not fitted (STARTER_PATHS), so most will abandon it.
5. Real2sim touches (DR, re-texturing): listed as organiser-endorsed and rewarded under generality, but rarely quantified in hackathon demos.

Obvious ideas to avoid presenting as the idea
- "Fine-tune GR00T/SmolVLA on the released demos and submit."
- "Classical vision + IK with an LLM to read the instruction."
- "Domain randomisation to close the sim gap" without numbers.
- A pure presentation/story project with a mediocre real score (the Tokyo-style win does not transfer to a scored benchmark).
- Anything depending on a cloud LLM at run time without an offline fallback.

## 5. How crowded will it be? (estimate)
- Estimate: medium crowding by sign-ups, low among teams that finish a gate-passing submission. Expect perhaps 5-15 teams to pick it out of the whole event (guess; Junction attendance of 1500+ in 2025 is from a snippet, https://hackjunction.app/hackathons/junction-2025, and no per-challenge sign-up count was found: unknown).
- Reasons it draws interest: a real Unitree G1 is a rare draw; physical AI is topical; prize includes a lab visit; the robot is shown live in finals.
- Reasons it is thinned: needs an RTX-class GPU with ray tracing, 5-10 min shader start, a Docker policy server (CHALLENGES.md:L1215, L1233); sim gate with zero clips and at least 27 Hz (FAQ); robotics expertise and a dedicated hardware filter among attendees; prize cash is modest (2,000 euro, CHALLENGES.md:L1273) compared with other tracks, which lowers pull.
- Selection mechanism: only about 5 teams reach the real robot (CHALLENGES.md:L1277), picked by sim score on a hidden variant. Competition is therefore effectively against the sim leaderboard first, then against real-robot luck.
- Note on overall prize: real-robot result dominates, so a team that fails the real run is invisible to the jury. For the overall peer-vote objective this challenge is weaker unless the demo is visibly successful (my inference).

## 6. What would make a submission look different
Judging weights: real-world 40%, generality 25%, originality 20%, presentation 15% (CHALLENGES.md:L1253-L1267). The sponsor asks for robustness to sim-real mismatch, general ideas, and doing much with little real data (L1188-L1194).
Differentiators that I believe few teams will deliver (inference):
- A measured sim-to-real story: before/after numbers for a specific gap fix (depth noise model, Dex3 friction fit, re-textured sim from the venue images), shown on a plot, with the real data used counted explicitly.
- Hybrid, not single-route: robust scripted grasp primitives (fix triangle/cylinder slips, both arms in parallel) driven by an offline instruction parser or small local VLM running asynchronously, so the 30 Hz command loop never blocks (hold/action-chunk pattern the FAQ allows).
- Triage of the raw demo data: the FAQ says episodes are mixed good/failed/messy and "judging which are good is part of the challenge", so an automatic demo-quality filter or failure-recovery learning from failed episodes is a distinctive angle.
- Verification and recovery: closed-loop checks (object visible in box via wrist camera, retry on slip) rather than open-loop sequences; the scoring penalises wrong bins and knock-offs, so safe failure ("leave on counter" scores 0, not -1) is a strategic point.
- Generality demo: show the same stack on a new object/box layout or paraphrase set, tying to the "beyond a single task" criterion, without touching held-out seeds (disqualifying per Agent A's list).
- Honest evaluation tooling: public paraphrase test-set and a sim-vs-real score table in the presentation.

## 7. Gaps and unknowns
- No Junction history for robotics challenges, no per-challenge sign-up counts, number of finalists, the sim-gate pass rate, and the sim leaderboard are unknown.
- I did not open pages for commercial robot-brain products; no claims made about them.
- Several hackathon results are snippet-only and should be re-checked before being quoted.

<!-- complete -->
