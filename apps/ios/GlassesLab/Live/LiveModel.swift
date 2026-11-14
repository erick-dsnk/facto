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
  func connect() async throws
  func close() async
}

extension BackendClient: LiveBackend {}

/// The glasses camera as Live mode needs it. `CameraModel` is the real one.
@MainActor
protocol LiveCamera: PhotoCapturing {
  var isStreaming: Bool { get }
  /// Quality for a stream that Live mode starts, including one started by "Check this".
  var liveQuality: StreamQuality { get set }
  var onAudioBuffer: (@MainActor (AVAudioPCMBuffer) -> Void)? { get set }
  var onStreamStopped: (@MainActor (_ byUser: Bool) -> Void)? { get set }
  func startListeningStream(quality: StreamQuality) async throws
}

/// The glasses lens. `DisplayModel` is the real one.
@MainActor
protocol LensDisplaying: AnyObject {
  var isConnected: Bool { get }
  func showCard(_ card: ResultCard?, onRepeat: (@Sendable () -> Void)?, onDismiss: (@Sendable () -> Void)?) async
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

/// What the Live screen shows at the top. Each failure has its own state, so a broken
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
    case .offline: "Not connected"
    case .connecting: "Connecting…"
    case .connected: "Connected, not listening"
    case .startingToListen: "Starting to listen…"
    case .listening: "Listening"
    case .reconnecting: "Reconnecting…"
    case .listeningStopped(let reason):
      switch reason {
      case .glassesDisconnected: "Stopped: glasses disconnected"
      case .noConnection: "Stopped: no connection"
      case .sessionEnded: "Stopped: session ended"
      case .audioUnavailable: "Stopped: listening unavailable"
      case .requested: "Not listening"
      }
    case .backendError(let code): Self.errorTitle(code)
    }
  }

  var detail: String {
    switch self {
    case .offline: "Enter the backend URL and join code, then tap Connect."
    case .connecting: "Opening a session on the backend."
    case .connected: "Tap Start listening, or Check this to read text in front of you."
    case .startingToListen: "Waiting for the glasses stream and the backend."
    case .listening: "No alert does not mean a claim was verified."
    case .reconnecting(let attempt):
      attempt > 0
        ? "Connection dropped. Attempt \(attempt) of 3. Audio from the gap is discarded."
        : "Connection dropped. Audio from the gap is discarded."
    case .listeningStopped(let reason):
      switch reason {
      case .audioUnavailable(let code), .sessionEnded(let code): "Reason: \(code). Tap Start listening to try again."
      default: "Tap Start listening to try again."
      }
    case .backendError(let code): "Reason: \(code). Tap Connect to try again."
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
    case "unauthorized": "Join code or session rejected"
    case "deleted", "expired": "Session ended by the backend"
    case "connect_timeout", "timed_out": "Backend not responding"
    case "missing_join_code": "Join code missing"
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
  /// `session.ended` reasons after which Live mode opens a new session by itself. Server
  /// sessions last 5 minutes and are never extended (services/api session.ts).
  static let renewableEndReasons: Set<String> = ["deleted", "expired"]
  /// At most one automatic renewal per this many seconds, so a backend that ends every new
  /// session at once can't cause a loop.
  nonisolated static let minimumRenewalInterval: TimeInterval = 60
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

  // MARK: State

  private(set) var connection: ChannelConnectionState = .idle
  private(set) var listening: AudioStreamerPhase = .idle {
    didSet {
      // Keep the phone awake while listening: a locked phone suspends the app, and with it
      // the socket and the audio pipeline.
      if listening.isActive != oldValue.isActive { idleTimer(listening.isActive) }
      if listening != oldValue { debugLog.log("live.listening", ["phase": String(describing: listening)]) }
    }
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
  @ObservationIgnored private let idleTimer: (_ keepAwake: Bool) -> Void
  @ObservationIgnored private let uptime: () -> TimeInterval
  @ObservationIgnored private let debugLog: DebugLog
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
  /// Lens updates go through one ordered stream, so a quick show then clear can't arrive out
  /// of order. Only the newest pending card is kept.
  @ObservationIgnored private var lensUpdates: AsyncStream<ResultCard?>.Continuation?
  @ObservationIgnored private var lensPump: Task<Void, Never>?
  /// Session renewal after the server ended the session (expiry).
  @ObservationIgnored private var listenAfterRenewal = false
  @ObservationIgnored private var isRenewing = false
  @ObservationIgnored private var lastRenewalAt: TimeInterval?

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
    makeBackend: (@MainActor (BackendConfig) -> LiveBackend)? = nil
  ) {
    let config = BackendConfig.load(from: defaults, secrets: secrets)
    self.baseURLText = config.baseURL.absoluteString
    self.joinCode = config.joinCode
    self.demoQuality = defaults.object(forKey: Self.demoQualityKey) as? Bool ?? true
    self.isMuted = defaults.bool(forKey: Self.mutedKey)
    self.automaticAlerts = defaults.object(forKey: Self.automaticAlertsKey) as? Bool ?? true
    self.camera = camera
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

    lens.onChange = { [weak self] card in self?.lensUpdates?.yield(card) }
    camera.liveQuality = quality
    camera.onStreamStopped = { [weak self] byUser in self?.streamStopped(byUser: byUser) }
    camera.onAudioBuffer = { [weak self] buffer in self?.streamer?.append(buffer) }
    startLensPump()
  }

  // MARK: Connection

  /// Saves the URL and join code, then opens a session and its event stream.
  func connect() async {
    guard canEditBackend else { return }
    notice = nil
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
    config.save(to: defaults, secrets: secrets)
    if backend?.config != config {
      await tearDown()
      build(config)
    }
    guard let backend else { return }
    configureAudioSession()
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
    connection = backend.connectionState
  }

  /// What to do about a failed connect, by the client's reason code.
  static func connectFailureNotice(_ reason: String) -> String? {
    switch reason {
    case "closed", "cancelled": nil
    case "missing_join_code": "Enter the join code, then tap Connect."
    case "unauthorized", "http_401", "http_403": "The backend rejected the join code. Check it, then tap Connect."
    case "connect_timeout", "timed_out": "The backend didn't answer in time. Check the URL and mobile data, then tap Connect."
    case "network_lost": "No network. Check mobile data, then tap Connect."
    case "session_capacity", "rate_limited", "http_429": "The backend has no free sessions right now. Try again in a minute."
    default: "Couldn't connect (\(reason)). Check the URL and join code, then tap Connect."
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
    stopListening()
    await streamer?.waitUntilSent()
    coordinator?.stop()
    cancelCheckTimers()
    await backend?.close()
    connection = backend?.connectionState ?? .idle
    sessionActive = nil
  }

  // MARK: Listening

  /// Starts the glasses stream with mic audio (when needed) and streams audio to the backend.
  func startListening() async {
    guard isConnected, let streamer else {
      notice = "Connect to the backend first."
      return
    }
    guard !streamer.phase.isActive, !isStartingStream else { return }
    if speechAvailable == false {
      notice = "This backend has no speech recognition. Check this still works."
      return
    }
    notice = nil
    isStartingStream = true
    defer { isStartingStream = false }
    do {
      try await camera.startListeningStream(quality: quality)
    } catch {
      notice = (error as? LiveStreamError)?.message ?? "The glasses stream didn't start."
      return
    }
    guard await ensureSessionActive() else {
      notice = "The backend session is paused. Disconnect and connect again."
      return
    }
    guard isConnected, self.streamer === streamer else { return }
    streamer.start()
    syncListening()
    startTicker()
  }

  /// The user's Stop listening. The camera stream keeps running so a photo stays instant;
  /// "Stop stream" ends it.
  func stopListening() {
    guard let streamer, streamer.phase.isActive else { return }
    streamer.stop()
    presenter.stopOutput()
    syncListening()
  }

  // MARK: Look and check

  /// The app's "Check this" button: photo from the running stream, OCR on the phone, text to
  /// the checker.
  func checkThis() async {
    guard isConnected, let coordinator else {
      checkMessage = "Connect to the backend first."
      return
    }
    guard !coordinator.isRunning else { return }
    checkMessage = nil
    guard await ensureSessionActive() else {
      checkMessage = "The backend session is paused. Disconnect and connect again."
      return
    }
    coordinator.trigger(.button)
  }

  // MARK: Output controls

  func repeatLatest() {
    presenter.repeatLatest()
  }

  func dismissCard() {
    presenter.dismissCard()
  }

  /// Opening a history entry shows its card again, without speech.
  func show(_ entry: ResultHistory.Entry) {
    lens.show(entry.card)
  }

  // MARK: Wiring

  private func build(_ config: BackendConfig) {
    let backend = makeBackend(config)
    backend.onUnreadableEvent = { [weak self] type in self?.unreadableEvent(type) }
    let streamer = AudioStreamer(channel: backend, clock: audioClock, debugLog: debugLog)
    streamer.onStopped = { [weak self] reason in self?.listeningStopped(reason) }
    streamer.onAutoResumed = { [weak self] in self?.autoResumed() }
    relay.target = streamer
    let coordinator = LookAndCheckCoordinator(
      channel: backend, photo: camera, recognizer: recognizer, submitter: backend, debugLog: debugLog
    )
    coordinator.onOutcome = { [weak self] outcome in self?.checkFinished(outcome) }
    // Voice triggers too: a session the server paused after a reconnect is resumed first.
    coordinator.prepareSubmit = { [weak self] in await self?.ensureSessionActive() ?? false }
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
    stopListening()
    coordinator?.stop()
    cancelCheckTimers()
    for task in subscriptions { task.cancel() }
    subscriptions = []
    if let backend { await backend.close() }
    backend = nil
    streamer = nil
    coordinator = nil
    relay.target = nil
    sessionActive = nil
    speechAvailable = nil
  }

  private func handle(_ state: ChannelConnectionState) {
    connection = state
    if case .disconnected(let reason) = state, Self.renewableEndReasons.contains(reason) {
      renewSession(after: reason)
    }
    syncListening()
  }

  private func handle(_ event: ServerEvent) {
    switch event.payload {
    case .sessionReady(let payload):
      sessionActive = payload.active
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
      sessionActive = false
      if Self.renewableEndReasons.contains(payload.reasonCode) {
        if streamer?.phase.isActive ?? false { listenAfterRenewal = true }
        debugDecision(event, "renew_session", ["reason": payload.reasonCode, "listenAfterRenewal": listenAfterRenewal])
        notice = "The backend ended the session (\(payload.reasonCode)). Opening a new one…"
      }
    case .claimResult(let result):
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
      presenter.present(result, presentation: result.presentation, userInitiated: manual, identity: identity)
    case .claimNeedsConfirmation, .claimSkipped:
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
      resolveCheck(event.requestId)
      if let requestId = event.requestId {
        // "That statement was corrected" only while listening: never after the user's Stop.
        let announce = payload.presentation?.action == .respond && (streamer?.phase.isActive ?? false)
        debugDecision(event, "supersede", ["announce": announce])
        presenter.supersede(requestId: requestId, revision: event.revision, announce: announce)
      }
    case .checkCancelled:
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
        self.notice = "Couldn't resume the backend session. Disconnect and connect again."
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

  /// The server ended the session (5 minute lifetime). Opens a new one with the same join
  /// code and resumes listening if it was on, instead of stopping mid-demo.
  private func renewSession(after reason: String) {
    guard let backend, !isRenewing else { return }
    guard canRenew else {
      // listeningStopped already spoke the reason, because no renewal was due.
      listenAfterRenewal = false
      notice = "The backend ended the session (\(reason)). Tap Connect for a new one."
      return
    }
    lastRenewalAt = uptime()
    isRenewing = true
    sessionActive = nil
    log.info("session ended (\(reason, privacy: .public)), opening a new one")
    debugLog.log("live.renew", ["reason": reason, "listenAfterRenewal": listenAfterRenewal])
    Task {
      defer { self.isRenewing = false }
      do {
        try await backend.connect()
      } catch {
        self.log.error("session renewal failed \(BackendClient.reasonCode(for: error), privacy: .public)")
        self.debugLog.log("live.renew_failed", ["reason": BackendClient.reasonCode(for: error), "error": String(describing: error)])
        self.connection = backend.connectionState
        self.notice = "The backend ended the session and a new one didn't open. Tap Connect."
        if self.listenAfterRenewal { self.speakStopReason(.sessionEnded(reasonCode: reason)) }
        self.listenAfterRenewal = false
        return
      }
      // Read only now: the streamer's own stop may land after the disconnect.
      let listen = self.listenAfterRenewal
      self.listenAfterRenewal = false
      self.connection = backend.connectionState
      guard listen else {
        self.notice = "The session expired, so a new one started."
        return
      }
      await self.startListening()
      if self.isListening {
        self.notice = "The session expired, so a new one started. Listening resumed."
        if !self.isMuted { self.chime.playChime() }
      } else if self.notice == nil {
        self.notice = "The session expired, so a new one started. Tap Start listening."
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

  private func listeningStopped(_ reason: AudioStreamerStopReason) {
    listening = .stopped(reason)
    log.info("listening stopped \(reason.code, privacy: .public)")
    debugLog.log("live.listening_stopped", ["reason": reason.code, "canRenew": canRenew, "isRenewing": isRenewing])
    if case .sessionEnded(let code) = reason, Self.renewableEndReasons.contains(code), canRenew || isRenewing {
      // A new session opens and listening resumes; the reason is spoken only if that fails.
      listenAfterRenewal = true
      return
    }
    speakStopReason(reason)
  }

  /// A distinct spoken reason for every failure (decision 9). Nil for the user's own Stop.
  private func speakStopReason(_ reason: AudioStreamerStopReason) {
    if let message = reason.spokenMessage, !isMuted {
      speaker.speak(message, rate: presenter.speechRate) {}
    }
  }

  private var canRenew: Bool {
    guard let lastRenewalAt else { return true }
    return uptime() - lastRenewalAt >= Self.minimumRenewalInterval
  }

  private func autoResumed() {
    notice = "Reconnected. Listening resumed."
    // A chime is not playback, so it is not reported to the backend.
    if !isMuted { chime.playChime() }
    syncListening()
  }

  private func streamStopped(byUser: Bool) {
    debugLog.log("live.stream_stopped", ["byUser": byUser, "listening": String(describing: streamer?.phase ?? .idle)])
    guard let streamer, streamer.phase.isActive else { return }
    if byUser {
      streamer.stop()
    } else {
      streamer.glassesDisconnected()
    }
    syncListening()
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
  }

  static func checkFailureMessage(_ reason: String) -> String {
    switch reason {
    case "no_session": "No backend session. Connect first."
    case "session_paused": "The backend session is paused. Disconnect and connect again."
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
    return requestId.hasPrefix("ocr-") || pendingChecks.contains(requestId)
  }

  private func isPhotoRequest(_ requestId: String?) -> Bool {
    requestId?.hasPrefix("ocr-") ?? false
  }

  private func startTimer(for requestId: String) {
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

  // MARK: Lens and listening state

  /// One task sends lens updates in order. Each send finishes before the next starts.
  private func startLensPump() {
    let (updates, continuation) = AsyncStream<ResultCard?>.makeStream(bufferingPolicy: .bufferingNewest(1))
    lensUpdates = continuation
    let display = display
    let onRepeat: @Sendable () -> Void = { [weak self] in
      Task { @MainActor in self?.repeatLatest() }
    }
    let onDismiss: @Sendable () -> Void = { [weak self] in
      Task { @MainActor in self?.dismissCard() }
    }
    lensPump = Task {
      for await card in updates {
        guard let display, display.isConnected else { continue }
        await display.showCard(card, onRepeat: card == nil ? nil : onRepeat, onDismiss: card == nil ? nil : onDismiss)
      }
    }
  }

  /// AudioStreamer is not observable, so its phase is copied after every input and on a short
  /// ticker while it is active.
  private func syncListening() {
    let phase = streamer?.phase ?? .idle
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
        if self.listening != phase { self.listening = phase }
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
