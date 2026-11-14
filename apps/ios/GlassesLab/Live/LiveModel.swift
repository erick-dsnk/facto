import AVFoundation
import Foundation
import Observation
import os
import UIKit

// Live mode: wires BackendClient, AudioStreamer, LookAndCheckCoordinator and ResultPresenter
// to the glasses camera and display. Rules from docs/live-pipeline.md that apply here:
// - The camera stream is never paused or stopped for a photo (decision 5a).
// - Provider keys never reach the app; it talks only to services/api.
// - Logs carry ids, codes and counts. Never audio, transcripts or OCR text. The on-device
//   DebugLog is the exception (Debug/DebugLog.swift): photos, OCR text and transcripts stay
//   on the phone for 24 hours while its toggle is on.

// MARK: - Seams

/// Stream settings Live mode asks for (decision 10).
enum StreamQuality: String, CaseIterable, Sendable {
  /// 720x1280 at 30 fps: filming, the "check this" moment, a visible live view.
  case demo
  /// 360x640 at 15 fps: long listening sessions where only audio matters.
  case listening

  var summary: String {
    switch self {
    case .demo: "High 720×1280 at 30 fps"
    case .listening: "Low 360×640 at 15 fps"
    }
  }
}

/// The backend connection Live mode drives. `BackendClient` is the real one.
@MainActor
protocol LiveBackend: SessionChannel, CheckSubmitter {
  var config: BackendConfig { get }
  /// Called for each event the app couldn't read (contract drift). Argument: the event type.
  var onUnreadableEvent: (@MainActor (_ type: String?) -> Void)? { get set }
  var requiresAuthentication: Bool { get }
  func connect() async throws
  func suspend()
  func resume() async throws
  func close() async
  func requestDisplayGrant() async throws -> DisplayGrant
  func revokeDisplayGrants() async throws
  func cancel(requestId: String) async throws
}

extension LiveBackend {
  var requiresAuthentication: Bool { false }
  func suspend() {}
  func resume() async throws { try await connect() }
  func requestDisplayGrant() async throws -> DisplayGrant { throw WebDisplayLinkError.unavailable }
  func revokeDisplayGrants() async throws { throw WebDisplayLinkError.unavailable }
  func cancel(requestId: String) async throws { throw WebDisplayLinkError.unavailable }
}

extension BackendClient: LiveBackend {}

/// The glasses camera as Live mode needs it. `CameraModel` is the real one.
@MainActor
protocol LiveCamera: PhotoCapturing {
  var isStreaming: Bool { get }
  var hasSession: Bool { get }
  var onCaptureStarting: (@MainActor () -> Void)? { get set }
  var onCaptureSessionEnded: (@MainActor () -> Void)? { get set }
  /// Quality for a stream that Live mode starts, including one started by "Check this".
  var liveQuality: StreamQuality { get set }
  var onAudioBuffer: (@MainActor (AVAudioPCMBuffer) -> Void)? { get set }
  var onStreamStopped: (@MainActor (_ byUser: Bool) -> Void)? { get set }
  func startListeningStream(quality: StreamQuality) async throws
  /// Ends a stream Live mode started for the wake phrase, and its device session, so the
  /// glasses go back to idle. Returns once they have stopped (or after a few seconds).
  func stopLiveStream() async
}

/// The glasses lens. `DisplayModel` is the real one.
@MainActor
protocol LensDisplaying: AnyObject {
  var isConnected: Bool { get }
  var onReady: (@MainActor () -> Void)? { get set }
  func showSearching(claimText: String, captureLabel: String?, sources: [ClaimSourcesPayload.Source]) async
  func setWebDisplayEnabled(_ enabled: Bool)
  func showCard(_ card: ResultCard?, onRepeat: (@Sendable () -> Void)?, onDismiss: (@Sendable () -> Void)?) async
  func showTriggerFeedback(_ feedback: NativeTriggerFeedback) async
  func clearTriggerFeedback() async
}

extension LensDisplaying {
  var onReady: (@MainActor () -> Void)? { get { nil } set {} }
  func showSearching(claimText: String, captureLabel: String?, sources: [ClaimSourcesPayload.Source]) async {}
  func setWebDisplayEnabled(_ enabled: Bool) {}
  func showTriggerFeedback(_ feedback: NativeTriggerFeedback) async {}
  func clearTriggerFeedback() async {}
}

/// ResultPresenter keeps its playback reporter weakly and fixes it at init. The relay lives as
/// long as LiveModel and forwards to the current AudioStreamer, so every playback report goes
/// through the streamer (it sends `playback.started` / `playback.ended` itself).
@MainActor
final class PlaybackRelay: PlaybackReporting {
  weak var target: PlaybackReporting?
  func playbackStarted() { target?.playbackStarted() }
  func playbackEnded() { target?.playbackEnded() }
}

// MARK: - Status

/// The backend half of the home screen's status line (HomeStatus adds the glasses). Each
/// failure has its own state, so a broken
/// connection never looks like "no alerts" (decision 9).
enum LiveStatus: Equatable, Sendable {
  case offline
  case connecting
  /// Connected to the backend, not listening.
  case connected
  case startingToListen
  case listening
  case reconnecting(attempt: Int)
  /// Listening stopped for a reason other than the user's own Stop.
  case listeningStopped(AudioStreamerStopReason)
  /// The connection failed or dropped. `code` is the client's short reason code.
  case backendError(code: String)

  enum Tone: Equatable, Sendable { case neutral, good, warning, bad }

  static func make(connection: ChannelConnectionState, listening: AudioStreamerPhase, startingStream: Bool = false) -> LiveStatus {
    switch connection {
    case .idle:
      return .offline
    case .connecting:
      return .connecting
    case .reconnecting(let attempt):
      return .reconnecting(attempt: attempt)
    case .disconnected(let reason):
      return reason == "closed" ? .offline : .backendError(code: reason)
    case .connected:
      switch listening {
      case .idle, .stopped(.requested):
        return startingStream ? .startingToListen : .connected
      case .stopped(let reason):
        return startingStream ? .startingToListen : .listeningStopped(reason)
      case .waitingForConnection, .awaitingReady:
        return .startingToListen
      case .streaming, .pausedForPlayback:
        return .listening
      case .reconnecting:
        return .reconnecting(attempt: 0)
      }
    }
  }

  var title: String {
    switch self {
    case .offline: "Offline"
    case .connecting: "Connecting…"
    case .connected: "Online"
    case .startingToListen: "Starting to listen…"
    case .listening: "Listening"
    case .reconnecting: "Reconnecting…"
    case .listeningStopped(let reason):
      switch reason {
      case .glassesDisconnected: "Listening stopped: glasses disconnected"
      case .noConnection: "Listening stopped: no connection"
      case .sessionEnded: "Listening stopped: session ended"
      case .audioUnavailable: "Listening stopped: mic unavailable"
      // `make` turns the user's own Stop into `.connected`.
      case .requested: "Online"
      }
    case .backendError(let code): Self.errorTitle(code)
    }
  }

  var detail: String {
    switch self {
    case .offline: "Tap Reconnect to go online."
    case .connecting: "Opening a session."
    case .connected: "Tap Start listening, or Check this to read what’s in front of you."
    case .startingToListen: "Waiting for the glasses stream and the backend."
    case .listening: "No alert doesn’t mean a claim is true."
    case .reconnecting(let attempt):
      attempt > 0 ? "Connection dropped. Attempt \(attempt) of 3." : "Connection dropped."
    case .listeningStopped: "Tap Start listening to try again."
    case .backendError(let code):
      code == "missing_join_code" ? "Add your join code in Settings." : "Reason: \(code)."
    }
  }

  var symbol: String {
    switch self {
    case .offline: "bolt.horizontal.circle"
    case .connecting, .startingToListen: "hourglass"
    case .connected: "checkmark.circle"
    case .listening: "waveform"
    case .reconnecting: "arrow.triangle.2.circlepath"
    case .listeningStopped: "mic.slash.fill"
    case .backendError: "exclamationmark.triangle.fill"
    }
  }

  var tone: Tone {
    switch self {
    case .offline, .connected: .neutral
    case .listening: .good
    case .connecting, .startingToListen, .reconnecting: .warning
    case .listeningStopped, .backendError: .bad
    }
  }

  private static func errorTitle(_ code: String) -> String {
    switch code {
    case "network_lost", "connect_failed": "Connection lost"
    case "unauthorized", "http_401", "http_403": "Join code rejected"
    case "deleted", "expired": "Session ended"
    case "connect_timeout", "timed_out": "Backend not responding"
    case "missing_join_code": "Join code needed"
    case "invalid_url": "Backend URL not valid"
    case "insecure_url": "Backend URL needs https"
    default: "Backend error"
    }
  }
}

// MARK: - Model

