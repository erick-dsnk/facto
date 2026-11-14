# Submission video pipeline

How we shoot, cut and ship the ~2:00 submission video by **Sun 15 Nov, 10:00** (upload by 09:00). Claude runs the pipeline, and a human signs off at five gates.

Open `runbook.html` in a browser for the full version, with commands, Omni prompts, camera settings and the schedule. This file is the short version.

**Read `meta-style.md` first.** It moves the look toward Meta's own glasses videos, revises the beat sheet and lists what to film on Saturday afternoon. Where it disagrees with this file, it wins.

## Locked decisions

| | |
|---|---|
| Output | 1920×1080, **25 fps everywhere** (50 Hz mains in Finland, so venue lights flicker at 24/30), H.264, -14 LUFS |
| Shape | Talking heads + centred captions + zoomed product demo + a few AI hero cutaways |
| Assembly | Remotion renders the whole film from `edl.json`. Claude edits JSON, never a timeline. |
| Pop-ups | Remotion components triggered by Whisper word timestamps (`cues.json`) |
| Gemini Omni | Hero shots only, from text or from stills with no people in them. **Editing uploaded video is blocked in the EEA**, so it can't touch our footage. |
| Camera | Sony ZV-1 + mic plugged into the camera: 1080/25p (PAL), 1/50, widest aperture, PP off, custom white balance |

## What the references do (measured)

| | X @wordisbonz "episode 1" | IG @farza954 "buddy for your cursor" |
|---|---|---|
| Format | 16:9, 30 fps, 1:30 | 9:16, 30 fps, 0:55 |
| Cuts | 62, one every **1.4 s** | 31, one every **1.8 s** |
| Hook | Character intro, street/club shots | Founder to camera + "2.8M views" proof screenshot |
| Product shows up | ~0:45 | ~0:12 |
| Text | Small subtitle, lower centre | Bold white, 2–4 words, centre of frame |
| Screens | Filmed with the camera, macro, shallow focus | UI pushed in 2–4×, blurred edges, product's cursor animated over real apps |
| Cutaways | B&W archive footage, lips close-up | Desert sky with cursor, wall of tweets |
| Ending | "Comment and I'll send you the link" | Overhead on the rug, CTA, blooper |

Cut timestamps are in `refs/*.cuts.txt`.

**Takeaways:** captions are the main text layer (only 3–5 real pop-ups). Animate the product's own visual over zoomed UI. Film the laptop screen with the ZV-1 as well as recording it. Cut every ~1.5 s in montages. Show proof. End on personality. Omni shots are 1–2 s metaphor cutaways.

## Beat sheet (2:00)

Rebuilt from a teardown of 13 AI launch videos and Farza's YC interview. Read `launch-teardowns/SYNTHESIS.md` first.

| Time | Beat |
|---|---|
| 0:00–0:03 | Hook: moving first frame, product handed to the lens, hook line |
| 0:03–0:12 | Who we are + what's going on, one proof card |
| 0:12–0:15 | 0.4 s audio dip → product name, music hits |
| 0:15–0:35 | Problem as our own: list-of-three, 1 s shots, B&W, 1–2 Omni cutaways sharing one motif |
| 0:35–1:05 | "Check this out": one 10–15 s uncut demo, then 1 s proof in 4–5 contexts, colour back |
| 1:05–1:30 | How it works: line-art architecture + one tech line |
| 1:30–1:50 | Proof: before → after, real number, reaction |
| 1:50–2:00 | Team two-shot, URL, blooper |

## Pipeline and gates

1. **G1 Script.** About 240–280 spoken words, lines tagged `[TALK]`, `[DEMO]`, `[HERO]` or `[POPUP]`. Claude also builds a teleprompter page.
2. **G2 Takes.** Conform everything to 1080p25 CFR with ffmpeg. `mlx_whisper` produces word timestamps. A take picker scores each take against the script with rapidfuzz and writes `edl.json`.
3. **G3 Rough cut.** Remotion preview from `edl.json`, with no pop-ups yet.
4. **G4 Pop-ups and look.** Claude writes `cues.json` keyed to spoken words. Add LUT, grain and vignette over everything.
5. **G5 Final.** `npx remotion render`, loudnorm to -14 LUFS, upload, test the link in incognito.

Feedback format: `s3@0:04 cut 0.5s`, `s2 swap take B`, `popup2 bigger`.

**Panic mode (~15 min):** ffmpeg concat of the picked takes + music + burned-in SRT + loudnorm. No pop-ups or hero shots.

## Schedule

| When | What |
|---|---|
| Thu night | Dry run on dummy footage, end to end |
| Fri | Build the Remotion project, ingest scripts, take picker. Pick music/SFX (Pixabay, YouTube Audio Library). |
| Sat 09–12 | G1 script + generate Omni hero shots |
| Sat 12–14 | Record the demo (twice) |
| Sat 14–17:30 | Talking heads + b-roll (sunset ~15:45) |
| Sat 18–24 | G2 → G3 → G4 |
| Sun 07–09 | G5, master, upload |

## Still to check

- Camera model (ZV-1 / ZV-1 II / ZV-E10), and that 1080/25p shows after switching to PAL
- Junction submission rules: file or link, size cap, exact deadline
- One Omni text-to-video test: quality, fps, visible watermark
- Hook style: character story (X) or founder + proof (IG). Founder + proof reaches the product faster.

The camera settings, ffmpeg recipes and pacing numbers come from model knowledge and weren't checked live. The Omni and Remotion facts were checked against the [Gemini Omni docs](https://aistudio.google.com/docs/omni) and the [Remotion skills docs](https://www.remotion.dev/docs/ai/skills).
