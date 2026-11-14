import Foundation
import Observation
import os

/// "Look and check" (decisions 4, 5, 5a, 6): on a trigger, take a still from the running
/// glasses stream, read it on the phone and send the text to the checker.
///
/// Triggers: a `capture.request` event from the session (the backend heard "check this"),
/// or `trigger(_:)` from the glasses capture button, the Neural Band or an app button.
/// A trigger that arrives while a check is already running is ignored.
///
/// The photo is held in memory only for OCR and is never written to disk. The camera
/// stream is never paused or stopped here: `PhotoCapturing` takes the still from the
/// running stream. Logs carry ids, counts and lengths, never OCR text.
@MainActor
@Observable
final class LookAndCheckCoordinator {
  enum TriggerSource: String, Sendable {
    /// `capture.request` from the backend after a spoken "check this".
    case voice
    /// The glasses capture button, the Neural Band or an app button.
    case button
  }

  enum Phase: Equatable, Sendable {
    case idle, capturing, recognizing, submitting
  }

  enum Outcome: Equatable, Sendable {
    /// One request per chunk was accepted. `droppedCodePoints` counts text past the
    /// three-chunk limit (or chunks never sent because a later submit failed).
    case submitted(requestIds: [String], droppedCodePoints: Int)
    /// No usable text. Show or speak `message` ("Move closer and try again").
    case unreadable(message: String)
    /// `reason` is a short code, safe to log: no_session, photo_failed, ocr_failed,
    /// session_paused, invalid_input, submit_failed.
    case failed(reason: String)

    var submittedCount: Int {
      if case .submitted(let ids, _) = self { return ids.count }
      return 0
    }
  }

  struct Settings: Equatable, Sendable {
    /// Below this mean line confidence the photo counts as unreadable.
    var minimumMeanConfidence: Double = 0.5
    /// Fewer non-whitespace code points than this counts as unreadable.
    var minimumCharacters: Int = 3
    var maxChunks: Int = OCRChunker.defaultMaxChunks
  }

  static let unreadableMessage = "Move closer and try again"

  private(set) var phase: Phase = .idle
  private(set) var lastOutcome: Outcome?
  /// Called on the main actor after every finished check, for the UI or speech.
  @ObservationIgnored var onOutcome: ((Outcome) -> Void)?
  @ObservationIgnored var onAccepted: (@MainActor () -> Void)?
  @ObservationIgnored var canCapture: (@MainActor () -> Bool)?
  @ObservationIgnored var onCancelledCapture: (@MainActor () async -> Void)?
  /// Runs after OCR, before the first chunk is submitted. Return false when the session
  /// can't take checks (the check fails with "session_paused"). LiveModel resumes a session
  /// the server paused after a reconnect here, for voice and button triggers alike.
  @ObservationIgnored var prepareSubmit: (@MainActor () async -> Bool)?

  @ObservationIgnored private let channel: SessionChannel
  @ObservationIgnored private let photo: PhotoCapturing
  @ObservationIgnored private let recognizer: TextRecognizing
  @ObservationIgnored private let submitter: CheckSubmitter
  @ObservationIgnored private let settings: Settings
  @ObservationIgnored private let now: () -> Date
  @ObservationIgnored private var listener: Task<Void, Never>?
  @ObservationIgnored private var operationGeneration = UUID()
  @ObservationIgnored private let log = Logger(subsystem: "com.davidvasilescu.junction.glasseslab", category: "LookAndCheck")

  init(
    channel: SessionChannel,
    photo: PhotoCapturing,
    recognizer: TextRecognizing,
    submitter: CheckSubmitter,
    settings: Settings = Settings(),
    now: @escaping () -> Date = Date.init
  ) {
    self.channel = channel
    self.photo = photo
    self.recognizer = recognizer
    self.submitter = submitter
    self.settings = settings
    self.now = now
  }

  var isRunning: Bool { phase != .idle }

  /// Starts listening for `capture.request` events. Calling it again restarts the listener.
  func start() {
    listener?.cancel()
    let events = channel.events()
    listener = Task { [weak self] in
      for await event in events {
        guard !Task.isCancelled else { return }
        if event.type == .captureRequest {
          self?.trigger(.voice)
        }
      }
    }
  }

  func stop() {
    operationGeneration = UUID()
    listener?.cancel()
    listener = nil
  }

