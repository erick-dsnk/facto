import Foundation
import MWDATCore
import MWDATDisplay
import Observation

// No SwiftUI import here: MWDATDisplay has its own Text, Button and Image.

/// Display capability on Meta Ray-Ban Display glasses (real or simulated).
@Observable
@MainActor
final class DisplayModel {
  var sessionState: DeviceSessionState = .idle
  var displayState: DisplayState = .stopped
  var taps = 0
  var lastError: String?

  private(set) var webDisplayEnabled = false
  var isConnected: Bool { !webDisplayEnabled && displayState == .started }

  /// Release only DAT display output; camera/microphone capture belongs to CameraModel.
  func setWebDisplayEnabled(_ enabled: Bool) {
    webDisplayEnabled = enabled
    if enabled { disconnect() }
  }

  /// Created once so it has already found a display-capable device when you tap Connect.
  @ObservationIgnored private let deviceSelector = AutoDeviceSelector(
    wearables: Wearables.shared, filter: { $0.supportsDisplay() }
  )
  @ObservationIgnored private var session: DeviceSession?
  @ObservationIgnored private var display: Display?
  @ObservationIgnored private let tokens = ListenerTokenBag()

  #if DEBUG
  private(set) var nativePreviewFixture: NativeCardPreviewFixture?
  private(set) var nativePreviewSourceCount = 0
  @ObservationIgnored private var nativePreviewTask: Task<Void, Never>?
  @ObservationIgnored private var nativePreviewGeneration = UUID()

  /// A mock-specific session keeps this experiment away from physical glasses.
  func startNativePreview(_ fixture: NativeCardPreviewFixture, device: DeviceIdentifier) {
    guard !webDisplayEnabled, session == nil || nativePreviewFixture != nil else { return }
    nativePreviewFixture = fixture
    nativePreviewSourceCount = 0
    lastError = nil
    if session == nil {
      do {
        let newSession = try Wearables.shared.createSession(deviceSelector: SpecificDeviceSelector(device: device))
        try observeAndStart(newSession)
      } catch {
        lastError = "Native preview: \(error.localizedDescription)"
        clear()
      }
    } else if displayState == .started {
      sendNativePreview()
    }
  }

  /// Serialized sends: replacing/replaying a demo cannot let its old result arrive later.
  private func sendNativePreview() {
    guard let fixture = nativePreviewFixture, let display, !webDisplayEnabled else { return }
    let previous = nativePreviewTask
    previous?.cancel()
    let generation = UUID()
    nativePreviewGeneration = generation
    nativePreviewTask = Task { [weak self] in
      await previous?.value
      guard let self, !Task.isCancelled, self.nativePreviewGeneration == generation else { return }
      do {
        try await display.send(NativeCardPreviewBuilder.build(fixture))
        if fixture == .searching {
          for count in 1...4 {
            try await Task.sleep(for: .milliseconds(700))
            guard !Task.isCancelled, self.nativePreviewGeneration == generation, !self.webDisplayEnabled else { return }
            self.nativePreviewSourceCount = count
            try await display.send(NativeCardPreviewBuilder.build(.searching, sourceCount: count))
          }
          try await Task.sleep(for: .milliseconds(1400))
          guard !Task.isCancelled, self.nativePreviewGeneration == generation, !self.webDisplayEnabled else { return }
          self.nativePreviewFixture = .supported
          try await display.send(NativeCardPreviewBuilder.build(.supported))
        }
      } catch is CancellationError {
        // Replay, mode switching and disconnect cancel the fixture sequence.
      } catch {
        if self.nativePreviewGeneration == generation, !Task.isCancelled {
          self.lastError = "Native preview send: \(error.localizedDescription)"
        }
      }
    }
  }

  private func cancelNativePreview() {
    nativePreviewGeneration = UUID()
    nativePreviewTask?.cancel()
    nativePreviewTask = nil
    nativePreviewFixture = nil
    nativePreviewSourceCount = 0
  }
  #endif

