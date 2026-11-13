# Opportunity discovery: The Green European Renaissance (Arduino UNO Q)

**Summary**
- The gap is not sensing, which is solved at tutorial level. It is turning cheap offline sensing into trusted, actionable output that a named European user or public dataset actually consumes, with a closed loop and measured on-board model results.
- Underused sponsor capability: App Lab now ships **local LLM and VLM Bricks for the UNO Q** (default `Qwen3.5-0.8B-Q4_0` and a multimodal variant), plus a visual-anomaly-detection Brick. Almost no public UNO Q project combines a fast custom classifier with an on-board language model in a cascade. Several Bricks (ASR, object tracking, multimodal audio) are **VENTUNO Q only**, so do not plan on them.
- Five opportunity areas follow. The strongest are (1) citizen-science-grade observation nodes that feed existing Finnish national datasets, (2) a closed-loop "Down a degree" heating nudge, and (3) the tiny-model-plus-on-board-VLM cascade as the technical differentiator under either of them.
- Honest stacks: **Best use of Arduino Uno Q** (same build), **Best Use of Gemma** (a Gemma model running on the board via the llama.cpp runner), and **Codex**/**Entire** (dev workflow). Cloud-centric tech challenges cut against the sponsor's offline story.
- Estimates: differentiation 6/10, demo 8/10, jury fit 6/10.

---

## 0. Constraints that shape every opportunity

| Fact | Source |
|---|---|
| The listed kit is UNO Q (2 GB), USB-C hub, 45W PSU, Arduino USB Camera, Modulino Buzzer, Knob, Thermo. The main brief says only "a variety of Modulino sensors". | CHALLENGES.md:L2733-2738, L834 |
| **No microphone and no actuator (relay, motor) are listed.** Audio ideas need a USB mic that we bring ourselves (USB webcam mics are "generally supported" per the ASR Brick README). Whether the Arduino USB Camera has a mic is unknown. | https://github.com/arduino/app-bricks-py (src/arduino/app_bricks/asr/README.md) |
| Output devices that are guaranteed: Buzzer, the onboard 8x13 LED matrix driven by the STM32 MCU, and a web UI served from the board. | https://forum.arduino.cc/t/uno-q-8x13-led-matrix/1445471 ; https://foundries.io/insights/blog/elf-detector-led-matrix |
| Other Modulinos exist (Movement IMU, Distance ToF, Pixels, Buttons), but whether the Junction lab stocks them is **unknown**. Ask at the desk first thing. | Mouser listings (search results, descriptions inconsistent): https://www.mouser.com/c/n/embedded-solutions/?b=Arduino |
| The UNO Q has no NPU listed, and the docs recommend the 4 GB variant for SBC use. Our kit is 2 GB. | https://docs.arduino.cc/hardware/uno-q/ ; CHALLENGES.md:L2733 |
| Judging: Technical & Edge AI 30, Impact 30, Creativity 20, Working prototype 20. | CHALLENGES.md:L846-860 |

### App Lab Bricks: what is actually available on UNO Q (from the open-source Brick repo)
Listed from `gh api repos/arduino/app-bricks-py/contents/src/arduino/app_bricks` (https://github.com/arduino/app-bricks-py):
- **Local text LLM** (`arduino:llm`): on `unoq` the default model is `llamacpp:Qwen3.5-0.8B-Q4_0`. The README says it supports "Qwen and Gemma" and has streaming, memory and tool use. A separate `mcp_client` Brick hands MCP tools to the LLM Brick.
- **Local VLM** (`arduino:vlm`): on `unoq` the default is `llamacpp:Qwen3.5-0.8B-Q4_0-multimodal`; `gemma-4-E2B ... -multimodal` is cited as a llama.cpp option. Latency on the 2 GB board is unknown. A prior SmolVLM-500M test took about 22 s per inference (https://www.hackster.io/sologithu/running-local-vlms-on-arduino-uno-q-with-the-app-lab-70e8e3).
- **Visual anomaly detection**: on `unoq` the default model is `concrete-crack-anomaly-detection`, and it accepts custom Edge Impulse models.
- Also present: `audio_classification`, `keyword_spotting`, `image_classification`, `object_detection`, `video_objectdetection`, `motion_detection`, `vibration_anomaly_detection`, `gesture_recognition`, `pose_estimation`, `ocr`, `camera_code_detection`, `dbstorage_tsstore` (InfluxDB), `dbstorage_sqlstore`, `web_ui`, `streamlit_ui`, `mqtt`, `telegram_bot`, `cloud_llm`, `weather_forecast` (open-meteo, online), `air_quality_monitoring` (AQICN, online).
- **VENTUNO Q only** (per each `brick_config.yaml`): `asr` (Whisper), `video_object_tracking` (line crossing, distinct counts), and `multimodal_llm` (audio+image; the README says it "requires NPU acceleration, like ventunoq"). **Do not design around these.** The 1st prize is a VENTUNO Q (CHALLENGES.md:L866), so a "next step on VENTUNO" slide is natural.

Implication (estimate): the shipped Brick set makes "classifier plus dashboard" trivial for every team. Differentiation has to come from (a) custom data and measured models, (b) chaining a fast model with the on-board language model, and (c) a real consumer of the output.

---

## 1. Citizen-science-grade observation nodes for Finnish national datasets

**Gap.** Finland already runs large public observation systems that depend on volunteers, and their data quality is uneven. In summer 2025 SYKE's official algae monitoring covered 373 points, while citizens reported from over 800 locations and logged 5,709 observations in Järvi-meriwiki. Blue-green algae appeared in 46% of citizen observations against 14% of official ones (https://www.sttinfo.fi/tiedote/71381251/... via search; https://syke.fi/en/services/monitoring-and-inventories/cyanobacterial-reviews). That gap is consistent with reporting bias, since people report when they see something; this is my inference, not SYKE's statement. The Finnish invasive-species dataset is likewise "made and reported by the public" through vieraslajit.fi (https://laji.fi/en/theme/dataset-metadata/HR.3791). The Spanish slug is regulated as nationally invasive, landowners are obliged to combat it, and young individuals are easily confused with the native dusky arion (https://laji.fi/en/taxon/MX.52801/invasive). In short, the data is volunteer-driven, sporadic, biased toward positives, and hard to validate.

**Opportunity direction.** A cheap, offline, fixed node (shore, allotment garden, bird feeder, compost) that produces **scheduled, calibrated, photo-backed observations including "absence" reports**, in the format the existing portal accepts. SYKE explicitly says absence observations matter (same SYKE source). The model is trained on open-licensed laji.fi images plus data collected on site. The on-board VLM is used only to write the human-readable note and to flag "uncertain, needs a human".

**Why the sponsor would care (inference).** It is the brief's "boosting local flora and fauna" (CHALLENGES.md:L816) and "local solutions ... not dependant on governments or private companies" (L806) made literal. The data flows to European public science, not a megacorp cloud.

**How it reads to the overall jury (estimate).** Specific user (SYKE / Finnish Biodiversity Info Facility volunteers), honest metric (agreement with expert labels, false-positive rate against the 46% vs 14% skew), and a clear path forward (an existing intake channel). Weakness: November means no algae or slugs outdoors, so the demo uses props (jars, printed photos, figurines). That is acceptable at a table but less visceral.

**Hardware load (estimate).** Low: camera and Thermo only; enclosure optional.

## 2. Closed-loop "Down a degree" heating nudge for Nordic buildings

**Gap.** Finnish energy campaigns rest on a rule of thumb that 1 °C lower indoor temperature cuts heating energy by about 5% (secondary sources tied to Motiva's "Astetta alemmas" campaign: https://lumo.fi/en/lumo-living/lumo-homes-energy-saving-challenge-no-1-make-at-least-this-smart-energy-decision ; https://www.sitra.fi/en/cases/want-know-secret-deep-sleep/ ; the Motiva primary figure was not opened). Campaigns rely on people's attention. Commercial smart thermostats are cloud-dependent (estimate, not verified per product). Occupancy-based energy saving is on Agent B's saturated list, so the gap is narrower: **detecting waste signatures, not occupancy**. Examples: a window opened while the radiator runs (a temperature and humidity drop signature on Thermo), an empty room overheated, or a common space (sauna, laundry or bike room in a housing company) heated for nobody. Then close the loop.

**Opportunity direction.** A time-series anomaly model (Thermo plus optional camera presence, with frames never leaving the board) that classifies waste events and acts. Without a relay in the kit, "acting" means a buzzer and LED-matrix nudge plus a measured kWh estimate. A servo on a radiator thermostat valve would be the real loop, but that adds hardware risk and needs parts we are not given (unknown availability).

**Why the sponsor would care.** "Saving energy ... improving energy efficiency" (CHALLENGES.md:L816). It uses the MCU (real-time sensing and LED matrix) and the MPU (model plus web UI) as Arduino judges have praised (https://www.industrialtechnology.co.uk/rs-designspark-announces-arduino-uno-q-community-challenge-winner).

**How it reads to the overall jury (estimate).** Very legible: breathe on the sensor or open the venue window, and the board reacts in seconds. The impact maths (1 °C ≈ 5%) is easy to state. The risk is that it reads as "another thermostat" unless the waste-signature model and measured detection latency are front and centre.

**Hardware load (estimate).** Low, or medium if we add a servo actuator.

## 3. Cascaded edge AI: fast custom model plus an on-board small VLM or LLM (cross-cutting technical angle)

**Gap.** The shipped App Lab examples and most public UNO Q projects run one model and print a label (competitive.md section 2). The UNO Q now has a local LLM and VLM Brick (Qwen3.5-0.8B on `unoq`, see section 0), but a VLM call costs seconds to tens of seconds (22 s in the SmolVLM test cited above). Nobody we found publishes a **cascade with measured numbers**: a tiny Edge Impulse model (FOMO or audio) running continuously, which triggers the on-board VLM only on hard or uncertain cases. The VLM then produces a structured record or a Finnish- or Swedish-language explanation fully offline. This was impractical on a hobby board before 2025-26 small multimodal models and the App Lab runners (inference from the Brick configs).

**Opportunity direction.** Use this as the technical spine under area 1 or 2. Report always-on model latency and accuracy, VLM trigger rate, VLM latency, end-to-end energy (estimate from board power), and how many cases the cascade escalates against a single-model baseline. This plays directly to the team's ML-evaluation strength.

**Why the sponsor would care.** It showcases the newest App Lab capability (local LLM/VLM Bricks) and the "Physical AI" narrative (CHALLENGES.md:L800, L812). It also hands Arduino a reusable Project Hub pattern.

**How it reads to the overall jury.** It earns "distinctive insight and technical depth" and "honest measured evidence" (00-rules-and-jury.md rubric) if the numbers are real. On its own it is not a problem statement, so it must sit under a concrete user.

**Risk.** Memory on a 2 GB board running an Edge Impulse model, the llama.cpp VLM and a web UI at the same time is unknown. Test on Friday night before committing.

## 4. Winter-city surface and livability mapping from bikes and strollers (mobile sensing)

**Gap (estimate, sources thin).** "Making cities more livable" is a listed direction (CHALLENGES.md:L816). Helsinki-specific winter problems such as icy or slushy cycle lanes, potholes after freeze-thaw cycles, and spring street dust from studded tyres are reported to cities by hand. I did not open a source quantifying report volume, so treat it as unknown. Pothole detection with phones is a known hackathon idea (estimate). The gap is a **multi-modal edge classifier (IMU vibration plus camera) on a vehicle that already moves through the city**, with no images leaving the device (GDPR-friendly for people in frame), producing geo-tagged condition events.

**Opportunity direction.** Mount the UNO Q with a Modulino Movement (if stocked; unknown) and the camera on a bike or cargo stroller. A phone companion supplies GPS and receives events over local Wi-Fi or BLE. This matches the team's mobile and wearables skills.

**Why the sponsor would care.** It combines sensors (vibration plus vision), which a threshold cannot do (competitive.md section 6.6). Note that the `vibration_anomaly_detection` Brick is a shipped example, so it must be clearly extended.

**How it reads to the overall jury.** It is a fun table demo (roll the rig over a bumpy mat). Impact numbers are weaker than heating, and power and mounting make it the most hardware-fragile area.

**Hardware load (estimate).** Medium: mounting, battery or power bank, IMU availability.

## 5. Point-of-disposal biowaste contamination feedback for housing companies (higher saturation risk)

**Gap.** Biowaste was nearly 40% of household mixed waste in the Helsinki area (HSY survey cited in https://julkaisu.hsy.fi/pdf/kotitalouksien-sekajatteen-koostumus-paakaupunkiseudulla-vuonna-2024.pdf, via search summary). A thesis on HSY biowaste pre-treatment rejects reports about 80% plastic in rejected material, mostly food wraps and bags (https://theseus.fi/handle/10024/756108; student work, treat with caution). HSY forbids ordinary plastic bags in biowaste (https://www.hsy.fi/en/waste-and-recycling/sorting/biowaste/). Camera waste sorting is saturated (competitive.md section 4.5). The narrower gap is **a bin-lid device that measures contamination rate over time for one housing company and nudges at the moment of disposal**, rather than sorting items.

**Why the sponsor would care / jury read.** Clear local impact and a named payer (taloyhtiö, the housing company). But it will look like waste sorting to a skimming judge. Pick it only if the measurement and longitudinal angle is the hero.

---

## Stackable tech challenges (honest assessment)

| Tech challenge | Fit | Why |
|---|---|---|
| Best use of Arduino Uno Q | **Strong** | Same build, same Project Hub requirement; weights favour hardware & Edge AI 50% (CHALLENGES.md:L2709, L2717). Whether one project can win both is unknown. |
| Best Use of Gemma | **Good** | The `llm`/`vlm` Bricks run Gemma via llama.cpp on the board (Brick README; `gemma-4-E2B ... -multimodal` named). The requirement is "use Gemma open models (hosted or self-run)" (_tech-challenges.md). Whether a 2 GB UNO Q runs Gemma E2B acceptably is unknown; test first. |
| Best Use of Codex / Entire | Good, low effort | Dev-workflow challenges, independent of architecture (_tech-challenges.md). |
| Verda / Modal | Possible | Only honest if we actually train or distill the on-device model on their GPUs. On-device inference stays local. Medium effort. |
| Tiger Data / MongoDB / Aiven | Weak | Only if a fleet aggregator exists. It adds a cloud dependency the sponsor's narrative argues against (CHALLENGES.md:L802-806). |
| Gemini API, Nemotron, ElevenLabs, Oxylabs, Context.dev | Poor | Cloud calls in the core loop undermine the Edge AI criterion (L848). |
| Atech | No | Different hardware platform. |

---

## Estimates (my judgement, not sourced facts)

- **Differentiation potential: 6/10.** The ground is crowded (water, plant, waste, vibration), and the shipped Bricks lower everyone's floor. Real room remains in (a) feeding an existing national dataset with absence and validated reports, and (b) a measured fast-model-to-on-board-VLM cascade, which no public UNO Q project we found reports with numbers.
- **Demo potential: 8/10.** Physical, offline, reacts in seconds, readable at a table in under a minute. It loses points for November seasonality (no algae or slugs) and fragile 2 GB memory headroom when chaining models.
- **Jury fit: 6/10.** It scores well on live demo and legibility and can score well on measured evidence. It is weaker on "credible path forward" unless tied to a real intake (SYKE / vieraslajit.fi, housing companies). Hardware projects can also look like hobby builds next to software startups. Partner-prize fit is higher than overall fit (estimate: about 7/10 for the Arduino award if the cascade and impact numbers land).

## Unknowns to resolve on site
- Which Modulinos beyond Buzzer, Knob and Thermo the lab stocks; whether a USB mic or relay is available.
- Memory and latency of the `vlm` Brick on a 2 GB UNO Q alongside an Edge Impulse model.
- Number of kits, and whether one project can win both the main Arduino challenge and the Arduino tech challenge.

## Sources opened or queried
- /Users/ciprian/code/Junction 26/docs/JUNCTION_2026_CHALLENGES.md L780-877, L2687-2760
- Agent A: docs/challenge-selection/01-challenge-intelligence/green-european-renaissance.md; Agent B: docs/challenge-selection/02-research/green-european-renaissance/competitive.md
- https://github.com/arduino/app-bricks-py (Brick list, READMEs and brick_config.yaml for llm, vlm, asr, tts, multimodal_llm, mcp_client, visual_anomaly_detection, video_object_tracking, air_quality_monitoring, weather_forecast, dbstorage_tsstore)
- https://docs.arduino.cc/hardware/uno-q/ ; https://docs.arduino.cc/software/app-lab/ (navigation only)
- Search results (not all pages opened): SYKE algae monitoring, laji.fi Spanish slug and invasive dataset, HSY biowaste, Motiva "Down a degree", UNO Q LED matrix

<!-- complete -->
