import AVFoundation
import MWDATCamera
import MWDATCore
import Observation
import QuartzCore
import UIKit

/// Device session + camera stream, with frame-rate and frame-gap stats for the spike.
@Observable
@MainActor
final class CameraModel {
  var sessionState: DeviceSessionState = .idle
  var streamState: StreamState = .stopped
  var frame: UIImage?
  var frameSize: CGSize = .zero
  var fps: Double = 0
  var maxGapMs: Double = 0
  var frameCount = 0
  var lastError: String?

  // Over the Wi-Fi link the glasses hold 720x1280 at 30 fps.
  var resolution: StreamingResolution = .high
  var frameRate: UInt = 30

  /// Ask the stream for glasses-microphone PCM (experimental DAT stream audio, the
  /// "ambient" route in the plan). Needs the DAT microphone permission in Meta AI.
  var captureStreamAudio = false
  /// Format the glasses actually deliver, e.g. "16000 Hz · 1 ch · Float32".
  var audioFormat: String?
  /// Live level of the glasses microphone, in dBFS.
  var audioLevelDb: Double = -160
  var audioBufferCount = 0

  /// Last full-quality still from the glasses, and how long it took to arrive.
  var photo: UIImage?
  var photoInfo: String?
  var isCapturingPhoto = false
  var photoStatus: String?
  /// Medium/medium keeps text legible at reading distance and transfers far faster than full/high.
  var photoResolution: PhotoResolution = .medium
  var photoQuality: PhotoQuality = .medium
  /// Instant alternative to a photo: the sharpest of the last stream frames, no transfer.
  var grabbedFrame: UIImage?
  var grabbedFrameInfo: String?
  @ObservationIgnored private var recentFrames: [UIImage] = []
  @ObservationIgnored private var firstProgressAt: CFTimeInterval = 0
  /// Step-by-step photo trace for debugging, newest first.
  var photoLog: [String] = []
  @ObservationIgnored private var photoPath: PhotoPath = .stream
  @ObservationIgnored private var photoRequestedAt: CFTimeInterval = 0
  @ObservationIgnored private let photoTokens = ListenerTokenBag()
  @ObservationIgnored private var photoTimeout: Task<Void, Never>?
  @ObservationIgnored private var photoAttempt = 0
  @ObservationIgnored private var didRequestCapture = false

  // Live mode hooks (LiveModel). Set once; both run on the main actor.
  /// Glasses-mic buffers, copied off the SDK thread. Only while "Glasses mic audio" is on.
  @ObservationIgnored var onAudioBuffer: (@MainActor (AVAudioPCMBuffer) -> Void)?
  /// The stream stopped. `byUser` is false when the glasses or the session dropped it.
  @ObservationIgnored var onStreamStopped: (@MainActor (_ byUser: Bool) -> Void)?
  @ObservationIgnored private var userStoppedStream = false
  /// Callers of `captureStillDuringStream()` waiting for the current photo.
  @ObservationIgnored private var photoWaiters: [CheckedContinuation<Data, Error>] = []

  var hasSession: Bool { session != nil }
  var isStreaming: Bool { camera != nil }
  /// True once the selector has picked a pair of glasses. Starting a session before
  /// this fails with "No eligible device available".
  var hasActiveDevice = false

  /// Created once and kept, as in Meta's CameraAccess sample. A selector made at tap
  /// time has not seen any device yet.
  @ObservationIgnored private let deviceSelector = AutoDeviceSelector(wearables: Wearables.shared)
  @ObservationIgnored private var session: DeviceSession?
  @ObservationIgnored private var camera: MWDATCamera.Camera?
  @ObservationIgnored private let sessionTokens = ListenerTokenBag()
  @ObservationIgnored private let streamTokens = ListenerTokenBag()
  @ObservationIgnored private var arrivals: [CFTimeInterval] = []

  /// Must be created after `Wearables.configure()`.
  init() {
    Task { [weak self] in
      guard let self else { return }
      for await deviceId in self.deviceSelector.activeDeviceStream() {
        self.hasActiveDevice = deviceId != nil
      }
    }
  }

  // MARK: Step 1: session

