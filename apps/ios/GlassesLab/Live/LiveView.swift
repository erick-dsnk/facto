import MWDATCamera
import SwiftUI

/// Live mode inside the Glasses Lab list: backend connection, listening, "Check this", the lens
/// mirror and the result history.
struct LiveSections: View {
  @Bindable var live: LiveModel
  let camera: CameraModel
  let display: DisplayModel

  var body: some View {
    Group {
      connectionSection
      listenSection
      lensSection
      historySection
    }
  }

  // MARK: Connection

  private var connectionSection: some View {
    Section {
      LiveStatusRow(status: live.status)
      TextField("Backend URL", text: $live.baseURLText)
        .keyboardType(.URL)
        .textContentType(.URL)
        .textInputAutocapitalization(.never)
        .autocorrectionDisabled()
        .disabled(!live.canEditBackend)
      SecureField("Join code", text: $live.joinCode)
        .textContentType(.password)
        .textInputAutocapitalization(.never)
        .autocorrectionDisabled()
        .disabled(!live.canEditBackend)
      if live.canEditBackend {
        SwiftUI.Button("Connect") { Task { await live.connect() } }
          .disabled(live.joinCode.trimmingCharacters(in: .whitespaces).isEmpty)
      } else {
        SwiftUI.Button("Disconnect", role: .destructive) { Task { await live.disconnect() } }
      }
      if let notice = live.notice {
        Text(notice).font(.footnote).foregroundStyle(.secondary)
      }
    } header: {
      Text("Live")
    } footer: {
      Text("Connect to Meta AI below first. On the iPhone use the Railway https URL: during a stream the phone is on the glasses' Wi-Fi and reaches the backend over mobile data.")
    }
  }

  // MARK: Listen and check

  private var listenSection: some View {
    Section {
      if live.isListening {
        SwiftUI.Button("Stop listening", role: .destructive) { live.stopListening() }
      } else {
        SwiftUI.Button(live.isStartingStream ? "Starting…" : "Start listening") {
          Task { await live.startListening() }
        }
        .disabled(!live.isConnected || live.isStartingStream)
      }
      SwiftUI.Button(checkButtonTitle) { Task { await live.checkThis() } }
        .disabled(!live.isConnected || live.isChecking)
      if let message = live.checkMessage {
        Text(message).font(.footnote).foregroundStyle(.secondary)
      }
      if !live.pendingChecks.isEmpty {
        LabeledContent("Waiting for results", value: "\(live.pendingChecks.count)")
      }
      LabeledContent("Glasses stream", value: streamLabel)
      if camera.isStreaming && !live.isListening {
        SwiftUI.Button("Stop stream", role: .destructive) { camera.stopStream() }
      }
      Toggle("Demo quality", isOn: $live.demoQuality)
        .disabled(camera.isStreaming)
      Toggle("Mute speech and chimes", isOn: $live.isMuted)
      Toggle("Automatic alerts", isOn: $live.automaticAlerts)
    } header: {
      Text("Listen and check")
    } footer: {
      Text("Demo quality on: \(StreamQuality.demo.summary). Off: \(StreamQuality.listening.summary), for long listening. Applies when the stream starts. Say “check this” or tap Check this: the photo comes from the running stream, which never pauses. Automatic alerts: a chime and a card when the backend hears a contradicted claim. The phone stays awake while listening; keep Glasses Lab in the foreground.")
    }
  }

  private var checkButtonTitle: String {
    switch live.checkPhase {
    case .idle: "Check this"
    case .capturing: "Taking photo…"
    case .recognizing: "Reading text…"
    case .submitting: "Sending…"
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

  // MARK: Lens

  private var lensSection: some View {
    Section {
      LensMirrorView(model: live.lens)
        .frame(maxWidth: 320)
        .frame(maxWidth: .infinity)
        .listRowInsets(EdgeInsets(top: 12, leading: 16, bottom: 12, trailing: 16))
      HStack {
        SwiftUI.Button("Repeat") { live.repeatLatest() }
          .disabled(live.isMuted || live.history.latestDelivered == nil)
        Spacer()
        SwiftUI.Button("Dismiss") { live.dismissCard() }
          .disabled(live.lens.card == nil)
      }
      .buttonStyle(.borderless)
    } header: {
      Text("Lens mirror")
    } footer: {
      Text(display.isConnected ? "Cards also go to the Display glasses." : "Connect the display below to send cards to Meta Ray-Ban Display.")
    }
  }

  // MARK: History

  private var historySection: some View {
    Section {
      if live.history.entries.isEmpty {
        Text("No results yet.").foregroundStyle(.secondary)
      }
      ForEach(live.history.entries) { entry in
        SwiftUI.Button { live.show(entry) } label: {
          HistoryRow(entry: entry)
        }
        .buttonStyle(.plain)
      }
    } header: {
      Text("Results")
    } footer: {
      Text("Newest first, kept in memory only. Silent results appear here and nowhere else. Tap one to show it on the lens.")
    }
  }
}

/// The status line at the top of Live mode. Every state has its own symbol, words and colour.
private struct LiveStatusRow: View {
  let status: LiveStatus

  var body: some View {
    HStack(alignment: .firstTextBaseline, spacing: 12) {
      Image(systemName: status.symbol)
        .font(.title3)
        .foregroundStyle(color)
        .frame(width: 28)
      VStack(alignment: .leading, spacing: 2) {
        Text(status.title).font(.headline)
        Text(status.detail).font(.subheadline).foregroundStyle(.secondary)
      }
    }
    .padding(.vertical, 4)
    .accessibilityElement(children: .combine)
  }

  private var color: Color {
    switch status.tone {
    case .neutral: .secondary
    case .good: .green
    case .warning: .orange
    case .bad: .red
    }
  }
}

private struct HistoryRow: View {
  let entry: ResultHistory.Entry

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      HStack {
        Image(systemName: LensMirrorCanvas.symbol(for: entry.card.kind))
        Text(entry.card.verdictWord).font(.headline)
        Spacer()
        Text(entry.receivedAt, style: .time).font(.caption).foregroundStyle(.secondary)
      }
      if !entry.card.excerpt.isEmpty {
        Text(entry.card.excerpt).font(.subheadline)
      }
      Text(meta).font(.caption).foregroundStyle(.secondary)
    }
    .padding(.vertical, 2)
    .accessibilityElement(children: .combine)
  }

  private var meta: String {
    var parts = [entry.userInitiated ? "You asked" : "Automatic"]
    switch entry.delivery {
    case .spoken: parts.append("spoken")
    case .chimed: parts.append("chime")
    case .cardOnly: parts.append("card only")
    case .silent: parts.append("silent")
    }
    if entry.superseded { parts.append("corrected") }
    if let source = entry.card.sourceLine { parts.append(source) }
    return parts.joined(separator: " · ")
  }
}
