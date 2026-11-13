# Competitive intelligence: The Green European Renaissance (Arduino UNO Q)

**Summary**
- This is a Hardware Track challenge sponsored by Arduino. Judging weights are Technical/Edge AI 30%, Impact 30%, Creativity 20%, Working Prototype 20% (CHALLENGES.md:L846-860).
- The UNO Q has been in public circulation since late 2025, and several 2026 contests already ran on it (Hackster, RS DesignSpark, embedded world NA). The default ideas (water quality, plant care, air quality, bird or sound classification) are already well covered on Project Hub, Hackster and GitHub, and the Hackster and RS contests rewarded some of them.
- Expected crowding (estimate): moderate among Junction teams. The topic is broad and friendly, but hardware kits are limited and the team must publish on Project Hub. Many software-first teams will skip it. Expect the teams that do pick it to cluster on plant, air, water and waste ideas.
- The route to standing out is a sense-decide-act loop with measured on-board results (accuracy, latency) for a named European locale, using both the MCU and the Linux side. A simple monitor-and-dashboard build will not stand out.
- Unknown: no Junction-specific Arduino prior-year winners were found, and I did not find evidence that Arduino sponsored Junction before. This is marked unknown below.

## 1. Previous winners and prizes in the same solution space

| Contest / project | What it was | Relevance | URL |
|---|---|---|---|
| Hackster "Invent the Future" (Arduino + Qualcomm, UNO Q). Best in Show: Edge-AI Spectrophotometer ($5,000) | Low-cost spectrophotometer, edge AI detects contamination in real time | Measurement device with AI classification; shows judges reward a novel sensor instrument | https://www.electronicdesign.com/directory/boards-systems/boards/press-release/55414924/avnet-hackster-announces-winners-of-the-invent-the-future-competition |
| Same contest, Best Social Impact: Smart Water Guardian AI ($3,000) | Water-quality monitor, on-device anomaly detection | Direct analog of the "obvious" environmental idea | same URL |
| Same contest: Curie (robotics), HaloSense V1 (haptic headband), RCT IRL (IMU roller-coaster rating), Smart Coop 2.0 (poultry care) | Other category winners | Shows breadth: gimmicky and playful ideas also won | same URL |
| RS DesignSpark "Prove it" UNO Q Community Challenge, winner Smart Water Guardian AI ($5,000) | Same project; pH and turbidity sensors, STM32 MCU does real-time sensing/actuation, Linux MPU runs AI; learns normal baseline and flags deviations; dashboard, Android app, LED, buzzer | Judges praised splitting tasks across the two processors and relevance to a real problem | https://www.hackster.io/david-kochoni/smart-water-guardian-ai-a194f1 ; https://www.industrialtechnology.co.uk/rs-designspark-announces-arduino-uno-q-community-challenge-winner ; https://www.ipesearch.co.uk/RS-DesignSpark-Prove-it-winner |
| embedded world North America Hackathon 2026 (Arduino/Qualcomm) | Student teams on UNO Q; examples: local sound classification, "ZOT ROT or NOT" camera waste-sorting conveyor | Waste sorting and sound classification are already seen | https://www.wevolver.com/article/edge-ai-in-action (secondary summary; I did not open the original winner pages, so details are unverified) |
| HackTurin (Italy), team "EGG" on UNO Q with 8MP camera, "smarter, safer city streets" | Reported 1st place | Source is a LinkedIn profile only; treat as unverified | https://it.linkedin.com/in/leonardopollo |
| MIT Reality Hack 2026 (Qualcomm) | Page says UNO Q projects featured; I could not extract specifics | Unknown details | https://www.qualcomm.com/developer/blog/2026/04/mit-hack-recap-2026 |

