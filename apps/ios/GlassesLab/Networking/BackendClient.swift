import Foundation
import os

/// Errors from `BackendClient`. Every associated value is a status, a short server code or
/// a count, so the error is safe to log.
enum BackendClientError: Error, Equatable, Sendable {
  case missingJoinCode
  case sessionAlreadyExists
  case noSession
  case notConnected
  /// The envelope names a different session than the one this client holds.
  case wrongSession
  /// The envelope's epoch is not the current one; rebuild it with `sessionEpoch`.
  case staleEpoch(current: Int, envelope: Int)
  case invalidRequestId
  case invalidResponse
  /// Non-2xx HTTP answer. `code` is the server's `{ "error": ... }` value when it is a
  /// plain snake_case code.
  case http(status: Int, code: String?)
  /// The WebSocket upgrade was refused with this HTTP status.
  case handshakeRejected(status: Int)
  case connectTimeout
}

/// Backoff and resume window for stream reconnects (decision 9 in docs/live-pipeline.md).
struct ReconnectPolicy: Equatable, Sendable {
  /// Wait before each attempt. One attempt per entry, then give up.
  var delays: [TimeInterval] = [0.5, 1, 2]
  /// How long a reconnect socket may take to deliver its first event (`session.ready`).
  var openTimeout: TimeInterval = 3
  /// The same for the first connect, which may need a cold TLS handshake on a venue or
  /// cellular network.
  var initialOpenTimeout: TimeInterval = 10
  /// Gaps shorter than this may auto-resume; longer ones stop listening.
  var autoResumeWindow: TimeInterval = 5
  /// A ping goes out this often while connected; 0 turns the heartbeat off.
  var pingInterval: TimeInterval = 2
  /// A pong missing for this long means the socket is half-open: it is torn down and the
  /// normal reconnect runs.
  var pingTimeout: TimeInterval = 2.5
}

/// What happened during the last reconnect. Read it when the state returns to `.connected`
/// after `.reconnecting`, or subscribe to `reconnections()`.
///
/// After any reconnect the server has paused the session and raised the epoch: in-flight
/// checks are gone and `session.ready` arrives with `active: false`. Within the window the
/// audio layer sends `session.resume` with the new epoch and starts a new stream
/// generation; audio from the gap is discarded, never replayed.
struct ReconnectInfo: Equatable, Sendable {
  var attempt: Int
  /// Seconds from losing the socket to the first event on the new one.
  var gap: TimeInterval
  var previousEpoch: Int?
  var sessionEpoch: Int?
  var isWithinAutoResumeWindow: Bool
}

/// The app's single connection to services/api: session create, the authenticated event
/// stream, check submit and cancel, and session close.
///
/// Log hygiene: the bearer token, check text, transcripts and event payloads are never
/// logged. Logs carry ids, event types, status codes and lengths. The on-device `DebugLog`
/// is the exception: while it is on it keeps raw events and check bodies on the phone, never
/// the token or join code.
@MainActor
final class BackendClient: SessionChannel, CheckSubmitter {
  private(set) var sessionId: String?
  private(set) var sessionEpoch: Int?
  private(set) var expiresAt: String?
  private(set) var capabilities: SessionCreateResponse.Capabilities?
  private(set) var lastReconnect: ReconnectInfo?
  /// Events that arrived but could not be read: a broken envelope, or a known type whose
  /// payload does not match the contract. Counts only; the payload is never logged.
  private(set) var unreadableEventCount = 0
  /// Called on the main actor for every unreadable event, e.g. to tell the user the app and
  /// backend versions may not match. The argument is the envelope's `type` when it is a
  /// plain event name.
  var onUnreadableEvent: (@MainActor (_ type: String?) -> Void)?
  private(set) var connectionState: ChannelConnectionState = .idle {
    didSet {
      guard connectionState != oldValue else { return }
      Self.log.info("stream state \(Self.describe(self.connectionState), privacy: .public)")
      debugLog.log("ws.state", ["state": Self.describe(connectionState)])
      for continuation in stateSubscribers.values { continuation.yield(connectionState) }
    }
  }

  let config: BackendConfig
  let policy: ReconnectPolicy

  private static let log = Logger(subsystem: "com.davidvasilescu.junction.glasseslab", category: "backend")
  private static let httpTimeout: TimeInterval = 15

