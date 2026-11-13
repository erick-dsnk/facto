# Competitive researcher evaluation: AI Glasses for Everyone, Everyday (Meta)

## Summary
- Lens: novelty and differentiation that survives a search for existing products, glasses apps, open-source projects, hackathon entries and built-in Meta features.
- Most differentiated: **Point and Find (beacon)**, **Did I?**, **Nod**. Research prototypes or adjacent tools exist for each, but I found no shipped product or glasses app that does the same thing.
- Least differentiated: **Which Way Now** (Meta translates signs and text already), **Glance Log**, **Sana**, **Still Head**, **Heads-Up Sounds**, **Table Talk** (Meta ships live captions and Conversation Focus).
- Evidence limits: searches were shallow (one to two per cluster). Candidates marked "not directly searched" are scored on inference from our own research and are lower confidence. Devpost and similar pages were not opened by me.

## Criteria
Score 0-100 on novelty and differentiation only (not feasibility, not jury appeal). The same scale for all:
- 80+: nothing found that does the glasses-specific mechanism, and Meta's built-ins do not cover the need.
- 60-79: adjacent products or research exist, but the specific combination is unoccupied.
- 40-59: working products cover the need and the glasses add a modest twist, or the idea is a known crowded pattern.
- Below 40: shipped products or Meta built-ins already cover it.
Hard reject only when the candidate is essentially an existing product.

Baseline from our research: "ask an LLM what you see" is commodity (VisionClaw, Matcha, OpenGlass, meta-lens-ai; competitive.md), Meta ships object and label recognition, translation and Be My Eyes support, and no public winner list for Meta-glasses hackathons was found (competitive.md).

## Ranked table
| Rank | Id | Score | Hard reject | Closest existing thing |
|---|---|---|---|---|
| 1 | beacon | 78 | no | UTS/ARIA "acoustic touch" research glasses; Be My Eyes; Meta AI verbal description |
| 2 | did-i | 76 | no | None found; Meta memory-loss research |
| 3 | nod | 72 | no | Ace Centre Echo, Vocable, Jabberwocky head-tracking AAC |
| 4 | panel-reader | 66 | no | iPhone Magnifier Point and Speak |
| 5 | teardown-memory | 64 | no | None found (not directly searched) |
| 6 | cross-contact | 62 | no | None found (not directly searched) |
| 7 | private-hand | 62 | no | Cards That Talk, AI Card Detector, SeeCards, EchoDeck |
| 8 | coverage-inspector | 52 | no | Smart-glasses inspection and insurance-claims products |
| 9 | show-me-once | 50 | no | Enterprise remote-assist and Circus-style guidance (not directly searched) |
| 10 | basket | 48 | no | Many phone allergen scanner apps; VisionClaw shopping-list agent |
| 11 | step-check | 45 | no | Circus Group on Ray-Ban Meta; Clutch; Meta Connect cooking demo |
| 12 | table-talk | 42 | no | Meta Ray-Ban Display live captions, Conversation Focus |
| 13 | heads-up-sounds | 40 | no | Taptic, Visualfy, SoundWatch, HoloSound |
| 14 | still-head | 38 | no | Golf apps; 18Birdies reportedly a Display partner (unverified) |
| 15 | sana | 36 | no | Immerse (Meta grant, language tutoring) |
| 16 | glance-log | 35 | no | META-aivi, FHNW "Smart Eyes" gauge-reading project, RealWear/Vuzix |
| 17 | which-way-now | 28 | yes | Meta translation of signs and text; Meta navigation |

## Evidence by candidate

