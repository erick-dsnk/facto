import CoreGraphics
import ImageIO
import UniformTypeIdentifiers
import XCTest
@testable import GlassesLab

/// A clock the test moves by hand.
private final class TestClock: @unchecked Sendable {
  private let lock = NSLock()
  private var current: Date

  init(_ date: Date) { current = date }

  var now: Date { lock.withLock { current } }
  func set(_ date: Date) { lock.withLock { current = date } }
}

/// A temporary log directory and UserDefaults suite per test.
private struct Sandbox {
  let directory = FileManager.default.temporaryDirectory.appendingPathComponent("DebugLogTests-\(UUID().uuidString)", isDirectory: true)
  let suiteName = "DebugLogTests-\(UUID().uuidString)"
  var defaults: UserDefaults { UserDefaults(suiteName: suiteName)! }

  /// `enabled: true` stores the wearer's opt-in first; `nil` is a fresh install.
  func makeLog(clock: TestClock? = nil, suspended: Bool = false, enabled: Bool? = true) -> DebugLog {
    if let enabled { defaults.set(enabled, forKey: DebugLog.enabledKey) }
    let now: @Sendable () -> Date
    if let clock {
      now = { clock.now }
    } else {
      now = { Date() }
    }
    return DebugLog(directory: directory, defaults: defaults, timeZone: TimeZone(identifier: "UTC")!, now: now, suspended: suspended)
  }

  func fileNames() throws -> [String] {
    try FileManager.default.contentsOfDirectory(atPath: directory.path).sorted()
  }

  /// Every entry of every day file, oldest file first.
  func entries(in file: String? = nil) throws -> [[String: Any]] {
    let files = try file.map { [$0] } ?? fileNames().filter { $0.hasSuffix(".jsonl") }
    return try files.flatMap { name -> [[String: Any]] in
      let text = try String(contentsOf: directory.appendingPathComponent(name), encoding: .utf8)
      return try text.split(separator: "\n").map { line in
        try XCTUnwrap(JSONSerialization.jsonObject(with: Data(line.utf8)) as? [String: Any])
      }
    }
  }

  func allText() throws -> String {
    try fileNames().filter { $0.hasSuffix(".jsonl") }
      .map { try String(contentsOf: directory.appendingPathComponent($0), encoding: .utf8) }
      .joined()
  }

  func tearDown() {
    try? FileManager.default.removeItem(at: directory)
    UserDefaults().removePersistentDomain(forName: suiteName)
  }
}

private func date(_ iso: String) -> Date {
  let formatter = ISO8601DateFormatter()
  formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
  return formatter.date(from: iso)!
}

private func payload(_ entry: [String: Any]) -> [String: Any] {
  entry["payload"] as? [String: Any] ?? [:]
}

/// A real JPEG, so the log can read its pixel size.
private func makeJPEG(width: Int, height: Int) throws -> Data {
  let context = try XCTUnwrap(CGContext(
    data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0,
    space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
  ))
  context.setFillColor(CGColor(red: 1, green: 0.5, blue: 0, alpha: 1))
  context.fill(CGRect(x: 0, y: 0, width: width, height: height))
  let image = try XCTUnwrap(context.makeImage())
  let data = NSMutableData()
  let destination = try XCTUnwrap(CGImageDestinationCreateWithData(data, UTType.jpeg.identifier as CFString, 1, nil))
  CGImageDestinationAddImage(destination, image, nil)
  XCTAssertTrue(CGImageDestinationFinalize(destination))
  return data as Data
}

final class DebugLogTests: XCTestCase {
  private var sandbox: Sandbox!

  override func setUp() {
    sandbox = Sandbox()
  }

  override func tearDown() {
    sandbox.tearDown()
  }

  // MARK: Appending

