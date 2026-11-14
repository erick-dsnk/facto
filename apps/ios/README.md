# Facto for iOS

The Facto app (Xcode target and scheme `GlassesLab`) checks claims your Meta glasses hear or see and answers in the lens of Meta Ray-Ban Display and through the glasses speakers. It is built on the Meta Wearables Device Access Toolkit (DAT) 1.0.1. The lab tools it grew out of (camera stream with a frame-rate meter, display test, MockDeviceKit glasses, audio routes, debug log) live under **Settings → Developer**.

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

The app opens on one home screen: the status line, **Start listening** and **Check this**, what's on the lens, and recent checks. The gear opens Settings.

1. **Connect your glasses.** Until they connect, the home screen shows this step in place of the listening controls. **Connect with Meta AI** opens the Meta AI app, which asks you to approve Facto and sends you back. The app appears under Meta AI > App connections > Developer mode apps.
2. **Add the join code** in Settings, once. Facto keeps it in the Keychain.
3. Facto then connects to the backend by itself on launch and each time it comes back to the foreground, and connects Meta Ray-Ban Display as soon as those glasses connect.

### Live mode

The home screen runs the product flow against services/api. The code is in `GlassesLab/Live` and `GlassesLab/Home`: `LiveModel` wires `BackendClient`, `AudioStreamer`, `LookAndCheckCoordinator` and `ResultPresenter` to the camera and display models, and `HomeStatus` turns the glasses and backend state into the status line.

