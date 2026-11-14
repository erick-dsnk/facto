import MWDATCamera
import MWDATCore
import MWDATMockDevice
import QuartzCore
import SwiftUI

struct ContentView: View {
  let wearables: WearablesModel
  @Bindable var camera: CameraModel
  let display: DisplayModel
  let audioLab: AudioLabModel
  let live: LiveModel

  var body: some View {
    NavigationStack {
      List {
        LiveSections(live: live, camera: camera, display: display)
        DebugLogSection()
        connectionSection
        mockSection
        cameraSection
        audioSection
        displaySection
        diagnosticsSection
      }
      .navigationTitle("Glasses Lab")
    }
  }

  // MARK: Connection

  private var connectionSection: some View {
    Section {
      LabeledContent("Meta AI registration", value: registrationLabel)
      if wearables.registration == .registered {
        SwiftUI.Button("Disconnect from Meta AI", role: .destructive) {
          Task { await wearables.unregister() }
        }
      } else {
        SwiftUI.Button("Connect to Meta AI") {
          Task { await wearables.register() }
        }
        .disabled(wearables.registration == .registering)
      }
      if wearables.devices.isEmpty {
        Text("No glasses found").foregroundStyle(.secondary)
      }
      ForEach(wearables.devices) { device in
        VStack(alignment: .leading, spacing: 2) {
          Text(device.name).font(.headline)
          Text("\(device.link)\(device.hasDisplay ? " · display" : "")")
            .font(.subheadline)
            .foregroundStyle(.secondary)
          Text(device.details)
            .font(.caption.monospaced())
            .foregroundStyle(.secondary)
            .textSelection(.enabled)
          if device.needsUpdate {
            SwiftUI.Button("Firmware update required") {
              Task { await wearables.openFirmwareUpdate() }
            }
          }
        }
      }
      if let error = wearables.lastError {
        Text(error).font(.footnote).foregroundStyle(.red)
      }
    } header: {
      Text("1. Connect")
    } footer: {
      Text("Opens the Meta AI app. Developer Mode must be on there.")
    }
  }

  // MARK: Diagnostics

  private var diagnosticsSection: some View {
    Section {
      SwiftUI.Button("Refresh device state") { wearables.refreshNow() }
      if wearables.log.isEmpty {
        Text("No events yet").foregroundStyle(.secondary)
      }
      ForEach(Array(wearables.log.enumerated()), id: \.offset) { _, line in
        Text(line)
          .font(.caption.monospaced())
          .textSelection(.enabled)
      }
    } header: {
      Text("5. Diagnostics")
    } footer: {
      Text("Newest first. Screenshot this section if the glasses won't connect.")
    }
  }

  private var registrationLabel: String {
    switch wearables.registration {
    case .registered: "Registered"
    case .registering: "Registering…"
    case .available: "Not registered"
    case .unavailable: "Unavailable"
    @unknown default: "Unknown"
    }
  }

  // MARK: Simulated glasses

  private var mockSection: some View {
    Section {
      if let model = wearables.mockModel {
        LabeledContent("Simulating", value: model.rawValue)
        SwiftUI.Button("Simulate touchpad tap") { wearables.mockTap() }
        SwiftUI.Button("Stop simulation", role: .destructive) { wearables.stopMock() }
        if let mockDisplay = wearables.mockDisplay {
          MockDisplayPreview(display: mockDisplay)
            .frame(height: 300)
            .clipShape(RoundedRectangle(cornerRadius: 12))
        }
      } else {
        ForEach(WearablesModel.MockModel.allCases) { model in
          SwiftUI.Button("Simulate \(model.rawValue)") {
            Task { await wearables.startMock(model) }
          }
        }
      }
    } header: {
      Text("2. Simulated glasses (optional)")
    } footer: {
      Text("MockDeviceKit: no hardware needed. The phone's back camera stands in for the glasses camera. Pick Display to preview what the Display glasses would show.")
    }
  }

