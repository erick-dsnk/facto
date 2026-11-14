import AVFoundation
import XCTest
@testable import GlassesLab

// MARK: - Fakes

/// A backend that behaves like services/api for the parts LiveModel uses: connect emits
/// `session.ready`, `session.resume` re-activates the session, checks are recorded.
@MainActor
private final class FakeLiveBackend: LiveBackend {
  struct ConnectFailure: Error {}

  let config: BackendConfig
  var sessionId: String?
  var sessionEpoch: Int?
  var connectionState: ChannelConnectionState = .idle
  var onUnreadableEvent: (@MainActor (String?) -> Void)?
  var failConnect = false
  /// The client's reason code for a failed connect.
  var failReason = "unauthorized"
  private(set) var connectCount = 0
  var readyActive = true
  var readyAudio: Bool? = true
  private(set) var submitted: [TextInputEnvelope] = []
  private(set) var controls: [[String: Any]] = []
  private(set) var binaryCount = 0
  private(set) var closeCount = 0
  private var eventContinuations: [AsyncStream<ServerEvent>.Continuation] = []
  private var stateContinuations: [AsyncStream<ChannelConnectionState>.Continuation] = []

  init(config: BackendConfig) {
    self.config = config
  }

  var controlTypes: [String] { controls.compactMap { $0["type"] as? String } }
  /// Control types other than `session.preferences`, which goes out on every session.ready.
  var audioControlTypes: [String] { controlTypes.filter { $0 != "session.preferences" } }

  func connect() async throws {
    connectCount += 1
    setState(.connecting)
    if failConnect {
      setState(.disconnected(reason: failReason))
      throw ConnectFailure()
    }
    // Each session has its own id, like services/api.
    sessionId = connectCount == 1 ? "sess-live" : "sess-live-\(connectCount)"
    sessionEpoch = 1
    setState(.connected)
    emit(LiveEvents.sessionReady(active: readyActive, audio: readyAudio, epoch: 1, session: sessionId!))
  }

  /// The server deletes the session (its 5 minute lifetime ran out): `session.ended` with the
  /// raised epoch, then the socket closes and the client forgets the session.
  func endSession(reason: String) {
    guard let sessionId, let sessionEpoch else { return }
    emit(LiveEvents.event(
      .sessionEnded, epoch: sessionEpoch + 1, session: sessionId,
      payload: .sessionEnded(SessionEndedPayload(reasonCode: reason, active: false))
    ))
    self.sessionId = nil
    self.sessionEpoch = nil
    setState(.disconnected(reason: reason))
  }

  func close() async {
    closeCount += 1
    sessionId = nil
    sessionEpoch = nil
    setState(.disconnected(reason: "closed"))
  }

  func submit(_ input: TextInputEnvelope) async throws {
    submitted.append(input)
  }

  func connectionStates() -> AsyncStream<ChannelConnectionState> {
    let (stream, continuation) = AsyncStream<ChannelConnectionState>.makeStream()
    continuation.yield(connectionState)
    stateContinuations.append(continuation)
    return stream
  }

  func events() -> AsyncStream<ServerEvent> {
    let (stream, continuation) = AsyncStream<ServerEvent>.makeStream()
    eventContinuations.append(continuation)
    return stream
  }

  func sendControl<Message: Encodable & Sendable>(_ message: Message) async throws {
    let object = (try JSONSerialization.jsonObject(with: try JSONEncoder().encode(message))) as? [String: Any] ?? [:]
    controls.append(object)
    if object["type"] as? String == "session.resume", let epoch = sessionEpoch, let sessionId {
      emit(LiveEvents.sessionReady(active: true, audio: readyAudio, epoch: epoch, session: sessionId))
    }
  }

  func sendBinary(_ data: Data) async throws {
    binaryCount += 1
  }

  func emit(_ event: ServerEvent) {
    for continuation in eventContinuations { continuation.yield(event) }
  }

  func setState(_ state: ChannelConnectionState) {
    connectionState = state
    for continuation in stateContinuations { continuation.yield(state) }
  }
}

@MainActor
private final class FakeLiveCamera: LiveCamera {
  var isStreaming = false
  var liveQuality: StreamQuality = .demo
  var onAudioBuffer: (@MainActor (AVAudioPCMBuffer) -> Void)?
  var onStreamStopped: (@MainActor (_ byUser: Bool) -> Void)?
  var startError: Error?
  private(set) var startedQualities: [StreamQuality] = []
  private(set) var photoCount = 0

  func startListeningStream(quality: StreamQuality) async throws {
    if let startError { throw startError }
    startedQualities.append(quality)
    isStreaming = true
  }

  func captureStillDuringStream() async throws -> Data {
    photoCount += 1
    return Data([0xFF, 0xD8, 0xFF])
  }

  func dropStream(byUser: Bool) {
    isStreaming = false
    onStreamStopped?(byUser)
  }

  private(set) var liveStreamStops = 0

  func stopLiveStream() async {
    liveStreamStops += 1
    dropStream(byUser: true)
  }
}

@MainActor
private final class FakeWakeListener: WakeWordListening {
  var onWake: (@MainActor (WakeCommand) -> Void)?
  private(set) var isRunning = false
  var inputName: String? { isRunning ? "Test glasses" : nil }
  var startError: WakeWordError?
  private(set) var starts = 0
  private(set) var stops = 0

  func start() async throws {
    if let startError { throw startError }
    starts += 1
    isRunning = true
  }

  func stop() {
    guard isRunning else { return }
    stops += 1
    isRunning = false
  }

  /// The detector hears the phrase.
  func hear(_ command: WakeCommand = .listen) {
    guard isRunning else { return }
    onWake?(command)
  }
}

private final class FakeTextRecognizer: TextRecognizing, @unchecked Sendable {
  var result = OCRResult(text: "Helsinki is the capital of Finland.", meanConfidence: 0.9, lineCount: 1, droppedLineCount: 0)
  func recognizeText(in imageData: Data) async throws -> OCRResult { result }
}

