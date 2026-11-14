import AVFoundation
import Foundation
import Observation
import os

// Live mode: wires BackendClient, AudioStreamer, LookAndCheckCoordinator and ResultPresenter
// to the glasses camera and display. Rules from docs/live-pipeline.md that apply here:
// - The camera stream is never paused or stopped for a photo (decision 5a).
// - Provider keys never reach the app; it talks only to services/api.
// - Logs carry ids, codes and counts. Never audio, transcripts or OCR text.

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
  func connect() async throws
  func close() async
}

extension BackendClient: LiveBackend {}

/// The glasses camera as Live mode needs it. `CameraModel` is the real one.
@MainActor
protocol LiveCamera: PhotoCapturing {
  var isStreaming: Bool { get }
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
  /// A manual check with no outcome after this long is reported as "The check didn't finish."
  /// The backend's own deadline is 10 s.
  nonisolated static let defaultCheckTimeout: TimeInterval = 15

  // MARK: Settings (UserDefaults)

  var baseURLText: String
  var joinCode: String
  var demoQuality: Bool {
    didSet { defaults.set(demoQuality, forKey: Self.demoQualityKey) }
  }
  var isMuted: Bool {
    didSet {
      presenter.isMuted = isMuted
      defaults.set(isMuted, forKey: Self.mutedKey)
    }
  }

  // MARK: State

  private(set) var connection: ChannelConnectionState = .idle
  private(set) var listening: AudioStreamerPhase = .idle
  private(set) var isStartingStream = false
  /// The last non-fatal problem, e.g. a stream that wouldn't start or a backend error code.
  private(set) var notice: String?
  /// Phone-side status of the last "Check this".
  private(set) var checkMessage: String?
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
  @ObservationIgnored private let configureAudioSession: () -> Void
  @ObservationIgnored private let log = Logger(subsystem: "com.davidvasilescu.junction.glasseslab", category: "live")

  @ObservationIgnored private var backend: LiveBackend?
  @ObservationIgnored private var streamer: AudioStreamer?
  @ObservationIgnored private var coordinator: LookAndCheckCoordinator?
  @ObservationIgnored private var subscriptions: [Task<Void, Never>] = []
  @ObservationIgnored private var ticker: Task<Void, Never>?
  @ObservationIgnored private var checkTimers: [String: Task<Void, Never>] = [:]
  /// Manual request ids that already had an outcome, so a late 202 starts no timer.
  @ObservationIgnored private var resolvedChecks: Set<String> = []

  init(
    camera: LiveCamera,
    display: LensDisplaying?,
    defaults: UserDefaults = .standard,
    speaker: SpeechSpeaking? = nil,
    chime: ChimePlaying? = nil,
    recognizer: TextRecognizing? = nil,
    audioClock: AudioStreamerClock? = nil,
    checkTimeout: TimeInterval = LiveModel.defaultCheckTimeout,
    configureAudioSession: (() -> Void)? = nil,
    makeBackend: (@MainActor (BackendConfig) -> LiveBackend)? = nil
  ) {
    let config = BackendConfig.load(from: defaults)
    self.baseURLText = config.baseURL.absoluteString
    self.joinCode = config.joinCode
    self.demoQuality = defaults.object(forKey: Self.demoQualityKey) as? Bool ?? true
    self.isMuted = defaults.bool(forKey: Self.mutedKey)
    self.camera = camera
    self.display = display
    self.defaults = defaults
    let speaker = speaker ?? SystemSpeechSpeaker()
    let chime = chime ?? ToneChimePlayer()
    self.speaker = speaker
    self.chime = chime
    self.recognizer = recognizer ?? OCRService()
    self.audioClock = audioClock
    self.checkTimeout = checkTimeout
    self.configureAudioSession = configureAudioSession ?? LiveModel.configureSpokenOutput
    self.makeBackend = makeBackend ?? { BackendClient(config: $0) }
    let history = ResultHistory()
    let lens = LensCardViewModel()
    let relay = PlaybackRelay()
    self.history = history
    self.lens = lens
    self.relay = relay
    self.presenter = ResultPresenter(speaker: speaker, chime: chime, playback: relay, history: history, lens: lens)
    presenter.isMuted = isMuted

    lens.onChange = { [weak self] card in self?.sendToLens(card) }
    camera.onStreamStopped = { [weak self] byUser in self?.streamStopped(byUser: byUser) }
    camera.onAudioBuffer = { [weak self] buffer in self?.streamer?.append(buffer) }
  }

  // MARK: Connection

