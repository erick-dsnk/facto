import CoreGraphics
import ImageIO
import UniformTypeIdentifiers
import XCTest
@testable import GlassesLab

// MARK: - Fakes

@MainActor
private final class FakeChannel: SessionChannel {
  var sessionId: String? = "session-1"
  var sessionEpoch: Int? = 3
  var connectionState: ChannelConnectionState = .connected
  private var eventContinuations: [AsyncStream<ServerEvent>.Continuation] = []

  func connectionStates() -> AsyncStream<ChannelConnectionState> {
    AsyncStream { $0.yield(connectionState) }
  }

  func events() -> AsyncStream<ServerEvent> {
    AsyncStream { eventContinuations.append($0) }
  }

  func emit(_ type: ServerEventType, payload: ServerEventPayload) {
    let event = ServerEvent(
      eventId: "evt-\(type.rawValue)", eventSeq: 1, sessionId: "session-1", sessionEpoch: 3,
      type: type, serverAt: "2026-11-14T10:00:00.000Z", payload: payload
    )
    for continuation in eventContinuations { continuation.yield(event) }
  }

  func sendControl<Message: Encodable & Sendable>(_ message: Message) async throws {}
  func sendBinary(_ data: Data) async throws {}
}

private struct FakeError: Error {}

@MainActor
private final class FakePhoto: PhotoCapturing {
  var calls = 0
  var fails = false
  var holdNext = false
  var imageData = Data([0xFF, 0xD8, 0xFF])
  private(set) var gate: CheckedContinuation<Void, Never>?

  func captureStillDuringStream() async throws -> Data {
    calls += 1
    if holdNext {
      holdNext = false
      await withCheckedContinuation { gate = $0 }
    }
    if fails { throw FakeError() }
    return imageData
  }

  func release() {
    gate?.resume()
    gate = nil
  }
}

private final class FakeRecognizer: TextRecognizing, @unchecked Sendable {
  var result: OCRResult
  var fails = false
  private(set) var receivedImageData: Data?
  init(_ result: OCRResult) { self.result = result }

  func recognizeText(in imageData: Data) async throws -> OCRResult {
    receivedImageData = imageData
    if fails { throw FakeError() }
    return result
  }
}

@MainActor
private final class FakeTargetSelector: OCRTargetSelecting {
  var result = OCRTargetSelection(status: .selected, selectedLineIds: ["first"])
  var onStarted: (() -> Void)?
  var fails = false
  var holdNext = false
  private(set) var gate: CheckedContinuation<Void, Never>?
  private(set) var inputs: [OCRTargetInput] = []
  private(set) var images: [Data] = []
  private(set) var intents: [String?] = []

  func selectTarget(in input: OCRTargetInput, imageData: Data, intent: String?) async throws -> OCRTargetSelection {
    inputs.append(input)
    images.append(imageData)
    intents.append(intent)
    onStarted?()
    if holdNext {
      holdNext = false
      await withCheckedContinuation { gate = $0 }
    }
    if fails { throw FakeError() }
    return result
  }

  func release() {
    gate?.resume()
    gate = nil
  }
}

private final class FakeSubmitter: CheckSubmitter, @unchecked Sendable {
  private let lock = NSLock()
  private var _envelopes: [TextInputEnvelope] = []
  /// Submissions with this 1-based index throw.
  var failOnSubmission: Int?

  var envelopes: [TextInputEnvelope] { lock.withLock { _envelopes } }

  func submit(_ input: TextInputEnvelope) async throws {
    try lock.withLock {
      if failOnSubmission == _envelopes.count + 1 { throw FakeError() }
      _envelopes.append(input)
    }
  }
}

/// Rejects the first submit as stale after raising the channel's epoch, like a reconnect
/// that lands while the request is in flight.
@MainActor
private final class StaleOnceSubmitter: CheckSubmitter {
  let channel: FakeChannel
  private(set) var attempts: [TextInputEnvelope] = []
  init(channel: FakeChannel) { self.channel = channel }

  func submit(_ input: TextInputEnvelope) async throws {
    attempts.append(input)
    if attempts.count == 1 {
      channel.sessionEpoch = 4
      throw BackendClientError.staleEpoch(current: 4, envelope: input.sessionEpoch)
    }
  }
}

