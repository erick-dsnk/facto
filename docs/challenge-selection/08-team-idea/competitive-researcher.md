# Competitive researcher: "Live fact-checker" (live-fact-check)

## Summary
- **Score: 40 / 100 on novelty and differentiation. Hard reject: no (borderline).** On the existing table it would sit 13th of 18, tied with heads-up-sounds and just below table-talk (42).
- The mechanism (listen, spot check-worthy claims, search the web, nudge the wearer) is a crowded pattern. I found shipped phone apps (Faktum, Ghost Mic, ConversAItions), a live-audio research system (Factiverse LiveFC), a 2016 live-debate deployment (ClaimBuster) and wearable research (Factually, FactNudger) that all do it. Halliday, a commercial display-glasses product, markets proactive fact-error detection.
- What is unoccupied: I found no Meta-glasses app and no Meta Wearables Device Access Toolkit (DAT) entry doing this. That is only a thin wedge, because the glasses add display and gesture over the same pipeline.
- The "cut misinformation worldwide" bet is not a differentiator, and the pop-up-on-judgment design has a known failure mode (wrong nudges change beliefs about true claims).
- Searches were shallow (about eight searches, two page fetches). Devpost and hackathon winner lists were not exhaustively searched, so confidence is medium.

## Criteria (adopted from 05-evaluation/competitive-researcher.md)
Novelty and differentiation only, not feasibility or jury appeal. 80+: nothing found and Meta built-ins do not cover it. 60-79: adjacent work exists but the combination is unoccupied. 40-59: working products cover the need and glasses add a modest twist, or a known crowded pattern. Below 40: shipped products or Meta built-ins already cover it. Hard reject only if essentially an existing product.

