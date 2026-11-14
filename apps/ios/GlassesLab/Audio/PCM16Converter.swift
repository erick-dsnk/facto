import AVFoundation

/// Turns whatever the DAT stream (or any other source) delivers into 16 kHz mono PCM16
/// little-endian bytes, the only format the backend accepts.
///
/// Ray-Ban Meta Gen 2 stream audio arrives as 16 kHz, 1 channel, Float32, which takes the
/// fast path below. Other formats go through `AVAudioConverter` (resampling and downmixing)
/// first, so the backend always gets real sample conversion.
///
/// Not thread-safe: use one instance from one thread or actor. Call `reset()` when a stream
/// generation ends so resampler state never bridges a gap.
final class PCM16Converter {
  /// Intermediate format for the general path. Float32 keeps clipping in one place.
  static let intermediateFormat = AVAudioFormat(
    commonFormat: .pcmFormatFloat32,
    sampleRate: Double(AudioWireFormat.sampleRateHz),
    channels: AVAudioChannelCount(AudioWireFormat.channels),
    interleaved: false
  )!

  private var converter: AVAudioConverter?
  private var converterInputFormat: AVAudioFormat?

  init() {}

  /// Drops resampler state, e.g. at the start of a new stream generation.
  func reset() {
    converter?.reset()
  }

  /// PCM16 little-endian bytes for `buffer`, or nil when the buffer is empty or unreadable.
  func convert(_ buffer: AVAudioPCMBuffer) -> Data? {
    let frames = Int(buffer.frameLength)
    guard frames > 0 else { return nil }
    let format = buffer.format

    if format.sampleRate == Double(AudioWireFormat.sampleRateHz), format.channelCount == 1 {
      switch format.commonFormat {
      case .pcmFormatFloat32:
        if let samples = buffer.floatChannelData?[0] {
          return Self.pcm16LittleEndian(UnsafeBufferPointer(start: samples, count: frames))
        }
      case .pcmFormatInt16:
        if let samples = buffer.int16ChannelData?[0] {
          return Self.pcm16LittleEndian(UnsafeBufferPointer(start: samples, count: frames))
        }
      default:
        break
      }
    }
    return convertGeneral(buffer)
  }

  // MARK: Sample encoding

  /// One Float32 sample in [-1, 1] to Int16. Out-of-range values clip; NaN becomes silence.
  /// Scales by 32,767 so +1.0 and -1.0 map to +32,767 and -32,767.
  static func int16(from sample: Float) -> Int16 {
    guard sample.isFinite else { return sample.isNaN ? 0 : (sample > 0 ? Int16.max : -Int16.max) }
    let clipped = min(max(sample, -1), 1)
    return Int16((clipped * Float(Int16.max)).rounded())
  }

  static func pcm16LittleEndian(_ samples: UnsafeBufferPointer<Float>) -> Data {
    var data = Data(count: samples.count * AudioWireFormat.bytesPerSample)
    data.withUnsafeMutableBytes { raw in
      for (index, sample) in samples.enumerated() {
        let bits = UInt16(bitPattern: int16(from: sample))
        raw[index * 2] = UInt8(truncatingIfNeeded: bits)
        raw[index * 2 + 1] = UInt8(truncatingIfNeeded: bits >> 8)
      }
    }
    return data
  }

  static func pcm16LittleEndian(_ samples: UnsafeBufferPointer<Int16>) -> Data {
    var data = Data(count: samples.count * AudioWireFormat.bytesPerSample)
    data.withUnsafeMutableBytes { raw in
      for (index, sample) in samples.enumerated() {
        let bits = UInt16(bitPattern: sample)
        raw[index * 2] = UInt8(truncatingIfNeeded: bits)
        raw[index * 2 + 1] = UInt8(truncatingIfNeeded: bits >> 8)
      }
    }
    return data
  }

  // MARK: General path

  private func convertGeneral(_ buffer: AVAudioPCMBuffer) -> Data? {
    let target = Self.intermediateFormat
    if converter == nil || converterInputFormat != buffer.format {
      converter = AVAudioConverter(from: buffer.format, to: target)
      converter?.downmix = true
      converterInputFormat = buffer.format
    }
    guard let converter, buffer.format.sampleRate > 0 else { return nil }

    let ratio = target.sampleRate / buffer.format.sampleRate
    let capacity = AVAudioFrameCount((Double(buffer.frameLength) * ratio).rounded(.up)) + 64
    guard let output = AVAudioPCMBuffer(pcmFormat: target, frameCapacity: capacity) else { return nil }

    var supplied = false
    var error: NSError?
    let status = converter.convert(to: output, error: &error) { _, inputStatus in
      if supplied {
        inputStatus.pointee = .noDataNow
        return nil
      }
      supplied = true
      inputStatus.pointee = .haveData
      return buffer
    }
    guard status != .error, error == nil, output.frameLength > 0, let samples = output.floatChannelData?[0] else {
      return nil
    }
    return Self.pcm16LittleEndian(UnsafeBufferPointer(start: samples, count: Int(output.frameLength)))
  }
}
