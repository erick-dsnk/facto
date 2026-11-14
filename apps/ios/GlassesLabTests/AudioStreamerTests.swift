import AVFoundation
import XCTest
@testable import GlassesLab

@MainActor
final class AudioStreamerTests: XCTestCase {
  private struct Harness {
    let channel: FakeSessionChannel
    let clock: ManualClock
    let streamer: AudioStreamer
  }

  private var stops: [AudioStreamerStopReason] = []
  private var resumes = 0

  private func makeHarness(state: ChannelConnectionState = .connected) -> Harness {
    let channel = FakeSessionChannel()
    channel.connectionState = state
    let clock = ManualClock()
    let streamer = AudioStreamer(channel: channel, clock: clock)
    stops = []
    resumes = 0
    streamer.onStopped = { [unowned self] in self.stops.append($0) }
    streamer.onAutoResumed = { [unowned self] in self.resumes += 1 }
    return Harness(channel: channel, clock: clock, streamer: streamer)
  }

  /// PCM16 bytes for `ms` milliseconds at 16 kHz mono.
  private func pcm(ms: Int, fill: UInt8 = 0x11) -> Data {
    Data(repeating: fill, count: ms * 32)
  }

  /// Header fields of a sent frame: (generation, sequence, captureOffsetMs).
  private func header(_ frame: Data) -> (UInt32, UInt32, UInt32) {
    let bytes = [UInt8](frame.prefix(13))
    func be(_ at: Int) -> UInt32 {
      UInt32(bytes[at]) << 24 | UInt32(bytes[at + 1]) << 16 | UInt32(bytes[at + 2]) << 8 | UInt32(bytes[at + 3])
    }
    XCTAssertEqual(bytes[0], 1)
    return (be(1), be(5), be(9))
  }

  private func startStreaming(_ harness: Harness) async {
    harness.streamer.start()
    harness.streamer.handle(AudioEvents.ready(generation: 1))
    await harness.streamer.waitUntilSent()
    XCTAssertEqual(harness.streamer.phase, .streaming(generation: 1))
    harness.channel.clearSent()
  }

  // MARK: Handshake

  func testAudioStartMatchesTheContractAndFramesWaitForReady() async throws {
    let h = makeHarness()
    h.streamer.start()
    h.streamer.appendPCM16(pcm(ms: 200))
    await h.streamer.waitUntilSent()

    XCTAssertEqual(h.channel.timeline, ["control:audio.start"])
    let start = try XCTUnwrap(h.channel.controls.first)
    XCTAssertEqual(start["type"] as? String, "audio.start")
    XCTAssertEqual(start["sessionEpoch"] as? Int, 1)
    XCTAssertEqual(start["streamGeneration"] as? Int, 1)
    XCTAssertEqual(start["encoding"] as? String, "pcm_s16le")
    XCTAssertEqual(start["sampleRateHz"] as? Int, 16_000)
    XCTAssertEqual(start["channels"] as? Int, 1)
    XCTAssertEqual(start["source"] as? String, "glasses_stream_audio")
    XCTAssertEqual(start.count, 7)
    XCTAssertEqual(h.streamer.phase, .awaitingReady(generation: 1))

    h.streamer.handle(AudioEvents.ready(generation: 1))
    h.streamer.appendPCM16(pcm(ms: 40))
    await h.streamer.waitUntilSent()

    let frames = h.channel.binaries
    XCTAssertEqual(frames.count, 6)
    for (index, frame) in frames.enumerated() {
      XCTAssertEqual(frame.count, 1_293)
      let (generation, sequence, offset) = header(frame)
      XCTAssertEqual(generation, 1)
      XCTAssertEqual(sequence, UInt32(index))
      XCTAssertEqual(offset, UInt32(index * 40))
    }
    XCTAssertEqual(h.channel.timeline.first, "control:audio.start")
  }