## Existing things found
| Thing | What it does | Overlap |
|---|---|---|
| [Faktum](https://hunted.space/product/faktum) (iPhone app, as described in search results) | Listens in the background, detects checkable claims, verifies against web sources, shows a verdict; says 26 languages, no audio stored | Same loop, phone form factor |
| [Ghost Mic](https://hunted.space/product/ghost-mic) (beta) | Listens to conversation, shows source-backed fact-checks on screen in under 2 s (vendor claim, unverified) | Same loop, aimed at podcasters |
| [ConversAItions](https://hn.jakechampion.name/reader/https://www.conversaitions.ai) | Real-time fact checking of meetings, including in-person | Same loop, meetings |
| [LiveFC (Factiverse)](https://arxiv.org/html/2408.07448v2) | Live audio: transcribe, diarize, classify check-worthy sentences, fact-check within seconds; tested on the 2024 US presidential debate | Same check-worthiness plus retrieval pipeline, in research and product form |
| [ClaimBuster](https://arxiv.org/pdf/1809.08193) and Full Fact claim detection | Check-worthy claim spotting; ClaimBuster ran live on 2016 US debates | The "checkable" step is a solved research problem |
| [Factually](https://arxiv.org/abs/2504.17204) (arXiv 2504.17204) | Wearable fact-checking with an LLM querying web sources and a confidence score, alerting via smartwatch or ring vibration | Same flow, different output channel |
| [FactNudger](https://arxiv.org/html/2603.27289v1) (arXiv 2603.27289) | Wizard-of-Oz smartwatch study, 34 participants: haptic nudge plus short text cut belief in false claims and raised verification; wrong nudges lowered belief in true claims and users over-relied | Evidence for the idea's value, and for its main risk. One participant suggested glasses, so the paper does not test them |
| [Halliday glasses](https://digitaltrends.com/mobile/halliday-smart-glasses-have-a-screen-and-a-crazy-control-system) | Display glasses with optional always-listening AI that can "detect factual errors during a business meeting" and surfaces answers on screen; ring control | The closest: a commercial glasses product with the same promise (as reported by Digital Trends; the author questions latency and cost) |
| Even Realities G1 | Live captions and translation; no fact-check feature found ([Even Realities](https://www.evenrealities.com/g1)) | Shows the display and captions layer exists on other glasses |
| Meta AI on Ray-Ban Meta | Reviews report real-time answers that are sometimes wrong and cite unsupporting sources ([Yahoo Tech](https://sg.news.yahoo.com/the-ray-ban-meta-smart-glasses-new-ai-powers-are-impressive-and-worrying-181036772.html)). No built-in passive fact-check found | Meta does not ship this, but "Hey Meta, is that true?" is a one-shot built-in substitute (estimate) |

Hackathon prior art: no fact-checker project for Meta glasses found. The Meta-hosted hackathon winner was OpenGlass, a general see-and-hear chatbot ([Gizmodo](https://gizmodo.com/cerebral-valley-hackers-build-20-open-source-smart-gla-1851476656)). Our own competitive.md already lists "ask an LLM what you see" as commodity (VisionClaw, OpenGlass, meta-lens-ai).

## Assessment by input variant
- **Audio (what the wearer hears).** Most crowded. Faktum, Ghost Mic, ConversAItions, LiveFC and Halliday all do it. Score about 35. DAT also limits this path: the on-glasses speech ASR is beta and, per our feasibility notes, stops after about a minute (feasibility.md, Speech beta).
- **Visual (text, posters, screens).** Less crowded: I found no glasses product that reads visible claims and checks them. Phone Lens-style search is the substitute. Score about 50.
- **Both.** Score about 40, held down by the audio half.
- **Output.** Display card plus Neural Band gesture needs Ray-Ban Display. Meta documents DAT display access ([display overview](https://wearables.developer.meta.com/docs/develop/dat/display-overview/)); gesture API details I could not confirm from primary docs (secondary reports only), and our feasibility.md marks Inputs as beta. Audio-only fallback (TTS of the verdict and sources) is generic and adds nothing to differentiation.

## Criterion-by-criterion
- **Does the glasses-specific mechanism exist elsewhere?** Partly. Halliday sells the concept; wearable research covers watch and ring. No Meta-glasses version found. Credit: small.
- **Do Meta built-ins cover it?** Not as a passive feature. Meta AI covers the one-shot "is that true" query, with documented reliability complaints. Credit: neutral.
- **Is the combination unoccupied?** No for audio; mostly yes for visible text. Credit: only the visual variant.
- **Does the twist survive the search?** The Jev-based typed judgment and probabilities for check-worthiness is a real technical angle, but LiveFC and ClaimBuster already do check-worthiness with trained classifiers, so a judge who knows them sees a rebuild. I did not verify Jev's latency or access; this report does not rely on it.

## Strongest objection
Faktum, Ghost Mic and ConversAItions are shipped products doing the same loop on a phone, and Halliday markets it on glasses. A judge can say "this is Faktum on Meta glasses". The glasses add only a display card and a gesture, and Meta's rubric (CHALLENGES.md:L934-937, per our notes) rewards use case and trust. A passive nudge also carries the over-reliance and wrong-nudge harm that FactNudger documents.

## Overlap with existing candidates
Closest: **table-talk** (always-listening speech to display on glasses, up against Meta captions), **heads-up-sounds** (ambient audio to look-confirm display), and **basket** and **glance-log** (label or text reading with a crowded phone-app category). None share the claim-verification purpose.

## Best variant
Wearer-initiated check of **visible claims** (supplement or product packaging, ads, posters, screens) rather than passive speech. The wearer looks, the app extracts the claim, and a typed verdict returns with each source as a spoken or card line. Add a measured result (precision on a labelled set of real claims, and a "refuse to judge" rate), which answers the over-reliance critique. This avoids the crowded audio space and the beta speech ASR. **Score about 58** (not 60+: Google Lens, label scanners and Meta AI one-shot answers are close substitutes). Narrowing to one audience (for example older relatives and scam-adjacent health claims) might add a few points, estimate.

<!-- complete -->
