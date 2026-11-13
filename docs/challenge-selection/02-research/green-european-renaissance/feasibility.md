# Green European Renaissance (Arduino UNO Q): technical feasibility

**Summary**
- **Buildable: yes, if we keep the scope narrow.** The sponsor's own stack (App Lab Bricks, Edge Impulse custom models, Python on Linux plus a sketch on the MCU over the Bridge) covers almost everything a strong entry needs. The software is Python and C++ with no electronics design. The physical work is plugging Qwiic Modulinos and a USB camera into a borrowed board. Estimate: 7/10 that a strong core ships in 40 h.
- **The biggest risks are logistics and tooling, not the code.** The hardware request form is already closed, and kits have a loan time limit "in minutes" that we have not seen. App Lab needs internet for updates, containers and models, and the setup wizard does not support captive-portal Wi-Fi. App Lab is young (0.12.0, released 2026-11-05) and forum users report update loops and stuck states.
- **Smallest complete version:** a USB camera or Modulino sensor feeding one custom Edge Impulse model on the Linux side, a decision in Python, and the MCU acting through the Bridge (LED matrix and buzzer). A local web UI shows the result and the measured latency. Anything involving the on-board LLM or VLM is a stretch goal. A small VLM has been reported at about 22 s per inference.
- **Live demo: estimate 7/10.** Failure modes are lighting or domain shift for vision models, Wi-Fi or mDNS discovery at the venue, and Bridge deadlocks or timeouts. A frozen, offline, pre-flashed app with a recorded backup video moves this to about 8/10.
- **Ask on site before committing:** how long the loan is and whether we can keep the board overnight, which Modulinos are actually in stock, whether a USB mic is available, the board image and App Lab version, a venue network without a captive portal, and whether Project Hub publishing needs moderation before the deadline.

---

## 1. What the challenge requires (short)
- Use the Arduino UNO Q with on-device ("Edge") AI to solve a local European environmental or social problem (CHALLENGES.md:L812).
- Judging: Technical Implementation & Edge AI 30%, Environmental & Social Impact 30%, Creativity 20%, Working Prototype & Demo 20%, where the last means "a functioning physical prototype" (CHALLENGES.md:L846-860).
- To be eligible for prizes the project must be published on Arduino Project Hub with the tag "Junction Finland 2026", in addition to the Junction submission (CHALLENGES.md:L820-828).
- Kit: UNO Q (2 GB RAM, 16 GB eMMC), USB-C cable, 8-in-1 USB-C hub, 45 W PSU, Arduino USB Camera, Modulino Buzzer, Knob and Thermo (CHALLENGES.md:L2733-2738). The main brief says "a variety of Modulino sensors" from the 5th-floor Hardware Lab (CHALLENGES.md:L834). We bring a laptop with App Lab (CHALLENGES.md:L2742).
- The same build can also enter the "Best use of Arduino Uno Q" tech challenge (50% Arduino hardware and Edge AI, 30% prototype and demo, 20% creativity) (CHALLENGES.md:L2687-2760).

## 2. Platform facts that drive the architecture