1. **Backend.** The default URL is the hosted backend, `https://actually-api.lively-voice-2bf8.workers.dev`, so a phone on mobile data reaches it while the glasses stream (during a stream the phone is on the glasses' Wi-Fi). With a join code saved, the app connects without a tap. It doesn't retry a rejected join code or a bad URL until you change them in Settings; closing Settings with a new join code or URL reconnects. Settings → Advanced → **Backend URL** points it elsewhere: plain `http://` works only for localhost and private network addresses, so `http://localhost:3000` works from the simulator. On first launch after the update, the app drops a saved localhost or Railway URL once, so older installs move to the default.
2. **Start listening** starts the device session and the stream with glasses mic audio, then streams 16 kHz PCM16 to the backend. Settings → **Demo quality** picks High 720×1280 at 30 fps; off, it picks Low 360×640 at 15 fps for long listening. It applies when the stream starts. Stop the stream (Settings → Developer → Live session) to change it, because the app never stops a stream on its own.
3. **Check this**, or saying "Facto, can you check this?" (the backend's `capture.request`; the leading "Facto" is optional), takes a photo from the running stream with `stream.capturePhoto(format: .jpeg)`. The phone reads it with Vision and sends the text. The stream never pauses.
4. Results speak (`respond`), chime (`notify`) or go to history only (`silent`). **On the lens** shows the same card the Display glasses get. **Recent** lists every result; tap one to show it on the lens again. **Mute** silences speech and chimes but keeps cards and history.

The status line reads "Glasses connected · Online" when everything works. Every other state reads differently: glasses not set up or not connected, join code needed or rejected, reconnecting, listening stopped with a reason (glasses disconnected, no connection, session ended, mic unavailable) and backend errors, so a broken connection never looks like "no alerts". When one button fixes the problem, the line shows it: **Reconnect** or **Open Settings**. A drop under 5 s resumes with a quiet chime; a ping every 2 s catches a connection that died without an error. Longer drops stop listening with a spoken reason. A check the user asked for always gets an answer: a verdict, "I'm not sure what was read", or after 15 s with no result, "The check didn't finish". A photo split into several requests gets one answer.

Backend sessions end 5 minutes after they open. Live mode then opens a new session with the same join code and resumes listening (at most once a minute). **Automatic alerts** (on by default) sends `session.preferences` so the backend may chime for a contradicted claim it hears. The phone stays awake while listening: keep Facto in the foreground, because iOS suspends the socket and audio pipeline of a locked or backgrounded app.

`LiveModelTests` covers the wiring with fakes, including the automatic connect, and `HomeStatusTests` covers every status line. `LiveModelLiveTests` runs the same flow against a real backend and is skipped unless `TEST_RUNNER_BACKEND_LIVE_URL` and `TEST_RUNNER_BACKEND_LIVE_JOIN_CODE` are set (see `BackendClientLiveTests`). In fixture mode the backend checks only fixture sources, so a photo check comes back as "The check didn't finish".

### Developer screen

Settings → **Developer** keeps every lab panel for the device checklist: the live session (Stop stream, Reconnect, Disconnect), Meta AI registration and raw device state, simulated glasses, the camera stream, audio routes, the display test, the event log and the debug log.

- **Measure.** Under Camera stream, **Start session**, then **Start stream** (the first stream asks for camera permission in Meta AI). It shows the measured frame rate, the longest gap between frames, and the frame size. For delay, look at the millisecond clock through the glasses while streaming and take a screenshot: the clock in the preview minus the live clock is the camera-to-app delay.
- **Display.** Facto connects Meta Ray-Ban Display (or the simulated Display) by itself. **Send test screen** shows a screen with a button on the glasses; taps come back to the app. If the automatic connect failed, **Connect display** retries.
- **Device checklist:** run the camera and display sessions together (listening or Check this while a card is on the lens), because the app now opens both at once.

### Debug log

Settings → Developer → **Debug log** saves what the app normally never logs, so a failed field test can be read afterwards: every raw backend event (transcripts with confidence, `claim.*` with `reasonCode`, `pipeline.error`, `capture.request`), every check request body (OCR text, chunks, capture fields), the look-and-check photos OCR ran on with the OCR result and timings, audio streamer state changes, and what the presenter did with each result. It is **off until you turn it on** (nothing is recorded on a fresh install) and the toggle is remembered.

- Files stay on the phone in the app container under `Library/Application Support/DebugLog/`: one `YYYY-MM-DD.jsonl` per day (one `{"ts","kind","payload"}` object per line, `ts` in UTC with milliseconds) and `photo-<UTC time>-<id>.jpg` files referenced from `lookcheck.photo` entries. The app never uploads them, and the folder is excluded from backups.
- Entries and photos older than 24 hours are deleted on launch and every hour. **Delete debug log** removes everything at once.
- The join code, session token and `Authorization` header are never written; those fields read `[redacted]`.

Copy the folder to the Mac with the phone plugged in:

```sh
xcrun devicectl device copy from --device <UDID> --domain-type appDataContainer \
  --domain-identifier com.davidvasilescu.junction.glasseslab \
  --source "Library/Application Support/DebugLog" --destination ./debuglog
```

Or tap **Share log** and AirDrop the files.

### Wake phrase: “Hey Facto”

Settings → **Wake on “Hey Facto”** (off by default) keeps the app idle until it is asked. With it on and the backend connected:

- The glasses stream is off and no audio or text is sent to the backend. The phone listens on the glasses' Bluetooth hands-free microphone (the phone's own microphone if the glasses aren't the active headset) and runs a keyword detector on the phone. Audio is processed in memory and dropped.
- **“Hey Facto”** plays a chime, starts the stream and listens for 60 s, then stops the stream, ends the device session and waits again. The decision takes about 1.5 s, because the detector waits to hear whether “check this” follows.
- **“Hey Facto, check this”** takes a photo and checks what is in view, like the Check this button, then stops the stream. “Check this” on its own does nothing while waiting.
- Starting to listen by hand, or a running stream, pauses the detector; the line under the buttons on the home screen says why.

The detector is [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) keyword spotting (Apache-2.0) with the open-vocabulary English model `sherpa-onnx-kws-zipformer-gigaspeech-3.3M-2024-01-01` (int8, about 5 MB, in `GlassesLab/WakeWord/Model`). The phrases are the two `*-keywords.txt` files there: the model's BPE tokens, a boost after `:` and a trigger threshold after `#`. To change a phrase, tokenise it with the model's `bpe.model` (`sherpa-onnx-cli text2token`) and retune the two numbers against recordings.

The two prebuilt libraries it links (sherpa-onnx 2.0.1 and onnxruntime 1.28.2, about 47 MB) are not in git. `scripts/fetch-wake-word-libs.sh` downloads them into `Vendor/` and checks their SHA-256; `xcodegen generate` and `scripts/deploy.sh` run it for you. Use the model archive without `-mobile` in its name: the `-mobile` one fails in this runtime.

`WakeWordDetectorTests` runs the real model on synthesised speech in six voices (`GlassesLabTests/Fixtures/WakeWord`). Not yet tested: real voices through the glasses microphone, noisy rooms, and waiting with the phone locked (the `audio` background mode is declared for it).

### Without glasses

Settings → Developer → **Simulated glasses** pairs glasses through MockDeviceKit. The phone's back camera becomes the glasses camera. Choose **Meta Ray-Ban Display** to see the rendered display screen inside the app.

## Stream quality: Wi-Fi, not Bluetooth

The SDK picks the video link from Info.plist. With the External Accessory keys (`UISupportedExternalAccessoryProtocols`, `external-accessory` background mode) it streams over Bluetooth Classic, which is heavily compressed and mostly stuck at 504×896. Without them it streams over a Wi-Fi network the glasses create, and holds 720×1280 at 30 fps. `project.yml` leaves the External Accessory keys out on purpose; don't add them back. Sources: Meta's replies in [issue #376](https://github.com/meta/meta-wearables-dat-ios/issues/376) and [discussion #297](https://github.com/meta/meta-wearables-dat-ios/discussions/297).

- When a stream starts, the iPhone joins the glasses' Wi-Fi network, so it has no Wi-Fi internet during the stream. Cloud AI calls go over mobile data.
- Allow **Local Network** for Facto (Settings > Privacy & Security > Local Network). If it's denied, the SDK silently streams nothing.
- If frames don't arrive: forget old "RB Meta…" networks in iPhone Wi-Fi settings, turn off Auto-Join for the venue network, and dismiss any "Unable to join" alert quickly.

## Known issues to plan around

- A single touchpad tap pauses an active stream; tap again to resume.
- Developer Mode can switch off after a firmware update.
- Registration needs internet.
- Bluetooth bandwidth limits the stream. The SDK lowers resolution first, then frame rate, never below 15 fps. Lower settings give cleaner frames.

Docs: <https://wearables.developer.meta.com/docs/develop/> · SDK and samples: <https://github.com/facebook/meta-wearables-dat-ios> (a copy with the CameraAccess and DisplayAccess samples is in `~/Desktop/meta-wearables-dat-ios`).
