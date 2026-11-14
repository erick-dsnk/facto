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
  @ObservationIgnored private var photoRequestedAt: CFTimeInterval = 0

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
    sessionState = .stopping
    session?.stop()
  }

  private func handleSession(_ state: DeviceSessionState) {
    sessionState = state
    if state == .stopped { clearSession() }
  }

  private func clearSession() {
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
          self?.isCapturingPhoto = false
          self?.lastError = "Stream: \(error.localizedDescription)"
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
          Task { @MainActor in self?.handleAudio(format: format, level: level) }
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

  private func handleAudio(format: String, level: Double) {
    audioBufferCount += 1
    audioFormat = format
    audioLevelDb = level
  }

  /// Full-quality still while streaming, as in Meta's CameraAccess sample.
  func capturePhoto() {
    guard let camera, !isCapturingPhoto else { return }
    lastError = nil
    isCapturingPhoto = true
    photoRequestedAt = CACurrentMediaTime()
    if !camera.stream.capturePhoto(format: .jpeg) {
      isCapturingPhoto = false
      lastError = "Photo didn't start. Another capture may be running; try again."
    }
  }

  private func handlePhoto(_ data: Data) {
    isCapturingPhoto = false
    guard let image = UIImage(data: data) else {
      lastError = "Photo arrived but couldn't be decoded."
      return
    }
    photo = image
    let seconds = photoRequestedAt > 0 ? CACurrentMediaTime() - photoRequestedAt : 0
    photoInfo = String(
      format: "%d×%d · %.0f KB · %.1f s",
      Int(image.size.width * image.scale), Int(image.size.height * image.scale),
      Double(data.count) / 1024, seconds
    )
    photoRequestedAt = 0
  }

  func stopStream() {
    // Stopping the camera cascades to its stream and detaches it from the session.
    camera?.stop()
  }

  private func handleStream(_ state: StreamState) {
    streamState = state
    if state == .stopped { clearStream() }
  }

  private func clearStream() {
    streamTokens.clear()
    camera = nil
    streamState = .stopped
  }

  // MARK: Stats

  private func resetStats() {
    arrivals.removeAll()
    fps = 0
    maxGapMs = 0
    frameCount = 0
    frame = nil
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
    }
  }
}
