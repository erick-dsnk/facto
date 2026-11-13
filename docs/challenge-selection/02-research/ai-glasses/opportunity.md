# AI Glasses (Meta): opportunity discovery (Agent C)

## Summary
- Most teams will build "look and ask an LLM" for blind users, or a translation/recipe viewer. Those ideas are open-source commodities or already shipped by Meta and Be My Eyes (see competitive.md). The open space is in **who** is served, **when** the glasses speak, and **how trust is handled**.
- Five opportunity areas: (1) disabilities and situations Meta's own accessibility messaging leaves out (Deaf/hard of hearing, motor, cognitive load); (2) privacy-preserving perception as a visible, measurable feature; (3) proactive, event-triggered perception instead of ask-and-answer; (4) turning first-person video of a task into reusable guidance; (5) "see it, act on it" agent actions through the new Connectors/WebMCP surfaces.
- Areas 2 and 3 are also the technical core that would carry the robustness and trust criteria (CHALLENGES.md:L900, L902, L937), so the strongest entry likely combines one audience from areas 1/4/5 with the engineering of areas 2/3.
- Stackable honestly: Gemini API, Gemma, ElevenLabs, Codex, and one of Modal/Verda if a self-hosted vision model runs there. Estimates: differentiation 7/10, demo 8/10, jury fit 7/10.

Research note: the shared web-search budget ran out partway through this task, so some claims below rely on pages opened directly (listed) and on the earlier agents' reports. Where a claim could not be checked, it says "unknown" or "estimate".

## What the platform actually offers (inputs to the gaps)
| Capability | Status | Source |
|---|---|---|
| Camera stream 360p-720p, 2-30 fps, Bluetooth-limited, auto-degrades | DAT 1.0 | ai-glasses.md section 1; https://wearables.developer.meta.com/docs/develop/dat/streaming/ (via Agent A) |
| "voice streaming that turns speech into action" with ASR | DAT 1.0 | https://developers.meta.com/blog/meta-connect-recap/ |
| Motion tracking: "head movement and orientation and more" | DAT 1.0 | https://developers.meta.com/blog/meta-connect-recap/ |
| Display UI (FlexBox, Text, Image, Button, Icon, short Video), full-screen replace each send, no state on glasses, system interrupts for calls/notifications, sleeps when idle | DAT, Ray-Ban Display only | https://wearables.developer.meta.com/docs/develop/dat/display-overview/ |
| Neural Band swipe and touchpad input | DAT and Web Apps | https://developers.meta.com/blog/meta-connect-recap/ ; display-overview (above) |
| Web Apps: device position, location, Neural Band wrist motion; text via dictation, handwriting or keyboard; no camera/mic | Ray-Ban Display only | https://developers.meta.com/blog/meta-connect-recap/ ; build guide via ai-glasses.md |
| Meta AI Connectors (expose an API or MCP server inside Meta AI) and WebMCP | Developer preview | https://developers.meta.com/blog/meta-connect-recap/ |
| Experimental: glasses inputs, motion, **on-device speech transcription**, voice calls, standalone photo, camera audio alongside video; not publishable yet | Experimental | https://mixed-news.com/en/?p=35220 |
| DAT does not expose Meta AI or "Hey Meta" custom commands to third parties | Reported by a trade site | competitive.md, citing https://vr.org/articles/meta-ai-glasses-impact-grants-catalyst-developers-2026 |

Underused capabilities (estimate, from what public projects use): VisionClaw-style projects use only camera plus mic into a cloud model (competitive.md). Motion tracking, Neural Band input, the Display's glanceable UI, on-device transcription and Connectors appear unused in the public examples found.

---

## Opportunity 1: the abilities Meta's own story skips
**Gap.** Meta's June 2026 accessibility showcase is almost entirely about blind and low-vision users (label reading, navigation, object identification, translation). It does not mention captions or sign language, Deaf or hard-of-hearing users, aphasia or speech disabilities, cognitive or attention support, or motor impairments; the Neural Band is not presented as an accessibility input (https://about.fb.com/news/2026/06/meta-showcases-how-ai-glasses-help-people-with-disabilities/, opened). Blind/low-vision is also where existing products cluster: Be My Eyes and Envision already run on the glasses (competitive.md).