  func connect() {
    guard !webDisplayEnabled, session == nil else { return }
    lastError = nil
    do {
      // Only picks glasses that have a display.
      let newSession = try Wearables.shared.createSession(deviceSelector: deviceSelector)
      try observeAndStart(newSession)
    } catch {
      lastError = "Session: \(error.localizedDescription)"
      clear()
    }
  }

  private func observeAndStart(_ newSession: DeviceSession) throws {
    session = newSession
    newSession.statePublisher.listen { [weak self] state in
      Task { @MainActor in self?.handleSession(state) }
    }.store(in: tokens)
    newSession.errorPublisher.listen { [weak self] error in
      Task { @MainActor in self?.lastError = "Session: \(error.localizedDescription)" }
    }.store(in: tokens)
    try newSession.start()
  }

  func disconnect() {
    #if DEBUG
    cancelNativePreview()
    #endif
    if let display {
      display.stop()
    } else {
      session?.stop()
    }
  }

  private func handleSession(_ state: DeviceSessionState) {
    sessionState = state
    switch state {
    case .started:
      attachDisplay()
    case .stopped:
      clear()
    default:
      break
    }
  }

  private func attachDisplay() {
    guard !webDisplayEnabled, let session, display == nil else {
      if webDisplayEnabled { session?.stop() }
      return
    }
    do {
      let newDisplay = try session.addDisplay()
      display = newDisplay
      newDisplay.statePublisher.listen { [weak self] state in
        Task { @MainActor in self?.handleDisplay(state) }
      }.store(in: tokens)
      newDisplay.start()
    } catch {
      lastError = "Display: \(error.localizedDescription)"
      session.stop()
    }
  }

  private func handleDisplay(_ state: DisplayState) {
    displayState = state
    switch state {
    case .started:
      #if DEBUG
      if nativePreviewFixture != nil {
        sendNativePreview()
        return
      }
      #endif
      Task { await sendHome() }
    case .stopped:
      // Stopping the display detaches it; end the session too.
      display = nil
      session?.stop()
    default:
      break
    }
  }

  private func clear() {
    #if DEBUG
    cancelNativePreview()
    #endif
    tokens.clear()
    display = nil
    session = nil
    sessionState = .idle
    displayState = .stopped
  }

  /// Each send replaces the whole screen, so always send the full layout.
  func sendHome() async {
    guard !webDisplayEnabled, let display else { return }
    #if DEBUG
    guard nativePreviewFixture == nil else { return }
    #endif
    let taps = self.taps
    let view = FlexBox(direction: .column, spacing: 12) {
      Text("Glasses Lab", style: .heading)
      Text("Taps received: \(taps)", style: .body)
      Text("Pinch or tap the button", style: .meta, color: .secondary)
      FlexBox(direction: .row, spacing: 8, alignment: .center, crossAlignment: .center) {
        Button(label: "Tap me", onClick: { [weak self] in
          Task { @MainActor in
            guard let self else { return }
            self.taps += 1
            await self.sendHome()
          }
        })
      }
    }
    .padding(24)

    do {
      try await display.send(view)
    } catch {
      lastError = "Send: \(error.localizedDescription)"
    }
  }
}

extension DisplayModel: LensDisplaying {
  /// Live mode: the result card on the lens, or a cleared lens when `card` is nil.
  func showCard(_ card: ResultCard?, onRepeat: (@Sendable () -> Void)?, onDismiss: (@Sendable () -> Void)?) async {
    guard !webDisplayEnabled, let display else { return }
    #if DEBUG
    guard nativePreviewFixture == nil else { return }
    #endif
    do {
      if let card {
        try await display.send(DisplayCardBuilder.build(card, onRepeat: onRepeat, onDismiss: onDismiss))
      } else {
        try await display.clearDisplay()
      }
    } catch {
      lastError = "Send: \(error.localizedDescription)"
    }
  }
}