  func startSession() {
    guard session == nil else { return }
    lastError = nil
    do {
      let newSession = try Wearables.shared.createSession(deviceSelector: deviceSelector)
      session = newSession
      // Subscribe before start() so no transition is missed.
      newSession.statePublisher.listen { [weak self] state in
        Task { @MainActor in self?.handleSession(state) }
      }.store(in: sessionTokens)
      newSession.errorPublisher.listen { [weak self] error in
        Task { @MainActor in self?.lastError = "Session: \(error.localizedDescription)" }
      }.store(in: sessionTokens)
      sessionState = .starting
      try newSession.start()
    } catch {
      lastError = "Session: \(error.localizedDescription)"
      clearSession()
    }
  }

  func endSession() {
    userStoppedStream = true
    sessionState = .stopping
    session?.stop()
  }

  private func handleSession(_ state: DeviceSessionState) {
    sessionState = state
    if state == .stopped { clearSession() }
  }

  private func clearSession() {
    if isCapturingPhoto { failPhoto("The session ended during the photo.") }
    clearStream()
    sessionTokens.clear()
    session = nil
    sessionState = .idle
  }

  // MARK: Step 2: camera stream

  func startStream() async {
    guard let session, session.state == .started else {
      lastError = "Start a session first."
      return
    }
    guard camera == nil else { return }
    lastError = nil
    userStoppedStream = false
    do {
      // checkPermissionStatus is silent; requestPermission switches to the Meta AI app.
      if try await Wearables.shared.checkPermissionStatus(.camera) != .granted {
        guard try await Wearables.shared.requestPermission(.camera) == .granted else {
          lastError = "Camera permission denied in Meta AI."
          return
        }
      }
      if captureStreamAudio,
        try await Wearables.shared.checkPermissionStatus(.microphone) != .granted
      {
        guard try await Wearables.shared.requestPermission(.microphone) == .granted else {
          lastError = "Microphone permission denied in Meta AI."
          return
        }
      }
      // Stream audio rides on the camera stream (BirdSpotter sample), so audio mode
      // keeps the camera, and its LED, active even if frames are ignored.
      let config = StreamConfiguration(
        videoCodec: .raw,
        audioCodec: captureStreamAudio ? .pcm(sampleRate: .rate16000, numberOfChannels: 1) : nil,
        resolution: resolution,
        frameRate: frameRate
      )
      guard let newCamera = try session.addCamera(config: config) else {
        lastError = "Couldn't create the camera. Try again."
        return
      }
      camera = newCamera
      resetStats()
      let stream = newCamera.stream
      stream.statePublisher.listen { [weak self] state in
        Task { @MainActor in self?.handleStream(state) }
      }.store(in: streamTokens)
      stream.errorPublisher.listen { [weak self] error in
        Task { @MainActor in
          guard let self else { return }
          if self.isCapturingPhoto {
            self.handleStreamPhotoFailure(error.localizedDescription)
          } else {
            self.lastError = "Stream: \(error.localizedDescription)"
          }
        }
      }.store(in: streamTokens)
      // Photos (app-requested or from the glasses' own shutter) arrive here.
      stream.photoDataPublisher.listen { [weak self] photoData in
        let data = photoData.data
        Task { @MainActor in self?.handlePhoto(data) }
      }.store(in: streamTokens)
      if captureStreamAudio {
        stream.audioFramePublisher.listen { [weak self] audioFrame in
          // Measure the buffer as delivered; the requested format is not trusted.
          let buffer = audioFrame.pcmBuffer
          let format = AudioMeter.describe(buffer.format)
          let level = AudioMeter.levelDb(buffer)
          // Copied here because the SDK may reuse the buffer once this callback returns.
          let copy = PCMBufferCopy(buffer)
          Task { @MainActor in self?.handleAudio(format: format, level: level, copy: copy) }
        }.store(in: streamTokens)
      }
      stream.videoFramePublisher.listen { [weak self] videoFrame in
        // Timestamp on arrival, decode off the main actor.
        let arrived = CACurrentMediaTime()
        let image = videoFrame.makeUIImage()
        Task { @MainActor in self?.handleFrame(image, arrived: arrived) }
      }.store(in: streamTokens)
      stream.start()
    } catch {
      lastError = "Camera: \(error.localizedDescription)"
      clearStream()
    }
  }

