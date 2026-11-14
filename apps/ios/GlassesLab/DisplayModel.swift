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

  /// The display is ready to show cards: the shared session is held and started. The
  /// display capability itself attaches only while a card is on the lens (see `showCard`).
  var isConnected: Bool { sessionState == .started }

  /// The one session shared with the camera (see GlassesSession).
  @ObservationIgnored private let glasses: GlassesSession
  @ObservationIgnored private var session: DeviceSession?
  @ObservationIgnored private var display: Display?
  @ObservationIgnored private let tokens = ListenerTokenBag()
  /// False once a card with a verdict swatch failed to send. The rest of the session sends
  /// icons instead.
  @ObservationIgnored private var swatchesEnabled = true
  /// Counts every screen sent or cleared, so the ready screen clears only if nothing
  /// replaced it.
  @ObservationIgnored private var screenGeneration = 0

  /// How long the ready screen stays when no result card replaces it.
  nonisolated static let readyDuration: Duration = .seconds(4)
  /// How long a result card stays on the lens before the display is handed back. While the
  /// app holds the display, the glasses show its panel even when it is empty.
  nonisolated static let cardDuration: Duration = .seconds(10)

  /// The user asked to disconnect: when the display stops, leave the session too.
  @ObservationIgnored private var leaving = false
  /// The ready screen goes out once, on the first attach after connecting.
  @ObservationIgnored private var readyPending = false

  /// Must be created after `Wearables.configure()`.
  init(glasses: GlassesSession = .shared) {
    self.glasses = glasses
  }

  func connect() {
    guard session == nil else { return }
    lastError = nil
    readyPending = true
    do {
      // Joins the camera's session when it already has one: the glasses take one session.
      session = try glasses.acquire(
        .display,
        onState: { [weak self] state in self?.handleSession(state) },
        onError: { [weak self] message in self?.lastError = "Session: \(message)" }
      )
      handleSession(glasses.state)
    } catch {
      lastError = "Session: \(error.localizedDescription)"
      clear()
    }
  }

  func disconnect() {
    leaving = true
    if let display {
      display.stop()
    } else if session != nil {
      releaseSession()
    }
  }

  /// Leaves the shared session. If the camera still uses it, only the display state clears.
  private func releaseSession() {
    if !glasses.release(.display) { clear() }
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
    guard let session, display == nil else { return }
    do {
      let newDisplay = try session.addDisplay()
      display = newDisplay
      newDisplay.statePublisher.listen { [weak self] state in
        Task { @MainActor in self?.handleDisplay(state) }
      }.store(in: tokens)
      newDisplay.start()
    } catch {
      lastError = "Display: \(error.localizedDescription)"
    }
  }

  /// Attaches the display capability when it isn't on, and waits up to 3 s for it to start.
  private func ensureDisplay() async -> Display? {
    if let display, displayState == .started { return display }
    guard sessionState == .started else { return nil }
    if display == nil { attachDisplay() }
    for _ in 0..<30 where display != nil && displayState != .started {
      try? await Task.sleep(for: .milliseconds(100))
    }
    return displayState == .started ? display : nil
  }

  /// Hands the lens back after `duration`, unless something newer was sent meanwhile.
  private func hide(after duration: Duration, generation: Int) {
    Task { [weak self] in
      try? await Task.sleep(for: duration)
      guard let self, generation == self.screenGeneration else { return }
      self.display?.stop()
    }
  }

  private func handleDisplay(_ state: DisplayState) {
    displayState = state
    switch state {
    case .started:
      if readyPending {
        readyPending = false
        Task { await sendReady() }
      }
    case .stopped:
      // Stopping the display detaches it. Between cards the session stays, so the next card
      // only re-attaches the display; on disconnect, leave the session too (the camera may
      // keep it).
      display = nil
      if leaving { releaseSession() }
    default:
      break
    }
  }

  private func clear() {
    leaving = false
    readyPending = false
    tokens.clear()
    display = nil
    session = nil
    sessionState = .idle
    displayState = .stopped
    swatchesEnabled = true
  }

  /// "facto · Ready" on the lens right after it connects, so the wearer sees it works. A
  /// result card or test screen replaces it; otherwise it clears after `readyDuration`.
  private func sendReady() async {
    guard let display else { return }
    screenGeneration &+= 1
    let generation = screenGeneration
    do {
      try await display.send(DisplayCardBuilder.buildReady())
    } catch {
      lastError = "Send: \(error.localizedDescription)"
      return
    }
    hide(after: Self.readyDuration, generation: generation)
  }

  /// The Developer test screen. Each send replaces the whole screen, so always send the
  /// full layout.
  func sendHome() async {
    guard let display = await ensureDisplay() else { return }
    screenGeneration &+= 1
    let taps = self.taps
    let view = FlexBox(direction: .column, spacing: 12) {
      Text("Display test", style: .heading)
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
  /// If a card with a verdict swatch fails to send, it goes again with the icon, and the
  /// rest of the session leaves swatches out.
  func showCard(_ card: ResultCard?, onRepeat: (@Sendable () -> Void)?, onDismiss: (@Sendable () -> Void)?) async {
    screenGeneration &+= 1
    let generation = screenGeneration
    guard let card else {
      // Cleared on the phone: hand the lens back now.
      display?.stop()
      return
    }
    guard let display = await ensureDisplay(), generation == screenGeneration else { return }
    do {
      do {
        let hadSwatches = swatchesEnabled
        swatchesEnabled = try await DisplayCardBuilder.send(
          card, includeSwatch: hadSwatches, onRepeat: onRepeat, onDismiss: onDismiss,
          using: { try await display.send($0) }
        )
        if hadSwatches && !swatchesEnabled {
          DebugLog.shared.log("display.swatch_dropped", ["kind": card.kind.rawValue])
        }
      }
      hide(after: Self.cardDuration, generation: generation)
    } catch {
      lastError = "Send: \(error.localizedDescription)"
    }
  }
}
