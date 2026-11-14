import AVFoundation
import os

/// Live mode's listening input: the glasses' Bluetooth hands-free (HFP) microphone, with the
/// camera off. On Meta Ray-Ban Display glasses the camera stream holds back display updates
/// (Meta's known issue "do not combine capture with display") and draws a viewfinder, so
/// listening no longer rides on the camera stream. It never falls back to the iPhone's own
/// microphone: without the glasses' mic it refuses to start, so audio sent as `glasses_hfp`
/// always comes from the glasses.
///
/// The session runs in `.default` mode, not `.voiceChat`: voice-chat processing suppresses
/// voices further from the mic, and the people near the wearer are who we want to hear.
@MainActor
protocol ListeningMicrophone: AnyObject {
  var onBuffer: (@MainActor (AVAudioPCMBuffer) -> Void)? { get set }
  var isRunning: Bool { get }
  /// The input in use, for the debug log ("Bluetooth HFP: Ray-Ban Display", "iPhone Microphone").
  var inputName: String? { get }
  func start() throws
  func stop()
}

@MainActor
final class GlassesMicrophone: ListeningMicrophone {
  var onBuffer: (@MainActor (AVAudioPCMBuffer) -> Void)?
  private(set) var isRunning = false
  private(set) var inputName: String?

  private let engine = AVAudioEngine()
  private var deliveries: AsyncStream<PCMBufferCopy>.Continuation?
  private static let log = Logger(subsystem: "com.davidvasilescu.junction.glasseslab", category: "mic")

  func start() throws {
    guard !isRunning else { return }
    let session = AVAudioSession.sharedInstance()
    try session.setCategory(.playAndRecord, mode: .default, options: [.allowBluetoothHFP])
    try session.setActive(true)
    guard let glasses = session.availableInputs?.first(where: { $0.portType == .bluetoothHFP }) else {
      throw MicrophoneError.noGlassesMic
    }
    try session.setPreferredInput(glasses)
    guard session.currentRoute.inputs.first?.portType == .bluetoothHFP else { throw MicrophoneError.noGlassesMic }
    inputName = "Bluetooth HFP: \(glasses.portName)"

    // One ordered stream and one consumer, so buffers reach the streamer in order.
    let (stream, continuation) = AsyncStream<PCMBufferCopy>.makeStream()
    deliveries = continuation
    Task { @MainActor [weak self] in
      for await copy in stream {
        guard let self, let buffer = copy.buffer else { continue }
        self.onBuffer?(buffer)
      }
    }

    let input = engine.inputNode
    let format = input.outputFormat(forBus: 0)
    guard format.sampleRate > 0, format.channelCount > 0 else {
      continuation.finish()
      deliveries = nil
      throw MicrophoneError.noInput
    }
    // About 100 ms per buffer; copied here because the engine reuses it after the callback.
    input.installTap(onBus: 0, bufferSize: AVAudioFrameCount(format.sampleRate / 10), format: format) { buffer, _ in
      continuation.yield(PCMBufferCopy(buffer))
    }
    engine.prepare()
    do {
      try engine.start()
    } catch {
      input.removeTap(onBus: 0)
      continuation.finish()
      deliveries = nil
      throw error
    }
    isRunning = true
    Self.log.info("mic started input=\(self.inputName ?? "unknown", privacy: .public) rate=\(format.sampleRate)")
    DebugLog.shared.log("mic.started", ["input": inputName ?? "unknown", "sampleRate": format.sampleRate, "channels": format.channelCount])
  }

  func stop() {
    guard isRunning else { return }
    engine.inputNode.removeTap(onBus: 0)
    engine.stop()
    deliveries?.finish()
    deliveries = nil
    isRunning = false
    DebugLog.shared.log("mic.stopped")
  }
}

enum MicrophoneError: Error, Equatable {
  case noInput
  case noGlassesMic
  case denied

  var message: String {
    switch self {
    case .noInput: "No microphone is available. Check that the glasses are connected over Bluetooth."
    case .noGlassesMic: "The glasses’ mic isn’t connected. Turn on the glasses and check they’re connected over Bluetooth in iOS Settings."
    case .denied: "Microphone access is off for Facto in iOS Settings."
    }
  }
}
