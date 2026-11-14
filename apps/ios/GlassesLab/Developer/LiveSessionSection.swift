import MWDATCamera
import SwiftUI

/// The backend session behind the home screen, with the manual controls the home screen
/// leaves out: Stop stream, Reconnect and Disconnect.
struct LiveSessionSection: View {
  let live: LiveModel
  let camera: CameraModel

  var body: some View {
    Section {
      VStack(alignment: .leading, spacing: FactoSpacing.xxs) {
        Text(live.status.title)
          .font(.onest(.headline, weight: .semibold))
        Text(live.status.detail)
          .font(.onest(.subheadline))
          .foregroundStyle(.factoTextSecondary)
      }
      .accessibilityElement(children: .combine)
      if let notice = live.notice {
        Text(notice)
          .font(.onest(.footnote))
          .foregroundStyle(.factoTextSecondary)
      }
      LabeledContent("Glasses stream", value: streamLabel)
      if camera.isStreaming && !live.isListening {
        Button("Stop stream", role: .destructive) { camera.stopStream() }
      }
      LabeledContent("Waiting for results", value: "\(live.pendingChecks.count)")
      Button("Reconnect") { Task { await live.reconnect() } }
      Button("Disconnect", role: .destructive) { Task { await live.disconnect() } }
        .disabled(live.canEditBackend)
    } header: {
      SettingsHeader("Live session")
    } footer: {
      SettingsFooter(
        "Facto connects by itself on launch and when it returns to the foreground. Stop stream is the only thing that ends the glasses camera stream."
      )
    }
  }

  private var streamLabel: String {
    switch camera.streamState {
    case .streaming: camera.captureStreamAudio ? "Streaming with mic" : "Streaming, no mic"
    case .paused: "Paused on the glasses (tap the touchpad)"
    case .starting, .waitingForDevice: "Starting…"
    case .stopping: "Stopping…"
    case .stopped: "Off"
    }
  }
}