  private func handleAudio(format: String, level: Double, copy: PCMBufferCopy) {
    audioBufferCount += 1
    audioFormat = format
    audioLevelDb = level
    if let buffer = copy.buffer { onAudioBuffer?(buffer) }
  }

  // MARK: Step 3: photo during the live stream (never pauses the stream)

  private enum PhotoPath { case stream, photoChild }

  /// Takes a still while the stream keeps running. The stream is never stopped for a photo.
  /// 1. `stream.capturePhoto(format:)`, as Meta's CameraAccess sample does during a stream.
  /// 2. If that is refused, fails or times out: the standalone `photo` child of the same,
  ///    still-running camera, with retries. Photos travel over Bluetooth, not the Wi-Fi link.
  func capturePhoto() async {
    guard let session, session.state == .started else {
      lastError = "Start a session first."
      return
    }
    guard !isCapturingPhoto else { return }
    lastError = nil
    do {
      if try await Wearables.shared.checkPermissionStatus(.camera) != .granted {
        guard try await Wearables.shared.requestPermission(.camera) == .granted else {
          lastError = "Camera permission denied in Meta AI."
          return
        }
      }
    } catch {
      lastError = "Photo: \(error.localizedDescription)"
      return
    }
    isCapturingPhoto = true
    photoRequestedAt = CACurrentMediaTime()
    photoAttempt = 0
    photoLog.removeAll()
    plog("Take photo (\(photoResolution.rawValue)/\(photoQuality.rawValue)), stream \(camera == nil ? "off: starting it" : "running")")
    if camera == nil {
      // Starting a stream is fine; stopping one for a photo is not.
      await startStream()
    }
    for _ in 0..<60 where streamState != .streaming {
      try? await Task.sleep(for: .milliseconds(100))
    }
    guard isCapturingPhoto else { return }
    guard camera != nil, streamState == .streaming else {
      failPhoto("The stream isn't running, so there's nothing to take the photo from.")
      return
    }
    captureViaStream()
  }

  /// Path 1: the stream's own capture. The result arrives on the stream's photo publisher.
  private func captureViaStream() {
    guard let camera else { return }
    photoPath = .stream
    photoStatus = "Capturing (stream)"
    firstProgressAt = 0
    let started = camera.stream.capturePhoto(format: .jpeg)
    plog("stream.capturePhoto(format: .jpeg) returned \(started)")
    guard started else {
      startPhotoChild(reason: "stream capture refused to start")
      return
    }
    startPhotoTimeout(seconds: 15) { [weak self] in
      self?.startPhotoChild(reason: "stream capture timed out after 15 s")
    }
  }

  /// Path 2: the standalone photo child of the camera that is already streaming.
  private func startPhotoChild(reason: String) {
    guard isCapturingPhoto, let camera else { return }
    photoTimeout?.cancel()
    photoPath = .photoChild
    photoAttempt += 1
    didRequestCapture = false
    photoStatus = photoAttempt == 1 ? "Capturing (photo API)" : "Retrying (photo API)"
    plog("photo API attempt \(photoAttempt) on the streaming camera (\(reason))")
    photoTokens.clear()
    let photoCapability = camera.photo
    photoCapability.statePublisher.listen { [weak self] state in
      Task { @MainActor in self?.handlePhotoState(state) }
    }.store(in: photoTokens)
    photoCapability.transferProgressPublisher.listen { [weak self] progress in
      let fraction = progress.fraction
      let now = CACurrentMediaTime()
      Task { @MainActor in
        guard let self else { return }
        if self.firstProgressAt == 0 {
          self.firstProgressAt = now
          self.plog("first transfer progress")
        }
        self.photoStatus = String(format: "Transferring %.0f%%", fraction * 100)
      }
    }.store(in: photoTokens)
    photoCapability.photoDataPublisher.listen { [weak self] captured in
      let data = captured.imageData
      Task { @MainActor in self?.handlePhoto(data) }
    }.store(in: photoTokens)
    photoCapability.errorPublisher.listen { [weak self] error in
      Task { @MainActor in self?.handlePhotoError(error) }
    }.store(in: photoTokens)
    photoCapability.start()
    startPhotoTimeout(seconds: 30) { [weak self] in
      self?.failPhoto("Photo timed out (photo API, 30 s).")
    }
  }

