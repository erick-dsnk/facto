# Intel Physical AI Challenge (intel-physical-ai): technical feasibility

**Summary**
- **Buildable, but on a tight schedule.** The stack is real and it supports the SO-101 directly. Physical AI Studio v0.3.0 has an SO-101 setup and calibration wizard, and OpenVINO Physical AI ships an SO-101 plugin and a collect → train → deploy tutorial. That means no electronics work. The schedule pressure comes from robot time and training time: each policy iteration costs about 2-3 hours of recording plus 2-5 hours of cloud training, so we get **2, maybe 3 iterations in 40 hours** (estimate).
- **The NPU is the weak spot.** Studio's own UI hides the NPU because "We've not yet verified that running our models on NPU works". Anomalib's OpenVINO inferencer lists NPU as a target. So the safe split is **policy on the iGPU and Anomalib on the NPU**. Getting the VLA itself onto the NPU is a research-grade task that Intel has only shown for π0.5, using custom zero-copy work.
- **Known open bugs sit on the likely path.** Exporting SmolVLA to OpenVINO from Studio fails (#1384, open, 5 Nov 2026), and INT8 quantization is not in the Studio UI yet (#1320, PR unmerged). π0.5 fine-tuning needs a GPU with 40 GB or more of VRAM.
- **Smallest complete version (estimate, about 85% achievable):** ACT or SmolVLA picks a brick from a constrained tray area and presents it to the inspection camera. Anomalib (PaDiM or PatchCore) classifies it on the NPU. A drop into a fixed bowl finishes the cycle. We report a measured 10-20 brick run and a latency and power table. A *reliable* live run on shifted or cluttered bricks is the hard part. Estimated live-demo success is about 50%, and a judged run of 10 bricks will very likely show at least one failure.

## 1. What a credible entry has to contain

Mandatory elements (CHALLENGES.md:L963-L965):
1. Teleoperated demonstrations recorded on the SO-101 with the leader arm.
2. A VLA policy fine-tuned **in Physical AI Studio** on cloud GPUs.
3. An Anomalib model that separates good bricks from defective ones at the inspection point.
4. A fully autonomous loop: pick, show the brick to the inspection camera, drop it into the good or defective bowl.
5. Models optimized with OpenVINO, running on the laptop's CPU, GPU and NPU.

### Recommended architecture

```
 top camera (RealSense D415) ─┐
 wrist camera ────────────────┼─► VLA policy (OpenVINO IR, iGPU, async/RTC chunking)
 joint state ─────────────────┘        │  phase A: "pick a brick and present it"
                                        ▼
                     arm holds brick at inspection pose
                                        │
 inspection camera ──► Anomalib (OpenVINO IR, NPU; CPU fallback) ──► score + heatmap
                                        │
                   orchestrator (Python state machine on CPU)
                    ├─ score < t_low  → phase B "place in good bowl"
                    ├─ score > t_high → phase B "place in defective bowl"
                    └─ ambiguous      → rotate and re-inspect, or re-grasp (the L969 hint)
                                        │
 telemetry: per-stage latency, cycle time, package power and temperature → small dashboard + CSV
```

Design choices, all of them estimates:
- **How the policy chooses a bowl.** There are three ways to do it.
  - **(a)** A language-conditioned VLA (SmolVLA or π0.5) gets the prompt "place in good bowl" or "place in defective bowl". This needs demonstrations for both endings.
  - **(b)** Two short policies: one for pick-and-present and one for each place.
  - **(c)** The VLA does pick-and-present, which is the only part where positions vary. The drop into a *fixed* bowl is a recorded trajectory replay. This is the most robust option, but judges may read the replay as "not fully VLA". Use it only as a fallback.

  Plan for (a), and keep (c) ready as a switch.
- **Choice of policy.** Physical AI Studio supports ACT, Pi0.5, SmolVLA, MolmoAct2, RLDX-1, XR0 and Cosmos3 ([repo](https://github.com/open-edge-platform/physical-ai-studio)).
  - ACT is the smallest and fastest to train, but it takes no language input, so it is arguably not a "VLA". Whether ACT satisfies the "VLA policy" requirement at L965 is **unknown**, so ask.
  - SmolVLA (450M) is the obvious VLA choice, but its Studio export is currently broken (see §3).
  - π0.5 is what Intel's own SO-101 tutorial uses, but it needs at least 40 GB of VRAM to fine-tune ([tutorial README](https://github.com/openvinotoolkit/physicalai/tree/main/examples/tutorials)).
- **Anomalib model.** Use PatchCore or PaDiM, both of which train in minutes from good images only. Anomalib exports most models to OpenVINO IR ([anomalib repo](https://github.com/open-edge-platform/anomalib)). Its `OpenVINOInferencer` accepts `device` "AUTO, CPU, GPU, NPU" ([deploy docs](https://anomalib.readthedocs.io/en/v1/markdown/guides/reference/deploy/index.html)). We have not confirmed that PatchCore's memory-bank nearest-neighbour graph compiles on the NPU. PaDiM is the safer NPU candidate (estimate), so benchmark both on day 1.
- **Defects.** We create the defects ourselves with markers (L963, L984). Pick defects that are visible but not trivial, such as marker dots and scratches on one face. Then the model can catch them reliably and still be convincing as anomaly detection.

## 2. Critical dependencies and how we get them

| Dependency | Source / access at event | Status |
|---|---|---|
| Station: SO-101 follower and leader, wrist camera, 2 external cameras (one D415), Panther Lake laptop with 64 GB RAM | Provided. 25 stations, one per team (CHALLENGES.md:L981-L984) | **Allocation process unknown.** Kit cannot leave the Hardware Lab (Challenge Terms §1, via Agent A) |
| Physical AI Studio (record, train, export) | Open source, Apache-2.0, tags `app/v0.3.0` and `lib/v0.3.0` ([repo](https://github.com/open-edge-platform/physical-ai-studio)). Docker setup with `--cpu/--xpu/--cuda`. HF-backed policies need `HF_TOKEN` | Presumably preinstalled on the laptops (unknown). Bring our own Hugging Face token |
| SO-101 support in Studio | UI route `so101-setup` with a calibration wizard, plus backend `so101_setup_worker.py` (found by GitHub code search in the repo) | Available |
| OpenVINO Physical AI runtime | `pip install physicalai`, with an SO-101 plugin and a RealSense extra ([repo](https://github.com/openvinotoolkit/physicalai)). Runtime config `device: GPU # GPU \| CPU \| NPU` (examples/runtime/runtime.yaml in that repo) | Young project: 272 commits, empty Releases page |
| Cloud GPUs for training | "Cloud GPU instances for policy training" (CHALLENGES.md:L985) | **GPU type, VRAM, count per team, quotas and queueing are unknown.** π0.5 needs ≥40 GB VRAM. SmolVLA takes about 4 h for 20k steps on one A100 ([LeRobot SmolVLA docs](https://huggingface.co/docs/lerobot/smolvla)) |
| Anomalib | v2.7.0, with OpenVINO export ([repo](https://github.com/open-edge-platform/anomalib)) | Available. Runs on the laptop, no cloud needed |
| Robotics AI Suite | Mentioned at L979 and in the criteria at L1012 | Which components count for "integration" is **unknown**. The release-notes page redirects, so it was not read |
| Power and thermal telemetry | Needed for the 20% efficiency criterion (L1018-L1020) | Tooling is not named by the sponsor. On Linux we can use RAPL and `intel_gpu_top`-style tools (estimate). The OS image is unknown |
| Intel engineers (3-5 daily) and the Saturday 12:00 session | CHALLENGES.md:L988, L992 | The most valuable dependency: they know which policy and export paths actually work |

No paid APIs are involved. Pricing does not apply, except for cloud GPU quotas, which are unknown.

## 3. Documented limits, bugs and maturity problems

- **NPU is not verified for policies.** Physical AI Studio's model backend selector filters NPU out with the comment `// We've not yet verified that running our models on NPU works, so we filter it out for now` (`application/ui/src/features/models/backend-selection/backend-selection.tsx` in the [Studio repo](https://github.com/open-edge-platform/physical-ai-studio)). The OpenVINO adapter accepts `'NPU'` as a device string ([physicalai repo](https://github.com/openvinotoolkit/physicalai)), but no one has published SO-101 policy latency on the NPU. *Implication:* "VLA on NPU" is a gamble. Put Anomalib on the NPU to meet the L965 requirement.
- **Intel's own heterogeneous VLA work is custom engineering.** Intel's π0.5 paper puts the vision and language encoders on the iGPU and the action expert on the NPU, handing off the KV cache with zero copies through the OpenVINO USM remote-tensor API ([Intel π0.5 paper](https://docs.openedgeplatform.intel.com/shared_media/publication-optimize-pi0.5-paper.pdf), §5). It reports π0.5 latency on the Panther Lake iGPU going from 555 ms to 172 ms per chunk after optimization (3 cameras at 224×224, FP16, 10 denoising steps), with a 90% LIBERO success rate, and notes that the iGPU and NPU slow each other down because they share a memory controller. Copying that split for SmolVLA, which has the same VLM-plus-action-expert shape, is a stretch goal and not a day-1 task (estimate).
- **SmolVLA export from Studio is broken right now.** Issue #1384 "Exporting SmolVLA to OpenVINO via studio fails with keyerror" is open, opened 5 Nov 2026, on Studio 0.3.0, with no workaround ([issue](https://github.com/open-edge-platform/physical-ai-studio/issues/1384)). The error is a camera-key mismatch (`expected ['images.overview'] got ['images']`). Camera naming might work around it (estimate), but that is unverified.
- **INT8 is not exposed in Studio.** Issue #1320 says the library has INT8 weight-compression hooks but Studio does not expose them. The PR adding "OpenVINO INT8 model optimization" was still open ([issue](https://github.com/open-edge-platform/physical-ai-studio/issues/1320)). Quantizing means scripting NNCF or the library directly. That is easy for us, but it means leaving the Studio UI.
- **Other open Studio issues relevant to us** ([issues list](https://github.com/open-edge-platform/physical-ai-studio/issues)):
  - "Invalid vcodec 'av1_qsv' error during Dataset/Environment Initialization" (#1305)
  - "Stop a training didn't stop the validation" (#1353)
  - generic error when `/dev/ttyACM*` can't be opened (#1376)
  - "Safety Return-to-Home / Reset-to-Zero" (#1235)
  - trimming episode start and end is not yet supported (#1309)
- **OpenVINO Physical AI** has an open crash bug: "read_cameras blocks beyond timeout, leaks TimeoutError, and crashes on empty cameras" (#451, [issues](https://github.com/openvinotoolkit/physicalai/issues)). A search result says it was in preview with GA targeted for H2 2026 ([search summary of Intel material](https://www.intel.com/content/www/us/en/developer/tools/openvino-toolkit/physical-ai.html)). The page we opened did not state its status, so treat its current status as **unknown**.
- **Data requirements (LeRobot guidance, applies to SO-101):**
  - About 50 episodes as a starting point, about 10 per object position. 25 episodes "was not enough leading to a bad performance" ([SmolVLA docs](https://huggingface.co/docs/lerobot/smolvla)).
  - Keep cameras fixed and grasps consistent, and avoid adding variation too quickly ([LeRobot IL guide](https://huggingface.co/docs/lerobot/il_robots)).
  - Intel's tutorial asks for 50-100 demonstrations with varied positions ([tutorial](https://github.com/openvinotoolkit/physicalai/tree/main/examples/tutorials)).
- **Training time.** SmolVLA takes about 4 h for 20k steps on an A100 ([SmolVLA docs](https://huggingface.co/docs/lerobot/smolvla)). Intel's π0.5 recipe is 50,000 steps in BF16 on 40 GB or more ([tutorial notebook](https://github.com/openvinotoolkit/physicalai/blob/main/examples/tutorials/collect_train_deploy.ipynb)). No time is published, but it is likely longer than SmolVLA (estimate). ACT on about 60 episodes typically takes 1-2 h on one A100-class GPU (estimate; LeRobot says only "several hours" at 100k default steps, [IL guide](https://huggingface.co/docs/lerobot/il_robots)).
- **No published SO-101 latency numbers on Core Ultra** for ACT or SmolVLA, on any device (searched; none found). We will have to measure them ourselves, which also serves as a deliverable.
- **Precedent.** lablab.ai's "AI Infra Summit Hackathon" had SO-101 + Physical AI Studio + Anomalib projects (Percept2Act, One Army, EdgeVLA Lite), seen in search results only. Their pages now redirect to starfieldlabs.ai, so results are **unknown**. Search snippets suggest at least one team had no Core Ultra machine and so reported no NPU numbers.

## 4. Integration complexity for our team

| Part | Fit with our skills | Difficulty (estimate) |
|---|---|---|
| Station bring-up: calibration, camera mounting, Studio in Docker on XPU | No electronics, but Linux, USB and serial setup | Low to medium, with Intel engineers on site |
| Teleop data collection | Pure operator time, cannot be parallelized (one arm) | Medium. Quality matters more than skill. Needs one dedicated operator |
| VLA fine-tuning on cloud GPU | Strong fit (ML) | Low to medium, if the GPU is ≥40 GB and has no queue |
| OpenVINO export, INT8 (NNCF), device benchmarks | Strong fit | Medium. Known export bugs (§3) |
| Anomalib training and NPU deployment | Strong fit | Low |
| Orchestrator state machine, re-inspect logic, telemetry dashboard | Strong fit (TS/Python, agents) | Low |
| Policy robustness on shifted or cluttered bricks | Data-limited, not code-limited | **High.** This is where the 30% task-success score is won or lost |
| VLA split across iGPU and NPU | Research-grade | High. Stretch only |

Our "many parallel agents" advantage applies to export, benchmarking, orchestration, the dashboard and analysis. It does not speed up the critical path, which is demonstrations → training → rollouts.

## 5. Does it fit in about 40 hours? (timeline estimate)

| Hours | Work | Critical-path notes |
|---|---|---|
| 0-3 | Get a station. Calibrate leader and follower. Fix camera mounts and **lighting**. Check that Studio records | Any camera move after this point invalidates the data |
| 3-7 | Record about 60 pick-and-present plus place episodes across 5-6 brick positions, and about 150 good-brick inspection images. Train Anomalib (minutes) and benchmark it on CPU, GPU and NPU | Person A operates the arm. B handles Anomalib and NPU. C builds the orchestrator and telemetry |
| 7-12 | Training run 1 on cloud (SmolVLA, or ACT as a hedge in parallel if quota allows) | Waiting on the cloud. Confirm the export path *before* this run finishes |
| ~12 (Sat 12:00) | Intel hands-on session (L988). Note: it may land after we have already chosen a policy | |
| 12-18 | Export and deploy run 1 on the iGPU. First rollouts. Typical first-run failures: missed grasps and drift (estimate) | Record about 30-40 corrective or extra episodes |
| 18-24 | Training run 2 overnight. Meanwhile INT8, latency and power table, re-inspect logic | **Is the Hardware Lab open overnight? Unknown** |
| 24-32 | Deploy run 2. Measured runs (nominal, shifted, cluttered). Tune Anomalib thresholds under event lighting | Last realistic retrain decision about 26 h |
| 32-38 | Freeze. Rehearse. Record a backup video of a full 20-brick run. Prepare metrics slides | Do not retrain after about 32 h |
| 38-40 | Judging | |

**Verdict.** The core loop fits, with roughly 2 training iterations. "Exceptional" extras are possible only if run 1 works: a demonstration-count curve needs about 3 extra training runs, and the iGPU-plus-NPU VLA split is custom engineering.

**Smallest complete version:**
- one VLA (SmolVLA if the export works, otherwise whatever Intel confirms) doing pick-and-present from a marked tray region
- a drop into a fixed bowl, conditioned by prompt or replay
- PaDiM or PatchCore on the NPU
- an orchestrator logging cycle time
- an INT8 vs FP16 latency table for both models
- a measured success rate over 10-20 bricks

Everything else is optional.

## 6. Live demo: probability and failure modes

Estimated chance that a judged live run of about 10 bricks completes with at most 1-2 failures: **about 50%** (estimate). Chance that *something* autonomous and convincing runs: about 85%.

Failure modes, ranked by likelihood (estimates):
1. **Lighting change** between recording and judging (the hall lights, daylight, a neighbouring station's lamp). This breaks both the policy and the anomaly threshold. *Mitigation:* shade the station, re-collect inspection "good" images on judging morning, use adaptive thresholds.
2. **Grasp failures on positions outside the training distribution.** Judges will deliberately "shift or clutter" bricks (L1008). *Mitigation:* constrain the pick area visibly, record clutter demos in run 2, and add a re-grasp loop when the wrist camera sees an empty gripper.
3. **A camera moved or bumped**, or calibration drift, after the demos were recorded. *Mitigation:* tape the mounts, and keep a calibration-check script.
4. **Export or runtime crashes** (#1384, #451), or the NPU compile failing for a model. *Mitigation:* have a CPU or iGPU fallback path tested by about hour 20.
5. **No cloud GPU, or a queued one**, during run 2. *Mitigation:* an ACT hedge (small, could even train on the laptop iGPU via XPU; that speed is unknown) and an early overnight submission.
6. **Thermal or power drift.** Sustained iGPU and NPU load throttles the laptop. SO-101 servos may also heat up in long runs (estimate, unverified for this kit). *Mitigation:* measure it, and present it as part of the efficiency story.
7. **No station available** (25 stations; allocation unknown). This is a total blocker.

Always keep a recorded 20-brick run with its metrics overlay as backup evidence, since the pitch guide asks physical AI teams to show a reproducible real-world loop (Agent A, jury PDF p.6).

## 7. Questions for Intel and Ignite Next on site, before we commit

1. How are the 25 stations allocated, and when? Can we claim one now? Is the Hardware Lab open overnight?
2. Which policy and export path has Intel validated end to end on this exact station and software version? Specifically: does SmolVLA export work, given that #1384 is open? Does **ACT count as a "VLA policy"** for L965?
3. Cloud GPUs: what type and VRAM (≥40 GB for π0.5?), how many per team, what time limits, is there a queue? How does data get from laptop to cloud (HF Hub or a direct upload)?
4. Is the NPU path supported for any policy in this build? Studio hides the NPU. Is "Anomalib on NPU, policy on iGPU" enough for the integration criterion?
5. Which "Robotics AI Suite" components do judges expect to see (L1012)? Is the OpenVINO Physical AI runtime alone sufficient?
6. How is judging run: a live run at the station by judges, how many bricks, and do judges place the bricks? Is a recorded run accepted as backup? Are the scoring weights from L1004-L1020 final, given that the terms allow criteria announced at kick-off?
7. Is a fixed-trajectory drop into the bowls acceptable, or must every motion be policy-driven?
8. How should power and thermals be measured: is there a sanctioned tool or OS image (Linux or Windows)? Do we have root?
9. Are the laptop and cameras pre-calibrated and fixed in place, and can we add lighting or shading without "modifying the kit"?
10. Are the prizes per team, and can this project also enter another partner or tech challenge?

<!-- complete -->