  func waitUntilIdle() async {
    while isRunning && !Task.isCancelled {
      try? await Task.sleep(for: .milliseconds(20))
    }
  }

  /// Starts a check in the background. Returns false when one is already running.
  @discardableResult
  func trigger(_ source: TriggerSource) -> Bool {
    guard canCapture?() ?? true else { return false }
    guard !isRunning else {
      log.info("trigger ignored, check running, source=\(source.rawValue, privacy: .public)")
      return false
    }
    phase = .capturing
    onAccepted?()
    let generation = operationGeneration
    Task { await self.run(source: source, generation: generation) }
    return true
  }

  /// Runs one check and returns its outcome, or nil when a check is already running.
  @discardableResult
  func performCheck(source: TriggerSource) async -> Outcome? {
    guard canCapture?() ?? true else { return nil }
    guard !isRunning else {
      log.info("trigger ignored, check running, source=\(source.rawValue, privacy: .public)")
      return nil
    }
    phase = .capturing
    onAccepted?()
    return await run(source: source, generation: operationGeneration)
  }

  // MARK: Pipeline

  /// Expects `phase` already set to `.capturing` so a second trigger is refused at once.
  @discardableResult
  private func run(source: TriggerSource, generation: UUID) async -> Outcome {
    let outcome = await pipeline(source: source, generation: generation)
    guard generation == operationGeneration else {
      await onCancelledCapture?()
      phase = .idle
      return .failed(reason: "cancelled")
    }
    phase = .idle
    lastOutcome = outcome
    switch outcome {
    case .submitted(let ids, let dropped):
      log.info("look-and-check submitted=\(ids.count, privacy: .public) droppedCodePoints=\(dropped, privacy: .public)")
    case .unreadable:
      log.info("look-and-check unreadable")
    case .failed(let reason):
      log.error("look-and-check failed reason=\(reason, privacy: .public)")
    }
    onOutcome?(outcome)
    return outcome
  }

  /// Chunks of one photo share a request id base: "ocr-<uuid>-1", "ocr-<uuid>-2". Returns
  /// "ocr-<uuid>" so outcomes can be grouped per photo, even when a result overtakes the 202.
  nonisolated static func photoKey(forRequestId requestId: String) -> String? {
    guard requestId.hasPrefix("ocr-"), let dash = requestId.lastIndex(of: "-"),
          dash > requestId.index(requestId.startIndex, offsetBy: 3)
    else { return nil }
    // A chunk number has one or two digits; a UUID group never that few.
    let suffix = requestId[requestId.index(after: dash)...]
    guard (1...2).contains(suffix.count), Int(suffix) != nil else { return nil }
    return String(requestId[..<dash])
  }

