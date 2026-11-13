# The Green European Renaissance (Arduino): challenge intelligence

**Summary**
- Arduino wants a working **physical** prototype on the **Arduino UNO Q** that runs **AI on the device** to solve a local environmental or social problem in Europe (CHALLENGES.md:L790, L812).
- Judging: Technical Implementation & Edge AI 30%, Environmental & Social Impact 30%, Creativity 20%, Working Prototype 20% (CHALLENGES.md:L846-860). A cloud-LLM app with an Arduino attached would score badly on the largest technical criterion.
- Prize eligibility needs a published **Arduino Project Hub** page tagged "Junction Finland 2026" as well as the Junction submission (CHALLENGES.md:L820-828).
- Hardware work is moderate (estimate). The kit is plug-in (Qwiic Modulino sensors, a USB camera, a Linux board) and needs no soldering, but you still have to debug a physical device on site. The same project can also enter the "Best use of Arduino Uno Q" tech challenge (CHALLENGES.md:L2687-2760).

---

## 1. Database record

| Field | Value | Source |
|---|---|---|
| Challenge | The Green European Renaissance: "Make Europe Green through Edge AI using Arduino" | CHALLENGES.md:L782, L790 |
| Sponsor | Arduino | CHALLENGES.md:L786 |
| Track | Hardware Track by Arduino | CHALLENGES.md:L780 |
| Main requirement | "solutions that use Edge AI and the Arduino UNO Q to build Physical AI for local problems" that improve lives and the environment | CHALLENGES.md:L812 |
| Judging emphasis and weights | Technical Implementation & Edge AI 30% ("How well the UNO Q, sensors and on-device AI are used"); Environmental & Social Impact 30%; Creativity & Innovation 20%; Working Prototype & Demo 20% ("A functioning physical prototype") | CHALLENGES.md:L846-860 |
| Prize | 1st: a Ventuno Q unit per team member. 2nd: UNO Q 4G + Plug and Make Kits per member. 3rd: a Plug and Make Kit per member. Cash value: unknown. | CHALLENGES.md:L864-874 |
| Prize context | VENTUNO Q is Arduino's higher-end board: Qualcomm Dragonwing IQ8, 16 GB RAM, up to 40 TOPS NPU per press coverage. The price is unknown and unverified; search snippets mention about $299 introductory, but I could not open the page (HTTP 403). | search results only; electronics-lab.com returned 403 |
| Provided hardware | "complete hardware kit featuring the Arduino UNO Q and a variety of Modulino sensors", from the Arduino Hardware Lab on the 5th floor | CHALLENGES.md:L834 |
| Kit contents (from the sibling tech challenge) | UNO Q (2 GB RAM, 16 GB eMMC), USB-C cable, USB-C 8-in-1 hub, 45W USB-C power supply, Arduino USB Camera, Modulino Buzzer, Knob and Thermo | CHALLENGES.md:L2731-2738 |
| Provided software | Arduino App Lab | CHALLENGES.md:L836; https://www.arduino.cc/en/software/ |
| Mentors | Arduino mentors at the Hardware Lab and on Discord | CHALLENGES.md:L2703, L2729 |
| Submission requirements | Junction platform submission, plus a published Arduino Project Hub project with the tag "Junction Finland 2026" and "the required parts" filled in. The Project Hub's required fields are unknown. | CHALLENGES.md:L818-828; https://projecthub.arduino.cc/ (the page does not list fields) |
| Kit booking | The tech challenge points to https://2026.hackjunction.com/hardware. When opened, that page described itself as a demo with fictional data and said requests were closed. Teams book per team at the desk and leave a photo ID as deposit, and borrowers are liable for damage. Treat these details as unreliable and confirm at the desk. | CHALLENGES.md:L2713; https://2026.hackjunction.com/hardware |
| Team size, IP and open-source rules specific to this challenge | unknown | not stated in CHALLENGES.md:L780-877 |
| Number of kits available | unknown | not stated |

