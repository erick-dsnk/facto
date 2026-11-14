# De Facto landing page

A standalone, responsive product landing page based on the approved De Facto design direction and [Figma system](https://www.figma.com/design/3vGnRQIZx0vo6eNf8p4ms3?node-id=5-607).

## Run

From this directory:

```sh
npm ci
npm run dev -- --host 0.0.0.0 --port 4173
```

Open `http://localhost:4173`. No API keys or environment variables are required.

```sh
npm run build
npm run preview -- --port 4173
```

The production build is written to `../../dist/landing`. Serve that directory with any static host. The existing API and console are unchanged.

## Design and behavior

- Cream, forest green, and brass; self-hosted Cormorant Garamond and DM Sans.
- Three original engraved illustrations: hand and glasses, magnifier and book, sculpted ear. Optimized transparent WebP assets total approximately 876 KiB.
- Responsive layouts from 320px through wide desktop, a connected evidence trail, layered source card, staggered illustration panels, and a dark editorial section.
- Native navigation and demo dialogs, keyboard-operable capture tabs, a sourced example result, FAQ disclosures, and optional browser speech synthesis.
- Reduced-motion support, visible focus, Escape dismissal, focus restoration, and an accessible skip link.

The interactive example uses a curated NOAA claim to demonstrate the experience. It does not send audio, capture images, or invoke the fact-checking backend. Source links open NOAA’s original article. Production camera and audio integration belongs in the native app, as described in `docs/plan.md`.

## Implementation

`index.html` owns the semantic page, `src/style.css` owns the responsive design tokens and layouts, and `src/main.js` owns the small interaction layer. All fonts, icons, and illustrations are served locally; there are no runtime Figma URLs or remote CDN dependencies.

Vite supplies the development server and static production build. Fontsource packages make the selected typefaces reproducible and self-hosted. Phosphor provides a consistent UI icon family; illustrations are raster assets generated specifically for this design.

Run the repository’s `npm run check` from its root for lint, TypeScript checks, and the existing application tests. Visual and interaction review evidence is documented in the root `design-qa.md`.