  /// Timestamped photo trace, newest first, also written to the device console.
  private func plog(_ line: String) {
    let elapsed = photoRequestedAt > 0 ? CACurrentMediaTime() - photoRequestedAt : 0
    let entry = String(format: "+%.2fs  %@", elapsed, line)
    photoLog.insert(entry, at: 0)
    if photoLog.count > 40 { photoLog.removeLast(photoLog.count - 40) }
    NSLog("[GlassesLab][photo] %@", entry)
  }

  /// The SDK's description plus the underlying error it wraps, which carries the real cause.
  private func describe(_ error: PhotoError) -> String {
    switch error {
    case .captureFailure(let underlying), .sessionSetupFailed(let underlying):
      guard let underlying else { return "\(error.description) (no underlying error)" }
      let ns = underlying as NSError
      return "\(error.description) ← \(ns.domain) \(ns.code): \(ns.localizedDescription)"
    default:
      return error.description
    }
  }

  private func handlePhotoState(_ state: PhotoState) {
    plog("photo state: \(state)")
    // `.started` can arrive more than once; capture only on the first.
    guard state == .started, !didRequestCapture, let camera else { return }
    didRequestCapture = true
    firstProgressAt = 0
    plog("photo.capturePhoto(resolution: \(photoResolution.rawValue), quality: \(photoQuality.rawValue))")
    camera.photo.capturePhoto(resolution: photoResolution, quality: photoQuality)
  }

  private func handlePhotoError(_ error: PhotoError) {
    guard isCapturingPhoto, photoPath == .photoChild else { return }
    plog("photo API error: \(describe(error))")
    let retryable: Bool
    switch error {
    case .sessionSetupFailed, .captureFailure, .busy, .notReady: retryable = true
    default: retryable = false
    }
    guard retryable, photoAttempt < 3 else {
      failPhoto("Photo failed: \(describe(error))")
      return
    }
    camera?.photo.stop()
    Task { [weak self] in
      try? await Task.sleep(for: .milliseconds(600))
      guard let self, self.isCapturingPhoto else { return }
      self.startPhotoChild(reason: "retry after \(error.description)")
    }
  }

  /// A stream error while the stream path is capturing moves on to the photo API.
  private func handleStreamPhotoFailure(_ message: String) {
    plog("stream error during photo: \(message)")
    if photoPath == .stream {
      startPhotoChild(reason: "stream capture failed: \(message)")
    } else {
      failPhoto("Stream: \(message)")
    }
  }

  private func handlePhoto(_ data: Data) {
    guard let image = UIImage(data: data) else {
      failPhoto("Photo arrived but couldn't be decoded.")
      return
    }
    photo = image
    let now = CACurrentMediaTime()
    let total = photoRequestedAt > 0 ? now - photoRequestedAt : 0
    // Before the first progress event the glasses are taking and encoding the shot;
    // after it the bytes are moving over Bluetooth.
    let capture = firstProgressAt > 0 ? firstProgressAt - photoRequestedAt : total
    let transfer = firstProgressAt > 0 ? now - firstProgressAt : 0
    photoInfo = String(
      format: "%d×%d · %.0f KB · %.1f s total (capture %.1f s + transfer %.1f s) · %@",
      Int(image.size.width * image.scale), Int(image.size.height * image.scale),
      Double(data.count) / 1024, total, capture, transfer,
      photoPath == .stream ? "stream capture" : "photo API"
    )
    photoStatus = "Done"
    plog("photo arrived: \(data.count / 1024) KB")
    finishPhoto()
    resumePhotoWaiters(.success(data))
  }

  private func failPhoto(_ message: String) {
    lastError = message
    photoStatus = "Failed"
    plog("failed: \(message)")
    finishPhoto()
    resumePhotoWaiters(.failure(PhotoCaptureError.failed))
  }

  private func resumePhotoWaiters(_ result: Result<Data, Error>) {
    let waiters = photoWaiters
    photoWaiters.removeAll()
    for waiter in waiters { waiter.resume(with: result) }
  }

