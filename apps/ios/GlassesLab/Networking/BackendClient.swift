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
  /// Wait before each attempt within a retry cycle.
  var delays: [TimeInterval] = [0.5, 1, 2]
  /// Pause between bounded retry cycles. nil disables ongoing retries (e.g. in tests).
  var retryCycleDelay: TimeInterval? = 15
  /// How long a reconnect socket may take to deliver its first event (`session.ready`).
  var openTimeout: TimeInterval = 3
  /// The same for the first connect, which may need a cold TLS handshake on a venue or
  /// cellular network.
  var initialOpenTimeout: TimeInterval = 10
  /// Legacy gap classification for diagnostics; transport recovery never authorizes capture.
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
/// After a reconnect the server has paused the session and raised the epoch: in-flight
/// checks are gone and `session.ready` arrives with `active: false`. The gap is diagnostic
/// only. Resuming recording requires a fresh user action; gap audio is never replayed.
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
final class BackendClient: SessionChannel, CheckSubmitter, OCRTargetSelecting {
  private(set) var sessionId: String?
  private(set) var sessionEpoch: Int?
  private(set) var expiresAt: String?
  private(set) var capabilities: SessionCreateResponse.Capabilities?
  private(set) var lastReconnect: ReconnectInfo?
  /// Join-code authorization failed. Foreground/network changes must not retry it.
  private(set) var requiresAuthentication = false
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
  private var desiredConnection = false
  private var suspended = false
  /// Covers HTTP creation as well as sockets; a late response cannot resurrect a session.
  private var lifecycleID = 0
  private var connectTask: Task<Void, Error>?
  private var expiryTask: Task<Void, Never>?
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
    let generation = lifecycleID
    try Task.checkCancellation()
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

