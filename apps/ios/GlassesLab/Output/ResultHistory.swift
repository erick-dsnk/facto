import Foundation
import Observation

/// What the presenter did with one entry. Kept so the phone history can show why an entry
/// made no sound.
enum OutputDelivery: String, Equatable, Sendable {
  case spoken, chimed, cardOnly, silent
}

/// In-memory list of recent outcomes for the phone's session details, newest first.
///
/// Holds claim text and evidence in memory only: never persist or log it. `silent` results
/// live here and nowhere else, so "no alert" stays inspectable.
@Observable
@MainActor
final class ResultHistory {
  struct Entry: Identifiable, Equatable, Sendable {
    let id: UUID
    /// Nil for outcomes without a claim id, such as a failed check.
    var identity: ClaimIdentity?
    var outcome: OutputOutcome
    /// Nil when the outcome has no claim result (needs confirmation, failure).
    var result: ClaimResult?
    var presentation: Presentation
    var userInitiated: Bool
    var card: ResultCard
    var delivery: OutputDelivery
    var receivedAt: Date
    /// A correction replaced this result (`claim.superseded`). Kept for inspection, never
    /// repeated.
    var superseded = false
  }

  nonisolated static let defaultCapacity = 50

  /// Newest first.
  private(set) var entries: [Entry] = []
  let capacity: Int

  init(capacity: Int = ResultHistory.defaultCapacity) {
    self.capacity = max(1, capacity)
  }

  /// Highest revision recorded per claim. Survives eviction so a stale revision of an
  /// evicted claim cannot come back.
  @ObservationIgnored private var latestRevision: [ClaimKey: Int] = [:]

  private struct ClaimKey: Hashable {
    var requestId: String
    var claimId: String
  }

  /// False when a newer or equal revision of the same claim is already known, so the
  /// caller can drop a stale or repeated result.
  func accepts(_ identity: ClaimIdentity) -> Bool {
    let key = ClaimKey(requestId: identity.requestId, claimId: identity.claimId)
    guard let known = latestRevision[key] else { return true }
    return identity.revision > known
  }

  /// Adds an entry at the top. An entry for a newer revision of the same claim replaces the
  /// older one; a stale revision is ignored. Returns whether the entry was recorded.
  @discardableResult
  func record(_ entry: Entry) -> Bool {
    if let identity = entry.identity {
      guard accepts(identity) else { return false }
      latestRevision[ClaimKey(requestId: identity.requestId, claimId: identity.claimId)] = identity.revision
      entries.removeAll {
        $0.identity?.requestId == identity.requestId && $0.identity?.claimId == identity.claimId
      }
    }
    entries.insert(entry, at: 0)
    if entries.count > capacity {
      entries.removeLast(entries.count - capacity)
    }
    return true
  }

  /// The newest current entry the wearer saw or heard (anything but `silent`).
  var latestDelivered: Entry? {
    entries.first { $0.delivery != .silent && !$0.superseded }
  }

  /// Marks the request's results up to `revision` (all of them when nil) as superseded and
  /// returns their cards.
  @discardableResult
  func markSuperseded(requestId: String, throughRevision revision: Int?) -> [ResultCard] {
    var cards: [ResultCard] = []
    for index in entries.indices {
      guard let identity = entries[index].identity, identity.requestId == requestId, !entries[index].superseded else { continue }
      if let revision, identity.revision > revision { continue }
      entries[index].superseded = true
      cards.append(entries[index].card)
    }
    return cards
  }

  func clear() {
    entries.removeAll()
    latestRevision.removeAll()
  }
}
