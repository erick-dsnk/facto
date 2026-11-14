# Glasses V4 design QA

The final HUD closely reproduces the supplied True, Searching and False examples at the component level: capture label, two-line claim, gray result surface or compact searching pill, colored status, metadata, two-line quote, publisher, and no buttons. It is **not a pixel-perfect reproduction of the whole glasses photograph**. Text rasterization and some glyph widths remain different, and the physical lens photo does not define a 600 × 600 display boundary.

## Reference and normalization

Original screenshots are 3420 × 2224 pixels. Independent pixel measurements isolate the HUD at original coordinates **x1305, y970, width856, height576**. Rendering that region at half scale yields a **428 × 288** comparison frame; the result card within it is **428 × 172**, with an approximately **20 px radius** and **19 px horizontal padding**. The search pill measures **201 × 39.5** at this scale.

The ½ scale preserves the reference's apparent Retina component sizing. It is an explicit mapping assumption, not a measured optical mapping between the decorative lens and the native display. Normalizing the full non-square physical lens to 600 would instead produce a roughly 302 px card and 11 px caption; that different scale was not used. The slight perspective on the reference card is not reproduced as a distortion in the real HUD.

Reference copies are preserved unchanged in `artifacts/glasses-ui-v4/reference/`. Their geometry and sampled RGB values are recorded in `reference-measurements.json`.

## Final measured comparison

| Measurement | Reference at ½ image scale | Final implementation | Difference |
|---|---:|---:|---:|
| Result card | 428 × 172 px | 427.997 × 171.989 CSS px | < 0.02 px |
| Search pill | 201 × 39.5 px | 200.994 × 40 CSS px | −0.006 px width; +0.5 px height |
| Card fill | #4c4f5a dominant | #4c4f5a computed | Same RGB |
| True / False | #99b3a0 / #bf9092 | #99b3a0 / #bf9092 | Same RGB |
| Caption glyph top | 3 px | 3 px | 0 px |
| Claim glyph top | 40.5 px | 40 px | −0.5 px |
| True claim, first-line ink width | 344.5 px | 340 px | −1.3% |
| False claim, first-line ink width | 366.5 px | 370 px | +1.0% |
| True quote, first-line ink width | 331 px | 335 px | +1.2% |
| False quote, first-line ink width | 306 px | 315 px | +2.9% |
| True publisher ink width | 126 px | 132 px | +4.8% |
| True colored heading ink extent | 69 × 16.5 px | 69 × 17 px | Same width; +0.5 px height |

Ink widths and positions come from light-pixel projections on the supplied PNGs and final controlled JPEG captures. JPEG compression, anti-aliasing and threshold choice affect bounds by roughly one or two pixels. Geometric CSS values come from final DOM readback. The figures establish a close measured match; they do not justify an overall pixel-perfect claim.

## Typography and final rendering

The final shared style uses SF Pro Text: claim 26/34 at weight450, result status24/27 at600, quote22/29 at400, publisher19/24 at500, and caption16/20 at450. CDP resolved the actual claim to **SFProText-Medium**, quote to **SFProText-Regular**, and publisher to **SFProText-Medium**; no generic fallback explanation is asserted.

The final quote widths improved from +3.3%/+5.9% to +1.2%/+2.9% for True/False. A tested SF Pro Display alternative was substantially narrower than the reference and was rejected. There are no per-fixture text stretches or individual-string geometry rules. Some quote and publisher ink remains about 1–3 px below the measured reference position; publisher width differs by about4.8% in the True example.

## Actual simulator verification

All three final controlled renders and five final official simulator renders were independently viewed. Text, line breaks, publisher, badges and status match the requested examples; no clipping, overflowing content, partial surfaces or app buttons were seen. Actual simulator captures cover Cafe True/Searching/False and False over Bridge/Station. The simulator's additive output makes the gray card lighter over the environment; this is intentionally documented separately from the controlled dark-lens comparison.

The primary operator observed the same-page Searching → True demo and the300 ms width/height/padding/radius transition. Still images alone do not prove motion timing or hardware smoothness. Integrations and fact content remain mocked. No hardware optical, brightness or usability result is claimed.

## Evidence

- `artifacts/glasses-ui-v4/comparison.html`: side-by-side CSS framing of untouched reference images and final controlled captures.
- `artifacts/glasses-ui-v4/gallery.html`: all eight final implementation captures.
- `artifacts/glasses-ui-v4/final-result-evidence.json` and `final-searching-evidence.json`: final CSS geometry, fonts, colors and zero-button readback.
- `artifacts/glasses-ui-v4/resolved-fonts.json`: actual resolved font faces.
- `artifacts/glasses-ui-v4/controlled-pixel-measurements.json`: final image measurements.
