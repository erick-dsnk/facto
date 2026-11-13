# AI Glasses for Everyone, Everyday (Meta): technical feasibility (Agent D)

**Summary**
- **Buildable: yes, if the scope is narrow (estimate 7/10).** A credible entry is a native iOS or Android phone app built on Meta's Wearables Device Access Toolkit (DAT). The glasses' camera and mic stream to the phone, the phone calls a cloud vision LLM, and answers come back as speech on the glasses (RBM Gen 2) or as simple cards on the lens (Ray-Ban Display). It is mobile SDK work plus LLM glue, both of which we know well. There is no electronics work. Meta ships a Claude Code plugin and a docs MCP server for DAT.
- **Live-demo reliability is the weak point (estimate 6/10).** None of the risks are about code. They are: getting and keeping one of the 20 shared glasses; the fact that glasses pair to **one Meta account at a time**; Developer Mode allowing **only one third-party app registered at a time**; firmware and app version gates; per-user server-side capability gating (`CAPABILITY_DENIED`); Bluetooth Classic bandwidth in a crowded hall; and several beta features that fail silently (Speech stops after about 1 minute, and on Display, capture combined with display is buggy).
- **Smallest complete version:** an audio-first DAT app for one named audience. The wearer triggers it, the app takes a frame, a vision LLM answers, and the answer plays as speech. On screen it visibly handles permission denial, a session pause or stop, disconnects and low battery or heat, and it has a consent and ephemeral-data story. A Ray-Ban Display card view is a stretch goal. Do not build camera or mic ideas as a Web App, because Web Apps cannot use the camera or mic.
- **Before committing, at the Meta booth (Amanda Le):** how devices are allocated and how long we can keep them; whether the glasses come pre-paired to Meta accounts and phones; firmware and Meta AI app versions; whether DAT camera, Display and beta capabilities are enabled for those accounts in Finland; and whether iOS or Android has better on-site support.

---

## 1. What the challenge needs technically

From the official text:
- The entry must use AI glasses from Meta and show first-person value "beyond simply mirroring a phone screen" (CHALLENGES.md:L886, L890, L894).
- Deliverables are a "functional prototype and deck" (CHALLENGES.md:L896).
- Display and audio-first count equally, as do Web Apps and DAT mobile integrations (CHALLENGES.md:L898).
- The prototype "handles permissions, errors, performance trade-offs, connectivity, and device state changes" (CHALLENGES.md:L900). This is a technical requirement, not a nice-to-have.
- Consent and safe data practices must be "part of the demo" (CHALLENGES.md:L902, L906).
- Judging is 25% each for creativity, technical execution, real-world value and UX/accessibility/trust (CHALLENGES.md:L934-937).
- Meta provides 10 Ray-Ban Display, 10 RBM Gen 2, chargers and hygiene kits, and booth support (CHALLENGES.md:L912-917). The mentors are four Web Apps engineers, one iOS DAT engineer and one Android DAT person from product marketing (CHALLENGES.md:L921-926).

## 2. Choosing the platform (this decision is effectively forced)

