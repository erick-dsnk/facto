import Foundation

// Swift mirror of packages/contracts version 1 (README.md, schemas/*.json, src/wire.ts).
// Field names and optionality follow the JSON schemas exactly. Add fields only compatibly;
// an incompatible change needs a schemaVersion bump agreed with the backend owner.
//
// Privacy: these types carry transcripts, OCR text and session tokens. Log ids, types and
// lengths only (see `ServerEvent.logSummary`), never the text itself.

enum ContractsV1 {
  static let schemaVersion = 1
  /// Input text limit, in Unicode code points.
  static let maxTextCodePoints = 800
  /// Combined context limit, in Unicode code points, across at most `maxContextItems`.
  static let maxContextCodePoints = 1_200
  static let maxContextItems = 2
  /// Wire ids (requestId, sessionId, segmentId) match `^[a-zA-Z0-9_-]+$`, 1...100 chars.
  static let maxIdLength = 100
}

// MARK: - Open string enums

/// A string enum that keeps unknown values instead of failing to decode.
protocol OpenStringEnum: RawRepresentable, Codable, Hashable, Sendable where RawValue == String {
  init(rawValue: String)
}

extension OpenStringEnum {
  init(from decoder: Decoder) throws {
    self.init(rawValue: try decoder.singleValueContainer().decode(String.self))
  }

  func encode(to encoder: Encoder) throws {
    var container = encoder.singleValueContainer()
    try container.encode(rawValue)
  }
}

enum Verdict: OpenStringEnum {
  case supported, contradicted, misleading, insufficientEvidence
  case unknown(String)

  init(rawValue: String) {
    switch rawValue {
    case "supported": self = .supported
    case "contradicted": self = .contradicted
    case "misleading": self = .misleading
    case "insufficient_evidence": self = .insufficientEvidence
    default: self = .unknown(rawValue)
    }
  }

  var rawValue: String {
    switch self {
    case .supported: "supported"
    case .contradicted: "contradicted"
    case .misleading: "misleading"
    case .insufficientEvidence: "insufficient_evidence"
    case .unknown(let value): value
    }
  }
}

/// Render this independently of the verdict. `silent` must never be promoted to a warning.
enum PresentationAction: OpenStringEnum {
  case silent, notify, respond
  case unknown(String)

  init(rawValue: String) {
    switch rawValue {
    case "silent": self = .silent
    case "notify": self = .notify
    case "respond": self = .respond
    default: self = .unknown(rawValue)
    }
  }

  var rawValue: String {
    switch self {
    case .silent: "silent"
    case .notify: "notify"
    case .respond: "respond"
    case .unknown(let value): value
    }
  }
}

enum CaptureSource: OpenStringEnum {
  case glassesHfp, glassesStreamAudio, glassesCamera, phoneMic, phoneCamera, typedFixture, recordedFixture
  case unknown(String)

  init(rawValue: String) {
    switch rawValue {
    case "glasses_hfp": self = .glassesHfp
    case "glasses_stream_audio": self = .glassesStreamAudio
    case "glasses_camera": self = .glassesCamera
    case "phone_mic": self = .phoneMic
    case "phone_camera": self = .phoneCamera
    case "typed_fixture": self = .typedFixture
    case "recorded_fixture": self = .recordedFixture
    default: self = .unknown(rawValue)
    }
  }

  var rawValue: String {
    switch self {
    case .glassesHfp: "glasses_hfp"
    case .glassesStreamAudio: "glasses_stream_audio"
    case .glassesCamera: "glasses_camera"
    case .phoneMic: "phone_mic"
    case .phoneCamera: "phone_camera"
    case .typedFixture: "typed_fixture"
    case .recordedFixture: "recorded_fixture"
    case .unknown(let value): value
    }
  }
}

enum AdmissionAction: OpenStringEnum {
  case wait, skip, check
  case unknown(String)

  init(rawValue: String) {
    switch rawValue {
    case "wait": self = .wait
    case "skip": self = .skip
    case "check": self = .check
    default: self = .unknown(rawValue)
    }
  }

  var rawValue: String {
    switch self {
    case .wait: "wait"
    case .skip: "skip"
    case .check: "check"
    case .unknown(let value): value
    }
  }
}

enum EvidenceStance: OpenStringEnum {
  case supports, contradicts, unrelated
  case unknown(String)

