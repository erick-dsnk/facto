import AVFoundation
import os

// MARK: - Clock

/// Time source for the reconnect window and the restart budget. Tests inject a manual clock.
@MainActor
protocol AudioStreamerClock: AnyObject {
  /// Monotonic seconds.
  var now: TimeInterval { get }
  func schedule(after seconds: TimeInterval, _ action: @escaping @MainActor () -> Void) -> AudioStreamerTimer
}

protocol AudioStreamerTimer: AnyObject {
  func cancel()
}

@MainActor
final class SystemAudioStreamerClock: AudioStreamerClock {
  private final class TaskTimer: AudioStreamerTimer {
    let task: Task<Void, Never>
    init(_ task: Task<Void, Never>) { self.task = task }
    func cancel() { task.cancel() }
  }

  var now: TimeInterval { ProcessInfo.processInfo.systemUptime }

  func schedule(after seconds: TimeInterval, _ action: @escaping @MainActor () -> Void) -> AudioStreamerTimer {
    TaskTimer(Task { @MainActor in
      try? await Task.sleep(nanoseconds: UInt64(max(0, seconds) * 1_000_000_000))
      guard !Task.isCancelled else { return }
      action()
    })
  }
}

// MARK: - State

/// Why listening stopped. `code` is safe to log; `spokenMessage` is what the wearer hears.
enum AudioStreamerStopReason: Equatable, Sendable {
  /// The user's own Stop action.
  case requested
  /// The connection stayed down longer than the reconnect window (decision 9).
  case noConnection
  case glassesDisconnected
  /// The server ended or paused the session (`session.ended`).
  case sessionEnded(reasonCode: String)
  /// The server has no ASR, or audio kept failing within the restart budget.
  case audioUnavailable(reasonCode: String)

  var code: String {
    switch self {
    case .requested: return "requested"
    case .noConnection: return "no_connection"
    case .glassesDisconnected: return "glasses_disconnected"
    case .sessionEnded(let reasonCode): return "session_ended:\(reasonCode)"
    case .audioUnavailable(let reasonCode): return "audio_unavailable:\(reasonCode)"
    }
  }

  /// Short spoken reason. Each failure sounds different so a broken connection never passes
  /// for "no alerts". Nil for the user's own Stop.
  var spokenMessage: String? {
    switch self {
    case .requested: return nil
    case .noConnection: return "No connection. Listening stopped."
    case .glassesDisconnected: return "Glasses disconnected. Listening stopped."
    case .sessionEnded: return "Session ended. Listening stopped."
    case .audioUnavailable: return "Listening is unavailable right now."
    }
  }
}

enum AudioStreamerPhase: Equatable, Sendable {
  case idle
  /// `start()` ran before the channel was connected.
  case waitingForConnection
  /// `audio.start` sent; frames are buffered (at most 2 s) until `audio.ready`.
  case awaitingReady(generation: Int)
  case streaming(generation: Int)
  /// Spoken output is playing; no generation is open. `playbackEnded()` opens a higher one.
  case pausedForPlayback
  /// The connection dropped. Pending audio is gone; waiting up to 5 s for the session to return.
  case reconnecting
  case stopped(AudioStreamerStopReason)

  /// True from `start()` until a stop.
  var isActive: Bool {
    switch self {
    case .idle, .stopped: return false
    default: return true
    }
  }

  /// True while a generation is open on the server (or being opened).
  var hasOpenGeneration: Bool {
    switch self {
    case .awaitingReady, .streaming: return true
    default: return false
    }
  }
}

// MARK: - Streamer

/// Streams glasses audio to the backend (decisions 1 and 9, contract v1 audio framing).
///
/// Feed it the DAT stream's `AVAudioPCMBuffer`s with `append(_:)`. It converts them to
/// 16 kHz mono PCM16, cuts 40 ms frames with the 13-byte header, negotiates each stream
/// generation with `audio.start` / `audio.ready` and sends frames over `SessionChannel`.
///
/// Rules it enforces:
/// - No frame goes out before `audio.ready` for its generation. While waiting it buffers at
///   most 2 s; past that it drops the buffer and opens a new generation.
/// - Every new generation is strictly higher than the last, with sequence and capture offset
///   back at 0. Audio is never spliced across a gap.
/// - It is the app's `PlaybackReporting`: `playbackStarted()` closes the generation and sends
///   `playback.started`; `playbackEnded()` sends `playback.ended` and opens a higher generation.
///   Route every playback report through this object while it is in use.
/// - A connection loss discards pending audio. If the session comes back within 5 s it sends
///   `session.resume`, opens a higher generation and calls `onAutoResumed` (play a quiet chime).
///   Otherwise it stops with `.noConnection`.
/// - It never logs audio, transcripts or any payload text: only generations, counts and codes.
@MainActor
final class AudioStreamer: PlaybackReporting {
  static let reconnectGrace: TimeInterval = 5
  /// Unplanned generation restarts allowed per window before giving up.
  static let maxRestartsPerWindow = 3
  static let restartWindow: TimeInterval = 30
  /// `pipeline.error` codes that mean the server refused our `audio.start`.
  static let startRejectionCodes: Set<String> = [
    "asr_unavailable", "playback_active", "audio_already_started", "invalid_audio_start",
    "invalid_audio_generation", "old_epoch", "audio_not_ready",
  ]

