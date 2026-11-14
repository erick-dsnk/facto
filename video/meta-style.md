# Shooting in Meta's style

Written Sat 14 Nov, 14:00. This adds to `README.md` and `launch-teardowns/SYNTHESIS.md` and changes them in a few places. The structure stays: hook by 0:03, name at 0:12, one long uncut demo, close on people. The look and the motif move toward Meta's own glasses videos, because the judges for this challenge work at Meta.

## What we watched

Found through xpoz (X, Instagram, TikTok), downloaded and cut-detected. Contact sheets are in `refs/meta/`.

| Ref | Video | Reach | Length, cuts | What it shows |
|---|---|---|---|---|
| A | @Meta, "Meta Ray-Ban Display + Meta Neural Band" launch reel | 315K views | 1:45 vertical, cut every 2.1 s | Real people in a bright, colourful set try the glasses. Small white captions, lower centre. Through-the-lens shots: a dark rounded vignette with the HUD card floating in it. Opens on a macro of the frame. |
| B | Meta Ray-Ban Display product film | 400K (Reality Labs post) | 0:15, 3 s shots | Black glasses floating on a **soft blue-grey gradient**, slow orbit, macro on the hinge and camera. The HUD is a translucent grey rounded card with white text and **one green pill**. |
| C | @oakley, "Introducing Oakley Meta HSTN" | 120K | 0:58, cut every 1.3 s | `Oakley ∣ ∞ Meta` lockup at the start and end. Bold two-word cards on black ("OAKLEY DESIGN", "META TECHNOLOGY"). Athletes, macro on the camera lens, a phone showing the clip the glasses shot. |
| H | Meta Glasses holiday ad, 2026 | press pickup | 1:00, filmic | A school play. Every parent films it with a phone held up. One mum wears the glasses and just watches. End line: **"The best present is being present."** |
| D | @LesterL, travel HUD built for Ray-Ban Display | 71K | 0:54, nearly uncut | Raw POV with the HUD burned in, captured with the glasses' own Display Recording. No edit needed to look real. |
| E | @JohnArndt, Portravo, **built for a Meta hackathon** | 62K | 2:10, 6.5 s shots | Our closest competitor format. Timestamp hook ("11:33 walked in / 11:39 quote ready"), bold condensed cards, real POV next to a replica of the HUD, a "Built on Meta" pipeline diagram, a stats grid, an end card reading "Portravo Live for Meta Ray-Ban Display". |

Ray-Ban's own caption for its Meta glasses ad: "Keep your hands free, your eyes up and your curiosity on."

## What Meta's videos have in common

1. **The message is "eyes up, phone down".** The launch reel, the Ray-Ban caption and the holiday ad all pitch glasses that keep you present and away from your phone. Facto fits that pitch exactly: you check a claim without pulling your phone out mid-conversation. Make it our problem section.
2. **Product shots sit on a soft blue-grey gradient.** We already have `outputs/actually-glasses/actually_glasses.blend` and the landing page's 150-frame camera path. Render the same path on Meta's gradient and use it for both.
3. **Through-the-lens shots use a dark rounded vignette** with the HUD card upper centre. Never a flat screen recording.
4. **The HUD looks calm:** translucent dark grey, white text, rounded corners, one coloured accent. Our verdict colours (green True, red False, amber Misleading) slot straight in.
5. **Captions are small, white, sentence case, lower centre**, one phrase at a time. Meta never uses big Farza-style mid-frame captions. Big type only appears as two- or three-word cards on black (Oakley).
6. **People are real, lit brightly, and look happy to be there.** Natural skin, daylight, colour. No teal-orange grade, no black and white.
7. **The device is named in full:** "Meta Ray-Ban Display", "Meta Neural Band", "Hey Meta". Developers' videos credit the "Wearables Device Access Toolkit" by name.

## Changes to our plan

| In `README.md` now | Change to |
|---|---|
| Farza-style big centred captions | Meta-style captions: Onest 500, about 40 px at 1080p, white, soft shadow, lower centre. Big type only for 2–3 cards on black. |
| Problem montage in B&W | "Phones up" montage, slightly desaturated and cool. Colour and warmth come back when the glasses go on. |
| 2–3 Gemini Omni cutaways | Blender product hero on Meta's blue-grey gradient (same camera path as the landing page). Omni stays optional; an AI-drawn pair of glasses next to the real ones would look off. |
| Warm filmic grade, grain | Clean and bright: natural skin, lifted shadows, light grain at most. |
| Demo as a zoomed screen recording | Over-the-shoulder ZV-1 take with the glasses' **Display Recording** shown in a rounded-vignette inset, side by side the way Portravo does it. |
| End card with URL | `facto` wordmark + "for Meta Ray-Ban Display" in plain text, GitHub link, "Built at Junction 2026". |

**Branding line.** Name the product in text ("Facto for Meta Ray-Ban Display"), the way Meta's own Explore listings and Portravo do. Don't build a fake `Facto ∣ ∞ Meta` co-brand lockup: that implies Meta endorsed it, and a Meta judge will notice.

**Honesty line (from `docs/plan.md`).** Every HUD frame in the film comes from a real run. If a shot shows a recreated HUD, label it on screen ("display recreated from app output"). Run both demo claims through the live pipeline before filming the demo.

