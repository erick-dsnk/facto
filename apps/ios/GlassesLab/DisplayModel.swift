import Foundation
import MWDATCore
import MWDATDisplay
import MWDATInputs
import Observation

// No SwiftUI import here: MWDATDisplay has its own Text, Button and Image.

/// Display capability on Meta Ray-Ban Display glasses (real or simulated). Its DeviceSession
/// comes from `GlassesSession.shared`, the one session the camera also uses: on real Display
/// glasses a second session from the app failed with "Session start failed: device unavailable".
///
/// The lens opens only while it has something to show (`LensSessionPolicy`): an acknowledgement,
/// a search or a card. A swipe left or right, or back, dismisses it, and it stays closed until
/// something different arrives. A card leaves the lens by itself after `cardHold`.
@Observable
@MainActor
final class DisplayModel {
  var sessionState: DeviceSessionState = .idle
  var displayState: DisplayState = .stopped
  var taps = 0
  /// Called when the lens becomes available (a Display pair is put on), so LiveModel can send
  /// the current card or search again.
  var onReady: (@MainActor () -> Void)?
  /// A worn Display pair is in use, native output is on and the app is active. The lens takes
  /// content only then, and opens a session only while it has some.
  private(set) var isAvailable = false
  private(set) var wantsConnection: Bool
  @ObservationIgnored private let defaults: UserDefaults
  @ObservationIgnored private var appActive = false
  @ObservationIgnored private var authorized = false
  @ObservationIgnored private var hasEligibleDevice = false
  @ObservationIgnored private var sessionGeneration = UUID()
  @ObservationIgnored private var selectorTask: Task<Void, Never>?
  /// The session shared with the camera (see GlassesSession).
  @ObservationIgnored private let glasses: GlassesSession
  /// `session` is the DEBUG native preview's own mock session, not the shared one.
  @ObservationIgnored private var ownsPreviewSession = false
  @ObservationIgnored private var policy = LensSessionPolicy()
  @ObservationIgnored private var content = LensContent()
  @ObservationIgnored private var retryTask: Task<Void, Never>?
  @ObservationIgnored private var idleCloseTask: Task<Void, Never>?
  @ObservationIgnored private var holdTask: Task<Void, Never>?
  @ObservationIgnored private var holdCard: ResultCard?
  /// Developer "Connect display": keeps the lens open with nothing on it.
  @ObservationIgnored private var developerHold = false

  /// How long a card stays on the lens before it leaves by itself.
  static let cardHold: TimeInterval = 15
  /// How long an empty lens stays open in case more follows (a search after "Checking…").
  static let idleClose: TimeInterval = 1

  init(defaults: UserDefaults = .standard, glasses: GlassesSession = .shared) {
    self.defaults = defaults
    self.glasses = glasses
    self.wantsConnection = defaults.object(forKey: "nativeDisplay.restoreConnection") as? Bool ?? true
    // The lens follows the glasses in use: it is available while a Display pair is worn and
    // lets go when the wearer takes them off or switches to Ray-Ban Meta.
    glasses.observeKind { [weak self] _ in self?.reconcile() }
    glasses.observeHolders { [weak self] in self?.reconcile() }
    selectorTask = Task { [weak self] in
      guard let selector = self?.deviceSelector else { return }
      for await identifier in selector.activeDeviceStream() {
        guard let self else { return }
        self.hasEligibleDevice = identifier != nil
        self.reconcile()
      }
    }
  }

  func setRecoveryAvailability(active: Bool, authorized: Bool) {
    appActive = active
    self.authorized = authorized
    reconcile()
  }

  private var lensVisible: Bool {
    wantsConnection && appActive && authorized && hasEligibleDevice && !webDisplayEnabled
      && glasses.kind == .display && glasses.pairWorn
  }