  private let urlSession: URLSession
  private let makeSocket: WebSocketFactory
  private let sleep: @Sendable (TimeInterval) async throws -> Void
  private let uptime: () -> TimeInterval
  private let debugLog: DebugLog

  private var token: String?
  private var filter: ServerEventFilter?
  private var socket: WebSocketConnection?
  private var socketTask: Task<Void, Never>?
  private var heartbeatTask: Task<Void, Never>?
  /// Runs apart from `socketTask`, because opening a socket tears down the old receive task.
  private var reconnectTask: Task<Void, Never>?
  /// Bumped for every socket so callbacks from a replaced socket are ignored.
  private var connectionID = 0
  private var closing = false
  /// Set by a `session.ended` that ends the session for good (deleted, expired).
  private var terminalReason: String?

  private var eventSubscribers: [UUID: AsyncStream<ServerEvent>.Continuation] = [:]
  private var stateSubscribers: [UUID: AsyncStream<ChannelConnectionState>.Continuation] = [:]
  private var reconnectSubscribers: [UUID: AsyncStream<ReconnectInfo>.Continuation] = [:]

  /// - Parameters:
  ///   - webSocketFactory: defaults to `URLSessionWebSocketTask` on `urlSession`.
  ///   - sleep: backoff wait in seconds; tests pass a recorder.
  ///   - uptime: monotonic seconds used to measure the reconnect gap.
  ///   - debugLog: receives raw events, check bodies and connection changes.
  init(
    config: BackendConfig,
    urlSession: URLSession = URLSession(configuration: .ephemeral),
    policy: ReconnectPolicy = ReconnectPolicy(),
    webSocketFactory: WebSocketFactory? = nil,
    sleep: @escaping @Sendable (TimeInterval) async throws -> Void = { try await Task.sleep(nanoseconds: UInt64($0 * 1_000_000_000)) },
    uptime: @escaping () -> TimeInterval = { ProcessInfo.processInfo.systemUptime },
    debugLog: DebugLog = .shared
  ) {
    self.config = config
    self.urlSession = urlSession
    self.policy = policy
    self.makeSocket = webSocketFactory ?? URLSessionWebSocketConnection.factory(session: urlSession)
    self.sleep = sleep
    self.uptime = uptime
    self.debugLog = debugLog
  }

  // MARK: - Subscriptions

  func connectionStates() -> AsyncStream<ChannelConnectionState> {
    let (stream, continuation) = AsyncStream<ChannelConnectionState>.makeStream(bufferingPolicy: .bufferingNewest(16))
    let id = UUID()
    stateSubscribers[id] = continuation
    continuation.yield(connectionState)
    continuation.onTermination = { [weak self] _ in
      Task { @MainActor in self?.stateSubscribers[id] = nil }
    }
    return stream
  }

  func events() -> AsyncStream<ServerEvent> {
    let (stream, continuation) = AsyncStream<ServerEvent>.makeStream(bufferingPolicy: .bufferingNewest(256))
    let id = UUID()
    eventSubscribers[id] = continuation
    continuation.onTermination = { [weak self] _ in
      Task { @MainActor in self?.eventSubscribers[id] = nil }
    }
    return stream
  }

  /// One value per successful reconnect, emitted right after the state becomes `.connected`.
  func reconnections() -> AsyncStream<ReconnectInfo> {
    let (stream, continuation) = AsyncStream<ReconnectInfo>.makeStream(bufferingPolicy: .bufferingNewest(4))
    let id = UUID()
    reconnectSubscribers[id] = continuation
    continuation.onTermination = { [weak self] _ in
      Task { @MainActor in self?.reconnectSubscribers[id] = nil }
    }
    return stream
  }

  // MARK: - Session lifecycle