Junction-specific history: searches found no evidence of earlier Arduino challenges at Junction or Devpost entries for one. Status: unknown. Junction 2025 main prize winner is reported inconsistently by sources (WAVELET vs Nice-ify) and neither is hardware-related; not relevant here (https://en.wikipedia.org/wiki/Junction_(hackathon)).

## 2. Similar submissions and open-source / public projects on UNO Q

- AI Plant Guardian: soil moisture, BME280, USB camera, pump, display, Telegram; App Lab; GPL-3.0 on GitHub; tagged "Greener Planet", featured on Project Hub (5,277 views). https://projecthub.arduino.cc/ingeimaks/ai-plant-guardian-the-smart-plant-that-waters-itself-sees-with-ai-and-talks-to-you-on-telegram-f5f73c
- Water-quality clones on Hackster: Jal Rakshak, WaterLens, Smart River Guardian, Thelima, AquaWatch (the last targets rural India with LoRaWAN). Listed in search results; I did not open each. https://www.hackster.io/Varun_Sontakke/jal-rakshak-4d585f , https://www.hackster.io/thomasvikstrom/waterlens-c2075c , https://www.hackster.io/danuw/smart-river-guardian-48cadc
- Talk to Your Arduino: on-device AI agent controlling Modulinos in App Lab. https://projecthub.arduino.cc/hardik_chadda/talk-to-your-arduino-build-an-on-device-ai-agent-in-arduino-app-lab-0265ba
- Edge Impulse Project Hub tutorials: rock-paper-scissors, OCR, LiDAR room mapper, Edge Link IoT gateway. https://projecthub.arduino.cc/marc-edgeimpulse/play-rock-paper-scissors-agains-the-arduino-uno-q-5b8436 ; https://projecthub.arduino.cc/mukesh_sankhla/edge-link-arduino-uno-q-based-edge-ai-iot-gateway-d50214
- Other: EchoGlow voice-operated night light (https://hackaday.io/project/205386-arduino-uno-q-echoglow), PCB inspection series (https://www.rs-online.com/designspark/automating-pcb-inspection-with-arduino-uno-q-part-4-creating-the-application), Elf Detector YOLOv5 series (https://foundries.io/insights/blog/elf-detector-real-time-object-detection), AI lab assistant (https://www.hackster.io/kutluhan-aktar/ai-driven-web-based-ancillary-lab-assistant-uno-q-gemini-b6d539).
- Arduino's own App Lab examples: Fan Vibration Monitoring (anomaly detection), Object Hunting, Theremin Simulator, LED Matrix Painter, and others. Anomaly detection and object detection are shipped templates, so a team using them unchanged looks like the template. https://blog.arduino.cc/2025/12/22/introducing-the-latest-arduino-app-lab-updates-and-examples/
- Tooling: App Lab has full Edge Impulse Studio integration for training and deploying custom models, which makes the "collect data, train, deploy" flow easy for everyone. https://blog.arduino.cc/2026/03/04/train-and-deploy-your-own-ai-models-in-arduino-app-lab-now-fully-integrated-with-edge-impulse/ ; https://docs.edgeimpulse.com/hardware/boards/arduino-uno-q
- Project Hub lists an "Environmental station" tutorial among trending UNO Q projects (contents not verified). https://projecthub.arduino.cc/?q=wokwi
- Bioacoustics prior art on other hardware: BirdNET-Pi on Raspberry Pi and the UCL acoupi framework (BirdNET, BatDetect2). https://arxiv.org/html/2501.17841v1

## 3. Commercial products and mature open-source tools that already solve parts of this

I could not verify specific commercial products in this session (my search returned papers, not product pages), so only items with a source are listed. Haikubox, PurpleAir, Smart Citizen and Plantix are known names to me but I did not open pages for them; treat as unverified.
- BirdNET-Pi and acoupi (open-source bird monitoring on Pi-class devices): https://arxiv.org/html/2501.17841v1
- Multi-sensor microcontroller environmental nodes with on-device AI exist as research prototypes (ETH Zurich group): see https://arxiv.org/pdf/2602.17751 (summary only; not opened in full).

Implication (estimate): a plain "sensor plus classifier plus alert" for air, water, birds or plants is a solved or tutorial-level problem, so the novelty must come from the closed loop, the locale and the data, not the sensing.

## 4. Obvious ideas judges will see repeatedly (avoid)

1. Water-quality anomaly monitor (pH, turbidity, TDS). Already won two UNO Q contests.
2. Smart plant or garden care: moisture sensor, camera, pump, chatbot.
3. Indoor air-quality monitor with an LED indicator and "AI" threshold alerts.
4. Bird or wildlife sound classifier with an Edge Impulse audio model.
5. Waste sorting with a camera and object detection.
6. Energy-saving occupancy detection (camera or PIR turns lights off).
7. Smart-city traffic or pedestrian counting with a USB camera and YOLO.
8. Fan, motor or machine vibration anomaly detection (this is a shipped App Lab example).
9. Dashboard plus Telegram or LLM chatbot wrapper over sensor data.
10. Elderly fall detection (also out of scope for our team: healthcare framing).

## 5. How crowded will this be? (estimate)

Estimate: medium crowding. Reasoning:
- Pull factors: friendly theme, a free kit, a sponsor that explicitly wants LEDs and gadgets (CHALLENGES.md:L794), and a prize of a Ventuno Q per member (L866). The theme is broad enough that many teams can map an idea to it.
- Push factors: a physical-hardware requirement (L860), a mandatory second submission on Project Hub (L820-828), and a limited kit supply (quantity unknown). Many Junction teams are software-first.
- Quality of competition: since the board launched, there is a visible set of competent public builds (water, plant, waste, vibration), so the bar for "new" is higher than at a first-time hardware event. Other teams cannot easily copy hardware work in 40 hours, so the winning submissions will probably be the polished ones with a live demo.
- Junction-specific count of teams choosing it: unknown.

## 6. What a submission needs to look different

1. Pick a specific European locale and problem with real numbers (for example a named Finnish or Nordic issue such as winter road salt, urban stormwater, district heating loss, or invasive species in a named lake) and quantify the saving or benefit. Impact is 30% of the score (L850), and most projects stay generic. This framing is my inference.
2. Close the loop: the device senses, decides on-device and acts (valve, vent, light, motor), rather than only reporting. Few UNO Q builds actuate.
3. Show real model work: train on site data you collect at the venue or nearby (Edge Impulse or your own), and report measured accuracy and latency on the board. The tutorial path is open to everyone, so measured results separate teams.
4. Use both processors deliberately: MCU for real-time sensing and actuation, Linux side for inference, bridged cleanly. A past judge-praised project did exactly this (https://www.ipesearch.co.uk/RS-DesignSpark-Prove-it-winner).
5. Make it sovereign and offline: demonstrate it running with the network unplugged, which matches the sponsor's narrative (L802-806).
6. Combine modalities (for example sound plus vibration plus thermal) so the model does something a threshold cannot.
7. Make the demo physical and visible to a judge in 30 seconds, and publish a polished Project Hub page with the exact tag "Junction Finland 2026" (L826). Skipping this makes the project ineligible (L820).
8. Avoid pure software or LLM chat wrappers; the sponsor scores a functioning physical prototype (L860).

## Gaps and caveats
- No Junction or Devpost Arduino history found (unknown).
- Winner details for embedded world NA, HackTurin and MIT Reality Hack are from secondary or social sources.
- Commercial product comparison is incomplete (see section 3).
- Number of kits available and whether they can run out: unknown.

<!-- complete -->