| | DAT (native iOS/Android) | Web Apps (on-glasses browser) |
|---|---|---|
| Camera / mic | Yes. "Only the Device Access Toolkit can use the glasses' camera or capture microphone audio" ([llms.txt](https://wearables.developer.meta.com/llms.txt)) | No: camera, mic and notifications are "not yet supported" ([Web Apps build](https://wearables.developer.meta.com/docs/develop/webapps/build/)) |
| Devices | Ray-Ban Meta Gen 1/Gen 2, Display, Oakley and others ([setup](https://wearables.developer.meta.com/docs/develop/dat/getting-started-toolkit/)) | Ray-Ban Display only ([Web Apps overview](https://wearables.developer.meta.com/docs/develop/webapps)) |
| Display | Component API: FlexBox, Text, Image, Button, Icon, Video; 600x600; each send replaces the whole view ([display overview](https://wearables.developer.meta.com/docs/develop/dat/display-overview/)) | HTML 600x600, arrow-key/Enter input ([Web Apps build](https://wearables.developer.meta.com/docs/develop/webapps/build/)) |
| Voice input | HFP mic, or on-glasses Speech ASR (beta) ([mic docs](https://wearables.developer.meta.com/docs/develop/dat/microphones-and-speakers/)) | Dictation into a text field only, or WebMCP (off by default) ([llms.txt](https://wearables.developer.meta.com/llms.txt)) |

**Conclusion.** Any idea whose value comes from the first-person view, which is the core of the brief, needs DAT. A Web App only fits a display-only idea that never sees what the wearer sees, and that is weak against L886/L894 (estimate).

**iOS or Android (estimate).** iOS needs 17.2+ and Xcode 26.4+. Android needs 10+ (12+ for the HFP mic route) and Kotlin 2.2 ([setup](https://wearables.developer.meta.com/docs/develop/dat/getting-started-toolkit/), [mic docs](https://wearables.developer.meta.com/docs/develop/dat/microphones-and-speakers/)). The on-site iOS mentor is an engineer and the Android one is in product marketing (CHALLENGES.md:L925-926), which slightly favours iOS. Pick whichever phones the team actually owns and commit to **one** platform.

## 3. Reference architecture for a credible entry

```
[Glasses] --BT Classic--> [Phone app: DAT SDK]
   camera stream (504x896 @ 7-15 fps) or photo capture
   HFP mic (8/16 kHz mono) or Speech capability (beta)
   Inputs capability (beta): touchpad / Neural Band / button
   device state: battery, worn, hinge, thermal
        |
        |-- on-phone frame selection (blur/motion/novelty check; optional on-device face blur)
        |-- HTTPS -> [our tiny backend proxy] -> cloud vision LLM (key stays server-side)
        |
   output: TTS over A2DP (Gen 2, audio-first)  and/or  DAT Display cards (Ray-Ban Display)
   phone screen: mirror + state/consent UI for judges (cast to projector)
```

Key SDK facts this architecture depends on:
- **Camera stream.** 720x1280, 504x896 or 360x640 at 2/7/15/24/30 fps. It is "constrained by the Bluetooth Classic connection" and degrades automatically, first resolution and then fps ([streaming](https://wearables.developer.meta.com/docs/develop/dat/streaming/)). Meta says lower resolution can give better video quality ([mixed-news](https://mixed-news.com/en/meta-dat-camera-720x1280-lower-resolution-higher-quality/)). Google's Gemini Live + LiveKit sample feeds the model about **1 fps** from the glasses ([dev.to](https://dev.to/googleai/realtime-multimodal-ai-on-ray-ban-meta-glasses-with-gemini-live-livekit-45mn)). That is a sensible design point: the LLM never sees the full stream.
- **Audio.** HFP is bidirectional mono at 8/16 kHz and beamformed toward the wearer's voice. Turning on HFP switches output off A2DP for the session. The camera stream must start **after** the HFP route settles, or "the audio route [can] fail silently". Camera-stream audio (non-beamformed PCM) is **beta-only** ([mic docs](https://wearables.developer.meta.com/docs/develop/dat/microphones-and-speakers/)).
- **Sessions.** States are STARTED, PAUSED and STOPPED, and the "state does not expose the reason for a transition". Folding the hinges stops the session, and unfolding does not restart it ([lifecycle](https://wearables.developer.meta.com/docs/develop/dat/lifecycle-events/)).
- **Permissions.** Registration happens through the Meta AI app, and permissions are granted there ("Allow once" or "Allow always"). "Without registration, permission requests fail." Registration without permission means the app connects but has no camera ([permissions](https://wearables.developer.meta.com/docs/develop/dat/permissions-requests/)).
- **Inputs (beta).** These are touchpad, button and Neural Band events. Every error ends the stream, and `Back` events are not delivered by real glasses yet ([inputs](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/inputs)).
- **Speech (beta).** On-glasses ASR delivers text without sending audio to the app. It needs the MICROPHONE permission and dev or beta release channels only ([speech](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/speech)).
- **"Hey Meta, start {app}" voice invocation** requires Wearables Developer Center configuration and a new version. If it does not work, "contact support" ([voice invocations](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/voice-invocations)). Do not rely on it for the demo (estimate).
- **Device state.** Battery, worn/doffed, hinge and an eight-level thermal enum, where CRITICAL or above means sessions "may be denied or terminated" ([device state](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/device-state)).
- **Mock Device Kit.** It simulates camera streaming (phone camera or an **h265** video file), registration and permissions, power/donned/unfolded toggles, and tap to pause or stop. It supports up to three mock devices ([Mock Device Kit](https://wearables.developer.meta.com/docs/develop/dat/mock-device-kit/)). Speech can also be driven from the mock ([speech](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/speech)), and Display content can be simulated in-app or in Chrome ([build for display](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/groups/build-for-display)). **This means 70-80% of the build can happen without glasses (estimate).**
- **AI tooling.** Official Claude Code and Codex plugins (`mwdat-ios` / `mwdat-android`) plus a Wearables MCP server with `search_dat_docs` ([setup](https://wearables.developer.meta.com/docs/develop/dat/getting-started-toolkit/)). Sample apps exist, including DisplayAccess for iOS and Android ([display overview](https://wearables.developer.meta.com/docs/develop/dat/display-overview/)).

## 4. Critical dependencies and how we get them

| Dependency | How we get it | Risk |
|---|---|---|
| Physical glasses (Gen 2 and/or Display) | Shared pool from the Meta booth (CHALLENGES.md:L914-915) | **High.** Allocation rules are unknown. 20 devices for an unknown number of teams |
| Meta AI app paired to those glasses | Glasses "can only be paired with one Meta account at a time"; changing accounts needs a factory reset and re-pair ([Vision Australia manual](https://www.visionaustralia.org/technology-products/resources/using-technology/ray-ban-meta-glasses/ray-ban-meta-wayfarer-gen-2-transitions-user-manual)) | **High.** If Meta pre-pairs the glasses to its own accounts or phones, we must install our app on a phone signed into their account, or Meta must re-pair to ours. Unknown which |
| Developer Mode + registration | Tap the Meta AI app version 5 times ([setup](https://wearables.developer.meta.com/docs/develop/dat/getting-started-toolkit/)). "Only one 3rd party app can remain registered at a time in Developer Mode" ([permissions](https://wearables.developer.meta.com/docs/develop/dat/permissions-requests/)) | **High** if glasses rotate between teams, because another team's registration silently unregisters ours. Developer Mode reportedly turns off after firmware updates ([mirror of Meta's iOS debugging skill](https://mcpservers.org/agent-skills/facebook/meta-wearables-dat-ios/debugging); third-party mirror, not verified against the repo) |
| Version alignment | SDK 1.0.1 needs Meta AI app V292 and firmware V128 ([version deps](https://wearables.developer.meta.com/docs/develop/dat/version-dependencies/)). After the v128 OTA "camera capture stops working", and the fix is to reboot the glasses ([known issues](https://wearables.developer.meta.com/docs/develop/dat/knownissues/)) | Medium. Ask the booth which versions the devices run |
| Server-side capability gating | "Some capabilities are also gated server-side per user", which returns `CAPABILITY_DENIED` ([version deps](https://wearables.developer.meta.com/docs/develop/dat/version-dependencies/)). "Only those in AI glasses supported countries will have access to the full capabilities" ([FAQ](https://developers.meta.com/wearables/faq/)) | **Unknown.** Whether Finland or the accounts used qualify is unknown (a web search budget limit stopped further checks) |
| DAT on-glasses install for Display | Installed from Dev Mode in the Meta AI app, with glasses worn, in about 5-10 s ([display overview](https://wearables.developer.meta.com/docs/develop/dat/display-overview/)). Install fails below 10% glasses battery ([known issues](https://wearables.developer.meta.com/docs/develop/dat/knownissues/)) | Low-medium |
| Vision LLM API | Our own keys (Claude / Gemini / OpenAI). Pricing is per token. A frame every few seconds for a demo costs a few dollars (estimate) | Low for cost. Medium for venue Wi-Fi |
| Apple signing (if iOS) | Free or personal provisioning to install on our own iPhones (estimate) | Low |
| SDK packages | Maven Central `com.meta.wearable` ([GitHub](https://github.com/facebook/meta-wearables-dat-android)) and Swift Package from the iOS repo. A GitHub token in `local.properties` is used in Google's Android sample ([dev.to](https://dev.to/googleai/realtime-multimodal-ai-on-ray-ban-meta-glasses-with-gemini-live-livekit-45mn)) | Low. Set up before arriving at the booth |
| Wearables Developer Center account | Needed for an `APPLICATION_ID`, release channels and voice invocation. In Developer Mode, the IDs can be 0 ([Android integration](https://wearables.developer.meta.com/docs/develop/dat/build-integration-android/)). Login conflicts arise with developers.meta.com ([known issues](https://wearables.developer.meta.com/docs/develop/dat/knownissues/)) | Low if we stay in Developer Mode |

## 5. Documented limits, latency and reliability problems

Documented:
- **Bandwidth.** Bluetooth Classic caps video at 720p/30 and degrades it automatically ([streaming](https://wearables.developer.meta.com/docs/develop/dat/streaming/)). There are **no official latency figures**, and none of the sources we opened publish measured glasses-to-phone latency (unknown).
- **Display.** Large images "may introduce lag due to Bluetooth bandwidth constraints". Each send replaces the whole view. The display sleeps after inactivity. "The system may interrupt sessions for calls, notifications" ([display overview](https://wearables.developer.meta.com/docs/develop/dat/display-overview/)).
- **Known issues** ([known issues](https://wearables.developer.meta.com/docs/develop/dat/knownissues/)):
  - **Display + capture (Dev/Beta):** capture transfers from Ray-Ban Display hold back display updates. Workaround: "Don't combine capture with display capabilities". **This directly hurts a "see and show" app on Display**, so use the camera stream rather than photo capture, or keep Display output minimal.
  - **Speech:** text "silently stops" after about 1 minute. We need watchdog and restart code.
  - **Firmware v128:** camera capture breaks until the glasses are rebooted.
  - **Double-press:** a SHORT_PRESS arrives before DOUBLE_PRESS, so short presses must be buffered.
  - **Wear detection:** taking the glasses off and putting them back on stops inputs, so the capability must be re-added on `donState`.
  - **Beta capabilities** do not resume after pause, so the SDK must be restarted.
  - **iPhone 17 / iOS 26:** HFP calls may have no audio. The fix is iOS 27+.
- **Android SDK 1.0.0** had HEVC buffer corruption that caused frame freezes, plus lag and stutter, fixed in 1.0.1 ([mixed-news](https://mixed-news.com/en/meta-wearables-device-access-toolkit-1-0-1-hevc-buffer-corruption/)). **Pin 1.0.1 or later.**
- **Thermal and battery.** Continuous streaming plus a session raises thermal level, and CRITICAL can deny or terminate sessions ([device state](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/device-state)). Real battery drain figures are unknown.

Estimates (not documented):
- **End-to-end "ask, then answer" latency** on venue Wi-Fi with a cloud vision LLM: about 2-5 s (frame grab under 0.5 s, LLM 1-3 s, TTS start under 1 s). That is acceptable for deliberate queries and not for continuous real-time guidance.
- **Bluetooth Classic congestion.** A hall with about 20 glasses plus hundreds of phones and headphones may push the stream to 360x640 or low fps. Design for 360x640 at 2-7 fps.

## 6. AUP and policy constraints on the idea

From the [Acceptable Use Policy](https://wearables.developer.meta.com/acceptable-use-policy) (last updated 22 Sep 2026, which applies "regardless of whether you publish"):
- **No "unique identification of people based on physical characteristics, such as voices and faces".** Accessibility apps can get an exception only "with prior Meta approval". **Rule out face recognition or person ID** unless Meta pre-approves it on site.
- No surreptitious capture, and no obscuring the capture LED.
- No "analyzing people in a user's surroundings to facilitate unwanted approaches".
- No sensor use or recording in sensitive locations.

Meta's own [acceptable-use guide](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/acceptable-use) encourages hands-free capture and logging, assistive and accessibility uses, deliberate "context on demand" ("not ambient"), motion and coaching, and enterprise workflows. Its design principle is "**narrow purpose, short retention, obvious to bystanders**". Pick an idea from that list and quote this principle in the deck.

## 7. Integration complexity for our team (estimate)

| Work item | Complexity | Notes |
|---|---|---|
| DAT scaffold, registration, permissions, camera stream | Low-medium (4-6 h) | Use the samples and Claude plugin. Mock Device Kit first |
| HFP mic + phone ASR, or Speech (beta) | Medium (3-5 h) | Ordering constraint, route-change handling, 1-minute Speech stop |
| Frame selection + LLM call via backend proxy | Low (2-4 h) | Our core strength |
| TTS back to glasses (A2DP) | Low (1-2 h) | Check `hasA2DPOutput` |
| Display cards (Ray-Ban Display) | Medium (3-5 h) | Simple FlexBox/Text. Avoid combining with photo capture |
| Robustness: PAUSED/STOPPED, link loss, CAPABILITY_DENIED, permission denied, thermal/battery, degraded stream | Medium (4-6 h) | **Scored explicitly (L900).** Mock Device Kit toggles let us demo each one |
| Consent/privacy UX (capture indicator, ephemeral frames, optional face blur before upload) | Low-medium (2-4 h) | On-device face *detection* for blurring is not *identification*. Estimate it is AUP-safe, but confirm with Meta |
| Phone mirror / projector view for judges | Low (1-2 h) | Judges cannot see through the wearer's glasses |
| Deck + pilot story + demo video backup | 4-6 h | Required deliverable (L896) |

Total is about 25-40 person-hours of core build across three people working in parallel with agents. That fits in 40 h with margin, **provided device access works by about hour 10** (estimate).

## 8. Smallest complete version (the 95% plan)

1. A single-platform DAT app that targets **RBM Gen 2, audio-first**. It is also usable on Display glasses because "a single integration works on both" ([Connect recap](https://developers.meta.com/blog/meta-connect-recap/), via Agent A).
2. Trigger by touchpad or button through Inputs, with a phone-button fallback. A voice query goes through HFP mic and phone ASR, or Speech with a watchdog.
3. One frame, or a short burst at 504x896 or lower, goes through on-phone quality filtering to a vision LLM with a prompt narrowly tuned to one audience and task. The answer plays as TTS.
4. A visible state machine on the phone (and spoken cues) for: not registered, permission denied, session paused or stopped, glasses folded or doffed, stream degraded, LLM timeout, offline, and thermal/battery warnings.
5. Consent: the LED stays on, there is a spoken "capturing" cue, frames are never stored, and there is a one-line retention policy.
6. Backup: a pre-recorded h265 clip through Mock Device Kit and a screen-recorded video of the real-glasses run.

**Stretch** (only after step 6 works on real glasses): Display cards on Ray-Ban Display; on-device face blur; Neural Band input; "Hey Meta, start X".

**Do not attempt:** continuous real-time video understanding at high fps, face or voice identification, Web App + DAT shared state, or multi-device sync.

## 9. Live demo: likelihood and failure modes

**Estimate: 6/10 for a clean on-stage run on real glasses, and 9/10 that *something* demonstrable works (mock plus video).**

What would make it fail, ranked by likelihood (estimate):
1. **No glasses or lost glasses** at demo time (shared pool, return-to-booth rules unknown). Mitigation: negotiate a dedicated slot and pair early, and bring a video.
2. **Registration collision or account mismatch**: another team registers on the same glasses (one third-party app per Developer Mode), the glasses are paired to someone else's account, or a firmware update turns Developer Mode off.
3. **CAPABILITY_DENIED / country gating** on the demo accounts. Discover this in hour 1, not hour 38.
4. **Venue Wi-Fi** fails or is slow for the LLM call. Mitigation: a phone hotspot, a short timeout with a spoken fallback, and optionally a small on-device model for one fallback answer.
5. **Bluetooth congestion** degrades the stream, or the HFP route fails silently. Mitigation: low resolution, follow the ordering rule, and handle route changes.
6. **Thermal throttling or battery** after hours of testing. Mitigation: a spare charged unit and stopping the stream between queries.
7. **Silent beta failures** (Speech stopping, Inputs lost after re-donning). Mitigation: watchdogs and phone-button fallbacks.
8. **Judges cannot see the experience.** Mitigation: mirror the phone or cast the frames and answers to a screen.

Peer review and the jury rounds are face to face, so the demo will be run many times. The glasses, battery and registration must survive repeated handoffs. Estimate: let judges wear a second pair only if the hygiene kit and Meta allow it.

## 10. Questions to ask the Meta booth before committing (hour 0-2)

1. How are the 10 Display and 10 Gen 2 units allocated? Per team or by booking slot? Can we keep one overnight and through judging?
2. Are the glasses pre-paired to Meta-owned accounts or phones? Can we pair them to our own Meta account and phone, or must we install our app on their phone?
3. Which firmware and Meta AI app versions are they on (we need V128 / V292 or later for SDK 1.0.1)? Is Developer Mode already on?
4. Does "one third-party app registered at a time in Developer Mode" mean teams will overwrite each other's registration on shared glasses?
5. Are camera streaming, Display access and the beta capabilities (Inputs, Speech, camera-stream audio) enabled for those accounts in Finland, or will we hit `CAPABILITY_DENIED`?
6. Is a demo on one device type acceptable (for example Gen 2 only), or do judges expect Display?
7. Is on-device face *detection* for blurring bystanders acceptable under the AUP? Is any accessibility exception for identification possible within the event?
8. Is iOS or Android better supported on site (the iOS mentor is an engineer, Android is product marketing)?
9. What exactly should be submitted (repo, video, deck format)? How is judging run: on our glasses, by judges wearing them, or by a video?
10. Are there known venue issues (Bluetooth congestion, Wi-Fi) from the setup day?

## 11. Verdict (estimate)

Technically this is a good fit: phone SDK, streaming audio and video, and LLM agents, with official agent tooling. The core feature fits comfortably in 40 h if we build against Mock Device Kit from hour 0 and keep the idea narrow. **The go/no-go depends on the answers to questions 1, 2, 4 and 5.** If we cannot get dependable, registered, capability-enabled glasses for our own phone within the first few hours, the demo reliability drops to about 3/10, and we should switch challenges early rather than late.

Note: web search hit its session budget before country availability could be checked. Finland support for DAT capabilities is therefore **unknown** and must be asked on site.

<!-- complete -->
