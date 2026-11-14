import Foundation
@testable import GlassesLab

/// Records what the streamer sends and lets a test push events and connection states.
@MainActor
final class FakeSessionChannel: SessionChannel {
  enum Sent: Equatable {
    case control(Data)
    case binary(Data)
  }

  var sessionId: String? = "sess-test"
  var sessionEpoch: Int? = 1
  var connectionState: ChannelConnectionState = .connected
  var failSends = false
  /// What a failing send throws. The default stands for a dead socket.
  var sendError: Error = URLError(.networkConnectionLost)
  private(set) var failedSendCount = 0
  private(set) var sent: [Sent] = []

  private var eventContinuations: [AsyncStream<ServerEvent>.Continuation] = []
  private var stateContinuations: [AsyncStream<ChannelConnectionState>.Continuation] = []

  func connectionStates() -> AsyncStream<ChannelConnectionState> {
    let (stream, continuation) = AsyncStream<ChannelConnectionState>.makeStream()
    continuation.yield(connectionState)
    stateContinuations.append(continuation)
    return stream
  }

  func events() -> AsyncStream<ServerEvent> {
    let (stream, continuation) = AsyncStream<ServerEvent>.makeStream()
    eventContinuations.append(continuation)
    return stream
  }

  func sendControl<Message: Encodable & Sendable>(_ message: Message) async throws {
    if failSends {
      failedSendCount += 1
      throw sendError
    }
    sent.append(.control(try JSONEncoder().encode(message)))
  }

  func sendBinary(_ data: Data) async throws {
    if failSends {
      failedSendCount += 1
      throw sendError
    }
    sent.append(.binary(data))
  }

  // MARK: Test controls

  func emit(_ event: ServerEvent) {
    for continuation in eventContinuations { continuation.yield(event) }
  }

  func setState(_ state: ChannelConnectionState) {
    connectionState = state
    for continuation in stateContinuations { continuation.yield(state) }
  }

  func clearSent() { sent = [] }

  /// Decoded JSON objects of every control message, in send order.
  var controls: [[String: Any]] {
    sent.compactMap { item in
      guard case .control(let data) = item else { return nil }
      return (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
    }
  }

  var controlTypes: [String] { controls.compactMap { $0["type"] as? String } }

  var binaries: [Data] {
    sent.compactMap { item in
      guard case .binary(let data) = item else { return nil }
      return data
    }
  }

  /// "control:<type>" or "binary" per sent message, to check ordering.
  var timeline: [String] {
    sent.map { item in
      switch item {
      case .control(let data):
        let object = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
        return "control:\(object?["type"] as? String ?? "?")"
      case .binary:
        return "binary"
      }
    }
  }
}

/// A clock that only moves when the test says so.
@MainActor
final class ManualClock: AudioStreamerClock {
  final class Timer: AudioStreamerTimer {
    let fireAt: TimeInterval
    let action: @MainActor () -> Void
    var isCancelled = false
    init(fireAt: TimeInterval, action: @escaping @MainActor () -> Void) {
      self.fireAt = fireAt
      self.action = action
    }
    func cancel() { isCancelled = true }
  }

  private(set) var now: TimeInterval = 0
  private var timers: [Timer] = []

  func schedule(after seconds: TimeInterval, _ action: @escaping @MainActor () -> Void) -> AudioStreamerTimer {
    let timer = Timer(fireAt: now + seconds, action: action)
    timers.append(timer)
    return timer
  }

  func advance(by seconds: TimeInterval) {
    now += seconds
    let due = timers.filter { !$0.isCancelled && $0.fireAt <= now }
    timers.removeAll { $0.isCancelled || $0.fireAt <= now }
    for timer in due { timer.action() }
  }
}

/// Server event builders for the audio tests.
enum AudioEvents {
  private static var seq = 0

  private static func event(
    _ type: ServerEventType, epoch: Int, requestId: String? = nil, session: String = "sess-test", payload: ServerEventPayload
  ) -> ServerEvent {
    seq += 1
    return ServerEvent(
      eventId: "evt-\(seq)", eventSeq: seq, sessionId: session, sessionEpoch: epoch,
      requestId: requestId, type: type, serverAt: "2026-11-14T10:00:00.000Z", payload: payload
    )
  }

  static func ready(generation: Int, epoch: Int = 1) -> ServerEvent {
    event(.audioReady, epoch: epoch, payload: .audioReady(AudioReadyPayload(
      streamGeneration: generation, encoding: "pcm_s16le", sampleRateHz: 16_000, channels: 1, source: .glassesStreamAudio
    )))
  }

  static func stopped(generation: Int?, reason: String, epoch: Int = 1) -> ServerEvent {
    event(.audioStopped, epoch: epoch, payload: .audioStopped(AudioStoppedPayload(reasonCode: reason, streamGeneration: generation)))
  }

  static func sessionReady(active: Bool, audio: Bool? = true, epoch: Int) -> ServerEvent {
    event(.sessionReady, epoch: epoch, payload: .sessionReady(SessionReadyPayload(active: active, expiresAt: nil, mode: "live", audio: audio)))
  }

  static func sessionEnded(reason: String, epoch: Int = 1, session: String = "sess-test") -> ServerEvent {
    event(.sessionEnded, epoch: epoch, session: session, payload: .sessionEnded(SessionEndedPayload(reasonCode: reason, active: false)))
  }

  static func error(_ reason: String, requestId: String? = nil, epoch: Int = 1) -> ServerEvent {
    event(.pipelineError, epoch: epoch, requestId: requestId, payload: .pipelineError(PipelineErrorPayload(reasonCode: reason)))
  }
}
