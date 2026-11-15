import XCTest
@testable import GlassesLab

/// Decodes the golden files from packages/contracts/fixtures (copied into Fixtures/).
final class ContractsV1Tests: XCTestCase {
  private let eiffel = "The Eiffel Tower opened in 1889."

  private func fixture(_ name: String) throws -> Data {
    let bundle = Bundle(for: Self.self)
    let url = bundle.url(forResource: name, withExtension: "json", subdirectory: "Fixtures")
      ?? bundle.url(forResource: name, withExtension: "json")
    return try Data(contentsOf: XCTUnwrap(url, "Missing fixture \(name).json"))
  }

  private func jsonObject(_ data: Data) throws -> NSDictionary {
    try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? NSDictionary)
  }

  func testClaimSourcesIsInformationalAndToleratesNewOptionalFields() throws {
    let event = try ServerEvent.decode(from: Data(#"{"schemaVersion":1,"eventId":"sources-1","eventSeq":3,"sessionId":"session-1","sessionEpoch":1,"requestId":"req-1","claimId":"claim-1","revision":1,"type":"claim.sources","serverAt":"2026-11-14T12:00:00Z","payload":{"sources":[{"id":"site-1","hostname":"example.org","title":"Evidence","stage":"reading","provider":"exa","futureField":true}],"futureField":1}}"#.utf8))
    XCTAssertEqual(event.type, .claimSources)
    guard case .claimSources(let payload) = event.payload else { return XCTFail("expected informational sources") }
    XCTAssertEqual(payload.sources.first?.hostname, "example.org")
    XCTAssertEqual(payload.sources.first?.stage, "reading")
  }

  // MARK: Text input

  func testTextUnicodeFixtureDecodesAndSpanSelectsCheckedText() throws {
    let input = try JSONDecoder().decode(TextInputEnvelope.self, from: fixture("text-unicode"))
    XCTAssertEqual(input.schemaVersion, 1)
    XCTAssertEqual(input.requestId, "req-unicode")
    XCTAssertEqual(input.mode, .typed)
    XCTAssertEqual(input.capture.source, .typedFixture)
    XCTAssertEqual(input.capture.confidence, 1)
    XCTAssertEqual(input.capture.final, true)
    XCTAssertEqual(input.context, [])
    XCTAssertTrue(input.userInitiated)

    XCTAssertEqual(CodePoints.count(input.text), 55)
    XCTAssertNotEqual(input.text.utf16.count, 55, "UTF-16 offsets must not be used")
    XCTAssertEqual(CodePoints.slice(input.text, span: SourceSpan(start: 23, end: 55)), eiffel)
    XCTAssertNoThrow(try input.validate())
  }

  func testTextInputReencodesWithTheSameKeysAndExplicitNullConfidence() throws {
    let data = try fixture("text-unicode")
    let input = try JSONDecoder().decode(TextInputEnvelope.self, from: data)
    let reencoded = try JSONEncoder().encode(input)
    XCTAssertEqual(try jsonObject(reencoded), try jsonObject(data))

    var unknownConfidence = input
    unknownConfidence.capture.confidence = nil
    unknownConfidence.capture.final = nil
    let capture = try XCTUnwrap(try jsonObject(JSONEncoder().encode(unknownConfidence))["capture"] as? NSDictionary)
    XCTAssertTrue(capture["confidence"] is NSNull, "confidence is required and nullable")
    XCTAssertNil(capture["final"], "final is optional and omitted when nil")
  }

  func testValidationMirrorsServerLimits() {
    func input(text: String, context: [String] = [], requestId: String = "req-1") -> TextInputEnvelope {
      TextInputEnvelope(
        requestId: requestId, sessionId: "session-1", sessionEpoch: 1, mode: .ocr, text: text,
        capturedAt: Date(), capture: .init(source: .glassesCamera, segmentId: "photo-1", confidence: nil),
        context: context, userInitiated: true
      )
    }
    XCTAssertNoThrow(try input(text: String(repeating: "🙂", count: 800)).validate())
    XCTAssertThrowsError(try input(text: String(repeating: "🙂", count: 801)).validate()) { error in
      XCTAssertEqual(error as? TextInputEnvelope.ValidationError, .textTooLong(codePoints: 801))
    }
    XCTAssertThrowsError(try input(text: "  \n").validate())
    XCTAssertThrowsError(try input(text: "ok", context: ["a", "b", "c"]).validate())
    XCTAssertThrowsError(try input(text: "ok", context: [String(repeating: "x", count: 1_201)]).validate())
    XCTAssertThrowsError(try input(text: "ok", requestId: "has space").validate())
  }

  // MARK: Results

  func testResultFixturesDecodeAndSpansRoundTrip() throws {
    let cases: [(String, Verdict, PresentationAction, Int)] = [
      ("result-manual-supported", .supported, .respond, 1),
      ("result-manual-insufficient", .insufficientEvidence, .respond, 0),
      ("result-automatic-silent", .supported, .silent, 1),
    ]
    for (name, verdict, action, evidenceCount) in cases {
      let result = try JSONDecoder().decode(ClaimResult.self, from: fixture(name))
      XCTAssertEqual(result.verdict, verdict, name)
      XCTAssertEqual(result.presentation.action, action, name)
      XCTAssertEqual(result.sourceSpan, SourceSpan(start: 23, end: 55), name)
      XCTAssertEqual(result.sourceSpan.slice(result.originalText), result.checkedText, name)
      XCTAssertEqual(result.checkedText, eiffel, name)
      XCTAssertTrue(result.spanMatchesCheckedText, name)
      XCTAssertEqual(result.evidence.count, evidenceCount, name)
      XCTAssertEqual(result.selectedEvidence.count, evidenceCount, name)
      XCTAssertEqual(result.modelVersion, "fixture", name)
    }
  }

  func testEvidenceKeepsNullablesAndStance() throws {
    let result = try JSONDecoder().decode(ClaimResult.self, from: fixture("result-manual-supported"))
    let evidence = try XCTUnwrap(result.evidence.first)
    XCTAssertEqual(evidence.id, "fixture-eiffel")
    XCTAssertNil(evidence.publishedAt)
    XCTAssertNil(evidence.echoGroup)
    XCTAssertEqual(evidence.publisher, "Eiffel Tower")
    XCTAssertEqual(evidence.stance, .supports)
    XCTAssertEqual(evidence.stanceProbability, 0.96)
    XCTAssertEqual(evidence.contentBasis, "highlight")
    XCTAssertEqual(evidence.sourceRole, "primary")
  }

  // MARK: Events

  func testEventsFixtureDecodes() throws {
    let events = try JSONDecoder().decode([ServerEvent].self, from: fixture("events"))
    XCTAssertEqual(events.map(\.type), [.claimChecking, .claimResult])
    XCTAssertEqual(events.map(\.eventSeq), [1, 2])

    guard case .claimChecking(let admission) = events[0].payload else { return XCTFail("expected claim.checking") }
    XCTAssertEqual(admission.admissionAction, .check)

    let resultEvent = events[1]
    XCTAssertEqual(ClaimIdentity(event: resultEvent), ClaimIdentity(requestId: "req-unicode", claimId: "req-unicode-c1", revision: 1))
    guard case .claimResult(let result) = resultEvent.payload else { return XCTFail("expected claim.result") }
    XCTAssertEqual(CodePoints.slice(result.originalText, start: 23, end: 55), result.checkedText)
    XCTAssertEqual(result.presentation.action, .respond)
  }

  func testWaitingFixtureDecodes() throws {
    let event = try ServerEvent.decode(from: fixture("event-waiting"))
    XCTAssertEqual(event.type, .claimWaiting)
    guard case .claimWaiting(let waiting) = event.payload else { return XCTFail("expected claim.waiting") }
    XCTAssertEqual(waiting.admissionAction, .wait)
    XCTAssertEqual(waiting.reasonCode, "incomplete")
    XCTAssertNotNil(ContractDates.date(from: waiting.waitExpiresAt))
  }

  func testUnknownEventTypeDecodesSafely() throws {
    let json = #"{"schemaVersion":1,"eventId":"e9","eventSeq":9,"sessionId":"s","sessionEpoch":1,"type":"future.thing","serverAt":"2026-11-14T10:00:01Z","payload":{"anything":[1,2,3]}}"#
    let event = try ServerEvent.decode(from: Data(json.utf8))
    XCTAssertEqual(event.type, .unknown("future.thing"))
    XCTAssertEqual(event.type.rawValue, "future.thing")
    XCTAssertEqual(event.payload, .unknown)
  }

  func testMalformedKnownPayloadDoesNotThrow() throws {
    let json = #"{"schemaVersion":1,"eventId":"e3","eventSeq":3,"sessionId":"s","sessionEpoch":1,"requestId":"r","claimId":"c","revision":1,"type":"claim.result","serverAt":"2026-11-14T10:00:01Z","payload":{}}"#
    let event = try ServerEvent.decode(from: Data(json.utf8))
    guard case .malformed = event.payload else { return XCTFail("expected malformed payload") }
    XCTAssertTrue(event.logSummary.contains("payload=malformed"))
  }

  func testUnknownEnumValuesAreKept() throws {
    var object = try XCTUnwrap(JSONSerialization.jsonObject(with: fixture("result-manual-supported")) as? [String: Any])
    object["verdict"] = "partly_true"
    object["presentation"] = ["action": "glow", "reasonCode": "future"]
    let result = try JSONDecoder().decode(ClaimResult.self, from: JSONSerialization.data(withJSONObject: object))
    XCTAssertEqual(result.verdict, .unknown("partly_true"))
    XCTAssertEqual(result.presentation.action, .unknown("glow"))
    XCTAssertEqual(CaptureSource(rawValue: "glasses_camera"), .glassesCamera)
    XCTAssertEqual(CaptureSource(rawValue: "satellite").rawValue, "satellite")
  }

  func testTranscriptAndSessionPayloadsDecode() throws {
    let transcript = #"{"schemaVersion":1,"eventId":"e4","eventSeq":4,"sessionId":"s","sessionEpoch":1,"type":"transcript.final","serverAt":"2026-11-14T10:00:01Z","payload":{"text":"secret words","final":true,"segmentId":"seg-1","confidence":null,"captureOffsetMs":1200,"streamGeneration":2,"source":"glasses_stream_audio"}}"#
    let event = try ServerEvent.decode(from: Data(transcript.utf8))
    guard case .transcriptFinal(let payload) = event.payload else { return XCTFail("expected transcript.final") }
    XCTAssertNil(payload.confidence)
    XCTAssertEqual(payload.source, .glassesStreamAudio)
    XCTAssertFalse(event.logSummary.contains("secret"), "log summary must not include transcript text")

    let ready = #"{"schemaVersion":1,"eventId":"e1","eventSeq":1,"sessionId":"s","sessionEpoch":1,"type":"session.ready","serverAt":"2026-11-14T10:00:01Z","payload":{"active":true,"expiresAt":"2026-11-14T10:05:01.000Z","mode":"fixture","audio":false}}"#
    guard case .sessionReady(let readyPayload) = try ServerEvent.decode(from: Data(ready.utf8)).payload else { return XCTFail("expected session.ready") }
    XCTAssertTrue(readyPayload.active)
    XCTAssertNotNil(readyPayload.expiresAt.flatMap(ContractDates.date(from:)))

    let error = #"{"schemaVersion":1,"eventId":"e5","eventSeq":5,"sessionId":"s","sessionEpoch":1,"type":"pipeline.error","serverAt":"2026-11-14T10:00:01Z","payload":{"reasonCode":"asr_unavailable","message":"The request could not be completed."}}"#
    guard case .pipelineError(let errorPayload) = try ServerEvent.decode(from: Data(error.utf8)).payload else { return XCTFail("expected pipeline.error") }
    XCTAssertEqual(errorPayload.reasonCode, "asr_unavailable")
    XCTAssertNil(errorPayload.presentation)
  }

  func testSessionCreateResponseRedactsToken() throws {
    let json = #"{"schemaVersion":1,"sessionId":"abc","token":"super-secret-token","sessionEpoch":1,"expiresAt":"2026-11-14T10:05:00.000Z","capabilities":{"mode":"fixture","text":true,"audio":false},"budgets":{"deadlineMs":10000,"running":2,"queued":3,"jev":3,"searchesPerClaim":2}}"#
    let response = try JSONDecoder().decode(SessionCreateResponse.self, from: Data(json.utf8))
    XCTAssertEqual(response.token, "super-secret-token")
    XCTAssertEqual(response.capabilities?.audio, false)
    XCTAssertFalse(String(describing: response).contains("super-secret-token"))
  }

  // MARK: Controls

  func testAudioStartMatchesContractExample() throws {
    let control = AudioStartControl(sessionEpoch: 1, streamGeneration: 1, source: .glassesStreamAudio)
    let expected = #"{"type":"audio.start","sessionEpoch":1,"streamGeneration":1,"encoding":"pcm_s16le","sampleRateHz":16000,"channels":1,"source":"glasses_stream_audio"}"#
    XCTAssertEqual(try jsonObject(JSONEncoder().encode(control)), try jsonObject(Data(expected.utf8)))
  }

  func testControlMessagesOmitUnusedKeys() throws {
    XCTAssertEqual(
      try jsonObject(JSONEncoder().encode(ControlMessage.playbackStarted(epoch: 2))),
      ["type": "playback.started", "sessionEpoch": 2] as NSDictionary
    )
    XCTAssertEqual(
      try jsonObject(JSONEncoder().encode(ControlMessage.repeatResult(requestId: "r", claimId: "c", epoch: 1))),
      ["type": "claim.repeat", "sessionEpoch": 1, "requestId": "r", "claimId": "c"] as NSDictionary
    )
  }

  // MARK: Code points

  func testCodePointHelpers() {
    let flag = "🇫🇮 Finland"
    XCTAssertEqual(flag.count, 9, "Character count")
    XCTAssertEqual(CodePoints.count(flag), 10, "a flag is two code points")
    XCTAssertEqual(CodePoints.slice(flag, start: 3, end: 10), "Finland")
    XCTAssertNil(CodePoints.slice(flag, start: 3, end: 11))
    XCTAssertNil(CodePoints.slice(flag, start: -1, end: 2))
    XCTAssertNil(CodePoints.slice(flag, start: 5, end: 4))
    XCTAssertEqual(CodePoints.slice(flag, start: 4, end: 4), "")
    XCTAssertEqual(CodePoints.prefix(flag, maxCodePoints: 2), "🇫🇮")
    let range = CodePoints.indexRange(in: flag, start: 3, end: 10)
    XCTAssertEqual(range.map { String(flag[$0]) }, "Finland")
  }

  // MARK: Pipeline helpers

  func testWireIdsAndBackendConfig() throws {
    let requestId = WireID.makeRequestId(prefix: "ocr")
    XCTAssertTrue(requestId.hasPrefix("ocr-"))
    XCTAssertTrue(WireID.isValid(requestId))
    XCTAssertFalse(WireID.isValid(""))
    XCTAssertFalse(WireID.isValid("a/b"))
    XCTAssertFalse(WireID.isValid(String(repeating: "a", count: 101)))

    let suite = "ContractsV1Tests-\(UUID().uuidString)"
    let defaults = try XCTUnwrap(UserDefaults(suiteName: suite))
    defer { defaults.removePersistentDomain(forName: suite) }
    let secrets = MemorySecretStore()
    XCTAssertEqual(BackendConfig.load(from: defaults, secrets: secrets), BackendConfig())
    XCTAssertEqual(BackendConfig.load(from: defaults, secrets: secrets).joinCode, "")

    BackendConfig(baseURL: URL(string: "https://api.example.com")!, joinCode: "demo-code", remoteOCRSelectionEnabled: true).save(to: defaults, secrets: secrets)
    let loaded = BackendConfig.load(from: defaults, secrets: secrets)
    XCTAssertEqual(loaded.joinCode, "demo-code")
    XCTAssertTrue(loaded.remoteOCRSelectionEnabled)
    XCTAssertNil(defaults.string(forKey: BackendConfig.joinCodeKey), "the join code stays out of UserDefaults")
    XCTAssertEqual(secrets.read(BackendConfig.joinCodeKey), "demo-code")
    XCTAssertEqual(loaded.streamURL(sessionId: "abc")?.absoluteString, "wss://api.example.com/v1/sessions/abc/stream")
    XCTAssertEqual(loaded.checksURL(sessionId: "abc").absoluteString, "https://api.example.com/v1/sessions/abc/checks")
    XCTAssertEqual(
      BackendConfig().streamURL(sessionId: "abc")?.absoluteString,
      "wss://facto-api.lively-voice-2bf8.workers.dev/v1/sessions/abc/stream"
    )

    defaults.set("ftp://nope", forKey: BackendConfig.baseURLKey)
    XCTAssertEqual(BackendConfig.load(from: defaults, secrets: secrets).baseURL, BackendConfig.defaultBaseURL)

    // A join code left in UserDefaults by an older build moves to the secret store once.
    let fresh = MemorySecretStore()
    defaults.set("old-code", forKey: BackendConfig.joinCodeKey)
    XCTAssertEqual(BackendConfig.load(from: defaults, secrets: fresh).joinCode, "old-code")
    XCTAssertNil(defaults.string(forKey: BackendConfig.joinCodeKey))
    XCTAssertEqual(fresh.read(BackendConfig.joinCodeKey), "old-code")
  }

  func testOneTimeMigrationDropsLocalhostAndRailwayURLs() throws {
    func freshDefaults() throws -> (UserDefaults, String) {
      let suite = "ContractsV1Tests-migration-\(UUID().uuidString)"
      return (try XCTUnwrap(UserDefaults(suiteName: suite)), suite)
    }
    let secrets = MemorySecretStore()

    for old in ["http://localhost:3000", "https://glasses-api-production.up.railway.app", " http://LOCALHOST:8080 "] {
      let (defaults, suite) = try freshDefaults()
      defer { defaults.removePersistentDomain(forName: suite) }
      defaults.set(old, forKey: BackendConfig.baseURLKey)
      XCTAssertEqual(BackendConfig.load(from: defaults, secrets: secrets).baseURL, BackendConfig.defaultBaseURL, old)
      XCTAssertNil(defaults.string(forKey: BackendConfig.baseURLKey), old)
      XCTAssertTrue(defaults.bool(forKey: BackendConfig.baseURLMigratedKey))
    }

    // A laptop on the LAN stays.
    let (lan, lanSuite) = try freshDefaults()
    defer { lan.removePersistentDomain(forName: lanSuite) }
    lan.set("http://192.168.1.20:3000", forKey: BackendConfig.baseURLKey)
    XCTAssertEqual(BackendConfig.load(from: lan, secrets: secrets).baseURL.absoluteString, "http://192.168.1.20:3000")

    // The migration runs once: a localhost URL saved afterwards is the user's choice.
    let (once, onceSuite) = try freshDefaults()
    defer { once.removePersistentDomain(forName: onceSuite) }
    _ = BackendConfig.load(from: once, secrets: secrets)
    once.set("http://localhost:3000", forKey: BackendConfig.baseURLKey)
    XCTAssertEqual(BackendConfig.load(from: once, secrets: secrets).baseURL.absoluteString, "http://localhost:3000")
    XCTAssertEqual(BackendConfig.load(from: once, secrets: secrets).baseURL.absoluteString, "http://localhost:3000")
  }
}
