import Foundation

/// Binary audio framing from contract v1 (packages/contracts/README.md, "Audio / ASR seam").
///
/// Each WebSocket binary message is a 13-byte header followed by PCM16 little-endian samples:
///
/// | Offset | Format            | Value                                   |
/// | ------ | ----------------- | --------------------------------------- |
/// | 0      | uint8             | Version, always 1                       |
/// | 1      | big-endian uint32 | Stream generation                       |
/// | 5      | big-endian uint32 | Sequence, starting at 0                 |
/// | 9      | big-endian uint32 | Capture offset in ms, starting at 0     |
/// | 13     | PCM16 LE bytes    | 20 to 200 ms, integral milliseconds     |
///
/// The app always sends 40 ms frames: 640 samples, 1,280 payload bytes, 1,293 bytes in total.
enum AudioWireFormat {
  static let version: UInt8 = 1
  static let headerBytes = 13
  static let sampleRateHz = 16_000
  static let channels = 1
  static let bytesPerSample = 2
  static let frameDurationMs = 40
  /// 16,000 Hz x 0.040 s.
  static let samplesPerFrame = sampleRateHz * frameDurationMs / 1_000
  /// 640 samples x 2 bytes.
  static let payloadBytes = samplesPerFrame * bytesPerSample
  static let frameBytes = headerBytes + payloadBytes
  /// Most audio the app holds for one generation, while waiting for `audio.ready` or for the
  /// socket to drain. Matches the server's two-second backlog.
  static let maxBufferedMs = 2_000
  static let maxBufferedFrames = maxBufferedMs / frameDurationMs

  /// The 13-byte header with every multi-byte field in big-endian order.
  static func header(generation: UInt32, sequence: UInt32, captureOffsetMs: UInt32) -> Data {
    var bytes = Data(capacity: headerBytes)
    bytes.append(version)
    appendBigEndian(generation, to: &bytes)
    appendBigEndian(sequence, to: &bytes)
    appendBigEndian(captureOffsetMs, to: &bytes)
    return bytes
  }

  /// Header plus payload, ready for `SessionChannel.sendBinary`.
  static func frame(generation: UInt32, sequence: UInt32, captureOffsetMs: UInt32, payload: Data) -> Data {
    var bytes = header(generation: generation, sequence: sequence, captureOffsetMs: captureOffsetMs)
    bytes.append(payload)
    return bytes
  }

  private static func appendBigEndian(_ value: UInt32, to data: inout Data) {
    data.append(UInt8(truncatingIfNeeded: value >> 24))
    data.append(UInt8(truncatingIfNeeded: value >> 16))
    data.append(UInt8(truncatingIfNeeded: value >> 8))
    data.append(UInt8(truncatingIfNeeded: value))
  }
}

/// Cuts a PCM16 byte stream into 40 ms wire frames for one stream generation.
///
/// Sequence starts at 0 and increments by one; the capture offset starts at 0 and advances by
/// exactly 40 ms per frame. A new generation needs a new framer: never carry bytes across.
struct PCM16Framer {
  let generation: UInt32
  private(set) var nextSequence: UInt32 = 0
  private(set) var nextCaptureOffsetMs: UInt32 = 0
  private var pending = Data()

  init(generation: UInt32) {
    self.generation = generation
  }

  /// Bytes waiting for the rest of their frame.
  var pendingByteCount: Int { pending.count }

  /// Appends PCM16 little-endian bytes and returns every complete frame, in order.
  mutating func append(_ pcm: Data) -> [Data] {
    pending.append(pcm)
    let payloadBytes = AudioWireFormat.payloadBytes
    var frames: [Data] = []
    var start = pending.startIndex
    while pending.endIndex - start >= payloadBytes {
      let payload = pending.subdata(in: start..<(start + payloadBytes))
      frames.append(AudioWireFormat.frame(
        generation: generation,
        sequence: nextSequence,
        captureOffsetMs: nextCaptureOffsetMs,
        payload: payload
      ))
      start += payloadBytes
      nextSequence &+= 1
      nextCaptureOffsetMs &+= UInt32(AudioWireFormat.frameDurationMs)
    }
    if start != pending.startIndex {
      pending = pending.subdata(in: start..<pending.endIndex)
    }
    return frames
  }
}