**Directions inside it (not finished ideas).**
- Deaf/hard of hearing on Ray-Ban Display: glanceable conversation support where the first-person view adds something a phone caption app cannot. Examples: who is speaking (head orientation plus audio), keeping eye contact instead of looking down. Whether Meta already ships live captions on Display is **unknown** (competitive.md). Check at the booth before committing.
- Limited hand mobility or one-handed users: Neural Band and head motion as the whole input vocabulary for everyday tasks.
- Cognitive load or situational impairment (busy hands, noisy room, stress), framed as "everyone, everyday" to stay out of the healthcare scope the team excluded. Avoid the dementia memory-aid version, which is grant-funded (OurLife, https://about.fb.com/ai-glasses/) and leans on face ID.

**Why Meta would care (inference).** The brief says "people with all abilities" three times (L890, L896, L902) and gives 25% to input, accessibility and trust (L937). An entry that widens the platform's accessibility story beyond the case Meta already markets fills a visible hole.

**How the overall jury reads it (estimate).** It scores well on "worthwhile problem with a specific user" when the team names one user group and tests with a real person. The risk is that it looks like captions, which reviewers have seen before, unless the first-person angle is obvious within 60 seconds.

## Opportunity 2: privacy-preserving perception as the product, not a disclaimer
**Gap.** The public trust problem with camera glasses is concrete. In 2024 Harvard students built I-XRAY, which streamed Ray-Ban Meta video, ran face search and returned strangers' names, addresses and phone numbers; the only bystander signal is a recording LED (https://www.engadget.com/wearables/students-used-metas-smart-glasses-to-automatically-dox-strangers-via-instagram-streams-170228496.html, opened). The open-source glasses assistants send raw frames to a cloud model (VisionClaw to Gemini Live, competitive.md), and none of the public examples found describe redaction or consent handling.

**Directions.** On-phone filtering before anything leaves the device: blur faces and screens, drop frames that hold no task-relevant object, keep data ephemeral, keep an audit log the user can show, and a consent step for people in the frame. This works as the technical spine of any idea from the other areas. Small local vision models make this practical on a phone now (estimate; specific latency on the team's phones is unknown until tested).

**Why Meta would care.** The brief requires "appropriate consent and safe data practices" to be "part of the demo" (L902, L906). Inference: bystander trust is a barrier to adopting the platform, and a third-party pattern that shows it can be handled helps Meta's case.

**How the overall jury reads it (estimate).** Strong on "distinctive insight and technical depth" and on "honest measured evidence", because it gives a metric that is hard to game (for example faces redacted per 100 frames on a held-out clip, and bytes uploaded versus a naive baseline). Alone it is a weak peer-floor story ("privacy layer"), so it should sit under a concrete user.

## Opportunity 3: proactive, event-triggered perception instead of ask-and-answer
**Gap.** The commodity pattern is user-initiated: look, ask, wait for a cloud answer (VisionClaw, Matcha, Meta AI; competitive.md). The brief asks for "hands-free, in-the-moment value" and for handling "performance trade-offs, connectivity, and device state changes" (L900, L906). Few public projects use the stream continuously and decide on their own **when** to speak, which is where glasses beat a phone: the phone is in a pocket at the moment that matters.

**Directions.** A cheap always-on loop (low fps, motion tracking to detect when the head is still or turning toward a task, local model) that escalates to a large vision model only when a defined event happens. Then a short audio cue or one glanceable Display card. The bandwidth ladder and battery cost become the engineering story: show frame rate, upload rate and latency adapting live. The everyday task needs choosing at the ideation stage (for example procedural tasks such as repairs, assembly or cooking where a missed step matters); medical monitoring is out of scope.

**Why this is newly possible (estimate).** Running a usable vision model on a phone at a few fps and keeping a capable multimodal model in reserve has only become cheap and fast enough in the last one or two model generations. Before that, continuous first-person sensing meant constant cloud upload over a Bluetooth link capped by the SDK's streaming ladder (streaming docs via ai-glasses.md).

**Why Meta would care.** It uses DAT in the way that justifies glasses (camera always at eye level, motion tracking) and directly exercises the L900 robustness list.

**How the overall jury reads it (estimate).** A clear before/after: the same task with a phone (you have to stop, unlock, point) versus glasses that interrupt only at the right moment. It is measurable (false alarms per minute, missed events, latency), which suits the jury's evidence criterion.

## Opportunity 4: turning first-person video of a task into guidance for someone else
**Gap.** Meta's grant recipients show demand for hands-free coaching and job capture in specific trades (construction coaching, field service notes, roadside mechanics; https://about.fb.com/ai-glasses/, opened). These are vertical, professional products. The consumer, everyday version (someone who knows how to do a household task records it once by doing it; someone else gets step-by-step glanceable guidance later) did not appear among the public examples found (competitive.md lists recipe/tutorial *viewers* without sensing as an obvious idea, which is different).

**Directions.** Capture a first-person session (video plus narration), have a multimodal model segment it into steps with key frames, then replay on the Display or as audio for the learner, with the learner's own camera checking progress. Everyday audiences: family knowledge handed between generations, housing-company or tenant instructions for building equipment, newcomers learning local routines. Which audience is best is for the ideation stage.

**Why Meta would care (inference).** It uses the first-person view twice, on both the author and the learner side, and it works on audio-first Gen 2 as well as on Display, the "equal footing" the brief offers (L898).

**How the overall jury reads it (estimate).** Easy to show live: record a 60-second task on stage, then a peer follows the generated guide. The risk is overlap with grant-funded trade coaching, so the deck must place it as consumer and everyday.

## Opportunity 5: see it, then act on it (agent actions from the first-person view)
**Gap.** DAT reportedly does not let third parties hook into Meta AI or "Hey Meta" commands (competitive.md, via vr.org). Meta has just opened two preview routes in the other direction: **Meta AI Connectors** ("connect a service through an API or MCP server" so people can reach it inside Meta AI) and **WebMCP** for web apps (https://developers.meta.com/blog/meta-connect-recap/, opened). No public hackathon project using either was found (search budget ran out, so this is low-confidence). Today, acting on something you see (reporting a broken lift or blocked ramp, logging a return, filing a damage claim) still means taking a photo, opening an app and filling in a form.

**Directions.** The glasses capture evidence with location and context. An agent drafts the structured report or action. The user confirms by voice or Neural Band, which is the consent step, and it submits to a real or mocked service. United Spinal's grant (wheelchair users documenting accessibility barriers, https://about.fb.com/ai-glasses/) shows Meta already values this pattern. A Helsinki or Finnish public-service target would make a local pilot partner plausible. Whether a specific city feedback API is open is **unknown** and must be checked; per CLAUDE.md conventions it would sit behind a mock.

**Why Meta would care (inference).** It shows its newest surfaces (Connectors, WebMCP) being used, and it has an explicit pilot partner type.

**How the overall jury reads it (estimate).** Good legibility ("I looked at it, said 'report', done"). Depth depends on structured extraction quality, which is measurable (field accuracy against hand-labelled reports). Risk: preview access to Connectors at the event is **unknown**, so the core flow should not depend on it.

## Cross-cutting: what makes any of these demo well
- **Real glasses, both form factors.** One DAT integration "works on both display and displayless glasses" (Connect recap via ai-glasses.md). Showing the same app on Gen 2 (audio) and on Display hits L898 directly. Device access is the main risk: 20 shared units (L914-915), allocation **unknown**.
- **Failure handling shown on stage.** Deny the camera permission, trigger a call interruption (the display docs say the system interrupts sessions for calls and notifications), let the display sleep and recover. Few teams will show this (competitive.md), and it matches L900 point by point.
- **Before/after.** Run the same task phone-only and then with glasses, timing both or counting how many times hands leave the task.
- **Platform trap.** Web Apps have no camera or microphone, so any perception idea needs DAT on iOS or Android (ai-glasses.md section 6).

## Tech challenges an entry could honestly stack
From _tech-challenges.md; prize details are there.
- **Best Use of Gemini API** (low effort): Gemini Live or multimodal for escalation or video segmentation. Participants must be 18+.
- **Best Use of Gemma** (low): an on-phone or self-hosted Gemma model as the privacy filter or event detector in areas 2 and 3. Whether a Gemma model runs fast enough on the team's phones is **unknown** until tested.
- **Best Use of ElevenLabs** (low): natural, low-latency speech for an audio-first Gen 2 experience. It only counts honestly if voice quality matters to the user group.
- **Best Use of Codex** (low): applies to development workflow, so it stacks with anything.
- **Best use of Modal** or **Verda Compute** (medium): only if the team self-hosts a vision model for escalation or segmentation. Pick one; both are a stretch otherwise.
- **Nemotron** (medium): possible as the main vision-language model, but it must be "central to core function", which conflicts with using Gemini as the core. Choose one.
- Not a natural fit: Arduino, Atech, Solana. MongoDB, Aiven and Tiger Data are low effort but add little.

## Estimates (all are my estimates)
- **Differentiation potential: 7/10.** The obvious ideas are saturated, but the gaps above (other abilities, proactive sensing, privacy as a metric, Connectors) are open. Medium-high crowding and identical sample repos for every team cap this.
- **Demo potential: 8/10.** Wearable hardware is visual, peers can try it on at the table, and before/after plus live failure recovery make a strong 60-second demo. The main deduction is the risk of not getting a device for the final demo (shared pool, rules unknown).
- **Jury fit: 7/10.** It fits "specific user", "live demo" and "peer-floor wow" well, and areas 2 and 3 provide measured evidence. The deductions: the overall jury may see a consumer-glasses entry as a sponsor showcase, and the single partner prize is modest (glasses per member, L943). The path-forward score depends on naming a real pilot partner.

<!-- complete -->