  /// `POST /v1/sessions` with the configured join code. Does not open the stream.
  @discardableResult
  func createSession() async throws -> SessionCreateResponse {
    guard sessionId == nil else { throw BackendClientError.sessionAlreadyExists }
    let joinCode = config.joinCode.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !joinCode.isEmpty else { throw BackendClientError.missingJoinCode }

    var request = URLRequest(url: config.sessionsURL, timeoutInterval: Self.httpTimeout)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.httpBody = try JSONEncoder().encode(SessionCreateRequest(joinCode: joinCode))
    let data = try await perform(request, label: "session.create")

    let response: SessionCreateResponse
    do {
      response = try JSONDecoder().decode(SessionCreateResponse.self, from: data)
    } catch {
      Self.log.error("session.create undecodable response bytes=\(data.count)")
      throw BackendClientError.invalidResponse
    }
    guard WireID.isValid(response.sessionId), !response.token.isEmpty else { throw BackendClientError.invalidResponse }

    sessionId = response.sessionId
    sessionEpoch = response.sessionEpoch
    token = response.token
    expiresAt = response.expiresAt
    capabilities = response.capabilities
    filter = ServerEventFilter(sessionId: response.sessionId, epoch: response.sessionEpoch)
    lastReconnect = nil
    terminalReason = nil
    Self.log.info("session created id=\(response.sessionId, privacy: .public) epoch=\(response.sessionEpoch)")
    debugLog.log("session.created", [
      "sessionId": response.sessionId, "epoch": response.sessionEpoch, "expiresAt": response.expiresAt,
      "mode": response.capabilities?.mode as Any, "text": response.capabilities?.text as Any,
      "audio": response.capabilities?.audio as Any,
    ])
    return response
  }

  /// Creates a session if none exists, then opens `WS /v1/sessions/{id}/stream` and waits
  /// for the first event. Connect before submitting text: the server does not replay.
  ///
  /// A stored session that the server rejects (expired after its 5 minute lifetime, deleted,
  /// or lost in a server restart) is replaced by a new one, so read `sessionId` and
  /// `sessionEpoch` again after connecting.
  func connect() async throws {
    switch connectionState {
    case .connecting, .connected, .reconnecting: return
    case .idle, .disconnected: break
    }
    closing = false
    terminalReason = nil
    connectionState = .connecting
    do {
      let reusingSession = sessionId != nil
      if !reusingSession { try await createSession() }
      try await deleteSessionIfClosing()
      do {
        try await openStream(reconnectAttempt: nil)
      } catch BackendClientError.handshakeRejected(let status) where reusingSession && (status == 401 || status == 403) {
        Self.log.info("stored session rejected status=\(status), creating a new one")
        forgetSession()
        try await createSession()
        try await deleteSessionIfClosing()
        try await openStream(reconnectAttempt: nil)
      }
    } catch {
      debugLog.log("backend.connect_failed", ["reason": Self.reasonCode(for: error), "error": String(describing: error), "closing": closing])
      if !closing { connectionState = .disconnected(reason: Self.reasonCode(for: error)) }
      throw error
    }
  }

  /// Stops the stream at once, then deletes the session (best effort). Late events are
  /// suppressed because the socket is gone before the DELETE goes out.
  func close() async {
    closing = true
    reconnectTask?.cancel()
    reconnectTask = nil
    let id = sessionId
    let bearer = token
    tearDownSocket(code: .normalClosure)
    forgetSession()
    connectionState = .disconnected(reason: "closed")

    guard let id, let bearer else { return }
    var request = URLRequest(url: config.sessionsURL.appending(path: id), timeoutInterval: Self.httpTimeout)
    request.httpMethod = "DELETE"
    request.setValue("Bearer \(bearer)", forHTTPHeaderField: "Authorization")
    do {
      _ = try await perform(request, label: "session.delete")
    } catch {
      Self.log.error("session.delete failed \(Self.reasonCode(for: error), privacy: .public)")
    }
  }

  // MARK: - CheckSubmitter

  /// `POST /v1/sessions/{id}/checks`. Returns once the server accepts (202).
  func submit(_ input: TextInputEnvelope) async throws {
    let (id, bearer) = try sessionCredentials()
    guard input.sessionId == id else { throw BackendClientError.wrongSession }
    if let sessionEpoch, input.sessionEpoch != sessionEpoch {
      throw BackendClientError.staleEpoch(current: sessionEpoch, envelope: input.sessionEpoch)
    }
    try input.validate()
    guard connectionState == .connected else { throw BackendClientError.notConnected }

    var request = URLRequest(url: config.checksURL(sessionId: id), timeoutInterval: Self.httpTimeout)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.setValue("Bearer \(bearer)", forHTTPHeaderField: "Authorization")
    request.httpBody = try JSONEncoder().encode(input)
    _ = try await perform(request, label: "check.submit", logBody: true)
    Self.log.info(
      "check accepted req=\(input.requestId, privacy: .public) rev=\(input.revision) mode=\(input.mode.rawValue, privacy: .public) codePoints=\(CodePoints.count(input.text))"
    )
  }

