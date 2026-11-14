import Foundation
import SherpaOnnxC

/// "Hey Facto" detector backed by sherpa-onnx keyword spotting (Apache-2.0), through its C API.
/// The model is the open-vocabulary English zipformer
/// `sherpa-onnx-kws-zipformer-gigaspeech-3.3M-2024-01-01` (int8, about 5 MB) in `WakeWord/Model`.
/// A phrase is set in a keywords file as the model's BPE tokens with a boost and a trigger
/// threshold: `heyfacto-keywords.txt` holds "Hey Facto", `heyfacto-command-keywords.txt` holds
/// the full "Hey Facto, check this".
///
/// Runs entirely on the phone: it opens no sockets and writes no files.
final class SherpaKeywordDetector: KeywordDetecting {
  private let spotter: OpaquePointer
  private let stream: OpaquePointer

  /// The detector for "Hey Facto".
  static func wake(bundle: Bundle = .main) throws -> SherpaKeywordDetector {
    try SherpaKeywordDetector(keywords: "heyfacto-keywords", bundle: bundle)
  }

  /// The detector for the whole "Hey Facto, check this".
  static func command(bundle: Bundle = .main) throws -> SherpaKeywordDetector {
    try SherpaKeywordDetector(keywords: "heyfacto-command-keywords", bundle: bundle)
  }

  init(keywords: String = "heyfacto-keywords", bundle: Bundle = .main) throws {
    func path(_ name: String, _ type: String) throws -> String {
      guard let path = bundle.path(forResource: name, ofType: type) else { throw WakeWordError.modelMissing }
      return path
    }
    // The C strings only need to live until the spotter is created; it copies what it needs.
    let strings = [
      try path("heyfacto-encoder", "onnx"), try path("heyfacto-decoder", "onnx"), try path("heyfacto-joiner", "onnx"),
      try path("heyfacto-tokens", "txt"), try path(keywords, "txt"), "cpu",
    ].map { (text: String) -> UnsafeMutablePointer<CChar>? in strdup(text) }
    defer { strings.forEach { free($0) } }

    var config = SherpaOnnxKeywordSpotterConfig()
    config.feat_config.sample_rate = Int32(WakePhrase.sampleRate)
    config.feat_config.feature_dim = 80
    config.model_config.transducer.encoder = UnsafePointer(strings[0])
    config.model_config.transducer.decoder = UnsafePointer(strings[1])
    config.model_config.transducer.joiner = UnsafePointer(strings[2])
    config.model_config.tokens = UnsafePointer(strings[3])
    config.model_config.provider = UnsafePointer(strings[5])
    config.model_config.num_threads = 1
    config.max_active_paths = 4
    config.num_trailing_blanks = 1
    // Defaults for keywords without their own values; the keywords file sets both.
    config.keywords_score = 1.0
    config.keywords_threshold = 0.25
    config.keywords_file = UnsafePointer(strings[4])

    guard let spotter = SherpaOnnxCreateKeywordSpotter(&config) else { throw WakeWordError.modelMissing }
    guard let stream = SherpaOnnxCreateKeywordStream(spotter) else {
      SherpaOnnxDestroyKeywordSpotter(spotter)
      throw WakeWordError.modelMissing
    }
    self.spotter = spotter
    self.stream = stream
  }

  deinit {
    SherpaOnnxDestroyOnlineStream(stream)
    SherpaOnnxDestroyKeywordSpotter(spotter)
  }

  func accept(_ samples: [Float]) -> Bool {
    guard !samples.isEmpty else { return false }
    SherpaOnnxOnlineStreamAcceptWaveform(stream, Int32(WakePhrase.sampleRate), samples, Int32(samples.count))
    var heard = false
    while SherpaOnnxIsKeywordStreamReady(spotter, stream) == 1 {
      SherpaOnnxDecodeKeywordStream(spotter, stream)
      guard let result = SherpaOnnxGetKeywordResult(spotter, stream) else { continue }
      let found = result.pointee.keyword.map { $0.pointee != 0 } ?? false
      SherpaOnnxDestroyKeywordResult(result)
      if found {
        // The stream must be reset right after a detection, or it keeps reporting it.
        SherpaOnnxResetKeywordStream(spotter, stream)
        heard = true
      }
    }
    return heard
  }

  func reset() {
    SherpaOnnxResetKeywordStream(spotter, stream)
  }
}
