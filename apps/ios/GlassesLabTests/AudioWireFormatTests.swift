import AVFoundation
import XCTest
@testable import GlassesLab

final class AudioWireFormatTests: XCTestCase {
  // MARK: Header

  func testConstantsMatchTheContract() {
    XCTAssertEqual(AudioWireFormat.headerBytes, 13)
    XCTAssertEqual(AudioWireFormat.samplesPerFrame, 640)
    XCTAssertEqual(AudioWireFormat.payloadBytes, 1_280)
    XCTAssertEqual(AudioWireFormat.frameBytes, 1_293)
    XCTAssertEqual(AudioWireFormat.maxBufferedFrames, 50)
    // Server rule: 640...6400 payload bytes, a multiple of 32 (integral milliseconds).
    XCTAssertEqual(AudioWireFormat.payloadBytes % 32, 0)
    XCTAssertEqual(AudioWireFormat.payloadBytes / 32, AudioWireFormat.frameDurationMs)
  }

  func testHeaderBytesForKnownValues() {
    let header = AudioWireFormat.header(generation: 0x0102_0304, sequence: 0x0A0B_0C0D, captureOffsetMs: 0xDEAD_BEEF)
    XCTAssertEqual([UInt8](header), [0x01, 0x01, 0x02, 0x03, 0x04, 0x0A, 0x0B, 0x0C, 0x0D, 0xDE, 0xAD, 0xBE, 0xEF])
  }

  func testFirstHeaderOfGenerationOne() {
    let header = AudioWireFormat.header(generation: 1, sequence: 0, captureOffsetMs: 0)
    XCTAssertEqual([UInt8](header), [1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0])
  }

  func testHeaderForSmallValuesIsBigEndian() {
    let header = AudioWireFormat.header(generation: 7, sequence: 300, captureOffsetMs: 12_000)
    // 300 = 0x012C, 12000 = 0x2EE0
    XCTAssertEqual([UInt8](header), [1, 0, 0, 0, 7, 0, 0, 0x01, 0x2C, 0, 0, 0x2E, 0xE0])
  }

  // MARK: Framing

  func testFramerCutsFortyMillisecondFramesAndAdvancesOffsets() {
    var framer = PCM16Framer(generation: 3)
    let pcm = Data((0..<3_000).map { UInt8(truncatingIfNeeded: $0) })

    XCTAssertEqual(framer.append(pcm.prefix(1_000)).count, 0)
    XCTAssertEqual(framer.pendingByteCount, 1_000)

    let frames = framer.append(pcm.suffix(from: 1_000))
    XCTAssertEqual(frames.count, 2)
    XCTAssertEqual(framer.pendingByteCount, 440)

    for (index, frame) in frames.enumerated() {
      XCTAssertEqual(frame.count, 1_293)
      XCTAssertEqual(frame.prefix(13), AudioWireFormat.header(
        generation: 3, sequence: UInt32(index), captureOffsetMs: UInt32(index * 40)
      ))
      XCTAssertEqual(Data(frame.suffix(from: frame.startIndex + 13)), pcm.subdata(in: (index * 1_280)..<((index + 1) * 1_280)))
    }
    XCTAssertEqual(framer.nextSequence, 2)
    XCTAssertEqual(framer.nextCaptureOffsetMs, 80)
  }

  func testTwoSecondsMakeFiftyFramesEndingAt1960Ms() {
    var framer = PCM16Framer(generation: 1)
    let frames = framer.append(Data(count: 2_000 * 32))
    XCTAssertEqual(frames.count, 50)
    let last = [UInt8](frames[49].prefix(13))
    XCTAssertEqual(Array(last[5..<9]), [0, 0, 0, 49])
    XCTAssertEqual(Array(last[9..<13]), [0, 0, 0x07, 0xA8]) // 1960
    XCTAssertEqual(framer.pendingByteCount, 0)
  }
}

final class PCM16ConverterTests: XCTestCase {
  private func samples(_ data: Data) -> [Int16] {
    stride(from: 0, to: data.count - 1, by: 2).map { offset in
      let low = UInt16(data[data.startIndex + offset])
      let high = UInt16(data[data.startIndex + offset + 1])
      return Int16(bitPattern: low | (high << 8))
    }
  }

