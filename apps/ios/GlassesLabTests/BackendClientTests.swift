import XCTest
@testable import GlassesLab

@MainActor
final class BackendClientTests: XCTestCase {
  private let token = "tok_secret_value_123"
  private var sockets: FakeSocketFactory!
  private var timeline: FakeTimeline!

  override func setUp() async throws {
    MockURLProtocol.reset()
    sockets = FakeSocketFactory()
    timeline = FakeTimeline()
  }

  override func tearDown() async throws {
    MockURLProtocol.reset()
  }

  // MARK: Helpers

  private func makeClient(joinCode: String = "demo-join", remoteOCRSelectionEnabled: Bool = false, policy: ReconnectPolicy = ReconnectPolicy(retryCycleDelay: nil, openTimeout: 1), sleep: (@Sendable (TimeInterval) async throws -> Void)? = nil) -> BackendClient {
    let timeline = timeline!
    return BackendClient(
      config: BackendConfig(baseURL: URL(string: "https://api.example.test")!, joinCode: joinCode, remoteOCRSelectionEnabled: remoteOCRSelectionEnabled),
      urlSession: MockURLProtocol.session(),
      policy: policy,
      webSocketFactory: sockets.factory,
      sleep: sleep ?? timeline.sleep,
      uptime: { timeline.now }
    )
  }

  private var futureExpiry: String { ISO8601DateFormatter().string(from: Date().addingTimeInterval(300)) }

  private func sessionCreatedBody(epoch: Int = 1) -> Data {
    Data("""
    {"schemaVersion":1,"sessionId":"session-1","token":"\(token)","sessionEpoch":\(epoch),"expiresAt":"\(futureExpiry)",
     "capabilities":{"mode":"fixture","text":true,"audio":false},
     "budgets":{"deadlineMs":10000,"running":2,"queued":3,"jev":3,"searchesPerClaim":2}}
    """.utf8)
  }

  /// Routes POST /v1/sessions to a 201 and everything else to `other`.
  private func serve(other: @escaping (URLRequest, Data) -> (Int, Data) = { _, _ in (204, Data()) }) {
    let created = sessionCreatedBody()
    MockURLProtocol.handler = { request, body in
      if request.httpMethod == "POST", request.url?.path == "/v1/sessions" { return (201, created) }
      return other(request, body)
    }
  }

  private func connectedClient() async throws -> (BackendClient, FakeWebSocket) {
    serve()
    let socket = FakeWebSocket()
    socket.push(json: EventJSON.ready(id: "ready-1"))
    sockets.enqueue(socket)
    let client = makeClient()
    try await client.connect()
    return (client, socket)
  }

  private func input(sessionId: String = "session-1", epoch: Int = 1, text: String = "The Eiffel Tower opened in 1889.") -> TextInputEnvelope {
    TextInputEnvelope(
      requestId: "req-1",
      sessionId: sessionId,
      sessionEpoch: epoch,
      mode: .ocr,
      text: text,
      capturedAt: Date(),
      capture: .init(source: .glassesCamera, segmentId: "photo-1", confidence: 0.92),
      userInitiated: true
    )
  }

  // MARK: Session create

  private var targetInput: OCRTargetInput {
    .init(lines: [.init(id: "L1", text: "One router took down flights", confidence: 0.95,
                       polygon: [.init(x: 0.1, y: 0.8), .init(x: 0.8, y: 0.8), .init(x: 0.8, y: 0.7), .init(x: 0.1, y: 0.7)])], aspect: 0.75)
  }

  func testRemoteOCRDisabledMakesNoRequest() async throws {
    let client = makeClient()
    let result = try await client.selectTarget(in: targetInput, imageData: Data([255, 216, 255, 217]), intent: nil)
    XCTAssertEqual(result.status, .unavailable)
    XCTAssertTrue(MockURLProtocol.recorded.isEmpty)
  }

  func testRemoteOCRRejectsOversizeEvidenceAndHintBeforeAnyNetworkRequest() async throws {
    let client = makeClient(remoteOCRSelectionEnabled: true)
    let source = targetInput.lines[0]
    func repeatedInput(count: Int, text: String) -> OCRTargetInput {
      .init(lines: (0..<count).map { index in
        .init(id: "L\(index)", text: text, confidence: source.confidence, polygon: source.polygon)
      }, aspect: targetInput.aspect)
    }
    let image = Data([255, 216, 255, 217])
    for input in [repeatedInput(count: 301, text: "a"), repeatedInput(count: 1, text: String(repeating: "a", count: 1_001)),
                  repeatedInput(count: 61, text: String(repeating: "a", count: 1_000))] {
      let result = try await client.selectTarget(in: input, imageData: image, intent: nil)
      XCTAssertEqual(result.reason, "target_selection_input_too_large")
      XCTAssertEqual(result.status, .unavailable)
    }
    // Emoji are two UTF-16 units each; matching the server avoids a misleading HTTP 400.
    let hintResult = try await client.selectTarget(in: targetInput, imageData: image, intent: String(repeating: "😀", count: 251))
    XCTAssertEqual(hintResult.reason, "target_selection_hint_too_long")
    let imageResult = try await client.selectTarget(in: targetInput, imageData: Data(repeating: 0, count: 4_000_001), intent: nil)
    XCTAssertEqual(imageResult.reason, "target_selection_image_too_large")
    XCTAssertTrue(MockURLProtocol.recorded.isEmpty)
  }