  init(rawValue: String) {
    switch rawValue {
    case "supports": self = .supports
    case "contradicts": self = .contradicts
    case "unrelated": self = .unrelated
    default: self = .unknown(rawValue)
    }
  }

  var rawValue: String {
    switch self {
    case .supports: "supports"
    case .contradicts: "contradicts"
    case .unrelated: "unrelated"
    case .unknown(let value): value
    }
  }
}

/// Text input mode. The app produces this value, so the set is closed.
enum InputMode: String, Codable, Sendable {
  case ocr, audio, typed
}

// MARK: - Text input (POST /v1/sessions/{id}/checks)

/// text-input.schema.json. `additionalProperties: false`: never add keys here without a
/// contract change.
struct TextInputEnvelope: Codable, Equatable, Sendable {
  struct Capture: Codable, Equatable, Sendable {
    var source: CaptureSource
    var segmentId: String
    /// Required and nullable: encoded as `null` when unknown, never omitted.
    var confidence: Double?
    /// Optional in the schema: omitted when nil.
    var final: Bool?

    enum CodingKeys: String, CodingKey { case source, segmentId, confidence, final }

    init(source: CaptureSource, segmentId: String, confidence: Double?, final: Bool? = nil) {
      self.source = source
      self.segmentId = segmentId
      self.confidence = confidence
      self.final = final
    }

    init(from decoder: Decoder) throws {
      let c = try decoder.container(keyedBy: CodingKeys.self)
      source = try c.decode(CaptureSource.self, forKey: .source)
      segmentId = try c.decode(String.self, forKey: .segmentId)
      confidence = try c.decodeIfPresent(Double.self, forKey: .confidence)
      final = try c.decodeIfPresent(Bool.self, forKey: .final)
    }

    func encode(to encoder: Encoder) throws {
      var c = encoder.container(keyedBy: CodingKeys.self)
      try c.encode(source, forKey: .source)
      try c.encode(segmentId, forKey: .segmentId)
      try c.encode(confidence, forKey: .confidence)
      try c.encodeIfPresent(final, forKey: .final)
    }
  }

  var schemaVersion: Int = ContractsV1.schemaVersion
  var requestId: String
  var sessionId: String
  var sessionEpoch: Int
  /// Starts at 1. A correction keeps `requestId` and increments this.
  var revision: Int
  var mode: InputMode
  var text: String
  var language: String = "en"
  /// ISO 8601 timestamp with offset. Use `ContractDates.string(from:)`.
  var capturedAt: String
  var capture: Capture
  /// At most two previous utterances, combined <= 1,200 code points.
  var context: [String]
  var userInitiated: Bool

  init(
    requestId: String,
    sessionId: String,
    sessionEpoch: Int,
    revision: Int = 1,
    mode: InputMode,
    text: String,
    capturedAt: Date,
    capture: Capture,
    context: [String] = [],
    userInitiated: Bool
  ) {
    self.requestId = requestId
    self.sessionId = sessionId
    self.sessionEpoch = sessionEpoch
    self.revision = revision
    self.mode = mode
    self.text = text
    self.capturedAt = ContractDates.string(from: capturedAt)
    self.capture = capture
    self.context = context
    self.userInitiated = userInitiated
  }

  enum ValidationError: Error, Equatable {
    case blankText
    case textTooLong(codePoints: Int)
    case tooManyContextItems(Int)
    case contextTooLong(codePoints: Int)
    case invalidId(field: String)
    case invalidNumber(field: String)
    case confidenceOutOfRange
  }

  /// Client-side mirror of the server's input checks. The server stays authoritative;
  /// oversize text must be split by the caller, never silently truncated.
  func validate() throws {
    for (field, value) in [("requestId", requestId), ("sessionId", sessionId), ("segmentId", capture.segmentId)]
    where !WireID.isValid(value) {
      throw ValidationError.invalidId(field: field)
    }
    if sessionEpoch < 1 { throw ValidationError.invalidNumber(field: "sessionEpoch") }
    if revision < 1 { throw ValidationError.invalidNumber(field: "revision") }
    if text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { throw ValidationError.blankText }
    let textCount = CodePoints.count(text)
    if textCount > ContractsV1.maxTextCodePoints { throw ValidationError.textTooLong(codePoints: textCount) }
    if context.count > ContractsV1.maxContextItems { throw ValidationError.tooManyContextItems(context.count) }
    let contextCount = context.reduce(0) { $0 + CodePoints.count($1) }
    if contextCount > ContractsV1.maxContextCodePoints { throw ValidationError.contextTooLong(codePoints: contextCount) }
    if let confidence = capture.confidence, !(0...1).contains(confidence) { throw ValidationError.confidenceOutOfRange }
  }
}