**beacon (78).** The closest prior art is the PLOS ONE "acoustic touch" study (UTS/Sydney with ARIA Research): smart glasses with head tracking and spatial audio icons helped 14 participants (7 blind or low vision) recognise and reach objects, and it was compared with verbal clock-face description ([PMC10599575](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10599575/)). That is a research prototype with custom hardware, not a product, and it sonifies whatever is in view rather than a user- or helper-chosen target. Commercial glasses (OrCam, Envision) are described there as mostly speech-based. Be My Eyes on Meta glasses gives a sighted volunteer the camera feed ([Meta help](https://www.meta.com/help/ai-glasses/1524316621830425/)), which is the verbal-direction baseline the candidate beats. The helper-tap to bearing beacon combination, and the time-to-touch comparison, are unoccupied as far as I found. Strongest objection: the novelty is a known research idea, and a judge who has seen acoustic touch may call it a replication; the beta Motion dependency also limits what can be shown.

**did-i (76).** I searched for stove or door-lock verification on glasses and found nothing; results were general memory glasses (Halo X, Xgimi MemoMind, Android XR memory demo) and an object-memory dataset (SuperMemory-VQA, [arXiv 2505.11888](https://arxiv.org/html/2505.11888v1) is a related AR memory paper). Meta's own memory work is about conversations and task planning ([Meta, Feb 2026](https://about.fb.com/news/2026/02/helping-people-with-memory-loss-with-ai-glasses/amp/)); the Kynd Devpost entry shows dementia assist is a repeated theme (competitive.md). Always-on memory products exist, but a gated, verdict-only, 24 h checkpoint is a different and more privacy-friendly design. Whether Meta AI Live AI can answer "did I lock the door" after the fact: unknown, but it has no stated history of past frames. Strongest objection: any phone camera or smart plug or stove sensor already solves "is the stove off", so differentiation rests on the glasses-specific capture moment, and the memory-aid category is crowded with funded players.

**nod (72).** Head-input communication exists on phones and tablets: Ace Centre Echo lists nodding, shaking and tilting as access methods ([Ace Centre](https://docs.acecentre.org.uk/products/echo/access-methods/facial-gestures)); Vocable is open source and uses ARKit head tracking ([GitHub](https://www.github.com/willowtreeapps/vocable-ios)); Jabberwocky AAC supports head tracking on Face ID devices ([App Store](https://apps.apple.com/us/app/id1438561966)). All of these select items on a screen. None found selects real-world objects by gaze direction through a wearable camera. Strongest objection: head-tracking AAC is mature, and users with ALS often rely on eye tracking, so judges may read this as a re-skin of existing switch access.

**panel-reader (66).** Apple Magnifier Point and Speak reads text under a finger using LiDAR, Pro iPhones only, and explicitly warns against reliance in high-risk use ([AbilityNet](https://mcmw.abilitynet.org.uk/how-to-read-aloud-text-and-labels-around-you-using-the-magnifier-app-in-ios-17-on-your-iphone-pro-or-ipad-pro), [iGeeksBlog](https://www.igeeksblog.com/how-to-use-point-speak-on-iphone-ipad/)); AppleVis users report it is aimed at people with usable vision. That is the same fingertip-reads-label concept, so the core idea is not new. What differs: hands-free head-level camera, a registered control map giving meaningful names for flat panels with no printed text under the finger, and offline operation. Meta AI one-shot description is the stated baseline (candidate text). Strongest objection: a judge who knows Point and Speak will see this as that feature moved to glasses.

**teardown-memory (64).** Not directly searched. I found no glasses product for ordered disassembly undo history in the searches I ran on assembly guidance, which surfaced only forward guidance (Circus Group, Clutch). Lower confidence. Strongest objection: Step Check overlaps on the fiducial-and-diff mechanism, and a phone on a tripod already records a teardown.

**cross-contact (62).** Not directly searched. Our research does not list a glasses allergen cross-contact product; commercial kitchen vision and HACCP logging systems likely exist (estimate, unverified). The nearby kitchen item I did find is Circus Group using Ray-Ban Meta for kitchen operations ([Circus](https://www.circus-group.com/articles/from-munich-to-the-world-how-circus-uses-meta-ray-ban-ai-glasses-to-power-autonomous-kitchen-operations)). Strongest objection: fixed ceiling cameras are the incumbent approach for food safety, and a safety claim with false negatives is hard to defend.

**private-hand (62).** Camera card readers for blind players exist: Cards That Talk (needs QR-coded cards, [App Store](https://apps.apple.com/app/id1088588020)), AI Card Detector, SeeCards, and the EchoDeck web app ([Devpost](https://devpost.com/software/echodeck)). None found reads UNO or follows a discard pile with a rules engine; all are phone-held. The differentiator is hands-free, private, legal-move guidance on an ordinary deck. Strongest objection: EchoDeck-style entries show the core detection is a known hackathon topic, and UNO detection is a niche.

**coverage-inspector (52).** Smart-glasses inspection is a known enterprise category ([Insurance Thought Leadership](https://www.insurancethoughtleadership.com/emerging-technologies/smart-glasses-transform-insurance-claims-inspections), [VSight](https://vsight.io/blog/smart-glasses-for-maintenance-and-inspection-purposes/)). Gaze-as-recorded-coverage with a close-out lock is a distinctive mechanism, but I could not verify whether competitors do coverage tracking. Strongest objection: enterprise checklist apps already enforce completeness, and the candidate itself rates its wow factor low.

**show-me-once (50).** Not directly searched beyond Circus Group and enterprise remote-assist results. Expert-POV capture plus learner guidance resembles enterprise "record a procedure" tools (estimate, unverified). Meta funds field-service and trade-coaching use cases (competitive.md, grant list). Strongest objection: a hands-free recipe or tutorial viewer is listed as an obvious idea to avoid in competitive.md, and unconstrained task segmentation is hard to show working.

**basket (48).** Phone allergen scanners are plentiful (AllergiAI, BiteSight, Allergy Scanner, NoAllergen; [App Store listing](https://apps.apple.com/us/app/id6744301419)). NoAllergen mentions AR glasses only as a future add-on ([blog](https://noallergen-pro.pages.dev/en/blog/noallergen-app-how-ai-helps-you-shop-safer)). No glasses allergen project found. VisionClaw includes shopping lists via an agent (competitive.md). Meta AI reading labels: unconfirmed in my search. Strongest objection: shopping and nutrition scanners are item 5 on the "what most teams reach for first" list, and the pick-up gate plus allergy profile is an incremental twist on a crowded app category.

**step-check (45).** The candidate itself flags four source angles converging. Prior art: Circus Group uses Ray-Ban Meta for asking the next assembly step and anomaly alerts through DAT ([Circus](https://www.circus-group.com/articles/from-munich-to-the-world-how-circus-uses-meta-ray-ban-ai-glasses-to-power-autonomous-kitchen-operations)); Clutch generates step-by-step guidance (Gemini Live Agent Challenge, per search); Meta's own Connect 2025 cooking demo failed on a missed step, showing the gap exists but is publicly known. Strongest objection: many teams will build "guided steps plus verification", and the fiducial mat is the only distinctive element.

**table-talk (42).** Meta Ray-Ban Display already shows live captions for speech directed at the wearer and is expanding them to voice messages ([Meta](https://www.meta.com/ai-glasses/meta-ray-ban-display/), [Pulse 2.0](https://pulse2.com/meta-neural-handwriting-display-recording-live-captions-expanded-navigation-and-developer-tools-roll-out-on-ray-ban-display/)); Conversation Focus was announced to isolate the speaker in a crowd ([HearingTracker](https://www.hearingtracker.com/news/meta-ray-ban-gen-2-conversation-focus-ai-speech-enhancement-for-hearing-loss)). I found no source confirming per-speaker separation or labelling in Meta's captions (unknown). Per-participant phone mics with consent is the differentiator. Strongest objection: Meta is closing the gap with first-party features, so the demo could be judged against Meta's own captions.

**heads-up-sounds (40).** Sound alert apps are established: Taptic, Visualfy ([App Store](https://apps.apple.com/es/app/visualfy/id1239331584?l=en-GB)), SoundWatch on smartwatch, and HoloSound as a head-worn AR concept from UW ([Hearing Review](https://hearingreview.com/hearing-products/accessories/assistive-technologies/soundwatch-new-smartwatch-app-alerts-hard-of-hearing-users-to-sounds)). Phone-OS sound recognition: not verified in my search. The glasses-specific twist is look-to-confirm cutting false alarms. Strongest objection: prior work already covers display of sound events in the line of sight, and this needs the Display and beta audio.

**still-head (38).** Golf is a reported Display partner area (18Birdies, one thin source, unverified; competitive.md). I did not find a glasses head-stability putting coach, but the need is narrow and a phone on a tripod is the obvious substitute. Strongest objection: weak everyday and accessibility fit under a challenge that explicitly asks for everyday, inclusive use.

**sana (36).** Meta funded Immerse for hands-free language tutoring (competitive.md grant list, vr.org source), and the candidate itself notes the overlap. Object-triggered spaced repetition is a distinct mechanism but language learning is on the "reach for first" list (item 8). Strongest objection: a funded competitor with Meta's own backing exists and retention cannot be measured in 40 h.

**glance-log (35).** Gauge reading on Ray-Ban Meta via DAT plus Gemini already exists as a student prototype (FHNW "Smart Eyes", [project page](https://studierendenprojekte.wirtschaft.fhnw.ch/view/4887)); META-aivi targets meter reading on RealWear; enterprise glasses log readings by voice. Dwell-plus-QR capture is a small variation. Strongest objection: this is a well-served enterprise category with a low-wow demo.

**which-way-now (28, hard reject).** Meta states the glasses translate menus and street signs on voice command ([Meta](https://www.meta.com/ai-glasses/learn/live-translation-captions/)), and Meta AI offers navigation (competitive.md). Itinerary-to-board-row matching is a thin layer on that, and live transit data is unknown. Strongest objection: essentially an existing built-in with a mocked data source.

<!-- complete -->