// MARK: - Tests

@MainActor
final class LookAndCheckCoordinatorTests: XCTestCase {
  private let fixedDate = Date(timeIntervalSince1970: 1_794_650_400) // 2026-11-14
  private let readable = OCRResult(text: "The Eiffel Tower opened in 1889.", meanConfidence: 0.92, lineCount: 1, droppedLineCount: 0)

  private var channel: FakeChannel!
  private var photo: FakePhoto!
  private var recognizer: FakeRecognizer!
  private var submitter: FakeSubmitter!

  override func setUp() async throws {
    channel = FakeChannel()
    photo = FakePhoto()
    recognizer = FakeRecognizer(readable)
    submitter = FakeSubmitter()
  }

  private func makeCoordinator(targetSelector: OCRTargetSelecting? = nil) -> LookAndCheckCoordinator {
    LookAndCheckCoordinator(
      channel: channel, photo: photo, recognizer: recognizer, submitter: submitter,
      targetSelector: targetSelector, now: { [fixedDate] in fixedDate }
    )
  }

  /// A decodable capture is essential here: these tests exercise the real upload-image
  /// preparation branch rather than returning early on the legacy fake JPEG marker.
  private func prepareRemoteCapture() throws {
    let context = try XCTUnwrap(CGContext(data: nil, width: 80, height: 40, bitsPerComponent: 8,
      bytesPerRow: 0, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue))
    context.setFillColor(CGColor(gray: 1, alpha: 1))
    context.fill(CGRect(x: 0, y: 0, width: 80, height: 40))
    let data = NSMutableData()
    let destination = try XCTUnwrap(CGImageDestinationCreateWithData(data, UTType.jpeg.identifier as CFString, 1, nil))
    CGImageDestinationAddImage(destination, try XCTUnwrap(context.makeImage()), nil)
    XCTAssertTrue(CGImageDestinationFinalize(destination))
    photo.imageData = data as Data
    var result = readable
    result.observations = [
      .init(text: "The Eiffel Tower opened in 1889.", confidence: 0.95,
        boundingBox: CGRect(x: 0.1, y: 0.7, width: 0.6, height: 0.04), id: "first"),
      .init(text: "City bus drivers receive additional training", confidence: 0.95,
        boundingBox: CGRect(x: 0.1, y: 0.3, width: 0.6, height: 0.04), id: "second"),
    ]
    recognizer.result = result
  }

  func testRemoteSelectorReceivesOriginalEvidenceAndPreparedImageThenSubmitsOnlyResolvedText() async throws {
    try prepareRemoteCapture()
    let selector = FakeTargetSelector()
    let outcome = await makeCoordinator(targetSelector: selector).performCheck(source: .button, intent: "the Eiffel Tower")
    XCTAssertEqual(outcome?.submittedCount, 1)
    XCTAssertEqual(selector.inputs, [recognizer.result.targetInput])
    XCTAssertEqual(selector.intents, ["the Eiffel Tower"])
    XCTAssertEqual(recognizer.receivedImageData, photo.imageData, "recognition retains the original capture")
    let uploaded = try XCTUnwrap(selector.images.first)
    XCTAssertNotNil(CGImageSourceCreateWithData(uploaded as CFData, nil))
    XCTAssertLessThanOrEqual(uploaded.count, OCRTargetRequestLimits.maximumImageBytes)
    XCTAssertEqual(submitter.envelopes.first?.text, "The Eiffel Tower opened in 1889.")
  }

  func testRemoteUnknownSourceIDNeverSubmits() async throws {
    try prepareRemoteCapture()
    let selector = FakeTargetSelector()
    selector.result = .init(status: .selected, selectedLineIds: ["invented"])
    let outcome = await makeCoordinator(targetSelector: selector).performCheck(source: .button)
    XCTAssertEqual(outcome, .failed(reason: "invalid_target_selection"))
    XCTAssertTrue(submitter.envelopes.isEmpty)
  }

  func testRemoteUnavailableNeverFallsBackToWholePage() async throws {
    try prepareRemoteCapture()
    let selector = FakeTargetSelector()
    selector.result = .init(status: .unavailable, reason: "provider_unavailable")
    let outcome = await makeCoordinator(targetSelector: selector).performCheck(source: .button)
    XCTAssertEqual(outcome, .failed(reason: "target_selection_unavailable"))
    XCTAssertTrue(submitter.envelopes.isEmpty)
  }

