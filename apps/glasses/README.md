# Actually glasses UI

A fixture-only Meta Ray-Ban Display HUD using the official `@wearables-ui-toolkit/mrbd` App. The current target is the user's three screenshots dated 14 November 2026 at 16:32:18, 16:32:26 and 16:32:28. Their capture label, two-line claim, filled result card and compact searching pill replace the earlier single-sentence popup.

## Run and inspect

```sh
npm ci
npm run dev:glasses
npm run build:glasses
```

The existing Vite server uses port 3030.

| Route | Purpose |
| --- | --- |
| `/?display=1&state=true` | Black additive display; Eiffel Tower True fixture |
| `/?display=1&state=searching` | Same Eiffel Tower claim; staged source badge arrivals |
| `/?display=1&state=false` | Goldfish False fixture |
| `/?inspect=1&state=true` | Fixed 600 × 600 CSS comparison surface over a flat dark lens |
| `/?inspect=1&state=searching` | Searching comparison |
| `/?inspect=1&state=false` | False comparison |
| `/?display=1&demo=1` | Opt-in Searching → True transition on the actual display route |
| `/?inspect=1&demo=1` | The same transition on the reference comparison surface |
| `/` | External state, background and replay controls |

The `display` route contains only the HUD and a black additive canvas. The `inspect` route is a controlled reference comparison with an external `#292c38` background, ordinary CSS composition and a fixed 600 × 600 logical surface. It is not a simulator or world scene. The external studio defaults to that reference background and clearly labels it. Other studio backgrounds use screen blending as basic additive previews.

Legacy `supported`/`context` routes map to True, `checking`/`scanning`/`detected`/`listening` to Searching, and `source`/`contradicted` to False. `ready`/`dismissed` are empty. Other old states fall back to the False fixture; these are visual examples rather than live outcomes.

## Reference content

True reads “Read from screen,” then “The Eiffel Tower grows up to / 15 cm taller in summer.” Its card reads “True · official site,” the supplied two-line expansion quote and `toureiffel.paris`.

Searching retains that exact claim and shows “Searching...” with publication badges arriving side by side. The T/B marks from the supplied reference begin a four-site illustrative sequence; W/S follow. These are website/publication marks, not a claim that a search provider such as Exa is an evidence source. False reads “Heard nearby,” then the supplied goldfish claim, “False · 3 of 3 sources disagree,” its correction quote and “Live Science.” Explicit line breaks preserve the supplied layouts.

There are no conventional buttons, links or focus targets on the wearable HUD. The external Replay control runs a mock transition from Searching to True after 4.2 seconds. Four source badges arrive at 280, 980, 1680 and 2380ms, each growing into its own slot while fading and scaling into place. The pill expands smoothly, without moving earlier badges. The shared surface morphs into the 428 × 172 result, which pops into view over 420ms; its details settle in just afterward. Direct result routes use the same entry. The opt-in `demo=1` query starts the sequence on mount on either display or inspection routes. The static Searching route shows the badge arrivals and remains searching; result routes retain their original content. Every timer clears on state change, replay or unmount. Reduced motion shows each state immediately without spatial animation or pulsing.

## Measured geometry

The source screenshots are 3420 × 2224 pixels. The extracted HUD region `(1305, 970, 856, 576)` is normalized at an assumed Retina scale of 2 to a 428 × 288 CSS component. This matches component proportions; it does not infer a 600-pixel display boundary from the photographed lens.

| Element | CSS measurement |
| --- | --- |
| HUD placement in the logical display | x 86, y 220 |
| Result card | 428 × 172; 20px radius; padding 18px 19px |
| Card top relative to HUD | 116px |
| Searching pill | 161–269 × 40 as sources arrive; 22px radius |
| Capture label | 16px / 20px |
| Claim | 26px / 34px; explicit two lines |
| Verdict / metadata | 24px / 20px |
| Quote | 22px / 29px; explicit two lines |
| Publisher | 19px / 24px |
| Card and pill fill | `#4c4f5a`, solid, with no border or blur |
| True / False | `#99b3a0` / `#bf9092` |

The system font stack resolves to SF Pro Text in the actual comparison browser. Claim, verdict, quote and publisher use their measured size hierarchy; quote weight is regular and publisher weight is medium. A fixed inspection surface avoids the display route's intentional fit-to-viewport scaling during comparison.

## Verification and limits

`npm run build:glasses` runs the isolated TypeScript check and production build. `npm run check` is the repository gate. Browser and simulator captures must identify which surface was used. Earlier `artifacts/glasses-ui*` revisions are superseded by this screenshot-based version; their QA results do not validate it.

The official simulator composites the app with screen blending. A solid gray card emits light over its synthetic scene; its resulting color depends on that scene. The normal-composition inspection can match the screenshot's card RGB, while actual simulator composition must be checked separately. Black emits no light on additive glasses. This UI cannot physically darken the wearer's real field of view.

All content and source counts are visual fixtures. Source arrival timings and the four publication badges are illustrative UI progress, not live backend events. `SearchSources` accepts a keyed `SearchSource[]` (id, label, mark, color), deduplicates sites and displays at most four badges. `useDemoSources` is a separate mock driver, so a future backend progress stream can replace it without changing the visual component. Retrieval provider names belong to search-status metadata; these badges identify candidate publications/websites. No live progress bridge has been added. No capture, evidence retrieval, source loading or hardware integration is connected. The native SwiftUI/DAT architecture remains in `docs/plan.md`.

### Backend progress status

The current backend stream reports claim-level `claim.checking` and `claim.result`; it does not yet emit source-by-source retrieval progress. Exa retrieval yields a batch, followed by up to three sequential page-enrichment fetches. Live badges therefore need an additional progress event carrying candidate site identity as those stages run. The present animation accepts site data but deliberately uses a mock driver; it is not synchronized to backend work.
