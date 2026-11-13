# Competitive intelligence: AI Glasses for Everyone, Everyday (Meta)

## Summary
- Crowding estimate: **medium-high** (estimate). Meta glasses are the only consumer-hardware challenge with a camera and AI, and "voice and vision assistant on the glasses" is already an open-source commodity (VisionClaw, Matcha, OpenGlass and others), so the generic version will be built by many teams.
- Differentiation is cheap on the supply side. Nearly every public example is a generic "ask what you see" assistant or a vertical demo. A winning entry needs a named audience, visible failure and consent handling, and a real-device demo.
- I found **no public winner list for any Junction Meta challenge, and none for any hackathon built on the Device Access Toolkit (DAT)**. Prior-art evidence is thin, so the crowding estimate rests on inference.
- The judging rubric (CHALLENGES.md:L934-937) is 25% each for creativity, technical execution, real-world value and UX/trust. Generic assistants score weakly on three of the four.

## Challenge facts used here
- Official text: CHALLENGES.md:L878-946. Prize is best overall only, glasses for each member (L941-943). Judges want a prototype plus deck, handling of "permissions, errors, performance trade-offs, connectivity, and device state changes" (L896, L900), consent and safe data (L902, L906), and a plausible pilot path (L900).
- Meta provides 10 Ray-Ban Display and 10 RBM Gen 2 units, shared (L914-915). Units per team: unknown.

## Platform context (what teams will be building on)
- DAT 1.0 has launched. It gives camera capture, voice streaming and motion tracking, extends an existing mobile app, and one integration works across display and displayless glasses. Display Web Apps use standard web APIs; WebMCP (Meta AI calls developer functions) is in developer preview. https://developers.meta.com/blog/meta-connect-recap/
- DAT exposes camera, mic and open-ear speaker, but **does not expose Meta AI or voice commands to third parties** (so "Hey Meta" custom commands are not available to our app). https://vr.org/articles/meta-ai-glasses-impact-grants-catalyst-developers-2026
- Display limits: 600x600, full redraws only, glasses hold no state, Bluetooth can drop, system can interrupt sessions. These constraints are exactly what the "handles device state changes" criterion tests. https://wearables.developer.meta.com/docs/develop/dat/display-overview/
- Ray-Ban Display third-party apps: no third-party apps live at launch per one trade source, with unknown review process and permissions. https://ppc.land/meta-opens-display-glasses-to-developers-with-two-sdk-paths/ (search snippet only; I did not open the page). Engadget also covers it: https://engadget.com/2173297/meta-is-bringing-third-party-apps-and-games-to-its-display-glasses (snippet only).
- Official sample repos exist for Android and iOS (CameraAccess, DisplayAccess, Mock Device Kit), so a working camera-streaming base is free for every team. https://github.com/facebook/meta-wearables-dat-android and https://github.com/facebook/meta-wearables-dat-ios