// MARK: - Sessions (POST /v1/sessions)

struct SessionCreateRequest: Codable, Equatable, Sendable {
  var joinCode: String
}

struct SessionCreateResponse: Codable, Equatable, Sendable, CustomStringConvertible {
  struct Capabilities: Codable, Equatable, Sendable {
    var mode: String?
    var text: Bool?
    var audio: Bool?
  }

  struct Budgets: Codable, Equatable, Sendable {
    var deadlineMs: Int?
    var running: Int?
    var queued: Int?
    var jev: Int?
    var searchesPerClaim: Int?
  }

  var schemaVersion: Int?
  var sessionId: String
  /// Bearer token for every session call. Never log it.
  var token: String
  var sessionEpoch: Int
  var expiresAt: String
  var capabilities: Capabilities?
  var budgets: Budgets?

  /// Redacts the token so the value is safe to print.
  var description: String {
    "SessionCreateResponse(sessionId: \(sessionId), sessionEpoch: \(sessionEpoch), token: <redacted \(token.count) chars>)"
  }
}

// MARK: - Claim result (claim-result.schema.json)

struct SourceSpan: Codable, Equatable, Hashable, Sendable {
  /// Half-open Unicode code-point offsets into `originalText`.
  var start: Int
  var end: Int
}

struct Presentation: Codable, Equatable, Sendable {
  var action: PresentationAction
  var reasonCode: String
}

struct Evidence: Codable, Equatable, Sendable, Identifiable {
  var id: String
  var url: String
  var title: String
  var publisher: String?
  /// ISO date (`YYYY-MM-DD`), timestamp with offset, or nil. Keep the source precision;
  /// never invent a midnight timestamp for a date-only value.
  var publishedAt: String?
  var retrievedAt: String
  /// "highlight" or "page_text".
  var contentBasis: String
  var excerpt: String
  var sourceGroup: String
  var echoGroup: String?
  /// "primary", "secondary" or "unknown".
  var sourceRole: String
  var directlyAddressesClaim: Bool
  var matchesTimePlaceAndPopulation: Bool
  var stance: EvidenceStance
  var stanceProbability: Double?
}

struct ClaimResult: Codable, Equatable, Sendable {
  var verdict: Verdict
  var reasonCode: String
  var selectedEvidenceIds: [String]
  var summary: String
  var originalText: String
  var checkedText: String
  var sourceSpan: SourceSpan
  var evidence: [Evidence]
  var checkedAt: String
  var expiresAt: String
  var durationMs: Double
  var cached: Bool
  var policyVersion: String
  var modelVersion: String
  var presentation: Presentation

  /// Evidence referenced by `selectedEvidenceIds`, in that order.
  var selectedEvidence: [Evidence] {
    selectedEvidenceIds.compactMap { id in evidence.first { $0.id == id } }
  }
}

// MARK: - Event payloads

/// session.ready
struct SessionReadyPayload: Codable, Equatable, Sendable {
  var active: Bool
  var expiresAt: String?
  var mode: String?
  var audio: Bool?
}

/// session.ended. reasonCode is e.g. "deleted", "expired", "disconnected", "paused".
struct SessionEndedPayload: Codable, Equatable, Sendable {
  var reasonCode: String
  var active: Bool?
}

/// claim.detected
struct ClaimDetectedPayload: Codable, Equatable, Sendable {
  var mode: InputMode?
}

/// claim.checking, claim.skipped, claim.needs_confirmation. Not a factual verdict.
struct AdmissionPayload: Codable, Equatable, Sendable {
  var admissionAction: AdmissionAction
  var reasonCode: String
  var presentation: Presentation?
}

/// claim.waiting: `admissionAction` is always `wait`. Not a factual verdict.
struct WaitingPayload: Codable, Equatable, Sendable {
  var admissionAction: AdmissionAction
  var reasonCode: String
  var waitExpiresAt: String
}