@Observable
@MainActor
final class LiveModel {
  static let demoQualityKey = "live.demoQuality"
  static let mutedKey = "live.muted"
  static let automaticAlertsKey = "live.automaticAlerts"
  static let wakeWordKey = "live.wakeWord"
  static let connectionIntentKey = "live.restoreBackendConnection"
  /// How long listening stays on after the wake phrase, before the stream is stopped again.
  nonisolated static let defaultWakeWindow: TimeInterval = 60
  /// How long the stream stays on for a "Check this" tapped while waiting for the phrase.
  nonisolated static let defaultWakeCheckWindow: TimeInterval = 20
  /// `pipeline.error` codes without a request id that are routine: admission throttling of
  /// automatic sentences, and audio stragglers AudioStreamer recovers from on its own.
  /// They are counted in the log, never shown as a backend error.
  static let quietErrorCodes: Set<String> = [
    "automatic_cooldown", "queue_full", "stale_capture", "request_capacity", "idempotency_conflict", "old_revision",
    "audio_not_ready", "audio_backlog", "audio_gap", "audio_already_started", "playback_active",
    "invalid_audio_generation", "old_epoch", "invalid_asr_transcript",
  ]
  /// A manual check with no outcome after this long is reported as "The check didn't finish."
  /// The backend's own deadline is 10 s.
  nonisolated static let defaultCheckTimeout: TimeInterval = 15
  /// Shown when Start listening or Check this runs without a backend session.
  static let offlineMessage = "Facto is offline. Tap Reconnect."
  /// Shown when a paused backend session didn't resume in time.
  static let pausedMessage = "The backend session is paused. Tap Reconnect."

  // MARK: Settings (UserDefaults)

  var baseURLText: String
  var joinCode: String
  var demoQuality: Bool {
    didSet {
      defaults.set(demoQuality, forKey: Self.demoQualityKey)
      camera.liveQuality = quality
    }
  }
  var isMuted: Bool {
    didSet {
      presenter.isMuted = isMuted
      defaults.set(isMuted, forKey: Self.mutedKey)
    }
  }
  /// Lets the backend flag contradicted claims it hears with a chime and a card (decision 7).
  /// Sent as `session.preferences`; the server's own default is off.
  var automaticAlerts: Bool {
    didSet {
      defaults.set(automaticAlerts, forKey: Self.automaticAlertsKey)
      if automaticAlerts != oldValue { sendPreferences() }
    }
  }

  /// Off by default. On: the glasses stream stays off and nothing that is said is sent until
  /// "Hey Facto" is heard by the on-device detector (issue #53).
  var wakeWordEnabled: Bool {
    didSet {
      defaults.set(wakeWordEnabled, forKey: Self.wakeWordKey)
      guard wakeWordEnabled != oldValue else { return }
      wakeFailure = nil
      if wakeWordEnabled {
        refreshWake()
      } else {
        // Invalidate a suspended startup synchronously; its SDK await may finish before
        // the cleanup task gets its next turn on the main actor.
        wakeStartTask?.cancel()
        Task { await self.endWakeSession() }
      }
    }
  }

  // MARK: State

  private(set) var connection: ChannelConnectionState = .idle
  private(set) var wantsBackendConnection: Bool
  private(set) var isAppActive = true
  private(set) var glassesAuthorized = true
  @ObservationIgnored private var captureCleanup: Task<Void, Never>?
  @ObservationIgnored private var captureCleanupID = UUID()
  @ObservationIgnored private var lifecycleGeneration = UUID()
  @ObservationIgnored private var captureGeneration = UUID()
  @ObservationIgnored private var isRestoringConnection = false
  @ObservationIgnored private var pendingCardEligibility: NativeCardEligibility?
  @ObservationIgnored private var pendingCaptureLabel: String?
  @ObservationIgnored private var cardEligibility: NativeCardEligibility?
  @ObservationIgnored private var recoverableCard: ResultCard?
  @ObservationIgnored private var cardExpiryTask: Task<Void, Never>?
  @ObservationIgnored private var searchState: NativeSearchState?
  private struct NativeSearchState {
    let requestId: String
    let sessionId: String
    let epoch: Int
    let claimText: String
    let captureLabel: String?
    var sources: [ClaimSourcesPayload.Source] = []
  }
  private(set) var listening: AudioStreamerPhase = .idle {
    didSet {
      updateKeepAwake()
      if listening.isActive != oldValue.isActive { refreshWake() }
      if listening != oldValue { debugLog.log("live.listening", ["phase": String(describing: listening)]) }
    }
  }
  private(set) var wakeState: WakeWordState = .off {
    didSet { updateKeepAwake() }
  }
  private(set) var isStartingStream = false
  /// The last non-fatal problem, e.g. a stream that wouldn't start or a backend error code.
  private(set) var notice: String? {
    didSet { if let notice, notice != oldValue { debugLog.log("live.notice", ["text": notice]) } }
  }
  /// Phone-side status of the last "Check this".
  private(set) var checkMessage: String? {
    didSet { if let checkMessage, checkMessage != oldValue { debugLog.log("live.check_message", ["text": checkMessage]) } }
  }
  /// Manual checks waiting for an outcome.
  private(set) var pendingChecks: Set<String> = []
  /// From `session.ready` / `session.ended`. Nil until the first event.
  private(set) var sessionActive: Bool?
  /// From `session.ready`. False when the backend has no speech recognition.
  private(set) var speechAvailable: Bool?

  var status: LiveStatus { .make(connection: connection, listening: listening, startingStream: isStartingStream) }
  var quality: StreamQuality { demoQuality ? .demo : .listening }
  var isConnected: Bool { connection == .connected }
  var isListening: Bool { listening.isActive }
  var canEditBackend: Bool {
    switch connection {
    case .idle, .disconnected: true
    default: false
    }
  }
  var checkPhase: LookAndCheckCoordinator.Phase { coordinator?.phase ?? .idle }
  var isChecking: Bool { checkPhase != .idle }

  let webDisplay: WebDisplayConnection
  private(set) var isSwitchingDisplay = false
  @ObservationIgnored private var displayModeGeneration = 0
  @ObservationIgnored private var displayHandoffGeneration = 0
  @ObservationIgnored private var displayHandoff: Task<Void, Never>?
  var displayOutputMode: DisplayOutputMode = .native {
    didSet {
      guard displayOutputMode != oldValue else { return }
      displayModeGeneration += 1
      let generation = displayModeGeneration
      clearTriggerAcknowledgement()
      webDisplay.invalidate()
      if displayOutputMode == .web {
        display?.setWebDisplayEnabled(true)
      } else {
        // Readers must be disconnected before native output can take over the lens.
        // Keep capture/listening running if the network cannot confirm revocation.
        let switchingBackend = backend
        let previousHandoff = displayHandoff
        isSwitchingDisplay = true
        displayHandoffGeneration = generation
        displayHandoff = Task { [weak self] in
          if let previousHandoff { await previousHandoff.value }
          guard let self else { return }
          defer {
            if self.displayHandoffGeneration == generation { self.isSwitchingDisplay = false }
          }
          do {
            if let switchingBackend { try await switchingBackend.revokeDisplayGrants() }
          } catch {
            guard self.displayModeGeneration == generation, self.backend === switchingBackend else { return }
            self.displayOutputMode = .web
            self.notice = "Couldn't revoke the web display. Capture continues; retry Native display when the connection is available."
            return
          }
          guard self.displayModeGeneration == generation, self.displayOutputMode == .native,
                self.backend === switchingBackend else { return }
          self.display?.setWebDisplayEnabled(false)
          self.restoreNativePresentation()
        }
      }
    }
  }

  private(set) var webDisplayRequestId: String?

  /// A phone-only action. No owner token or join code enters the generated browser URL.
  func prepareWebDisplay() async {
    // An older revoke must finish before a newly selected web reader can be minted.
    while isSwitchingDisplay, let displayHandoff { await displayHandoff.value }
    guard displayOutputMode == .web, let backend, isConnected else { return }
    if webDisplay.appURLText.isEmpty { webDisplay.appURLText = backend.config.baseURL.appending(path: "display/").absoluteString }
    webDisplay.updateSession(id: backend.sessionId, epoch: backend.sessionEpoch)
    await webDisplay.prepare(apiURL: backend.config.baseURL) { try await backend.requestDisplayGrant() }
  }

  let history: ResultHistory
  let lens: LensCardViewModel

  // MARK: Dependencies

