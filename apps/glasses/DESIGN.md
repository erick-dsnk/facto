---
name: Actually screenshot HUD
description: Captured claim with a filled result card or compact searching pill
colors:
  canvas: "#000000"
  reference-lens: "#292c38"
  surface: "#4c4f5a"
  primary-text: "#efeeed"
  quote: "#d1d1d7"
  secondary: "#b5b6b8"
  metadata: "#c8c8d1"
  true: "#99b3a0"
  false: "#bf9092"
typography:
  capture:
    fontSize: "16px"
    fontWeight: 450
    lineHeight: "20px"
  claim:
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", "Segoe UI", sans-serif'
    fontSize: "26px"
    fontWeight: 450
    lineHeight: "34px"
    letterSpacing: "-0.45px"
  verdict:
    fontSize: "24px"
    fontWeight: 600
    lineHeight: "27px"
  quote:
    fontSize: "22px"
    fontWeight: 400
    lineHeight: "29px"
  publisher:
    fontSize: "19px"
    fontWeight: 500
    lineHeight: "24px"
rounded:
  card: "20px"
  searching: "22px"
components:
  result-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.quote}"
    rounded: "{rounded.card}"
    padding: "18px 19px"
    width: "428px"
    height: "172px"
  searching-pill:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.quote}"
    rounded: "{rounded.searching}"
    padding: "7px 14px"
    width: "161–269px, based on arrived sources"
    height: "40px"
---

# Design System: Actually screenshot HUD

## Overview

**Creative North Star: "The supplied lens interface"**

The user's latest three screenshots are the visual authority. They explicitly restore a muted capture label, a two-line claim and a filled gray result card. The result has a colored dot and verdict, metadata, a short quoted correction and publisher. Searching is a compact gray pill. No conventional wearable buttons accompany either state.

**Key Characteristics:**

- Exact supplied content and line breaks.
- A clearly filled neutral-gray surface.
- Muted True/False color confined to the verdict.

## Colors

Card fill and text colors were sampled from the original full-resolution screenshots. The filled surface has no luminous outline, translucent hollow treatment or backdrop blur. The controlled reference lens is outside the wearable display layer. Its normal composition is deliberately separate from additive simulator composition.

## Typography

The screenshot interface uses Apple platform type. The system stack resolves to SF Pro Text in the actual comparison browser. The quote uses regular weight, the publisher uses medium weight, and the verdict is stronger. Claim, quote and metadata each have distinct sizes and weights. Explicit two-line breaks match the examples. Platform rasterization can vary; comparative screenshots must identify their scale.

## Layout

The logical wearable surface is 600 × 600. The HUD starts at x 86, y 220. Its component is 428px wide. Within that component the filled result starts at y 116 and is 172px high. Capture and claim are inset 3px from the card's edge. The searching pill shares the card's top anchor. These component measurements use a Retina-2 interpretation of the user's 3420 × 2224 source images, not a guessed optical display boundary.

## Elevation & Depth

The card uses a solid fill, without border, shadow or backdrop blur. A 300ms exponential ease changes the same surface between searching and result geometry. New source badges take a 320ms slot expansion and 380ms opacity/scale entrance, keeping previous sites anchored. The result surface uses a restrained 420ms pop from 96.5% scale with 7px of settle; detail text follows after 70ms. The final geometry and colors remain those of the supplied reference. Reduced motion renders state changes immediately.

## Shapes

The result is a softly rounded rectangle. Searching is a compact pill. Small filled dots convey capture and result status. The T/B letter badges retain the reference's source marks, now laid side by side with 5px gaps. W/S demonstrate further publication arrivals. The pill grows from 161 to 269px as up to four sites arrive.

## Components

Capture label sits above the claim. The result header combines dot, verdict and muted metadata. Quote and publisher follow. The searching header substitutes a gray dot, “Searching...” and the arriving publication badges. External preview controls can replay Searching → True on the same Eiffel Tower fixture. The wearable interface has no actions or custom key interception.

## Do's and Don'ts

- Do compare True, Searching and False against their corresponding source images.
- Do preserve the supplied line breaks, metadata and publishers.
- Do keep the gray card filled and readable.
- Don't reintroduce View source, Dismiss or other conventional wearable buttons.
- Don't put the glasses photograph or marketing page into the wearable display.
- Don't claim exact optical color reproduction from normal CSS composition.

## Search motion

The focal sequence makes retrieval progress legible: each newly found publication takes its own place, then the compact search surface becomes the evidence result. Earlier icons stay anchored. There is no continuous icon carousel or forced wait for animations; the 4.2-second duration belongs only to the mock demo. All timers clean up on cancellation/replay/unmount, with no animation dependency added. A future event stream should supply source identities to `SearchSources` as sites are discovered, rather than replaying the mock clock.