  func testAppendsOneJSONLinePerEntryWithMillisecondTimestampKindAndPayload() throws {
    let clock = TestClock(date("2026-11-14T10:00:00.123Z"))
    let log = sandbox.makeLog(clock: clock)
    log.log("transcript", ["text": "The Eiffel Tower opened in 1889.", "confidence": 0.71, "final": true, "segment": nil as String? as Any])
    clock.set(date("2026-11-14T10:00:01.500Z"))
    log.log("present", ["action": "silent", "revision": 1, "nested": ["ids": ["a", "b"]]])
    log.waitUntilWritten()

    XCTAssertEqual(try sandbox.fileNames(), ["2026-11-14.jsonl"])
    let text = try String(contentsOf: sandbox.directory.appendingPathComponent("2026-11-14.jsonl"), encoding: .utf8)
    let lines = text.split(separator: "\n")
    XCTAssertEqual(lines.count, 2)
    XCTAssertTrue(text.hasSuffix("\n"))
    XCTAssertTrue(lines[0].hasPrefix(#"{"ts":"2026-11-14T10:00:00.123Z","kind":"transcript","payload":{"#))

    let entries = try sandbox.entries()
    XCTAssertEqual(entries.map { $0["ts"] as? String }, ["2026-11-14T10:00:00.123Z", "2026-11-14T10:00:01.500Z"])
    XCTAssertEqual(entries.map { $0["kind"] as? String }, ["transcript", "present"])
    let first = payload(entries[0])
    XCTAssertEqual(first["text"] as? String, "The Eiffel Tower opened in 1889.")
    XCTAssertEqual(first["confidence"] as? Double, 0.71)
    XCTAssertEqual(first["final"] as? Bool, true)
    XCTAssertTrue(first["segment"] is NSNull)
    let second = payload(entries[1])
    XCTAssertEqual(second["revision"] as? Int, 1)
    XCTAssertEqual((second["nested"] as? [String: Any])?["ids"] as? [String], ["a", "b"])

    XCTAssertEqual(log.stats.entries, 2)
    XCTAssertEqual(log.stats.photos, 0)
    XCTAssertEqual(log.stats.bytes, Int64(text.utf8.count))
  }

  func testRawTextIsKeptExactlyEvenWhenMalformed() throws {
    let log = sandbox.makeLog(clock: TestClock(date("2026-11-14T10:00:00.000Z")))
    let event = #"{"type":"claim.needs_confirmation","requestId":"asr-1","payload":{"reasonCode":"capture_uncertain"}}"#
    log.logJSONText("ws.recv", event, ["conn": 1])
    log.logJSONText("ws.recv", "{not json", ["conn": 1])
    log.waitUntilWritten()

    let entries = try sandbox.entries()
    XCTAssertEqual(entries.count, 2)
    let good = payload(entries[0])
    XCTAssertEqual(good["raw"] as? String, event)
    XCTAssertEqual(good["type"] as? String, "claim.needs_confirmation")
    XCTAssertEqual(good["bytes"] as? Int, event.utf8.count)
    XCTAssertEqual(good["conn"] as? Int, 1)
    XCTAssertNil(good["malformed"])
    let bad = payload(entries[1])
    XCTAssertEqual(bad["raw"] as? String, "{not json")
    XCTAssertEqual(bad["malformed"] as? Bool, true)
  }

  func testStatsCountWhatIsAlreadyOnDisk() throws {
    let clock = TestClock(date("2026-11-14T10:00:00.000Z"))
    let first = sandbox.makeLog(clock: clock)
    first.log("a")
    first.log("b")
    first.logPhoto(try makeJPEG(width: 2, height: 2), id: "p")
    first.waitUntilWritten()

    let relaunched = sandbox.makeLog(clock: clock)
    relaunched.waitUntilWritten()
    XCTAssertEqual(relaunched.stats, first.stats)
    XCTAssertEqual(relaunched.stats.entries, 3)
    XCTAssertEqual(relaunched.stats.photos, 1)
  }

  // MARK: Toggle

  func testOffByDefaultWritesNothingAndSavesNoPhoto() throws {
    let log = sandbox.makeLog(enabled: nil)
    XCTAssertFalse(log.isEnabled)
    XCTAssertNil(sandbox.defaults.object(forKey: DebugLog.enabledKey))
    log.log("ignored")
    XCTAssertNil(log.logPhoto(try makeJPEG(width: 2, height: 2), id: "ignored"))
    log.logJSONText("ws.recv", "{}")
    log.waitUntilWritten()
    XCTAssertFalse(FileManager.default.fileExists(atPath: sandbox.directory.path))
  }

  func testTurningItOnStartsLoggingAndOffStopsItAndIsRemembered() throws {
    let log = sandbox.makeLog(enabled: nil)
    log.isEnabled = true
    log.log("kept")
    log.waitUntilWritten()
    XCTAssertEqual(try sandbox.entries().count, 1)
    XCTAssertEqual(sandbox.defaults.object(forKey: DebugLog.enabledKey) as? Bool, true)
    XCTAssertTrue(sandbox.makeLog(enabled: nil).isEnabled)

    log.isEnabled = false
    log.log("ignored")
    XCTAssertNil(log.logPhoto(try makeJPEG(width: 2, height: 2), id: "ignored"))
    log.logJSONText("ws.recv", "{}")
    log.waitUntilWritten()
    XCTAssertEqual(try sandbox.entries().count, 1)
    XCTAssertFalse(try sandbox.fileNames().contains { $0.hasSuffix(".jpg") })
    XCTAssertEqual(sandbox.defaults.object(forKey: DebugLog.enabledKey) as? Bool, false)
    XCTAssertFalse(sandbox.makeLog(enabled: nil).isEnabled)
  }

  func testSuspendedLogIgnoresTheToggle() {
    let log = sandbox.makeLog(suspended: true)
    XCTAssertFalse(log.isEnabled)
    log.isEnabled = true
    XCTAssertFalse(log.isEnabled)
    log.log("ignored")
    log.waitUntilWritten()
    XCTAssertFalse(FileManager.default.fileExists(atPath: sandbox.directory.path))
  }

  // MARK: Photos

  func testPhotoIsSavedNextToTheLogAndReferencedFromItsEntry() async throws {
    let log = sandbox.makeLog(clock: TestClock(date("2026-11-14T10:00:00.123Z")))
    let jpeg = try makeJPEG(width: 4, height: 3)
    let name = try XCTUnwrap(log.logPhoto(jpeg, kind: "lookcheck.photo", id: "abc/12:3", ["trace": "abc123", "captureMs": 210]))
    log.waitUntilWritten()

    XCTAssertEqual(name, "photo-20261114T100000.123Z-abc123.jpg")
    XCTAssertEqual(try Data(contentsOf: sandbox.directory.appendingPathComponent(name)), jpeg)
    let entry = try XCTUnwrap(sandbox.entries().first)
    XCTAssertEqual(entry["kind"] as? String, "lookcheck.photo")
    let fields = payload(entry)
    XCTAssertEqual(fields["file"] as? String, name)
    XCTAssertEqual(fields["bytes"] as? Int, jpeg.count)
    XCTAssertEqual(fields["pixelWidth"] as? Int, 4)
    XCTAssertEqual(fields["pixelHeight"] as? Int, 3)
    XCTAssertEqual(fields["trace"] as? String, "abc123")
    XCTAssertEqual(fields["captureMs"] as? Int, 210)
    XCTAssertEqual(log.stats.photos, 1)
    XCTAssertEqual(log.stats.entries, 1)

    let shared = await log.files().map(\.lastPathComponent)
    XCTAssertEqual(shared, ["2026-11-14.jsonl", name])
  }

  // MARK: Pruning

  func testPruneDeletesEntriesAndPhotosOlderThan24Hours() throws {
    let clock = TestClock(date("2026-11-12T20:00:00.000Z"))
    let log = sandbox.makeLog(clock: clock)
    let jpeg = try makeJPEG(width: 2, height: 2)
    log.log("old", ["n": 1])
    clock.set(date("2026-11-13T08:00:00.000Z"))
    log.log("old", ["n": 2])
    log.logPhoto(jpeg, id: "old")
    clock.set(date("2026-11-13T12:00:00.000Z"))
    log.log("recent", ["n": 3])
    clock.set(date("2026-11-14T09:00:00.000Z"))
    log.log("recent", ["n": 4])
    let recentPhoto = try XCTUnwrap(log.logPhoto(jpeg, id: "recent"))
    log.waitUntilWritten()
    XCTAssertEqual(log.stats.entries, 6)
    XCTAssertEqual(log.stats.photos, 2)

    // Cutoff: 2026-11-13T10:00Z.
    clock.set(date("2026-11-14T10:00:00.000Z"))
    log.prune()
    log.waitUntilWritten()

    XCTAssertEqual(try sandbox.fileNames(), ["2026-11-13.jsonl", "2026-11-14.jsonl", recentPhoto])
    XCTAssertEqual(try sandbox.entries(in: "2026-11-13.jsonl").map { payload($0)["n"] as? Int }, [3])
    XCTAssertEqual(try sandbox.entries(in: "2026-11-14.jsonl").map { $0["kind"] as? String }, ["recent", "photo"])
    XCTAssertEqual(log.stats.entries, 3)
    XCTAssertEqual(log.stats.photos, 1)

    // A day later everything is gone.
    clock.set(date("2026-11-15T09:30:00.000Z"))
    log.prune()
    log.waitUntilWritten()
    XCTAssertEqual(try sandbox.fileNames(), [])
    XCTAssertEqual(log.stats, DebugLog.Stats())
  }

  func testDeleteAllRemovesEveryFile() throws {
    let log = sandbox.makeLog()
    log.log("a")
    log.logPhoto(try makeJPEG(width: 2, height: 2), id: "p")
    log.waitUntilWritten()
    XCTAssertEqual(log.stats.photos, 1)

    log.deleteAll()
    log.waitUntilWritten()
    XCTAssertEqual(try sandbox.fileNames(), [])
    XCTAssertEqual(log.stats, DebugLog.Stats())
  }

  // MARK: Redaction

  func testRedactsTokenJoinCodeAndAuthorization() throws {
    let log = sandbox.makeLog()
    log.log("http.request", [
      "headers": ["Authorization": "Bearer tok_secret_123", "Content-Type": "application/json"],
      "body": ["joinCode": "demo-join-code", "nested": ["session_token": "tok_secret_123", "text": "Helsinki is the capital of Finland."]],
      "token": "tok_secret_123",
      "note": "sent with Bearer tok_secret_123",
    ])
    let created = #"{"sessionId":"session-1","token":"tok_secret_123","joinCode":"demo-join-code","sessionEpoch":1}"#
    log.logJSONText("ws.recv", created)
    log.log("http.request", ["label": "check.submit"], jsonBody: Data(#"{"token":"tok_secret_123","text":"kept text"}"#.utf8))
    log.waitUntilWritten()

    let text = try sandbox.allText()
    XCTAssertFalse(text.contains("tok_secret_123"))
    XCTAssertFalse(text.contains("demo-join-code"))
    XCTAssertTrue(text.contains("Helsinki is the capital of Finland."))
    XCTAssertTrue(text.contains("application/json"))
    XCTAssertTrue(text.contains("kept text"))

    let entries = try sandbox.entries()
    let request = payload(entries[0])
    XCTAssertEqual((request["headers"] as? [String: Any])?["Authorization"] as? String, DebugLog.redacted)
    XCTAssertEqual((request["body"] as? [String: Any])?["joinCode"] as? String, DebugLog.redacted)
    XCTAssertEqual(((request["body"] as? [String: Any])?["nested"] as? [String: Any])?["session_token"] as? String, DebugLog.redacted)
    XCTAssertEqual(request["token"] as? String, DebugLog.redacted)
    XCTAssertEqual(request["note"] as? String, "sent with Bearer [redacted]")
    XCTAssertEqual(
      payload(entries[1])["raw"] as? String,
      #"{"sessionId":"session-1","token":"[redacted]","joinCode":"[redacted]","sessionEpoch":1}"#
    )
    XCTAssertEqual((payload(entries[2])["body"] as? [String: Any])?["token"] as? String, DebugLog.redacted)
  }

  func testSecretKeyMatchingIgnoresCaseAndSeparators() {
    for key in ["Authorization", "joinCode", "join_code", "TOKEN", "x-api-key", "apiKey", "session_token"] {
      XCTAssertTrue(DebugLog.isSecretKey(key), key)
    }
    for key in ["text", "tokens", "requestId", "confidence", "reasonCode"] {
      XCTAssertFalse(DebugLog.isSecretKey(key), key)
    }
  }
}

// MARK: - Wiring

/// The app's modules write to an injected log: raw backend events before any filtering, check
/// bodies, and the exact photo OCR ran on.
@MainActor
final class DebugLogWiringTests: XCTestCase {
  private var sandbox: Sandbox!

  override func setUp() async throws {
    sandbox = Sandbox()
    MockURLProtocol.reset()
  }

  override func tearDown() async throws {
    MockURLProtocol.reset()
    sandbox.tearDown()
  }

  func testBackendClientLogsRawEventsAndCheckBodiesWithoutTheTokenOrJoinCode() async throws {
    let token = "tok_secret_value_123"
    let expiresAt = ISO8601DateFormatter().string(from: Date().addingTimeInterval(300))
    let created = Data(#"""
    {"schemaVersion":1,"sessionId":"session-1","token":"\#(token)","sessionEpoch":1,"expiresAt":"\#(expiresAt)","capabilities":{"mode":"fixture","text":true,"audio":true}}
    """#.utf8)
    MockURLProtocol.handler = { request, _ in
      if request.httpMethod == "POST", request.url?.path == "/v1/sessions" { return (201, created) }
      return (202, Data("{}".utf8))
    }
    let sockets = FakeSocketFactory()
    let socket = FakeWebSocket()
    socket.push(json: EventJSON.ready(id: "ready-1"))
    sockets.enqueue(socket)
    let timeline = FakeTimeline()
    let log = sandbox.makeLog()
    let client = BackendClient(
      config: BackendConfig(baseURL: URL(string: "https://api.example.test")!, joinCode: "demo-join-code"),
      urlSession: MockURLProtocol.session(),
      policy: ReconnectPolicy(retryCycleDelay: nil, openTimeout: 1, pingInterval: 0),
      webSocketFactory: sockets.factory,
      sleep: timeline.sleep,
      uptime: { timeline.now },
      debugLog: log
    )
    let events = Collector(client.events())
    try await client.connect()

    let confirmation = EventJSON.make(
      id: "evt-2", type: "claim.needs_confirmation", requestId: "asr-1", claimId: "asr-1-c1", revision: 1,
      payload: #"{"admissionAction":"skip","reasonCode":"capture_uncertain"}"#
    )
    socket.push(json: confirmation)
    // A repeat is dropped by the filter, but the raw frame is still logged.
    socket.push(json: confirmation)
    socket.push(json: EventJSON.checking(id: "evt-3", requestId: "asr-2", claimId: "asr-2-c1"))
    // Frames are handled in order, so the duplicate is logged once the third event arrives.
    await waitUntil { events.values.contains { $0.type == .claimChecking } }
    try await client.submit(TextInputEnvelope(
      requestId: "ocr-1", sessionId: "session-1", sessionEpoch: 1, mode: .ocr, text: "Helsinki is the capital of Finland.",
      capturedAt: Date(), capture: .init(source: .glassesCamera, segmentId: "photo-1", confidence: 0.92, final: true),
      userInitiated: true
    ))
    await client.close()
    log.waitUntilWritten()

    let text = try sandbox.allText()
    XCTAssertFalse(text.contains(token))
    XCTAssertFalse(text.contains("demo-join-code"))

    let entries = try sandbox.entries()
    let received = entries.filter { $0["kind"] as? String == "ws.recv" }.map(payload)
    XCTAssertEqual(
      received.compactMap { $0["type"] as? String },
      ["session.ready", "claim.needs_confirmation", "claim.needs_confirmation", "claim.checking"]
    )
    XCTAssertEqual(received[1]["raw"] as? String, confirmation)
    let drop = try XCTUnwrap(entries.first { $0["kind"] as? String == "ws.drop" }.map(payload))
    XCTAssertEqual(drop["reason"] as? String, "duplicate_event_id")

    let requests = entries.filter { $0["kind"] as? String == "http.request" }.map(payload)
    XCTAssertEqual(requests.compactMap { $0["label"] as? String }, ["session.create", "check.submit", "session.delete"])
    XCTAssertNil(requests[0]["body"], "the session-create body holds the join code")
    let check = requests[1]
    XCTAssertEqual((check["headers"] as? [String: Any])?["Authorization"] as? String, DebugLog.redacted)
    let body = try XCTUnwrap(check["body"] as? [String: Any])
    XCTAssertEqual(body["text"] as? String, "Helsinki is the capital of Finland.")
    XCTAssertEqual(body["mode"] as? String, "ocr")
    XCTAssertEqual((body["capture"] as? [String: Any])?["confidence"] as? Double, 0.92)

    let responses = entries.filter { $0["kind"] as? String == "http.response" }.map(payload)
    XCTAssertEqual(responses.compactMap { $0["status"] as? Int }, [201, 202, 202])
    XCTAssertTrue(entries.contains { $0["kind"] as? String == "ws.state" && payload($0)["state"] as? String == "connected" })
  }

  func testLookAndCheckSavesTheExactPhotoAndTheOCRResult() async throws {
    let jpeg = try makeJPEG(width: 8, height: 6)
    let channel = StubChannel()
    let photo = StubPhoto(jpeg: jpeg)
    var ocr = OCRResult(text: "The Eiffel Tower opened in 1889.", meanConfidence: 0.9, lineCount: 1, droppedLineCount: 1)
    ocr.observations = [
      OCRService.OCRLine(text: "The Eiffel Tower opened in 1889.", confidence: 0.9, boundingBox: CGRect(x: 0.1, y: 0.5, width: 0.8, height: 0.1)),
      OCRService.OCRLine(text: "~~", confidence: 0.2, boundingBox: CGRect(x: 0.1, y: 0.2, width: 0.1, height: 0.05)),
    ]
    let recognizer = StubRecognizer(result: ocr)
    let submitter = StubSubmitter()
    let log = sandbox.makeLog()
    let coordinator = LookAndCheckCoordinator(
      channel: channel, photo: photo, recognizer: recognizer, submitter: submitter, debugLog: log
    )

    let outcome = await coordinator.performCheck(source: .voice)
    log.waitUntilWritten()

    let requestId = try XCTUnwrap(submitter.envelopes.first?.requestId)
    XCTAssertEqual(outcome, .submitted(requestIds: [requestId], droppedCodePoints: 0))
    XCTAssertEqual(recognizer.received, [jpeg])

    let entries = try sandbox.entries()
    XCTAssertEqual(
      entries.compactMap { $0["kind"] as? String },
      ["lookcheck.start", "lookcheck.photo", "lookcheck.ocr", "lookcheck.chunks", "lookcheck.submitted", "lookcheck.outcome"]
    )
    let traces = Set(entries.compactMap { payload($0)["trace"] as? String })
    XCTAssertEqual(traces.count, 1, "one trace id ties the check together")
    XCTAssertEqual(payload(entries[0])["trigger"] as? String, "capture.request")

    let photoEntry = payload(entries[1])
    let file = try XCTUnwrap(photoEntry["file"] as? String)
    XCTAssertEqual(try Data(contentsOf: sandbox.directory.appendingPathComponent(file)), jpeg)
    XCTAssertEqual(photoEntry["pixelWidth"] as? Int, 8)
    XCTAssertEqual(photoEntry["pixelHeight"] as? Int, 6)
    XCTAssertNotNil(photoEntry["captureMs"] as? Int)

    let ocrEntry = payload(entries[2])
    XCTAssertEqual(ocrEntry["text"] as? String, "The Eiffel Tower opened in 1889.")
    let observations = try XCTUnwrap(ocrEntry["observations"] as? [[String: Any]])
    XCTAssertEqual(observations.compactMap { $0["text"] as? String }, ["The Eiffel Tower opened in 1889.", "~~"])
    XCTAssertEqual(try XCTUnwrap(observations[1]["confidence"] as? Double), 0.2, accuracy: 0.0001)
    XCTAssertEqual(payload(entries[3])["chunks"] as? [String], ["The Eiffel Tower opened in 1889."])
    XCTAssertEqual(payload(entries[4])["requestId"] as? String, requestId)
    XCTAssertEqual(payload(entries[5])["outcome"] as? String, "submitted")
  }

  func testUnreadablePhotoLogsWhy() async throws {
    let recognizer = StubRecognizer(result: OCRResult(text: "Th3 E1", meanConfidence: 0.3, lineCount: 1, droppedLineCount: 4))
    let log = sandbox.makeLog()
    let coordinator = LookAndCheckCoordinator(
      channel: StubChannel(), photo: StubPhoto(jpeg: Data([0xFF, 0xD8, 0xFF])), recognizer: recognizer,
      submitter: StubSubmitter(), debugLog: log
    )

    let outcome = await coordinator.performCheck(source: .button)
    log.waitUntilWritten()

    XCTAssertEqual(outcome, .unreadable(message: LookAndCheckCoordinator.unreadableMessage))
    let entries = try sandbox.entries()
    let unreadable = try XCTUnwrap(entries.first { $0["kind"] as? String == "lookcheck.unreadable" }.map(payload))
    XCTAssertEqual(unreadable["reason"] as? String, "low_confidence")
    XCTAssertEqual(payload(entries[0])["trigger"] as? String, "button")
    XCTAssertEqual(entries.last.map(payload)?["message"] as? String, LookAndCheckCoordinator.unreadableMessage)
  }
}

// MARK: - Stubs

@MainActor
private final class StubChannel: SessionChannel {
  var sessionId: String? = "session-1"
  var sessionEpoch: Int? = 1
  var connectionState: ChannelConnectionState = .connected
  func connectionStates() -> AsyncStream<ChannelConnectionState> { AsyncStream { $0.yield(connectionState) } }
  func events() -> AsyncStream<ServerEvent> { AsyncStream { _ in } }
  func sendControl<Message: Encodable & Sendable>(_ message: Message) async throws {}
  func sendBinary(_ data: Data) async throws {}
}

@MainActor
private final class StubPhoto: PhotoCapturing {
  let jpeg: Data
  init(jpeg: Data) { self.jpeg = jpeg }
  func captureStillDuringStream() async throws -> Data { jpeg }
}

private final class StubRecognizer: TextRecognizing, @unchecked Sendable {
  let result: OCRResult
  private let lock = NSLock()
  private var _received: [Data] = []
  init(result: OCRResult) { self.result = result }
  var received: [Data] { lock.withLock { _received } }

  func recognizeText(in imageData: Data) async throws -> OCRResult {
    lock.withLock { _received.append(imageData) }
    return result
  }
}

private final class StubSubmitter: CheckSubmitter, @unchecked Sendable {
  private let lock = NSLock()
  private var _envelopes: [TextInputEnvelope] = []
  var envelopes: [TextInputEnvelope] { lock.withLock { _envelopes } }
  func submit(_ input: TextInputEnvelope) async throws { lock.withLock { _envelopes.append(input) } }
}