  func testReadyForAnotherGenerationDoesNotOpenTheGate() async {
    let h = makeHarness()
    h.streamer.start()
    h.streamer.appendPCM16(pcm(ms: 80))
    h.streamer.handle(AudioEvents.ready(generation: 7))
    await h.streamer.waitUntilSent()
    XCTAssertEqual(h.streamer.phase, .awaitingReady(generation: 1))
    XCTAssertTrue(h.channel.binaries.isEmpty)
  }

  func testWaitingBuffersAtMostTwoSecondsThenRestartsAHigherGeneration() async {
    let h = makeHarness()
    h.streamer.start()
    await h.streamer.waitUntilSent()
    h.streamer.appendPCM16(pcm(ms: 2_000))
    XCTAssertEqual(h.streamer.phase, .awaitingReady(generation: 1), "exactly 2 s still fits")

    h.streamer.appendPCM16(pcm(ms: 40))
    XCTAssertEqual(h.streamer.phase, .awaitingReady(generation: 2))
    await h.streamer.waitUntilSent()
    XCTAssertEqual(h.channel.timeline, ["control:audio.start", "control:audio.stop", "control:audio.start"])
    XCTAssertEqual(h.channel.controls.last?["streamGeneration"] as? Int, 2)
    XCTAssertTrue(h.channel.binaries.isEmpty)

    // The new generation starts from scratch: nothing from before the gap is spliced in.
    h.streamer.handle(AudioEvents.ready(generation: 2))
    h.streamer.appendPCM16(pcm(ms: 40))
    await h.streamer.waitUntilSent()
    XCTAssertEqual(h.channel.binaries.count, 1)
    let (generation, sequence, offset) = header(h.channel.binaries[0])
    XCTAssertEqual(generation, 2)
    XCTAssertEqual(sequence, 0)
    XCTAssertEqual(offset, 0)
  }

  func testDatFloatBuffersAreConvertedBeforeFraming() async throws {
    let h = makeHarness()
    await startStreaming(h)
    let format = try XCTUnwrap(AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate: 16_000, channels: 1, interleaved: false))
    let buffer = try XCTUnwrap(AVAudioPCMBuffer(pcmFormat: format, frameCapacity: 640))
    buffer.frameLength = 640
    let samples = try XCTUnwrap(buffer.floatChannelData?[0])
    for index in 0..<640 { samples[index] = 0 }
    samples[0] = 0.5
    samples[1] = -2
    h.streamer.append(buffer)
    await h.streamer.waitUntilSent()