| Fact | Source |
|---|---|
| The MPU is a Qualcomm QRB2210 (4x Cortex-A53 at 2.0 GHz, Adreno GPU, Debian). The MCU is an STM32U585 (Cortex-M33 at 160 MHz, 2 MB flash, 786 kB SRAM, Zephyr). No NPU is listed. There is a Qwiic connector for Modulinos, Wi-Fi 5 and BT 5.1, and a USB camera or mic via the hub. | https://docs.arduino.cc/hardware/uno-q/ |
| The docs recommend the 4 GB variant for standalone (SBC) use. Our kit is 2 GB, so **develop from a laptop, not in SBC mode.** | https://docs.arduino.cc/hardware/uno-q/ ; CHALLENGES.md:L2733 |
| An App Lab app = a Python program on Linux plus an Arduino sketch on the MCU, joined by the Bridge (RPC). | https://github.com/arduino/docs-content (content/software/app-lab/6.bridge/2.bridge-api/bridge-api.md) |
| Bridge: from Python, `Bridge.call(name, *args, timeout=10)` raises `TimeoutError`. On the MCU, `Bridge.call()` blocks until Linux replies. **Calling `Bridge.call()` or `Monitor.print()` inside a `provide()` handler deadlocks; use `provide_safe()`.** | same bridge-api.md, lines 50-238 |
| Measured Bridge round trip: about 7 ms for small payloads, about 50 ms for 90 floats, about 91 ms for a 787-character string. Batch payloads into arrays. | https://forum.arduino.cc/t/evaluated-uno-q-router-bridge-latency-with-max31855/1423998 |
| AI Bricks on UNO Q: object detection (default YoloX-nano), image classification, visual anomaly detection, audio classification, keyword spotting, motion and vibration anomaly detection, gesture and pose, OCR, local text LLM (default `llamacpp:Qwen3.5-0.8B-Q4_0`), local VLM (default `llamacpp:Qwen3.5-0.8B-Q4_0-multimodal`). | https://github.com/arduino/app-bricks-py (src/arduino/app_bricks/*/brick_config.yaml) |
| Vision, audio and sensor Bricks accept **custom Edge Impulse models** (`.eim`, in `/home/arduino/.arduino-bricks/ei-models`). | object_detection, audio_classification, vibration_anomaly_detection `brick_config.yaml` in the repo above |
| UNO Q language models are about 1B parameters or fewer (Gemma 3 1B, Qwen 3.5 0.8B). Larger models, TTS and Whisper are VENTUNO Q only. | https://github.com/arduino/docs-content (content/software/app-lab/8.integrations/3.models) |
| Arduino's own custom-model tutorial measured an SSD object detector at **370 ms** per inference and a FOMO 96x96 model at **3 ms** (Edge Impulse estimate). | https://github.com/arduino/docs-content (content/software/app-lab/8.integrations/2.ai-models), around lines 210-237 |
| A local VLM on UNO Q took about 22 s per inference (SmolVLM-500M), as cited by the opportunity report. Not re-verified here. | https://www.hackster.io/sologithu/running-local-vlms-on-arduino-uno-q-with-the-app-lab-70e8e3 (via opportunity.md) |
| The Edge Impulse Linux runner runs on the MPU. The EI UNO Q page gives no latency figures. | https://docs.edgeimpulse.com/hardware/boards/arduino-uno-q |
| Modulino library classes: Buttons, Buzzer, Color, Distance, Joystick, Knob, LatchRelay, Light, Movement, OptoRelay, Pixels, Pressure, Thermo, Vibro, Motors, LED Matrix. Which of these the lab stocks is **unknown**. | https://github.com/arduino-libraries/Modulino (src/Modulino.h) |

**Note on "AI on the MCU".** Every Brick runs inference on the Linux MPU. Running a model on the STM32 needs a separate Edge Impulse Arduino library export to the sketch, and we found no App Lab-documented path for it on UNO Q. Whether this export works on the Zephyr core is unknown. Do not depend on it; at most treat it as a stretch goal.

## 3. Credible architecture (recommended)

```
[Modulino sensors via Qwiic] --I2C--> [STM32 sketch: sample, debounce, drive LED matrix, buzzer, relay]
                                              |  Bridge (batched arrays, provide_safe / notify)
[USB camera or mic via hub] ------------> [Linux Python app]
                                              - Brick: custom Edge Impulse model (vision/audio/sensor)
                                              - decision logic, SQLite/TS store Brick for history
                                              - optional: local LLM Brick for a short natural-language summary (async, not on the hot path)
                                              - web_ui Brick on :7000 for the judge-facing dashboard
```
- **Sense, decide, act loop on one board, with no cloud on the hot path.** This matches the brief's "not dependant on governments or private companies" framing (CHALLENGES.md:L806) and the 30% Edge AI criterion.
- **Show measured numbers in the UI:** per-inference latency, on-board accuracy on a held-out set, and power draw if we can get a USB meter. This is cheap to build and scores well on Technical Implementation (estimate).
- Use one custom-trained model. That alone is a strong signal. The pretrained Bricks (YoloX COCO) look like tutorials.

## 4. Critical dependencies and how we get them