  func testRemoteProviderErrorNeverSubmits() async throws {
    try prepareRemoteCapture()
    let selector = FakeTargetSelector()
    selector.fails = true
    let outcome = await makeCoordinator(targetSelector: selector).performCheck(source: .button)
    XCTAssertEqual(outcome, .failed(reason: "target_selection_failed"))
    XCTAssertTrue(submitter.envelopes.isEmpty)
  }

  func testStopWhileRemoteSelectorIsPendingSuppressesOldResponse() async throws {
    try prepareRemoteCapture()
    let selector = FakeTargetSelector()
    selector.holdNext = true
    let started = expectation(description: "remote selector started")
    selector.onStarted = { started.fulfill() }
    let coordinator = makeCoordinator(targetSelector: selector)
    var outcomeCount = 0
    coordinator.onOutcome = { _ in outcomeCount += 1 }
    let check = Task { await coordinator.performCheck(source: .button) }
    await fulfillment(of: [started], timeout: 2)
    XCTAssertNotNil(selector.gate)
    coordinator.stop()
    channel.sessionId = "new-session"
    selector.release()
    let outcome = await check.value
    XCTAssertEqual(outcome, .failed(reason: "cancelled"))
    XCTAssertEqual(outcomeCount, 0)
    XCTAssertNil(coordinator.lastOutcome)
    XCTAssertTrue(submitter.envelopes.isEmpty)
    XCTAssertTrue(coordinator.targetChoices.isEmpty)
  }

  func testRemoteCandidateChoiceReusesCaptureAndDoesNotUploadAgain() async throws {
    try prepareRemoteCapture()
    let selector = FakeTargetSelector()
    selector.result = .init(status: .needsTarget, candidates: [
      .init(id: "tower", role: "headline", lineIds: ["first"]),
      .init(id: "bus", role: "headline", lineIds: ["second"]),
      .init(id: "invalid", role: "headline", lineIds: ["unknown"]),
    ])
    let coordinator = makeCoordinator(targetSelector: selector)
    let initial = await coordinator.performCheck(source: .button)
    guard case .needsTarget? = initial else { return XCTFail("Expected clarification") }
    XCTAssertEqual(coordinator.targetChoices.map(\.id), ["tower", "bus"])
    let choice = await coordinator.chooseTarget("bus")
    XCTAssertEqual(choice?.submittedCount, 1)
    XCTAssertEqual(submitter.envelopes.first?.text, "City bus drivers receive additional training")
    XCTAssertEqual(photo.calls, 1)
    XCTAssertEqual(selector.images.count, 1)
    XCTAssertTrue(coordinator.targetChoices.isEmpty)
  }

  func testRemoteOverLimitEvidenceFailsBeforeUploadWithoutDroppingLines() async throws {
    try prepareRemoteCapture()
    let original = try XCTUnwrap(recognizer.result.observations.first)
    recognizer.result.observations = (0..<301).map { index in
      var line = original
      line.id = "line-\(index)"
      return line
    }
    let selector = FakeTargetSelector()
    let outcome = await makeCoordinator(targetSelector: selector).performCheck(source: .button)
    XCTAssertEqual(outcome, .failed(reason: "target_selection_input_too_large"))
    XCTAssertTrue(selector.inputs.isEmpty)
    XCTAssertEqual(recognizer.result.observations.count, 301)
    XCTAssertTrue(submitter.envelopes.isEmpty)
  }

  func testRemoteOverLimitHintFailsBeforeUpload() async throws {
    try prepareRemoteCapture()
    let selector = FakeTargetSelector()
    let outcome = await makeCoordinator(targetSelector: selector).performCheck(source: .button, intent: String(repeating: "x", count: 501))
    XCTAssertEqual(outcome, .failed(reason: "target_selection_hint_too_long"))
    XCTAssertTrue(selector.inputs.isEmpty)
    XCTAssertTrue(submitter.envelopes.isEmpty)
  }