@MainActor
private final class RecordingSpeaker: SpeechSpeaking {
  private(set) var spoken: [String] = []
  func speak(_ text: String, rate: Float, onFinish: @escaping @MainActor () -> Void) {
    spoken.append(text)
  }
  func stopSpeaking() {}
}

@MainActor
private final class CountingChime: ChimePlaying {
  private(set) var count = 0
  func playChime() { count += 1 }
}

@MainActor
private final class FakeLens: LensDisplaying {
  var isConnected = true
  private(set) var cards: [ResultCard?] = []
  func showCard(_ card: ResultCard?, onRepeat: (@Sendable () -> Void)?, onDismiss: (@Sendable () -> Void)?) async {
    cards.append(card)
  }
}

private enum LiveEvents {
  private static var seq = 0

  static func event(
    _ type: ServerEventType, epoch: Int = 1, session: String = "sess-live", requestId: String? = nil, claimId: String? = nil,
    revision: Int? = nil, payload: ServerEventPayload
  ) -> ServerEvent {
    seq += 1
    return ServerEvent(
      eventId: "live-evt-\(seq)", eventSeq: seq, sessionId: session, sessionEpoch: epoch, requestId: requestId,
      claimId: claimId, revision: revision, type: type, serverAt: "2026-11-14T10:00:00.000Z", payload: payload
    )
  }

  static func sessionReady(active: Bool, audio: Bool?, epoch: Int, session: String = "sess-live") -> ServerEvent {
    event(
      .sessionReady, epoch: epoch, session: session,
      payload: .sessionReady(SessionReadyPayload(active: active, expiresAt: nil, mode: "fixture", audio: audio))
    )
  }

  static func admission(_ type: ServerEventType, requestId: String) -> ServerEvent {
    let payload = AdmissionPayload(admissionAction: .skip, reasonCode: "fixture", presentation: nil)
    return event(
      type, requestId: requestId, revision: 1,
      payload: type == .claimSkipped ? .claimSkipped(payload) : .claimNeedsConfirmation(payload)
    )
  }

  static func superseded(requestId: String, revision: Int, action: PresentationAction) -> ServerEvent {
    event(
      .claimSuperseded, requestId: requestId, revision: revision,
      payload: .claimSuperseded(SupersededPayload(reasonCode: "corrected", presentation: Presentation(action: action, reasonCode: "correction_status")))
    )
  }

  static func error(_ code: String, requestId: String? = nil) -> ServerEvent {
    event(.pipelineError, requestId: requestId, payload: .pipelineError(PipelineErrorPayload(reasonCode: code)))
  }

  static func audioReady(generation: Int, epoch: Int = 1) -> ServerEvent {
    event(.audioReady, epoch: epoch, payload: .audioReady(AudioReadyPayload(
      streamGeneration: generation, encoding: "pcm_s16le", sampleRateHz: 16_000, channels: 1, source: .glassesStreamAudio
    )))
  }

  static func captureRequest() -> ServerEvent {
    event(.captureRequest, payload: .captureRequest)
  }

  static func result(requestId: String, action: PresentationAction, verdict: Verdict = .supported, withIds: Bool = true) -> ServerEvent {
    let text = "Helsinki is the capital of Finland."
    let evidence = Evidence(
      id: "ev-1", url: "https://en.wikipedia.org/wiki/Helsinki", title: "Helsinki", publisher: "Wikipedia",
      publishedAt: nil, retrievedAt: "2026-11-14T10:00:01Z", contentBasis: "highlight", excerpt: "Helsinki is the capital.",
      sourceGroup: "wikipedia.org", echoGroup: nil, sourceRole: "reference", directlyAddressesClaim: true,
      matchesTimePlaceAndPopulation: true, stance: .supports, stanceProbability: 0.9
    )
    let result = ClaimResult(
      verdict: verdict, reasonCode: "fixture", selectedEvidenceIds: ["ev-1"], summary: "", originalText: text,
      checkedText: text, sourceSpan: SourceSpan(start: 0, end: CodePoints.count(text)), evidence: [evidence],
      checkedAt: "2026-11-14T10:00:02Z", expiresAt: "2026-11-14T10:01:02Z", durationMs: 900, cached: false,
      policyVersion: "glasses-p0.1", modelVersion: "fixture", presentation: Presentation(action: action, reasonCode: "fixture")
    )
    return event(
      .claimResult, requestId: requestId, claimId: withIds ? "\(requestId)-c1" : nil, revision: withIds ? 1 : nil,
      payload: .claimResult(result)
    )
  }
}

// MARK: - Status

final class LiveStatusTests: XCTestCase {
  func testEachFailureHasItsOwnState() {
    XCTAssertEqual(LiveStatus.make(connection: .connected, listening: .streaming(generation: 1)), .listening)
    XCTAssertEqual(LiveStatus.make(connection: .connected, listening: .pausedForPlayback), .listening)
    XCTAssertEqual(LiveStatus.make(connection: .connected, listening: .awaitingReady(generation: 2)), .startingToListen)
    XCTAssertEqual(LiveStatus.make(connection: .connected, listening: .idle, startingStream: true), .startingToListen)
    XCTAssertEqual(LiveStatus.make(connection: .reconnecting(attempt: 2), listening: .reconnecting), .reconnecting(attempt: 2))
    XCTAssertEqual(
      LiveStatus.make(connection: .connected, listening: .stopped(.glassesDisconnected)), .listeningStopped(.glassesDisconnected)
    )
    XCTAssertEqual(
      LiveStatus.make(connection: .disconnected(reason: "network_lost"), listening: .stopped(.noConnection)),
      .backendError(code: "network_lost")
    )
    // The user's own Stop and Disconnect are not failures.
    XCTAssertEqual(LiveStatus.make(connection: .connected, listening: .stopped(.requested)), .connected)
    XCTAssertEqual(LiveStatus.make(connection: .disconnected(reason: "closed"), listening: .stopped(.requested)), .offline)
    XCTAssertEqual(LiveStatus.make(connection: .idle, listening: .idle), .offline)
  }

