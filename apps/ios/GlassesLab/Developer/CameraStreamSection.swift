import MWDATCamera
import MWDATCore
import SwiftUI

/// The glasses camera on its own: session, stream settings, frame-rate meter, the latency
/// clock, frame grabs and photos.
struct CameraStreamSection: View {
  @Bindable var camera: CameraModel
  /// Manual captures go through LiveModel so they pause "Hey Facto" and end its wake session.
  let live: LiveModel

  var body: some View {
    Section {
      LabeledContent("Glasses picked by SDK", value: camera.hasActiveDevice ? "Yes" : "Not yet")
      LabeledContent("Session", value: "\(camera.sessionState)")
      if camera.hasSession {
        Button("End session", role: .destructive) { camera.endSession() }
      } else {
        Button("Start session") {
          Task { await live.performManualCapture { camera.startSession() } }
        }
      }

      Picker("Resolution", selection: $camera.resolution) {
        Text("Low 360×640").tag(StreamingResolution.low)
        Text("Medium 504×896").tag(StreamingResolution.medium)
        Text("High 720×1280").tag(StreamingResolution.high)
      }
      .disabled(camera.isStreaming)
      Toggle("Glasses mic audio (beta)", isOn: $camera.captureStreamAudio)
        .factoToggleTint()
        .disabled(camera.isStreaming)
      Picker("Frame rate", selection: $camera.frameRate) {
        ForEach([UInt(2), 7, 15, 24, 30], id: \.self) { Text("\($0) fps").tag($0) }
      }
      .disabled(camera.isStreaming)

      if camera.isStreaming {
        Button("Stop stream", role: .destructive) { camera.stopStream() }
      } else {
        Button("Start stream") { Task { await live.performManualCapture { await camera.startStream() } } }
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
        framePreview(frame)
      }
      // Only while streaming: a constantly redrawing clock makes the list swallow taps.
      if camera.isStreaming {
        LatencyClock()
      }
      Button("Grab sharpest stream frame (instant)") { camera.grabSharpestFrame() }
        .disabled(!camera.isStreaming)
      if let info = camera.grabbedFrameInfo {
        LabeledContent("Frame grab", value: info)
      }
      if let grabbed = camera.grabbedFrame {
        framePreview(grabbed)
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
      Button(camera.isCapturingPhoto ? "Taking photo…" : "Take photo") {
        Task { await live.performManualCapture { await camera.capturePhoto() } }
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
        framePreview(photo)
      }
      if let error = camera.lastError {
        Label(error, systemImage: "exclamationmark.triangle")
          .font(.onest(.footnote))
      }
    } header: {
      SettingsHeader("Camera stream")
    } footer: {
      SettingsFooter(
        "Latency check: look at the clock through the glasses while streaming, then take a screenshot. The clock in the preview minus the live clock is the camera-to-app delay."
      )
    }
  }

  private func framePreview(_ image: UIImage) -> some View {
    Image(uiImage: image)
      .resizable()
      .scaledToFit()
      .clipShape(.rect(cornerRadius: FactoRadius.card, style: .continuous))
      .accessibilityLabel("Glasses camera frame")
  }
}