### The board (UNO Q), from the vendor documentation
Source: https://docs.arduino.cc/hardware/uno-q/
- Dual processor. The MPU is a Qualcomm Dragonwing QRB2210 (4x Cortex-A53 at 2.0 GHz, Adreno GPU) running Debian Linux. The MCU is an STM32U585 (Cortex-M33) running Arduino sketches on Zephyr. The two talk over an RPC library ("Arduino Bridge").
- The page lists no NPU, so inference runs on the CPU or GPU (inference from the page).
- Wi-Fi 5 and BT 5.1, USB-C, and a Qwiic connector for Modulinos. USB cameras and microphones connect through a USB-C dongle.
- App Lab is the recommended tool for both processors. It combines Python apps, sketches and AI models, and you build apps by stacking "Bricks" (https://docs.arduino.cc/software/app-lab/). The App Lab docs also list "Custom AI Models" and "Agent Mode" pages, which I did not read.

### On-device AI options (what "Edge AI" can concretely mean here)
- **Edge Impulse models.** The App Lab path is: train in Edge Impulse Studio with UNO Q as the target, deploy, and select the model in a Brick. The documented types are object detection (FOMO), image classification, sound recognition, keyword spotting, and motion with anomaly detection (https://docs.edgeimpulse.com/hardware/deployments/run-arduino-app-lab). You need Arduino and Edge Impulse accounts (same source).
- **Built-in Bricks**, such as Video Object Detection and keyword spotting. The full brick list is unknown because the reference page rendered empty for me.
- **A local VLM is possible but slow.** SmolVLM-500M under llama.cpp on a 2 GB UNO Q took about 22 s per inference and used most of the RAM and CPU (https://www.hackster.io/sologithu/running-local-vlms-on-arduino-uno-q-with-the-app-lab-70e8e3). Estimate: usable only as an occasional, triggered step, not in real time.

## 2. What the sponsor is actually trying to encourage

My reading, which is an inference:
1. **Adoption of the UNO Q and App Lab as an edge-AI platform.** The criteria name the UNO Q directly (L848). Publishing on Project Hub is a condition of any prize (L820), which gives Arduino a stream of public showcase content tagged to the event. Running the same requirement in the tech challenge (L2717) shows this is a deliberate marketing goal.
2. **Local, sovereign, offline AI as a European value.** The brief frames US and Asian megacorps against Europe and asks for solutions "not dependant on governments or private companies" (L802-806). Cloud LLM calls cut against the story Arduino is telling. A project that runs fully offline on the board fits the sponsor's narrative best.
3. **Real physical sensing and actuation ("Physical AI").** The brief uses the words "Physical AI" (L800, L812), and 20% of the score is for "A functioning physical prototype" (L860). A screen-only demo misses the point.
4. **Using both halves of the board.** This is evidence from a past Arduino judge, not from this challenge's text. Arduino's Andrea Richetta praised the RS DesignSpark UNO Q winner, Smart Water Guardian AI. That project split real-time sensing on the MCU from AI inference on Linux over the Bridge, worked fully local, and came with thorough documentation (https://www.industrialtechnology.co.uk/rs-designspark-announces-arduino-uno-q-community-challenge-winner). The Arduino judges at Junction are unknown, and the jury PDF does not mention Arduino.

## 3. Explicit requirements (quoted)

- "We're looking for solutions that use Edge AI and the Arduino UNO Q to build Physical AI for local problems: solutions that improve people's lives while creating a greener, better environment to live and work in." (CHALLENGES.md:L812)
- "To be eligible for prizes, you must publish your project on the Arduino Project Hub in addition to submitting it on the Junction platform, where peer review and judging take place." (CHALLENGES.md:L820)
- "Select the tag Junction Finland 2026" / "Fill in the required parts" (CHALLENGES.md:L826-828)
- Judging: "How well the UNO Q, sensors and on-device AI are used" (L848); "How much the solution improves the environment and people's lives" (L852); "Originality of the idea and approach" (L856); "A functioning physical prototype" (L860).
- Example directions, which are suggestions rather than requirements: "boosting local flora and fauna to saving energy, supporting elderly people's independence, reducing industrial impact, tackling climate change, improving energy efficiency, cutting pollution, or making cities more livable and human" (L816).

## 4. What a mediocre submission looks like (estimate)

- A stock App Lab example, such as object detection on the USB camera, relabelled with a green story ("it detects litter"). It has no custom model, no actuation, and no measured impact.
- The UNO Q used as a thin client that sends sensor data to a cloud LLM. This loses the Edge AI criterion and contradicts the sovereignty pitch.
- A thermometer dashboard with a threshold alert, where the "AI" is cosmetic.
- An impact claim with no numbers, such as "saves energy", with no baseline, kWh estimate or deployment scenario.
- A demo that only works on a laptop screen, or that breaks on stage because of Wi-Fi or camera issues.
- Skipping the Project Hub page, or submitting it late, which makes the team ineligible.

## 5. What an exceptional submission would demonstrate (estimate)

- **A custom on-device model** trained during the event on data the team collected on site, for example in Edge Impulse. Good candidates are an audio classifier (wildlife or bird calls, machinery anomaly, leaks) or a vision model. Show accuracy and latency figures measured on the board.
- **Both processors used deliberately.** The MCU does real-time sensing and actuation, such as Modulino Pixels or Buzzer and relays. Linux runs inference and a local web UI, and the Bridge connects them. Optionally, a small local language or vision model handles occasional explanations, with no cloud dependency.
- **A closed loop.** The device senses something, decides, and then acts physically or produces a concrete local action, such as switching off a load, alerting a caretaker, or logging biodiversity counts.
- **Quantified impact** for a named European locale and user, for example "a Helsinki apartment block saves X kWh/year". Give a plausible path to deploying many cheap, offline units.
- **A demo that works live** in the room, with a fallback recording, and a polished Project Hub page with a schematic, code and build steps.
- **Room for the team's strengths** (estimate). ML training and evaluation, plus a strong web UI served from the board. Optionally, a phone app as companion over local Wi-Fi or BLE, as long as the AI stays on the device.

## 6. Constraints that could disqualify a project

- **No Project Hub publication means no prize eligibility** (CHALLENGES.md:L820). Whether Project Hub moderation delays publication is unknown, so publish early.
- **Not using the UNO Q.** The brief requires it (L812), and the criteria score it (L848). Other boards are almost certainly ineligible in spirit; whether they are formally ineligible is unknown.
- **No functioning physical prototype.** This is 20% of the score (L860) and not a stated hard disqualifier. A software-only entry would effectively forfeit it.
- **Healthcare overlap.** "Supporting elderly people's independence" is a listed direction (L816). The team has ruled healthcare out of scope, so avoid health-framed ideas. This is a team constraint, not a rule.
- **Hardware loan terms.** Per the hardware page, the team must return borrowed kit and is liable for damage. That page called itself a demo, so verify at the desk (https://2026.hackjunction.com/hardware).
- **Kit availability.** The number of kits is unknown. If they run out, the team cannot compete, so get one early (inference).
- General Junction rules on originality and pre-built code are not stated in this section (unknown).

## 7. Physical hardware work required

**Level: provided-kit, moderate (estimate).**
- No soldering or PCB work is implied. Modulinos plug in over Qwiic/I2C, and the camera and microphone connect over USB (https://docs.arduino.cc/hardware/uno-q/; CHALLENGES.md:L2731-2738).
- Most of the work is Linux, Python and ML: App Lab, Edge Impulse, and a web UI. This matches the team's skills.
- Real physical tasks remain: setting up and networking the board, I2C sensor bring-up, camera and microphone placement, powering the device, and building a physical demo enclosure or scene, such as a model room, plant pot or bird feeder. Debugging under time pressure on a 2 GB RAM board is the main risk.
- Arduino mentors are on site (L2703, L2729), which lowers the embedded-debugging risk for a team without electronics experience.
- Actuators beyond the kit (relays, motors) would add wiring risk and are optional.

## Related opportunity
The same build can enter the **Best use of Arduino Uno Q** tech challenge, which is open to all teams. Its weights are Arduino hardware & Edge AI 50%, prototype 30% and creativity 20%, and it has the same Project Hub requirement (CHALLENGES.md:L2699, L2709, L2717). Whether one project may win both the main challenge and this tech challenge is unknown.

## Sources opened
- /Users/ciprian/code/Junction 26/docs/JUNCTION_2026_CHALLENGES.md L780-877, L2687-2760
- https://docs.arduino.cc/hardware/uno-q/
- https://www.arduino.cc/en/software/
- https://docs.arduino.cc/software/app-lab/
- https://docs.edgeimpulse.com/hardware/deployments/run-arduino-app-lab
- https://www.hackster.io/sologithu/running-local-vlms-on-arduino-uno-q-with-the-app-lab-70e8e3
- https://www.industrialtechnology.co.uk/rs-designspark-announces-arduino-uno-q-community-challenge-winner
- https://2026.hackjunction.com/hardware
- https://projecthub.arduino.cc/
- Jury PDF (docs/00-Jury-profiles-and-pitch-guide.pdf): no Arduino-specific content found.

<!-- complete -->