  @ObservationIgnored private let camera: LiveCamera
  @ObservationIgnored private let display: LensDisplaying?
  @ObservationIgnored private let presenter: ResultPresenter
  @ObservationIgnored private let speaker: SpeechSpeaking
  @ObservationIgnored private let chime: ChimePlaying
  @ObservationIgnored private let relay: PlaybackRelay
  @ObservationIgnored private let recognizer: TextRecognizing
  @ObservationIgnored private let makeBackend: @MainActor (BackendConfig) -> LiveBackend
  @ObservationIgnored private let audioClock: AudioStreamerClock?
  @ObservationIgnored private let checkTimeout: TimeInterval
  @ObservationIgnored private let defaults: UserDefaults
  @ObservationIgnored private let secrets: SecretStoring
  @ObservationIgnored private let configureAudioSession: () -> Void
  /// Listening input: the glasses' Bluetooth mic. The camera only takes Check this photos.
  @ObservationIgnored private let mic: ListeningMicrophone
  @ObservationIgnored private let idleTimer: (_ keepAwake: Bool) -> Void
  @ObservationIgnored private let uptime: () -> TimeInterval
  @ObservationIgnored private let debugLog: DebugLog
  @ObservationIgnored private let wake: WakeWordListening
  @ObservationIgnored private let wakeWindow: TimeInterval
  @ObservationIgnored private let wakeCheckWindow: TimeInterval
  @ObservationIgnored private let log = Logger(subsystem: "com.davidvasilescu.junction.glasseslab", category: "live")

  @ObservationIgnored private var backend: LiveBackend?
  @ObservationIgnored private var streamer: AudioStreamer?
  @ObservationIgnored private var coordinator: LookAndCheckCoordinator?
  @ObservationIgnored private var subscriptions: [Task<Void, Never>] = []
  @ObservationIgnored private var ticker: Task<Void, Never>?
  @ObservationIgnored private var checkTimers: [String: Task<Void, Never>] = [:]
  /// Manual request ids that already had an outcome, so a late 202 starts no timer.
  @ObservationIgnored private var resolvedChecks: Set<String> = []
  /// Outcomes of each photo's chunks, keyed by `LookAndCheckCoordinator.photoKey`.
  @ObservationIgnored private var photoChecks: [String: PhotoCheck] = [:]
  /// Lens updates and brief acknowledgements go through one ordered stream.
  private enum LensUpdate {
    case card(ResultCard?)
    case searching(NativeSearchState)
    case feedback(NativeTriggerFeedback)
    case clearFeedback
  }
  @ObservationIgnored private var lensUpdates: AsyncStream<LensUpdate>.Continuation?
  @ObservationIgnored private var acknowledgeListeningOnReady = false
  @ObservationIgnored private var acknowledgedChecks: Set<String> = []
  @ObservationIgnored private var feedbackRequestId: String?
  @ObservationIgnored private var lensPump: Task<Void, Never>?
  /// True from the wake phrase (or a "Check this" tapped while waiting) until the stream that
  /// it started has been stopped again.
  @ObservationIgnored private var wakeSession = false
  @ObservationIgnored private var wakeStartedStream = false
  @ObservationIgnored private var wakeSessionID: UUID?
  @ObservationIgnored private var wakeStartTask: Task<Void, Never>?
  @ObservationIgnored private var wakeCleanupTask: Task<Void, Never>?
  @ObservationIgnored private var manualCaptureStarting = false
  @ObservationIgnored private var wakeTimer: Task<Void, Never>?
  @ObservationIgnored private var wakeStarting = false
  /// Why the detector couldn't start. Cleared by toggling the option or by Connect.
  @ObservationIgnored private var wakeFailure: String?
  @ObservationIgnored private var keptAwake = false

  /// What one photo's chunks came back with. The user hears one answer per photo: a verdict
  /// is presented as it arrives; a "not sure" or failure only when no chunk gave a verdict.
  private struct PhotoCheck {
    var expected: Int?
    var resolved: Set<String> = []
    var hadResult = false
    var failed = false
    /// Some chunk came back skipped or unclear, as opposed to only cancelled.
    var unsure = false
  }

  init(
    camera: LiveCamera,
    display: LensDisplaying?,
    defaults: UserDefaults = .standard,
    secrets: SecretStoring = KeychainSecretStore(),
    speaker: SpeechSpeaking? = nil,
    chime: ChimePlaying? = nil,
    recognizer: TextRecognizing? = nil,
    audioClock: AudioStreamerClock? = nil,
    checkTimeout: TimeInterval = LiveModel.defaultCheckTimeout,
    configureAudioSession: (() -> Void)? = nil,
    idleTimer: ((_ keepAwake: Bool) -> Void)? = nil,
    uptime: (() -> TimeInterval)? = nil,
    debugLog: DebugLog = .shared,
    wakeListener: WakeWordListening? = nil,
    wakeWindow: TimeInterval = LiveModel.defaultWakeWindow,
    wakeCheckWindow: TimeInterval = LiveModel.defaultWakeCheckWindow,
    microphone: ListeningMicrophone? = nil,
    makeBackend: (@MainActor (BackendConfig) -> LiveBackend)? = nil
  ) {
    let config = BackendConfig.load(from: defaults, secrets: secrets)
    self.webDisplay = WebDisplayConnection(defaults: defaults)
    self.baseURLText = config.baseURL.absoluteString
    self.joinCode = config.joinCode
    self.wantsBackendConnection = defaults.object(forKey: Self.connectionIntentKey) as? Bool ?? !config.joinCode.isEmpty
    self.demoQuality = defaults.object(forKey: Self.demoQualityKey) as? Bool ?? true
    self.isMuted = defaults.bool(forKey: Self.mutedKey)
    self.automaticAlerts = defaults.object(forKey: Self.automaticAlertsKey) as? Bool ?? true
    // On by default: "Hey Facto" is how a check starts without touching the phone.
    self.wakeWordEnabled = defaults.object(forKey: Self.wakeWordKey) as? Bool ?? true
    let wakeListener = wakeListener ?? MicrophoneWakeWordListener()
    self.wake = wakeListener
    self.wakeWindow = wakeWindow
    self.wakeCheckWindow = wakeCheckWindow
    self.camera = camera
    self.mic = microphone ?? GlassesMicrophone()
    self.display = display
    self.defaults = defaults
    self.secrets = secrets
    let speaker = speaker ?? SystemSpeechSpeaker()
    let chime = chime ?? ToneChimePlayer()
    self.speaker = speaker
    self.chime = chime
    self.recognizer = recognizer ?? OCRService()
    self.audioClock = audioClock
    self.checkTimeout = checkTimeout
    self.configureAudioSession = configureAudioSession ?? LiveModel.configureSpokenOutput
    self.idleTimer = idleTimer ?? { UIApplication.shared.isIdleTimerDisabled = $0 }
    self.uptime = uptime ?? { ProcessInfo.processInfo.systemUptime }
    self.debugLog = debugLog
    self.makeBackend = makeBackend ?? { BackendClient(config: $0, debugLog: debugLog) }
    let history = ResultHistory()
    let lens = LensCardViewModel()
    let relay = PlaybackRelay()
    self.history = history
    self.lens = lens
    self.relay = relay
    self.presenter = ResultPresenter(speaker: speaker, chime: chime, playback: relay, history: history, lens: lens, debugLog: debugLog)
    presenter.isMuted = isMuted

    lens.onChange = { [weak self] card in self?.lensChanged(card) }
    display?.onReady = { [weak self] in self?.restoreNativePresentation() }
    camera.liveQuality = quality
    camera.onStreamStopped = { [weak self] byUser in self?.streamStopped(byUser: byUser) }
    camera.onAudioBuffer = { [weak self] buffer in self?.streamer?.append(buffer) }
    mic.onBuffer = { [weak self] buffer in self?.streamer?.append(buffer) }
    camera.onCaptureStarting = { [weak self] in
      guard let self else { return }
      self.pauseWakeDetector()
      if self.wakeWordEnabled && !self.wakeSession {
        self.wakeState = .blocked("Paused while the glasses session is on.")
      }
    }
    camera.onCaptureSessionEnded = { [weak self] in self?.refreshWake() }
    wakeListener.onWake = { [weak self] command in self?.wakeHeard(command) }
    startLensPump()
    refreshWake()
  }

  // MARK: Connection

  /// Saves the URL and join code, then opens a session and its event stream.
  func connect() async { await connect(restoring: false) }