  func testStatesReadDifferently() {
    let states: [LiveStatus] = [
      .offline, .connecting, .connected, .startingToListen, .listening, .reconnecting(attempt: 1),
      .listeningStopped(.noConnection), .listeningStopped(.glassesDisconnected),
      .listeningStopped(.sessionEnded(reasonCode: "deleted")), .listeningStopped(.audioUnavailable(reasonCode: "asr_failed")),
      .backendError(code: "unauthorized"), .backendError(code: "network_lost"), .backendError(code: "connect_timeout"),
    ]
    XCTAssertEqual(Set(states.map(\.title)).count, states.count)
    XCTAssertEqual(LiveStatus.listening.tone, .good)
    XCTAssertNotEqual(LiveStatus.connected.title, LiveStatus.listening.title)
    for failure in states where failure.title.hasPrefix("Listening stopped") || failure.title.contains("Connection lost") {
      XCTAssertEqual(failure.tone, .bad, failure.title)
    }
  }

  func testTitlesAndDetailsUseTheHomeScreenCopy() {
    XCTAssertEqual(LiveStatus.offline.title, "Offline")
    XCTAssertEqual(LiveStatus.offline.detail, "Tap Reconnect to go online.")
    XCTAssertEqual(LiveStatus.connecting.title, "Connecting…")
    XCTAssertEqual(LiveStatus.connecting.detail, "Opening a session.")
    XCTAssertEqual(LiveStatus.connected.title, "Online")
    XCTAssertEqual(LiveStatus.connected.detail, "Tap Start listening, or Check this to read what’s in front of you.")
    XCTAssertEqual(LiveStatus.startingToListen.title, "Starting to listen…")
    XCTAssertEqual(LiveStatus.startingToListen.detail, "Waiting for the glasses stream and the backend.")
    XCTAssertEqual(LiveStatus.listening.title, "Listening")
    XCTAssertEqual(LiveStatus.listening.detail, "No alert doesn’t mean a claim is true.")
    XCTAssertEqual(LiveStatus.reconnecting(attempt: 2).title, "Reconnecting…")
    XCTAssertEqual(LiveStatus.reconnecting(attempt: 2).detail, "Connection dropped. Attempt 2 of 3.")
    XCTAssertEqual(LiveStatus.reconnecting(attempt: 0).detail, "Connection dropped.")

    let stopped: [(AudioStreamerStopReason, String)] = [
      (.glassesDisconnected, "Listening stopped: glasses disconnected"),
      (.noConnection, "Listening stopped: no connection"),
      (.sessionEnded(reasonCode: "deleted"), "Listening stopped: session ended"),
      (.audioUnavailable(reasonCode: "asr_failed"), "Listening stopped: mic unavailable"),
    ]
    for (reason, title) in stopped {
      XCTAssertEqual(LiveStatus.listeningStopped(reason).title, title)
      XCTAssertEqual(LiveStatus.listeningStopped(reason).detail, "Tap Start listening to try again.")
    }

    let errors: [(String, String)] = [
      ("network_lost", "Connection lost"), ("connect_failed", "Connection lost"),
      ("unauthorized", "Join code rejected"), ("http_401", "Join code rejected"), ("http_403", "Join code rejected"),
      ("deleted", "Session ended"), ("expired", "Session ended"),
      ("connect_timeout", "Backend not responding"), ("timed_out", "Backend not responding"),
      ("invalid_url", "Backend URL not valid"), ("insecure_url", "Backend URL needs https"),
      ("missing_join_code", "Join code needed"), ("something_new", "Backend error"),
    ]
    for (code, title) in errors {
      XCTAssertEqual(LiveStatus.backendError(code: code).title, title, code)
    }
    XCTAssertEqual(LiveStatus.backendError(code: "network_lost").detail, "Reason: network_lost.")
    XCTAssertEqual(LiveStatus.backendError(code: "missing_join_code").detail, "Add your join code in Settings.")
  }
}

// MARK: - Model

@MainActor
final class LiveModelTests: XCTestCase {
  private var defaults: UserDefaults!
  private var suiteName: String!
  private var camera: FakeLiveCamera!
  private var lens: FakeLens!
  private var speaker: RecordingSpeaker!
  private var chime: CountingChime!
  private var recognizer: FakeTextRecognizer!
  private var clock: ManualClock!
  private var backends: [FakeLiveBackend] = []
  private var configureBackend: ((FakeLiveBackend) -> Void)?
  private var keepAwake: [Bool] = []
  private var wake: FakeWakeListener!
  private var secrets: MemorySecretStore!
  private var now: TimeInterval = 1_000

  override func setUp() async throws {
    suiteName = "LiveModelTests-\(UUID().uuidString)"
    defaults = UserDefaults(suiteName: suiteName)
    camera = FakeLiveCamera()
    lens = FakeLens()
    speaker = RecordingSpeaker()
    chime = CountingChime()
    recognizer = FakeTextRecognizer()
    clock = ManualClock()
    backends = []
    configureBackend = nil
    keepAwake = []
    wake = FakeWakeListener()
    now = 1_000
    secrets = MemorySecretStore()
  }

  override func tearDown() async throws {
    defaults.removePersistentDomain(forName: suiteName)
  }

  private var backend: FakeLiveBackend { backends.last! }

  private func makeModel(checkTimeout: TimeInterval = 15) -> LiveModel {
    LiveModel(
      camera: camera, display: lens, defaults: defaults, secrets: secrets, speaker: speaker, chime: chime, recognizer: recognizer,
      audioClock: clock, checkTimeout: checkTimeout, configureAudioSession: {},
      idleTimer: { [unowned self] in self.keepAwake.append($0) },
      uptime: { [unowned self] in self.now },
      wakeListener: wake, wakeWindow: 0.4, wakeCheckWindow: 0.4,
      makeBackend: { [unowned self] config in
        let backend = FakeLiveBackend(config: config)
        self.configureBackend?(backend)
        self.backends.append(backend)
        return backend
      }
    )
  }

