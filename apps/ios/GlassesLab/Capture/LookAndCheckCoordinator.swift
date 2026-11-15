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
/// The photo is held in memory only for OCR. The camera stream is never paused or stopped
/// here: `PhotoCapturing` takes the still from the running stream. Logs carry ids, counts and
/// lengths, never OCR text. The on-device `DebugLog` is the exception: while it is on it saves
/// the exact JPEG OCR ran on, the OCR result, the chunks and every step's timing.
@MainActor
@Observable
final class LookAndCheckCoordinator {
  enum TriggerSource: String, Sendable {
    /// `capture.request` from the backend after a spoken "check this".
    case voice
    /// The glasses capture button, the Neural Band or an app button.
    case button

    /// What started the check, as the debug log names it.
    var debugName: String {
      switch self {
      case .voice: "capture.request"
      case .button: "button"
      }
    }
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
    /// Several independent content blocks compete for the user's attention.
    case needsTarget(message: String)
    /// The visible source is collapsed or cut off; never complete it by inference.
    case incomplete(message: String)
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
  struct TargetChoice: Identifiable, Equatable, Sendable {
    let id: String
    let text: String
  }
  private(set) var targetChoices: [TargetChoice] = []
  private struct PendingTarget {
    let ocr: OCRResult
    let input: OCRTargetInput
    let candidates: [OCRTargetCandidate]
    let capturedAt: Date
  }
  private struct ChosenTarget {
    let ocr: OCRResult
    let lines: [OCRTargetLine]
    let capturedAt: Date
  }
  @ObservationIgnored private var pendingTarget: PendingTarget?
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
  @ObservationIgnored private let targetSelector: OCRTargetSelecting?
  @ObservationIgnored private let settings: Settings
  @ObservationIgnored private let now: () -> Date
  @ObservationIgnored private let debugLog: DebugLog
  @ObservationIgnored private var listener: Task<Void, Never>?
  @ObservationIgnored private var operationGeneration = UUID()
  @ObservationIgnored private let log = Logger(subsystem: "com.davidvasilescu.junction.glasseslab", category: "LookAndCheck")