  private func connect(restoring: Bool) async {
    guard isAppActive, canEditBackend else { return }
    let generation = lifecycleGeneration
    notice = nil
    wakeFailure = nil
    defer { refreshWake() }
    let text = baseURLText.trimmingCharacters(in: .whitespacesAndNewlines)
    guard let url = URL(string: text), url.scheme == "http" || url.scheme == "https", let host = url.host() else {
      debugLog.log("live.connect_rejected", ["reason": "invalid_url", "url": text])
      connection = .disconnected(reason: "invalid_url")
      return
    }
    // The join code and the session token must never cross the internet in clear text.
    guard url.scheme == "https" || Self.allowsCleartext(host: host) else {
      debugLog.log("live.connect_rejected", ["reason": "insecure_url", "url": text])
      connection = .disconnected(reason: "insecure_url")
      notice = "Use an https:// URL. Plain http works only for localhost and private network addresses."
      return
    }
    let config = BackendConfig(baseURL: url, joinCode: joinCode.trimmingCharacters(in: .whitespacesAndNewlines))
    guard !config.joinCode.isEmpty else { connection = .disconnected(reason: "missing_join_code"); return }
    if !restoring {
      wantsBackendConnection = true
      defaults.set(true, forKey: Self.connectionIntentKey)
    }
    config.save(to: defaults, secrets: secrets)
    if backend?.config != config {
      if backend != nil { await tearDown() }
      guard lifecycleGeneration == generation, isAppActive else { return }
      build(config)
    }
    guard lifecycleGeneration == generation, isAppActive, let backend else { return }
    if !restoring { configureAudioSession() }
    coordinator?.start()
    connection = .connecting
    debugLog.log("live.connect", ["url": url.absoluteString])
    do {
      try await backend.connect()
    } catch {
      log.error("connect failed \(BackendClient.reasonCode(for: error), privacy: .public)")
      debugLog.log("live.connect_failed", [
        "reason": BackendClient.reasonCode(for: error), "error": String(describing: error),
        "state": String(describing: backend.connectionState),
      ])
      if case .disconnected(let reason) = backend.connectionState {
        notice = Self.connectFailureNotice(reason)
      }
    }
    guard lifecycleGeneration == generation, isAppActive, self.backend === backend else { return }
    connection = backend.connectionState
    if backend.requiresAuthentication { disableConnectionRestoration() }
  }

  /// Foreground/network recovery restores transport only. Capture always requires a new
  /// explicit user action (or the separately opted-in wake detector).
  func restoreConnection() async {
    guard isAppActive, wantsBackendConnection, !isRestoringConnection else { return }
    isRestoringConnection = true
    defer { isRestoringConnection = false }
    guard let backend else { await connect(restoring: true); return }
    guard !backend.requiresAuthentication else { disableConnectionRestoration(); return }
    coordinator?.start()
    do { try await backend.resume() } catch {
      if isAppActive { notice = Self.connectFailureNotice(BackendClient.reasonCode(for: error)) }
    }
    if backend.requiresAuthentication { disableConnectionRestoration() }
  }

  func setAppActive(_ active: Bool) async {
    lifecycleGeneration = UUID()
    let generation = lifecycleGeneration
    isAppActive = active
    if active {
      await restoreConnection()
    } else {
      pauseWakeDetector()
      backend?.suspend()
      coordinator?.stop()
      clearRecoveryPresentation()
      stopListening()
      await endWakeSession()
      guard lifecycleGeneration == generation else { return }
      await stopCaptureForRecovery()
      refreshWake()
    }
  }

  /// Meta owns registration. Revocation/unpair clears current output and sensor intent;
  /// restoring a DAT association never grants recording consent.
  func setGlassesAuthorized(_ authorized: Bool) async {
    glassesAuthorized = authorized
    if authorized {
      if isAppActive && wantsBackendConnection { coordinator?.start() }
      refreshWake()
      return
    }
    await glassesAuthorizationLost()
  }

  func glassesAuthorizationLost() async {
    glassesAuthorized = false
    pauseWakeDetector()
    lifecycleGeneration = UUID()
    coordinator?.stop()
    clearRecoveryPresentation()
    stopListening()
    await endWakeSession()
    await stopCaptureForRecovery()
  }

  private func stopCaptureForRecovery() async { await beginCaptureCleanup().value }

  @discardableResult
  private func beginCaptureCleanup() -> Task<Void, Never> {
    let previous = captureCleanup
    let id = UUID()
    captureCleanupID = id
    let cleanup = Task { [weak self] in
      await previous?.value
      guard let self else { return }
      if self.camera.hasSession || self.camera.isStreaming { await self.camera.stopLiveStream() }
      if self.captureCleanupID == id { self.captureCleanup = nil }
    }
    captureCleanup = cleanup
    return cleanup
  }

  private func disableConnectionRestoration() {
    wantsBackendConnection = false
    defaults.set(false, forKey: Self.connectionIntentKey)
    notice = Self.connectFailureNotice("unauthorized")
  }

  /// Connects on launch and whenever the app comes back to the foreground, so the wearer never
  /// has to connect by hand. Does nothing without a saved join code, while a connection is open or
  /// opening, or after the backend refused the join code or the URL: those need the user to
  /// change Settings first, and retrying them on every foreground would only fail again.
  func connectIfConfigured() async {
    guard canEditBackend, !joinCode.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
    if case .disconnected(let reason) = connection, Self.settingsErrorCodes.contains(reason) { return }
    // A suspended client belongs to the foreground restore path (setAppActive).
    if case .disconnected("suspended") = connection { return }
    await connect()
  }

  /// Disconnects, then connects again with the current URL and join code.
  func reconnect() async {
    await disconnect()
    await connect()
  }

  /// Disconnects and deletes the saved join code, so the next launch stays offline.
  func forgetJoinCode() async {
    await disconnect()
    joinCode = ""
    secrets.write(nil, for: BackendConfig.joinCodeKey)
  }

  /// Disconnect reasons only a change in Settings can fix: the join code or the URL.
  nonisolated static let settingsErrorCodes: Set<String> = [
    "missing_join_code", "unauthorized", "http_401", "http_403", "invalid_url", "insecure_url",
  ]

  /// What to do about a failed connect, by the client's reason code.
  static func connectFailureNotice(_ reason: String) -> String? {
    switch reason {
    // "suspended" is the app being in the background; restoreConnection resumes it on return.
    case "closed", "cancelled", "suspended": nil
    case "missing_join_code": "Add your join code in Settings."
    case "unauthorized", "http_401", "http_403": "The backend rejected the join code. Check it in Settings."
    case "connect_timeout", "timed_out": "The backend didn't answer in time. Check the URL and mobile data, then tap Reconnect."
    case "network_lost": "No network. Check mobile data, then tap Reconnect."
    case "session_capacity", "rate_limited", "http_429": "The backend has no free sessions right now. Try again in a minute."
    default: "Couldn't connect (\(reason)). Check the URL and join code, then tap Reconnect."
    }
  }

  /// Hosts that may use plain http: this device and private networks (a laptop on the same
  /// Wi-Fi). Everything else needs https.
  static func allowsCleartext(host: String) -> Bool {
    let host = host.lowercased().trimmingCharacters(in: CharacterSet(charactersIn: "[]"))
    if host == "localhost" || host.hasSuffix(".local") || host == "::1" { return true }
    let parts = host.split(separator: ".").compactMap { Int($0) }
    guard parts.count == 4, host.split(separator: ".").count == 4, parts.allSatisfy({ (0...255).contains($0) }) else { return false }
    switch (parts[0], parts[1]) {
    case (127, _), (10, _), (192, 168), (169, 254): return true
    case (172, 16...31): return true
    default: return false
    }
  }

  /// The user's Disconnect: stops listening, then closes and deletes the session.
  func disconnect() async {
    lifecycleGeneration = UUID()
    wantsBackendConnection = false
    defaults.set(false, forKey: Self.connectionIntentKey)
    clearRecoveryPresentation()
    clearTriggerAcknowledgement()
    acknowledgedChecks.removeAll()
    webDisplay.updateSession(id: nil, epoch: nil)
    webDisplayRequestId = nil
    await endWakeSession()
    stopListening()
    await stopCaptureForRecovery()
    await streamer?.waitUntilSent()
    coordinator?.stop()
    cancelCheckTimers()
    await backend?.close()
    connection = backend?.connectionState ?? .idle
    sessionActive = nil
    await endWakeSession()
    refreshWake()
  }

  // MARK: Listening

  /// Starts the glasses stream with mic audio (when needed) and streams audio to the backend.
  func startListening() async {
    await captureCleanup?.value
    await endWakeSession()
    await startListening(wakeID: nil)
  }

  /// Serializes manual camera controls after any cancelled wake startup and its cleanup.
  /// This prevents an old wake task from stopping a stream the user starts afterwards.
  func performManualCapture(_ operation: @MainActor () async -> Void) async {
    await captureCleanup?.value
    guard isAppActive, !isChecking else {
      notice = "The previous capture is finishing. Try again when it has stopped."
      return
    }
    await endWakeSession()
    manualCaptureStarting = true
    pauseWakeDetector()
    defer {
      manualCaptureStarting = false
      refreshWake()
    }
    await operation()
  }