  private func connectedModel(checkTimeout: TimeInterval = 15) async -> LiveModel {
    let model = makeModel(checkTimeout: checkTimeout)
    model.baseURLText = "https://api.example.test"
    model.joinCode = "demo-code"
    await model.connect()
    await waitUntil { model.status == .connected }
    return model
  }

  private func listeningModel() async -> LiveModel {
    let model = await connectedModel()
    await model.startListening()
    await waitUntil { self.backend.controlTypes.contains("audio.start") }
    backend.emit(LiveEvents.audioReady(generation: 1))
    await waitUntil { model.status == .listening }
    return model
  }

  // MARK: Wake phrase

  func testWakeOptionIsOffByDefaultAndNeverOpensTheMicrophone() async {
    let model = await connectedModel()
    XCTAssertFalse(model.wakeWordEnabled)
    XCTAssertEqual(model.wakeState, .off)
    XCTAssertEqual(wake.starts, 0)
  }

  func testWakeOptionWaitsOnlyWhenConnectedAndStartsNoStream() async {
    let model = makeModel()
    model.wakeWordEnabled = true
    XCTAssertEqual(model.wakeState, .blocked("Connect to the backend to arm it."))
    XCTAssertEqual(wake.starts, 0)

    model.baseURLText = "https://api.example.test"
    model.joinCode = "demo-code"
    await model.connect()
    await waitUntil { model.wakeState.isWaiting }
    XCTAssertTrue(wake.isRunning)
    XCTAssertTrue(camera.startedQualities.isEmpty, "no glasses stream while waiting for the phrase")
    XCTAssertFalse(backend.controlTypes.contains("audio.start"), "no audio is offered to the backend while waiting")
    XCTAssertEqual(keepAwake.last, true)
    XCTAssertTrue(defaults.bool(forKey: LiveModel.wakeWordKey), "the option persists")
  }

  func testWakePhraseStartsListeningThenGoesBackToWaiting() async {
    let model = await connectedModel()
    model.wakeWordEnabled = true
    await waitUntil { model.wakeState.isWaiting }
    let armed = wake.starts

    wake.hear()
    XCTAssertEqual(model.wakeState, .awake)
    XCTAssertFalse(wake.isRunning, "the detector's microphone is released before the stream starts")
    XCTAssertEqual(chime.count, 1)
    await waitUntil { self.backend.controlTypes.contains("audio.start") }
    XCTAssertEqual(camera.startedQualities.count, 1)
    backend.emit(LiveEvents.audioReady(generation: 1))

    // After the window: listening and the stream it started are stopped, and it waits again.
    await waitUntil { self.wake.starts == armed + 1 }
    XCTAssertFalse(model.isListening)
    XCTAssertTrue(backend.controlTypes.contains("audio.stop"))
    XCTAssertEqual(camera.liveStreamStops, 1)
    XCTAssertFalse(camera.isStreaming)
    XCTAssertTrue(model.wakeState.isWaiting)
  }

  func testHeyFactoCheckThisTakesAPhotoWithoutListening() async {
    // A short check timeout: the fake backend never answers, and the wake session waits for
    // a check in flight before it ends.
    let model = await connectedModel(checkTimeout: 0.3)
    model.wakeWordEnabled = true
    await waitUntil { model.wakeState.isWaiting }

    wake.hear(.checkThis)
    await waitUntil { self.camera.photoCount == 1 }
    XCTAssertFalse(wake.isRunning, "the detector's microphone is released before the photo")
    XCTAssertEqual(chime.count, 1)
    XCTAssertFalse(backend.controlTypes.contains("audio.start"), "a photo check does not start listening")
    XCTAssertEqual(model.wakeState, .awake)
    // Once the check is over it waits for the phrase again.
    await waitUntil(timeout: 5) { model.wakeState.isWaiting }
    XCTAssertTrue(model.pendingChecks.isEmpty)
  }

  func testStartingToListenByHandPausesTheDetector() async {
    let model = await connectedModel()
    model.wakeWordEnabled = true
    await waitUntil { self.wake.isRunning }
    await model.startListening()
    XCTAssertFalse(wake.isRunning)
    XCTAssertEqual(model.wakeState, .blocked("Paused while listening."))
    XCTAssertEqual(camera.liveStreamStops, 0, "a stream the user started is never stopped by the wake option")
  }

  func testTurningTheOptionOffStopsTheDetector() async {
    let model = await connectedModel()
    model.wakeWordEnabled = true
    await waitUntil { self.wake.isRunning }
    model.wakeWordEnabled = false
    await waitUntil { !self.wake.isRunning }
    XCTAssertEqual(model.wakeState, .off)
    XCTAssertFalse(defaults.bool(forKey: LiveModel.wakeWordKey))
  }

  func testADetectorThatCannotStartIsReportedOnce() async {
    wake.startError = .microphoneDenied
    let model = await connectedModel()
    model.wakeWordEnabled = true
    await waitUntil { model.wakeState == .unavailable(WakeWordError.microphoneDenied.message) }
    try? await Task.sleep(nanoseconds: 50_000_000)
    XCTAssertEqual(wake.starts, 0)
    XCTAssertEqual(model.wakeState, .unavailable(WakeWordError.microphoneDenied.message))
  }

  // MARK: Connection

  func testConnectSavesSettingsAndConnects() async {
    let model = await connectedModel()
    XCTAssertEqual(backend.config, BackendConfig(baseURL: URL(string: "https://api.example.test")!, joinCode: "demo-code"))
    XCTAssertEqual(BackendConfig.load(from: defaults, secrets: secrets), backend.config)
    XCTAssertNil(defaults.string(forKey: BackendConfig.joinCodeKey))
    XCTAssertTrue(model.isConnected)
    XCTAssertFalse(model.canEditBackend)
  }