  /// Ends the photo attempt. Only the photo child is stopped; the stream keeps running.
  private func finishPhoto() {
    photoTimeout?.cancel()
    photoTimeout = nil
    photoTokens.clear()
    if photoPath == .photoChild { camera?.photo.stop() }
    isCapturingPhoto = false
    photoRequestedAt = 0
  }

  private func startPhotoTimeout(seconds: Int, onTimeout: @escaping @MainActor () -> Void) {
    photoTimeout?.cancel()
    photoTimeout = Task { @MainActor [weak self] in
      try? await Task.sleep(for: .seconds(seconds))
      guard !Task.isCancelled, let self, self.isCapturingPhoto else { return }
      onTimeout()
    }
  }

  func stopStream() {
    userStoppedStream = true
    // Stopping the camera cascades to its stream and detaches it from the session.
    camera?.stop()
  }

  private func handleStream(_ state: StreamState) {
    streamState = state
    if state == .stopped { clearStream() }
  }

  private func clearStream() {
    let hadStream = camera != nil
    streamTokens.clear()
    camera = nil
    streamState = .stopped
    if hadStream {
      let byUser = userStoppedStream
      userStoppedStream = false
      onStreamStopped?(byUser)
    }
  }

  // MARK: Stats

  private func resetStats() {
    arrivals.removeAll()
    fps = 0
    maxGapMs = 0
    frameCount = 0
    frame = nil
    recentFrames.removeAll()
  }

  private func handleFrame(_ image: UIImage?, arrived: CFTimeInterval) {
    frameCount += 1
    if let last = arrivals.last {
      maxGapMs = max(maxGapMs, (arrived - last) * 1000)
    }
    arrivals.append(arrived)
    if arrivals.count > 60 { arrivals.removeFirst(arrivals.count - 60) }
    if let first = arrivals.first, let last = arrivals.last, last > first {
      fps = Double(arrivals.count - 1) / (last - first)
    }
    if let image {
      frame = image
      frameSize = image.size
      recentFrames.append(image)
      if recentFrames.count > 10 { recentFrames.removeFirst(recentFrames.count - 10) }
    }
  }

  // MARK: Instant frame grab

  /// Picks the sharpest of the last ~10 stream frames (about 0.3 s at 30 fps). No
  /// transfer, so it is ready immediately; a photo is the fallback when OCR is unsure.
  func grabSharpestFrame() {
    let started = CACurrentMediaTime()
    guard !recentFrames.isEmpty else {
      lastError = "Start the stream first."
      return
    }
    let scored = recentFrames.map { ($0, FrameSharpness.score($0)) }
    guard let best = scored.max(by: { $0.1 < $1.1 }) else { return }
    grabbedFrame = best.0
    let ms = (CACurrentMediaTime() - started) * 1000
    grabbedFrameInfo = String(
      format: "%d×%d · sharpest of %d · picked in %.0f ms",
      Int(best.0.size.width * best.0.scale), Int(best.0.size.height * best.0.scale),
      scored.count, ms
    )
  }
}

// MARK: - Live mode

/// Why `captureStillDuringStream()` failed. The details stay in `lastError` and the photo log.
enum PhotoCaptureError: Error, Equatable {
  case noSession
  case failed
}

/// Why Live mode couldn't start the listening stream. `message` is shown on the phone.
enum LiveStreamError: Error, Equatable {
  case noGlasses(String?)
  case streamWithoutAudio
  case streamFailed(String?)

  var message: String {
    switch self {
    case .noGlasses(let detail): "The glasses session didn't start. \(detail ?? "Check that the glasses are connected.")"
    case .streamWithoutAudio: "The stream is running without glasses mic audio. Stop the stream, then start listening."
    case .streamFailed(let detail): "The stream didn't start. \(detail ?? "Try again.")"
    }
  }
}