/// claim.superseded
struct SupersededPayload: Codable, Equatable, Sendable {
  var reasonCode: String
  var presentation: Presentation?
}

/// check.cancelled
struct ReasonPayload: Codable, Equatable, Sendable {
  var reasonCode: String
}

/// pipeline.error. Never present this as false or insufficient evidence.
struct PipelineErrorPayload: Codable, Equatable, Sendable {
  var reasonCode: String
  var message: String?
  var presentation: Presentation?
}

/// audio.ready: the server accepted `audio.start`; binary frames may follow.
struct AudioReadyPayload: Codable, Equatable, Sendable {
  var streamGeneration: Int
  var encoding: String
  var sampleRateHz: Int
  var channels: Int
  var source: CaptureSource
}

/// audio.stopped
struct AudioStoppedPayload: Codable, Equatable, Sendable {
  var reasonCode: String
  var streamGeneration: Int?
}

/// transcript.partial and transcript.final. `text` is sensitive: never log it.
struct TranscriptPayload: Codable, Equatable, Sendable {
  var text: String
  var final: Bool
  var segmentId: String
  var confidence: Double?
  var captureOffsetMs: Int
  var streamGeneration: Int?
  var source: CaptureSource?
}

// MARK: - Event envelope (event-envelope.schema.json)

enum ServerEventType: OpenStringEnum {
  case sessionReady, sessionEnded
  case claimDetected, claimWaiting, claimSkipped, claimNeedsConfirmation, claimChecking, claimResult, claimSuperseded
  case checkCancelled, pipelineError
  case audioReady, audioStopped, transcriptPartial, transcriptFinal
  /// Pending backend confirmation (docs/live-pipeline.md decision 4). Not in contract v1;
  /// listed so the app can react once the server sends it. Payload is not decoded.
  case captureRequest
  case unknown(String)

  init(rawValue: String) {
    switch rawValue {
    case "session.ready": self = .sessionReady
    case "session.ended": self = .sessionEnded
    case "claim.detected": self = .claimDetected
    case "claim.waiting": self = .claimWaiting
    case "claim.skipped": self = .claimSkipped
    case "claim.needs_confirmation": self = .claimNeedsConfirmation
    case "claim.checking": self = .claimChecking
    case "claim.result": self = .claimResult
    case "claim.superseded": self = .claimSuperseded
    case "check.cancelled": self = .checkCancelled
    case "pipeline.error": self = .pipelineError
    case "audio.ready": self = .audioReady
    case "audio.stopped": self = .audioStopped
    case "transcript.partial": self = .transcriptPartial
    case "transcript.final": self = .transcriptFinal
    case "capture.request": self = .captureRequest
    default: self = .unknown(rawValue)
    }
  }

  var rawValue: String {
    switch self {
    case .sessionReady: "session.ready"
    case .sessionEnded: "session.ended"
    case .claimDetected: "claim.detected"
    case .claimWaiting: "claim.waiting"
    case .claimSkipped: "claim.skipped"
    case .claimNeedsConfirmation: "claim.needs_confirmation"
    case .claimChecking: "claim.checking"
    case .claimResult: "claim.result"
    case .claimSuperseded: "claim.superseded"
    case .checkCancelled: "check.cancelled"
    case .pipelineError: "pipeline.error"
    case .audioReady: "audio.ready"
    case .audioStopped: "audio.stopped"
    case .transcriptPartial: "transcript.partial"
    case .transcriptFinal: "transcript.final"
    case .captureRequest: "capture.request"
    case .unknown(let value): value
    }
  }
}

enum ServerEventPayload: Equatable, Sendable {
  case sessionReady(SessionReadyPayload)
  case sessionEnded(SessionEndedPayload)
  case claimDetected(ClaimDetectedPayload)
  case claimWaiting(WaitingPayload)
  case claimSkipped(AdmissionPayload)
  case claimNeedsConfirmation(AdmissionPayload)
  case claimChecking(AdmissionPayload)
  case claimResult(ClaimResult)
  case claimSuperseded(SupersededPayload)
  case checkCancelled(ReasonPayload)
  case pipelineError(PipelineErrorPayload)
  case audioReady(AudioReadyPayload)
  case audioStopped(AudioStoppedPayload)
  case transcriptPartial(TranscriptPayload)
  case transcriptFinal(TranscriptPayload)
  case captureRequest
  /// Unknown event type: the payload is ignored. Handle by doing nothing.
  case unknown
  /// Known type whose payload did not match the contract. Treat as a service problem,
  /// never as a verdict. Holds the decoding error description (no payload text).
  case malformed(String)
}