  func testInvalidURLIsABackendErrorWithoutAConnection() async {
    let model = makeModel()
    model.baseURLText = "not a url"
    model.joinCode = "demo-code"
    await model.connect()
    XCTAssertEqual(model.status, .backendError(code: "invalid_url"))
    XCTAssertTrue(backends.isEmpty)
  }

  func testRejectedConnectShowsTheReason() async {
    configureBackend = { $0.failConnect = true }
    let model = makeModel()
    model.baseURLText = "https://api.example.test"
    model.joinCode = "wrong"
    await model.connect()
    XCTAssertEqual(model.status, .backendError(code: "unauthorized"))
    XCTAssertEqual(model.notice, LiveModel.connectFailureNotice("unauthorized"))
    XCTAssertTrue(model.canEditBackend)
  }

  func testPlainHttpIsRefusedForPublicHosts() async {
    let model = makeModel()
    model.baseURLText = "http://api.example.test"
    model.joinCode = "demo-code"
    await model.connect()
    XCTAssertEqual(model.status, .backendError(code: "insecure_url"))
    XCTAssertNotNil(model.notice)
    XCTAssertTrue(backends.isEmpty, "the join code never goes out over http")

    for host in ["localhost", "127.0.0.1", "10.0.0.5", "192.168.1.20", "172.20.1.1", "davids-mac.local"] {
      XCTAssertTrue(LiveModel.allowsCleartext(host: host), host)
    }
    for host in ["api.example.test", "8.8.8.8", "172.32.0.1", "192.169.0.1", "10.0.0.5.example.com"] {
      XCTAssertFalse(LiveModel.allowsCleartext(host: host), host)
    }
  }

  // MARK: Automatic connect

  func testConnectIfConfiguredConnectsWithASavedJoinCode() async {
    BackendConfig(baseURL: URL(string: "https://api.example.test")!, joinCode: "demo-code").save(to: defaults, secrets: secrets)
    let model = makeModel()
    await model.connectIfConfigured()
    await waitUntil { model.status == .connected }
    XCTAssertEqual(backends.count, 1)
    XCTAssertEqual(backend.config.joinCode, "demo-code")

    // The app coming back to the foreground while connected changes nothing.
    await model.connectIfConfigured()
    XCTAssertEqual(backends.count, 1)
    XCTAssertEqual(backend.connectCount, 1)
  }

  func testConnectIfConfiguredStaysOfflineWithoutAJoinCode() async {
    let model = makeModel()
    await model.connectIfConfigured()
    XCTAssertTrue(backends.isEmpty)
    XCTAssertEqual(model.status, .offline)

    model.joinCode = "   "
    await model.connectIfConfigured()
    XCTAssertTrue(backends.isEmpty)
  }

  func testConnectIfConfiguredDoesNotRetryARejectedJoinCode() async {
    configureBackend = { $0.failConnect = true }
    let model = makeModel()
    model.baseURLText = "https://api.example.test"
    model.joinCode = "wrong"
    await model.connect()
    XCTAssertEqual(model.status, .backendError(code: "unauthorized"))

    await model.connectIfConfigured()
    XCTAssertEqual(backend.connectCount, 1, "only a new join code in Settings can fix this")
  }

  func testConnectIfConfiguredDoesNotRetryABadURL() async {
    let model = makeModel()
    model.baseURLText = "http://api.example.test"
    model.joinCode = "demo-code"
    await model.connect()
    XCTAssertEqual(model.status, .backendError(code: "insecure_url"))

    await model.connectIfConfigured()
    XCTAssertTrue(backends.isEmpty)
  }

  func testConnectIfConfiguredRetriesAfterANetworkError() async {
    configureBackend = { $0.failConnect = true; $0.failReason = "network_lost" }
    let model = makeModel()
    model.baseURLText = "https://api.example.test"
    model.joinCode = "demo-code"
    await model.connect()
    XCTAssertEqual(model.status, .backendError(code: "network_lost"))

    backend.failConnect = false
    await model.connectIfConfigured()
    await waitUntil { model.status == .connected }
    XCTAssertEqual(backend.connectCount, 2)
  }

  func testReconnectClosesAndOpensASession() async {
    let model = await connectedModel()
    await model.reconnect()
    await waitUntil { model.status == .connected }
    XCTAssertEqual(backend.closeCount, 1)
    XCTAssertEqual(backend.connectCount, 2)
  }

  func testForgetJoinCodeDisconnectsAndClearsTheKeychain() async {
    let model = await connectedModel()
    await model.forgetJoinCode()
    XCTAssertEqual(model.status, .offline)
    XCTAssertEqual(model.joinCode, "")
    XCTAssertNil(secrets.read(BackendConfig.joinCodeKey))
    XCTAssertEqual(BackendConfig.load(from: defaults, secrets: secrets).joinCode, "")
  }

  func testUnreadableEventShowsANotice() async {
    let model = await connectedModel()
    backend.onUnreadableEvent?("claim.result")
    XCTAssertEqual(model.notice, "The backend sent an update this app can't read. Check that the app and backend versions match.")
  }

  // MARK: Preferences and session lifetime

  func testPreferencesGoOutOnEachSessionReadyAndWhenToggled() async {
    let model = await connectedModel()
    await waitUntil { self.backend.controlTypes.contains("session.preferences") }
    let first = backend.controls.first { $0["type"] as? String == "session.preferences" }
    XCTAssertEqual(first?["sessionEpoch"] as? Int, 1)
    let preferences = first?["preferences"] as? [String: Any]
    XCTAssertEqual(preferences?["automaticNotifications"] as? Bool, true, "on for the demo")
    XCTAssertEqual(preferences?["muted"] as? Bool, false, "local mute keeps cards, so the server is never muted")
    XCTAssertEqual((preferences?["selectedTopics"] as? [String])?.count, 0)

    model.automaticAlerts = false
    await waitUntil { self.backend.controlTypes.filter { $0 == "session.preferences" }.count == 2 }
    let last = backend.controls.last { $0["type"] as? String == "session.preferences" }
    XCTAssertEqual((last?["preferences"] as? [String: Any])?["automaticNotifications"] as? Bool, false)
    XCTAssertEqual(defaults.object(forKey: LiveModel.automaticAlertsKey) as? Bool, false)
  }

