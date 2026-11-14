# Glasses Lab

A test bench for the Meta Wearables Device Access Toolkit (DAT) 1.0.1 on iOS. It connects to Meta AI, streams the glasses camera with a frame-rate meter, drives the Meta Ray-Ban Display screen, and can simulate glasses with MockDeviceKit.

## Before the first build

1. **Meta AI app:** glasses paired, firmware current. Turn on Developer Mode: Settings > App Info, tap the app version 5 times, then flip the toggle.
2. **Xcode 26.4 or later**, signed in with the Apple account for team `97JCVP9322`. Camera streaming needs a paid team because the app uses the Hotspot Configuration and Wi-Fi Info entitlements.
3. **iPhone:** connected by cable or on the same Wi-Fi as the Mac, unlocked, with Developer Mode on.

## Build and run

```sh
cd apps/ios
xcodegen generate        # rerun after editing project.yml
open GlassesLab.xcodeproj
```

In Xcode, pick your iPhone and press Run. The first build downloads the SDK package.

From the terminal instead:

```sh
xcodebuild -project GlassesLab.xcodeproj -scheme GlassesLab \
  -destination 'platform=iOS,name=David' -allowProvisioningUpdates build
```

## Tests

`GlassesLabTests` decodes the contract v1 golden files. `GlassesLabTests/Fixtures` is a copy of `packages/contracts/fixtures`; refresh it when the contract changes.

```sh
xcodebuild test -project GlassesLab.xcodeproj -scheme GlassesLab \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5' -parallel-testing-enabled NO
```

Live-pipeline code lives in `GlassesLab/Contracts` (wire types), `GlassesLab/Pipeline` (protocols between modules), `Networking`, `Audio`, `Capture` and `Output`.

## Deploy without Xcode

```sh
cd apps/ios
scripts/deploy.sh           # build, install and launch on the connected iPhone (~20 s)
scripts/deploy.sh --logs    # same, then stream the app's console output
scripts/deploy.sh --watch   # redeploy whenever a Swift file or project.yml changes
```

Keep the iPhone **unlocked and plugged in by cable**. During a glasses stream the phone joins the glasses' Wi-Fi, so the Mac can't reach it over the network. `DEVICE=<UDID>` picks a specific phone.

## Using it

1. **Connect to Meta AI.** The Meta AI app opens and asks you to approve Glasses Lab, then sends you back. The app appears under Meta AI > App connections > Developer mode apps.
2. **Start session**, then **Start stream.** The first stream asks for camera permission in Meta AI.
3. **Measure.** The camera section shows the measured frame rate, the longest gap between frames, and the frame size. For delay, look at the millisecond clock through the glasses while streaming and take a screenshot: the clock in the preview minus the live clock is the camera-to-app delay.
4. **Display.** With Meta Ray-Ban Display glasses, or the simulated Display, tap **Connect display**. A screen with a button appears on the glasses; taps come back to the app.

### Live mode

The **Live** sections at the top run the product flow against services/api. The code is in `GlassesLab/Live`: `LiveModel` wires `BackendClient`, `AudioStreamer`, `LookAndCheckCoordinator` and `ResultPresenter` to the camera and display models.