/// One message from `WS /v1/sessions/{id}/stream`. Decoding never fails on an unknown
/// `type` or on a bad payload of a known type; only a broken envelope throws.
struct ServerEvent: Decodable, Equatable, Sendable {
  var schemaVersion: Int
  var eventId: String
  /// Increasing per session. Ignore repeated `eventId`s, old epochs and old revisions.
  var eventSeq: Int
  var sessionId: String
  var sessionEpoch: Int
  var requestId: String?
  var claimId: String?
  var revision: Int?
  var type: ServerEventType
  var serverAt: String
  var payload: ServerEventPayload

  enum CodingKeys: String, CodingKey {
    case schemaVersion, eventId, eventSeq, sessionId, sessionEpoch, requestId, claimId, revision, type, serverAt, payload
  }

  init(
    schemaVersion: Int = ContractsV1.schemaVersion,
    eventId: String,
    eventSeq: Int,
    sessionId: String,
    sessionEpoch: Int,
    requestId: String? = nil,
    claimId: String? = nil,
    revision: Int? = nil,
    type: ServerEventType,
    serverAt: String,
    payload: ServerEventPayload
  ) {
    self.schemaVersion = schemaVersion
    self.eventId = eventId
    self.eventSeq = eventSeq
    self.sessionId = sessionId
    self.sessionEpoch = sessionEpoch
    self.requestId = requestId
    self.claimId = claimId
    self.revision = revision
    self.type = type
    self.serverAt = serverAt
    self.payload = payload
  }

  init(from decoder: Decoder) throws {
    let c = try decoder.container(keyedBy: CodingKeys.self)
    schemaVersion = try c.decode(Int.self, forKey: .schemaVersion)
    eventId = try c.decode(String.self, forKey: .eventId)
    eventSeq = try c.decode(Int.self, forKey: .eventSeq)
    sessionId = try c.decode(String.self, forKey: .sessionId)
    sessionEpoch = try c.decode(Int.self, forKey: .sessionEpoch)
    requestId = try c.decodeIfPresent(String.self, forKey: .requestId)
    claimId = try c.decodeIfPresent(String.self, forKey: .claimId)
    revision = try c.decodeIfPresent(Int.self, forKey: .revision)
    type = try c.decode(ServerEventType.self, forKey: .type)
    serverAt = try c.decode(String.self, forKey: .serverAt)
    payload = Self.decodePayload(type: type, container: c)
  }

  private static func decodePayload(type: ServerEventType, container c: KeyedDecodingContainer<CodingKeys>) -> ServerEventPayload {
    func decode<T: Decodable>(_ kind: T.Type, _ wrap: (T) -> ServerEventPayload) -> ServerEventPayload {
      do {
        return wrap(try c.decode(T.self, forKey: .payload))
      } catch {
        return .malformed(String(describing: Swift.type(of: error)))
      }
    }

    switch type {
    case .sessionReady: return decode(SessionReadyPayload.self, ServerEventPayload.sessionReady)
    case .sessionEnded: return decode(SessionEndedPayload.self, ServerEventPayload.sessionEnded)
    case .claimDetected: return decode(ClaimDetectedPayload.self, ServerEventPayload.claimDetected)
    case .claimWaiting: return decode(WaitingPayload.self, ServerEventPayload.claimWaiting)
    case .claimSkipped: return decode(AdmissionPayload.self, ServerEventPayload.claimSkipped)
    case .claimNeedsConfirmation: return decode(AdmissionPayload.self, ServerEventPayload.claimNeedsConfirmation)
    case .claimChecking: return decode(AdmissionPayload.self, ServerEventPayload.claimChecking)
    case .claimResult: return decode(ClaimResult.self, ServerEventPayload.claimResult)
    case .claimSuperseded: return decode(SupersededPayload.self, ServerEventPayload.claimSuperseded)
    case .checkCancelled: return decode(ReasonPayload.self, ServerEventPayload.checkCancelled)
    case .pipelineError: return decode(PipelineErrorPayload.self, ServerEventPayload.pipelineError)
    case .audioReady: return decode(AudioReadyPayload.self, ServerEventPayload.audioReady)
    case .audioStopped: return decode(AudioStoppedPayload.self, ServerEventPayload.audioStopped)
    case .transcriptPartial: return decode(TranscriptPayload.self, ServerEventPayload.transcriptPartial)
    case .transcriptFinal: return decode(TranscriptPayload.self, ServerEventPayload.transcriptFinal)
    case .captureRequest: return .captureRequest
    case .unknown: return .unknown
    }
  }