  /// Opens, keeps or closes the lens session to match what there is to show. Every path that
  /// opens a session goes through here, so a retry always waits out the backoff.
  private func reconcile() {
    guard !ownsPreviewSession else { return }
    let visible = lensVisible
    let becameAvailable = visible && !isAvailable
    if visible != isAvailable {
      isAvailable = visible
      log("lens.available", ["available": visible, "kind": glasses.kind.rawValue, "worn": glasses.pairWorn])
      if !visible { resetLiveOutput() }
    }
    policy.lensVisible = visible
    policy.hasContent = content.opensLens || (session != nil && !content.isEmpty) || developerHold
    policy.cameraBusy = glasses.cameraHolds
    let action = policy.action(sessionOpen: session != nil, now: Date())
    if action != .closeWhenIdle {
      idleCloseTask?.cancel()
      idleCloseTask = nil
    }
    if case .retry = action {} else {
      retryTask?.cancel()
      retryTask = nil
    }
    switch action {
    case .none: break
    case .open:
      // The last session is still stopping; its `.stopped` notifies holders and lands here again.
      if glasses.isWindingDown { scheduleRetry(after: 0.5) } else { attemptConnection() }
    case .close: closeLens(visible ? "camera_busy" : "not_visible")
    case .closeWhenIdle: scheduleIdleClose()
    case .retry(let delay): scheduleRetry(after: delay)
    }
    if becameAvailable { onReady?() }
  }

  private func scheduleRetry(after delay: TimeInterval) {
    guard retryTask == nil else { return }
    retryTask = Task { [weak self] in
      try? await Task.sleep(for: .seconds(delay))
      guard !Task.isCancelled, let self else { return }
      self.retryTask = nil
      self.reconcile()
    }
  }

  private func scheduleIdleClose() {
    guard idleCloseTask == nil else { return }
    idleCloseTask = Task { [weak self] in
      try? await Task.sleep(for: .seconds(Self.idleClose))
      guard !Task.isCancelled, let self else { return }
      self.idleCloseTask = nil
      if self.content.isEmpty, !self.developerHold { self.closeLens("nothing_to_show") }
    }
  }

  private func closeLens(_ reason: String) {
    guard session != nil else { return }
    log("lens.close", ["reason": reason])
    stopConnection()
  }

  var lastError: String?

  private(set) var webDisplayEnabled = false
  var isConnected: Bool { !webDisplayEnabled && displayState == .started }

  /// Release only DAT display output; camera/microphone capture belongs to CameraModel.
  func setWebDisplayEnabled(_ enabled: Bool) {
    webDisplayEnabled = enabled
    if enabled {
      resetLiveOutput()
      developerHold = false
      stopConnection()
    }
    reconcile()
  }

  /// Created once so it has already found a display-capable device when you tap Connect. It
  /// only tells the lens whether a Display pair is around; GlassesSession picks the device.
  @ObservationIgnored private let deviceSelector = AutoDeviceSelector(
    wearables: Wearables.shared, filter: { $0.supportsDisplay() }
  )
  @ObservationIgnored private var session: DeviceSession?
  @ObservationIgnored private var display: Display?
  /// Swipes and back from the glasses. With `consumeBack` (the default) back comes here
  /// instead of ending the session.
  @ObservationIgnored private var inputs: Inputs?
  @ObservationIgnored private var inputsTask: Task<Void, Never>?
  @ObservationIgnored private let tokens = ListenerTokenBag()
  /// DAT replaces a whole layout. All home, fixture, card and acknowledgement sends share
  /// this queue so a slower old send cannot overwrite a newer card.
  @ObservationIgnored private var outputTask: Task<Void, Never>?
  @ObservationIgnored private var outputGeneration = UUID()
  @ObservationIgnored private var feedbackTask: Task<Void, Never>?
  @ObservationIgnored private var feedbackID: UUID?
  @ObservationIgnored private var latestRepeat: (@Sendable () -> Void)?
  @ObservationIgnored private var latestDismiss: (@Sendable () -> Void)?