  /// Saves the URL and join code, then opens a session and its event stream.
  func connect() async {
    guard canEditBackend else { return }
    notice = nil
    guard let config = makeConfig() else {
      connection = .disconnected(reason: "invalid_url")
      return
    }
    config.save(to: defaults)
    if backend?.config != config {
      await tearDown()
      build(config)
    }
    guard let backend else { return }
    configureAudioSession()
    coordinator?.start()
    connection = .connecting
    do {
      try await backend.connect()
    } catch {
      log.error("connect failed \(BackendClient.reasonCode(for: error), privacy: .public)")
    }
    connection = backend.connectionState
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
    let streamer = AudioStreamer(channel: backend, clock: audioClock)
    streamer.onStopped = { [weak self] reason in self?.listeningStopped(reason) }
    streamer.onAutoResumed = { [weak self] in self?.autoResumed() }
    relay.target = streamer
    let coordinator = LookAndCheckCoordinator(channel: backend, photo: camera, recognizer: recognizer, submitter: backend)
    coordinator.onOutcome = { [weak self] outcome in self?.checkFinished(outcome) }
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
    syncListening()
  }

  private func handle(_ event: ServerEvent) {
    switch event.payload {
    case .sessionReady(let payload):
      sessionActive = payload.active
      speechAvailable = payload.audio
      // After a disconnect the server pauses the session. While listening, AudioStreamer
      // resumes it (within 5 s). Otherwise resume here so manual checks keep working.
      if !payload.active, !(streamer?.phase.isActive ?? false) {
        resume(epoch: event.sessionEpoch)
      }
    case .sessionEnded(let payload):
      sessionActive = false
      if ["deleted", "expired"].contains(payload.reasonCode) {
        notice = "The backend ended the session (\(payload.reasonCode)). Tap Connect for a new one."
      }
    case .claimResult(let result):
      let manual = isUserInitiated(event.requestId)
      resolveCheck(event.requestId)
      guard let identity = ClaimIdentity(event: event) else { return }
      presenter.present(result, presentation: result.presentation, userInitiated: manual, identity: identity)
    case .claimNeedsConfirmation:
      let manual = isUserInitiated(event.requestId)
      resolveCheck(event.requestId)
      presenter.presentOutcome(.needsConfirmation(heard: !isPhotoRequest(event.requestId)), userInitiated: manual)
    case .claimSkipped:
      // An explicit request always gets an answer; automatic skips stay quiet.
      let manual = isUserInitiated(event.requestId)
      resolveCheck(event.requestId)
      if manual {
        presenter.presentOutcome(.needsConfirmation(heard: !isPhotoRequest(event.requestId)), userInitiated: true)
      }
    case .pipelineError(let payload):
      if let requestId = event.requestId {
        let manual = isUserInitiated(requestId)
        resolveCheck(requestId)
        presenter.presentOutcome(.checkFailed, userInitiated: manual)
      } else {
        notice = "Backend error: \(payload.reasonCode)"
      }
    case .checkCancelled, .claimSuperseded:
      resolveCheck(event.requestId)
    case .captureRequest:
      // LookAndCheckCoordinator takes the photo itself; this is only the phone-side note.
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
      }
    }
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
    // A distinct spoken reason for every failure (decision 9). Nil for the user's own Stop.
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

  private func streamStopped(byUser: Bool) {
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
    guard pendingChecks.remove(requestId) != nil else { return }
    resolvedChecks.insert(requestId)
    log.info("manual check timed out req=\(requestId, privacy: .public)")
    presenter.presentOutcome(.checkFailed, userInitiated: true)
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
  }

  // MARK: Lens and listening state

  private func sendToLens(_ card: ResultCard?) {
    guard let display, display.isConnected else { return }
    let onRepeat: @Sendable () -> Void = { [weak self] in
      Task { @MainActor in self?.repeatLatest() }
    }
    let onDismiss: @Sendable () -> Void = { [weak self] in
      Task { @MainActor in self?.dismissCard() }
    }
    Task { await display.showCard(card, onRepeat: card == nil ? nil : onRepeat, onDismiss: card == nil ? nil : onDismiss) }
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

  private func makeConfig() -> BackendConfig? {
    let text = baseURLText.trimmingCharacters(in: .whitespacesAndNewlines)
    guard let url = URL(string: text), url.scheme == "http" || url.scheme == "https", url.host() != nil else { return nil }
    return BackendConfig(baseURL: url, joinCode: joinCode.trimmingCharacters(in: .whitespacesAndNewlines))
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
