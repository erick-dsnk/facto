import Foundation
import MWDATCore
import MWDATDisplay
import Observation

// No SwiftUI import here: MWDATDisplay has its own Text, Button and Image.

/// Display capability on Meta Ray-Ban Display glasses (real or simulated). Its DeviceSession
/// comes from `GlassesSession.shared`, the one session the camera also uses: on real Display
/// glasses a second session from the app failed with "Session start failed: device unavailable".
@Observable
@MainActor
final class DisplayModel {
  var sessionState: DeviceSessionState = .idle
  var displayState: DisplayState = .stopped
  var taps = 0
  var onReady: (@MainActor () -> Void)?
  private(set) var wantsConnection: Bool
  @ObservationIgnored private let defaults: UserDefaults
  @ObservationIgnored private var appActive = false
  @ObservationIgnored private var authorized = false
  @ObservationIgnored private var hasEligibleDevice = false
  @ObservationIgnored private var sessionGeneration = UUID()
  @ObservationIgnored private var recoveryTask: Task<Void, Never>?
  @ObservationIgnored private var recoveryTaskID = UUID()
  @ObservationIgnored private var selectorTask: Task<Void, Never>?
  /// The session shared with the camera (see GlassesSession).
  @ObservationIgnored private let glasses: GlassesSession
  /// `session` is the DEBUG native preview's own mock session, not the shared one.
  @ObservationIgnored private var ownsPreviewSession = false

  init(defaults: UserDefaults = .standard, glasses: GlassesSession = .shared) {
    self.defaults = defaults
    self.glasses = glasses
    self.wantsConnection = defaults.object(forKey: "nativeDisplay.restoreConnection") as? Bool ?? true
    // The lens follows the glasses in use: it connects when a Display pair is put on and lets
    // go when the wearer switches to Ray-Ban Meta or folds the glasses.
    glasses.observeKind { [weak self] _ in
      guard let self, !self.ownsPreviewSession else { return }
      self.recoverIfEligible()
    }
    selectorTask = Task { [weak self] in
      guard let selector = self?.deviceSelector else { return }
      for await identifier in selector.activeDeviceStream() {
        guard let self else { return }
        self.hasEligibleDevice = identifier != nil
        self.recoverIfEligible()
      }
    }
  }

  func setRecoveryAvailability(active: Bool, authorized: Bool) {
    appActive = active
    self.authorized = authorized
    recoverIfEligible()
  }

  private var recoveryEligible: Bool {
    wantsConnection && appActive && authorized && hasEligibleDevice && !webDisplayEnabled && glasses.kind == .display
  }

  private func recoverIfEligible() {
    guard recoveryEligible else {
      recoveryTask?.cancel()
      recoveryTask = nil
      stopConnection()
      return
    }
    guard session == nil else { return }
    attemptConnection()
    scheduleRecovery()
  }

  private func scheduleRecovery() {
    guard recoveryEligible, displayState != .started, recoveryTask == nil else { return }
    let id = UUID()
    recoveryTaskID = id
    recoveryTask = Task { [weak self] in
      defer { if self?.recoveryTaskID == id { self?.recoveryTask = nil } }
      while !Task.isCancelled {
        for delay in [1.0, 2.0, 4.0, 8.0] {
          try? await Task.sleep(for: .seconds(delay))
          guard !Task.isCancelled, let self, self.recoveryEligible else { return }
          if self.displayState == .started { return }
          if self.session == nil { self.attemptConnection() }
        }
        // Bounded attempt bursts with cooldown while this foreground association remains
        // eligible. Unavailable device, explicit disconnect or suspension cancels the task.
        if let self, self.recoveryEligible, self.displayState != .started, self.session != nil { self.stopConnection() }
        try? await Task.sleep(for: .seconds(15))
        guard !Task.isCancelled, self?.recoveryEligible == true else { return }
      }
    }
  }

  var lastError: String?

  private(set) var webDisplayEnabled = false
  var isConnected: Bool { !webDisplayEnabled && displayState == .started }

  /// Release only DAT display output; camera/microphone capture belongs to CameraModel.
  func setWebDisplayEnabled(_ enabled: Bool) {
    webDisplayEnabled = enabled
    if enabled {
      recoveryTask?.cancel()
      recoveryTask = nil
      recoveryTaskID = UUID()
      stopConnection()
    } else { recoverIfEligible() }
  }

  /// Created once so it has already found a display-capable device when you tap Connect. It
  /// only tells recovery whether a Display pair is around; GlassesSession picks the device.
  @ObservationIgnored private let deviceSelector = AutoDeviceSelector(
    wearables: Wearables.shared, filter: { $0.supportsDisplay() }
  )
  @ObservationIgnored private var session: DeviceSession?
  @ObservationIgnored private var display: Display?
  @ObservationIgnored private let tokens = ListenerTokenBag()
  /// DAT replaces a whole layout. All home, fixture, card and acknowledgement sends share
  /// this queue so a slower old send cannot overwrite a newer card.
  @ObservationIgnored private var outputTask: Task<Void, Never>?
  @ObservationIgnored private var outputGeneration = UUID()
  @ObservationIgnored private var feedbackTask: Task<Void, Never>?
  @ObservationIgnored private var feedbackID: UUID?
  @ObservationIgnored private var triggerFeedback: NativeTriggerFeedback?
  @ObservationIgnored private var latestCard: ResultCard?
  private struct Searching {
    let claimText: String
    let captureLabel: String?
    let sources: [ClaimSourcesPayload.Source]
  }
  @ObservationIgnored private var latestSearch: Searching?
  @ObservationIgnored private var latestRepeat: (@Sendable () -> Void)?
  @ObservationIgnored private var latestDismiss: (@Sendable () -> Void)?

