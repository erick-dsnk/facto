# De Facto landing — visual and interaction QA

**final result: passed**

Reviewed on 14 November 2026. Scope: the standalone landing page in `apps/landing`, built on branch `codex/de-facto-landing`.

## Source and comparison

- Source of truth: [approved De Facto Figma landing](https://www.figma.com/design/3vGnRQIZx0vo6eNf8p4ms3?node-id=5-607), supported by the approved concept at `/workspace/generated_images/exec-8b8a2b21-e4cd-491c-8b65-841083d200ed.png`.
- The user explicitly requested additional illustrations, depth, creative layouts, and visual iteration. Larger editorial type, the evidence trail, staggered illustrated panels, and the dark manifesto are intentional developments of that direction.
- [Combined source and implementation comparison](apps/landing/review/hero-comparison.webp): the source concept is 1487×1058; the implementation hero is 1440×1000 CSS pixels at device scale factor 1. Both are normalized to 700px wide without distortion in the comparison board. This compares art direction and hierarchy, not an identical UI state: the source is a concept board; the implementation adds website navigation and actions.
- Full-view evidence: [desktop](apps/landing/review/desktop-full.webp) and [mobile](apps/landing/review/mobile-full.webp).
- Focused evidence: [hero](apps/landing/review/desktop-hero.webp), [claim-to-source trail](apps/landing/review/desktop-trail.webp), [mobile result](apps/landing/review/mobile-demo.webp), and [320px result](apps/landing/review/narrow-demo.webp).

## Browser evidence

The built-in browser could not initialize, and the cloud preview relay timed out. Verification used actual local Chromium through Playwright, against the running Vite application at `http://127.0.0.1:4173/`. These are rendered-browser captures, not HTML mocks or build-only checks.

- Desktop: 1440×1000, plus 1100×1100 and 1920×1100 hero checks.
- Tablet: 834×1112 initial full layout and 834×1100 final hero.
- Mobile: 390×844.
- Narrow mobile: 320×740.
- All captures use device scale factor 1. Final presentation captures use reduced motion and no focused controls; interaction captures show the expanded example result.
- Full page and focused section captures were inspected. No horizontal viewport overflow, missing illustrations, clipped controls, or console errors remain in tested states.

## Iteration history

1. **Desktop hero art crowded the lead and actions (P1).** Moved the artwork lower, adjusted its scale, and tuned the tablet/wide-screen composition. Final hero checks show clear space around the main action and readable supporting copy.
2. **Mobile cuff crossed the evidence eyebrow (P2).** Added separation between the image and evidence panel. Final mobile layout preserves the intentional edge crop without covering text.
3. **Useful labels and explanatory copy were too small (P2).** Raised main explanatory copy to 14px and primary source labels to 11–12px. Small, spaced lettering remains only for secondary editorial markers and metadata.
4. **The middle repeated generic explanatory sections (P2).** Replaced the generic three-step row with an actual claim → NOAA excerpt → contradicted result sequence. Thin connectors, a gently rotated capture card, and staggered source/result cards add depth while keeping the content readable.
5. **Mobile illustration cards were too tall (P2).** Reduced illustration height and tightened internal padding while retaining readable copy and full-size actions.
6. **Mobile “Good questions” lost its word space (P2).** Inserted a real space where the desktop line break collapses. The dialog heading received the same correction.
7. **Result focus moved below the visible mobile dialog (P2).** Removed `preventScroll` when focusing the source action. A browser assertion now confirms that the focused link is fully visible inside the dialog at 320px and 390px. The dialog header stays visible while scrolling.

An independent final visual review found no remaining P1/P2 issues. An independent interaction review found no remaining material issue after the result-focus fix.

## Required visual surfaces

- **Typography:** self-hosted Cormorant Garamond and DM Sans match the approved system. Display/body hierarchy, italic roles, line wrapping, and mobile sizes were checked in rendered screenshots.
- **Spacing and layout:** responsive margins, card padding, alternating section rhythm, layered evidence card, staggered illustration panels, and narrow-screen stacking were inspected. Cropped sleeve edges are intentional; text and actions remain visible.
- **Color and tokens:** cream `#F3EDE2`, paper `#FBF7EF`, forest `#0C352A`, muted `#52685E`, and brass accents preserve the approved palette. Dark brass carries small accent text; lighter brass supplies decoration.
- **Image quality:** all three illustrations are real generated raster assets, locally served as transparent WebP files. They retain forest-green engraving and ivory highlights. Subject, transparency, crop, scale, and sharpness were checked on the page. Standard UI symbols come from Phosphor.
- **Copy:** launch-focused, concise, and source-led. The hero evidence panel remains sparse. The NOAA article responds successfully, and the trail uses a faithful excerpt. The interactive example is labeled as an example; it does not pretend to run an arbitrary live fact check.

## Interaction and accessibility checks

Actual Chromium checks passed at desktop, mobile, and 320px widths:

- Navigation links and mobile menu destinations.
- Menu and demo open/close, Escape dismissal, body scroll lock, and focus restoration.
- FAQ expansion and collapse.
- Arrow-key capture-tab navigation and correct selected/panel state.
- Example checking state, sourced result, reset, and source-link destination.
- Visible source-action focus after the mobile result expands.
- Reduced-motion presentation and locally loaded illustrations/fonts.
- No browser console or page errors.
- Axe WCAG 2 A/AA and 2.1 AA: **zero violations** on the landing and expanded demo in all three tested viewports. Details: [verification.json](apps/landing/review/verification.json).

Audible speech output depends on the visitor's browser/OS voices; physical speaker playback was not verified in headless Chromium. The source link remains available, and speech failures announce a fallback message. This does not block the primary example flow.

## Build checks

- `npm run build` in `apps/landing`: passed.
- Root `npm run check`: lint passed, TypeScript passed, **171 tests across 12 files passed**.
- Backend, shared contracts, native app, and existing console are unchanged.

## Follow-up polish

No remaining P0/P1/P2 design findings. Preview is left running locally. Production deployment and native camera/audio integration are outside this landing-page implementation.