  private func startListening(wakeID: UUID?) async {
    let generation = captureGeneration
    func current() -> Bool {
      isAppActive && glassesAuthorized && captureGeneration == generation && !Task.isCancelled && (wakeID == nil || wakeSessionID == wakeID)
    }
    guard current() else { return }
    guard isConnected, let streamer else {
      notice = Self.offlineMessage
      return
    }
    guard !streamer.phase.isActive, !isStartingStream, !isChecking else { return }
    if speechAvailable == false {
      notice = "This backend has no speech recognition. Check this still works."
      return
    }
    notice = nil
    // The wake detector uses the hands-free microphone; it must be off before a stream starts.
    pauseWakeDetector()
    isStartingStream = true
    defer {
      isStartingStream = false
      refreshWake()
    }
    // Listening uses the glasses' Bluetooth mic, not the camera stream: on Display glasses a
    // running camera holds back the lens cards and shows a viewfinder.
    guard await mic.requestPermission() else {
      notice = MicrophoneError.denied.message
      return
    }
    // The permission prompt can take a while: never open the mic after the app went to the
    // background or the capture was cancelled meanwhile.
    guard current() else { return }
    do {
      try mic.start()
    } catch {
      notice = (error as? MicrophoneError)?.message ?? "The microphone didn't start (\((error as NSError).code))."
      configureAudioSession()
      return
    }
    debugLog.log("live.mic_input", ["input": mic.inputName ?? "unknown"])
    guard current() else {
      stopMic()
      return
    }
    guard await ensureSessionActive() else {
      stopMic()
      notice = Self.pausedMessage
      return
    }
    guard isConnected, self.streamer === streamer else {
      stopMic()
      return
    }
    guard current() else {
      stopMic()
      return
    }
    streamer.start()
    acknowledgeListeningOnReady = true
    syncListening()
    startTicker()
  }

  /// The user's Stop listening: the mic stops and the audio session goes back to spoken output.
  func stopListening() {
    captureGeneration = UUID()
    clearTriggerAcknowledgement()
    guard let streamer, streamer.phase.isActive else { return }
    streamer.stop()
    stopMic()
    presenter.stopOutput()
    syncListening()
    // Stopping by hand during a wake session also ends that session and its stream.
    if wakeSession { Task { await self.endWakeSession() } }
  }

  // MARK: Look and check

  /// The app's "Check this" button: photo from the running stream, OCR on the phone, text to
  /// the checker.
  func checkThis() async {
    await captureCleanup?.value
    guard isAppActive, glassesAuthorized else { return }
    if let cleanup = wakeCleanupTask { await cleanup.value }
    guard isConnected, let coordinator else {
      checkMessage = Self.offlineMessage
      return
    }
    guard !coordinator.isRunning else { return }
    // A photo requested while idle owns a bounded wake session too. Track the full capture
    // task so disabling wake cannot finish cleanup before a delayed photo startup returns.
    if wakeWordEnabled, !wakeSession, !camera.isStreaming {
      beginWakeSession()
      let wakeID = wakeSessionID
      wakeStartTask = Task {
        await self.checkThis(wakeID: wakeID)
        self.wakeStartTask = nil
        guard !Task.isCancelled, self.wakeSessionID == wakeID else { return }
        self.startWakeTimer(after: self.wakeCheckWindow)
      }
    } else {
      await checkThis(wakeID: nil)
    }
  }

  private func checkThis(wakeID: UUID?) async {
    guard !Task.isCancelled, wakeID == nil || wakeSessionID == wakeID,
      isAppActive, isConnected, let coordinator, !coordinator.isRunning else { return }
    checkMessage = nil
    guard await ensureSessionActive() else {
      checkMessage = Self.pausedMessage
      return
    }
    guard !Task.isCancelled, wakeID == nil || wakeSessionID == wakeID else { return }
    await coordinator.performCheck(source: .button)
  }

  // MARK: Output controls

  func repeatLatest() {
    presenter.repeatLatest()
  }

  func dismissCard() {
    guard displayOutputMode == .web, let requestId = webDisplayRequestId, let backend else {
      presenter.dismissCard()
      return
    }
    Task { [weak self] in
      do {
        try await backend.cancel(requestId: requestId)
        // A newer claim may have arrived while the cancellation was in flight.
        guard let self, self.webDisplayRequestId == requestId else { return }
        self.webDisplayRequestId = nil
        self.presenter.dismissCard()
      } catch {
        self?.notice = "Couldn't dismiss the glasses card. Check the backend connection."
      }
    }
  }

  /// Opening a history entry shows its card again, without speech.
  func show(_ entry: ResultHistory.Entry) {
    lens.show(entry.card)
  }

  // MARK: Wiring

  private func build(_ config: BackendConfig) {
    let backend = makeBackend(config)
    backend.onUnreadableEvent = { [weak self] type in self?.unreadableEvent(type) }
    let streamer = AudioStreamer(
      channel: backend, source: .glassesHfp, clock: audioClock, resumesAfterReconnect: false, debugLog: debugLog
    )
    streamer.onStopped = { [weak self] reason in self?.listeningStopped(reason) }
    streamer.onAutoResumed = { [weak self] in self?.autoResumed() }
    relay.target = streamer
    let coordinator = LookAndCheckCoordinator(channel: backend, photo: camera, recognizer: recognizer, submitter: backend, debugLog: debugLog)
    coordinator.canCapture = { [weak self] in
      guard let self else { return false }
      return self.isAppActive && self.glassesAuthorized && self.wantsBackendConnection && self.isConnected && backend.connectionState == .connected
    }
    coordinator.onAccepted = { [weak self] in
      guard let self, self.displayOutputMode == .native else { return }
      self.lensUpdates?.yield(.feedback(.checking))
    }
    coordinator.onCancelledCapture = { [weak self] in
      guard let self else { return }
      await self.camera.stopLiveStream()
    }
    coordinator.onOutcome = { [weak self] outcome in
      guard let self, self.isAppActive, self.isConnected else { return }
      self.checkFinished(outcome)
    }
    // Voice triggers too: a session the server paused after a reconnect is resumed first.
    coordinator.prepareSubmit = { [weak self] in
      guard let self, self.isAppActive, self.glassesAuthorized, self.wantsBackendConnection else { return false }
      return await self.ensureSessionActive()
    }
    self.backend = backend
    self.streamer = streamer
    self.coordinator = coordinator
    listening = .idle

    let events = backend.events()
    let states = backend.connectionStates()
    subscriptions = [
      Task { [weak self] in
        for await event in events {
          guard !Task.isCancelled else { return }
          self?.handle(event)
        }
      },
      Task { [weak self] in
        for await state in states {
          guard !Task.isCancelled else { return }
          self?.handle(state)
        }
      },
    ]
  }

  /// Drops the current backend after a config change.
  private func tearDown() async {
    clearTriggerAcknowledgement()
    acknowledgedChecks.removeAll()
    webDisplay.updateSession(id: nil, epoch: nil)
    webDisplayRequestId = nil
    stopListening()
    coordinator?.stop()
    for task in subscriptions { task.cancel() }
    subscriptions = []
    backend?.suspend()
    clearRecoveryPresentation()
    await stopCaptureForRecovery()
    await coordinator?.waitUntilIdle()
    cancelCheckTimers()
    if let backend { await backend.close() }
    backend = nil
    streamer = nil
    coordinator = nil
    relay.target = nil
    sessionActive = nil
    speechAvailable = nil
  }

  private func handle(_ state: ChannelConnectionState) {
    if state != .connected {
      clearRecoveryPresentation()
      clearTriggerAcknowledgement()
      webDisplay.updateSession(id: nil, epoch: nil)
      webDisplayRequestId = nil
    }
    connection = state
    refreshWake()
    if case .disconnected(let reason) = state, ["expired", "deleted"].contains(reason) {
      coordinator?.stop()
      lifecycleGeneration = UUID()
      stopListening()
      beginCaptureCleanup()
    }
    if case .disconnected(let reason) = state, ["unauthorized", "http_401", "http_403"].contains(reason) {
      disableConnectionRestoration()
    }
    syncListening()
  }