  /// `POST /v1/sessions/{id}/checks/{requestId}/cancel`. Idempotent; no late result follows.
  func cancel(requestId: String) async throws {
    let (id, bearer) = try sessionCredentials()
    guard WireID.isValid(requestId) else { throw BackendClientError.invalidRequestId }
    let url = config.checksURL(sessionId: id).appending(path: requestId).appending(path: "cancel")
    var request = URLRequest(url: url, timeoutInterval: Self.httpTimeout)
    request.httpMethod = "POST"
    request.setValue("Bearer \(bearer)", forHTTPHeaderField: "Authorization")
    _ = try await perform(request, label: "check.cancel")
  }

  // MARK: - SessionChannel sends

  func sendControl<Message: Encodable & Sendable>(_ message: Message) async throws {
    guard connectionState == .connected, let socket else { throw BackendClientError.notConnected }
    let data = try JSONEncoder().encode(message)
    guard let text = String(data: data, encoding: .utf8) else { throw BackendClientError.invalidResponse }
    debugLog.logJSONText("ws.send", text, ["conn": connectionID])
    try await socket.send(.text(text))
  }

  func sendBinary(_ data: Data) async throws {
    guard connectionState == .connected, let socket else { throw BackendClientError.notConnected }
    try await socket.send(.binary(data))
  }

  // MARK: - Stream internals

  /// Opens a socket and waits for its first event. Updates the epoch from that event
  /// before announcing `.connected`, so subscribers read the new epoch on reconnect.
  private func openStream(reconnectAttempt: (attempt: Int, lostAt: TimeInterval, previousEpoch: Int?)?) async throws {
    let (id, bearer) = try sessionCredentials()
    guard let url = config.streamURL(sessionId: id) else { throw BackendClientError.noSession }
    let openTimeout = reconnectAttempt == nil ? policy.initialOpenTimeout : policy.openTimeout
    var request = URLRequest(url: url, timeoutInterval: openTimeout)
    request.setValue("Bearer \(bearer)", forHTTPHeaderField: "Authorization")

    tearDownSocket(code: .goingAway)
    connectionID += 1
    let current = connectionID
    let connection = makeSocket(request)
    socket = connection
    connection.resume()

    let first: WebSocketFrame
    do {
      first = try await Self.firstFrame(from: connection, timeout: openTimeout)
    } catch {
      connection.cancel(with: .goingAway)
      if current == connectionID { socket = nil }
      if let status = connection.handshakeStatusCode { throw BackendClientError.handshakeRejected(status: status) }
      throw error
    }
    guard current == connectionID, !closing else {
      connection.cancel(with: .goingAway)
      throw CancellationError()
    }

    debugReceived(first, connection: current)
    let firstEvent = decode(first)
    let decision = firstEvent.map { filter?.accept($0) ?? .drop(.otherSession) }
    sessionEpoch = filter?.epoch ?? sessionEpoch

    var info: ReconnectInfo?
    if let reconnectAttempt {
      let gap = max(0, uptime() - reconnectAttempt.lostAt)
      info = ReconnectInfo(
        attempt: reconnectAttempt.attempt,
        gap: gap,
        previousEpoch: reconnectAttempt.previousEpoch,
        sessionEpoch: sessionEpoch,
        isWithinAutoResumeWindow: gap < policy.autoResumeWindow
      )
      lastReconnect = info
    }
    connectionState = .connected
    if let info {
      Self.log.info("stream reconnected attempt=\(info.attempt) gapMs=\(Int(info.gap * 1000)) resumable=\(info.isWithinAutoResumeWindow)")
      debugLog.log("ws.reconnected", [
        "attempt": info.attempt, "gapMs": Int(info.gap * 1000), "previousEpoch": info.previousEpoch as Any,
        "epoch": info.sessionEpoch as Any, "resumable": info.isWithinAutoResumeWindow,
      ])
      for continuation in reconnectSubscribers.values { continuation.yield(info) }
    }
    if let firstEvent, let decision { deliver(firstEvent, decision) }
    startReceiving(on: connection, id: current)
    startHeartbeat(on: connection, id: current)
  }