    guard generation == lifecycleID, !closing, !suspended, !Task.isCancelled else {
      // The HTTP server may have committed before cancellation reached URLSession.
      await deleteOrphanSession(response)
      throw CancellationError()
    }
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
    requiresAuthentication = false
    desiredConnection = true
    suspended = false
    closing = false
    try await establishConnection()
  }

  /// Stops transport while the app is ineligible, preserving authorization and intent.
  /// Sensor lifecycle is deliberately not part of this client.
  func suspend() {
    suspended = true
    invalidatePendingConnection()
    connectionState = .disconnected(reason: "suspended")
  }

  /// Called after foreground/network restoration. Explicit disconnect and invalid join
  /// credentials remain stopped until the user chooses Connect again.
  func resume() async throws {
    guard desiredConnection, !requiresAuthentication else { return }
    guard connectionState != .connected else { return }
    suspended = false
    closing = false
    if reconnectTask != nil {
      invalidatePendingConnection()
      connectionState = .disconnected(reason: "restoring")
    }
    try await establishConnection()
  }

  private func establishConnection() async throws {
    if let connectTask { return try await connectTask.value }
    switch connectionState {
    case .connected, .reconnecting: return
    case .idle, .connecting, .disconnected: break
    }
    lifecycleID += 1
    let generation = lifecycleID
    terminalReason = nil
    connectionState = .connecting
    let task = Task { try await self.connectOnce(generation: generation, reconnectAttempt: nil) }
    connectTask = task
    do {
      try await withTaskCancellationHandler {
        try await task.value
      } onCancel: {
        task.cancel()
      }
      guard generation == lifecycleID else { throw CancellationError() }
      connectTask = nil
    } catch {
      debugLog.log("backend.connect_failed", ["reason": Self.reasonCode(for: error), "error": String(describing: error), "closing": closing])
      guard generation == lifecycleID else { throw CancellationError() }
      connectTask = nil
      if Self.isCancellation(error) {
        desiredConnection = false
        tearDownSocket(code: .goingAway)
        connectionState = .disconnected(reason: "cancelled")
      } else if Self.isAuthorizationFailure(error) {
        stopForAuthorization()
      } else {
        connectionState = .disconnected(reason: Self.reasonCode(for: error))
        scheduleReconnect(lostAt: uptime(), generation: generation)
      }
      throw error
    }
  }

  /// Replace an expired/unknown bearer once. A second rejected socket is terminal, so a
  /// revoked join code or a misconfigured server never creates an authorization storm.
  private func connectOnce(generation: Int, reconnectAttempt: (attempt: Int, lostAt: TimeInterval, previousEpoch: Int?)?) async throws {
    try checkEligible(generation)
    if sessionHasExpired { forgetSession() }
    let reused = sessionId != nil
    if !reused { try await createSession() }
    try checkEligible(generation)
    do {
      try await openStream(reconnectAttempt: reconnectAttempt)
    } catch BackendClientError.handshakeRejected(let status) where reused && (status == 401 || status == 403) {
      try checkEligible(generation)
      forgetSession()
      try await createSession()
      try checkEligible(generation)
      try await openStream(reconnectAttempt: reconnectAttempt)
    }
    try checkEligible(generation)
    scheduleExpiry(generation: generation)
  }

  /// Stops the stream at once, then deletes the session (best effort). Late HTTP and socket
  /// callbacks cannot overwrite a newer explicit connection.
  func close() async {
    desiredConnection = false
    closing = true
    suspended = false
    requiresAuthentication = false
    let id = sessionId
    let bearer = token
    invalidatePendingConnection()
    forgetSession()
    connectionState = .disconnected(reason: "closed")
    guard let id, let bearer else { return }
    await deleteSession(id: id, bearer: bearer)
  }

  private func invalidatePendingConnection() {
    lifecycleID += 1
    connectTask?.cancel()
    connectTask = nil
    reconnectTask?.cancel()
    reconnectTask = nil
    expiryTask?.cancel()
    expiryTask = nil
    tearDownSocket(code: .goingAway)
  }

  private func checkEligible(_ generation: Int) throws {
    try Task.checkCancellation()
    guard generation == lifecycleID, desiredConnection, !closing, !suspended else { throw CancellationError() }
  }

  private var sessionHasExpired: Bool {
    guard let expiresAt, let date = Self.expiryDate(expiresAt) else { return false }
    return date <= Date()
  }

  private static func expiryDate(_ value: String) -> Date? {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return formatter.date(from: value) ?? ISO8601DateFormatter().date(from: value)
  }

  private func scheduleExpiry(generation: Int) {
    expiryTask?.cancel()
    guard let expiresAt, let deadline = Self.expiryDate(expiresAt) else { return }
    let wait = max(0, deadline.timeIntervalSinceNow)
    expiryTask = Task { [weak self] in
      do { try await Task.sleep(nanoseconds: UInt64(wait * 1_000_000_000)) } catch { return }
      guard let self, generation == self.lifecycleID, !Task.isCancelled else { return }
      self.renewExpiredSession(reason: "expired")
    }
  }

  private func deleteOrphanSession(_ response: SessionCreateResponse) async {
    await deleteSession(id: response.sessionId, bearer: response.token)
  }

  private func deleteSession(id: String, bearer: String) async {
    var request = URLRequest(url: config.sessionsURL.appending(path: id), timeoutInterval: Self.httpTimeout)
    request.httpMethod = "DELETE"
    request.setValue("Bearer \(bearer)", forHTTPHeaderField: "Authorization")
    do { _ = try await perform(request, label: "session.delete") }
    catch { Self.log.error("session.delete failed \(Self.reasonCode(for: error), privacy: .public)") }
  }

  /// Mints a read-only, short-lived browser capability. The owner bearer stays native.
  func requestDisplayGrant() async throws -> DisplayGrant {
    let (id, bearer) = try sessionCredentials()
    guard connectionState == .connected, let epoch = sessionEpoch else { throw BackendClientError.notConnected }
    var request = URLRequest(url: config.sessionsURL.appending(path: id).appending(path: "display-grant"), timeoutInterval: Self.httpTimeout)
    request.httpMethod = "POST"
    request.setValue("Bearer \(bearer)", forHTTPHeaderField: "Authorization")
    let data = try await perform(request, label: "display.grant")
    guard sessionId == id, sessionEpoch == epoch, token == bearer, connectionState == .connected else {
      throw WebDisplayLinkError.staleSession
    }
    guard let grant = try? JSONDecoder().decode(DisplayGrant.self, from: data),
          grant.sessionId == id, grant.sessionEpoch == epoch else { throw BackendClientError.invalidResponse }
    _ = try WebDisplayConnection.expiry(of: grant, now: Date())
    return grant
  }

  /// Disconnects all browser readers without ending the owner/capture session.
  func revokeDisplayGrants() async throws {
    let (id, bearer) = try sessionCredentials()
    var request = URLRequest(url: config.sessionsURL.appending(path: id).appending(path: "display-grant"), timeoutInterval: Self.httpTimeout)
    request.httpMethod = "DELETE"
    request.setValue("Bearer \(bearer)", forHTTPHeaderField: "Authorization")
    _ = try await perform(request, label: "display.revoke")
  }

  // MARK: - CheckSubmitter

  /// Explicitly opted-in remote layout interpretation. The upright original JPEG and its
  /// OCR observations are transient; neither request nor response body enters DebugLog.
  func selectTarget(in input: OCRTargetInput, imageData: Data, intent: String?) async throws -> OCRTargetSelection {
    guard config.remoteOCRSelectionEnabled else { return .init(status: .unavailable, reason: "remote_selection_disabled") }
    if let reason = OCRTargetRequestLimits.failure(in: input, intent: intent) {
      return .init(status: .unavailable, reason: reason)
    }
    guard imageData.count <= OCRTargetRequestLimits.maximumImageBytes else {
      return .init(status: .unavailable, reason: "target_selection_image_too_large")
    }
    let (id, bearer) = try sessionCredentials()
    let generation = lifecycleID
    var request = URLRequest(url: config.sessionsURL.appending(path: id).appending(path: "ocr/select-target"), timeoutInterval: 20)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.setValue("Bearer \(bearer)", forHTTPHeaderField: "Authorization")
    request.httpBody = try JSONEncoder().encode(OCRSelectionRequest(
      imageBase64: imageData.base64EncodedString(), intent: intent,
      lines: input.lines.map { .init(id: $0.id, text: $0.text, confidence: $0.confidence, polygon: $0.polygon.map { [$0.x, 1 - $0.y] }) }
    ))
    let data = try await perform(request, label: "ocr.select")
    try Task.checkCancellation()
    guard lifecycleID == generation, sessionId == id, token == bearer else { throw BackendClientError.wrongSession }
    guard data.count <= 65_536,
          let wire = try? JSONDecoder().decode(OCRSelectionResponse.self, from: data) else { throw BackendClientError.invalidResponse }
    let known = Set(input.lines.map(\.id))
    let collections = [wire.selectedLineIds, wire.contextLineIds] + wire.candidates.map(\.lineIds)
    guard known.count == input.lines.count,
          collections.allSatisfy({ Set($0).count == $0.count && Set($0).isSubset(of: known) }),
          Set(wire.selectedLineIds).isDisjoint(with: wire.contextLineIds),
          Set(wire.candidates.map(\.id)).count == wire.candidates.count,
          Set(wire.candidates.flatMap(\.lineIds)).count == wire.candidates.flatMap(\.lineIds).count else { throw BackendClientError.invalidResponse }
    let status: OCRTargetSelection.Status
    if wire.status == "no_text" { status = .unreadable }
    else if let parsed = OCRTargetSelection.Status(rawValue: wire.status) { status = parsed }
    else { throw BackendClientError.invalidResponse }
    if status == .selected || status == .incomplete {
      guard !wire.selectedLineIds.isEmpty,
            let candidate = wire.candidates.first(where: { $0.id == wire.selectedCandidateId }),
            Set(candidate.lineIds) == Set(wire.selectedLineIds) else { throw BackendClientError.invalidResponse }
    } else if !wire.selectedLineIds.isEmpty { throw BackendClientError.invalidResponse }
    return .init(status: status, selectedLineIds: wire.selectedLineIds,
                 candidates: wire.candidates.map { .init(id: $0.id, role: $0.role, lineIds: $0.lineIds) }, reason: wire.reason)
  }

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
    guard id == connectionID, desiredConnection, !closing, !suspended else { return }
    tearDownSocket(code: .goingAway)
    if let terminalReason {
      renewExpiredSession(reason: terminalReason)
      return
    }
    let nsError = error as NSError
    Self.log.info("stream lost \(nsError.domain, privacy: .public) \(nsError.code)")
    debugLog.log("ws.lost", [
      "conn": id, "domain": nsError.domain, "code": nsError.code,
      "handshakeStatus": connection.handshakeStatusCode as Any,
    ])
    if let status = connection.handshakeStatusCode, status == 401 || status == 403 { forgetSession() }
    scheduleReconnect(lostAt: uptime(), generation: lifecycleID)
  }

  private func renewExpiredSession(reason: String) {
    guard desiredConnection, !closing, !suspended else { return }
    tearDownSocket(code: .goingAway)
    expiryTask?.cancel()
    expiryTask = nil
    terminalReason = nil
    forgetSession()
    connectionState = .disconnected(reason: reason)
    scheduleReconnect(lostAt: uptime(), generation: lifecycleID)
  }

  private func scheduleReconnect(lostAt: TimeInterval, generation: Int) {
    guard desiredConnection, !closing, !suspended, !requiresAuthentication, !policy.delays.isEmpty else { return }
    reconnectTask?.cancel()
    connectionState = .reconnecting(attempt: 1)
    reconnectTask = Task { [weak self] in await self?.reconnect(lostAt: lostAt, generation: generation) }
  }

  /// A small bounded burst followed by a capped quiet interval; lifecycle suspension,
  /// explicit disconnect and invalid credentials cancel the entire loop.
  private func reconnect(lostAt: TimeInterval, generation: Int) async {
    let previousEpoch = sessionEpoch
    var attempt = 0
    while true {
      for delay in policy.delays {
        attempt += 1
        do {
          try checkEligible(generation)
          connectionState = .reconnecting(attempt: attempt)
          try await sleep(max(0, delay))
          try checkEligible(generation)
          try await connectOnce(generation: generation, reconnectAttempt: (attempt, lostAt, previousEpoch))
          if generation == lifecycleID { reconnectTask = nil }
          return
        } catch {
          guard generation == lifecycleID, !Self.isCancellation(error) else { return }
          if Self.isAuthorizationFailure(error) {
            stopForAuthorization()
            return
          }
          Self.log.info("reconnect attempt=\(attempt) failed \(Self.reasonCode(for: error), privacy: .public)")
          debugLog.log("ws.reconnect_failed", ["attempt": attempt, "reason": Self.reasonCode(for: error), "error": String(describing: error)])
        }
      }
      guard generation == lifecycleID, desiredConnection, !suspended, !closing else { return }
      connectionState = .disconnected(reason: "network_lost")
      guard let cooldown = policy.retryCycleDelay, cooldown > 0, !policy.delays.isEmpty else {
        reconnectTask = nil
        return
      }
      do { try await sleep(min(60, max(1, cooldown))) } catch { return }
    }
  }

  private func stopForAuthorization() {
    reconnectTask = nil
    requiresAuthentication = true
    desiredConnection = false
    forgetSession()
    tearDownSocket(code: .goingAway)
    expiryTask?.cancel()
    expiryTask = nil
    connectionState = .disconnected(reason: "unauthorized")
  }

  private static func isCancellation(_ error: Error) -> Bool {
    error is CancellationError || (error as? URLError)?.code == .cancelled
  }

  private static func isAuthorizationFailure(_ error: Error) -> Bool {
    switch error {
    case BackendClientError.missingJoinCode: return true
    case BackendClientError.http(let status, _), BackendClientError.handshakeRejected(let status): return status == 401 || status == 403
    default: return false
    }
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
    if let terminalReason { renewExpiredSession(reason: terminalReason) }
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

  private func sessionCredentials() throws -> (String, String) {
    guard let sessionId, let token else { throw BackendClientError.noSession }
    return (sessionId, token)
  }

  /// Races the first receive against the open timeout. On timeout the caller cancels the
  /// socket, which also ends the pending receive.
  private nonisolated static func firstFrame(from connection: WebSocketConnection, timeout: TimeInterval) async throws -> WebSocketFrame {
    try await withTaskCancellationHandler {
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
    } onCancel: {
      // Unblocks receive even when task cancellation alone does not cancel the OS socket.
      connection.cancel(with: .goingAway)
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

private struct OCRSelectionRequest: Encodable {
  struct Line: Encodable { let id: String; let text: String; let confidence: Double; let polygon: [[Double]] }
  let imageBase64: String
  let intent: String?
  let lines: [Line]
}
private struct OCRSelectionResponse: Decodable {
  struct Candidate: Decodable { let id: String; let role: String; let lineIds: [String] }
  let status: String
  let selectedLineIds: [String]
  let contextLineIds: [String]
  let candidates: [Candidate]
  let selectedCandidateId: String?
  let reason: String?
}