  private func handle(_ event: ServerEvent) {
    guard isAppActive, wantsBackendConnection else { return }
    if event.type != .sessionReady && event.type != .sessionEnded {
      guard glassesAuthorized, backend?.connectionState == .connected else { return }
    }
    if event.requestId != nil {
      guard event.sessionId == backend?.sessionId, event.sessionEpoch == backend?.sessionEpoch else { return }
    }
    switch event.payload {
    case .sessionReady(let payload):
      webDisplayRequestId = nil
      webDisplay.updateSession(id: event.sessionId, epoch: event.sessionEpoch)
      sessionActive = payload.active
      if !payload.active { clearTriggerAcknowledgement() }
      speechAvailable = payload.audio
      // Every session starts with the server's defaults (automatic alerts off), so the
      // preferences go out on each session.ready, including the one after a resume.
      sendPreferences(epoch: event.sessionEpoch)
      // After a disconnect the server pauses the session. While listening, AudioStreamer
      // resumes it (within 5 s). Otherwise resume here so manual checks keep working.
      if !payload.active, !(streamer?.phase.isActive ?? false) {
        debugDecision(event, "resume_paused_session")
        resume(epoch: event.sessionEpoch)
      }
    case .sessionEnded(let payload):
      clearTriggerAcknowledgement()
      acknowledgedChecks.removeAll()
      webDisplayRequestId = nil
      webDisplay.updateSession(id: nil, epoch: nil)
      sessionActive = false
      debugDecision(event, "session_ended", ["reason": payload.reasonCode])
      clearRecoveryPresentation()
      notice = "The session ended. Connection recovery does not resume listening; tap Start listening when ready."
    case .claimChecking(let payload):
      if payload.userInitiated == true, let requestId = event.requestId {
        webDisplayRequestId = requestId
        let first = acknowledgedChecks.insert(requestId).inserted
        if let claimText = payload.claimText {
          if searchState?.requestId != requestId {
            presenter.dismissCard()
            if !pendingChecks.contains(requestId) { startTimer(for: requestId) }
            searchState = NativeSearchState(requestId: requestId, sessionId: event.sessionId,
              epoch: event.sessionEpoch, claimText: claimText, captureLabel: payload.mode == .ocr ? "Read from screen" : "Heard nearby")
            cardEligibility = nil
            recoverableCard = nil
            cardExpiryTask?.cancel()
            if displayOutputMode == .native, let searchState { lensUpdates?.yield(.searching(searchState)) }
          }
        } else if first, displayOutputMode == .native {
          // Backward-compatible backend without the optional claim text metadata.
          feedbackRequestId = requestId
          lensUpdates?.yield(.feedback(.checking))
        }
      }
    case .claimSources(let payload):
      guard var current = searchState, event.requestId == current.requestId,
            event.sessionId == current.sessionId, event.sessionEpoch == current.epoch else { break }
      current.sources = Array(payload.sources.prefix(4))
      searchState = current
      if displayOutputMode == .native { lensUpdates?.yield(.searching(current)) }
    case .claimResult(let result):
      if result.presentation.action == .respond || result.presentation.action == .notify {
        webDisplayRequestId = event.requestId
      } else if event.requestId == webDisplayRequestId {
        webDisplayRequestId = nil
      }
      let manual = isUserInitiated(event.requestId)
      guard let identity = ClaimIdentity(event: event) else {
        // claim.result always carries all three ids; without them it can't be tracked. A
        // check the user asked for still gets an answer.
        log.error("claim.result without ids \(event.logSummary, privacy: .public)")
        debugDecision(event, "result_without_ids", ["userInitiated": manual])
        resolveManual(event.requestId, failed: true)
        return
      }
      debugDecision(event, "present_result", ["userInitiated": manual, "action": result.presentation.action.rawValue])
      resolveManual(event.requestId, hadResult: true)
      if let activeSearch = searchState, activeSearch.requestId != event.requestId {
        presenter.present(result, presentation: Presentation(action: .silent, reasonCode: "newer_manual_check"), userInitiated: manual, identity: identity)
        break
      }
      if result.presentation.action == .respond || result.presentation.action == .notify {
        guard history.accepts(identity) else { return }
        pendingCardEligibility = NativeCardEligibility(sessionId: event.sessionId, sessionEpoch: event.sessionEpoch, expiresAt: result.expiresAt)
        guard pendingCardEligibility?.permits(sessionId: backend?.sessionId, epoch: backend?.sessionEpoch, now: Date()) == true else {
          pendingCardEligibility = nil
          return
        }
        pendingCaptureLabel = searchState?.requestId == event.requestId ? searchState?.captureLabel : nil
        searchState = nil
      }
      presenter.present(result, presentation: result.presentation, userInitiated: manual, identity: identity)
    case .claimNeedsConfirmation, .claimSkipped:
      if event.requestId == webDisplayRequestId { webDisplayRequestId = nil }
      // An explicit request always gets an answer; automatic ones stay quiet (skips) or in
      // history (needs confirmation).
      if isUserInitiated(event.requestId) {
        debugDecision(event, "manual_check_answered")
        resolveManual(event.requestId)
      } else if event.type == .claimNeedsConfirmation {
        // Automatic: history only (presentation silent), nothing spoken or shown on the lens.
        debugDecision(event, "automatic_history_only")
        presenter.presentOutcome(.needsConfirmation(heard: true), userInitiated: false)
      } else {
        debugDecision(event, "automatic_skip_ignored")
      }
    case .pipelineError(let payload):
      if event.requestId == searchState?.requestId { clearRecoveryPresentation() }
      if event.requestId == feedbackRequestId { clearTriggerAcknowledgement() }
      if event.requestId == webDisplayRequestId { webDisplayRequestId = nil }
      if let requestId = event.requestId {
        if isUserInitiated(requestId) {
          debugDecision(event, "manual_check_failed", ["reason": payload.reasonCode])
          resolveManual(requestId, failed: true)
        } else {
          debugDecision(event, "automatic_history_only", ["reason": payload.reasonCode])
          presenter.presentOutcome(.checkFailed, userInitiated: false)
        }
      } else if Self.quietErrorCodes.contains(payload.reasonCode) {
        log.info("routine backend code \(payload.reasonCode, privacy: .public)")
        debugDecision(event, "quiet_code", ["reason": payload.reasonCode])
      } else {
        debugDecision(event, "notice", ["reason": payload.reasonCode])
        notice = "Backend error: \(payload.reasonCode)"
      }
    case .claimSuperseded(let payload):
      if event.requestId == searchState?.requestId { clearRecoveryPresentation() }
      if event.requestId == feedbackRequestId { clearTriggerAcknowledgement() }
      if event.requestId == webDisplayRequestId { webDisplayRequestId = nil }
      resolveCheck(event.requestId)
      if let requestId = event.requestId {
        // "That statement was corrected" only while listening: never after the user's Stop.
        let announce = payload.presentation?.action == .respond && (streamer?.phase.isActive ?? false)
        debugDecision(event, "supersede", ["announce": announce])
        presenter.supersede(requestId: requestId, revision: event.revision, announce: announce)
      }
    case .checkCancelled:
      if event.requestId == searchState?.requestId { clearRecoveryPresentation() }
      if event.requestId == feedbackRequestId { clearTriggerAcknowledgement() }
      if event.requestId == webDisplayRequestId {
        webDisplayRequestId = nil
        if displayOutputMode == .web { presenter.dismissCard() }
      }
      let manual = isUserInitiated(event.requestId)
      debugDecision(event, manual ? "manual_check_cancelled" : "ignored")
      if manual { resolveManual(event.requestId, cancelled: true) }
    case .captureRequest:
      // LookAndCheckCoordinator takes the photo itself; this is only the phone-side note.
      debugDecision(event, "photo_triggered")
      checkMessage = "Heard “check this”."
    default:
      break
    }
    syncListening()
  }

  private func resume(epoch: Int) {
    guard let backend else { return }
    log.info("session.resume epoch=\(epoch, privacy: .public)")
    Task {
      do {
        try await backend.sendControl(ControlMessage.resume(epoch: epoch))
      } catch {
        self.log.error("session.resume failed \(BackendClient.reasonCode(for: error), privacy: .public)")
        self.debugLog.log("live.resume_failed", ["epoch": epoch, "error": String(describing: error)])
        self.notice = "Couldn't resume the backend session. Tap Reconnect."
      }
    }
  }

  /// `session.preferences` for the current session. `muted` stays false on the server: the
  /// app's own mute keeps cards and history, while a server mute would turn every result,
  /// even a requested one, silent.
  private func sendPreferences(epoch: Int? = nil) {
    guard let backend, backend.connectionState == .connected, let epoch = epoch ?? backend.sessionEpoch else { return }
    let preferences = SessionPreferences(muted: false, automaticNotifications: automaticAlerts, selectedTopics: [])
    Task {
      do {
        try await backend.sendControl(ControlMessage.preferences(preferences, epoch: epoch))
        self.log.info("session.preferences automatic=\(preferences.automaticNotifications, privacy: .public)")
      } catch {
        self.log.error("session.preferences failed \(BackendClient.reasonCode(for: error), privacy: .public)")
      }
    }
  }

  /// What Live mode did with a backend event, for the debug log. The raw event is already
  /// there (`ws.recv`); this records the branch taken.
  private func debugDecision(_ event: ServerEvent, _ decision: String, _ extra: [String: Any] = [:]) {
    guard debugLog.isEnabled else { return }
    var payload = extra
    payload["decision"] = decision
    payload["type"] = event.type.rawValue
    payload["eventId"] = event.eventId
    payload["requestId"] = event.requestId as Any
    payload["claimId"] = event.claimId as Any
    payload["revision"] = event.revision as Any
    debugLog.log("live.decision", payload)
  }

  private func unreadableEvent(_ type: String?) {
    log.error("unreadable backend event type=\(type ?? "-", privacy: .public)")
    notice = "The backend sent an update this app can't read. Check that the app and backend versions match."
  }

  /// Resumes a paused session and waits up to 2 s for `session.ready` with `active: true`.
  /// Checks go over HTTP, which can overtake the WebSocket resume, so wait for the event.
  private func ensureSessionActive() async -> Bool {
    guard sessionActive == false else { return true }
    guard let epoch = backend?.sessionEpoch else { return false }
    resume(epoch: epoch)
    for _ in 0..<20 where sessionActive != true {
      try? await Task.sleep(nanoseconds: 100_000_000)
    }
    return sessionActive == true
  }

