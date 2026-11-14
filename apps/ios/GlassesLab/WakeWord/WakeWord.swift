import Foundation

// Wake phrase (issue #53): with the option on, Live mode keeps the glasses stream off and sends
// nothing about what is said until "Hey Facto" is heard. Detection runs on the phone with a
// small keyword-spotting model bundled in the app. Audio is processed in memory and dropped;
// it is never stored, logged or sent anywhere.

enum WakePhrase {
  static let spoken = "Hey Facto"
  /// Said in one go, this goes straight to a photo check instead of listening.
  static let spokenCommand = "Hey Facto, check this"
  /// Sample rate the bundled model expects.
  static let sampleRate = 16_000
}

/// What the wearer asked for with the wake phrase.
enum WakeCommand: Equatable, Sendable {
  /// "Hey Facto": listen for a while.
  case listen
  /// "Hey Facto, check this": take a photo and check what is in view.
  case checkThis
}

/// Turns the two detectors' hits into one command. "Hey Facto" alone means listen, but the
/// decision waits a moment in case "check this" follows; "check this" on its own means nothing.
/// Timing is counted in audio samples, so it is exact and testable. Not thread-safe.
final class WakePhraseRecognizer {
  private let wake: KeywordDetecting
  private let command: KeywordDetecting
  private let commandWindowSamples: Int
  /// Samples heard since "Hey Facto", while waiting to see whether "check this" follows.
  private var pending: Int?

  /// - Parameter commandWindow: seconds to wait after "Hey Facto" for "check this".
  init(wake: KeywordDetecting, command: KeywordDetecting, commandWindow: Double = 1.5) {
    self.wake = wake
    self.command = command
    self.commandWindowSamples = Int(commandWindow * Double(WakePhrase.sampleRate))
  }

  func accept(_ samples: [Float]) -> WakeCommand? {
    guard !samples.isEmpty else { return nil }
    let heardWake = wake.accept(samples)
    let heardCommand = command.accept(samples)
    if heardCommand {
      reset()
      return .checkThis
    }
    if heardWake, pending == nil { pending = 0 }
    guard let waited = pending else { return nil }
    let total = waited + samples.count
    if total >= commandWindowSamples {
      reset()
      return .listen
    }
    pending = total
    return nil
  }

  func reset() {
    pending = nil
    wake.reset()
    command.reset()
  }
}

/// Finds the wake phrase in 16 kHz mono audio. Not thread-safe: call it from one queue.
protocol KeywordDetecting: AnyObject {
  /// Feeds samples in [-1, 1]. True when the phrase was just heard.
  func accept(_ samples: [Float]) -> Bool
  /// Forgets audio heard so far.
  func reset()
}

/// Listens on the microphone for the wake phrase. `MicrophoneWakeWordListener` is the real one.
@MainActor
protocol WakeWordListening: AnyObject {
  var onWake: (@MainActor (WakeCommand) -> Void)? { get set }
  var isRunning: Bool { get }
  /// The microphone in use while running, e.g. the glasses' name.
  var inputName: String? { get }
  func start() async throws
  func stop()
}

enum WakeWordError: Error, Equatable {
  case microphoneDenied
  case modelMissing
  case audioUnavailable(code: Int)

  var message: String {
    switch self {
    case .microphoneDenied: "Microphone access is off for Glasses Lab in iOS Settings."
    case .modelMissing: "The wake phrase model is missing from this build."
    case .audioUnavailable(let code): "The microphone didn't start (\(code))."
    }
  }
}

/// What the wake option is doing, for the Live screen.
enum WakeWordState: Equatable, Sendable {
  case off
  case starting
  /// The phone is listening for the phrase. Nothing is sent.
  case waiting(input: String?)
  /// The phrase was heard (or a check was asked for): the stream is on for a bounded time.
  case awake
  /// On, but not armed right now. The text says why.
  case blocked(String)
  case unavailable(String)

  var isWaiting: Bool {
    if case .waiting = self { return true }
    return false
  }

  var title: String {
    switch self {
    case .off: "Off"
    case .starting: "Starting…"
    case .waiting: "Waiting for “\(WakePhrase.spoken)”"
    case .awake: "Awake"
    case .blocked: "Paused"
    case .unavailable: "Unavailable"
    }
  }

  var detail: String? {
    switch self {
    case .off, .starting: nil
    case .waiting(let input):
      "Glasses stream off. Nothing you say is sent until the phrase is heard on this phone."
        + (input.map { " Microphone: \($0)." } ?? "")
    case .awake: "Listening for a short while, then back to waiting."
    case .blocked(let reason), .unavailable(let reason): reason
    }
  }
}