  /// `audio.stopped` codes the server follows with one `pipeline.error` (AudioBridge in
  /// services/api). Other stops, such as "playback" or "stopped", have no trailing error.
  static let stopCodesWithTrailingError: Set<String> = ["start_failed", "frame_rejected", "asr_failed", "invalid_transcript"]

  private(set) var phase: AudioStreamerPhase = .idle
  /// The last generation number sent in `audio.start`. 0 before the first.
  private(set) var generation = 0
  private(set) var isPlaybackActive = false

  /// Called after an automatic resume within the reconnect window. Play a quiet chime here;
  /// a chime is not playback, so do not report it.
  var onAutoResumed: (() -> Void)?
  /// Called once per stop, including the user's own Stop (`.requested`).
  var onStopped: ((AudioStreamerStopReason) -> Void)?

  private enum Outgoing {
    case control(ControlMessage)
    case audioStart(AudioStartControl)
    case binary(Data)

    var isBinary: Bool {
      if case .binary = self { return true }
      return false
    }

    /// Frames and `audio.start`s that a newer generation makes pointless to send.
    var isGenerationScoped: Bool {
      switch self {
      case .binary, .audioStart: return true
      case .control: return false
      }
    }
  }

  private let channel: SessionChannel
  private let source: CaptureSource
  private let clock: AudioStreamerClock
  private let reconnectGrace: TimeInterval
  private let maxBufferedFrames: Int
  private let converter = PCM16Converter()
  private let log = Logger(subsystem: "com.davidvasilescu.junction.glasseslab", category: "audio-streamer")

  private var framer: PCM16Framer?
  private var handshakeFrames: [Data] = []
  private var outbox: [Outgoing] = []
  private var drainTask: Task<Void, Never>?
  private var subscriptions: [Task<Void, Never>] = []
  private var graceTimer: AudioStreamerTimer?
  private var restartTimes: [TimeInterval] = []
  /// The server follows an `audio.stopped` it caused with one `pipeline.error`; skip that one.
  private var expectsTrailingError = false
  private var lastEventEpoch: Int?

  init(
    channel: SessionChannel,
    source: CaptureSource = .glassesStreamAudio,
    clock: AudioStreamerClock? = nil,
    reconnectGrace: TimeInterval = AudioStreamer.reconnectGrace,
    maxBufferedFrames: Int = AudioWireFormat.maxBufferedFrames
  ) {
    self.channel = channel
    self.source = source
    self.clock = clock ?? SystemAudioStreamerClock()
    self.reconnectGrace = reconnectGrace
    self.maxBufferedFrames = maxBufferedFrames
  }

  // MARK: Public API

  /// Starts listening. Call once the session channel is connected; if it is still
  /// connecting, the streamer waits up to the reconnect window for it.
  func start() {
    guard !phase.isActive else { return }
    restartTimes = []
    expectsTrailingError = false
    subscribe()
    switch channel.connectionState {
    case .connected:
      beginGeneration()
    case .disconnected:
      finish(.noConnection, sendAudioStop: false)
    case .idle, .connecting, .reconnecting:
      phase = .waitingForConnection
      startGraceTimer()
    }
  }

  /// The user's Stop action: sends `audio.stop` and stops listening.
  func stop() {
    guard phase.isActive else { return }
    finish(.requested, sendAudioStop: true)
  }

  /// The glasses disconnected: sends `audio.stop` and stops with a reason.
  func glassesDisconnected() {
    guard phase.isActive else { return }
    finish(.glassesDisconnected, sendAudioStop: true)
  }

  /// One buffer from the DAT stream (proven 16 kHz, 1 ch, Float32; anything else is converted).
  func append(_ buffer: AVAudioPCMBuffer) {
    guard phase.hasOpenGeneration, let pcm = converter.convert(buffer) else { return }
    appendPCM16(pcm)
  }