  func testStopBeforeQueuedTriggerCannotStartCapture() async {
    let coordinator = makeCoordinator()
    XCTAssertTrue(coordinator.trigger(.button))
    coordinator.stop()
    for _ in 0..<30 { await Task.yield() }
    XCTAssertEqual(photo.calls, 0)
    XCTAssertTrue(submitter.envelopes.isEmpty)
  }

  func testStopDuringPhotoSuppressesSubmissionAndOutcomeAfterSessionChanges() async {
    let coordinator = makeCoordinator()
    photo.holdNext = true
    var outcomes = 0
    var cleanup = 0
    coordinator.onOutcome = { _ in outcomes += 1 }
    coordinator.onCancelledCapture = { cleanup += 1 }
    let check = Task { await coordinator.performCheck(source: .button) }
    for _ in 0..<100 where photo.gate == nil { await Task.yield() }
    XCTAssertNotNil(photo.gate)
    coordinator.stop()
    channel.sessionId = "replacement-session"
    channel.sessionEpoch = 1
    photo.release()
    _ = await check.value
    XCTAssertTrue(submitter.envelopes.isEmpty)
    XCTAssertEqual(outcomes, 0)
    XCTAssertEqual(cleanup, 1)
  }

  func testRejectedCaptureHasNoAcknowledgementOrSensorStart() async {
    let coordinator = makeCoordinator()
    coordinator.canCapture = { false }
    var acknowledgements = 0
    coordinator.onAccepted = { acknowledgements += 1 }
    XCTAssertFalse(coordinator.trigger(.voice))
    let outcome = await coordinator.performCheck(source: .button)
    XCTAssertNil(outcome)
    XCTAssertEqual(acknowledgements, 0)
    XCTAssertEqual(photo.calls, 0)
  }

  func testButtonCheckSubmitsAnOCREnvelope() async throws {
    let outcome = await makeCoordinator().performCheck(source: .button)

    XCTAssertEqual(photo.calls, 1)
    let envelope = try XCTUnwrap(submitter.envelopes.first)
    XCTAssertEqual(submitter.envelopes.count, 1)
    XCTAssertEqual(outcome, .submitted(requestIds: [envelope.requestId], droppedCodePoints: 0))
    XCTAssertEqual(outcome?.submittedCount, 1)

    XCTAssertEqual(envelope.schemaVersion, 1)
    XCTAssertEqual(envelope.mode, .ocr)
    XCTAssertEqual(envelope.text, readable.text)
    XCTAssertEqual(envelope.sessionId, "session-1")
    XCTAssertEqual(envelope.sessionEpoch, 3)
    XCTAssertEqual(envelope.revision, 1)
    XCTAssertEqual(envelope.language, "en")
    XCTAssertTrue(envelope.userInitiated)
    XCTAssertEqual(envelope.context, [])
    XCTAssertEqual(envelope.capture.source, .glassesCamera)
    XCTAssertEqual(envelope.capture.confidence, 0.92)
    XCTAssertEqual(envelope.capture.final, true)
    XCTAssertEqual(envelope.capturedAt, ContractDates.string(from: fixedDate))
    XCTAssertTrue(envelope.requestId.hasPrefix("ocr-"))
    XCTAssertTrue(WireID.isValid(envelope.requestId))
    XCTAssertTrue(WireID.isValid(envelope.capture.segmentId))
    XCTAssertNoThrow(try envelope.validate())

    // The wire form uses the contract's raw values.
    let json = try XCTUnwrap(JSONSerialization.jsonObject(with: JSONEncoder().encode(envelope)) as? NSDictionary)
    XCTAssertEqual(json["mode"] as? String, "ocr")
    XCTAssertEqual((json["capture"] as? NSDictionary)?["source"] as? String, "glasses_camera")
    XCTAssertEqual(json["userInitiated"] as? Bool, true)
  }

