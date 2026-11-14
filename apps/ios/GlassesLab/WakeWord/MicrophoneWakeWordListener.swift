import AVFoundation
import os

/// Feeds microphone audio to the on-device keyword detector until the wake phrase is heard.
///
/// It prefers the glasses' Bluetooth hands-free microphone and falls back to the phone's own.
/// Only this route is open while waiting: no DAT session, no camera stream. Run it with no DAT
/// stream active (Meta advises against setting up HFP while a session starts or stops,
/// meta-wearables-dat-ios issue #292); `LiveModel` stops it before it starts a stream.
///
/// Audio stays in memory on this phone. Nothing here logs, stores or sends it.
@MainActor
final class MicrophoneWakeWordListener: WakeWordListening {
  var onWake: (@MainActor (WakeCommand) -> Void)?
  private(set) var isRunning = false
  private(set) var inputName: String?

  private let makeRecognizer: () throws -> WakePhraseRecognizer
  private var recognizer: WakePhraseRecognizer?
  private lazy var engine = AVAudioEngine()
  private let queue = DispatchQueue(label: "glasseslab.wake-word", qos: .userInitiated)
  private var configurationObserver: NSObjectProtocol?
  private let log = Logger(subsystem: "com.davidvasilescu.junction.glasseslab", category: "wake")

  init(
    makeRecognizer: @escaping () throws -> WakePhraseRecognizer = {
      WakePhraseRecognizer(wake: try SherpaKeywordDetector.wake(), command: try SherpaKeywordDetector.command())
    }
  ) {
    self.makeRecognizer = makeRecognizer
  }

  func start() async throws {
    guard !isRunning else { return }
    guard await AVAudioApplication.requestRecordPermission() else { throw WakeWordError.microphoneDenied }
    if recognizer == nil { recognizer = try makeRecognizer() }
    do {
      let session = AVAudioSession.sharedInstance()
      // allowBluetoothHFP routes input through the glasses' hands-free profile when connected.
      try session.setCategory(.playAndRecord, mode: .default, options: [.allowBluetoothHFP, .defaultToSpeaker])
      try session.setActive(true)
      if let glasses = session.availableInputs?.first(where: { $0.portType == .bluetoothHFP }) {
        try session.setPreferredInput(glasses)
      }
      try startEngine()
    } catch let error as WakeWordError {
      throw error
    } catch {
      throw WakeWordError.audioUnavailable(code: (error as NSError).code)
    }
    isRunning = true
    inputName = AVAudioSession.sharedInstance().currentRoute.inputs.first?.portName
    // A route change (glasses connect or disconnect) reconfigures the engine and stops it.
    configurationObserver = NotificationCenter.default.addObserver(
      forName: .AVAudioEngineConfigurationChange, object: engine, queue: .main
    ) { [weak self] _ in
      Task { @MainActor in self?.restartAfterRouteChange() }
    }
    log.info("wake listener started")
  }

  func stop() {
    guard isRunning else { return }
    isRunning = false
    if let configurationObserver { NotificationCenter.default.removeObserver(configurationObserver) }
    configurationObserver = nil
    engine.inputNode.removeTap(onBus: 0)
    engine.stop()
    inputName = nil
    let recognizer = recognizer
    queue.async { recognizer?.reset() }
    log.info("wake listener stopped")
  }

  private func startEngine() throws {
    let input = engine.inputNode
    let format = input.outputFormat(forBus: 0)
    guard format.sampleRate > 0, format.channelCount > 0, let resampler = WakeAudioResampler(from: format) else {
      throw WakeWordError.audioUnavailable(code: -1)
    }
    guard let recognizer else { throw WakeWordError.modelMissing }
    let queue = queue
    input.removeTap(onBus: 0)
    input.installTap(onBus: 0, bufferSize: 1600, format: format) { [weak self] buffer, _ in
      // Audio thread: convert here, detect on the serial queue, report on the main actor.
      let samples = resampler.convert(buffer)
      guard !samples.isEmpty else { return }
      queue.async {
        guard let command = recognizer.accept(samples) else { return }
        Task { @MainActor in self?.heard(command) }
      }
    }
    engine.prepare()
    try engine.start()
  }

  private func heard(_ command: WakeCommand) {
    guard isRunning else { return }
    log.info("wake phrase heard, check=\(command == .checkThis, privacy: .public)")
    onWake?(command)
  }

  private func restartAfterRouteChange() {
    guard isRunning else { return }
    do {
      try startEngine()
      inputName = AVAudioSession.sharedInstance().currentRoute.inputs.first?.portName
    } catch {
      log.error("wake listener restart failed \((error as NSError).code, privacy: .public)")
      stop()
    }
  }
}

/// Converts microphone buffers to the 16 kHz mono Float32 samples the detector expects.
/// Used from the audio tap's thread only.
final class WakeAudioResampler {
  private let converter: AVAudioConverter
  private let output: AVAudioFormat
  private let ratio: Double

  init?(from input: AVAudioFormat) {
    guard
      let output = AVAudioFormat(
        commonFormat: .pcmFormatFloat32, sampleRate: Double(WakePhrase.sampleRate), channels: 1, interleaved: false),
      let converter = AVAudioConverter(from: input, to: output)
    else { return nil }
    self.converter = converter
    self.output = output
    self.ratio = output.sampleRate / input.sampleRate
  }

  func convert(_ buffer: AVAudioPCMBuffer) -> [Float] {
    guard buffer.frameLength > 0 else { return [] }
    let capacity = AVAudioFrameCount((Double(buffer.frameLength) * ratio).rounded(.up)) + 32
    guard let converted = AVAudioPCMBuffer(pcmFormat: output, frameCapacity: capacity) else { return [] }
    var handedOver = false
    var failure: NSError?
    let status = converter.convert(to: converted, error: &failure) { _, inputStatus in
      if handedOver {
        inputStatus.pointee = .noDataNow
        return nil
      }
      handedOver = true
      inputStatus.pointee = .haveData
      return buffer
    }
    guard status != .error, failure == nil, let channel = converted.floatChannelData?[0] else { return [] }
    return Array(UnsafeBufferPointer(start: channel, count: Int(converted.frameLength)))
  }
}
