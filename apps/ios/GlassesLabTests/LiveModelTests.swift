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
  var failConnect = false
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

  func connect() async throws {
    setState(.connecting)
    if failConnect {
      setState(.disconnected(reason: "unauthorized"))
      throw ConnectFailure()
    }
    sessionId = "sess-live"
    sessionEpoch = 1
    setState(.connected)
    emit(LiveEvents.sessionReady(active: readyActive, audio: readyAudio, epoch: 1))
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
    if object["type"] as? String == "session.resume", let epoch = sessionEpoch {
      emit(LiveEvents.sessionReady(active: true, audio: readyAudio, epoch: epoch))
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
    _ type: ServerEventType, epoch: Int = 1, requestId: String? = nil, claimId: String? = nil, revision: Int? = nil,
    payload: ServerEventPayload
  ) -> ServerEvent {
    seq += 1
    return ServerEvent(
      eventId: "live-evt-\(seq)", eventSeq: seq, sessionId: "sess-live", sessionEpoch: epoch, requestId: requestId,
      claimId: claimId, revision: revision, type: type, serverAt: "2026-11-14T10:00:00.000Z", payload: payload
    )
  }

  static func sessionReady(active: Bool, audio: Bool?, epoch: Int) -> ServerEvent {
    event(.sessionReady, epoch: epoch, payload: .sessionReady(SessionReadyPayload(active: active, expiresAt: nil, mode: "fixture", audio: audio)))
  }

  static func audioReady(generation: Int, epoch: Int = 1) -> ServerEvent {
    event(.audioReady, epoch: epoch, payload: .audioReady(AudioReadyPayload(
      streamGeneration: generation, encoding: "pcm_s16le", sampleRateHz: 16_000, channels: 1, source: .glassesStreamAudio
    )))
  }

  static func captureRequest() -> ServerEvent {
    event(.captureRequest, payload: .captureRequest)
  }

  static func result(requestId: String, action: PresentationAction, verdict: Verdict = .supported) -> ServerEvent {
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
    return event(.claimResult, requestId: requestId, claimId: "\(requestId)-c1", revision: 1, payload: .claimResult(result))
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
    for failure in states where failure.title.hasPrefix("Stopped") || failure.title.contains("Connection lost") {
      XCTAssertEqual(failure.tone, .bad, failure.title)
    }
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
  }

  override func tearDown() async throws {
    defaults.removePersistentDomain(forName: suiteName)
  }

  private var backend: FakeLiveBackend { backends.last! }

  private func makeModel(checkTimeout: TimeInterval = 15) -> LiveModel {
    LiveModel(
      camera: camera, display: lens, defaults: defaults, speaker: speaker, chime: chime, recognizer: recognizer,
      audioClock: clock, checkTimeout: checkTimeout, configureAudioSession: {},
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

  // MARK: Connection

  func testConnectSavesSettingsAndConnects() async {
    let model = await connectedModel()
    XCTAssertEqual(backend.config, BackendConfig(baseURL: URL(string: "https://api.example.test")!, joinCode: "demo-code"))
    XCTAssertEqual(BackendConfig.load(from: defaults), backend.config)
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
    XCTAssertTrue(model.canEditBackend)
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
    model.demoQuality = false
    await model.startListening()
    XCTAssertEqual(camera.startedQualities, [.listening])
    await waitUntil { self.backend.controlTypes == ["audio.start"] }
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
    XCTAssertEqual(backend.controlTypes, [])
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
    XCTAssertEqual(model.checkMessage, "Connect to the backend first.")
    XCTAssertEqual(camera.photoCount, 0)
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
      camera: camera, display: nil, defaults: defaults, speaker: speaker, chime: CountingChime(),
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
