import Foundation
import XCTest
@testable import GlassesLab

// MARK: - HTTP

/// Serves canned HTTP answers to a URLSession built with `MockURLProtocol.session()`.
/// Tests run serially (parallel testing is off), so static state is fine.
final class MockURLProtocol: URLProtocol {
  struct Recorded {
    var request: URLRequest
    var body: Data
  }

  nonisolated(unsafe) static var handler: ((URLRequest, Data) throws -> (Int, Data))?
  nonisolated(unsafe) static var recorded: [Recorded] = []

  static func reset() {
    handler = nil
    recorded = []
  }

  static func session() -> URLSession {
    let configuration = URLSessionConfiguration.ephemeral
    configuration.protocolClasses = [MockURLProtocol.self]
    return URLSession(configuration: configuration)
  }

  override class func canInit(with request: URLRequest) -> Bool { true }
  override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

  override func startLoading() {
    let body = Self.readBody(of: request)
    Self.recorded.append(Recorded(request: request, body: body))
    guard let handler = Self.handler else {
      client?.urlProtocol(self, didFailWithError: URLError(.badServerResponse))
      return
    }
    do {
      let (status, data) = try handler(request, body)
      let response = HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: "HTTP/1.1", headerFields: ["Content-Type": "application/json"])!
      client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
      client?.urlProtocol(self, didLoad: data)
      client?.urlProtocolDidFinishLoading(self)
    } catch {
      client?.urlProtocol(self, didFailWithError: error)
    }
  }

  override func stopLoading() {}

  /// URLSession moves `httpBody` into a stream before it reaches a protocol.
  private static func readBody(of request: URLRequest) -> Data {
    if let body = request.httpBody { return body }
    guard let stream = request.httpBodyStream else { return Data() }
    stream.open()
    defer { stream.close() }
    var data = Data()
    var buffer = [UInt8](repeating: 0, count: 4096)
    while stream.hasBytesAvailable {
      let read = stream.read(&buffer, maxLength: buffer.count)
      if read <= 0 { break }
      data.append(buffer, count: read)
    }
    return data
  }
}

// MARK: - Secrets

/// In-memory stand-in for the Keychain.
final class MemorySecretStore: SecretStoring, @unchecked Sendable {
  private let lock = NSLock()
  private var values: [String: String] = [:]

  func read(_ key: String) -> String? { lock.withLock { values[key] } }

  func write(_ value: String?, for key: String) {
    lock.withLock { values[key] = (value?.isEmpty ?? true) ? nil : value }
  }
}

// MARK: - WebSocket

/// In-memory socket. Push frames or failures; a pending `receive()` resumes in order.
final class FakeWebSocket: WebSocketConnection, @unchecked Sendable {
  private let lock = NSLock()
  private var inbox: [Result<WebSocketFrame, Error>] = []
  private var waiter: CheckedContinuation<WebSocketFrame, Error>?
  private var _sent: [WebSocketFrame] = []
  private var _cancelled = false
  private var _resumed = false
  private var _pings = 0
  private var _answersPings = true
  let handshakeStatusCode: Int?

  init(handshakeStatusCode: Int? = nil) {
    self.handshakeStatusCode = handshakeStatusCode
  }

  var sent: [WebSocketFrame] { lock.withLock { _sent } }
  var cancelled: Bool { lock.withLock { _cancelled } }
  var resumed: Bool { lock.withLock { _resumed } }
  var pings: Int { lock.withLock { _pings } }
  /// False makes the socket half-open: pings time out.
  var answersPings: Bool {
    get { lock.withLock { _answersPings } }
    set { lock.withLock { _answersPings = newValue } }
  }

  func push(_ frame: WebSocketFrame) { deliver(.success(frame)) }
  func push(json: String) { push(.text(json)) }
  func fail(_ error: Error = URLError(.networkConnectionLost)) { deliver(.failure(error)) }

  private func deliver(_ result: Result<WebSocketFrame, Error>) {
    lock.lock()
    if let waiter {
      self.waiter = nil
      lock.unlock()
      waiter.resume(with: result)
    } else {
      inbox.append(result)
      lock.unlock()
    }
  }

  func resume() { lock.withLock { _resumed = true } }

  func send(_ frame: WebSocketFrame) async throws {
    try lock.withLock {
      if _cancelled { throw URLError(.cancelled) }
      _sent.append(frame)
    }
  }

  func receive() async throws -> WebSocketFrame {
    try await withCheckedThrowingContinuation { continuation in
      lock.lock()
      if !inbox.isEmpty {
        let next = inbox.removeFirst()
        lock.unlock()
        continuation.resume(with: next)
      } else if _cancelled {
        lock.unlock()
        continuation.resume(throwing: URLError(.cancelled))
      } else {
        waiter = continuation
        lock.unlock()
      }
    }
  }

  func sendPing(timeout: TimeInterval) async throws {
    let answers = lock.withLock { () -> Bool in
      _pings += 1
      return _answersPings && !_cancelled
    }
    guard !answers else { return }
    try await Task.sleep(nanoseconds: UInt64(timeout * 1_000_000_000))
    throw URLError(.timedOut)
  }