  /// 16 kHz mono PCM16 little-endian bytes, for callers that convert elsewhere.
  func appendPCM16(_ pcm: Data) {
    guard phase.hasOpenGeneration, var framer else { return }
    let frames = framer.append(pcm)
    self.framer = framer
    for frame in frames {
      switch phase {
      case .awaitingReady:
        handshakeFrames.append(frame)
        if handshakeFrames.count > maxBufferedFrames {
          restartGeneration(reasonCode: "audio_ready_timeout", sendAudioStop: true)
          return
        }
      case .streaming:
        enqueue(.binary(frame))
        if outbox.lazy.filter(\.isBinary).count > maxBufferedFrames {
          restartGeneration(reasonCode: "send_backlog", sendAudioStop: true)
          return
        }
      default:
        return
      }
    }
  }

  /// Spoken output started: close the generation so the ASR never hears our own voice.
  func playbackStarted() {
    isPlaybackActive = true
    if phase.hasOpenGeneration {
      dropQueuedAudio()
      phase = .pausedForPlayback
    }
    if channel.connectionState == .connected, phase != .reconnecting, let epoch = currentEpoch {
      enqueue(.control(.playbackStarted(epoch: epoch)))
    }
  }

  /// Spoken output ended: report it, then open a strictly higher generation.
  func playbackEnded() {
    isPlaybackActive = false
    if channel.connectionState == .connected, phase != .reconnecting, let epoch = currentEpoch {
      enqueue(.control(.playbackEnded(epoch: epoch)))
    }
    if phase == .pausedForPlayback {
      beginGeneration()
    }
  }

  /// Waits until every queued message has been handed to the channel.
  func waitUntilSent() async {
    while let task = drainTask {
      await task.value
    }
  }

  // MARK: Channel input (internal for tests)

  func handle(_ state: ChannelConnectionState) {
    switch state {
    case .connected:
      if phase == .waitingForConnection {
        cancelGraceTimer()
        beginGeneration()
      }
    case .idle, .connecting, .reconnecting, .disconnected:
      if phase.hasOpenGeneration || phase == .pausedForPlayback {
        enterReconnecting()
      }
    }
  }

  func handle(_ event: ServerEvent) {
    lastEventEpoch = max(lastEventEpoch ?? event.sessionEpoch, event.sessionEpoch)
    guard phase.isActive else { return }
    switch event.payload {
    case .sessionReady(let payload):
      handleSessionReady(payload, epoch: event.sessionEpoch)
    case .sessionEnded(let payload):
      if payload.reasonCode == "disconnected" {
        handle(ChannelConnectionState.disconnected(reason: "network_lost"))
      } else {
        finish(.sessionEnded(reasonCode: payload.reasonCode), sendAudioStop: false)
      }
    case .audioReady(let payload):
      guard case .awaitingReady(let current) = phase, payload.streamGeneration == current else { return }
      phase = .streaming(generation: current)
      expectsTrailingError = false
      let buffered = handshakeFrames
      handshakeFrames = []
      for frame in buffered { enqueue(.binary(frame)) }
      log.info("audio generation \(current, privacy: .public) ready, flushed \(buffered.count, privacy: .public) frames")
    case .audioStopped(let payload):
      guard phase.hasOpenGeneration, payload.streamGeneration == generation else { return }
      restartGeneration(reasonCode: payload.reasonCode, sendAudioStop: false)
      expectsTrailingError = phase.hasOpenGeneration && Self.stopCodesWithTrailingError.contains(payload.reasonCode)
    case .pipelineError(let payload):
      // Audio errors carry no request id; check errors belong to other modules.
      guard event.requestId == nil, phase.hasOpenGeneration else { return }
      if expectsTrailingError {
        expectsTrailingError = false
        return
      }
      guard case .awaitingReady = phase, Self.startRejectionCodes.contains(payload.reasonCode) else { return }
      restartGeneration(reasonCode: payload.reasonCode, sendAudioStop: true)
    default:
      break
    }
  }

  // MARK: Generations

  private var currentEpoch: Int? {
    [channel.sessionEpoch, lastEventEpoch].compactMap { $0 }.max()
  }

  private func beginGeneration(epoch: Int? = nil) {
    guard let epoch = epoch ?? currentEpoch else {
      finish(.noConnection, sendAudioStop: false)
      return
    }
    dropQueuedAudio()
    if isPlaybackActive {
      phase = .pausedForPlayback
      return
    }
    generation += 1
    framer = PCM16Framer(generation: UInt32(truncatingIfNeeded: generation))
    enqueue(.audioStart(AudioStartControl(sessionEpoch: epoch, streamGeneration: generation, source: source)))
    phase = .awaitingReady(generation: generation)
    log.info("audio generation \(self.generation, privacy: .public) requested")
  }

