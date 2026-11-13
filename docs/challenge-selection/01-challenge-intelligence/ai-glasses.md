# AI Glasses for Everyone, Everyday (Meta): challenge intelligence

**Summary**
- Meta asks for "the best everyday use case using AI glasses from Meta", one that shows how a **first-person field of view enables new or better interactions in everyday scenarios** and goes "beyond simply mirroring a phone screen" (CHALLENGES.md:L886, L890, L894). The deliverables are a **functional prototype and a deck** (CHALLENGES.md:L896).
- Judging has four equal parts at 25% each: creativity and use case, technical execution, real-world value and feasibility, and UX (input, accessibility and trust) (CHALLENGES.md:L934-937). The brief stresses robustness (permissions, errors, performance, connectivity, device state), inclusive design, consent and safe data practices, and a plausible pilot or adoption path (CHALLENGES.md:L900-906).
- The prize is a pair of Ray-Ban Meta glasses for each member of the winning team. Only one winner is listed (CHALLENGES.md:L941-943). The best teams may also be invited to a Meta wearable-AI forum on 18 Nov 2026 (CHALLENGES.md:L908).
- **Hardware load is low.** Meta lends the glasses (10 Ray-Ban Display, 10 "RBM Gen 2"), and the work is phone-app or web-app software (CHALLENGES.md:L914-915). There is no electronics work. The real risks are sharing scarce devices, Bluetooth bandwidth limits on the camera stream, and the fact that **Web Apps cannot use the camera or microphone**, so any "first-person view" idea needs a native iOS or Android app built on the Device Access Toolkit (see section 7).

---

## 1. Database record

| Field | Value | Source |
|---|---|---|
| Challenge | AI Glasses for Everyone, Everyday | CHALLENGES.md:L878 |
| Original page | https://hackjunction.app/participate/45/challenges/342 (not opened; the transcription is the source) | CHALLENGES.md:L880 |
| Sponsor | Meta | CHALLENGES.md:L882 |
| Track | It appears under the "Hardware Track by Arduino" heading in the transcription (L780 is the heading; the next track starts at L1282). Whether Meta's challenge is officially part of that track or the transcription just grouped it there is **unknown**. | CHALLENGES.md:L780, L878 |
| Main requirement | "Build the best everyday use case using AI glasses from Meta, showing how a first-person field of view enables new or better interactions in everyday scenarios." | CHALLENGES.md:L894 |
| Judging emphasis and weights | Creativity and use case 25%. Technical execution 25%. Real-world value and feasibility 25%. User experience (input, accessibility and trust) 25%. | CHALLENGES.md:L934-937 |
| Prize | "Best overall: Each member of the winning team will receive a pair of Ray-Ban Meta glasses." Only one place is listed, and the model or generation is **unknown**. | CHALLENGES.md:L941-943 |
| Non-prize upside | Invitation to Meta's AI forum on Wed 18 Nov 2026 ("may be invited") | CHALLENGES.md:L908 |
| Provided hardware | 10 Meta Ray-Ban Display and 10 "RBM Gen 2" (estimate: Ray-Ban Meta Gen 2, which has no display), shared, "for use during the hackathon", plus charging and hygiene materials | CHALLENGES.md:L912-916 |
| Device allocation rules | **unknown**: the text does not say how 20 shared devices are split across teams, or whether they can be taken away from the booth | CHALLENGES.md:L912 |
| Provided support | Developer support at the Meta booth, with Amanda Le as challenge mentor and point of contact. Four Web Apps engineers, one iOS DAT engineer, and one Android DAT person (Product Marketing). | CHALLENGES.md:L917, L921-926 |
| Provided APIs | Not named in the challenge text beyond "web apps and Device Access Toolkit mobile integrations" | CHALLENGES.md:L898 |
| Provided data | None stated (**unknown**) | CHALLENGES.md:L910-917 |
| Submission requirements | "functional prototype and deck"; "clearly articulate the problem and intended audience" | CHALLENGES.md:L896 |
| Other submission format (video, repo, form) | **unknown** from the challenge text | none |
| Allowed platforms | Display and audio-first experiences count "on equal footing", as do web apps and DAT mobile integrations | CHALLENGES.md:L898 |
| Team size / eligibility / combination with other challenges | **unknown** from this challenge's text | none |