  func testLongTextSendsUpToThreeChunksWithFreshRequestIds() async throws {
    let sentence = "The " + String(repeating: "word ", count: 98) + "end."
    recognizer.result = OCRResult(
      text: Array(repeating: sentence, count: 5).joined(separator: " "),
      meanConfidence: 0.8, lineCount: 10, droppedLineCount: 0
    )
    let outcome = await makeCoordinator().performCheck(source: .button)

    let envelopes = submitter.envelopes
    XCTAssertEqual(envelopes.count, 3)
    XCTAssertEqual(Set(envelopes.map(\.requestId)).count, 3, "each chunk needs its own requestId")
    XCTAssertEqual(Set(envelopes.map(\.capture.segmentId)).count, 3)
    XCTAssertTrue(envelopes.allSatisfy { $0.revision == 1 && $0.mode == .ocr && $0.userInitiated })
    XCTAssertTrue(envelopes.allSatisfy { CodePoints.count($0.text) <= 800 })
    guard case .submitted(let ids, let dropped) = outcome else { return XCTFail("expected submitted, got \(String(describing: outcome))") }
    XCTAssertEqual(ids, envelopes.map(\.requestId))
    XCTAssertGreaterThan(dropped, 0, "text past three chunks is recorded")
    let keys = Set(envelopes.map { LookAndCheckCoordinator.photoKey(forRequestId: $0.requestId) })
    XCTAssertEqual(keys.count, 1, "chunks of one photo share a key")
    XCTAssertNotNil(keys.first ?? nil)
  }

  func testPhotoKeyGroupsChunksOnly() {
    let base = WireID.makeRequestId(prefix: "ocr")
    XCTAssertEqual(LookAndCheckCoordinator.photoKey(forRequestId: "\(base)-1"), base)
    XCTAssertEqual(LookAndCheckCoordinator.photoKey(forRequestId: "\(base)-3"), base)
    XCTAssertNil(LookAndCheckCoordinator.photoKey(forRequestId: base), "a UUID group is not a chunk number")
    XCTAssertNil(LookAndCheckCoordinator.photoKey(forRequestId: "asr-1-2-3"))
  }

  func testSessionAndEpochAreReadAfterThePhoto() async throws {
    let coordinator = makeCoordinator()
    let done = expectation(description: "outcome")
    coordinator.onOutcome = { _ in done.fulfill() }
    photo.holdNext = true
    coordinator.trigger(.button)
    while photo.gate == nil { await Task.yield() }
    // A reconnect while the photo is on its way raises the epoch.
    channel.sessionEpoch = 5
    photo.release()
    await fulfillment(of: [done], timeout: 2)
    XCTAssertEqual(submitter.envelopes.first?.sessionEpoch, 5)
  }

  func testStaleEpochIsRetriedOnceWithTheNewEpoch() async throws {
    let stale = StaleOnceSubmitter(channel: channel)
    let coordinator = LookAndCheckCoordinator(
      channel: channel, photo: photo, recognizer: recognizer, submitter: stale, now: { [fixedDate] in fixedDate }
    )
    let outcome = await coordinator.performCheck(source: .button)
    XCTAssertEqual(stale.attempts.map(\.sessionEpoch), [3, 4])
    XCTAssertEqual(Set(stale.attempts.map(\.requestId)).count, 1, "the retry keeps the request id")
    XCTAssertEqual(outcome?.submittedCount, 1)
    XCTAssertTrue(LookAndCheckCoordinator.isStaleSession(BackendClientError.http(status: 409, code: "old_epoch")))
    XCTAssertFalse(LookAndCheckCoordinator.isStaleSession(BackendClientError.http(status: 429, code: "queue_full")))
  }

  func testPausedSessionFailsBeforeSubmitting() async {
    let coordinator = makeCoordinator()
    var asked = 0
    coordinator.prepareSubmit = {
      asked += 1
      return false
    }
    let outcome = await coordinator.performCheck(source: .voice)
    XCTAssertEqual(outcome, .failed(reason: "session_paused"))
    XCTAssertEqual(asked, 1)
    XCTAssertTrue(submitter.envelopes.isEmpty)
  }

  func testCaptureRequestEventTriggersACheck() async throws {
    let coordinator = makeCoordinator()
    let done = expectation(description: "outcome")
    coordinator.onOutcome = { _ in done.fulfill() }
    coordinator.start()
    await Task.yield()

    channel.emit(.claimChecking, payload: .claimChecking(AdmissionPayload(admissionAction: .check, reasonCode: "ok", presentation: nil)))
    channel.emit(.captureRequest, payload: .captureRequest)
    await fulfillment(of: [done], timeout: 2)

    XCTAssertEqual(photo.calls, 1, "only capture.request triggers a photo")
    XCTAssertEqual(submitter.envelopes.count, 1)
    coordinator.stop()
  }