  /// Log-safe one-liner: type, ids and sequence only, never payload text.
  var logSummary: String {
    var parts = ["\(type.rawValue)", "seq=\(eventSeq)", "epoch=\(sessionEpoch)"]
    if let requestId { parts.append("req=\(requestId)") }
    if let claimId { parts.append("claim=\(claimId)") }
    if let revision { parts.append("rev=\(revision)") }
    if case .malformed = payload { parts.append("payload=malformed") }
    return parts.joined(separator: " ")
  }

  static func decode(from data: Data) throws -> ServerEvent {
    try JSONDecoder().decode(ServerEvent.self, from: data)
  }
}

// MARK: - Client control messages (WebSocket text frames)

/// First message of an audio generation. Wait for `audio.ready` before binary frames.
/// The server parses this strictly: no extra keys.
struct AudioStartControl: Codable, Equatable, Sendable {
  var type: String = "audio.start"
  var sessionEpoch: Int
  /// Strictly higher than any previous generation in this session, 1...0xFFFF_FFFF.
  var streamGeneration: Int
  var encoding: String = "pcm_s16le"
  var sampleRateHz: Int = 16_000
  var channels: Int = 1
  /// Server accepts glasses_hfp, glasses_stream_audio, phone_mic, recorded_fixture.
  var source: CaptureSource

  init(sessionEpoch: Int, streamGeneration: Int, source: CaptureSource) {
    self.sessionEpoch = sessionEpoch
    self.streamGeneration = streamGeneration
    self.source = source
  }
}

/// session.preferences payload. Automatic notifications default off.
struct SessionPreferences: Codable, Equatable, Sendable {
  var muted: Bool = false
  var automaticNotifications: Bool = false
  /// At most 5 topics, each at most 80 characters.
  var selectedTopics: [String] = []
}

/// Every other control message. Each one carries the current `sessionEpoch`.
struct ControlMessage: Codable, Equatable, Sendable {
  var type: String
  var sessionEpoch: Int
  var requestId: String?
  var claimId: String?
  var preferences: SessionPreferences?

  static func pause(epoch: Int) -> ControlMessage { ControlMessage(type: "session.pause", sessionEpoch: epoch) }
  static func resume(epoch: Int) -> ControlMessage { ControlMessage(type: "session.resume", sessionEpoch: epoch) }
  static func audioStop(epoch: Int) -> ControlMessage { ControlMessage(type: "audio.stop", sessionEpoch: epoch) }
  static func playbackStarted(epoch: Int) -> ControlMessage { ControlMessage(type: "playback.started", sessionEpoch: epoch) }
  static func playbackEnded(epoch: Int) -> ControlMessage { ControlMessage(type: "playback.ended", sessionEpoch: epoch) }
  static func cancel(requestId: String, epoch: Int) -> ControlMessage {
    ControlMessage(type: "claim.cancel", sessionEpoch: epoch, requestId: requestId)
  }
  static func repeatResult(requestId: String, claimId: String, epoch: Int) -> ControlMessage {
    ControlMessage(type: "claim.repeat", sessionEpoch: epoch, requestId: requestId, claimId: claimId)
  }
  static func preferences(_ preferences: SessionPreferences, epoch: Int) -> ControlMessage {
    ControlMessage(type: "session.preferences", sessionEpoch: epoch, preferences: preferences)
  }
}

// MARK: - Timestamps

/// ISO 8601 helpers. Timestamps stay `String` on the wire types so date-only evidence
/// dates keep their precision.
enum ContractDates {
  static func string(from date: Date) -> String {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return formatter.string(from: date)
  }

  /// Parses timestamps with or without fractional seconds. Returns nil for date-only values.
  static func date(from string: String) -> Date? {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    if let date = formatter.date(from: string) { return date }
    formatter.formatOptions = [.withInternetDateTime]
    return formatter.date(from: string)
  }
}