  func testExpiredSessionIsRenewedAndListeningResumes() async {
    let model = await listeningModel()
    backend.endSession(reason: "deleted")

    await waitUntil { self.backend.connectCount == 2 }
    await waitUntil { self.backend.controlTypes.filter { $0 == "audio.start" }.count == 2 }
    let starts = backend.controls.filter { $0["type"] as? String == "audio.start" }
    XCTAssertEqual(starts.last?["sessionEpoch"] as? Int, 1, "the new session's epoch, not the old one's")
    XCTAssertEqual(starts.last?["streamGeneration"] as? Int, 2)
    await waitUntil { self.chime.count == 1 }
    XCTAssertEqual(model.notice, "The session expired, so a new one started. Listening resumed.")
    XCTAssertFalse(speaker.spoken.contains(AudioStreamerStopReason.sessionEnded(reasonCode: "deleted").spokenMessage!))
    await waitUntil { self.backend.controlTypes.filter { $0 == "session.preferences" }.count == 2 }
  }

  func testRenewalIsLimitedToOncePerMinute() async {
    let model = await listeningModel()
    backend.endSession(reason: "deleted")
    await waitUntil { self.backend.controlTypes.filter { $0 == "audio.start" }.count == 2 }
    backend.emit(LiveEvents.audioReady(generation: 2))
    await waitUntil { model.status == .listening }

    now += 10
    backend.endSession(reason: "deleted")
    await waitUntil { model.notice == "The backend ended the session (deleted). Tap Reconnect for a new one." }
    XCTAssertEqual(backend.connectCount, 2)
    XCTAssertEqual(speaker.spoken.last, AudioStreamerStopReason.sessionEnded(reasonCode: "deleted").spokenMessage)
  }

  func testPausedSessionIsResumedWhenNotListening() async {
    configureBackend = { $0.readyActive = false }
    let model = await connectedModel()
    await waitUntil { self.backend.controlTypes.contains("session.resume") }
    await waitUntil { model.sessionActive == true }
  }

  func testDisconnectStopsListeningAndClosesTheSession() async {
    let model = await listeningModel()
    await model.disconnect()
    XCTAssertEqual(model.status, .offline)
    XCTAssertEqual(backend.closeCount, 1)
    XCTAssertTrue(backend.controlTypes.contains("audio.stop"))
  }

  // MARK: Listening

  func testStartListeningStartsTheStreamThenAudio() async {
    let model = await connectedModel()
    XCTAssertEqual(camera.liveQuality, .demo)
    model.demoQuality = false
    XCTAssertEqual(camera.liveQuality, .listening, "a stream Check this starts uses the same quality")
    await model.startListening()
    XCTAssertEqual(camera.startedQualities, [.listening])
    await waitUntil { self.backend.audioControlTypes == ["audio.start"] }
    XCTAssertEqual(model.status, .startingToListen)
    backend.emit(LiveEvents.audioReady(generation: 1))
    await waitUntil { model.status == .listening }
    XCTAssertEqual(defaults.object(forKey: LiveModel.demoQualityKey) as? Bool, false)
  }

  func testStreamFailureLeavesListeningOffWithANotice() async {
    camera.startError = LiveStreamError.streamWithoutAudio
    let model = await connectedModel()
    await model.startListening()
    XCTAssertEqual(model.notice, LiveStreamError.streamWithoutAudio.message)
    XCTAssertFalse(model.isListening)
    XCTAssertEqual(backend.audioControlTypes, [])
  }

  func testNoSpeechRecognitionBlocksListening() async {
    configureBackend = { $0.readyAudio = false }
    let model = await connectedModel()
    await waitUntil { model.speechAvailable == false }
    await model.startListening()
    XCTAssertTrue(camera.startedQualities.isEmpty)
    XCTAssertNotNil(model.notice)
  }

  func testGlassesDisconnectStopsListeningWithASpokenReason() async {
    let model = await listeningModel()
    camera.dropStream(byUser: false)
    XCTAssertEqual(model.status, .listeningStopped(.glassesDisconnected))
    XCTAssertEqual(speaker.spoken.last, AudioStreamerStopReason.glassesDisconnected.spokenMessage)
    await waitUntil { self.backend.controlTypes.contains("audio.stop") }
  }

  func testUserStopIsNotAFailure() async {
    let model = await listeningModel()
    model.stopListening()
    XCTAssertEqual(model.status, .connected)
    XCTAssertTrue(speaker.spoken.isEmpty)
    XCTAssertEqual(keepAwake, [true, false], "the phone stays awake only while listening")
  }

  func testShortDropResumesWithAChime() async {
    let model = await listeningModel()
    backend.setState(.reconnecting(attempt: 1))
    await waitUntil { model.status == .reconnecting(attempt: 1) }
    clock.advance(by: 2)
    backend.sessionEpoch = 2
    backend.setState(.connected)
    backend.emit(LiveEvents.sessionReady(active: false, audio: true, epoch: 2))
    await waitUntil { self.chime.count == 1 }
    await waitUntil { self.backend.controlTypes.filter { $0 == "audio.start" }.count == 2 }
    // AudioStreamer sends the one session.resume; LiveModel must not send a second.
    XCTAssertEqual(backend.controlTypes.filter { $0 == "session.resume" }.count, 1)
    XCTAssertEqual(model.notice, "Reconnected. Listening resumed.")
  }

  func testLongDropStopsListeningWithNoConnection() async {
    let model = await listeningModel()
    backend.setState(.reconnecting(attempt: 1))
    await waitUntil { model.status == .reconnecting(attempt: 1) }
    clock.advance(by: 5)
    await waitUntil { model.listening == .stopped(.noConnection) }
    XCTAssertEqual(speaker.spoken.last, AudioStreamerStopReason.noConnection.spokenMessage)
  }