  func testSecondTriggerWhileRunningIsIgnored() async throws {
    let coordinator = makeCoordinator()
    let done = expectation(description: "outcome")
    coordinator.onOutcome = { _ in done.fulfill() }
    photo.holdNext = true

    XCTAssertTrue(coordinator.trigger(.button))
    XCTAssertTrue(coordinator.isRunning)
    XCTAssertFalse(coordinator.trigger(.voice))
    let ignored = await coordinator.performCheck(source: .button)
    XCTAssertNil(ignored)

    while photo.gate == nil { await Task.yield() }
    XCTAssertFalse(coordinator.trigger(.button))
    photo.release()
    await fulfillment(of: [done], timeout: 2)

    XCTAssertEqual(photo.calls, 1)
    XCTAssertEqual(submitter.envelopes.count, 1)
    XCTAssertFalse(coordinator.isRunning)
    XCTAssertEqual(coordinator.lastOutcome?.submittedCount, 1)

    // Once idle, a new trigger runs again. Drop the callback so `done` is fulfilled once.
    coordinator.onOutcome = nil
    let again = await coordinator.performCheck(source: .button)
    XCTAssertEqual(again?.submittedCount, 1)
    XCTAssertEqual(photo.calls, 2)
  }

  func testNoTextIsUnreadable() async {
    recognizer.result = .empty
    let outcome = await makeCoordinator().performCheck(source: .button)
    XCTAssertEqual(outcome, .unreadable(message: "Move closer and try again"))
    XCTAssertTrue(submitter.envelopes.isEmpty)
  }

  func testLowConfidenceIsUnreadable() async {
    recognizer.result = OCRResult(text: "Th3 E1ffel T0wer", meanConfidence: 0.42, lineCount: 1, droppedLineCount: 4)
    let outcome = await makeCoordinator().performCheck(source: .button)
    XCTAssertEqual(outcome, .unreadable(message: LookAndCheckCoordinator.unreadableMessage))
    XCTAssertTrue(submitter.envelopes.isEmpty)
  }

  func testTooFewCharactersIsUnreadable() async {
    recognizer.result = OCRResult(text: " a \n", meanConfidence: 1, lineCount: 1, droppedLineCount: 0)
    let outcome = await makeCoordinator().performCheck(source: .button)
    XCTAssertEqual(outcome, .unreadable(message: LookAndCheckCoordinator.unreadableMessage))
  }

  func testCompetingContentNeverReachesFactChecker() async {
    var result = readable
    result.observations = [
      .init(text: "US aviation shutdown blamed on router", confidence: 0.95,
            boundingBox: CGRect(x: 0, y: 0.7, width: 0.6, height: 0.04), id: "first"),
      .init(text: "City bus drivers receive additional training", confidence: 0.95,
            boundingBox: CGRect(x: 0, y: 0.4, width: 0.6, height: 0.04), id: "second"),
    ]
    recognizer.result = result
    let outcome = await makeCoordinator().performCheck(source: .button)
    guard case .needsTarget? = outcome else { return XCTFail("Expected a target clarification") }
    XCTAssertTrue(submitter.envelopes.isEmpty)
  }

  func testExplicitCandidateChoiceUsesSameCaptureAndNoUnrelatedText() async throws {
    var result = readable
    result.observations = [
      .init(text: "US aviation shutdown blamed on router", confidence: 0.95,
            boundingBox: CGRect(x: 0, y: 0.7, width: 0.6, height: 0.04), id: "first"),
      .init(text: "City bus drivers receive additional training", confidence: 0.95,
            boundingBox: CGRect(x: 0, y: 0.4, width: 0.6, height: 0.04), id: "second"),
    ]
    recognizer.result = result
    let coordinator = makeCoordinator()
    _ = await coordinator.performCheck(source: .button)
    let choice = try XCTUnwrap(coordinator.targetChoices.first { $0.text.contains("aviation") })
    let outcome = await coordinator.chooseTarget(choice.id)
    XCTAssertEqual(outcome?.submittedCount, 1)
    XCTAssertEqual(photo.calls, 1)
    XCTAssertEqual(submitter.envelopes.first?.text, "US aviation shutdown blamed on router")
    XCTAssertTrue(coordinator.targetChoices.isEmpty)
    let repeated = await coordinator.chooseTarget(choice.id)
    XCTAssertNil(repeated)
  }

