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

  private func makeClient(joinCode: String = "demo-join", policy: ReconnectPolicy = ReconnectPolicy(openTimeout: 1)) -> BackendClient {
    let timeline = timeline!
    return BackendClient(
      config: BackendConfig(baseURL: URL(string: "https://api.example.test")!, joinCode: joinCode),
      urlSession: MockURLProtocol.session(),
      policy: policy,
      webSocketFactory: sockets.factory,
      sleep: timeline.sleep,
      uptime: { timeline.now }
    )
  }

  private func sessionCreatedBody(epoch: Int = 1) -> Data {
    Data("""
    {"schemaVersion":1,"sessionId":"session-1","token":"\(token)","sessionEpoch":\(epoch),"expiresAt":"2026-11-14T10:05:00.000Z",
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

  func testCreateSessionPostsJoinCodeAndStoresTheSession() async throws {
    serve()
    let client = makeClient(joinCode: "  demo-join \n")
    let response = try await client.createSession()

    XCTAssertEqual(client.sessionId, "session-1")
    XCTAssertEqual(client.sessionEpoch, 1)
    XCTAssertEqual(client.expiresAt, "2026-11-14T10:05:00.000Z")
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
    let client = makeClient(policy: ReconnectPolicy(openTimeout: 0.05, initialOpenTimeout: 0.05))
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
    let client = makeClient(policy: ReconnectPolicy(openTimeout: 0.05, initialOpenTimeout: 1))
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
    let client = makeClient(policy: ReconnectPolicy(openTimeout: 1, pingInterval: 0.05, pingTimeout: 0.05))
    try await client.connect()

    await waitUntil { client.lastReconnect != nil && client.connectionState == .connected }
    XCTAssertGreaterThanOrEqual(halfOpen.pings, 1)
    XCTAssertTrue(halfOpen.cancelled)
    XCTAssertEqual(client.sessionEpoch, 2)
    XCTAssertEqual(sockets.requests.count, 2)
    await waitUntil { replacement.pings >= 1 }
    XCTAssertFalse(replacement.cancelled, "a socket that answers pings stays up")
  }

  func testDroppedSocketMovesListeningToReconnectingAndResumesWithoutARestart() async throws {
    let (client, socket) = try await connectedClient()
    let streamer = AudioStreamer(channel: client)
    var stops: [AudioStreamerStopReason] = []
    streamer.onStopped = { stops.append($0) }
    streamer.start()
    await streamer.waitUntilSent()
    socket.push(json: EventJSON.make(id: "audio-ready-1", type: "audio.ready", payload: #"{"streamGeneration":1,"encoding":"pcm_s16le","sampleRateHz":16000,"channels":1,"source":"glasses_stream_audio"}"#))
    await waitUntil { streamer.phase == .streaming(generation: 1) }

    let replacement = FakeWebSocket()
    sockets.enqueue(replacement)
    socket.fail()
    // Frames sent while the socket is gone fail; that is a connection loss, not an audio fault.
    for _ in 0..<10 { streamer.appendPCM16(Data(repeating: 0x11, count: 1_280)) }
    await waitUntil { streamer.phase == .reconnecting }
    XCTAssertEqual(client.connectionState, .reconnecting(attempt: 1))

    replacement.push(json: EventJSON.ready(id: "ready-2", epoch: 2, active: false))
    await waitUntil { streamer.phase == .awaitingReady(generation: 2) }
    await streamer.waitUntilSent()
    let types = replacement.sent.compactMap { frame -> String? in
      guard case .text(let text) = frame else { return nil }
      return (try? JSONSerialization.jsonObject(with: Data(text.utf8)) as? [String: Any])?["type"] as? String
    }
    XCTAssertEqual(types, ["session.resume", "audio.start"])
    XCTAssertTrue(stops.isEmpty)
    XCTAssertEqual(streamer.generation, 2, "the dead socket cost no restarts")
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

  func testReconnectStopsWhenTheTokenIsRejected() async throws {
    let (client, socket) = try await connectedClient()
    let rejected = FakeWebSocket(handshakeStatusCode: 401)
    rejected.fail(URLError(.badServerResponse))
    sockets.enqueue(rejected)

    socket.fail()

    await waitUntil { client.connectionState == .disconnected(reason: "unauthorized") }
    XCTAssertEqual(timeline.sleeps, [0.5])
    XCTAssertNil(client.sessionId, "A rejected session is forgotten so the next connect starts fresh")
  }

  func testTerminalSessionEndDoesNotReconnect() async throws {
    let (client, socket) = try await connectedClient()
    socket.push(json: EventJSON.ended(id: "end-1", epoch: 2, reason: "expired"))
    socket.fail(URLError(.cancelled))

    await waitUntil { client.connectionState == .disconnected(reason: "expired") }
    XCTAssertTrue(timeline.sleeps.isEmpty)
    XCTAssertEqual(sockets.requests.count, 1)
    XCTAssertNil(client.sessionId)
  }

  func testConnectReplacesAStoredSessionTheServerNoLongerKnows() async throws {
    var created = 0
    MockURLProtocol.handler = { request, _ in
      guard request.httpMethod == "POST", request.url?.path == "/v1/sessions" else { return (204, Data()) }
      created += 1
      let body = """
      {"sessionId":"session-\(created)","token":"tok-\(created)","sessionEpoch":1,"expiresAt":"2026-11-14T10:05:00.000Z"}
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