  private func resetLiveOutput() {
    feedbackTask?.cancel()
    feedbackTask = nil
    feedbackID = nil
    triggerFeedback = nil
    latestCard = nil
    latestSearch = nil
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
    let feedback = triggerFeedback
    let card = latestCard
    let search = latestSearch
    let onRepeat = latestRepeat
    let onDismiss = latestDismiss
    await sendSerialized { display in
      if let feedback {
        try await display.send(NativeTriggerFeedbackBuilder.build(feedback))
      } else if let card {
        try await display.send(DisplayCardBuilder.build(card, onRepeat: onRepeat, onDismiss: onDismiss))
      } else if let search {
        try await display.send(NativeLensCardLayout.searching(claimText: search.claimText, captureLabel: search.captureLabel, sources: search.sources))
      } else {
        try await display.clearDisplay()
      }
    }
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

  func connect() {
    wantsConnection = true
    defaults.set(true, forKey: "nativeDisplay.restoreConnection")
    attemptConnection()
    scheduleRecovery()
  }

  /// Joins the camera's session when it has one, or opens the shared session.
  private func attemptConnection() {
    guard !webDisplayEnabled, session == nil else { return }
    lastError = nil
    sessionGeneration = UUID()
    let generation = sessionGeneration
    do {
      session = try glasses.acquire(
        .display,
        onState: { [weak self] state in
          guard let self, self.sessionGeneration == generation else { return }
          self.handleSession(state)
        },
        onError: { [weak self] message in
          guard let self, self.sessionGeneration == generation else { return }
          self.lastError = "Session: \(message)"
          self.stopConnection()
          self.scheduleRecovery()
        }
      )
      handleSession(glasses.state)
    } catch {
      lastError = "Session: \(error.localizedDescription)"
      clear()
    }
  }

  func disconnect() {
    wantsConnection = false
    defaults.set(false, forKey: "nativeDisplay.restoreConnection")
    recoveryTask?.cancel()
    recoveryTask = nil
    stopConnection()
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
        self.scheduleRecovery()
      }
    }.store(in: tokens)
    try newSession.start()
  }

  /// Stops the display and leaves the shared session; the session itself stops only when the
  /// camera isn't using it either. The DEBUG preview's own session is stopped directly.
  private func stopConnection() {
    let oldDisplay = display
    let oldSession = session
    let wasPreview = ownsPreviewSession
    clear()
    if let oldDisplay { oldDisplay.stop() }
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
      clear()
      scheduleRecovery()
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
    } catch {
      lastError = "Display: \(error.localizedDescription)"
      stopConnection()
      scheduleRecovery()
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
      recoveryTask?.cancel()
      recoveryTask = nil
      Task { await sendHome() }
      onReady?()
    case .stopped:
      stopConnection()
      scheduleRecovery()
    default:
      break
    }
  }

  private func clear() {
    sessionGeneration = UUID()
    resetLiveOutput()
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

  /// A connected native display is quiet until there is a current eligible card or action.
  func sendHome() async {
    guard !webDisplayEnabled, display != nil, triggerFeedback == nil, latestCard == nil, latestSearch == nil else { return }
    #if DEBUG
    guard nativePreviewFixture == nil else { return }
    #endif
    await sendSerialized { try await $0.clearDisplay() }
  }

}

extension DisplayModel: LensDisplaying {
  /// A new result always replaces an acknowledgement. Expired acknowledgement timers never
  /// restore a captured old card: only the current card remains eligible for restoration.
  func showCard(_ card: ResultCard?, onRepeat: (@Sendable () -> Void)?, onDismiss: (@Sendable () -> Void)?) async {
    guard !webDisplayEnabled, display != nil else { return }
    #if DEBUG
    guard nativePreviewFixture == nil else { return }
    #endif
    feedbackTask?.cancel()
    feedbackTask = nil
    feedbackID = nil
    triggerFeedback = nil
    latestCard = card
    latestSearch = nil
    latestRepeat = onRepeat
    latestDismiss = onDismiss
    await renderLiveOutput()
  }

  func showSearching(claimText: String, captureLabel: String?, sources: [ClaimSourcesPayload.Source]) async {
    guard isConnected else { return }
    #if DEBUG
    guard nativePreviewFixture == nil else { return }
    #endif
    feedbackTask?.cancel()
    feedbackTask = nil
    feedbackID = nil
    triggerFeedback = nil
    latestCard = nil
    latestSearch = Searching(claimText: claimText, captureLabel: captureLabel, sources: sources)
    await renderLiveOutput()
  }

  func showTriggerFeedback(_ feedback: NativeTriggerFeedback) async {
    guard isConnected else { return }
    #if DEBUG
    guard nativePreviewFixture == nil else { return }
    #endif
    feedbackTask?.cancel()
    let id = UUID()
    feedbackID = id
    triggerFeedback = feedback
    await renderLiveOutput()
    guard feedbackID == id else { return }
    feedbackTask = Task { [weak self] in
      try? await Task.sleep(for: .seconds(feedback.duration))
      guard !Task.isCancelled, let self, self.feedbackID == id else { return }
      self.feedbackTask = nil
      self.feedbackID = nil
      self.triggerFeedback = nil
      await self.renderLiveOutput()
    }
  }

  func clearTriggerFeedback() async {
    guard feedbackID != nil else { return }
    feedbackTask?.cancel()
    feedbackTask = nil
    feedbackID = nil
    triggerFeedback = nil
    await renderLiveOutput()
  }
}