## Previous winners and similar hackathon entries
| Item | What it is | Relevance | URL |
|---|---|---|---|
| OpenGlass, Meta Llama 3 hackathon (Cerebral Valley, 2024) | $20 DIY open-source smart glasses that describe what the wearer sees; won first prize | Winner, but built its own glasses, not on Ray-Ban Meta. Shows judges reward a live "see and tell" demo, which is now commodity | https://gizmodo.com/cerebral-valley-hackers-build-20-open-source-smart-gla-1851476656 |
| AIFS x Meta Wearables AI AgTech Hackathon (UC Davis) | Meta AI glasses hackathon; 2nd place CropCall AI, 3rd MIRA (rural agricultural expertise via wearable AI). First place not named in what I retrieved | Closest event on Meta glasses; winners were vertical, expert-access ideas. Page fetch returned 429, so details are from a search snippet | https://aifs.ucdavis.edu/news/students-explore-the-future-of-agriculture-at-the-aifs-x-meta-wearables-ai-agtech-hackathon |
| WhatsAI Hackathon (June 2025) | Asked for accessibility solutions on Meta Ray-Ban glasses; no winners found | Shows accessibility is the standard framing | https://allhackathons.com/hackathon/whatsai-hackathon |
| Kynd (Devpost) | Assistive tool for familiarity and emotional context, adapted from meta-wearables-dat-ios; award unknown | Dementia or memory-assist is a repeated theme | https://devpost.com/software/kynd (snippet only; page returned 403) |
| LifeLens (Devpost) | Ray-Ban Meta plus a local GPU server for private monitoring; write-up notes "significant SDK limitations" | Shows SDK limits bite; award unknown | https://devpost.com/software/life-lens (snippet only; 403) |
| Predictit (Devpost) | Hands-free visual interface for prediction markets; award unknown | Novelty finance niche | https://devpost.com/software/predictit-n0r3f1 (snippet only; 403) |
| Prizes only: TreeHacks 2025 (Healthcare prize x4 Ray-Ban Meta), Cal Hacks (Ray-Ban Meta as 2nd-place prize) | Winners not named | Glasses as prize is common; do not conflate with glasses as platform | https://kelaenderkoe.pages.dev/linux-https-treehacks-2025.devpost.com |
| Junction 2025 overall winner | Team WAVELET (project description not found) | Junction's top prize did not obviously go to a wearable project; unknown what challenge it was | https://www.wikiwand.com/en/articles/Junction_(hackathon) |

Gap: Junction 2024/2025 Meta challenge results (if any) were not found. Treat as unknown.