  func testStopDiscardsPendingTargetChoices() async {
    var result = readable
    result.observations = [
      .init(text: "US aviation shutdown blamed on router", confidence: 0.95,
            boundingBox: CGRect(x: 0, y: 0.7, width: 0.6, height: 0.04), id: "first"),
      .init(text: "City bus drivers receive additional training", confidence: 0.95,
            boundingBox: CGRect(x: 0, y: 0.4, width: 0.6, height: 0.04), id: "second"),
    ]
    recognizer.result = result
    let coordinator = makeCoordinator()
    _ = await coordinator.performCheck(source: .button)
    XCTAssertEqual(coordinator.targetChoices.count, 2)
    coordinator.stop()
    XCTAssertTrue(coordinator.targetChoices.isEmpty)
    let afterStop = await coordinator.chooseTarget("block-0")
    XCTAssertNil(afterStop)
    XCTAssertTrue(submitter.envelopes.isEmpty)
  }

  func testOnlyResolvedTargetIsSubmitted() async {
    var result = readable
    result.observations = [
      .init(text: "US aviation shutdown blamed on router", confidence: 0.95,
            boundingBox: CGRect(x: 0, y: 0.7, width: 0.6, height: 0.04), id: "first"),
      .init(text: "City bus drivers receive additional training", confidence: 0.95,
            boundingBox: CGRect(x: 0, y: 0.4, width: 0.6, height: 0.04), id: "second"),
    ]
    recognizer.result = result
    let outcome = await makeCoordinator().performCheck(source: .button, intent: "Check the aviation shutdown story")
    XCTAssertEqual(outcome?.submittedCount, 1)
    XCTAssertEqual(submitter.envelopes.first?.text, "US aviation shutdown blamed on router")
  }

  func testIncompleteTargetNeverReachesFactChecker() async {
    var result = readable
    result.observations = [.init(text: "President is officially Dea... View more", confidence: 0.95,
      boundingBox: CGRect(x: 0.1, y: 0.7, width: 0.6, height: 0.04), id: "post")]
    recognizer.result = result
    let outcome = await makeCoordinator().performCheck(source: .button)
    guard case .incomplete? = outcome else { return XCTFail("Expected incomplete target") }
    XCTAssertTrue(submitter.envelopes.isEmpty)
  }

  func testPhotoFailure() async {
    photo.fails = true
    let outcome = await makeCoordinator().performCheck(source: .button)
    XCTAssertEqual(outcome, .failed(reason: "photo_failed"))
    XCTAssertTrue(submitter.envelopes.isEmpty)
  }

  func testOCRFailure() async {
    recognizer.fails = true
    let outcome = await makeCoordinator().performCheck(source: .button)
    XCTAssertEqual(outcome, .failed(reason: "ocr_failed"))
  }

  func testNoSessionFailsBeforeTakingAPhoto() async {
    channel.sessionId = nil
    let outcome = await makeCoordinator().performCheck(source: .button)
    XCTAssertEqual(outcome, .failed(reason: "no_session"))
    XCTAssertEqual(photo.calls, 0)
  }

  func testSubmitFailureOnFirstChunkFails() async {
    submitter.failOnSubmission = 1
    let outcome = await makeCoordinator().performCheck(source: .button)
    XCTAssertEqual(outcome, .failed(reason: "submit_failed"))
  }

  func testSubmitFailureAfterFirstChunkReportsWhatWasSent() async throws {
    let sentence = "The " + String(repeating: "word ", count: 98) + "end."
    recognizer.result = OCRResult(text: [sentence, sentence].joined(separator: " "), meanConfidence: 0.9, lineCount: 4, droppedLineCount: 0)
    submitter.failOnSubmission = 2
    let outcome = await makeCoordinator().performCheck(source: .button)
    let sent = try XCTUnwrap(submitter.envelopes.first)
    XCTAssertEqual(outcome, .submitted(requestIds: [sent.requestId], droppedCodePoints: CodePoints.count(sentence)))
  }
}