  private func pipeline(source: TriggerSource, generation: UUID) async -> Outcome {
    func current() -> Bool { !Task.isCancelled && operationGeneration == generation }
    guard current() else { return .failed(reason: "cancelled") }
    log.info("look-and-check start source=\(source.rawValue, privacy: .public)")
    guard channel.sessionId != nil, channel.sessionEpoch != nil else {
      return .failed(reason: "no_session")
    }

    phase = .capturing
    let capturedAt = now()
    let ocr: OCRResult
    do {
      // The JPEG lives only in this scope and is released once OCR returns.
      let jpeg: Data
      do {
        jpeg = try await photo.captureStillDuringStream()
        guard current() else { return .failed(reason: "cancelled") }
      } catch {
        log.error("photo capture failed: \(String(describing: type(of: error)), privacy: .public)")
        return .failed(reason: "photo_failed")
      }
      log.info("photo bytes=\(jpeg.count, privacy: .public)")
      phase = .recognizing
      do {
        ocr = try await recognizer.recognizeText(in: jpeg)
        guard current() else { return .failed(reason: "cancelled") }
      } catch {
        log.error("ocr failed: \(String(describing: type(of: error)), privacy: .public)")
        return .failed(reason: "ocr_failed")
      }
    }
    log.info("ocr lines=\(ocr.lineCount, privacy: .public) dropped=\(ocr.droppedLineCount, privacy: .public) codePoints=\(ocr.codePointCount, privacy: .public) meanConfidence=\(ocr.meanConfidence, privacy: .public)")

    let visible = ocr.text.unicodeScalars.filter { !CharacterSet.whitespacesAndNewlines.contains($0) }.count
    guard visible >= settings.minimumCharacters, ocr.meanConfidence >= settings.minimumMeanConfidence else {
      return .unreadable(message: Self.unreadableMessage)
    }
    let split = OCRChunker.chunk(ocr.text, maxChunks: settings.maxChunks)
    guard !split.chunks.isEmpty else { return .unreadable(message: Self.unreadableMessage) }
    if split.droppedText {
      log.info("ocr text over the per-photo limit, droppedChunks=\(split.droppedChunkCount, privacy: .public) droppedCodePoints=\(split.droppedCodePoints, privacy: .public)")
    }

    phase = .submitting
    if let prepareSubmit, !(await prepareSubmit()) {
      return .failed(reason: "session_paused")
    }
    guard current() else { return .failed(reason: "cancelled") }
    let photoSegment = WireID.makeSegmentId(prefix: "photo")
    let requestBase = WireID.makeRequestId(prefix: "ocr")
    var submitted: [String] = []
    for (index, chunk) in split.chunks.enumerated() {
      guard current() else { return .failed(reason: "cancelled") }
      let requestId = "\(requestBase)-\(index + 1)"
      let segmentId = "\(photoSegment)-\(index + 1)"
      let confidence = min(max(ocr.meanConfidence, 0), 1)
      // The session and epoch are read now, not before the photo: a reconnect during the
      // capture raises the epoch, and a renewed session has a new id.
      func envelope() -> TextInputEnvelope? {
        guard let sessionId = channel.sessionId, let sessionEpoch = channel.sessionEpoch else { return nil }
        return TextInputEnvelope(
          requestId: requestId,
          sessionId: sessionId,
          sessionEpoch: sessionEpoch,
          revision: 1,
          mode: .ocr,
          text: chunk,
          capturedAt: capturedAt,
          capture: .init(source: .glassesCamera, segmentId: segmentId, confidence: confidence, final: true),
          context: [],
          userInitiated: true
        )
      }
      guard let first = envelope() else {
        return finish(submitted, chunks: split, failedAt: index, reason: "no_session")
      }
      do {
        try first.validate()
      } catch {
        log.error("ocr chunk \(index + 1, privacy: .public) invalid: \(String(describing: error), privacy: .public)")
        return finish(submitted, chunks: split, failedAt: index, reason: "invalid_input")
      }
      do {
        do {
          try await submitter.submit(first)
        } catch where Self.isStaleSession(error) {
          // The session moved on while this chunk was in flight (a reconnect raised the
          // epoch): once it is active again, one retry with the current ids.
          if let prepareSubmit, !(await prepareSubmit()) { throw error }
          guard current() else { return .failed(reason: "cancelled") }
          guard let retry = envelope(), retry != first else { throw error }
          log.info("ocr chunk \(index + 1, privacy: .public) retrying with epoch \(retry.sessionEpoch, privacy: .public)")
          try await submitter.submit(retry)
        }
        submitted.append(requestId)
        log.info("ocr chunk submitted requestId=\(requestId, privacy: .public) codePoints=\(CodePoints.count(chunk), privacy: .public)")
      } catch {
        log.error("ocr chunk \(index + 1, privacy: .public) submit failed: \(String(describing: type(of: error)), privacy: .public)")
        return finish(submitted, chunks: split, failedAt: index, reason: "submit_failed")
      }
    }
    return .submitted(requestIds: submitted, droppedCodePoints: split.droppedCodePoints)
  }

  /// The request named an epoch or session the server has moved past: the client noticed
  /// first (`staleEpoch`, `wrongSession`) or the server answered 409.
  nonisolated static func isStaleSession(_ error: Error) -> Bool {
    switch error as? BackendClientError {
    case .staleEpoch, .wrongSession: return true
    case .http(409, let code): return code == "old_epoch" || code == "wrong_session"
    default: return false
    }
  }

  /// A failure partway through: report what was sent, counting unsent chunks as dropped.
  private func finish(_ submitted: [String], chunks: OCRChunks, failedAt index: Int, reason: String) -> Outcome {
    guard !submitted.isEmpty else { return .failed(reason: reason) }
    let unsent = chunks.chunks[index...].reduce(0) { $0 + CodePoints.count($1) }
    return .submitted(requestIds: submitted, droppedCodePoints: chunks.droppedCodePoints + unsent)
  }
}