  // MARK: Camera

  private var cameraSection: some View {
    Section {
      LabeledContent("Glasses picked by SDK", value: camera.hasActiveDevice ? "Yes" : "Not yet")
      LabeledContent("Session", value: "\(camera.sessionState)")
      if camera.hasSession {
        SwiftUI.Button("End session", role: .destructive) { camera.endSession() }
      } else {
        SwiftUI.Button("Start session") { camera.startSession() }
      }

      Picker("Resolution", selection: $camera.resolution) {
        Text("Low 360×640").tag(StreamingResolution.low)
        Text("Medium 504×896").tag(StreamingResolution.medium)
        Text("High 720×1280").tag(StreamingResolution.high)
      }
      .disabled(camera.isStreaming)
      Toggle("Glasses mic audio (beta)", isOn: $camera.captureStreamAudio)
        .disabled(camera.isStreaming)
      Picker("Frame rate", selection: $camera.frameRate) {
        ForEach([UInt(2), 7, 15, 24, 30], id: \.self) { Text("\($0) fps").tag($0) }
      }
      .disabled(camera.isStreaming)

      if camera.isStreaming {
        SwiftUI.Button("Stop stream", role: .destructive) { camera.stopStream() }
      } else {
        SwiftUI.Button("Start stream") { Task { await camera.startStream() } }
          .disabled(camera.sessionState != .started)
      }

      LabeledContent("Stream", value: "\(camera.streamState)")
      if camera.captureStreamAudio {
        LabeledContent("Glasses audio", value: camera.audioFormat ?? "no buffers yet")
        LabeledContent(
          "Level",
          value: String(format: "%.0f dBFS · %d buffers", camera.audioLevelDb, camera.audioBufferCount)
        )
      }
      LabeledContent(
        "Measured",
        value: String(format: "%.1f fps · max gap %.0f ms · %d frames", camera.fps, camera.maxGapMs, camera.frameCount)
      )
      if camera.frameSize != .zero {
        LabeledContent("Frame size", value: "\(Int(camera.frameSize.width))×\(Int(camera.frameSize.height))")
      }
      if let frame = camera.frame {
        SwiftUI.Image(uiImage: frame)
          .resizable()
          .scaledToFit()
          .clipShape(RoundedRectangle(cornerRadius: 12))
      }
      // Only while streaming: a constantly redrawing clock makes the list swallow taps.
      if camera.isStreaming {
        LatencyClock()
      }
      SwiftUI.Button("Grab sharpest stream frame (instant)") { camera.grabSharpestFrame() }
        .disabled(!camera.isStreaming)
      if let info = camera.grabbedFrameInfo {
        LabeledContent("Frame grab", value: info)
      }
      if let grabbed = camera.grabbedFrame {
        SwiftUI.Image(uiImage: grabbed)
          .resizable()
          .scaledToFit()
          .clipShape(RoundedRectangle(cornerRadius: 12))
      }
      Picker("Photo size", selection: $camera.photoResolution) {
        Text("Small (480p class)").tag(PhotoResolution.small)
        Text("Medium (720p class)").tag(PhotoResolution.medium)
        Text("Large (1080p class)").tag(PhotoResolution.large)
        Text("Full 4032×3024").tag(PhotoResolution.full)
      }
      .disabled(camera.isCapturingPhoto)
      Picker("Photo quality", selection: $camera.photoQuality) {
        Text("Low (smallest file)").tag(PhotoQuality.low)
        Text("Medium").tag(PhotoQuality.medium)
        Text("High (largest file)").tag(PhotoQuality.high)
      }
      .disabled(camera.isCapturingPhoto)
      SwiftUI.Button(camera.isCapturingPhoto ? "Taking photo…" : "Take photo") {
        Task { await camera.capturePhoto() }
      }
      .disabled(camera.sessionState != .started || camera.isCapturingPhoto)
      if let status = camera.photoStatus {
        LabeledContent("Photo", value: status)
      }
      if !camera.photoLog.isEmpty {
        VStack(alignment: .leading, spacing: 2) {
          ForEach(Array(camera.photoLog.enumerated()), id: \.offset) { _, line in
            Text(line).font(.caption2.monospaced()).textSelection(.enabled)
          }
        }
      }
      if let info = camera.photoInfo {
        LabeledContent("Last photo", value: info)
      }
      if let photo = camera.photo {
        SwiftUI.Image(uiImage: photo)
          .resizable()
          .scaledToFit()
          .clipShape(RoundedRectangle(cornerRadius: 12))
      }
      if let error = camera.lastError {
        Text(error).font(.footnote).foregroundStyle(.red)
      }
    } header: {
      Text("3. Camera stream")
    } footer: {
      Text("Latency check: look at the clock through the glasses while streaming, then screenshot. The clock in the preview minus the live clock is the camera-to-app delay.")
    }
  }

