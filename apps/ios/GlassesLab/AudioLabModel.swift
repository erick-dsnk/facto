import AVFoundation
import Observation

/// Format and level helpers shared by the DAT stream-audio and HFP tests.
enum AudioMeter {
  static func describe(_ format: AVAudioFormat) -> String {
    let sampleType: String
    switch format.commonFormat {
    case .pcmFormatFloat32: sampleType = "Float32"
    case .pcmFormatFloat64: sampleType = "Float64"
    case .pcmFormatInt16: sampleType = "Int16"
    case .pcmFormatInt32: sampleType = "Int32"
    default: sampleType = "other"
    }
    return "\(Int(format.sampleRate)) Hz · \(format.channelCount) ch · \(sampleType)\(format.isInterleaved ? " · interleaved" : "")"
  }

  /// RMS level of the first channel in dBFS (-160 for silence or unreadable buffers).
  static func levelDb(_ buffer: AVAudioPCMBuffer) -> Double {
    let frames = Int(buffer.frameLength)
    guard frames > 0 else { return -160 }
    var sum = 0.0
    if let samples = buffer.floatChannelData?[0] {
      for i in 0..<frames { sum += Double(samples[i] * samples[i]) }
    } else if let samples = buffer.int16ChannelData?[0] {
      for i in 0..<frames {
        let value = Double(samples[i]) / Double(Int16.max)
        sum += value * value
      }
    } else {
      return -160
    }
    let rms = (sum / Double(frames)).squareRoot()
    return rms > 0 ? max(-160, 20 * log10(rms)) : -160
  }
}

/// A1 output and fallback-input checks: Bluetooth HFP microphone and spoken output.
/// Run these with no DAT stream active: Meta advises not to set up HFP while a
/// session is starting or stopping (meta-wearables-dat-ios issue #292).
@Observable
@MainActor
final class AudioLabModel {
  var isListening = false
  var hfpFormat: String?
  var hfpLevelDb: Double = -160
  var inputRoute = "–"
  var outputRoute = "–"
  var lastError: String?

  @ObservationIgnored private let engine = AVAudioEngine()
  @ObservationIgnored private let synthesizer = AVSpeechSynthesizer()

  init() {
    refreshRoute()
  }

  // MARK: HFP microphone (wearer dictation fallback)

  func startHFP() async {
    lastError = nil
    guard await AVAudioApplication.requestRecordPermission() else {
      lastError = "Microphone permission denied in iOS Settings."
      return
    }
    do {
      let session = AVAudioSession.sharedInstance()
      // allowBluetoothHFP routes input through the glasses' hands-free profile when connected.
      try session.setCategory(.playAndRecord, mode: .voiceChat, options: [.allowBluetoothHFP])
      try session.setActive(true)
      if let glasses = session.availableInputs?.first(where: { $0.portType == .bluetoothHFP }) {
        try session.setPreferredInput(glasses)
      }
      let input = engine.inputNode
      let format = input.outputFormat(forBus: 0)
      hfpFormat = AudioMeter.describe(format)
      input.removeTap(onBus: 0)
      input.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
        let level = AudioMeter.levelDb(buffer)
        Task { @MainActor in self?.hfpLevelDb = level }
      }
      engine.prepare()
      try engine.start()
      isListening = true
    } catch {
      lastError = "HFP: \(error.localizedDescription)"
    }
    refreshRoute()
  }

  func stopHFP() {
    engine.inputNode.removeTap(onBus: 0)
    engine.stop()
    isListening = false
    hfpLevelDb = -160
    try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    refreshRoute()
  }

  // MARK: Spoken output (A4 renderer preview)

  /// Speaks a sample result line, using the plan's wording for a supported verdict.
  func speakSample() {
    lastError = nil
    do {
      let session = AVAudioSession.sharedInstance()
      if !isListening {
        try session.setCategory(.playback, mode: .spokenAudio, options: [.duckOthers])
        try session.setActive(true)
      }
    } catch {
      lastError = "Speech: \(error.localizedDescription)"
    }
    let utterance = AVSpeechUtterance(string: "Supported by the sources I found. Best source: Reuters.")
    utterance.voice = AVSpeechSynthesisVoice(language: "en-US")
    synthesizer.speak(utterance)
    refreshRoute()
  }

  func refreshRoute() {
    let route = AVAudioSession.sharedInstance().currentRoute
    inputRoute = route.inputs.map { "\($0.portName) (\($0.portType.rawValue))" }.joined(separator: ", ")
    outputRoute = route.outputs.map { "\($0.portName) (\($0.portType.rawValue))" }.joined(separator: ", ")
    if inputRoute.isEmpty { inputRoute = "none" }
    if outputRoute.isEmpty { outputRoute = "none" }
  }
}
