import Foundation

/// Decides which decoded server events reach subscribers.
///
/// Rules from the contract README: ignore unknown event types, old epochs, old revisions
/// and repeated event ids. The server owns the epoch and only ever raises it (pause,
/// disconnect), so an event with a higher epoch moves the filter forward and resets the
/// per-request revision tracking.
struct ServerEventFilter: Sendable {
  enum Decision: Equatable, Sendable {
    case deliver
    case drop(DropReason)
  }

  enum DropReason: String, Equatable, Sendable {
    case otherSession = "other_session"
    case duplicateEventId = "duplicate_event_id"
    case oldEpoch = "old_epoch"
    case oldRevision = "old_revision"
    case unknownType = "unknown_type"
    case malformedPayload = "malformed_payload"
  }

  /// Ids remembered for duplicate detection. Event ids are UUIDs, so a bounded window is
  /// enough to catch a resend.
  static let rememberedEventIds = 512
  /// Upper bound on tracked request ids per epoch. The server keeps at most 128 requests.
  static let trackedRequests = 512

  let sessionId: String
  private(set) var epoch: Int
  private var seenIds: Set<String> = []
  private var seenOrder: [String] = []
  private var latestRevision: [String: Int] = [:]

  init(sessionId: String, epoch: Int) {
    self.sessionId = sessionId
    self.epoch = epoch
  }

  mutating func accept(_ event: ServerEvent) -> Decision {
    guard event.sessionId == sessionId else { return .drop(.otherSession) }
    guard !seenIds.contains(event.eventId) else { return .drop(.duplicateEventId) }
    guard event.sessionEpoch >= epoch else { return .drop(.oldEpoch) }

    remember(event.eventId)
    if event.sessionEpoch > epoch {
      epoch = event.sessionEpoch
      latestRevision.removeAll()
    }

    // Revision bookkeeping runs for every known event so a later stale one is caught.
    if let requestId = event.requestId, let revision = event.revision {
      let latest = latestRevision[requestId] ?? revision
      // claim.superseded reports the replaced revision by design; never drop it.
      if revision < latest, event.type != .claimSuperseded { return .drop(.oldRevision) }
      if latestRevision.count >= Self.trackedRequests, latestRevision[requestId] == nil {
        latestRevision.removeAll()
      }
      latestRevision[requestId] = max(latest, revision)
    }

    if case .unknown = event.type { return .drop(.unknownType) }
    switch event.payload {
    case .unknown: return .drop(.unknownType)
    case .malformed: return .drop(.malformedPayload)
    default: return .deliver
    }
  }

  private mutating func remember(_ eventId: String) {
    seenIds.insert(eventId)
    seenOrder.append(eventId)
    if seenOrder.count > Self.rememberedEventIds {
      seenIds.remove(seenOrder.removeFirst())
    }
  }
}