  private func startReceiving(on connection: WebSocketConnection, id: Int) {
    socketTask = Task { [weak self] in
      while true {
        let frame: WebSocketFrame
        do {
          frame = try await connection.receive()
        } catch {
          self?.socketEnded(connection: connection, id: id, error: error)
          return
        }
        guard let self, self.connectionID == id, !self.closing else { return }
        self.debugReceived(frame, connection: id)
        self.handle(frame)
      }
    }
  }

  /// Pings the server while the socket is current. A missing pong cancels the socket, so the
  /// receive loop reports the loss and the normal reconnect runs (decision 9). Without it a
  /// half-open mobile connection stays `.connected` while sends pile up.
  private func startHeartbeat(on connection: WebSocketConnection, id: Int) {
    heartbeatTask?.cancel()
    heartbeatTask = nil
    let interval = policy.pingInterval
    let timeout = policy.pingTimeout
    guard interval > 0 else { return }
    heartbeatTask = Task { [weak self] in
      while !Task.isCancelled {
        try? await Task.sleep(nanoseconds: UInt64(interval * 1_000_000_000))
        guard !Task.isCancelled, let current = self, current.connectionID == id, !current.closing else { return }
        do {
          try await connection.sendPing(timeout: timeout)
        } catch {
          guard !Task.isCancelled, let current = self, current.connectionID == id, !current.closing else { return }
          Self.log.info("stream ping failed, dropping the socket")
          current.debugLog.log("ws.ping_failed", ["conn": id, "error": String(describing: error)])
          connection.cancel(with: .goingAway)
          return
        }
      }
    }
  }

  private func socketEnded(connection: WebSocketConnection, id: Int, error: Error) {
    guard id == connectionID, !closing else { return }
    socket = nil
    heartbeatTask?.cancel()
    heartbeatTask = nil
    // The session is over on the server; the next connect() creates a new one.
    if let terminalReason {
      forgetSession()
      connectionState = .disconnected(reason: terminalReason)
      return
    }
    if connection.handshakeStatusCode == 401 {
      forgetSession()
      connectionState = .disconnected(reason: "unauthorized")
      return
    }
    let nsError = error as NSError
    Self.log.info("stream lost \(nsError.domain, privacy: .public) \(nsError.code)")
    debugLog.log("ws.lost", [
      "conn": id, "domain": nsError.domain, "code": nsError.code,
      "handshakeStatus": connection.handshakeStatusCode as Any,
    ])
    let lostAt = uptime()
    // Leave `.connected` now, not when the reconnect task first runs: senders must see the
    // loss at once instead of failing against a nil socket while the state still says connected.
    connectionState = .reconnecting(attempt: 1)
    reconnectTask?.cancel()
    reconnectTask = Task { [weak self] in await self?.reconnect(lostAt: lostAt) }
  }

  /// Bounded backoff. Gives up after the last delay with `disconnected(network_lost)`.
  private func reconnect(lostAt: TimeInterval) async {
    let previousEpoch = sessionEpoch
    for (index, delay) in policy.delays.enumerated() {
      let attempt = index + 1
      guard !closing else { return }
      guard sessionId != nil else {
        connectionState = .disconnected(reason: "no_session")
        return
      }
      connectionState = .reconnecting(attempt: attempt)
      do {
        try await sleep(delay)
      } catch {
        return
      }
      guard !closing else { return }
      do {
        try await openStream(reconnectAttempt: (attempt, lostAt, previousEpoch))
        return
      } catch BackendClientError.handshakeRejected(let status) where status == 401 || status == 403 {
        forgetSession()
        connectionState = .disconnected(reason: "unauthorized")
        return
      } catch is CancellationError {
        return
      } catch {
        Self.log.info("reconnect attempt=\(attempt) failed \(Self.reasonCode(for: error), privacy: .public)")
        debugLog.log("ws.reconnect_failed", ["attempt": attempt, "reason": Self.reasonCode(for: error), "error": String(describing: error)])
      }
    }
    guard !closing else { return }
    connectionState = .disconnected(reason: "network_lost")
  }

  private func handle(_ frame: WebSocketFrame) {
    guard let event = decode(frame), let decision = filter?.accept(event) else { return }
    sessionEpoch = filter?.epoch ?? sessionEpoch
    deliver(event, decision)
  }