  /// Closes the current generation after an unplanned failure and opens a higher one, within
  /// the restart budget. Past the budget, listening stops with `.audioUnavailable`.
  private func restartGeneration(reasonCode: String, sendAudioStop: Bool) {
    let now = clock.now
    restartTimes = restartTimes.filter { now - $0 < Self.restartWindow }
    restartTimes.append(now)
    if restartTimes.count > Self.maxRestartsPerWindow {
      finish(.audioUnavailable(reasonCode: reasonCode), sendAudioStop: sendAudioStop)
      return
    }
    log.info("audio generation \(self.generation, privacy: .public) restarting: \(reasonCode, privacy: .public)")
    dropQueuedAudio()
    if sendAudioStop, let epoch = currentEpoch {
      enqueue(.control(.audioStop(epoch: epoch)))
    }
    beginGeneration()
  }

  private func handleSessionReady(_ payload: SessionReadyPayload, epoch: Int) {
    if payload.audio == false {
      finish(.audioUnavailable(reasonCode: "asr_unavailable"), sendAudioStop: false)
      return
    }
    guard phase == .reconnecting else { return }
    cancelGraceTimer()
    if !payload.active {
      enqueue(.control(.resume(epoch: epoch)))
    }
    if isPlaybackActive {
      enqueue(.control(.playbackStarted(epoch: epoch)))
      phase = .pausedForPlayback
    } else {
      beginGeneration(epoch: epoch)
    }
    log.info("audio auto-resumed with generation \(self.generation, privacy: .public)")
    onAutoResumed?()
  }

  private func enterReconnecting() {
    outbox.removeAll()
    dropQueuedAudio()
    expectsTrailingError = false
    phase = .reconnecting
    startGraceTimer()
    log.info("audio connection lost; pending audio discarded")
  }

  private func finish(_ reason: AudioStreamerStopReason, sendAudioStop: Bool) {
    let hadOpenGeneration = phase.hasOpenGeneration
    cancelGraceTimer()
    dropQueuedAudio()
    if sendAudioStop, hadOpenGeneration, channel.connectionState == .connected, let epoch = currentEpoch {
      enqueue(.control(.audioStop(epoch: epoch)))
    }
    for task in subscriptions { task.cancel() }
    subscriptions = []
    expectsTrailingError = false
    phase = .stopped(reason)
    log.info("audio stopped: \(reason.code, privacy: .public)")
    onStopped?(reason)
  }

  /// Drops every unsent frame (and unsent `audio.start`) of the current generation and the
  /// partial frame in progress.
  private func dropQueuedAudio() {
    outbox.removeAll(where: \.isGenerationScoped)
    handshakeFrames = []
    framer = nil
    converter.reset()
  }

  // MARK: Timers and subscriptions

  private func startGraceTimer() {
    graceTimer?.cancel()
    graceTimer = clock.schedule(after: reconnectGrace) { [weak self] in
      guard let self else { return }
      self.graceTimer = nil
      if self.phase == .reconnecting || self.phase == .waitingForConnection {
        self.finish(.noConnection, sendAudioStop: false)
      }
    }
  }

  private func cancelGraceTimer() {
    graceTimer?.cancel()
    graceTimer = nil
  }

  private func subscribe() {
    for task in subscriptions { task.cancel() }
    let events = channel.events()
    let states = channel.connectionStates()
    subscriptions = [
      Task { [weak self] in
        for await event in events {
          guard let self, !Task.isCancelled else { return }
          self.handle(event)
        }
      },
      Task { [weak self] in
        for await state in states {
          guard let self, !Task.isCancelled else { return }
          self.handle(state)
        }
      },
    ]
  }

  // MARK: Ordered sending

  private func enqueue(_ item: Outgoing) {
    outbox.append(item)
    guard drainTask == nil else { return }
    drainTask = Task { [weak self] in
      await self?.drain()
    }
  }

  private func drain() async {
    while !outbox.isEmpty {
      let item = outbox.removeFirst()
      do {
        switch item {
        case .control(let message): try await channel.sendControl(message)
        case .audioStart(let message): try await channel.sendControl(message)
        case .binary(let frame): try await channel.sendBinary(frame)
        }
      } catch {
        handleSendFailure()
      }
    }
    drainTask = nil
  }

  private func handleSendFailure() {
    log.error("audio send failed in phase \(String(describing: self.phase), privacy: .public)")
    guard phase.hasOpenGeneration || phase == .pausedForPlayback else { return }
    if channel.connectionState == .connected {
      if phase.hasOpenGeneration {
        restartGeneration(reasonCode: "send_failed", sendAudioStop: true)
      }
    } else {
      enterReconnecting()
    }
  }
}
