import Foundation
import Network

/// A card is recoverable only in the backend context that produced it. The short-lived
/// result deadline is independent of the DAT connection; history is never a replay queue.
struct NativeCardEligibility: Equatable, Sendable {
  let sessionId: String
  let sessionEpoch: Int
  let expiresAt: Date

  init?(sessionId: String, sessionEpoch: Int, expiresAt: String) {
    let parser = ISO8601DateFormatter()
    parser.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    let fractional = parser.date(from: expiresAt)
    parser.formatOptions = [.withInternetDateTime]
    guard let deadline = fractional ?? parser.date(from: expiresAt) else { return nil }
    self.sessionId = sessionId
    self.sessionEpoch = sessionEpoch
    self.expiresAt = deadline
  }

  func permits(sessionId: String?, epoch: Int?, now: Date) -> Bool {
    self.sessionId == sessionId && sessionEpoch == epoch && now < expiresAt
  }
}

/// Connectivity is a recovery opportunity, never permission to acquire a sensor.
/// This monitor is started once by the app, not by test-created LiveModel instances.
@MainActor
final class NativeNetworkRecovery {
  private let monitor = NWPathMonitor()
  private var started = false

  func start(onAvailable: @escaping @MainActor () -> Void) {
    guard !started else { return }
    started = true
    monitor.pathUpdateHandler = { path in
      guard path.status == .satisfied else { return }
      Task { @MainActor in onAvailable() }
    }
    monitor.start(queue: DispatchQueue(label: "facto.native-connection-recovery"))
  }
}