| Dependency | How we get it | Risk |
|---|---|---|
| UNO Q kit | Borrow from the Arduino Hardware Lab (5th floor) or booth (CHALLENGES.md:L834, L2729). The hardware page says one request per team, requests are **currently closed**, the request does not reserve stock, each item has a **loan time limit in minutes** (values not shown), and photo ID is the deposit. https://2026.hackjunction.com/hardware | **High.** If the loan is short, or we can't keep the board overnight, development stalls. Go to the desk first thing. |
| Extra Modulinos (Movement, Distance, Light, Relay, Pixels) | Ask at the lab. Only Buzzer, Knob and Thermo are listed (CHALLENGES.md:L2738). | Medium. Design the idea around the camera plus Thermo and Knob so that extras are a bonus. |
| Microphone (for audio ideas) | Not in the kit list. A USB mic or webcam mic through the hub (https://docs.arduino.cc/hardware/uno-q/). Bring our own. | Medium. Whether the Arduino USB Camera has a mic is unknown. |
| Arduino account + Edge Impulse account | Free. The same Arduino account logs into Edge Impulse (docs-content ai-models tutorial, line 37). The EI Developer plan: 60 min compute per job, 3 private projects, unlimited public projects, 3 collaborators per project. https://edgeimpulse.com/pricing | Low. Training jobs are well under 60 min for small models. |
| App Lab on the laptop | https://www.arduino.cc/en/software/#app-lab-section. Version 0.12.0 was released 2026-11-05 and auto-updates (docs-content release-0-12). | Medium (see failure modes). Install and update before the event starts. |
| Internet on the board | Needed for board updates, Brick containers (ghcr.io), pip, and model downloads (Hugging Face, Edge Impulse). Captive portals are **not supported**. WPA2-Enterprise needs `nmcli`. mDNS may be blocked on guest Wi-Fi. (docs-content 2.configure/3.network-configuration) | **High** at a hackathon venue. Plan on a phone hotspot (WPA2 Personal) and a USB (ADB) connection. |
| Project Hub publication | https://projecthub.arduino.cc/ → + NEW PROJECT → tag "Junction Finland 2026" (CHALLENGES.md:L822-828). App Lab can publish drafts to Project Hub (release-0-12 notes). Whether moderation delays publication is **unknown**. | Medium. Required for prize eligibility. Draft by hour 30, not hour 39. |

No paid APIs are needed. The `air_quality_monitoring` and `weather_forecast` Bricks call online APIs (AQICN needs a free token). Avoid them on the critical path, because they undercut the offline story and add network risk.

## 5. Documented limits, latency and reliability problems
- **App Lab maturity.** A reviewer called it "a bit beta". It has a basic editor, only listed libraries are easy to add, and the app often needs a restart after the PC sleeps. https://www.elektormagazine.com/labs/arduino-uno-q-weather-dashboard
- **Update failures.** Arduino's official advice after a fresh image flash: if the update check fails, disconnect, close and reopen, and try at least twice. Outdated boards need reflashing with the Flasher CLI. https://support.arduino.cc/hc/en-us/articles/24359619949084-If-Arduino-App-Lab-shows-an-Error-checking-for-updates-message ; https://support.arduino.cc/hc/en-us/articles/23170731875740-If-your-Arduino-UNO-Q-board-software-is-out-of-date. Forum threads report update loops and stuck apps (https://forum.arduino.cc/t/applab-update-crashes/1418983, https://forum.arduino.cc/t/arduino-app-labs-stucked-after-running/1439044). The bricks repo shipped a llama.cpp release today (2026-11-13, `gh api repos/arduino/app-bricks-py/releases`), so the software is changing during the event.
- **Bridge.** About 7 ms per small call. Deadlocks if a `provide()` handler calls back. Default 10 s Python timeout. Too slow for per-second UI updates when misused (Elektor). Some "method not available" errors on Zephyr core 0.52.0 were fixed in 0.53.1 (forum thread above).
- **Actuators during inference.** One user's servos jittered while running object detection, after sending commands via stdout instead of `Bridge.call` (https://forum.arduino.cc/t/arduino-app-lab-servo-movement-fails-during-object-detection-on-uno-q/1431740). Fix not confirmed. Drive actuators from the MCU, triggered through the Bridge.
- **Memory.** The board has 2 GB. Running a VLM or LLM alongside a vision Brick and a web UI concurrently is unmeasured. Our estimate is that it will contend for RAM and CPU. The EI board page warns that VS Code Remote with extensions can cause memory issues (https://docs.edgeimpulse.com/hardware/boards/arduino-uno-q).
- **Inference latency.** Small Edge Impulse models take milliseconds to a few hundred ms (370 ms SSD, 3 ms FOMO per the Arduino tutorial). The local VLM is in the tens of seconds (reported). Local LLM tokens per second on UNO Q are **unknown**. We could not search further because the session search budget was exhausted, so measure on day 1.

## 6. Integration complexity for this team
- **Easy for us:** Python app logic, the web UI, data pipelines, Edge Impulse training and evaluation (our ML strength), and dataset curation with augmentation. App Lab 0.12 also has an Agent Mode with Claude Code and OpenCode (release-0-12 notes), which fits our agent-heavy workflow.
- **Moderate:** Arduino C++ sketch on Zephyr with Modulino I2C and the LED matrix. These are well-trodden library calls. Bridge RPC patterns need care (deadlock rule).
- **Hard and avoid:** on-MCU TinyML, custom carriers or MIPI cameras, soldering, relays switching mains, and anything that needs a 4 GB board.
- Physical hardware work, estimate: low. It is plug-in Qwiic modules plus a camera on a stand, and perhaps a cardboard or 3D-printed enclosure for the "physical prototype" score. No circuit design.

## 7. Does the core fit in 40 h? Smallest complete version
**Estimate: yes.** Indicative plan:

| Hours | Work |
|---|---|
| 0-3 | Get the kit, update board and App Lab over a hotspot, run a built-in example end to end (camera Brick plus a Modulino plus the LED matrix). **Go/no-go gate.** |
| 3-12 | Collect data on site (camera or sensor), train an Edge Impulse model, deploy to a Brick. In parallel: sketch with Modulino I/O and the Bridge contract, web UI skeleton. |
| 12-24 | Close the loop (detect → decide → MCU acts). Add logging to the SQL/TS store. Measure latency and accuracy on the board. |
| 24-32 | Stretch: async LLM summary (only if latency is acceptable), enclosure, impact numbers for a named Finnish locale. |
| 32-40 | Freeze. Rehearse the demo 10+ times. Record a backup video. Publish to Project Hub. Junction submission. |

**Smallest complete version (MVP that still scores in every criterion):** one custom on-board model, one sensor input, one physical actuation (LED matrix or buzzer), a local dashboard with measured latency, and a quantified impact claim. No cloud.

## 8. Live demo: likelihood and failure modes
Estimate: **7/10** as planned, **about 8/10** with mitigations.

| Failure | Likelihood (est.) | Mitigation |
|---|---|---|
| Vision model fails under judging-room lighting or background (domain shift) | High | Train with data captured in the demo location, use augmentation, fix the camera on a stand with a controlled background, and keep a printed or physical test prop. |
| Board not discovered or no network at the venue (mDNS blocked, captive portal) | Medium-High | Connect over USB (ADB). Make the app fully offline once deployed. Bring our own hotspot. Pre-download every model and container. |
| App Lab or board auto-updates or breaks mid-event | Medium | Update once on hour 0, then stop updating. Keep a known-good App release installed on the board. |
| Bridge deadlock or timeout freezes the loop | Medium | Use `provide_safe`, `notify` for fire-and-forget calls, batched payloads, and a watchdog restart. |
| RAM exhaustion when the LLM or VLM runs alongside vision | Medium (if used) | Keep the LLM off the hot path, or drop it. Measure on day 1. |
| Board must be returned before judging, or the loan window is too short | Unknown | Clarify at the desk (section 9). |
| Project Hub page not published or not tagged → **not eligible for prizes** | Low if planned | Publish the draft early. Screenshot the tag. |
| Power: the hub plus camera plus peripherals need the 45 W PSU | Low | Use the kit PSU. Don't run the board off a laptop port in the demo. |

## 9. Questions for Arduino or Junction staff on site (before committing)
1. What is the kit loan time limit? Can we keep the UNO Q overnight and through judging? Can we take it with us during peer review? (The hardware page shows limits only "in minutes", and requests are closed.)
2. Which Modulinos are available beyond Buzzer, Knob and Thermo (Movement, Distance, Light, Pixels, relays)? In what quantity? Is a USB mic available?
3. What board image and App Lab version are the kits on? Should we update them, and is there a venue network the board can join (WPA2 Personal, no captive portal, mDNS allowed)?
4. Do the judges expect AI running on the STM32 MCU, or is MPU inference through Bricks fine for "Technical Implementation & Edge AI"?
5. Does a Project Hub post need moderation or approval before it counts? What is the deadline relative to the Junction submission? Must it be public by judging?
6. Is the use of the local LLM or VLM Brick valued, or does a fast custom Edge Impulse model with measured numbers score better? Is any part of the entry allowed to use the cloud?
7. Do the mentors know local LLM tokens per second and object detection FPS on the 2 GB UNO Q? (Not found in the docs.)

## 10. Unknowns (not found in sources)
- Kit quantity, loan time and overnight policy.
- Local LLM tokens per second and the real FPS of the YoloX Brick on the 2 GB UNO Q.
- Whether Edge Impulse's MCU (Arduino library) export works on the UNO Q's Zephyr core inside App Lab.
- Project Hub moderation time.
- Whether the Arduino USB Camera includes a microphone.

Note: The session's web-search budget ran out partway through this research, so the latency figures above come from pages we had already opened. They were not checked against further sources.

<!-- complete -->