  private func resetLiveOutput() {
    feedbackTask?.cancel()
    feedbackTask = nil
    feedbackID = nil
    holdTask?.cancel()
    holdTask = nil
    holdCard = nil
    content.reset()
    latestRepeat = nil
    latestDismiss = nil
    outputGeneration = UUID()
  }

  private func sendSerialized(_ operation: @escaping @MainActor (Display) async throws -> Void) async {
    guard !webDisplayEnabled, let display else { return }
    let previous = outputTask
    let generation = UUID()
    outputGeneration = generation
    let task = Task { [weak self] in
      await previous?.value
      guard let self, self.outputGeneration == generation, !self.webDisplayEnabled,
            self.display === display else { return }
      do {
        try await operation(display)
      } catch {
        if self.outputGeneration == generation { self.lastError = "Send: \(error.localizedDescription)" }
      }
    }
    outputTask = task
    await task.value
  }

  private func renderLiveOutput() async {
    let feedback = content.feedback
    let card = content.card
    let search = content.search
    let onRepeat = latestRepeat
    let onDismiss = latestDismiss
    let clearEmpty = developerHold
    await sendSerialized { display in
      if let feedback {
        try await display.send(NativeTriggerFeedbackBuilder.build(feedback))
      } else if let card {
        try await display.send(DisplayCardBuilder.build(card, onRepeat: onRepeat, onDismiss: onDismiss))
      } else if let search {
        try await display.send(NativeLensCardLayout.searching(claimText: search.claimText, captureLabel: search.captureLabel, sources: search.sources))
      } else if clearEmpty {
        try await display.clearDisplay()
      }
      // Otherwise the lens is about to close (`idleClose`): an empty frame would be the grey box.
    }
  }

  /// A card leaves the lens `cardHold` after it first appears there (not when it arrives: the
  /// lens may still be opening or waiting for a photo). The phone keeps it until it expires.
  private func armHoldIfShown() {
    guard displayState == .started, let card = content.card, holdCard != card else { return }
    holdCard = card
    holdTask?.cancel()
    holdTask = Task { [weak self] in
      try? await Task.sleep(for: .seconds(Self.cardHold))
      guard !Task.isCancelled, let self, self.content.card == card else { return }
      self.holdTask = nil
      self.holdCard = nil
      self.lensEnded("timeout")
    }
  }

  private func cancelHold() {
    holdTask?.cancel()
    holdTask = nil
    holdCard = nil
  }

  /// The wearer swiped the lens away or pressed back: as `lensEnded`, and a card is dismissed
  /// on the phone too, as the phone's Dismiss button does.
  private func wearerDismissed(_ how: String) {
    let dismissCard = content.card == nil ? nil : latestDismiss
    lensEnded(how)
    dismissCard?()
  }

  /// The lens closes and stays closed until something different arrives: the card timed out,
  /// or the glasses ended the session (back without Inputs, but also a dropped link or the
  /// glasses coming off), so the phone keeps its card.
  private func lensEnded(_ how: String) {
    log("lens.dismissed", ["how": how, "card": content.card != nil, "search": content.search != nil])
    feedbackTask?.cancel()
    feedbackTask = nil
    feedbackID = nil
    cancelHold()
    content.dismiss()
    developerHold = false
    closeLens(how)
    reconcile()
  }

  #if DEBUG
  private(set) var nativePreviewFixture: NativeCardPreviewFixture?
  private(set) var nativePreviewSourceCount = 0
  @ObservationIgnored private var nativePreviewTask: Task<Void, Never>?
  @ObservationIgnored private var nativePreviewGeneration = UUID()