  init(
    channel: SessionChannel,
    photo: PhotoCapturing,
    recognizer: TextRecognizing,
    submitter: CheckSubmitter,
    settings: Settings = Settings(),
    targetSelector: OCRTargetSelecting? = nil,
    now: @escaping () -> Date = Date.init,
    debugLog: DebugLog = .shared
  ) {
    self.channel = channel
    self.photo = photo
    self.recognizer = recognizer
    self.submitter = submitter
    self.settings = settings
    self.targetSelector = targetSelector
    self.now = now
    self.debugLog = debugLog
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
    pendingTarget = nil
    targetChoices = []
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
  func trigger(_ source: TriggerSource, intent: String? = nil) -> Bool {
    guard canCapture?() ?? true else { return false }
    guard !isRunning else {
      log.info("trigger ignored, check running, source=\(source.rawValue, privacy: .public)")
      debugLog.log("lookcheck.ignored", ["source": source.rawValue, "trigger": source.debugName, "phase": "\(phase)"])
      return false
    }
    pendingTarget = nil
    targetChoices = []
    phase = .capturing
    onAccepted?()
    let generation = operationGeneration
    Task { await self.run(source: source, generation: generation, intent: intent) }
    return true
  }

  /// Runs one check and returns its outcome, or nil when a check is already running.
  @discardableResult
  func performCheck(source: TriggerSource, intent: String? = nil) async -> Outcome? {
    guard canCapture?() ?? true else { return nil }
    guard !isRunning else {
      log.info("trigger ignored, check running, source=\(source.rawValue, privacy: .public)")
      debugLog.log("lookcheck.ignored", ["source": source.rawValue, "trigger": source.debugName, "phase": "\(phase)"])
      return nil
    }
    pendingTarget = nil
    targetChoices = []
    phase = .capturing
    onAccepted?()
    return await run(source: source, generation: operationGeneration, intent: intent)
  }

  /// Explicit choice reuses this capture's immutable OCR evidence, without taking or
  /// uploading another photo. Session readiness and cancellation checks still apply.
  @discardableResult
  func chooseTarget(_ id: String) async -> Outcome? {
    guard !isRunning, canCapture?() ?? true, let pending = pendingTarget,
          let candidate = pending.candidates.first(where: { $0.id == id }),
          let lines = OCRTargetSelection(status: .selected, selectedLineIds: candidate.lineIds).resolvedLines(in: pending.input)
    else { return nil }
    pendingTarget = nil
    targetChoices = []
    phase = .recognizing
    onAccepted?()
    let chosen = ChosenTarget(ocr: pending.ocr, lines: lines, capturedAt: pending.capturedAt)
    return await run(source: .button, generation: operationGeneration, intent: nil, chosen: chosen)
  }

  // MARK: Pipeline

  /// Expects `phase` already set to `.capturing` so a second trigger is refused at once.
  @discardableResult
  private func run(source: TriggerSource, generation: UUID, intent: String?, chosen: ChosenTarget? = nil) async -> Outcome {
    // Keep the diagnostic trace across cancellation-safe capture and submission.
    let trace = String(UUID().uuidString.prefix(8)).lowercased()
    let started = ProcessInfo.processInfo.systemUptime
    let outcome = await pipeline(source: source, generation: generation, trace: trace, intent: intent, chosen: chosen)
    guard generation == operationGeneration else {
      await onCancelledCapture?()
      phase = .idle
      return .failed(reason: "cancelled")
    }
    phase = .idle
    lastOutcome = outcome
    debugOutcome(outcome, trace: trace, started: started)
    switch outcome {
    case .submitted(let ids, let dropped):
      log.info("look-and-check submitted=\(ids.count, privacy: .public) droppedCodePoints=\(dropped, privacy: .public)")
    case .unreadable:
      log.info("look-and-check unreadable")
    case .needsTarget:
      log.info("look-and-check needs target")
    case .incomplete:
      log.info("look-and-check incomplete target")
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

  private func pipeline(source: TriggerSource, generation: UUID, trace: String, intent: String?, chosen: ChosenTarget?) async -> Outcome {
    func current() -> Bool { !Task.isCancelled && operationGeneration == generation }
    guard current() else { return .failed(reason: "cancelled") }
    log.info("look-and-check start source=\(source.rawValue, privacy: .public)")
    debugLog.log("lookcheck.start", [
      "trace": trace, "source": source.rawValue, "trigger": source.debugName,
      "sessionId": channel.sessionId as Any, "epoch": channel.sessionEpoch as Any,
    ])
    guard channel.sessionId != nil, channel.sessionEpoch != nil else {
      return .failed(reason: "no_session")
    }

    phase = chosen == nil ? .capturing : .recognizing
    let capturedAt = chosen?.capturedAt ?? now()
    let ocr: OCRResult
    let selectedLines: [OCRTargetLine]
    if let chosen {
      ocr = chosen.ocr
      selectedLines = chosen.lines
    } else {
      // The JPEG lives only in this scope and is released once OCR returns. The debug log's
      // copy on disk is the only one kept.
      let jpeg: Data
      let captureStarted = ProcessInfo.processInfo.systemUptime
      do {
        jpeg = try await photo.captureStillDuringStream()
        guard current() else { return .failed(reason: "cancelled") }
      } catch {
        log.error("photo capture failed: \(String(describing: type(of: error)), privacy: .public)")
        debugLog.log("lookcheck.photo_failed", [
          "trace": trace, "error": String(describing: error), "captureMs": Self.elapsedMs(since: captureStarted),
        ])
        return .failed(reason: "photo_failed")
      }
      log.info("photo bytes=\(jpeg.count, privacy: .public)")
      debugLog.logPhoto(jpeg, kind: "lookcheck.photo", id: trace, [
        "trace": trace, "captureMs": Self.elapsedMs(since: captureStarted),
      ])
      phase = .recognizing
      let ocrStarted = ProcessInfo.processInfo.systemUptime
      do {
        ocr = try await recognizer.recognizeText(in: jpeg)
        guard current() else { return .failed(reason: "cancelled") }
      } catch {
        log.error("ocr failed: \(String(describing: type(of: error)), privacy: .public)")
        debugLog.log("lookcheck.ocr_failed", [
          "trace": trace, "error": String(describing: error), "ocrMs": Self.elapsedMs(since: ocrStarted),
        ])
        return .failed(reason: "ocr_failed")
      }
      debugOCR(ocr, trace: trace, milliseconds: Self.elapsedMs(since: ocrStarted))
      var input = ocr.targetInput
      // Other TextRecognizing implementations may expose only one already-selected string.
      // Apple Vision always supplies individual observations and never takes this adapter.
      if input.lines.isEmpty && !ocr.isEmpty {
        input = OCRTargetInput(lines: [.init(id: "original-0", text: ocr.text, confidence: ocr.meanConfidence,
          polygon: [.init(x: 0, y: 1), .init(x: 1, y: 1), .init(x: 1, y: 0), .init(x: 0, y: 0)])], aspect: ocr.aspect)
      }
      let selection: OCRTargetSelection
      if let targetSelector {
        // Supplying this dependency is an explicit configuration choice to upload a still.
        if let failure = OCRTargetRequestLimits.failure(in: input, intent: intent) { return .failed(reason: failure) }
        let upright: Data
        do {
          upright = try await Task.detached(priority: .userInitiated) {
            try OCRService.selectionJPEG(jpeg)
          }.value
        } catch OCRError.selectionImageTooLarge {
          return .failed(reason: "target_selection_image_too_large")
        } catch {
          return .failed(reason: "ocr_failed")
        }
        guard current() else { return .failed(reason: "cancelled") }
        do {
          selection = try await targetSelector.selectTarget(in: input, imageData: upright, intent: intent)
        } catch {
          guard current() else { return .failed(reason: "cancelled") }
          return .failed(reason: "target_selection_failed")
        }
      } else if ocr.observations.isEmpty && !input.lines.isEmpty {
        selection = .init(status: .selected, selectedLineIds: input.lines.map(\.id))
      } else {
        selection = OCRTargetSelector.select(input, intent: intent)
      }
      guard current() else { return .failed(reason: "cancelled") }
      debugLog.log("lookcheck.target", ["trace": trace, "status": selection.status.rawValue,
        "selectedLineIds": selection.selectedLineIds, "candidateCount": selection.candidates.count,
        "reason": selection.reason as Any])
      switch selection.status {
      case .needsTarget:
        let validCandidates = selection.candidates.filter {
          OCRTargetSelection(status: .selected, selectedLineIds: $0.lineIds).resolvedLines(in: input) != nil
        }
        pendingTarget = PendingTarget(ocr: ocr, input: input, candidates: validCandidates, capturedAt: capturedAt)
        targetChoices = validCandidates.compactMap { candidate in
          guard let lines = OCRTargetSelection(status: .selected, selectedLineIds: candidate.lineIds).resolvedLines(in: input) else { return nil }
          return TargetChoice(id: candidate.id, text: lines.map(\.text).joined(separator: " "))
        }
        return .needsTarget(message: targetChoices.isEmpty
          ? "Specify a headline or topic below and try again."
          : "I found several text blocks. Choose one below.")
      case .incomplete:
        return .incomplete(message: "That text is cut off. Open the full post and try again.")
      case .unreadable:
        return .unreadable(message: Self.unreadableMessage)
      case .unavailable:
        if let reason = selection.reason, ["target_selection_input_too_large", "target_selection_hint_too_long", "target_selection_image_too_large"].contains(reason) {
          return .failed(reason: reason)
        }
        return .failed(reason: "target_selection_unavailable")
      case .selected:
        guard let resolved = selection.resolvedLines(in: input) else {
          if input.lines.allSatisfy({ $0.confidence < settings.minimumMeanConfidence }) {
            return .unreadable(message: Self.unreadableMessage)
          }
          return .failed(reason: "invalid_target_selection")
        }
        selectedLines = resolved
      }
    }
    log.info("ocr lines=\(ocr.lineCount, privacy: .public) dropped=\(ocr.droppedLineCount, privacy: .public) codePoints=\(ocr.codePointCount, privacy: .public) meanConfidence=\(ocr.meanConfidence, privacy: .public)")

    let targetText = selectedLines.map(\.text).joined(separator: "\n")
    if OCRTargetSelector.isVisiblyTruncated(targetText) {
      return .incomplete(message: "That text is cut off. Open the full post and try again.")
    }
    let targetConfidence = selectedLines.reduce(0.0) { $0 + $1.confidence } / Double(max(selectedLines.count, 1))
    let visible = targetText.unicodeScalars.filter { !CharacterSet.whitespacesAndNewlines.contains($0) }.count
    guard visible >= settings.minimumCharacters, targetConfidence >= settings.minimumMeanConfidence else {
      debugLog.log("lookcheck.unreadable", [
        "trace": trace, "reason": visible < settings.minimumCharacters ? "too_few_characters" : "low_confidence",
        "visibleCharacters": visible, "minimumCharacters": settings.minimumCharacters,
        "meanConfidence": targetConfidence, "minimumMeanConfidence": settings.minimumMeanConfidence,
      ])
      return .unreadable(message: Self.unreadableMessage)
    }
    let split = OCRChunker.chunk(targetText, maxChunks: settings.maxChunks)
    debugLog.log("lookcheck.chunks", [
      "trace": trace, "chunks": split.chunks, "codePoints": split.chunks.map { CodePoints.count($0) },
      "droppedChunkCount": split.droppedChunkCount, "droppedCodePoints": split.droppedCodePoints,
    ])
    guard !split.chunks.isEmpty else {
      debugLog.log("lookcheck.unreadable", ["trace": trace, "reason": "no_chunks"])
      return .unreadable(message: Self.unreadableMessage)
    }
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
      let confidence = min(max(targetConfidence, 0), 1)
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
        debugLog.log("lookcheck.chunk_invalid", ["trace": trace, "index": index + 1, "requestId": requestId, "error": String(describing: error)])
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
          debugLog.log("lookcheck.retry", [
            "trace": trace, "index": index + 1, "requestId": requestId, "error": String(describing: error),
            "epoch": retry.sessionEpoch, "sessionId": retry.sessionId,
          ])
          try await submitter.submit(retry)
        }
        submitted.append(requestId)
        log.info("ocr chunk submitted requestId=\(requestId, privacy: .public) codePoints=\(CodePoints.count(chunk), privacy: .public)")
        debugLog.log("lookcheck.submitted", ["trace": trace, "index": index + 1, "requestId": requestId, "segmentId": segmentId])
      } catch {
        log.error("ocr chunk \(index + 1, privacy: .public) submit failed: \(String(describing: type(of: error)), privacy: .public)")
        debugLog.log("lookcheck.submit_failed", ["trace": trace, "index": index + 1, "requestId": requestId, "error": String(describing: error)])
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

  // MARK: Debug log

  /// Everything Vision returned: the kept text plus each observation with its confidence and
  /// normalised box (origin bottom-left), including the lines the confidence filter dropped.
  private func debugOCR(_ ocr: OCRResult, trace: String, milliseconds: Int) {
    guard debugLog.isEnabled else { return }
    debugLog.log("lookcheck.ocr", [
      "trace": trace, "ocrMs": milliseconds, "text": ocr.text, "meanConfidence": ocr.meanConfidence,
      "lineCount": ocr.lineCount, "droppedLineCount": ocr.droppedLineCount, "codePoints": ocr.codePointCount,
      "observations": ocr.observations.map { line -> [String: Any] in
        [
          "id": line.id, "viewId": line.viewId,
          "text": line.text, "confidence": Double(line.confidence),
          "originalPolygon": line.originalPolygon.map { [$0.x, $0.y] },
          "box": [line.boundingBox.minX, line.boundingBox.minY, line.boundingBox.width, line.boundingBox.height].map { Double($0) },
        ]
      },
    ])
  }

  private func debugOutcome(_ outcome: Outcome, trace: String, started: TimeInterval) {
    var payload: [String: Any] = ["trace": trace, "totalMs": Self.elapsedMs(since: started)]
    switch outcome {
    case .submitted(let requestIds, let droppedCodePoints):
      payload["outcome"] = "submitted"
      payload["requestIds"] = requestIds
      payload["droppedCodePoints"] = droppedCodePoints
    case .unreadable(let message):
      payload["outcome"] = "unreadable"
      payload["message"] = message
    case .needsTarget(let message):
      payload["outcome"] = "needs_target"
      payload["message"] = message
    case .incomplete(let message):
      payload["outcome"] = "incomplete"
      payload["message"] = message
    case .failed(let reason):
      payload["outcome"] = "failed"
      payload["reason"] = reason
    }
    debugLog.log("lookcheck.outcome", payload)
  }

  private nonisolated static func elapsedMs(since start: TimeInterval) -> Int {
    Int((ProcessInfo.processInfo.systemUptime - start) * 1000)
  }

  /// A failure partway through: report what was sent, counting unsent chunks as dropped.
  private func finish(_ submitted: [String], chunks: OCRChunks, failedAt index: Int, reason: String) -> Outcome {
    guard !submitted.isEmpty else { return .failed(reason: reason) }
    let unsent = chunks.chunks[index...].reduce(0) { $0 + CodePoints.count($1) }
    return .submitted(requestIds: submitted, droppedCodePoints: chunks.droppedCodePoints + unsent)
  }
}
