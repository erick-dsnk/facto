# Facto glasses UI

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
| `/?display=1&state=searching` | Same Eiffel Tower claim; staged overlapping source badges |
| `/?display=1&state=false` | Goldfish False fixture |
| `/?display=1&state=listening` | Brief Listening action popup fixture |
| `/?display=1&state=checking-action` | Brief Check this action popup fixture |
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

Searching retains that exact claim and shows “Searching...” with publication badges arriving in a slightly overlapping row. The T/B marks from the supplied reference begin a four-site illustrative sequence; W/S follow. These are website/publication marks, not a claim that a search provider such as Exa is an evidence source. False reads “Heard nearby,” then the supplied goldfish claim, “False · 3 of 3 sources disagree,” its correction quote and “Live Science.” Explicit line breaks preserve the supplied layouts.

There are no conventional buttons, links or focus targets on the wearable HUD. The external Replay control runs a mock transition from Searching to True after 4.2 seconds. Four source badges arrive at 280, 980, 1680 and 2380ms, each growing into its own slot while fading and scaling into place. The pill expands smoothly, without moving earlier badges; 22px marks overlap by 4px, with newer marks on top. The shared surface morphs into the 428 × 172 result, which pops into view over 420ms; its details settle in just afterward. Direct result routes use the same entry. The opt-in `demo=1` query starts the sequence on mount on either display or inspection routes. The static Searching route shows the badge arrivals and remains searching; result routes retain their original content. `listening` and `checking-action` are brief fixture popups lasting 1.4 s and 1.1 s, respectively. Every timer clears on state change, replay or unmount. Reduced motion shows each state immediately without spatial animation or pulsing.

## Measured geometry

The source screenshots are 3420 × 2224 pixels. The extracted HUD region `(1305, 970, 856, 576)` is normalized at an assumed Retina scale of 2 to a 428 × 288 CSS component. This matches component proportions; it does not infer a 600-pixel display boundary from the photographed lens.

| Element | CSS measurement |
| --- | --- |
| HUD placement in the logical display | x 86, y 220 |
| Result card | 428 × 172; 20px radius; padding 18px 19px |
| Card top relative to HUD | 116px |
| Searching pill | 161–242 × 40 as sources arrive; 22px radius |
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

Demo content and source counts are visual fixtures. Source arrival timings and the four publication badges are illustrative UI progress, not live backend events. `SearchSources` accepts a keyed `SearchSource[]` (id, label, mark, color), deduplicates sites and displays at most four badges. `useDemoSources` is the fixture's mock driver; the optional live observer feeds actual backend progress into the same source component. Retrieval provider names belong to search-status metadata; these badges identify candidate publications/websites. Fixture routes do not connect capture, evidence retrieval or hardware integration. Native SwiftUI/DAT is the default companion display, documented in `apps/ios/README.md`.

## Live companion observer

`/display/?live=1` (the API-served optional Web App path) or `/?display=1&live=1` (Vite preview) connects as a read-only observer. Native DAT in the iOS companion remains the default production glasses display. The companion creates a short-lived display grant and opens the URL with `sessionId`, `displayToken` and API **origin** in its fragment. The page consumes and removes that fragment before rendering, retaining credentials only in memory. It does not put the grant in query strings, logs, local/session storage or controller requests. Reloading requires a fresh companion link. Opening a fresh link in the same page also works: a hash-change consumes the new fragment, closes the prior observer and resets the visible session before connecting. HTTPS API origins and loopback HTTP are accepted; credentials, paths and query parameters in the API origin are rejected.

The browser connects only to `/v1/sessions/:id/display-stream` with WebSocket subprotocols `facto-display-v1` and `display.<token>`. It never opens the companion controller `/stream` socket and sends no controller messages. A connection starts with a shared-schema `display.snapshot`; reconnect replaces the visible projection instead of replaying retained results or their entry animation. Session/epoch/sequence/revision correlation guards discard stale frames; cancellation, supersession, disconnect, expiry and paused/ended sessions clear the visible HUD. Transient disconnects retry with bounded backoff; rejected, rotated, expired or revoked grants require a new link.

Live source badges come directly from correlated `claim.sources` events. They use the actual hostname initial, preserve site identity across reading-stage updates and show at most four overlapping marks. There are no mock arrival timers in this mode. Exa is retrieval metadata, not an evidentiary publisher. Manual checking may appear; automatic checking remains silent. A brief Checking popup appears for a live user-initiated check; the observer does not expose listening state, so Listening is a fixture popup here. Only non-silent, unexpired results are presented.

The result uses the actual backend verdict, explanation and selected evidence publisher (or hostname), with the established card geometry. Claim and explanation are capped visually at two lines and publisher at one line. There is no overall confidence value in `ClaimResult`, so the UI does not invent a confidence percentage. A result without capture-mode metadata uses the neutral “Claim checked” caption. With no valid grant the display shows a quiet “Connect from companion” status, without wearable buttons.

The backend now reports `claim.sources` during retrieval and page enrichment, alongside claim checking/results. The demo routes remain explicit fixtures and are not live provider proof. Display grants expire after about five minutes; session renewal currently requires a fresh companion link. Read-only observer protocol checks do not prove companion/device coexistence on physical glasses. No deployment has been performed by this UI work.

Focused checks: `npx vitest run apps/glasses/src/liveModel.test.ts apps/glasses/src/displayConnection.test.ts`, `npm run check:glasses`, `npm run build:glasses`. The reducer tests cover presentation filtering, stale/uncorrelated frames, revision cancellation, newer epochs, expiry and reconnect restoration. Connection tests cover grant/API validation, observer-only protocols, snapshot gating, retry, socket-construction failure, fresh-link replacement and cleanup. Vite emits relative assets (`base: './'`) to `dist/glasses` for same-origin serving at `/display/`.