  func testRemoteOCRUsesSessionAuthAndOriginalTopLeftPolygons() async throws {
    serve { request, body in
      XCTAssertEqual(request.url?.path, "/v1/sessions/session-1/ocr/select-target")
      XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer tok_secret_value_123")
      let payload = try! JSONSerialization.jsonObject(with: body) as! [String: Any]
      let lines = payload["lines"] as! [[String: Any]]
      let polygon = lines[0]["polygon"] as! [[Double]]
      XCTAssertEqual(polygon[0][0], 0.1, accuracy: 0.0001)
      XCTAssertEqual(polygon[0][1], 0.2, accuracy: 0.0001)
      XCTAssertEqual(lines[0]["text"] as? String, "One router took down flights")
      return (200, Data(#"{"status":"selected","selectedLineIds":["L1"],"contextLineIds":[],"candidates":[{"id":"post","role":"post_title","lineIds":["L1"]}],"selectedCandidateId":"post","text":"THIS GENERATED STRING MUST BE IGNORED"}"#.utf8))
    }
    let client = makeClient(remoteOCRSelectionEnabled: true)
    try await client.createSession()
    let result = try await client.selectTarget(in: targetInput, imageData: Data([255, 216, 255, 217]), intent: nil)
    XCTAssertEqual(result.resolvedLines(in: targetInput)?.map(\.text), ["One router took down flights"])
  }

  func testRemoteOCRRejectsUnknownIDsAndCrossCandidateMixing() async throws {
    for selected in [#"["unknown"]"#, #"["L1","L1"]"#] {
      serve { _, _ in
        (200, Data("{\"status\":\"selected\",\"selectedLineIds\":\(selected),\"contextLineIds\":[],\"candidates\":[{\"id\":\"post\",\"role\":\"post\",\"lineIds\":[\"L1\"]}],\"selectedCandidateId\":\"post\"}".utf8))
      }
      let client = makeClient(remoteOCRSelectionEnabled: true)
      try await client.createSession()
      do {
        _ = try await client.selectTarget(in: targetInput, imageData: Data([255, 216, 255, 217]), intent: nil)
        XCTFail("Expected invalid response")
      } catch { XCTAssertEqual(error as? BackendClientError, .invalidResponse) }
    }
  }

  func testCreateSessionPostsJoinCodeAndStoresTheSession() async throws {
    serve()
    let client = makeClient(joinCode: "  demo-join \n")
    let response = try await client.createSession()

    XCTAssertEqual(client.sessionId, "session-1")
    XCTAssertEqual(client.sessionEpoch, 1)
    XCTAssertNotNil(client.expiresAt)
    XCTAssertEqual(client.capabilities?.audio, false)
    XCTAssertFalse(response.description.contains(token))

    let call = try XCTUnwrap(MockURLProtocol.recorded.first)
    XCTAssertEqual(call.request.httpMethod, "POST")
    XCTAssertEqual(call.request.url?.absoluteString, "https://api.example.test/v1/sessions")
    XCTAssertEqual(call.request.value(forHTTPHeaderField: "Content-Type"), "application/json")
    XCTAssertNil(call.request.value(forHTTPHeaderField: "Authorization"))
    XCTAssertEqual(try JSONDecoder().decode(SessionCreateRequest.self, from: call.body), SessionCreateRequest(joinCode: "demo-join"))
  }

  func testCreateSessionSurfacesTheServerErrorCode() async {
    MockURLProtocol.handler = { _, _ in (401, Data(#"{"error":"unauthorized"}"#.utf8)) }
    let client = makeClient()
    do {
      try await client.createSession()
      XCTFail("Expected an error")
    } catch {
      XCTAssertEqual(error as? BackendClientError, .http(status: 401, code: "unauthorized"))
    }
    XCTAssertNil(client.sessionId)
  }

  func testCreateSessionWithoutJoinCodeMakesNoRequest() async {
    MockURLProtocol.handler = { _, _ in XCTFail("No request expected"); return (500, Data()) }
    let client = makeClient(joinCode: "   ")
    do {
      try await client.createSession()
      XCTFail("Expected an error")
    } catch {
      XCTAssertEqual(error as? BackendClientError, .missingJoinCode)
    }
    XCTAssertTrue(MockURLProtocol.recorded.isEmpty)
  }

  func testServerErrorCodeKeepsOnlyPlainCodes() {
    XCTAssertEqual(BackendClient.serverErrorCode(from: Data(#"{"error":"queue_full"}"#.utf8)), "queue_full")
    XCTAssertNil(BackendClient.serverErrorCode(from: Data(#"{"error":"Something with spaces and a token abc"}"#.utf8)))
    XCTAssertNil(BackendClient.serverErrorCode(from: Data("<html>bad gateway</html>".utf8)))
  }

  func testDisplayGrantUsesOwnerAuthorizationWithoutPuttingSecretsInURL() async throws {
    let (client, _) = try await connectedClient()
    let expiry = ISO8601DateFormatter().string(from: Date().addingTimeInterval(180))
    serve { request, _ in
      if request.httpMethod == "DELETE" { return (204, Data()) }
      XCTAssertEqual(request.httpMethod, "POST")
      XCTAssertEqual(request.url?.path, "/v1/sessions/session-1/display-grant")
      XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer \(self.token)")
      XCTAssertNil(request.url?.query)
      return (201, Data("""
      {"schemaVersion":1,"sessionId":"session-1","sessionEpoch":1,"displayToken":"read_only_token","expiresAt":"\(expiry)","streamPath":"/v1/sessions/session-1/display-stream"}
      """.utf8))
    }
    let grant = try await client.requestDisplayGrant()
    XCTAssertEqual(grant.displayToken, "read_only_token")
    XCTAssertFalse(grant.description.contains("read_only_token"))
    await client.close()
  }

  func testDisplayGrantRejectsAnotherSessionOrEpoch() async throws {
    let (client, _) = try await connectedClient()
    serve { _, _ in
      (201, Data(#"{"schemaVersion":1,"sessionId":"other","sessionEpoch":2,"displayToken":"read_only_token","expiresAt":"2099-01-01T00:00:00Z","streamPath":"/v1/sessions/other/display-stream"}"#.utf8))
    }
    do {
      _ = try await client.requestDisplayGrant()
      XCTFail("Expected a session mismatch")
    } catch {
      XCTAssertEqual(error as? BackendClientError, .invalidResponse)
    }
    await client.close()
  }

  // MARK: Stream connect

  func testConnectOpensTheStreamWithBearerHeaderAndNoTokenInTheURL() async throws {
    serve()
    let socket = FakeWebSocket()
    socket.push(json: EventJSON.ready(id: "ready-1"))
    sockets.enqueue(socket)
    let client = makeClient()
    let states = Collector(client.connectionStates())

    try await client.connect()

    XCTAssertEqual(client.connectionState, .connected)
    let request = try XCTUnwrap(sockets.requests.first)
    XCTAssertEqual(request.url?.absoluteString, "wss://api.example.test/v1/sessions/session-1/stream")
    XCTAssertNil(request.url?.query)
    XCTAssertFalse(request.url!.absoluteString.contains(token))
    XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer \(token)")
    XCTAssertTrue(socket.resumed)
    await waitUntil { states.values.count >= 3 }
    XCTAssertEqual(Array(states.values.prefix(3)), [.idle, .connecting, .connected])
  }

  func testConnectFailsWhenTheHandshakeIsRejected() async {
    serve()
    let socket = FakeWebSocket(handshakeStatusCode: 401)
    socket.fail(URLError(.badServerResponse))
    sockets.enqueue(socket)
    let client = makeClient()
    do {
      try await client.connect()
      XCTFail("Expected an error")
    } catch {
      XCTAssertEqual(error as? BackendClientError, .handshakeRejected(status: 401))
    }
    XCTAssertEqual(client.connectionState, .disconnected(reason: "unauthorized"))
  }

  func testConnectTimesOutWhenNoEventArrives() async {
    serve()
    let silent = FakeWebSocket()
    sockets.enqueue(silent)
    let client = makeClient(policy: ReconnectPolicy(delays: [], retryCycleDelay: nil, openTimeout: 0.05, initialOpenTimeout: 0.05))
    do {
      try await client.connect()
      XCTFail("Expected an error")
    } catch {
      XCTAssertEqual(error as? BackendClientError, .connectTimeout)
    }
    XCTAssertEqual(client.connectionState, .disconnected(reason: "connect_timeout"))
    XCTAssertTrue(silent.cancelled)
  }

  func testFirstConnectWaitsLongerThanAReconnect() async throws {
    serve()
    let slow = FakeWebSocket()
    sockets.enqueue(slow)
    let client = makeClient(policy: ReconnectPolicy(retryCycleDelay: nil, openTimeout: 0.05, initialOpenTimeout: 1))
    Task {
      try? await Task.sleep(nanoseconds: 200_000_000)
      slow.push(json: EventJSON.ready(id: "ready-1"))
    }
    try await client.connect()
    XCTAssertEqual(client.connectionState, .connected)
    XCTAssertEqual(sockets.requests.first?.timeoutInterval, 1)
  }

  // MARK: Events

  func testEventsReachEverySubscriberOnceAndDropsAreFiltered() async throws {
    serve()
    let socket = FakeWebSocket()
    socket.push(json: EventJSON.ready(id: "ready-1"))
    sockets.enqueue(socket)
    let client = makeClient()
    let first = Collector(client.events())
    let second = Collector(client.events())
    try await client.connect()

    socket.push(json: EventJSON.checking(id: "e1"))
    socket.push(json: EventJSON.checking(id: "e1"))
    socket.push(json: EventJSON.make(id: "e2", type: "session.future_thing", payload: "{}"))
    socket.push(json: EventJSON.checking(id: "e3", epoch: 0))
    socket.push(.text("not json"))
    socket.push(.binary(Data([1, 2, 3])))
    socket.push(json: EventJSON.make(id: "e4", type: "capture.request", payload: "{}"))

    await waitUntil { first.values.count >= 3 && second.values.count >= 3 }
    try? await Task.sleep(nanoseconds: 50_000_000)
    XCTAssertEqual(first.values.map(\.eventId), ["ready-1", "e1", "e4"])
    XCTAssertEqual(second.values.map(\.eventId), ["ready-1", "e1", "e4"])
  }

  func testUnreadableEventsAreCountedAndReported() async throws {
    let (client, socket) = try await connectedClient()
    var reported: [String?] = []
    client.onUnreadableEvent = { reported.append($0) }

    socket.push(.text("not json"))
    socket.push(json: EventJSON.make(id: "bad-1", type: "claim.result", requestId: "req-1", claimId: "req-1-c1", revision: 1, payload: "{\"verdict\":7}"))
    socket.push(json: EventJSON.make(id: "e9", type: "session.future_thing", payload: "{}"))

    await waitUntil { client.unreadableEventCount == 2 }
    try? await Task.sleep(nanoseconds: 50_000_000)
    XCTAssertEqual(client.unreadableEventCount, 2, "an unknown event type is ignored, not unreadable")
    XCTAssertEqual(reported, [nil, "claim.result"])
    XCTAssertEqual(BackendClient.envelopeType(in: Data(#"{"type":"claim.result","payload":7}"#.utf8)), "claim.result")
    XCTAssertNil(BackendClient.envelopeType(in: Data(#"{"type":"Free text with spaces"}"#.utf8)))
  }

  func testHigherEpochFromTheServerUpdatesSessionEpoch() async throws {
    let (client, socket) = try await connectedClient()
    socket.push(json: EventJSON.ended(id: "end-1", epoch: 2, reason: "paused"))
    await waitUntil { client.sessionEpoch == 2 }
    XCTAssertEqual(client.connectionState, .connected)
  }

  // MARK: Controls

  func testSendControlWritesOneJSONTextFrame() async throws {
    let (client, socket) = try await connectedClient()
    try await client.sendControl(ControlMessage.resume(epoch: 1))
    try await client.sendControl(AudioStartControl(sessionEpoch: 1, streamGeneration: 1, source: .glassesStreamAudio))
    try await client.sendBinary(Data([1, 0, 0, 0, 1]))

    XCTAssertEqual(socket.sent.count, 3)
    guard case .text(let resume) = socket.sent[0], case .text(let start) = socket.sent[1] else {
      return XCTFail("Expected text frames")
    }
    XCTAssertEqual(try JSONDecoder().decode(ControlMessage.self, from: Data(resume.utf8)), .resume(epoch: 1))
    XCTAssertEqual(try JSONDecoder().decode(AudioStartControl.self, from: Data(start.utf8)).streamGeneration, 1)
    XCTAssertEqual(socket.sent[2], .binary(Data([1, 0, 0, 0, 1])))
  }

  func testSendControlBeforeConnectThrows() async {
    let client = makeClient()
    do {
      try await client.sendControl(ControlMessage.pause(epoch: 1))
      XCTFail("Expected an error")
    } catch {
      XCTAssertEqual(error as? BackendClientError, .notConnected)
    }
  }

  // MARK: Check submit and cancel

  func testSubmitPostsTheEnvelopeWithBearerAndAccepts202() async throws {
    let (client, _) = try await connectedClient()
    serve { _, _ in (202, Data(#"{"requestId":"req-1"}"#.utf8)) }
    let envelope = input()

    try await client.submit(envelope)

    let call = try XCTUnwrap(MockURLProtocol.recorded.last)
    XCTAssertEqual(call.request.httpMethod, "POST")
    XCTAssertEqual(call.request.url?.absoluteString, "https://api.example.test/v1/sessions/session-1/checks")
    XCTAssertEqual(call.request.value(forHTTPHeaderField: "Authorization"), "Bearer \(token)")
    XCTAssertEqual(call.request.value(forHTTPHeaderField: "Content-Type"), "application/json")
    XCTAssertEqual(try JSONDecoder().decode(TextInputEnvelope.self, from: call.body), envelope)
  }

  func testSubmitMapsServerRejections() async throws {
    let (client, _) = try await connectedClient()
    serve { _, _ in (429, Data(#"{"error":"queue_full"}"#.utf8)) }
    do {
      try await client.submit(input())
      XCTFail("Expected an error")
    } catch {
      XCTAssertEqual(error as? BackendClientError, .http(status: 429, code: "queue_full"))
    }
  }

  func testSubmitRejectsBadInputWithoutANetworkCall() async throws {
    let (client, _) = try await connectedClient()
    let before = MockURLProtocol.recorded.count

    do { try await client.submit(input(text: "   ")); XCTFail("Expected an error") } catch {
      XCTAssertEqual(error as? TextInputEnvelope.ValidationError, .blankText)
    }
    do { try await client.submit(input(sessionId: "session-2")); XCTFail("Expected an error") } catch {
      XCTAssertEqual(error as? BackendClientError, .wrongSession)
    }
    do { try await client.submit(input(epoch: 7)); XCTFail("Expected an error") } catch {
      XCTAssertEqual(error as? BackendClientError, .staleEpoch(current: 1, envelope: 7))
    }
    XCTAssertEqual(MockURLProtocol.recorded.count, before)
  }

  func testSubmitBeforeTheStreamIsConnectedThrows() async throws {
    serve()
    let client = makeClient()
    try await client.createSession()
    do {
      try await client.submit(input())
      XCTFail("Expected an error")
    } catch {
      XCTAssertEqual(error as? BackendClientError, .notConnected)
    }
  }

  func testCancelPostsToTheCancelRoute() async throws {
    let (client, _) = try await connectedClient()
    try await client.cancel(requestId: "req-1")

    let call = try XCTUnwrap(MockURLProtocol.recorded.last)
    XCTAssertEqual(call.request.httpMethod, "POST")
    XCTAssertEqual(call.request.url?.absoluteString, "https://api.example.test/v1/sessions/session-1/checks/req-1/cancel")
    XCTAssertEqual(call.request.value(forHTTPHeaderField: "Authorization"), "Bearer \(token)")
  }

  func testCancelRejectsAnUnsafeRequestId() async throws {
    let (client, _) = try await connectedClient()
    let before = MockURLProtocol.recorded.count
    do {
      try await client.cancel(requestId: "../other")
      XCTFail("Expected an error")
    } catch {
      XCTAssertEqual(error as? BackendClientError, .invalidRequestId)
    }
    XCTAssertEqual(MockURLProtocol.recorded.count, before)
  }

  // MARK: Close

  func testCloseDeletesTheSessionAndDoesNotReconnect() async throws {
    let (client, socket) = try await connectedClient()
    await client.close()

    let call = try XCTUnwrap(MockURLProtocol.recorded.last)
    XCTAssertEqual(call.request.httpMethod, "DELETE")
    XCTAssertEqual(call.request.url?.absoluteString, "https://api.example.test/v1/sessions/session-1")
    XCTAssertEqual(call.request.value(forHTTPHeaderField: "Authorization"), "Bearer \(token)")
    XCTAssertTrue(socket.cancelled)
    XCTAssertNil(client.sessionId)
    XCTAssertEqual(client.connectionState, .disconnected(reason: "closed"))

    try? await Task.sleep(nanoseconds: 50_000_000)
    XCTAssertEqual(sockets.requests.count, 1)
    XCTAssertTrue(timeline.sleeps.isEmpty)
  }

  // MARK: Reconnect

  func testShortBlipReconnectsWithTheNewEpochInsideTheResumeWindow() async throws {
    let (client, socket) = try await connectedClient()
    let reconnections = Collector(client.reconnections())
    let states = Collector(client.connectionStates())
    let replacement = FakeWebSocket()
    replacement.push(json: EventJSON.ready(id: "ready-2", epoch: 2, active: false))
    sockets.enqueue(replacement)

    socket.fail()

    await waitUntil { client.lastReconnect != nil && client.connectionState == .connected }
    XCTAssertEqual(timeline.sleeps, [0.5])
    XCTAssertEqual(client.sessionEpoch, 2)
    let info = try XCTUnwrap(client.lastReconnect)
    XCTAssertEqual(info.attempt, 1)
    XCTAssertEqual(info.previousEpoch, 1)
    XCTAssertEqual(info.sessionEpoch, 2)
    XCTAssertTrue(info.isWithinAutoResumeWindow)
    XCTAssertEqual(info.gap, 0.5, accuracy: 0.001)
    XCTAssertEqual(sockets.requests.last?.value(forHTTPHeaderField: "Authorization"), "Bearer \(token)")
    await waitUntil { reconnections.values.count == 1 && states.values.contains(.reconnecting(attempt: 1)) }
    XCTAssertEqual(states.values.last, .connected)
  }

  func testLongGapReconnectIsReportedOutsideTheResumeWindow() async throws {
    let (client, socket) = try await connectedClient()
    // Each backoff wait also loses 2 s to a slow network.
    timeline.extraPerSleep = 2
    let failing = FakeWebSocket()
    failing.fail(URLError(.cannotConnectToHost))
    let late = FakeWebSocket()
    late.push(json: EventJSON.ready(id: "ready-2", epoch: 2, active: false))
    sockets.enqueue(failing)
    sockets.enqueue(late)

    socket.fail()

    // Attempt 1 fails, attempt 2 answers: (0.5 + 2) + (1 + 2) = 5.5 s.
    await waitUntil { client.lastReconnect != nil }
    let info = try XCTUnwrap(client.lastReconnect)
    XCTAssertEqual(info.attempt, 2)
    XCTAssertEqual(info.gap, 5.5, accuracy: 0.001)
    XCTAssertFalse(info.isWithinAutoResumeWindow)
    XCTAssertEqual(client.connectionState, .connected)
  }

  func testHalfOpenSocketIsDroppedAfterAMissedPongAndReconnects() async throws {
    serve()
    let halfOpen = FakeWebSocket()
    halfOpen.push(json: EventJSON.ready(id: "ready-1"))
    halfOpen.answersPings = false
    let replacement = FakeWebSocket()
    replacement.push(json: EventJSON.ready(id: "ready-2", epoch: 2, active: false))
    sockets.enqueue(halfOpen)
    sockets.enqueue(replacement)
    let client = makeClient(policy: ReconnectPolicy(retryCycleDelay: nil, openTimeout: 1, pingInterval: 0.05, pingTimeout: 0.05))
    try await client.connect()

    await waitUntil { client.lastReconnect != nil && client.connectionState == .connected }
    XCTAssertGreaterThanOrEqual(halfOpen.pings, 1)
    XCTAssertTrue(halfOpen.cancelled)
    XCTAssertEqual(client.sessionEpoch, 2)
    XCTAssertEqual(sockets.requests.count, 2)
    await waitUntil { replacement.pings >= 1 }
    XCTAssertFalse(replacement.cancelled, "a socket that answers pings stays up")
  }

  func testNativeListeningStopsOnSocketLossAndDoesNotRestartWhenTransportReturns() async throws {
    let (client, socket) = try await connectedClient()
    let streamer = AudioStreamer(channel: client, resumesAfterReconnect: false)
    var stops: [AudioStreamerStopReason] = []
    streamer.onStopped = { stops.append($0) }
    streamer.start()
    await streamer.waitUntilSent()
    socket.push(json: EventJSON.make(id: "audio-ready-1", type: "audio.ready", payload: #"{"streamGeneration":1,"encoding":"pcm_s16le","sampleRateHz":16000,"channels":1,"source":"glasses_stream_audio"}"#))
    await waitUntil { streamer.phase == .streaming(generation: 1) }

    let replacement = FakeWebSocket()
    sockets.enqueue(replacement)
    socket.fail()
    await waitUntil { streamer.phase == .stopped(.noConnection) }
    XCTAssertEqual(client.connectionState, .reconnecting(attempt: 1))
    for _ in 0..<10 { streamer.appendPCM16(Data(repeating: 0x11, count: 1_280)) }
    replacement.push(json: EventJSON.ready(id: "ready-2", epoch: 2, active: false))
    await waitUntil { client.connectionState == .connected }
    await streamer.waitUntilSent()
    XCTAssertEqual(streamer.phase, .stopped(.noConnection))
    XCTAssertEqual(stops, [.noConnection])
    XCTAssertEqual(streamer.generation, 1)
    XCTAssertTrue(replacement.sent.isEmpty, "A restored transport must send neither session.resume nor audio.start")
    await client.close()
  }

  func testReconnectGivesUpAfterThreeAttemptsWithBoundedBackoff() async throws {
    let (client, socket) = try await connectedClient()
    let states = Collector(client.connectionStates())
    // No sockets queued: every attempt fails at once.
    socket.fail()

    await waitUntil { client.connectionState == .disconnected(reason: "network_lost") }
    XCTAssertEqual(timeline.sleeps, [0.5, 1, 2])
    XCTAssertEqual(sockets.requests.count, 4)
    await waitUntil { states.values.contains(.reconnecting(attempt: 3)) }
    XCTAssertEqual(
      states.values.filter { if case .reconnecting = $0 { return true } else { return false } },
      [.reconnecting(attempt: 1), .reconnecting(attempt: 2), .reconnecting(attempt: 3)]
    )
  }

  func testNetworkRecoveryContinuesAfterABoundedRetryCycle() async throws {
    serve()
    let original = FakeWebSocket()
    original.push(json: EventJSON.ready(id: "original-ready"))
    sockets.enqueue(original)
    let fresh = FakeWebSocket()
    fresh.push(json: EventJSON.ready(id: "fresh-ready", epoch: 2, active: false))
    let factory = sockets!
    let clock = timeline!
    let client = makeClient(policy: ReconnectPolicy(retryCycleDelay: 15, openTimeout: 1), sleep: { seconds in
      if seconds == 15 { factory.enqueue(fresh) }
      try await clock.sleep(seconds)
    })
    try await client.connect()
    original.fail()
    await waitUntil { client.connectionState == .connected && client.lastReconnect != nil }
    XCTAssertEqual(timeline.sleeps, [0.5, 1, 2, 15, 0.5])
    XCTAssertEqual(sockets.requests.count, 5)
    XCTAssertTrue(fresh.sent.isEmpty)
    await client.close()
  }

  func testRepeatedForegroundRestorationKeepsAHealthySocket() async throws {
    let (client, socket) = try await connectedClient()
    try await client.resume()
    try await client.resume()
    XCTAssertEqual(sockets.requests.count, 1)
    XCTAssertFalse(socket.cancelled)
    XCTAssertEqual(client.connectionState, .connected)
    await client.close()
  }

  func testSuspendDuringRetryPreventsAnyLaterAttempt() async throws {
    serve()
    let original = FakeWebSocket()
    original.push(json: EventJSON.ready(id: "original-ready"))
    sockets.enqueue(original)
    let client = makeClient(sleep: { _ in try await Task.sleep(nanoseconds: 10_000_000_000) })
    try await client.connect()
    original.fail()
    await waitUntil { client.connectionState == .reconnecting(attempt: 1) }
    client.suspend()
    await Task.yield()
    XCTAssertEqual(sockets.requests.count, 1)
    XCTAssertEqual(client.connectionState, .disconnected(reason: "suspended"))
    await client.close()
  }

  func testExpiredRetainedSessionIsReplacedBeforeOpeningASocket() async throws {
    var creates = 0
    MockURLProtocol.handler = { request, _ in
      if request.httpMethod == "POST" {
        creates += 1
        let expiry = creates == 1 ? "2000-01-01T00:00:00Z" : "2099-01-01T00:00:00Z"
        return (201, Data("""
        {"sessionId":"session-\(creates)","token":"token-\(creates)","sessionEpoch":1,"expiresAt":"\(expiry)"}
        """.utf8))
      }
      return (204, Data())
    }
    let client = makeClient()
    try await client.createSession()
    let fresh = FakeWebSocket()
    fresh.push(json: EventJSON.ready(id: "fresh-ready", session: "session-2"))
    sockets.enqueue(fresh)
    try await client.connect()
    XCTAssertEqual(creates, 2)
    XCTAssertEqual(sockets.requests.count, 1)
    XCTAssertEqual(sockets.requests.first?.value(forHTTPHeaderField: "Authorization"), "Bearer token-2")
    await client.close()
  }

  func testRejectedStoredBearerIsReplacedWithoutAskingForTheJoinCodeAgain() async throws {
    let (client, socket) = try await connectedClient()
    let rejected = FakeWebSocket(handshakeStatusCode: 401)
    rejected.fail(URLError(.badServerResponse))
    let fresh = FakeWebSocket()
    fresh.push(json: EventJSON.ready(id: "fresh-ready"))
    sockets.enqueue(rejected)
    sockets.enqueue(fresh)
    socket.fail()
    await waitUntil { sockets.requests.count == 3 && client.connectionState == .connected }
    XCTAssertFalse(client.requiresAuthentication)
    XCTAssertEqual(MockURLProtocol.recorded.filter { $0.request.httpMethod == "POST" }.count, 2)
    await client.close()
  }

  func testExpiredSessionRenewsWithoutWaitingForTheServerToCloseTheSocket() async throws {
    let (client, socket) = try await connectedClient()
    let fresh = FakeWebSocket()
    fresh.push(json: EventJSON.ready(id: "renewed-ready"))
    sockets.enqueue(fresh)
    socket.push(json: EventJSON.ended(id: "end-1", epoch: 2, reason: "expired"))
    await waitUntil { sockets.requests.count == 2 && client.connectionState == .connected }
    XCTAssertTrue(socket.cancelled)
    XCTAssertEqual(MockURLProtocol.recorded.filter { $0.request.httpMethod == "POST" }.count, 2)
    await client.close()
  }

  func testExpiryDeadlineRenewsEvenWithoutAServerEndedEvent() async throws {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    let deadline = formatter.string(from: Date().addingTimeInterval(0.25))
    var creates = 0
    MockURLProtocol.handler = { request, _ in
      guard request.httpMethod == "POST" else { return (204, Data()) }
      creates += 1
      let expiry = creates == 1 ? deadline : "2099-01-01T00:00:00Z"
      return (201, Data("""
      {"sessionId":"session-\(creates)","token":"token-\(creates)","sessionEpoch":1,"expiresAt":"\(expiry)"}
      """.utf8))
    }
    let original = FakeWebSocket()
    original.push(json: EventJSON.ready(id: "original-ready"))
    let fresh = FakeWebSocket()
    fresh.push(json: EventJSON.ready(id: "fresh-ready", session: "session-2"))
    sockets.enqueue(original)
    sockets.enqueue(fresh)
    let client = makeClient()
    let events = Collector(client.events())
    try await client.connect()
    await waitUntil { client.sessionId == "session-2" && client.connectionState == .connected }
    XCTAssertTrue(original.cancelled)
    XCTAssertEqual(creates, 2)
    XCTAssertTrue(fresh.sent.isEmpty)
    original.push(json: EventJSON.checking(id: "stale-after-expiry"))
    await Task.yield()
    XCTAssertFalse(events.values.contains { $0.eventId == "stale-after-expiry" })
    await client.close()
  }

  func testNewlyCreatedBearerRejectionStopsWithoutCreatingRepeatedSessions() async throws {
    let (client, original) = try await connectedClient()
    for _ in 0..<2 {
      let rejected = FakeWebSocket(handshakeStatusCode: 403)
      rejected.fail(URLError(.badServerResponse))
      sockets.enqueue(rejected)
    }
    original.fail()
    await waitUntil { client.requiresAuthentication }
    XCTAssertEqual(sockets.requests.count, 3)
    XCTAssertEqual(MockURLProtocol.recorded.filter { $0.request.httpMethod == "POST" }.count, 2)
    XCTAssertNil(client.sessionId)
    let count = sockets.requests.count
    try await client.resume()
    XCTAssertEqual(sockets.requests.count, count)
    await client.close()
  }

  func testRevokedJoinCodeStopsRetriesAndForegroundResumeUntilExplicitConnect() async throws {
    let (client, socket) = try await connectedClient()
    MockURLProtocol.handler = { _, _ in (403, Data(#"{"error":"unauthorized"}"#.utf8)) }
    socket.push(json: EventJSON.ended(id: "end-1", epoch: 2, reason: "expired"))
    await waitUntil { client.requiresAuthentication }
    let requestCount = MockURLProtocol.recorded.count
    XCTAssertNil(client.sessionId)
    XCTAssertEqual(client.connectionState, .disconnected(reason: "unauthorized"))
    try await client.resume()
    await Task.yield()
    XCTAssertEqual(MockURLProtocol.recorded.count, requestCount)
    serve()
    let fresh = FakeWebSocket()
    fresh.push(json: EventJSON.ready(id: "authorized-ready"))
    sockets.enqueue(fresh)
    try await client.connect()
    XCTAssertFalse(client.requiresAuthentication)
    XCTAssertEqual(client.connectionState, .connected)
    await client.close()
  }

  func testSuspendStopsAnOpeningSocketAndResumeRetainsTheSession() async throws {
    serve()
    let waiting = FakeWebSocket()
    sockets.enqueue(waiting)
    let client = makeClient()
    let initial = Task { try await client.connect() }
    await waitUntil { waiting.resumed }
    client.suspend()
    do { try await initial.value; XCTFail("Expected cancellation") } catch { }
    XCTAssertTrue(waiting.cancelled)
    XCTAssertEqual(client.connectionState, .disconnected(reason: "suspended"))
    let restored = FakeWebSocket()
    restored.push(json: EventJSON.ready(id: "restored-ready", epoch: 2, active: false))
    sockets.enqueue(restored)
    try await client.resume()
    XCTAssertEqual(client.connectionState, .connected)
    XCTAssertEqual(MockURLProtocol.recorded.filter { $0.request.httpMethod == "POST" }.count, 1)
    XCTAssertTrue(restored.sent.isEmpty, "Transport restoration sends no audio or capture controls")
    await client.close()
  }

  func testLateCreateResponseAfterCloseCannotOverwriteANewerConnection() async throws {
    let gate = DispatchSemaphore(value: 0)
    let started = expectation(description: "old session POST started")
    let oldBody = Data(#"{"sessionId":"old-session","token":"old-token","sessionEpoch":1,"expiresAt":"2099-01-01T00:00:00Z"}"#.utf8)
    let newBody = Data(#"{"sessionId":"new-session","token":"new-token","sessionEpoch":1,"expiresAt":"2099-01-01T00:00:00Z"}"#.utf8)
    var posts = 0
    MockURLProtocol.handler = { request, _ in
      guard request.httpMethod == "POST" else { return (204, Data()) }
      posts += 1
      if posts == 1 {
        started.fulfill()
        _ = gate.wait(timeout: .now() + 2)
        return (201, oldBody)
      }
      return (201, newBody)
    }
    let client = makeClient()
    // Standalone creation is deliberately not the managed connect task; this exercises
    // the generation check even when the HTTP completion cannot be cancelled directly.
    let oldCreate = Task { try await client.createSession() }
    await fulfillment(of: [started], timeout: 1)
    await client.close()
    let fresh = FakeWebSocket()
    fresh.push(json: EventJSON.ready(id: "new-ready", session: "new-session"))
    sockets.enqueue(fresh)
    let newConnect = Task { try await client.connect() }
    gate.signal()
    do { _ = try await oldCreate.value; XCTFail("Expected stale creation to be discarded") } catch { }
    try await newConnect.value
    XCTAssertEqual(client.sessionId, "new-session")
    XCTAssertEqual(client.connectionState, .connected)
    XCTAssertFalse(client.requiresAuthentication)
    XCTAssertEqual(sockets.requests.count, 1)
    XCTAssertTrue(MockURLProtocol.recorded.contains { $0.request.httpMethod == "DELETE" && $0.request.url?.path == "/v1/sessions/old-session" })
    await client.close()
  }

  func testExplicitClosePreventsForegroundResume() async throws {
    let (client, _) = try await connectedClient()
    await client.close()
    let requests = MockURLProtocol.recorded.count
    try await client.resume()
    XCTAssertEqual(MockURLProtocol.recorded.count, requests)
    XCTAssertEqual(sockets.requests.count, 1)
    XCTAssertNil(client.sessionId)
  }

  func testCancelledInitialConnectNeverSchedulesARetry() async throws {
    serve()
    let waiting = FakeWebSocket()
    sockets.enqueue(waiting)
    let client = makeClient()
    let initial = Task { try await client.connect() }
    await waitUntil { waiting.resumed }
    initial.cancel()
    do { try await initial.value; XCTFail("Expected cancellation") } catch { }
    XCTAssertEqual(client.connectionState, .disconnected(reason: "cancelled"))
    XCTAssertTrue(timeline.sleeps.isEmpty)
    try await client.resume()
    XCTAssertEqual(sockets.requests.count, 1)
    await client.close()
  }

  func testConnectReplacesAStoredSessionTheServerNoLongerKnows() async throws {
    var created = 0
    MockURLProtocol.handler = { request, _ in
      guard request.httpMethod == "POST", request.url?.path == "/v1/sessions" else { return (204, Data()) }
      created += 1
      let body = """
      {"sessionId":"session-\(created)","token":"tok-\(created)","sessionEpoch":1,"expiresAt":"2099-11-14T10:05:00.000Z"}
      """
      return (201, Data(body.utf8))
    }
    let client = makeClient()
    try await client.createSession()
    let rejected = FakeWebSocket(handshakeStatusCode: 401)
    rejected.fail(URLError(.badServerResponse))
    let fresh = FakeWebSocket()
    fresh.push(json: EventJSON.ready(id: "ready-2", session: "session-2"))
    sockets.enqueue(rejected)
    sockets.enqueue(fresh)

    try await client.connect()

    XCTAssertEqual(client.connectionState, .connected)
    XCTAssertEqual(client.sessionId, "session-2")
    XCTAssertEqual(created, 2)
    XCTAssertEqual(sockets.requests.map { $0.value(forHTTPHeaderField: "Authorization") }, ["Bearer tok-1", "Bearer tok-2"])
    XCTAssertEqual(sockets.requests.last?.url?.path, "/v1/sessions/session-2/stream")
  }
}
