import Foundation

/// One WebSocket message. Text frames carry JSON events and control messages; binary
/// frames carry audio with the 13-byte header from the contract.
enum WebSocketFrame: Equatable, Sendable {
  case text(String)
  case binary(Data)
}

/// The slice of `URLSessionWebSocketTask` that `BackendClient` uses. Tests swap in a fake
/// because `URLProtocol` cannot intercept WebSocket tasks.
protocol WebSocketConnection: AnyObject, Sendable {
  /// Starts the handshake.
  func resume()
  func send(_ frame: WebSocketFrame) async throws
  /// Waits for the next message. Throws once the socket fails or closes.
  func receive() async throws -> WebSocketFrame
  /// Sends a ping and waits for the pong. Throws when the socket fails or no pong arrives
  /// within `timeout` seconds.
  func sendPing(timeout: TimeInterval) async throws
  /// Closes the socket. A pending `receive()` throws.
  func cancel(with code: URLSessionWebSocketTask.CloseCode)
  /// HTTP status of a rejected handshake (e.g. 401), nil while unknown.
  var handshakeStatusCode: Int? { get }
}

/// Creates a socket for an upgrade request that already carries the bearer header.
typealias WebSocketFactory = @Sendable (URLRequest) -> WebSocketConnection

/// `URLSessionWebSocketTask` wrapper. Native tasks can send the `Authorization` header, so
/// the token never goes into the URL or a subprotocol.
final class URLSessionWebSocketConnection: WebSocketConnection, @unchecked Sendable {
  // URLSessionWebSocketTask is thread-safe; the wrapper holds no other state.
  private let task: URLSessionWebSocketTask

  init(task: URLSessionWebSocketTask) {
    self.task = task
  }

  static func factory(session: URLSession) -> WebSocketFactory {
    { request in URLSessionWebSocketConnection(task: session.webSocketTask(with: request)) }
  }

  func resume() {
    task.resume()
  }

  func send(_ frame: WebSocketFrame) async throws {
    switch frame {
    case .text(let text): try await task.send(.string(text))
    case .binary(let data): try await task.send(.data(data))
    }
  }

  func receive() async throws -> WebSocketFrame {
    switch try await task.receive() {
    case .string(let text): return .text(text)
    case .data(let data): return .binary(data)
    @unknown default: throw URLError(.cannotParseResponse)
    }
  }

  func sendPing(timeout: TimeInterval) async throws {
    // The pong handler may never run on a half-open socket, so a timer resumes instead.
    let once = ResumeOnce()
    try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
      task.sendPing { error in
        guard once.claim() else { return }
        if let error { continuation.resume(throwing: error) } else { continuation.resume() }
      }
      DispatchQueue.global().asyncAfter(deadline: .now() + max(0, timeout)) {
        guard once.claim() else { return }
        continuation.resume(throwing: URLError(.timedOut))
      }
    }
  }

  func cancel(with code: URLSessionWebSocketTask.CloseCode) {
    task.cancel(with: code, reason: nil)
  }

  var handshakeStatusCode: Int? {
    guard let status = (task.response as? HTTPURLResponse)?.statusCode, status != 101 else { return nil }
    return status
  }
}

/// Lets exactly one of several callbacks resume a continuation.
private final class ResumeOnce: @unchecked Sendable {
  private let lock = NSLock()
  private var claimed = false

  func claim() -> Bool {
    lock.lock()
    defer { lock.unlock() }
    guard !claimed else { return false }
    claimed = true
    return true
  }
}
