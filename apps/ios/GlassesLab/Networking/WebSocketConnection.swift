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

  func cancel(with code: URLSessionWebSocketTask.CloseCode) {
    task.cancel(with: code, reason: nil)
  }

  var handshakeStatusCode: Int? {
    guard let status = (task.response as? HTTPURLResponse)?.statusCode, status != 101 else { return nil }
    return status
  }
}
