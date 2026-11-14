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

### Debug log

The **Debug log** section (under the Live sections) saves what the app normally never logs, so a failed field test can be read afterwards: every raw backend event (transcripts with confidence, `claim.*` with `reasonCode`, `pipeline.error`, `capture.request`), every check request body (OCR text, chunks, capture fields), the look-and-check photos OCR ran on with the OCR result and timings, audio streamer state changes, and what the presenter did with each result. It is on by default and the toggle is remembered.

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
