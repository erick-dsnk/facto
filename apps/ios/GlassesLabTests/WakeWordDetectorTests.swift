import AVFoundation
import XCTest
@testable import GlassesLab

/// Runs the bundled "Hey Facto" model on synthesised speech (macOS `say`, six voices, 16 kHz
/// mono). Clips named `wake-…` contain the phrase; clips named `other-…` are near misses and
/// ordinary speech. The clips are fed in 100 ms pieces, as the microphone delivers them.
final class WakeWordDetectorTests: XCTestCase {
  private func clips(prefix: String, count: Int = 6) throws -> [URL] {
    let bundle = Bundle(for: WakeWordDetectorTests.self)
    let folder = try XCTUnwrap(bundle.resourceURL?.appendingPathComponent("Fixtures/WakeWord"))
    let urls = try FileManager.default.contentsOfDirectory(at: folder, includingPropertiesForKeys: nil)
      .filter { $0.pathExtension == "wav" && $0.lastPathComponent.hasPrefix(prefix) }
      .sorted { $0.lastPathComponent < $1.lastPathComponent }
    XCTAssertEqual(urls.count, count, "expected \(count) \(prefix) clips")
    return urls
  }

  private func samples(_ url: URL) throws -> [Float] {
    let file = try AVAudioFile(forReading: url)
    XCTAssertEqual(file.processingFormat.sampleRate, Double(WakePhrase.sampleRate))
    XCTAssertEqual(file.processingFormat.channelCount, 1)
    let buffer = try XCTUnwrap(AVAudioPCMBuffer(pcmFormat: file.processingFormat, frameCapacity: AVAudioFrameCount(file.length)))
    try file.read(into: buffer)
    let channel = try XCTUnwrap(buffer.floatChannelData?[0])
    return Array(UnsafeBufferPointer(start: channel, count: Int(buffer.frameLength)))
  }

  /// How many times the detector fires over one clip, with silence before and after.
  private func detections(in url: URL, detector: KeywordDetecting) throws -> Int {
    detector.reset()
    let audio = [Float](repeating: 0, count: 4_800) + (try samples(url)) + [Float](repeating: 0, count: 16_000)
    var count = 0
    var start = 0
    while start < audio.count {
      let end = min(start + 1_600, audio.count)
      if detector.accept(Array(audio[start..<end])) { count += 1 }
      start = end
    }
    return count
  }

  func testHeyFactoIsHeardInEveryVoice() throws {
    let detector = try SherpaKeywordDetector()
    for url in try clips(prefix: "wake-") {
      XCTAssertEqual(try detections(in: url, detector: detector), 1, url.lastPathComponent)
    }
  }

  func testSimilarPhrasesAndOrdinarySpeechDoNotWake() throws {
    let detector = try SherpaKeywordDetector()
    for url in try clips(prefix: "other-", count: 7) {
      XCTAssertEqual(try detections(in: url, detector: detector), 0, url.lastPathComponent)
    }
  }

  // MARK: "Hey Facto" versus "Hey Facto, check this"

  /// The command the two real detectors produce for one clip, fed as the microphone would.
  private func command(in url: URL, recognizer: WakePhraseRecognizer) throws -> WakeCommand? {
    recognizer.reset()
    let audio = [Float](repeating: 0, count: 4_800) + (try samples(url)) + [Float](repeating: 0, count: 40_000)
    var start = 0
    while start < audio.count {
      let end = min(start + 1_600, audio.count)
      if let command = recognizer.accept(Array(audio[start..<end])) { return command }
      start = end
    }
    return nil
  }

  private func makeRecognizer() throws -> WakePhraseRecognizer {
    WakePhraseRecognizer(wake: try SherpaKeywordDetector.wake(), command: try SherpaKeywordDetector.command())
  }

  func testHeyFactoAloneMeansListen() throws {
    let recognizer = try makeRecognizer()
    for url in try clips(prefix: "wake-hey-facto", count: 3) {
      XCTAssertEqual(try command(in: url, recognizer: recognizer), .listen, url.lastPathComponent)
    }
  }

  func testHeyFactoCheckThisMeansCheck() throws {
    let recognizer = try makeRecognizer()
    let urls = try clips(prefix: "command-", count: 2) + (try clips(prefix: "wake-check-this", count: 2))
    for url in urls {
      XCTAssertEqual(try command(in: url, recognizer: recognizer), .checkThis, url.lastPathComponent)
    }
  }

  func testCheckThisWithoutHeyFactoDoesNothing() throws {
    let recognizer = try makeRecognizer()
    for url in try clips(prefix: "other-", count: 7) {
      XCTAssertNil(try command(in: url, recognizer: recognizer), url.lastPathComponent)
    }
  }

  func testRecognizerWaitsForCheckThisBeforeDecidingToListen() {
    final class Scripted: KeywordDetecting {
      var hits: [Bool] = []
      func accept(_ samples: [Float]) -> Bool { hits.isEmpty ? false : hits.removeFirst() }
      func reset() {}
    }
    let wake = Scripted(), command = Scripted()
    let recognizer = WakePhraseRecognizer(wake: wake, command: command, commandWindow: 0.3)
    let piece = [Float](repeating: 0, count: 1_600)  // 100 ms

    // "Hey Facto", then nothing for the window: listen, decided only after the window.
    wake.hits = [true]
    XCTAssertNil(recognizer.accept(piece))
    XCTAssertNil(recognizer.accept(piece))
    XCTAssertEqual(recognizer.accept(piece), .listen)

    // "Hey Facto" and the full phrase 200 ms later: check, with no listen first.
    wake.hits = [true]
    command.hits = [false, false, true]
    XCTAssertNil(recognizer.accept(piece))
    XCTAssertNil(recognizer.accept(piece))
    XCTAssertEqual(recognizer.accept(piece), .checkThis)
    XCTAssertNil(recognizer.accept(piece), "one command per phrase")
  }

  func testTheDetectorKeepsWorkingAfterADetection() throws {
    let detector = try SherpaKeywordDetector()
    let wake = try XCTUnwrap(try clips(prefix: "wake-").first)
    let other = try XCTUnwrap(try clips(prefix: "other-", count: 7).first)
    XCTAssertEqual(try detections(in: wake, detector: detector), 1)
    XCTAssertEqual(try detections(in: other, detector: detector), 0)
    XCTAssertEqual(try detections(in: wake, detector: detector), 1)
  }

  func testResamplerTurnsPhoneAudioInto16kHzMono() throws {
    let format = try XCTUnwrap(AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate: 48_000, channels: 2, interleaved: false))
    let resampler = try XCTUnwrap(WakeAudioResampler(from: format))
    let buffer = try XCTUnwrap(AVAudioPCMBuffer(pcmFormat: format, frameCapacity: 4_800))
    buffer.frameLength = 4_800
    var total = 0
    // Ten 100 ms buffers of 48 kHz stereo come out as about one second at 16 kHz.
    for _ in 0..<10 { total += resampler.convert(buffer).count }
    XCTAssertEqual(Double(total), 16_000, accuracy: 400)
  }
}