  // MARK: Display

  // MARK: Audio routes

  private var audioSection: some View {
    Section {
      LabeledContent("Input route", value: audioLab.inputRoute)
      LabeledContent("Output route", value: audioLab.outputRoute)
      if audioLab.isListening {
        LabeledContent("HFP format", value: audioLab.hfpFormat ?? "–")
        LabeledContent("HFP level", value: String(format: "%.0f dBFS", audioLab.hfpLevelDb))
        SwiftUI.Button("Stop HFP mic", role: .destructive) { audioLab.stopHFP() }
      } else {
        SwiftUI.Button("Start HFP mic test") { Task { await audioLab.startHFP() } }
          .disabled(camera.isStreaming)
      }
      SwiftUI.Button("Speak a sample result") { audioLab.speakSample() }
      SwiftUI.Button("Refresh routes") { audioLab.refreshRoute() }
      if let error = audioLab.lastError {
        Text(error).font(.footnote).foregroundStyle(.red)
      }
    } header: {
      Text("Audio routes")
    } footer: {
      Text("HFP is the wearer-dictation fallback. Run it with no stream active, then have someone else talk at ~1 m and compare levels. Spoken output should play from the glasses speakers.")
    }
  }

  private var displaySection: some View {
    Section {
      LabeledContent("Session", value: "\(display.sessionState)")
      LabeledContent("Display", value: "\(display.displayState)")
      LabeledContent("Taps from glasses", value: "\(display.taps)")
      if display.sessionState == .idle {
        SwiftUI.Button("Connect display") { display.connect() }
      } else {
        SwiftUI.Button("Resend screen") { Task { await display.sendHome() } }
          .disabled(!display.isConnected)
        SwiftUI.Button("Disconnect display", role: .destructive) { display.disconnect() }
      }
      if let error = display.lastError {
        Text(error).font(.footnote).foregroundStyle(.red)
      }
    } header: {
      Text("4. Display (Meta Ray-Ban Display only)")
    } footer: {
      Text("Needs real Display glasses or the simulated Display above. Gen 2 has no display.")
    }
  }
}

/// Large millisecond clock for measuring glasses-to-phone frame delay.
private struct LatencyClock: View {
  var body: some View {
    TimelineView(.periodic(from: .now, by: 1.0 / 30.0)) { _ in
      let ms = Int((CACurrentMediaTime() * 1000).truncatingRemainder(dividingBy: 100_000))
      Text(String(format: "%05d", ms))
        .font(.system(size: 44, weight: .bold, design: .monospaced))
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
        .background(.black, in: RoundedRectangle(cornerRadius: 8))
        .foregroundStyle(.white)
    }
  }
}

/// Shows what the simulated Display glasses would render.
private struct MockDisplayPreview: UIViewRepresentable {
  let display: any MockDisplayKit

  func makeUIView(context: Context) -> UIView {
    display.createPreviewView()
  }

  func updateUIView(_ uiView: UIView, context: Context) {}
}