extension CameraModel: LiveCamera {
  /// A still from the running stream for look-and-check. It never pauses or stops the stream:
  /// it reuses `capturePhoto()` (stream capture, then the photo child of the same camera) and
  /// starts a stream first when none is running. A second caller shares the photo in flight.
  func captureStillDuringStream() async throws -> Data {
    guard await ensureSessionStarted() else { throw PhotoCaptureError.noSession }
    return try await withCheckedThrowingContinuation { continuation in
      photoWaiters.append(continuation)
      guard !isCapturingPhoto else { return }
      Task { @MainActor in
        await self.capturePhoto()
        // capturePhoto() returns without a photo when permission is denied or the session
        // is gone. While a photo is on its way, isCapturingPhoto stays true.
        if !self.isCapturingPhoto { self.resumePhotoWaiters(.failure(PhotoCaptureError.failed)) }
      }
    }
  }

  /// The listening stream: glasses mic audio on, at the chosen quality (decision 10). Starts the
  /// session and the stream when needed. A stream that already carries mic audio is kept as it
  /// is. One without mic audio is left running, because only the user stops a stream.
  func startListeningStream(quality: StreamQuality) async throws {
    if isStreaming {
      guard captureStreamAudio else { throw LiveStreamError.streamWithoutAudio }
      return
    }
    switch quality {
    case .demo:
      resolution = .high
      frameRate = 30
    case .listening:
      resolution = .low
      frameRate = 15
    }
    captureStreamAudio = true
    guard await ensureSessionStarted() else { throw LiveStreamError.noGlasses(lastError) }
    await startStream()
    guard isStreaming else { throw LiveStreamError.streamFailed(lastError) }
  }

  /// Starts the device session when needed and waits up to 10 s for it.
  func ensureSessionStarted() async -> Bool {
    if session == nil { startSession() }
    for _ in 0..<100 where session != nil && sessionState != .started {
      try? await Task.sleep(for: .milliseconds(100))
    }
    return session != nil && sessionState == .started
  }
}

/// A copy of one SDK audio buffer, made on the SDK's callback thread and then handed to the
/// main actor. Nothing touches it after the copy, so crossing the actor boundary is safe.
final class PCMBufferCopy: @unchecked Sendable {
  let buffer: AVAudioPCMBuffer?

  init(_ source: AVAudioPCMBuffer) {
    let frames = source.frameLength
    guard frames > 0, let copy = AVAudioPCMBuffer(pcmFormat: source.format, frameCapacity: frames) else {
      buffer = nil
      return
    }
    copy.frameLength = frames
    let bytesPerFrame = Int(source.format.streamDescription.pointee.mBytesPerFrame)
    let from = UnsafeMutableAudioBufferListPointer(UnsafeMutablePointer(mutating: source.audioBufferList))
    let to = UnsafeMutableAudioBufferListPointer(copy.mutableAudioBufferList)
    for (src, dst) in zip(from, to) {
      guard let srcData = src.mData, let dstData = dst.mData else { continue }
      let count = min(Int(src.mDataByteSize), Int(frames) * bytesPerFrame)
      memcpy(dstData, srcData, count)
    }
    buffer = copy
  }
}

/// Focus measure: variance of a Laplacian over a small grayscale copy. Higher is sharper.
enum FrameSharpness {
  static func score(_ image: UIImage) -> Double {
    guard let cg = image.cgImage else { return 0 }
    let width = 180, height = 320
    var pixels = [UInt8](repeating: 0, count: width * height)
    let drawn = pixels.withUnsafeMutableBytes { buffer -> Bool in
      guard let context = CGContext(
        data: buffer.baseAddress, width: width, height: height, bitsPerComponent: 8,
        bytesPerRow: width, space: CGColorSpaceCreateDeviceGray(),
        bitmapInfo: CGImageAlphaInfo.none.rawValue
      ) else { return false }
      context.interpolationQuality = .low
      context.draw(cg, in: CGRect(x: 0, y: 0, width: width, height: height))
      return true
    }
    guard drawn else { return 0 }
    var sum = 0.0, sumSquares = 0.0, count = 0.0
    for y in 1..<(height - 1) {
      for x in 1..<(width - 1) {
        let i = y * width + x
        let laplacian = 4 * Double(pixels[i]) - Double(pixels[i - 1]) - Double(pixels[i + 1])
          - Double(pixels[i - width]) - Double(pixels[i + width])
        sum += laplacian
        sumSquares += laplacian * laplacian
        count += 1
      }
    }
    let mean = sum / count
    return sumSquares / count - mean * mean
  }
}