## Revised beat sheet (2:00)

| Time | Beat | Picture | Words (draft for G1) |
|---|---|---|---|
| 0:00–0:03 | Hook | Through-the-lens POV at a table. A friend says the line; the HUD shows **False · Live Science**. | Friend: "Goldfish only remember things for three seconds." |
| 0:03–0:12 | Who we are | David to camera at the venue, name lower-third | "I'm David. Eric, Ciprian and I spent this weekend at Junction building for Meta Ray-Ban Display." |
| 0:12–0:15 | Reveal | 0.4 s audio dip, then the Blender hero on the gradient, music lands | "So we built Facto." Card: `facto` · for Meta Ray-Ban Display |
| 0:15–0:35 | Problem | Phones-up montage, 1–1.5 s shots. One counter-shot of a wearer who keeps talking, eyes up. | "Every argument at our table ends the same way. Someone pulls out a phone, types it in, reads three tabs. By then, the conversation has moved on." |
| 0:35–1:05 | Demo | One uncut take, ZV-1 over the shoulder + Display Recording inset. Then 1 s proof hits: poster, laptop slide, phone post, a spoken claim. | "Check this out." Wearer: "Facto, can you check this?" HUD: **True · toureiffel.paris** |
| 1:05–1:30 | How it works | Line diagram: Ray-Ban Display → iPhone (Wearables Device Access Toolkit, on-device text recognition) → claim check → sourced answer in the lens | "The glasses see what you see. The phone reads the text, picks out the claim and checks it against real sources. The answer shows up in the lens, with the source." |
| 1:30–1:50 | Proof and restraint | A teammate tells a personal story: the HUD stays empty. Then a real number from `docs/evaluation.md`. | "Tell it about your own weekend and it stays quiet. It only checks public claims, and it says so when it can't verify one." |
| 1:50–2:00 | Close | Team on the sofa, all three in glasses, then the end card, then a blooper | "Facto. Get facts, not hunches." |

About 150 spoken words, under the runbook's 240–280 budget. That leaves room to breathe, which suits Meta's pace.

## Film now (Sat afternoon)

Sunset is about 15:45, so daylight shots go first. Nothing in the first block needs the final script.

**Before anything else (10 min)**

- [ ] Test **Display Recording** on the Ray-Ban Display while Facto is showing a result. Meta AI app: below Glasses, swipe the Translate/Captions banner, tap Record Display. Or on the glasses: left Settings panel, swipe down, Display Recording. Check whether it captures third-party Device Access Toolkit content and the camera view. If yes, it gives us Meta's through-the-lens shot for free. *Unverified for third-party apps.*
- [ ] Run "goldfish three seconds" and "Eiffel Tower 15 cm taller in summer" through the live pipeline. Note the exact source, wording and time.
- [ ] Check #44: does "Facto, can you check this?" trigger yet? If not, film the demo with the Neural Band or app trigger and change the line.

**Block 1: daylight, no script needed (14:15–15:45)**

1. **Phones-up montage**, 10–12 shots, 3 s each so the edit can trim to 1–1.5 s:
   - hand pulling a phone from a pocket mid-sentence
   - thumbs typing "is it true that…"
   - a table of four, everyone on their phone, nobody talking
   - a face lit by a phone screen while someone else keeps talking
   - a phone held up between two people to "prove" a point
   - scrolling past three search results fast
2. **Eyes-up counter-shot** ×3: the wearer in Ray-Ban Display keeps talking and laughing while the others reach for phones. A small glance up-right at the lens is enough.
3. **Glasses b-roll** like Meta's launch reel: putting them on, macro on the hinge and camera, glasses folded on the table next to a coffee, the Neural Band on a wrist doing the pinch.
4. **Hook takes** ×5: the table scene with the goldfish line, recorded on the ZV-1 and with Display Recording at the same time. Clap once on camera to sync.

**Block 2: indoors, after the pipeline check (15:45–17:30)**

5. **Demo master** ×3, uncut: wearer looks at a phone showing the Eiffel Tower post, asks, the result lands. ZV-1 over the shoulder at 1080/25p + Display Recording.
6. **Proof hits**, 1–2 s each with Display Recording on: a printed poster, a slide on a laptop, a label, a spoken claim.
7. **Restraint shot**: a teammate tells a personal story ("I ran 10 k this morning"), the HUD stays empty, the wearer shrugs.
8. **Talking head**, David's intro line ×3, at a window, ZV-1 with the mic in the camera.
9. **Reactions**: a teammate reading the HUD, small laugh, nod.
10. **Close**: the three of you on the sofa in glasses, then keep rolling for a blooper.
11. **Room tone**, 10 s per location.

**No camera needed (start now, in parallel)**

- Render the landing page's Blender camera path on a soft blue-grey gradient (B's look) at 1920×1080, 25 fps. One render feeds both the landing page and the 0:12 reveal.
- Build the Remotion pieces: caption style, rounded-vignette POV inset, the How-it-works diagram, the end card.

## Optional extra

Meta posts vertical first (A, C, D are all 9:16). After the 16:9 master, a 45-second 9:16 cut of hook + demo + end card costs about 30 minutes in Remotion and fits Meta's own feeds if anyone posts it.