### Notes on the platform (web, opened)

- **Two build paths, both from Meta.** (1) The **Wearables Device Access Toolkit (DAT)**, a native iOS (Swift) or Android (Kotlin) SDK that extends a phone app to the glasses: camera, audio and, on Ray-Ban Display, display UI components (text, images, lists, buttons, video). (2) **Web Apps**: HTML, CSS and JS that run on Ray-Ban Display only, deployed by URL ([Meta blog, 14 May 2026](https://developers.meta.com/blog/build-for-display-glasses/)). At Connect 2026 DAT reached 1.0 after a year in preview. "A single integration works on both display and displayless glasses", and the SDK supports camera capture, voice streaming and motion tracking. Publishing to glasses surfaces is "coming soon" ([Connect recap](https://developers.meta.com/blog/meta-connect-recap/)).
- **Web Apps limits.** They run "only on Meta Ray-Ban Display". They need a public HTTPS URL and are installed by QR code or `navigator.install()`. Developer Mode is enabled in the Meta AI app (glasses software v125 or later, Meta AI app v272 or later) ([Web Apps overview](https://wearables.developer.meta.com/docs/develop/webapps)). The build guide says Web Apps **"do not yet support" camera, microphone or notifications**. Other limits: a fixed 600x600 viewport, input as arrow-key and Enter events from the touchpad or Neural Band, optional pointer drag, TTS through `speechSynthesis` (one English voice), phone GPS accurate to 5-50 m, 5 MB of localStorage, and offline use through Service Workers. Sensor permission "can be revoked mid-session" without notice ([Web Apps build guide](https://wearables.developer.meta.com/docs/develop/webapps/build/)). The Connect recap also mentions WebMCP (preview), which lets Meta AI call functions a web app exposes ([Connect recap](https://developers.meta.com/blog/meta-connect-recap/)).
- **DAT camera limits.** The stream resolutions are 720x1280, 504x896 and 360x640, at 2, 7, 15, 24 or 30 fps. The stream is "constrained by the Bluetooth Classic connection", and under low bandwidth it automatically drops one resolution step and then frame rate ("never below 15 fps") ([streaming docs](https://wearables.developer.meta.com/docs/develop/dat/streaming/)).
- **DAT lifecycle.** The app registers through the Meta AI app, and camera permission is requested via the Meta AI app. In Developer Mode, `APPLICATION_ID`/`CLIENT_TOKEN` are set to 0. Sessions run through STARTED and STOPPED states, and a stopped session cannot be restarted. **Mock Device Kit** simulates the glasses camera with the phone camera ([Android integration](https://wearables.developer.meta.com/docs/develop/dat/build-integration-android/)). The supported OS versions are iOS 17.2+ and Android 10+ ([DAT docs](https://wearables.developer.meta.com/docs/develop/)). Standalone photo capture and synchronized PCM audio are marked experimental. The SDK is on Maven Central as `com.meta.wearable` ([GitHub: meta-wearables-dat-android](https://github.com/facebook/meta-wearables-dat-android)).
- **AI tooling.** Meta ships Claude Code and Codex plugins that connect a Wearables MCP server with a `search_dat_docs` tool ([DAT docs](https://wearables.developer.meta.com/docs/develop/)). This helps a team that runs many agents in parallel.

## 2. What the sponsor is actually trying to encourage

My reading, which is an inference: Meta wants **evidence of third-party apps that justify the glasses form factor**, built on its newly opened developer platforms, with **accessibility and trust built in**. In concrete terms, Meta wants:

1. **Use cases where the camera's point of view matters.** It asks for interactions that are "new or better" because of the first-person view (L886, L894), and for value "beyond simply mirroring a phone screen" and "beyond basic mirroring" (L890, L906). A phone app pushed to the lens will not count.
2. **Adoption of both developer paths.** Display and audio-first, and web apps and DAT, are explicitly treated as equals (L898). The mentor roster has four Web Apps engineers and two DAT people (L921-926). Both platforms were opened in 2026 ([blog](https://developers.meta.com/blog/build-for-display-glasses/), [Connect recap](https://developers.meta.com/blog/meta-connect-recap/)), so a hackathon is a showcase and a source of feedback for them.
3. **Inclusive design, consent and privacy as product features.** "Inclusive ... for people with all abilities" appears in L890, L896 and L902. One full 25% criterion is "input, accessibility and trust" (L937), and consent and safe data practices must be "part of the demo" (L906). Inference: camera-on-face products carry public privacy worries, so Meta wants demos that show bystander and user consent being handled.
4. **Products that could actually ship.** The brief asks for a "focused, plausible path to adoption or a pilot" (L900, L906). Meta's AI Glasses Impact Grants likewise fund groups "proposing new, high-impact applications using our Device Access Toolkit" and cite accessibility, agriculture, sports and education uses ([Meta newsroom](https://about.fb.com/news/2026/01/ai-glasses-impact-grants-wearable-technology-for-good/)).
5. **Engineering maturity on a constrained device.** The brief names permissions, errors, performance trade-offs, connectivity and device state changes (L900). Each maps onto something real in the SDK: permission goes through the Meta AI app, streams degrade over Bluetooth, and session state can change (section 1 notes).

## 3. Explicit requirements (quoted)

- "Demonstrate how a first-person field of view enables new or better interactions in everyday scenarios." (L886)
- "Build the best everyday use case using AI glasses from Meta, showing how a first-person field of view enables new or better interactions in everyday scenarios." (L894)
- "Best entries will clearly articulate the problem and intended audience, and deliver a functional prototype and deck to materialize their concepts. Creativity, technical execution, real-world impact, and inclusive interaction design for people with all abilities will be key criteria." (L896)
- "Both display and audio-first experiences will be considered on equal footing, as will web apps and Device Access Toolkit mobile integrations." (L898)
- "Show an original, relevant use case with a clear wearable benefit and a focused, plausible path to adoption or a pilot, backed by a functional prototype that handles permissions, errors, performance trade-offs, connectivity, and device state changes." (L900)
- "Interactions should be intuitive and inclusive for people with all abilities, with appropriate consent and safe data practices within the demo's scope." (L902)
- "We are interested in focused everyday problems where wearables unlock hands-free, in-the-moment value beyond basic mirroring. Show a plausible path to adoption or a pilot, and make accessibility, appropriate consent, and safe data practices part of the demo." (L906)
- Judging: "Creativity and use case(25%)", "Technical execution(25%)", "Real-world value and feasibility(25%)", "User experience: input, accessibility and trust(25%)" (L934-937)

## 4. What a mediocre submission looks like (estimate)

- A generic "look at something, ask an LLM, hear the answer" assistant: a camera frame goes to a vision LLM and the reply is read out by TTS. This is the obvious first idea, and (estimate) it overlaps with what the built-in Meta AI assistant already offers, so it scores low on creativity and "clear wearable benefit".
- A phone or web dashboard copied onto the 600x600 display, with menus and scrolling. The brief rules this out explicitly (L890, L906).
- A demo that only works on Mock Device Kit or a laptop webcam, or that breaks when Bluetooth drops, permission is denied or the session stops. That fails the robustness list in L900.
- Accessibility added at the end ("it also has TTS"), no consent or bystander story, and frames uploaded to the cloud with no data-handling explanation. That loses most of the 25% UX/trust criterion.
- A broad "AI life assistant" with no named user or pilot partner, which fails "focused" and "plausible path to adoption" (L900).

## 5. What an exceptional submission would demonstrate (estimate)

- **One sharp everyday problem for a named audience** where the hands-free first-person view is clearly necessary. Examples: someone whose hands are busy (cooking, repair, carrying a child), or someone with low vision, hearing loss or a cognitive or memory impairment. The deck should give a concrete pilot (for example a Finnish disability organisation, a city service or a retailer) and a metric.
- **Real glasses in the live demo**, ideally on both a displayless RBM Gen 2 (audio-first) and a Ray-Ban Display (visual), from one DAT integration, which Meta says is possible ([Connect recap](https://developers.meta.com/blog/meta-connect-recap/)). Alternatively, a DAT app for camera perception paired with a Web App for the display UI (estimate: the two can coexist, but whether they can share state on the device is unknown).
- **Visible engineering for the edge cases**, shown on stage: a permission-denied flow, a Bluetooth drop that falls back to a lower resolution or an audio-only mode, reconnecting after a session STOPPED, and a latency budget (for example on-phone pre-filtering so that only salient frames are sent to the LLM). This matches L900 point by point.
- **Multimodal input that works for many abilities**: voice, Neural Band gestures and touchpad, with no single required modality. The demo should state which disability scenarios were tested.
- **Trust by design**: an explicit capture indicator or consent step, on-device or ephemeral processing, face and bystander blurring before upload, and a one-line data-retention policy in the deck.
- Some evidence of real use: a quick test with a member of the target audience at the venue, or a short video.

## 6. Constraints that could disqualify a project or sink its score

- **Not using Meta AI glasses at all.** The challenge is "using AI glasses from Meta" (L894). A generic phone app would very likely be out of scope (inference).
- **No functional prototype or no deck.** Both are named deliverables (L896).
- **Platform mismatch.** Choosing Web Apps for a camera-based idea will fail, because Web Apps "do not yet support" camera or microphone ([build guide](https://wearables.developer.meta.com/docs/develop/webapps/build/)). Web Apps also run only on Ray-Ban Display ([overview](https://wearables.developer.meta.com/docs/develop/webapps)).
- **Device access risk.** Twenty shared devices are spread across all participating teams (L914-915), and the allocation rules are unknown. Without dependable glasses time, the demo may fall back to Mock Device Kit, which would hurt technical execution.
- **Meta developer terms.** DAT use requires agreeing to the Meta Wearables Developer Terms and Acceptable Use Policy ([GitHub](https://github.com/facebook/meta-wearables-dat-android)). Their contents were not reviewed here, so any restrictions (for example on facial recognition) are **unknown**. Check them before choosing a people-identifying use case.
- **Consent and privacy failures**, such as recording bystanders with no consent story. This is not stated as a disqualifier, but it is a scored requirement ("must ... be part of the demo", L906).
- Formal eligibility rules (team size, rules on combining with other challenges) are **unknown** from the challenge text.

## 7. Physical hardware work required

**Low.** This is a consumer-device challenge, not an electronics one.
- There is no soldering, wiring, firmware flashing or robotics. The glasses are off-the-shelf consumer products lent by Meta (L912-916), and development happens in a phone app (Swift or Kotlin) or a web app.
- The hardware-related work is pairing glasses with the Meta AI app, enabling Developer Mode, and managing firmware and app versions (v125/v272 or later for Web Apps) ([overview](https://wearables.developer.meta.com/docs/develop/webapps)). It also includes handling Bluetooth stream quality ([streaming](https://wearables.developer.meta.com/docs/develop/dat/streaming/)) and keeping devices charged.
- Most development can run on Mock Device Kit with the phone camera, so glasses time can be saved for integration testing and the demo ([Android integration](https://wearables.developer.meta.com/docs/develop/dat/build-integration-android/)). Desktop emulation does not represent drag input accurately for Web Apps ([build guide](https://wearables.developer.meta.com/docs/develop/webapps/build/)).
- Team fit (estimate): strong. The work is mobile SDK integration, streaming audio and video, LLM agents and on-device ML, which are all areas the team is confident in. The bottleneck is physical access to shared devices, not hardware skill. Ask at the Meta booth (Amanda Le, L917) early about how devices are allocated.

<!-- complete -->