  // MARK: Results

  func testAutomaticResultIsPresentedAndSentToTheLens() async {
    let model = await connectedModel()
    backend.emit(LiveEvents.result(requestId: "asr-1-1-abc", action: .notify, verdict: .contradicted))
    await waitUntil { model.history.entries.count == 1 }
    let entry = model.history.entries[0]
    XCTAssertFalse(entry.userInitiated)
    XCTAssertEqual(entry.delivery, .chimed)
    XCTAssertEqual(chime.count, 1)
    await waitUntil { self.lens.cards.count == 1 }
    XCTAssertEqual(lens.cards.first??.kind, .contradicted)
  }

  func testSilentResultStaysInHistoryOnly() async {
    let model = await connectedModel()
    backend.emit(LiveEvents.result(requestId: "asr-1-1-def", action: .silent))
    await waitUntil { model.history.entries.count == 1 }
    XCTAssertEqual(model.history.entries[0].delivery, .silent)
    XCTAssertTrue(speaker.spoken.isEmpty)
    XCTAssertEqual(chime.count, 0)
    XCTAssertTrue(lens.cards.isEmpty)
  }

  func testRoutineBackendCodesStayOffTheScreen() async {
    let model = await connectedModel()
    for code in ["automatic_cooldown", "queue_full", "stale_capture", "audio_not_ready"] {
      backend.emit(LiveEvents.error(code))
    }
    try? await Task.sleep(nanoseconds: 100_000_000)
    XCTAssertNil(model.notice)
    backend.emit(LiveEvents.error("internal_error"))
    await waitUntil { model.notice == "Backend error: internal_error" }
  }

  func testCorrectionTakesTheCardOffAndIsSpokenWhileListening() async {
    let model = await listeningModel()
    backend.emit(LiveEvents.result(requestId: "asr-1-1-abc", action: .notify, verdict: .contradicted))
    await waitUntil { model.lens.card?.kind == .contradicted }
    backend.emit(LiveEvents.superseded(requestId: "asr-1-1-abc", revision: 1, action: .respond))
    await waitUntil { model.lens.card == nil }
    XCTAssertEqual(model.history.entries.first?.superseded, true)
    XCTAssertEqual(speaker.spoken.last, ResultWording.correctionLine)
    await waitUntil { self.lens.cards.last == .some(nil) }
  }

  func testMuteKeepsTheCardButNoSound() async {
    let model = await connectedModel()
    model.isMuted = true
    backend.emit(LiveEvents.result(requestId: "asr-1-1-ghi", action: .respond))
    await waitUntil { model.history.entries.count == 1 }
    XCTAssertEqual(model.history.entries[0].delivery, .cardOnly)
    XCTAssertTrue(speaker.spoken.isEmpty)
    XCTAssertEqual(defaults.bool(forKey: LiveModel.mutedKey), true)
  }

  // MARK: Look and check

  func testCheckThisSubmitsOCRTextAndTheAnswerIsUserInitiated() async throws {
    let model = await connectedModel()
    await model.checkThis()
    await waitUntil { self.backend.submitted.count == 1 }
    let envelope = try XCTUnwrap(backend.submitted.first)
    XCTAssertEqual(envelope.mode, .ocr)
    XCTAssertTrue(envelope.userInitiated)
    XCTAssertEqual(envelope.capture.source, .glassesCamera)
    XCTAssertEqual(camera.photoCount, 1)
    await waitUntil { model.checkMessage == "Sent for checking." }

    backend.emit(LiveEvents.result(requestId: envelope.requestId, action: .respond))
    await waitUntil { model.history.entries.count == 1 }
    XCTAssertTrue(model.history.entries[0].userInitiated)
    XCTAssertEqual(model.history.entries[0].delivery, .spoken)
    XCTAssertTrue(model.pendingChecks.isEmpty)
  }

  func testVoiceTriggerTakesAPhotoAndChecks() async {
    let model = await connectedModel()
    backend.emit(LiveEvents.captureRequest())
    await waitUntil { self.backend.submitted.count == 1 }
    XCTAssertEqual(camera.photoCount, 1)
    await waitUntil { model.checkMessage == "Sent for checking." }
  }

  func testManualResultWithoutIdsStillGetsAnAnswer() async throws {
    let model = await connectedModel()
    await model.checkThis()
    await waitUntil { self.backend.submitted.count == 1 }
    let requestId = try XCTUnwrap(backend.submitted.first?.requestId)
    await waitUntil { model.checkMessage == "Sent for checking." }
    backend.emit(LiveEvents.result(requestId: requestId, action: .respond, withIds: false))
    await waitUntil { model.history.entries.first?.outcome == .checkFailed }
    XCTAssertEqual(speaker.spoken.last, ResultWording.line(for: .checkFailed))
    XCTAssertTrue(model.pendingChecks.isEmpty)
  }

  func testASkippedChunkNeverTalksOverAnotherChunksVerdict() async throws {
    let sentence = "Helsinki " + String(repeating: "is a city ", count: 50) + "in Finland."
    recognizer.result = OCRResult(text: "\(sentence) \(sentence)", meanConfidence: 0.9, lineCount: 4, droppedLineCount: 0)
    let model = await connectedModel()
    await model.checkThis()
    await waitUntil { model.checkMessage == "Sent 2 parts for checking." }
    let ids = backend.submitted.map(\.requestId)
    XCTAssertEqual(ids.count, 2)

    backend.emit(LiveEvents.result(requestId: ids[1], action: .respond, verdict: .contradicted))
    backend.emit(LiveEvents.admission(.claimSkipped, requestId: ids[0]))
    await waitUntil { model.pendingChecks.isEmpty }
    try await Task.sleep(nanoseconds: 50_000_000)
    XCTAssertEqual(model.history.entries.map(\.outcome), [.verdict(.contradicted)])
    XCTAssertEqual(speaker.spoken.count, 1)
  }

