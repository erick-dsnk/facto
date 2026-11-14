import AVFoundation
import Foundation
import os

// Speech and chime seams for ResultPresenter, plus the system implementations. Tests use
// fakes. Neither type touches the AVAudioSession category: the audio capture module owns it.

/// Speaks one short line at a time.
@MainActor
protocol SpeechSpeaking: AnyObject {
  /// Speaks `text`. Calls `onFinish` exactly once, when the line ends or is cancelled.
  func speak(_ text: String, rate: Float, onFinish: @escaping @MainActor () -> Void)
  /// Cancels the current line. Its `onFinish` still runs.
  func stopSpeaking()
}

/// Plays a short, quiet cue. A chime is not playback: it must not report `playbackStarted`.
@MainActor
protocol ChimePlaying: AnyObject {
  func playChime()
}

/// AVSpeechSynthesizer-backed speaker, English voice.
@MainActor
final class SystemSpeechSpeaker: NSObject, SpeechSpeaking {
  /// AVSpeechUtteranceDefaultSpeechRate, the rate a user hears unless they pick slower speech.
  static let defaultRate = AVSpeechUtteranceDefaultSpeechRate

  private let synthesizer = AVSpeechSynthesizer()
  private var pending: [ObjectIdentifier: @MainActor () -> Void] = [:]
  private let voice = AVSpeechSynthesisVoice(language: "en-US")

  override init() {
    super.init()
    synthesizer.delegate = self
  }

  func speak(_ text: String, rate: Float, onFinish: @escaping @MainActor () -> Void) {
    let utterance = AVSpeechUtterance(string: text)
    utterance.rate = min(max(rate, AVSpeechUtteranceMinimumSpeechRate), AVSpeechUtteranceMaximumSpeechRate)
    utterance.voice = voice
    pending[ObjectIdentifier(utterance)] = onFinish
    synthesizer.speak(utterance)
  }

  func stopSpeaking() {
    synthesizer.stopSpeaking(at: .immediate)
  }

  fileprivate func finished(_ id: ObjectIdentifier) {
    pending.removeValue(forKey: id)?()
  }
}

extension SystemSpeechSpeaker: AVSpeechSynthesizerDelegate {
  nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
    let id = ObjectIdentifier(utterance)
    Task { @MainActor in self.finished(id) }
  }

  nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
    let id = ObjectIdentifier(utterance)
    Task { @MainActor in self.finished(id) }
  }
}

/// A soft two-note chime generated in memory (no asset, no system sound id), played at low
/// volume through the current audio route so it reaches the glasses speakers.
@MainActor
final class ToneChimePlayer: ChimePlaying {
  private static let log = Logger(subsystem: "com.davidvasilescu.junction.glasseslab", category: "output")

  private let volume: Float
  private var player: AVAudioPlayer?

  init(volume: Float = 0.3) {
    self.volume = volume
  }

  func playChime() {
    do {
      if player == nil {
        let newPlayer = try AVAudioPlayer(data: Self.chimeWAV())
        newPlayer.prepareToPlay()
        player = newPlayer
      }
      guard let player else { return }
      player.volume = volume
      player.currentTime = 0
      player.play()
    } catch {
      Self.log.error("chime failed: \(String(describing: error), privacy: .public)")
    }
  }

  /// 16-bit mono PCM WAV: 880 Hz then 1320 Hz, 90 ms each, with short fades so it never clicks.
  nonisolated static func chimeWAV(sampleRate: Int = 22_050) -> Data {
    let notes: [(frequency: Double, seconds: Double)] = [(880, 0.09), (1_320, 0.09)]
    var samples: [Int16] = []
    for note in notes {
      let count = Int(Double(sampleRate) * note.seconds)
      let fade = max(1, count / 6)
      for index in 0..<count {
        let envelope = min(1, Double(min(index, count - 1 - index)) / Double(fade))
        let value = sin(2 * Double.pi * note.frequency * Double(index) / Double(sampleRate)) * envelope * 0.5
        samples.append(Int16(value * Double(Int16.max)))
      }
    }

    var data = Data()
    func append<T: FixedWidthInteger>(_ value: T) {
      withUnsafeBytes(of: value.littleEndian) { data.append(contentsOf: $0) }
    }
    let byteCount = UInt32(samples.count * 2)
    data.append(contentsOf: Array("RIFF".utf8)); append(36 + byteCount)
    data.append(contentsOf: Array("WAVE".utf8))
    data.append(contentsOf: Array("fmt ".utf8)); append(UInt32(16))
    append(UInt16(1)); append(UInt16(1)) // PCM, mono
    append(UInt32(sampleRate)); append(UInt32(sampleRate * 2)) // sample rate, byte rate
    append(UInt16(2)); append(UInt16(16)) // block align, bits per sample
    data.append(contentsOf: Array("data".utf8)); append(byteCount)
    for sample in samples { append(sample) }
    return data
  }
}