    let frame = try XCTUnwrap(h.channel.binaries.first)
    XCTAssertEqual(frame.count, 1_293)
    XCTAssertEqual([UInt8](frame[frame.startIndex + 13..<frame.startIndex + 17]), [0x00, 0x40, 0x01, 0x80])
  }

  func testStartRejectionSendsStopAndAHigherGeneration() async {
    let h = makeHarness()
    h.streamer.start()
    await h.streamer.waitUntilSent()
    h.streamer.handle(AudioEvents.error("ocr_failed", requestId: "req-1"))
    XCTAssertEqual(h.streamer.phase, .awaitingReady(generation: 1), "check errors are not audio errors")

    h.streamer.handle(AudioEvents.error("audio_already_started"))
    await h.streamer.waitUntilSent()
    XCTAssertEqual(h.streamer.phase, .awaitingReady(generation: 2))
    XCTAssertEqual(h.channel.timeline, ["control:audio.start", "control:audio.stop", "control:audio.start"])
  }

  func testSessionWithoutAsrStopsWithReason() {
    let h = makeHarness()
    h.streamer.start()
    h.streamer.handle(AudioEvents.sessionReady(active: true, audio: false, epoch: 1))
    XCTAssertEqual(h.streamer.phase, .stopped(.audioUnavailable(reasonCode: "asr_unavailable")))
    XCTAssertEqual(stops, [.audioUnavailable(reasonCode: "asr_unavailable")])
  }

  // MARK: Generation rules

  func testGenerationsStayStrictlyIncreasingAcrossStopAndStart() async {
    let h = makeHarness()
    h.streamer.start()
    await h.streamer.waitUntilSent()
    h.streamer.stop()
    h.streamer.start()
    await h.streamer.waitUntilSent()
    XCTAssertEqual(h.channel.controls.compactMap { $0["streamGeneration"] as? Int }, [1, 2])
  }

  func testPlaybackClosesTheGenerationAndPlaybackEndOpensAHigherOne() async {
    let h = makeHarness()
    await startStreaming(h)

    h.streamer.playbackStarted()
    XCTAssertEqual(h.streamer.phase, .pausedForPlayback)
    h.streamer.appendPCM16(pcm(ms: 400))
    h.streamer.handle(AudioEvents.stopped(generation: 1, reason: "playback"))
    XCTAssertEqual(h.streamer.phase, .pausedForPlayback, "the server's own playback stop is expected")

    h.streamer.playbackEnded()
    await h.streamer.waitUntilSent()
    XCTAssertEqual(h.channel.timeline, ["control:playback.started", "control:playback.ended", "control:audio.start"])
    XCTAssertEqual(h.channel.controls.last?["streamGeneration"] as? Int, 2)
    XCTAssertEqual(h.streamer.phase, .awaitingReady(generation: 2))
    XCTAssertTrue(h.channel.binaries.isEmpty)
  }

  func testServerStopRestartsWithinBudgetThenGivesUp() async {
    let h = makeHarness()
    await startStreaming(h)

    h.streamer.handle(AudioEvents.stopped(generation: 1, reason: "asr_failed"))
    XCTAssertEqual(h.streamer.phase, .awaitingReady(generation: 2))
    // The server follows its own stop with one pipeline.error; it must not cost a restart.
    h.streamer.handle(AudioEvents.error("asr_unavailable"))
    XCTAssertEqual(h.streamer.phase, .awaitingReady(generation: 2))
    // Stale stops for older generations are ignored.
    h.streamer.handle(AudioEvents.stopped(generation: 1, reason: "asr_failed"))
    XCTAssertEqual(h.streamer.phase, .awaitingReady(generation: 2))

    h.streamer.handle(AudioEvents.stopped(generation: 2, reason: "asr_failed"))
    h.streamer.handle(AudioEvents.stopped(generation: 3, reason: "asr_failed"))
    XCTAssertEqual(h.streamer.phase, .awaitingReady(generation: 4))
    h.streamer.handle(AudioEvents.stopped(generation: 4, reason: "asr_failed"))
    XCTAssertEqual(h.streamer.phase, .stopped(.audioUnavailable(reasonCode: "asr_failed")))
    XCTAssertEqual(stops, [.audioUnavailable(reasonCode: "asr_failed")])

    await h.streamer.waitUntilSent()
    XCTAssertFalse(h.channel.controlTypes.contains("audio.stop"), "the server already closed those generations")
  }

  func testAStopWithoutTrailingErrorDoesNotSwallowTheNextRejection() async {
    let h = makeHarness()
    await startStreaming(h)
    h.streamer.handle(AudioEvents.stopped(generation: 1, reason: "stopped"))
    XCTAssertEqual(h.streamer.phase, .awaitingReady(generation: 2))
    await h.streamer.waitUntilSent()
    h.streamer.handle(AudioEvents.error("playback_active"))
    XCTAssertEqual(h.streamer.phase, .awaitingReady(generation: 3))
  }

  func testRestartBudgetRefillsAfterTheWindow() {
    let h = makeHarness()
    h.streamer.start()
    for generation in 1...3 {
      h.streamer.handle(AudioEvents.stopped(generation: generation, reason: "asr_failed"))
    }
    h.clock.advance(by: 31)
    h.streamer.handle(AudioEvents.stopped(generation: 4, reason: "asr_failed"))
    XCTAssertEqual(h.streamer.phase, .awaitingReady(generation: 5))
  }

  func testSendBacklogOverTwoSecondsRestarts() async {
    let h = makeHarness()
    await startStreaming(h)
    h.streamer.appendPCM16(pcm(ms: 2_000))
    XCTAssertEqual(h.streamer.phase, .streaming(generation: 1))
    h.streamer.appendPCM16(pcm(ms: 40))
    XCTAssertEqual(h.streamer.phase, .awaitingReady(generation: 2))
    await h.streamer.waitUntilSent()
    XCTAssertEqual(h.channel.timeline, ["control:audio.stop", "control:audio.start"], "queued frames are dropped, not sent late")
  }

  func testSendFailuresWhileConnectedEndWithinBudget() async {
    let h = makeHarness()
    await startStreaming(h)
    h.channel.failSends = true
    h.streamer.appendPCM16(pcm(ms: 40))
    await h.streamer.waitUntilSent()
    XCTAssertEqual(h.streamer.phase, .stopped(.audioUnavailable(reasonCode: "send_failed")))
    XCTAssertEqual(stops.count, 1)
  }

  // MARK: Stop reasons

  func testUserStopSendsAudioStopAndDropsLaterAudio() async {
    let h = makeHarness()
    await startStreaming(h)
    h.streamer.stop()
    h.streamer.appendPCM16(pcm(ms: 400))
    await h.streamer.waitUntilSent()
    XCTAssertEqual(h.channel.timeline, ["control:audio.stop"])
    XCTAssertEqual(h.channel.controls.first?["sessionEpoch"] as? Int, 1)
    XCTAssertEqual(h.streamer.phase, .stopped(.requested))
    XCTAssertEqual(stops, [.requested])
    XCTAssertNil(AudioStreamerStopReason.requested.spokenMessage)
  }

  func testGlassesDisconnectStopsWithReason() async {
    let h = makeHarness()
    await startStreaming(h)
    h.streamer.glassesDisconnected()
    await h.streamer.waitUntilSent()
    XCTAssertEqual(h.channel.timeline, ["control:audio.stop"])
    XCTAssertEqual(stops, [.glassesDisconnected])
    XCTAssertNotNil(AudioStreamerStopReason.glassesDisconnected.spokenMessage)
  }

  func testSessionEndedStopsButADisconnectNoticeStartsTheGraceWindow() async {
    let h = makeHarness()
    await startStreaming(h)
    h.streamer.handle(AudioEvents.sessionEnded(reason: "disconnected"))
    XCTAssertEqual(h.streamer.phase, .reconnecting)

    let other = makeHarness()
    await startStreaming(other)
    other.streamer.handle(AudioEvents.sessionEnded(reason: "paused"))
    XCTAssertEqual(other.streamer.phase, .stopped(.sessionEnded(reasonCode: "paused")))
  }

  // MARK: Decision 9: reconnect

  func testReconnectWithinFiveSecondsResumesWithAHigherGenerationAndChimes() async {
    let h = makeHarness()
    h.streamer.start()
    h.streamer.appendPCM16(pcm(ms: 200)) // buffered while waiting for audio.ready
    await h.streamer.waitUntilSent()
    h.channel.clearSent()

    h.channel.connectionState = .reconnecting(attempt: 1)
    h.streamer.handle(ChannelConnectionState.reconnecting(attempt: 1))
    XCTAssertEqual(h.streamer.phase, .reconnecting)
    h.streamer.appendPCM16(pcm(ms: 400)) // audio from the gap
    h.clock.advance(by: 3)

    // The server paused the session on disconnect and bumped the epoch.
    h.channel.connectionState = .connected
    h.channel.sessionEpoch = 2
    h.streamer.handle(ChannelConnectionState.connected)
    XCTAssertEqual(h.streamer.phase, .reconnecting, "waits for session.ready to learn the epoch")
    h.streamer.handle(AudioEvents.sessionReady(active: false, epoch: 2))
    await h.streamer.waitUntilSent()

    XCTAssertEqual(h.channel.timeline, ["control:session.resume", "control:audio.start"])
    XCTAssertEqual(h.channel.controls[0]["sessionEpoch"] as? Int, 2)
    XCTAssertEqual(h.channel.controls[1]["sessionEpoch"] as? Int, 2)
    XCTAssertEqual(h.channel.controls[1]["streamGeneration"] as? Int, 2)
    XCTAssertEqual(resumes, 1)

    h.streamer.handle(AudioEvents.ready(generation: 2, epoch: 2))
    await h.streamer.waitUntilSent()
    XCTAssertTrue(h.channel.binaries.isEmpty, "audio from before and during the gap is discarded")

    h.streamer.appendPCM16(pcm(ms: 40))
    await h.streamer.waitUntilSent()
    let (generation, sequence, offset) = header(h.channel.binaries[0])
    XCTAssertEqual([generation, sequence, offset], [2, 0, 0])

    h.clock.advance(by: 10)
    XCTAssertEqual(h.streamer.phase, .streaming(generation: 2), "the give-up timer was cancelled")
    XCTAssertTrue(stops.isEmpty)
  }

  func testOutageLongerThanFiveSecondsStopsWithNoConnection() async {
    let h = makeHarness()
    await startStreaming(h)
    h.channel.connectionState = .disconnected(reason: "network_lost")
    h.streamer.handle(ChannelConnectionState.disconnected(reason: "network_lost"))
    h.clock.advance(by: 4.9)
    XCTAssertEqual(h.streamer.phase, .reconnecting)
    h.clock.advance(by: 0.2)
    XCTAssertEqual(h.streamer.phase, .stopped(.noConnection))
    XCTAssertEqual(stops, [.noConnection])
    XCTAssertEqual(AudioStreamerStopReason.noConnection.spokenMessage, "No connection. Listening stopped.")

    // A late reconnect does not restart listening on its own.
    h.channel.connectionState = .connected
    h.streamer.handle(AudioEvents.sessionReady(active: false, epoch: 2))
    await h.streamer.waitUntilSent()
    XCTAssertTrue(h.channel.sent.isEmpty)
    XCTAssertEqual(resumes, 0)
  }

  func testReconnectDuringPlaybackResumesWithoutOpeningAGeneration() async {
    let h = makeHarness()
    await startStreaming(h)
    h.streamer.playbackStarted()
    h.channel.connectionState = .reconnecting(attempt: 1)
    h.streamer.handle(ChannelConnectionState.reconnecting(attempt: 1))
    await h.streamer.waitUntilSent()
    h.channel.clearSent()

    h.channel.connectionState = .connected
    h.streamer.handle(AudioEvents.sessionReady(active: false, epoch: 2))
    await h.streamer.waitUntilSent()
    XCTAssertEqual(h.channel.timeline, ["control:session.resume", "control:playback.started"])
    XCTAssertEqual(h.streamer.phase, .pausedForPlayback)

    h.streamer.playbackEnded()
    await h.streamer.waitUntilSent()
    XCTAssertEqual(h.channel.timeline.suffix(2), ["control:playback.ended", "control:audio.start"])
    XCTAssertEqual(h.channel.controls.last?["streamGeneration"] as? Int, 2)
  }

  func testStartWhileConnectingWaitsForTheChannel() async {
    let h = makeHarness(state: .connecting)
    h.streamer.start()
    XCTAssertEqual(h.streamer.phase, .waitingForConnection)
    h.channel.connectionState = .connected
    h.streamer.handle(ChannelConnectionState.connected)
    await h.streamer.waitUntilSent()
    XCTAssertEqual(h.channel.timeline, ["control:audio.start"])
    XCTAssertEqual(resumes, 0, "a first start is not a resume")

    let late = makeHarness(state: .connecting)
    late.streamer.start()
    late.clock.advance(by: 5)
    XCTAssertEqual(late.streamer.phase, .stopped(.noConnection))
  }

  // MARK: Subscription wiring

  func testStreamerListensToTheChannelStreams() async {
    let h = makeHarness()
    h.streamer.start()
    h.channel.emit(AudioEvents.ready(generation: 1))
    for _ in 0..<200 where h.streamer.phase != .streaming(generation: 1) { await Task.yield() }
    XCTAssertEqual(h.streamer.phase, .streaming(generation: 1))

    h.channel.setState(.reconnecting(attempt: 1))
    for _ in 0..<200 where h.streamer.phase != .reconnecting { await Task.yield() }
    XCTAssertEqual(h.streamer.phase, .reconnecting)
  }
}