  func testAPhotoWithNoVerdictAnswersOnce() async throws {
    let sentence = "Helsinki " + String(repeating: "is a city ", count: 50) + "in Finland."
    recognizer.result = OCRResult(text: "\(sentence) \(sentence)", meanConfidence: 0.9, lineCount: 4, droppedLineCount: 0)
    let model = await connectedModel()
    await model.checkThis()
    await waitUntil { model.checkMessage == "Sent 2 parts for checking." }
    let ids = backend.submitted.map(\.requestId)
    backend.emit(LiveEvents.admission(.claimSkipped, requestId: ids[0]))
    backend.emit(LiveEvents.admission(.claimNeedsConfirmation, requestId: ids[1]))
    await waitUntil { model.history.entries.count == 1 }
    try await Task.sleep(nanoseconds: 50_000_000)
    XCTAssertEqual(model.history.entries.map(\.outcome), [.needsConfirmation(heard: false)])
    XCTAssertEqual(speaker.spoken, [ResultWording.line(for: .needsConfirmation(heard: false))])
  }

  func testManualCheckWithoutAnOutcomeReportsCheckFailed() async {
    let model = await connectedModel(checkTimeout: 0.2)
    await model.checkThis()
    await waitUntil { self.backend.submitted.count == 1 }
    await waitUntil { model.history.entries.first?.outcome == .checkFailed }
    XCTAssertTrue(model.history.entries[0].userInitiated)
    XCTAssertEqual(speaker.spoken.last, ResultWording.line(for: .checkFailed))
  }

  func testAnswerBeforeTheTimeoutCancelsIt() async throws {
    let model = await connectedModel(checkTimeout: 0.3)
    await model.checkThis()
    await waitUntil { !model.pendingChecks.isEmpty }
    let requestId = try XCTUnwrap(backend.submitted.first?.requestId)
    backend.emit(LiveEvents.result(requestId: requestId, action: .respond))
    await waitUntil { model.history.entries.count == 1 }
    try await Task.sleep(nanoseconds: 500_000_000)
    XCTAssertEqual(model.history.entries.count, 1)
    XCTAssertNotEqual(model.history.entries[0].outcome, .checkFailed)
  }

  func testUnreadablePhotoGetsAnAnswer() async {
    recognizer.result = .empty
    let model = await connectedModel()
    await model.checkThis()
    await waitUntil { model.checkMessage == LookAndCheckCoordinator.unreadableMessage }
    XCTAssertEqual(model.history.entries.first?.outcome, .needsConfirmation(heard: false))
    XCTAssertTrue(backend.submitted.isEmpty)
  }

  func testCheckThisNeedsAConnection() async {
    let model = makeModel()
    await model.checkThis()
    XCTAssertEqual(model.checkMessage, "Facto is offline. Tap Reconnect.")
    XCTAssertEqual(camera.photoCount, 0)
  }

  func testStartListeningOfflineSaysHowToFixIt() async {
    let model = makeModel()
    await model.startListening()
    XCTAssertEqual(model.notice, "Facto is offline. Tap Reconnect.")
    XCTAssertTrue(camera.startedQualities.isEmpty)
  }
}

// MARK: - Opt-in: real backend

/// Runs LiveModel with the real BackendClient against services/api in fixture mode. The camera
/// and OCR are fakes. Skipped unless the backend is named in the environment, as in
/// BackendClientLiveTests (TEST_RUNNER_BACKEND_LIVE_URL, TEST_RUNNER_BACKEND_LIVE_JOIN_CODE).
@MainActor
final class LiveModelLiveTests: XCTestCase {
  func testCheckThisRoundTripOverTheRealBackend() async throws {
    let environment = ProcessInfo.processInfo.environment
    guard let base = environment["BACKEND_LIVE_URL"], let joinCode = environment["BACKEND_LIVE_JOIN_CODE"]
    else { throw XCTSkip("Set BACKEND_LIVE_URL and BACKEND_LIVE_JOIN_CODE to run against a backend.") }

    let suiteName = "LiveModelLiveTests-\(UUID().uuidString)"
    let defaults = try XCTUnwrap(UserDefaults(suiteName: suiteName))
    defer { defaults.removePersistentDomain(forName: suiteName) }
    let camera = FakeLiveCamera()
    let speaker = RecordingSpeaker()
    let model = LiveModel(
      camera: camera, display: nil, defaults: defaults, secrets: MemorySecretStore(), speaker: speaker, chime: CountingChime(),
      recognizer: FakeTextRecognizer(), configureAudioSession: {}
    )
    model.baseURLText = base
    model.joinCode = joinCode
    await model.connect()
    XCTAssertEqual(model.status, .connected)
    await waitUntil { model.sessionActive == true }

    // Fixture mode checks only fixture sources, so this glasses_camera request comes back as
    // pipeline.error (fixture_input_required) and is answered "The check didn't finish".
    // A live-mode backend answers with a verdict. Either way the user's request gets an answer.
    await model.checkThis()
    await waitUntil(timeout: 10) { !model.history.entries.isEmpty }
    let entry = try XCTUnwrap(model.history.entries.first)
    XCTAssertTrue(entry.userInitiated)
    switch entry.outcome {
    case .verdict, .checkFailed: break
    case .needsConfirmation: XCTFail("Expected a verdict or a failed check")
    }
    XCTAssertEqual(entry.delivery, .spoken)
    XCTAssertEqual(speaker.spoken.count, 1)
    XCTAssertEqual(camera.photoCount, 1)
    XCTAssertTrue(model.pendingChecks.isEmpty)

    // A fixture-mode backend has no speech recognition, so listening must refuse to start.
    if model.speechAvailable == false {
      await model.startListening()
      XCTAssertTrue(camera.startedQualities.isEmpty)
      XCTAssertNotNil(model.notice)
    }

    await model.disconnect()
    XCTAssertEqual(model.status, .offline)
  }
}