  /// A mock-specific session keeps this experiment away from physical glasses.
  func startNativePreview(_ fixture: NativeCardPreviewFixture, device: DeviceIdentifier) {
    guard !webDisplayEnabled else { return }
    // Automatic native output may already own the simulated display. An explicit DEBUG
    // fixture replaces only that output; the supplied mock selector cannot target hardware.
    if session != nil && nativePreviewFixture == nil { stopConnection() }
    resetLiveOutput()
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
    guard let fixture = nativePreviewFixture, display != nil, !webDisplayEnabled else { return }
    let previous = nativePreviewTask
    previous?.cancel()
    let generation = UUID()
    nativePreviewGeneration = generation
    nativePreviewTask = Task { [weak self] in
      await previous?.value
      guard let self, !Task.isCancelled, self.nativePreviewGeneration == generation else { return }
      do {
        await self.sendSerialized { try await $0.send(NativeCardPreviewBuilder.build(fixture)) }
        if fixture == .listening || fixture == .checking {
          let feedback: NativeTriggerFeedback = fixture == .listening ? .listening : .checking
          try await Task.sleep(for: .seconds(feedback.duration))
          guard !Task.isCancelled, self.nativePreviewGeneration == generation, !self.webDisplayEnabled else { return }
          await self.sendSerialized { try await $0.clearDisplay() }
        } else if fixture == .searching {
          for count in 1...4 {
            try await Task.sleep(for: .milliseconds(700))
            guard !Task.isCancelled, self.nativePreviewGeneration == generation, !self.webDisplayEnabled else { return }
            self.nativePreviewSourceCount = count
            await self.sendSerialized { try await $0.send(NativeCardPreviewBuilder.build(.searching, sourceCount: count)) }
          }
          try await Task.sleep(for: .milliseconds(1400))
          guard !Task.isCancelled, self.nativePreviewGeneration == generation, !self.webDisplayEnabled else { return }
          self.nativePreviewFixture = .supported
          await self.sendSerialized { try await $0.send(NativeCardPreviewBuilder.build(.supported)) }
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

  /// Developer "Connect display": opens the lens with nothing on it (on a worn Display pair).
  func connect() {
    wantsConnection = true
    defaults.set(true, forKey: "nativeDisplay.restoreConnection")
    developerHold = true
    reconcile()
  }

  /// Joins the camera's session when it has one, or opens the shared session.
  private func attemptConnection() {
    guard !webDisplayEnabled, session == nil else { return }
    lastError = nil
    sessionGeneration = UUID()
    let generation = sessionGeneration
    log("lens.open", ["attempt": policy.failures + 1])
    do {
      session = try glasses.acquire(
        .display,
        onState: { [weak self] state in
          guard let self, self.sessionGeneration == generation else { return }
          self.handleSession(state)
        },
        onError: { [weak self] message in
          guard let self, self.sessionGeneration == generation else { return }
          self.sessionFailed(message)
        }
      )
      handleSession(glasses.state)
    } catch {
      lastError = "Session: \(error.localizedDescription)"
      clear()
      openFailed(error.localizedDescription)
    }
  }

  /// "Session ended by device" is the wearer leaving the lens (back, when Inputs isn't
  /// consuming it): treat it as a dismissal, never reopen for the same content. Anything else
  /// is a failed open and backs off.
  private func sessionFailed(_ message: String) {
    lastError = "Session: \(message)"
    stopConnection()
    if GlassesSession.isEndedByDevice(message) {
      lensEnded("ended_by_device")
    } else {
      openFailed(message)
    }
  }

  private func openFailed(_ message: String) {
    policy.openFailed(at: Date())
    log("lens.open_failed", [
      "message": message, "failures": policy.failures,
      "retryIn": policy.retryAt.map { max(0, $0.timeIntervalSinceNow) } as Any,
    ])
    reconcile()
  }

  func disconnect() {
    wantsConnection = false
    defaults.set(false, forKey: "nativeDisplay.restoreConnection")
    developerHold = false
    stopConnection()
    reconcile()
  }

  /// Starts the DEBUG native preview's own session on a mock device (never the shared one).
  private func observeAndStart(_ newSession: DeviceSession) throws {
    sessionGeneration = UUID()
    let generation = sessionGeneration
    session = newSession
    ownsPreviewSession = true
    newSession.statePublisher.listen { [weak self] state in
      Task { @MainActor in
        guard let self, self.sessionGeneration == generation else { return }
        self.handleSession(state)
      }
    }.store(in: tokens)
    newSession.errorPublisher.listen { [weak self] error in
      Task { @MainActor in
        guard let self, self.sessionGeneration == generation else { return }
        self.lastError = "Session: \(error.localizedDescription)"
        self.stopConnection()
      }
    }.store(in: tokens)
    try newSession.start()
  }

  /// Stops the display and leaves the shared session; the session itself stops only when the
  /// camera isn't using it either. The DEBUG preview's own session is stopped directly.
  private func stopConnection() {
    let oldDisplay = display
    let oldSession = session
    let hadInputs = inputs != nil
    let wasPreview = ownsPreviewSession
    clear()
    if let oldDisplay { oldDisplay.stop() }
    // A camera still on the session must not keep swallowing the glasses' back gesture.
    if hadInputs { try? oldSession?.removeInputs() }
    if wasPreview {
      oldSession?.stop()
    } else if oldSession != nil {
      glasses.release(.display)
    }
  }

  private func handleSession(_ state: DeviceSessionState) {
    sessionState = state
    switch state {
    case .started:
      attachDisplay()
    case .stopped:
      // Stopped by the glasses without an error. With the lens up that's the wearer leaving
      // it; before that, a failed open.
      let hadLens = displayState == .started
      clear()
      if hadLens { lensEnded("stopped_by_device") } else { openFailed("stopped before the lens started") }
    default:
      break
    }
  }

  private func attachDisplay() {
    guard !webDisplayEnabled, let session, display == nil else {
      if webDisplayEnabled { stopConnection() }
      return
    }
    do {
      let newDisplay = try session.addDisplay()
      display = newDisplay
      let generation = sessionGeneration
      newDisplay.statePublisher.listen { [weak self] state in
        Task { @MainActor in
          guard let self, self.sessionGeneration == generation else { return }
          self.handleDisplay(state)
        }
      }.store(in: tokens)
      newDisplay.start()
      attachInputs(to: session)
    } catch {
      lastError = "Display: \(error.localizedDescription)"
      stopConnection()
      openFailed("Display: \(error.localizedDescription)")
    }
  }

  /// Inputs is experimental in DAT 1.0: if it can't attach, the lens still works and back
  /// still dismisses it (as "Session ended by device"); only swipes are lost.
  private func attachInputs(to session: DeviceSession) {
    guard !ownsPreviewSession else { return }
    let generation = sessionGeneration
    do {
      guard let newInputs = try session.addInputs() else {
        log("lens.inputs", ["state": "unavailable"])
        return
      }
      inputs = newInputs
      newInputs.statePublisher.listen { [weak self] state in
        Task { @MainActor in
          guard let self, self.sessionGeneration == generation else { return }
          self.log("lens.inputs", ["state": "\(state)"])
        }
      }.store(in: tokens)
      newInputs.errorPublisher.listen { [weak self] error in
        Task { @MainActor in
          guard let self, self.sessionGeneration == generation else { return }
          self.log("lens.inputs_error", ["error": String(describing: error)])
        }
      }.store(in: tokens)
      inputsTask = Task { [weak self] in
        for await event in newInputs.events {
          guard let self, self.sessionGeneration == generation else { return }
          self.handleInput(event)
        }
      }
    } catch {
      log("lens.inputs_error", ["error": String(describing: error)])
    }
  }

  private func handleInput(_ event: InputEvent) {
    log("lens.input", ["event": String(describing: event)])
    switch event {
    case .nav(let direction, _, _):
      if direction == .left { wearerDismissed("swipe_left") }
      if direction == .right { wearerDismissed("swipe_right") }
    case .back:
      wearerDismissed("back")
    case .select:
      taps += 1
    default:
      break
    }
  }

  private func handleDisplay(_ state: DisplayState) {
    let wasStarted = displayState == .started
    displayState = state
    switch state {
    case .started:
      #if DEBUG
      if nativePreviewFixture != nil {
        sendNativePreview()
        return
      }
      #endif
      policy.opened()
      log("lens.opened", ["card": content.card != nil, "search": content.search != nil, "feedback": content.feedback != nil])
      Task { [weak self] in
        await self?.renderLiveOutput()
        self?.armHoldIfShown()
      }
      reconcile()
    case .stopped:
      // Stopped after it was up: the glasses took the lens back (counting it as a failure
      // reopened it a second later). Before that: a failed open.
      stopConnection()
      if wasStarted { lensEnded("display_stopped") } else { openFailed("display stopped") }
    default:
      break
    }
  }

  /// Session-level state only: the lens content survives a reconnect.
  private func clear() {
    sessionGeneration = UUID()
    outputGeneration = UUID()
    inputsTask?.cancel()
    inputsTask = nil
    inputs = nil
    #if DEBUG
    cancelNativePreview()
    #endif
    tokens.clear()
    display = nil
    session = nil
    ownsPreviewSession = false
    sessionState = .idle
    displayState = .stopped
  }

  /// Developer "Send test screen": clears the lens when nothing else is on it.
  func sendHome() async {
    guard !webDisplayEnabled, display != nil, content.isEmpty else { return }
    #if DEBUG
    guard nativePreviewFixture == nil else { return }
    #endif
    await sendSerialized { try await $0.clearDisplay() }
  }

  private func log(_ kind: String, _ payload: [String: Any]) {
    DebugLog.shared.log(kind, payload)
  }
}

extension DisplayModel: LensDisplaying {
  /// A new result always replaces an acknowledgement. Expired acknowledgement timers never
  /// restore a captured old card: only the current card remains eligible for restoration.
  func showCard(_ card: ResultCard?, onRepeat: (@Sendable () -> Void)?, onDismiss: (@Sendable () -> Void)?) async {
    guard !webDisplayEnabled, isAvailable else { return }
    #if DEBUG
    guard nativePreviewFixture == nil else { return }
    #endif
    guard content.show(card: card) else { return }
    feedbackTask?.cancel()
    feedbackTask = nil
    feedbackID = nil
    latestRepeat = onRepeat
    latestDismiss = onDismiss
    if card != holdCard { cancelHold() }
    reconcile()
    await renderLiveOutput()
    armHoldIfShown()
  }

  func showSearching(claimText: String, captureLabel: String?, sources: [ClaimSourcesPayload.Source]) async {
    guard !webDisplayEnabled, isAvailable else { return }
    #if DEBUG
    guard nativePreviewFixture == nil else { return }
    #endif
    guard content.show(search: LensContent.Search(claimText: claimText, captureLabel: captureLabel, sources: sources)) else { return }
    feedbackTask?.cancel()
    feedbackTask = nil
    feedbackID = nil
    cancelHold()
    reconcile()
    await renderLiveOutput()
  }

  func showTriggerFeedback(_ feedback: NativeTriggerFeedback) async {
    // An acknowledgement never opens the lens (see `LensContent.opensLens`); without an open
    // lens it is dropped so it can't show up stale later.
    guard !webDisplayEnabled, isAvailable, session != nil else { return }
    #if DEBUG
    guard nativePreviewFixture == nil else { return }
    #endif
    feedbackTask?.cancel()
    let id = UUID()
    feedbackID = id
    content.show(feedback: feedback)
    reconcile()
    await renderLiveOutput()
    guard feedbackID == id else { return }
    feedbackTask = Task { [weak self] in
      try? await Task.sleep(for: .seconds(feedback.duration))
      guard !Task.isCancelled, let self, self.feedbackID == id else { return }
      self.feedbackTask = nil
      self.feedbackID = nil
      self.content.show(feedback: nil)
      self.reconcile()
      await self.renderLiveOutput()
    }
  }

  func clearTriggerFeedback() async {
    guard feedbackID != nil else { return }
    feedbackTask?.cancel()
    feedbackTask = nil
    feedbackID = nil
    content.show(feedback: nil)
    reconcile()
    await renderLiveOutput()
  }
}