  private func decode(_ frame: WebSocketFrame) -> ServerEvent? {
    switch frame {
    case .binary(let data):
      Self.log.debug("ignored binary frame bytes=\(data.count)")
      return nil
    case .text(let text):
      do {
        return try ServerEvent.decode(from: Data(text.utf8))
      } catch {
        let type = Self.envelopeType(in: Data(text.utf8))
        Self.log.error("undecodable event envelope type=\(type ?? "-", privacy: .public) bytes=\(text.utf8.count)")
        debugLog.log("ws.unreadable", ["type": type as Any, "bytes": text.utf8.count, "error": String(describing: error)])
        reportUnreadable(type: type)
        return nil
      }
    }
  }

  private func reportUnreadable(type: String?) {
    unreadableEventCount += 1
    onUnreadableEvent?(type)
  }

  /// The envelope's `type` when it is a plain event name such as "claim.result". Anything
  /// else is dropped so no payload text reaches the logs.
  static func envelopeType(in data: Data) -> String? {
    struct Envelope: Decodable { var type: String? }
    guard let type = (try? JSONDecoder().decode(Envelope.self, from: data))?.type,
          (1...64).contains(type.count),
          type.allSatisfy({ $0.isASCII && ($0.isLowercase || $0.isNumber || $0 == "_" || $0 == ".") })
    else { return nil }
    return type
  }

  private func deliver(_ event: ServerEvent, _ decision: ServerEventFilter.Decision) {
    if case .drop(let reason) = decision {
      debugLog.log("ws.drop", [
        "reason": reason.rawValue, "type": event.type.rawValue, "eventId": event.eventId,
        "epoch": event.sessionEpoch, "filterEpoch": filter?.epoch as Any,
        "requestId": event.requestId as Any, "revision": event.revision as Any,
      ])
    }
    switch decision {
    case .drop(.malformedPayload):
      Self.log.error("dropped \(event.logSummary, privacy: .public) reason=malformed_payload")
      reportUnreadable(type: event.type.rawValue)
      return
    case .drop(let reason):
      Self.log.debug("dropped \(event.logSummary, privacy: .public) reason=\(reason.rawValue, privacy: .public)")
      return
    case .deliver:
      Self.log.debug("event \(event.logSummary, privacy: .public)")
    }
    if case .sessionEnded(let payload) = event.payload, ["deleted", "expired"].contains(payload.reasonCode) {
      terminalReason = payload.reasonCode
    }
    for continuation in eventSubscribers.values { continuation.yield(event) }
  }

  private func tearDownSocket(code: URLSessionWebSocketTask.CloseCode) {
    connectionID += 1
    socketTask?.cancel()
    socketTask = nil
    heartbeatTask?.cancel()
    heartbeatTask = nil
    socket?.cancel(with: code)
    socket = nil
  }

  /// Drops the local session so the next `connect()` creates a new one.
  private func forgetSession() {
    sessionId = nil
    sessionEpoch = nil
    token = nil
    expiresAt = nil
    capabilities = nil
    filter = nil
  }

  /// close() ran while a session was being created: delete it instead of leaking it.
  private func deleteSessionIfClosing() async throws {
    guard closing else { return }
    await close()
    throw CancellationError()
  }

  private func sessionCredentials() throws -> (String, String) {
    guard let sessionId, let token else { throw BackendClientError.noSession }
    return (sessionId, token)
  }

  /// Races the first receive against the open timeout. On timeout the caller cancels the
  /// socket, which also ends the pending receive.
  private nonisolated static func firstFrame(from connection: WebSocketConnection, timeout: TimeInterval) async throws -> WebSocketFrame {
    try await withThrowingTaskGroup(of: WebSocketFrame?.self) { group in
      group.addTask { try await connection.receive() }
      group.addTask {
        try await Task.sleep(nanoseconds: UInt64(max(0, timeout) * 1_000_000_000))
        return nil
      }
      defer { group.cancelAll() }
      guard let first = try await group.next(), let frame = first else {
        connection.cancel(with: .goingAway)
        throw BackendClientError.connectTimeout
      }
      return frame
    }
  }

  // MARK: - HTTP