  /// Stops the Bluetooth mic and gives the audio session back to spoken output.
  private func stopMic() {
    guard mic.isRunning else { return }
    mic.stop()
    configureAudioSession()
  }

  private func listeningStopped(_ reason: AudioStreamerStopReason) {
    stopMic()
    clearTriggerAcknowledgement()
    listening = .stopped(reason)
    log.info("listening stopped \(reason.code, privacy: .public)")
    debugLog.log("live.listening_stopped", ["reason": reason.code])
    speakStopReason(reason)
    // Listening failed during a wake session: stop its stream and go back to waiting.
    if wakeSession { Task { await self.endWakeSession() } }
  }

  /// A distinct spoken reason for every failure (decision 9). Nil for the user's own Stop.
  private func speakStopReason(_ reason: AudioStreamerStopReason) {
    if let message = reason.spokenMessage, !isMuted {
      speaker.speak(message, rate: presenter.speechRate) {}
    }
  }

  private func autoResumed() {
    notice = "Reconnected. Listening resumed."
    // A chime is not playback, so it is not reported to the backend.
    if !isMuted { chime.playChime() }
    syncListening()
  }

  /// A camera stream ended. Listening runs on the Bluetooth mic, so it carries on; a stream only
  /// runs for a fallback photo or from the Developer screen.
  private func streamStopped(byUser: Bool) {
    defer { refreshWake() }
    debugLog.log("live.stream_stopped", ["byUser": byUser, "listening": String(describing: streamer?.phase ?? .idle)])
  }

  private func checkFinished(_ outcome: LookAndCheckCoordinator.Outcome) {
    switch outcome {
    case .submitted(let requestIds, let droppedCodePoints):
      var message = requestIds.count == 1 ? "Sent for checking." : "Sent \(requestIds.count) parts for checking."
      if droppedCodePoints > 0 {
        message += " Some text was too long and was left out."
      }
      checkMessage = message
      if let key = requestIds.first.flatMap(LookAndCheckCoordinator.photoKey(forRequestId:)) {
        photoChecks[key, default: PhotoCheck()].expected = requestIds.count
        settlePhoto(key)
      }
      for requestId in requestIds where !resolvedChecks.contains(requestId) {
        startTimer(for: requestId)
      }
    case .unreadable(let message):
      checkMessage = message
      presenter.presentOutcome(.needsConfirmation(heard: false), userInitiated: true)
    case .failed(let reason):
      checkMessage = Self.checkFailureMessage(reason)
      presenter.presentOutcome(.checkFailed, userInitiated: true)
    }
    releaseCameraAfterPhoto()
  }

  /// A photo check is over once its photo is read: release the camera so "Hey Facto" re-arms
  /// at once (the detector stays paused while the camera holds the glasses session), instead
  /// of waiting out the wake window. A stream someone started on purpose keeps running.
  private func releaseCameraAfterPhoto() {
    if wakeSession {
      Task { await self.endWakeSession() }
    } else if camera.hasSession, !camera.isStreaming, !manualCaptureStarting {
      Task {
        await self.camera.stopLiveStream()
        self.refreshWake()
      }
    }
  }

  static func checkFailureMessage(_ reason: String) -> String {
    switch reason {
    case "no_session": offlineMessage
    case "session_paused": pausedMessage
    case "photo_failed": "The photo didn't arrive. Check the glasses and try again."
    case "ocr_failed": "The photo couldn't be read. Try again."
    case "submit_failed": "The backend didn't accept the text. Check the connection."
    default: "The check didn't finish (\(reason))."
    }
  }

  // MARK: Manual check tracking

  /// Look-and-check request ids start with "ocr-" (WireID prefix); the backend names
  /// transcript requests "asr-…". Only the phone creates "ocr-" ids, so the prefix still
  /// works when a result overtakes the 202 response.
  private func isUserInitiated(_ requestId: String?) -> Bool {
    guard let requestId else { return false }
    return requestId.hasPrefix("ocr-") || pendingChecks.contains(requestId) || acknowledgedChecks.contains(requestId)
  }

  private func isPhotoRequest(_ requestId: String?) -> Bool {
    requestId?.hasPrefix("ocr-") ?? false
  }

  private func startTimer(for requestId: String) {
    guard !pendingChecks.contains(requestId) else { return }
    pendingChecks.insert(requestId)
    let timeout = checkTimeout
    checkTimers[requestId] = Task { [weak self] in
      try? await Task.sleep(nanoseconds: UInt64(max(0, timeout) * 1_000_000_000))
      guard !Task.isCancelled else { return }
      self?.checkTimedOut(requestId)
    }
  }

  private func checkTimedOut(_ requestId: String) {
    checkTimers[requestId] = nil
    guard pendingChecks.contains(requestId) else { return }
    log.info("manual check timed out req=\(requestId, privacy: .public)")
    debugLog.log("live.check_timeout", ["requestId": requestId, "timeoutSeconds": checkTimeout])
    resolveManual(requestId, failed: true)
  }

  /// Records one manual request's outcome and answers the user once per photo: a verdict is
  /// presented by the caller as it arrives; "not sure" or "didn't finish" only once every
  /// chunk of the photo is back without a verdict, so a skipped chunk never talks over
  /// another chunk's verdict.
  private func resolveManual(_ requestId: String?, hadResult: Bool = false, failed: Bool = false, cancelled: Bool = false) {
    guard let requestId else { return }
    let wasOpen = !resolvedChecks.contains(requestId) || pendingChecks.contains(requestId)
    resolveCheck(requestId)
    if let activeSearch = searchState, activeSearch.requestId != requestId { return }
    guard let key = LookAndCheckCoordinator.photoKey(forRequestId: requestId) else {
      // Not a photo chunk: answer it on its own.
      if hadResult || cancelled || !wasOpen { return }
      presenter.presentOutcome(failed ? .checkFailed : .needsConfirmation(heard: true), userInitiated: true)
      return
    }
    var check = photoChecks[key, default: PhotoCheck()]
    check.resolved.insert(requestId)
    check.hadResult = check.hadResult || hadResult
    check.failed = check.failed || failed
    check.unsure = check.unsure || !(hadResult || failed || cancelled)
    photoChecks[key] = check
    settlePhoto(key)
  }

  private func settlePhoto(_ key: String) {
    guard let check = photoChecks[key], let expected = check.expected, check.resolved.count >= expected else { return }
    photoChecks[key] = nil
    if let activeSearch = searchState, LookAndCheckCoordinator.photoKey(forRequestId: activeSearch.requestId) != key { return }
    if check.hadResult { return }
    if check.failed {
      presenter.presentOutcome(.checkFailed, userInitiated: true)
    } else if check.unsure {
      presenter.presentOutcome(.needsConfirmation(heard: false), userInitiated: true)
    }
    // Only cancelled: the user called it off, so nothing more is said.
  }

  private func resolveCheck(_ requestId: String?) {
    guard let requestId, isPhotoRequest(requestId) || pendingChecks.contains(requestId) else { return }
    if resolvedChecks.count > 256 { resolvedChecks.removeAll() }
    resolvedChecks.insert(requestId)
    pendingChecks.remove(requestId)
    checkTimers.removeValue(forKey: requestId)?.cancel()
  }

  private func cancelCheckTimers() {
    for task in checkTimers.values { task.cancel() }
    checkTimers.removeAll()
    pendingChecks.removeAll()
    photoChecks.removeAll()
  }

  // MARK: Wake phrase

  /// Arms or disarms the on-device detector to match the current state. It listens only when
  /// the option is on, the backend is connected, and no stream or listening is running.
  private func refreshWake() {
    guard wakeWordEnabled else {
      pauseWakeDetector()
      wakeState = .off
      return
    }
    if wakeSession {
      wakeState = .awake
      return
    }
    let blocked: String? =
      if !isAppActive { "Paused while the app is inactive." }
      else if !glassesAuthorized { "Connect to Meta AI to arm it." }
      else if !wantsBackendConnection || !isConnected { "Connect to the backend to arm it." }
      else if listening.isActive || isStartingStream { "Paused while listening." }
      else if wakeStartTask != nil || wakeCleanupTask != nil || manualCaptureStarting { "Waiting for the glasses session to finish." }
      else if camera.isStreaming { "Paused while the glasses stream is on. Stop the stream to arm it." }
      else if camera.hasSession { "Paused while the glasses session is on." }
      else { nil }
    if let blocked {
      pauseWakeDetector()
      wakeState = .blocked(blocked)
      return
    }
    if let wakeFailure {
      wakeState = .unavailable(wakeFailure)
      return
    }
    if wake.isRunning {
      wakeState = .waiting(input: wake.inputName)
      return
    }
    guard !wakeStarting else { return }
    wakeStarting = true
    wakeState = .starting
    Task {
      do {
        try await self.wake.start()
      } catch is CancellationError {
        // A capture or setting change superseded the microphone permission request.
      } catch {
        self.wakeFailure = (error as? WakeWordError)?.message ?? "The wake phrase detector didn't start."
        self.log.error("wake detector failed to start")
      }
      self.wakeStarting = false
      // Conditions may have changed while the microphone was starting.
      self.refreshWake()
    }
  }