## Open-source implementations (already exist, judges may have seen them)
- **VisionClaw**: glasses camera (~1 fps) and mic to Gemini Live, spoken answers, optional OpenClaw agent for messaging, shopping lists and web search, WebRTC POV sharing, iOS and Android, phone-camera test mode. https://raw.githubusercontent.com/Intent-Lab/VisionClaw/main/README.md
- **Matcha** (Gemini Live or OpenAI Realtime voice agent over the glasses camera): https://github.com/Intent-Lab/Matcha
- **OpenGlass (DarlingtonDeveloper)**: Ray-Ban Meta to Gemini Live and OpenClaw, MIT: https://gh.r-mj.com/DarlingtonDeveloper/OpenGlass
- **meta-lens-ai**: hands-free voice chat with ChatGPT or Gemini with live transcript: https://github.com/przemek-nowicki/meta-lens-ai
- Wrappers: Flutter (https://pub.dev/documentation/flutter_meta_wearables_dat/0.9.1/), Expo (https://libraries.io/npm/expo-meta-wearables-dat), Photon Fusion camera streaming sample (https://doc.photonengine.com/fusion/v2/industries-samples/fusion-meta-wearables-camera-streaming).
- Hack-style bridging of glasses to an agent: https://www.roadtovr.com/clawdbot-ray-ban-smart-glasses-hack/ (snippet only).
- Implication (inference): any team can have "look and ask an LLM" running in an hour from these repos. It therefore earns no points for technical execution on its own.

## Commercial products already in the space
- **Be My Eyes on Ray-Ban Meta**: hands-free "Hey Meta, Be My Eyes" volunteer sighted help; March 2026 added voice connection to trusted friend groups and corporate service centers. https://www.bemyeyes.com/news/be-my-eyes-and-meta-launch-new-accessibility-functions/ and https://bemyeyes.com/ray-ban-meta
- **Envision**: OCR and scene description via Meta glasses (price comparison in source is unverified). https://ixd.prattsi.org/2026/02/assistive-technology-ray-ban-meta-ai-glasses/
- **Meta first-party**: Meta AI for object and label recognition, navigation, real-time speech translation, calls, capture. https://about.fb.com/news/2026/06/meta-showcases-how-ai-glasses-help-people-with-disabilities/ (live captions are not mentioned there; whether Display has live captions: unknown)
- **Meta AI Glasses Impact Grants**: the funded vertical use cases are a map of what Meta already regards as "solved enough to fund": dementia assistant (OurLife), roadside mechanic copilot (Proformance-AI), hands-free language tutoring (Immerse), field-service job notes and estimates (Onsite), crop health (Agerpoint), construction trade coaching, rural broadband installer safety, accessibility-barrier documentation (United Spinal), low-vision pilots (Easterseals Houston). https://about.fb.com/ai-glasses/ and https://vr.org/articles/meta-ai-glasses-impact-grants-catalyst-developers-2026
- Display launch partners reported as Twitch, Disney, 18Birdies (one thin source, unverified): https://ppc.land/meta-opens-display-glasses-to-developers-with-two-sdk-paths/

## What most teams will reach for first (estimates)
1. Scene or object describer for blind and low-vision users (duplicates Be My Eyes, Envision, Meta AI).
2. Real-time translation or live captions for Deaf or travelers (Meta ships translation).
3. Generic "Jarvis" voice-and-vision assistant wired to Gemini or OpenAI realtime, plus an agent that sends messages (VisionClaw clone).
4. Memory assistant for dementia ("who is this person", "where are my keys"): popular, privacy-fraught face recognition, and already funded by Meta (OurLife) and seen on Devpost (Kynd).
5. Shopping, nutrition or calorie scanner, menu reader, price comparison.
6. Hands-free recipe or step-by-step tutorial on the Display (the official DisplayAccess sample is literally a tutorial list).
7. Navigation overlay and workplace or field-service copilot (grant-funded verticals).
8. Fitness or form coach, language tutor.

## Obvious ideas to avoid (unless materially differentiated)
- Plain scene description or OCR reader.
- Translation or captions without a new angle.
- Generic multimodal assistant or VisionClaw variant.
- Face-recognition "who is this" memory aid (consent problem, directly penalised by the trust criterion; Meta restrictions on face ID: unknown).
- Display "phone mirror" apps (explicitly the thing the brief says is not enough, CHALLENGES.md:L890, L906).
- Recipe, workout or tutorial step viewers with no sensing.

## Crowding estimate (estimate)
- **Interest: medium-high.** Reasons: Meta glasses are one of very few challenges with free, glamorous consumer hardware; the SDK is public with sample repos so the barrier to a working demo is low; accessibility framing is broadly appealing to student teams.
- **Capacity limits crowding:** only 20 shared devices (L914-915) for the whole hackathon. Many teams will end up on Mock Device Kit or phone-camera mode (as VisionClaw supports). Teams that demo on real glasses will stand out. Number of Junction teams: unknown (Junction 2025 had about 1,500 participants and 40 partners, https://www.aalto.fi/en/news/aalto-students-and-researchers-shape-together-how-we-age-with-ai-at-junction-hackathon-2025).
- **Quality distribution (inference):** many entries will be thin wrappers of an LLM, so the top is decided on the trust, error handling and pilot-path criteria that most skip.

## How to look different
1. **Pick a narrow, named audience with a pilot partner and a metric**, for example one profession or one disability group, not "everyone". Grant verticals show demand exists, so pick a non-grant-funded niche with a local Finnish angle.
2. **Make the first-person view essential**: use what only glasses see (hands, workspace, gaze direction) and output that only glasses allow (hands-busy, eyes-up), and show the same task failing on a phone.
3. **Make failure handling the demo**: deny the camera permission, drop Bluetooth, let the Display session be interrupted by a call, show graceful recovery. Judges are explicitly asked for this (L900), and few teams will show it.
4. **Consent and bystander privacy as a feature**: visible recording indicator, on-device or ephemeral frames, no face identification, an audit log. The brief ties 25% of the score to trust (L937).
5. **Multimodal accessible input**: Neural Band, touchpad and voice, with an equivalent path per ability. Neural Band inputs are available to Display apps (https://developers.meta.com/blog/meta-connect-recap/).
6. **Run on real hardware**, ideally a single DAT integration shown on both audio-first Gen 2 and Display.
7. **Bring evidence**: a short test with a real user from the target audience, even 2-3 people, beats any mock.

## Caveats
- Devpost pages returned 403 and the UC Davis page 429, so those entries rely on search snippets. Verify before quoting.
- The Wearables Developer Terms and acceptable-use restrictions were not reviewed here: unknown.

<!-- complete -->