  func cancel(with code: URLSessionWebSocketTask.CloseCode) {
    lock.lock()
    _cancelled = true
    let pending = waiter
    waiter = nil
    lock.unlock()
    pending?.resume(throwing: URLError(.cancelled))
  }
}

/// Hands out queued sockets in order and records every upgrade request.
final class FakeSocketFactory: @unchecked Sendable {
  private let lock = NSLock()
  private var queued: [FakeWebSocket] = []
  private var _requests: [URLRequest] = []
  private var _made: [FakeWebSocket] = []

  func enqueue(_ socket: FakeWebSocket) { lock.withLock { queued.append(socket) } }
  var requests: [URLRequest] { lock.withLock { _requests } }
  var made: [FakeWebSocket] { lock.withLock { _made } }

  var factory: WebSocketFactory {
    { [self] request in
      lock.withLock {
        _requests.append(request)
        // With nothing queued, a socket that fails at once (no server).
        let socket: FakeWebSocket
        if queued.isEmpty {
          socket = FakeWebSocket()
          socket.fail(URLError(.cannotConnectToHost))
        } else {
          socket = queued.removeFirst()
        }
        _made.append(socket)
        return socket
      }
    }
  }
}

/// Monotonic clock plus a backoff recorder. Each recorded sleep advances the clock.
final class FakeTimeline: @unchecked Sendable {
  private let lock = NSLock()
  private var _now: TimeInterval = 1_000
  private var _sleeps: [TimeInterval] = []
  /// Extra seconds added to each sleep, to simulate a slow network.
  var extraPerSleep: TimeInterval = 0

  var now: TimeInterval { lock.withLock { _now } }
  var sleeps: [TimeInterval] { lock.withLock { _sleeps } }

  func advance(_ seconds: TimeInterval) { lock.withLock { _now += seconds } }

  var sleep: @Sendable (TimeInterval) async throws -> Void {
    { [self] seconds in
      lock.withLock {
        _sleeps.append(seconds)
        _now += seconds + extraPerSleep
      }
      try Task.checkCancellation()
      await Task.yield()
    }
  }
}

// MARK: - Event JSON

enum EventJSON {
  static func make(
    id: String,
    seq: Int = 1,
    session: String = "session-1",
    epoch: Int = 1,
    type: String,
    requestId: String? = nil,
    claimId: String? = nil,
    revision: Int? = nil,
    payload: String
  ) -> String {
    var fields = [
      "\"schemaVersion\":1",
      "\"eventId\":\"\(id)\"",
      "\"eventSeq\":\(seq)",
      "\"sessionId\":\"\(session)\"",
      "\"sessionEpoch\":\(epoch)",
      "\"type\":\"\(type)\"",
      "\"serverAt\":\"2026-11-14T10:00:00Z\"",
      "\"payload\":\(payload)",
    ]
    if let requestId { fields.append("\"requestId\":\"\(requestId)\"") }
    if let claimId { fields.append("\"claimId\":\"\(claimId)\"") }
    if let revision { fields.append("\"revision\":\(revision)") }
    return "{\(fields.joined(separator: ","))}"
  }

  static func ready(id: String, epoch: Int = 1, active: Bool = true, session: String = "session-1") -> String {
    make(id: id, session: session, epoch: epoch, type: "session.ready", payload: "{\"active\":\(active),\"expiresAt\":\"2026-11-14T10:05:00Z\",\"mode\":\"fixture\",\"audio\":true}")
  }

  static func checking(id: String, epoch: Int = 1, requestId: String = "req-1", claimId: String = "req-1-c1", revision: Int = 1) -> String {
    make(id: id, epoch: epoch, type: "claim.checking", requestId: requestId, claimId: claimId, revision: revision,
         payload: "{\"admissionAction\":\"check\",\"reasonCode\":\"eligible_public_claim\"}")
  }

  static func ended(id: String, epoch: Int = 2, reason: String) -> String {
    make(id: id, epoch: epoch, type: "session.ended", payload: "{\"reasonCode\":\"\(reason)\",\"active\":false}")
  }
}

// MARK: - Async helpers

@MainActor
func waitUntil(timeout: TimeInterval = 2, file: StaticString = #filePath, line: UInt = #line, _ condition: () -> Bool) async {
  let deadline = Date().addingTimeInterval(timeout)
  while !condition() {
    if Date() > deadline {
      XCTFail("Timed out waiting for condition", file: file, line: line)
      return
    }
    try? await Task.sleep(nanoseconds: 5_000_000)
  }
}

/// Collects values from a stream on a background task so tests can inspect them later.
@MainActor
final class Collector<Value: Sendable> {
  private(set) var values: [Value] = []
  private var task: Task<Void, Never>?

  init(_ stream: AsyncStream<Value>) {
    task = Task { @MainActor [weak self] in
      for await value in stream { self?.values.append(value) }
    }
  }

  func stop() { task?.cancel() }
}