  /// Stops the detector and gives the audio session back to spoken output.
  private func pauseWakeDetector() {
    guard wake.isRunning || wakeStarting else { return }
    wake.stop()
    configureAudioSession()
  }

  private func beginWakeSession() {
    pauseWakeDetector()
    wakeSession = true
    wakeSessionID = UUID()
    wakeStartedStream = !camera.isStreaming
    wakeState = .awake
  }

  /// The detector heard the phrase. "Hey Facto" starts listening for a bounded window;
  /// "Hey Facto, check this" takes a photo and checks it, like the Check this button.
  private func wakeHeard(_ command: WakeCommand) {
    guard wakeWordEnabled, !wakeSession, wakeStartTask == nil, wakeCleanupTask == nil,
      isAppActive, glassesAuthorized, wantsBackendConnection, !manualCaptureStarting, !camera.hasSession, !camera.isStreaming, isConnected else { return }
    // A chime is not playback, so it is not reported to the backend.
    if !isMuted { chime.playChime() }
    // Every "Hey Facto…" takes a photo and checks what is in view; nothing is streamed.
    // checkThis() releases the detector's microphone, and the short wake session re-arms the
    // detector once the check is done.
    log.info("wake phrase: \(command == .checkThis ? "check this" : "hey facto", privacy: .public), taking a photo")
    beginWakeSession()
    let wakeID = wakeSessionID
    wakeStartTask = Task {
      await self.checkThis(wakeID: wakeID)
      self.wakeStartTask = nil
      guard !Task.isCancelled, self.wakeSessionID == wakeID else { return }
      self.startWakeTimer(after: self.wakeCheckWindow)
    }
  }


  private func startWakeTimer(after seconds: TimeInterval) {
    wakeTimer?.cancel()
    wakeTimer = Task { [weak self] in
      try? await Task.sleep(nanoseconds: UInt64(max(0, seconds) * 1_000_000_000))
      // Don't cut off a check in flight: wait for it, up to 30 s more.
      var waited = 0
      while !Task.isCancelled, let self, self.isChecking || !self.pendingChecks.isEmpty, waited < 30 {
        try? await Task.sleep(nanoseconds: 1_000_000_000)
        waited += 1
      }
      guard !Task.isCancelled, let self else { return }
      self.wakeTimer = nil
      await self.endWakeSession()
    }
  }

  /// Ends a wake session: stops listening and the stream it started, then waits for the phrase
  /// again (if the option is still on).
  private func endWakeSession() async {
    if let cleanup = wakeCleanupTask {
      await cleanup.value
      return
    }
    guard wakeSession else {
      refreshWake()
      return
    }
    clearTriggerAcknowledgement()
    wakeSession = false
    wakeSessionID = nil
    wakeTimer?.cancel()
    wakeTimer = nil
    let startup = wakeStartTask
    startup?.cancel()
    let ownsStream = wakeStartedStream
    wakeStartedStream = false
    if let streamer, streamer.phase.isActive {
      streamer.stop()
      presenter.stopOutput()
      syncListening()
    }
    // DAT startup may ignore task cancellation while a permission sheet or device session
    // is pending. Keep ownership until it returns, then end even a partially started session.
    let cleanup = Task {
      await startup?.value
      if ownsStream {
        self.log.info("wake session over: stopping the stream")
        await self.camera.stopLiveStream()
      }
    }
    wakeCleanupTask = cleanup
    await cleanup.value
    wakeCleanupTask = nil
    refreshWake()
  }

  /// Keep the phone awake while listening or waiting for the wake phrase: a locked phone
  /// suspends the app, and with it the socket and the audio pipeline.
  private func updateKeepAwake() {
    let wanted = listening.isActive || wakeState.isWaiting || wakeState == .awake
    guard wanted != keptAwake else { return }
    keptAwake = wanted
    idleTimer(wanted)
  }

  // MARK: Lens and listening state

  private func lensChanged(_ card: ResultCard?) {
    var card = card
    if card != nil, let pendingCaptureLabel { card?.captureLabel = pendingCaptureLabel }
    pendingCaptureLabel = nil
    cardExpiryTask?.cancel()
    cardExpiryTask = nil
    cardEligibility = card == nil ? nil : pendingCardEligibility
    recoverableCard = cardEligibility == nil ? nil : card
    pendingCardEligibility = nil
    if card != nil { searchState = nil }
    if let eligibility = cardEligibility {
      cardExpiryTask = Task { [weak self] in
        try? await Task.sleep(for: .seconds(max(0, eligibility.expiresAt.timeIntervalSinceNow)))
        guard !Task.isCancelled, let self, self.cardEligibility == eligibility else { return }
        self.cardEligibility = nil
        self.presenter.dismissCard()
      }
    }
    lensUpdates?.yield(.card(card))
  }

  private func clearRecoveryPresentation() {
    let hadPresentation = searchState != nil || cardEligibility != nil || lens.card != nil
    searchState = nil
    pendingCardEligibility = nil
    pendingCaptureLabel = nil
    cardEligibility = nil
    recoverableCard = nil
    cardExpiryTask?.cancel()
    cardExpiryTask = nil
    cancelCheckTimers()
    presenter.stopOutput()
    // A search can occupy DAT while the phone result lens is already empty.
    if hadPresentation { lensUpdates?.yield(.card(nil)) }
  }

  private func restoreNativePresentation() {
    guard displayOutputMode == .native, isAppActive, isConnected else { return }
    if let searchState, searchState.sessionId == backend?.sessionId, searchState.epoch == backend?.sessionEpoch {
      lensUpdates?.yield(.searching(searchState))
    } else if cardEligibility?.permits(sessionId: backend?.sessionId, epoch: backend?.sessionEpoch, now: Date()) == true {
      lensUpdates?.yield(.card(recoverableCard))
    } else {
      lensUpdates?.yield(.card(nil))
    }
  }

  /// One task sends lens updates in order. Each send finishes before the next starts.
  private func startLensPump() {
    // Keep control transitions in order too: dropping a result immediately before an
    // acknowledgement would make its expiry restore an older card.
    let (updates, continuation) = AsyncStream<LensUpdate>.makeStream()
    lensUpdates = continuation
    let display = display
    let onRepeat: @Sendable () -> Void = { [weak self] in
      Task { @MainActor in self?.repeatLatest() }
    }
    let onDismiss: @Sendable () -> Void = { [weak self] in
      Task { @MainActor in self?.dismissCard() }
    }
    lensPump = Task { [weak self] in
      for await update in updates {
        guard let display else { continue }
        if case .clearFeedback = update {
          await display.clearTriggerFeedback()
          continue
        }
        guard self?.displayOutputMode == .native, display.isConnected else { continue }
        switch update {
        case .card(let card):
          await display.showCard(card, onRepeat: card == nil ? nil : onRepeat, onDismiss: card == nil ? nil : onDismiss)
        case .searching(let state):
          await display.showSearching(claimText: state.claimText, captureLabel: state.captureLabel, sources: state.sources)
        case .feedback(let feedback):
          await display.showTriggerFeedback(feedback)
        case .clearFeedback:
          break
        }
      }
    }
  }

  private func clearTriggerAcknowledgement() {
    acknowledgeListeningOnReady = false
    feedbackRequestId = nil
    lensUpdates?.yield(.clearFeedback)
  }

  /// AudioStreamer is not observable, so its phase is copied after every input and on a short
  /// ticker while it is active.
  private func syncListening() {
    let phase = streamer?.phase ?? .idle
    if acknowledgeListeningOnReady, case .streaming = phase {
      acknowledgeListeningOnReady = false
      feedbackRequestId = nil
      if displayOutputMode == .native { lensUpdates?.yield(.feedback(.listening)) }
    }
    if listening != phase { listening = phase }
    if phase.isActive { startTicker() }
  }

  private func startTicker() {
    guard ticker == nil else { return }
    ticker = Task { [weak self] in
      while !Task.isCancelled {
        try? await Task.sleep(nanoseconds: 250_000_000)
        guard let self else { return }
        let phase = self.streamer?.phase ?? .idle
        self.syncListening()
        if !phase.isActive {
          self.ticker = nil
          return
        }
      }
    }
  }

  /// Spoken answers play through the glasses speakers even with the ring switch on silent.
  /// Same settings as the audio lab's spoken-output test.
  private static func configureSpokenOutput() {
    do {
      let session = AVAudioSession.sharedInstance()
      try session.setCategory(.playback, mode: .spokenAudio, options: [.duckOthers])
      try session.setActive(true)
    } catch {
      Logger(subsystem: "com.davidvasilescu.junction.glasseslab", category: "live")
        .error("audio session setup failed \((error as NSError).code, privacy: .public)")
    }
  }
}