  /// - Parameter logBody: copy the request body into the debug log. Only for check bodies:
  ///   the session-create body holds the join code.
  private func perform(_ request: URLRequest, label: String, logBody: Bool = false) async throws -> Data {
    let started = ProcessInfo.processInfo.systemUptime
    debugRequest(request, label: label, logBody: logBody)
    let data: Data
    let response: URLResponse
    do {
      (data, response) = try await urlSession.data(for: request)
    } catch {
      debugLog.log("http.error", ["label": label, "error": String(describing: error), "ms": Self.elapsedMs(since: started)])
      throw error
    }
    guard let http = response as? HTTPURLResponse else {
      debugLog.log("http.error", ["label": label, "error": "not_http", "ms": Self.elapsedMs(since: started)])
      throw BackendClientError.invalidResponse
    }
    guard (200..<300).contains(http.statusCode) else {
      let code = Self.serverErrorCode(from: data)
      Self.log.error("\(label, privacy: .public) status=\(http.statusCode) code=\(code ?? "-", privacy: .public)")
      debugLog.log("http.response", ["label": label, "status": http.statusCode, "code": code as Any, "ms": Self.elapsedMs(since: started)])
      throw BackendClientError.http(status: http.statusCode, code: code)
    }
    Self.log.debug("\(label, privacy: .public) status=\(http.statusCode)")
    debugLog.log("http.response", ["label": label, "status": http.statusCode, "ms": Self.elapsedMs(since: started)])
    return data
  }

  // MARK: - Debug log

  /// Method, path and headers (the debug log redacts `Authorization`), plus the body when asked.
  private func debugRequest(_ request: URLRequest, label: String, logBody: Bool) {
    guard debugLog.isEnabled else { return }
    let payload: [String: Any] = [
      "label": label, "method": request.httpMethod ?? "GET", "path": request.url?.path ?? "",
      "headers": request.allHTTPHeaderFields ?? [:],
    ]
    if logBody, let body = request.httpBody {
      debugLog.log("http.request", payload, jsonBody: body)
    } else {
      debugLog.log("http.request", payload)
    }
  }

  /// Every frame as received, before decoding or filtering. Binary frames from the server are
  /// counted, not stored.
  private func debugReceived(_ frame: WebSocketFrame, connection: Int) {
    guard debugLog.isEnabled else { return }
    switch frame {
    case .text(let text): debugLog.logJSONText("ws.recv", text, ["conn": connection])
    case .binary(let data): debugLog.log("ws.recv_binary", ["conn": connection, "bytes": data.count])
    }
  }

  private static func elapsedMs(since start: TimeInterval) -> Int {
    Int((ProcessInfo.processInfo.systemUptime - start) * 1000)
  }

  /// Reads `{ "error": "queue_full" }`. Anything that is not a short snake_case code is
  /// dropped so free text from a proxy never reaches the logs.
  static func serverErrorCode(from data: Data) -> String? {
    struct Body: Decodable { var error: String? }
    guard let code = (try? JSONDecoder().decode(Body.self, from: data))?.error,
          (1...64).contains(code.count),
          code.allSatisfy({ $0.isASCII && ($0.isLowercase || $0.isNumber || $0 == "_") })
    else { return nil }
    return code
  }

  /// Short, log-safe reason for `disconnected(reason:)`.
  static func reasonCode(for error: Error) -> String {
    switch error {
    case BackendClientError.missingJoinCode: return "missing_join_code"
    case BackendClientError.handshakeRejected(let status) where status == 401 || status == 403: return "unauthorized"
    case BackendClientError.handshakeRejected: return "handshake_rejected"
    case BackendClientError.http(let status, let code): return code ?? "http_\(status)"
    case BackendClientError.connectTimeout: return "connect_timeout"
    case BackendClientError.invalidResponse: return "invalid_response"
    case BackendClientError.noSession: return "no_session"
    case is CancellationError: return "cancelled"
    case let error as URLError where error.code == .notConnectedToInternet || error.code == .networkConnectionLost: return "network_lost"
    case let error as URLError where error.code == .timedOut: return "timed_out"
    default: return "connect_failed"
    }
  }

  private static func describe(_ state: ChannelConnectionState) -> String {
    switch state {
    case .idle: return "idle"
    case .connecting: return "connecting"
    case .connected: return "connected"
    case .reconnecting(let attempt): return "reconnecting(\(attempt))"
    case .disconnected(let reason): return "disconnected(\(reason))"
    }
  }
}