1. Connect to Meta AI (section 1) once.
2. Enter the **backend URL** and **join code**, then tap **Connect**. The URL is saved in UserDefaults and the join code in the Keychain. On the iPhone use the Railway `https://` URL: while the glasses stream, the phone is on the glasses' Wi-Fi and reaches the backend over mobile data. Plain `http://` is accepted only for localhost and private network addresses, so `http://localhost:3000` works from the simulator.
3. **Start listening** starts the device session and the stream with glasses mic audio, then streams 16 kHz PCM16 to the backend. **Demo quality** picks High 720×1280 at 30 fps; off, it picks Low 360×640 at 15 fps for long listening. It applies when the stream starts. Stop the stream to change it, because the app never stops a stream on its own.
4. **Check this**, or saying "check this" (the backend's `capture.request`), takes a photo from the running stream with `stream.capturePhoto(format: .jpeg)`. The phone reads it with Vision and sends the text. The stream never pauses.
5. Results speak (`respond`), chime (`notify`) or go to history only (`silent`). The **lens mirror** shows the same card the Display glasses get when the display is connected (section 4). **Mute** silences speech and chimes but keeps cards and history.

The status line has its own state for listening, reconnecting, stopped with a reason (glasses disconnected, no connection, session ended) and backend errors, so a broken connection never looks like "no alerts". A drop under 5 s resumes with a quiet chime; a ping every 2 s catches a connection that died without an error. Longer drops stop listening with a spoken reason. A check the user asked for always gets an answer: a verdict, "I'm not sure what was read", or after 15 s with no result, "The check didn't finish". A photo split into several requests gets one answer.

Backend sessions end 5 minutes after Connect. Live mode then opens a new session with the same join code and resumes listening (at most once a minute). **Automatic alerts** (on by default) sends `session.preferences` so the backend may chime for a contradicted claim it hears. The phone stays awake while listening: keep Glasses Lab in the foreground, because iOS suspends the socket and audio pipeline of a locked or backgrounded app.

`LiveModelTests` covers the wiring with fakes. `LiveModelLiveTests` runs the same flow against a real backend and is skipped unless `TEST_RUNNER_BACKEND_LIVE_URL` and `TEST_RUNNER_BACKEND_LIVE_JOIN_CODE` are set (see `BackendClientLiveTests`). In fixture mode the backend checks only fixture sources, so a photo check comes back as "The check didn't finish".

### Wake phrase: “Hey Facto”

**Wake on “Hey Facto”** (off by default) keeps the app idle until it is asked. With it on and the backend connected:

- The glasses stream is off and no audio or text is sent to the backend. The phone listens on the glasses' Bluetooth hands-free microphone (the phone's own microphone if the glasses aren't the active headset) and runs a keyword detector on the phone. Audio is processed in memory and dropped.
- **“Hey Facto”** plays a chime, starts the stream and listens for 60 s, then stops the stream, ends the device session and waits again. The decision takes about 1.5 s, because the detector waits to hear whether “check this” follows.
- **“Hey Facto, check this”** takes a photo and checks what is in view, like the Check this button, then stops the stream. “Check this” on its own does nothing while waiting.
- Starting to listen by hand, or a running stream, pauses the detector; the status row under the switch says why.

The detector is [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) keyword spotting (Apache-2.0) with the open-vocabulary English model `sherpa-onnx-kws-zipformer-gigaspeech-3.3M-2024-01-01` (int8, about 5 MB, in `GlassesLab/WakeWord/Model`). The phrases are the two `*-keywords.txt` files there: the model's BPE tokens, a boost after `:` and a trigger threshold after `#`. To change a phrase, tokenise it with the model's `bpe.model` (`sherpa-onnx-cli text2token`) and retune the two numbers against recordings.

The two prebuilt libraries it links (sherpa-onnx 2.0.1 and onnxruntime 1.28.2, about 47 MB) are not in git. `scripts/fetch-wake-word-libs.sh` downloads them into `Vendor/` and checks their SHA-256; `xcodegen generate` and `scripts/deploy.sh` run it for you. Use the model archive without `-mobile` in its name: the `-mobile` one fails in this runtime.

`WakeWordDetectorTests` runs the real model on synthesised speech in six voices (`GlassesLabTests/Fixtures/WakeWord`). Not yet tested: real voices through the glasses microphone, noisy rooms, and waiting with the phone locked (the `audio` background mode is declared for it).

### Without glasses

Section 2 pairs simulated glasses through MockDeviceKit. The phone's back camera becomes the glasses camera. Choose **Meta Ray-Ban Display** to see the rendered display screen inside the app.

## Stream quality: Wi-Fi, not Bluetooth

The SDK picks the video link from Info.plist. With the External Accessory keys (`UISupportedExternalAccessoryProtocols`, `external-accessory` background mode) it streams over Bluetooth Classic, which is heavily compressed and mostly stuck at 504×896. Without them it streams over a Wi-Fi network the glasses create, and holds 720×1280 at 30 fps. `project.yml` leaves the External Accessory keys out on purpose; don't add them back. Sources: Meta's replies in [issue #376](https://github.com/meta/meta-wearables-dat-ios/issues/376) and [discussion #297](https://github.com/meta/meta-wearables-dat-ios/discussions/297).

- When a stream starts, the iPhone joins the glasses' Wi-Fi network, so it has no Wi-Fi internet during the stream. Cloud AI calls go over mobile data.
- Allow **Local Network** for Glasses Lab (Settings > Privacy & Security > Local Network). If it's denied, the SDK silently streams nothing.
- If frames don't arrive: forget old "RB Meta…" networks in iPhone Wi-Fi settings, turn off Auto-Join for the venue network, and dismiss any "Unable to join" alert quickly.

## Known issues to plan around

- A single touchpad tap pauses an active stream; tap again to resume.
- Developer Mode can switch off after a firmware update.
- Registration needs internet.
- Bluetooth bandwidth limits the stream. The SDK lowers resolution first, then frame rate, never below 15 fps. Lower settings give cleaner frames.

Docs: <https://wearables.developer.meta.com/docs/develop/> · SDK and samples: <https://github.com/facebook/meta-wearables-dat-ios> (a copy with the CameraAccess and DisplayAccess samples is in `~/Desktop/meta-wearables-dat-ios`).

## Polished web display with the native companion

The companion remains the capture/controller app. Wake phrase listening, “Hey Facto, check this”,
spoken “check this” while streaming, and the phone Check this button all use the same existing
camera/OCR/backend pipeline. The web app only observes the current session and cannot request a
photo, upload audio, change preferences, pause, or delete the session.

1. Connect Live to the hosted backend with the join code on the phone.
2. In **Glasses display**, choose **Web display**. This releases only the native DAT display
   session; the camera/microphone pipeline and phone mirror continue normally.
3. Tap **Create temporary display link**. The default app URL is the backend URL plus `/display/`,
   which serves the built web UI. Override it with an HTTPS UI deployment if needed.
4. Use **Share display link** with your Meta Web Apps launcher/device workflow to open the link
   on Meta Ray-Ban Display. **Preview on this phone** opens a phone preview; it does not launch
   a web app on the glasses. There is no undocumented native auto-launch API in this app.
5. Run a trigger on the companion. The web UI receives the same check, source progress, and
   result over the reader stream. Phone Dismiss cancels the current displayed request through
   the owner API, which also clears the web HUD. Repeat speaks on the companion; history replay
   renders on the phone mirror only.

The link contains a dedicated read-only display token in its URL fragment, never the owner
bearer token or join code. It expires within five minutes (or when its parent session expires),
is kept in memory only, and is cleared by the companion on disconnect/reconnect or epoch change.
Generate a fresh link after session renewal. Switching back to Native display first revokes all
web readers; if revocation fails the companion stays in Web display mode with native output
blocked, preserving capture and listening until you retry. Native display remains the default and is connected using the existing DAT
controls. A web app URL and API URL must use HTTPS; loopback HTTP is allowed only for local dev
(`localhost:3030` UI and `localhost:3000` API). A phone's localhost points to that phone, so use a
reachable HTTPS host for real glasses/phone testing.

Native unit coverage is in `WebDisplayConnectionTests`, the display-grant cases in
`BackendClientTests`, and output-mode/source-progress cases in `LiveModelTests`. Run these with
the Xcode test command above; Linux TypeScript checks do not compile or run the iOS app.