  private func floatBuffer(_ values: [Float], sampleRate: Double = 16_000, channels: AVAudioChannelCount = 1) throws -> AVAudioPCMBuffer {
    let format = try XCTUnwrap(AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate: sampleRate, channels: channels, interleaved: false))
    let frames = values.count / Int(channels)
    let buffer = try XCTUnwrap(AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(max(frames, 1))))
    buffer.frameLength = AVAudioFrameCount(frames)
    for channel in 0..<Int(channels) {
      let pointer = try XCTUnwrap(buffer.floatChannelData?[channel])
      for frame in 0..<frames { pointer[frame] = values[frame * Int(channels) + channel] }
    }
    return buffer
  }

  func testFloatSamplesScaleRoundAndClip() {
    XCTAssertEqual(PCM16Converter.int16(from: 0), 0)
    XCTAssertEqual(PCM16Converter.int16(from: 1), 32_767)
    XCTAssertEqual(PCM16Converter.int16(from: -1), -32_767)
    XCTAssertEqual(PCM16Converter.int16(from: 0.5), 16_384)
    XCTAssertEqual(PCM16Converter.int16(from: -0.5), -16_384)
    XCTAssertEqual(PCM16Converter.int16(from: 0.25), 8_192)
    XCTAssertEqual(PCM16Converter.int16(from: 1.5), 32_767, "clips above +1")
    XCTAssertEqual(PCM16Converter.int16(from: -3), -32_767, "clips below -1")
    XCTAssertEqual(PCM16Converter.int16(from: .nan), 0)
    XCTAssertEqual(PCM16Converter.int16(from: .infinity), 32_767)
    XCTAssertEqual(PCM16Converter.int16(from: -.infinity), -32_767)
  }

  func testEncodingIsLittleEndian() {
    let data = [Float(0.5), -1].withUnsafeBufferPointer { PCM16Converter.pcm16LittleEndian($0) }
    // 16384 = 0x4000, -32767 = 0x8001
    XCTAssertEqual([UInt8](data), [0x00, 0x40, 0x01, 0x80])
  }

  func testDatFormatFloat32SixteenKilohertzMonoConvertsSampleForSample() throws {
    let converter = PCM16Converter()
    let data = try XCTUnwrap(converter.convert(floatBuffer([0, 0.5, -0.5, 1.2, -1.2, 0.25])))
    XCTAssertEqual(samples(data), [0, 16_384, -16_384, 32_767, -32_767, 8_192])
  }

  func testInt16SixteenKilohertzMonoPassesThrough() throws {
    let format = try XCTUnwrap(AVAudioFormat(commonFormat: .pcmFormatInt16, sampleRate: 16_000, channels: 1, interleaved: false))
    let buffer = try XCTUnwrap(AVAudioPCMBuffer(pcmFormat: format, frameCapacity: 3))
    buffer.frameLength = 3
    let pointer = try XCTUnwrap(buffer.int16ChannelData?[0])
    pointer[0] = 1; pointer[1] = -2; pointer[2] = 0x1234
    let data = try XCTUnwrap(PCM16Converter().convert(buffer))
    XCTAssertEqual([UInt8](data), [0x01, 0x00, 0xFE, 0xFF, 0x34, 0x12])
  }

  func testFortyEightKilohertzIsResampledToSixteen() throws {
    let input = (0..<4_800).map { Float(sin(Double($0) * 2 * .pi * 440 / 48_000)) * 0.5 }
    let data = try XCTUnwrap(PCM16Converter().convert(floatBuffer(input, sampleRate: 48_000)))
    let count = samples(data).count
    XCTAssertEqual(data.count % 2, 0)
    XCTAssertTrue((1_000...1_664).contains(count), "100 ms at 16 kHz is about 1,600 samples, got \(count)")
    XCTAssertLessThanOrEqual(samples(data).map { abs(Int($0)) }.max() ?? 0, 17_500)
  }

  func testStereoIsDownmixedToMono() throws {
    let interleaved = (0..<320).flatMap { _ in [Float(0.5), Float(0.5)] }
    let data = try XCTUnwrap(PCM16Converter().convert(floatBuffer(interleaved, channels: 2)))
    let count = samples(data).count
    XCTAssertTrue((200...330).contains(count), "expected about 320 mono samples, got \(count)")
  }

  func testEmptyBufferGivesNil() throws {
    XCTAssertNil(PCM16Converter().convert(try floatBuffer([])))
  }
}
