import Foundation

/// When the Meta Ray-Ban Display lens session should be open. Free of the SDK so tests can
/// drive it; `DisplayModel` feeds it and carries out its actions.
///
/// The lens opens only while there is something to show and the wearer can see it (a Display
/// pair in use and worn). An empty open session is the grey box the wearer had to press back
/// on. Failed opens back off (1, 2, 4, 8, then every 15 s), and only a successful open resets
/// that: glasses state that flickers while a session fails can't restart the retries.
struct LensSessionPolicy: Equatable {
  enum Action: Equatable {
    case none
    case open
    /// The wearer can't see the lens: close now.
    case close
    /// Nothing to show, but more may follow (a search after "Checking…"): close after a pause.
    case closeWhenIdle
    /// Wait out the backoff, then decide again.
    case retry(after: TimeInterval)
  }

  static let retryDelays: [TimeInterval] = [1, 2, 4, 8, 15]

  /// A Display pair is in use and worn, the app is active and native output is on.
  var lensVisible = false
  /// A card, search or acknowledgement is waiting for the lens.
  var hasContent = false
  /// The camera holds the session for a photo. Its stream holds back the lens, and adding the
  /// lens mid-stream can stall the photo, so the lens waits (keeping its content).
  var cameraBusy = false
  private(set) var failures = 0
  private(set) var retryAt: Date?

  func action(sessionOpen: Bool, now: Date) -> Action {
    guard lensVisible, !cameraBusy else { return sessionOpen ? .close : .none }
    guard hasContent else { return sessionOpen ? .closeWhenIdle : .none }
    guard !sessionOpen else { return .none }
    if let retryAt, now < retryAt { return .retry(after: retryAt.timeIntervalSince(now)) }
    return .open
  }

  mutating func openFailed(at now: Date) {
    failures += 1
    retryAt = now.addingTimeInterval(Self.retryDelays[min(failures, Self.retryDelays.count) - 1])
  }

  mutating func opened() {
    failures = 0
    retryAt = nil
  }
}

/// What the lens shows: a brief acknowledgement over a card over a search. It remembers what
/// the wearer swiped away (or what timed out), so the same card or search can't bring the lens
/// back; anything different can.
struct LensContent {
  struct Search {
    let claimText: String
    let captureLabel: String?
    let sources: [ClaimSourcesPayload.Source]
  }

  private(set) var feedback: NativeTriggerFeedback?
  private(set) var card: ResultCard?
  private(set) var search: Search?
  private var dismissedCard: ResultCard?
  private var dismissedClaim: String?

  var isEmpty: Bool { feedback == nil && card == nil && search == nil }
  /// Only a search or a card opens the lens. A one-second acknowledgement ("Checking…") shows
  /// only on a lens that is already open: opening a session for it raced the photo camera.
  var opensLens: Bool { card != nil || search != nil }

  /// A new result replaces the acknowledgement and any search; `nil` clears the lens. Returns
  /// false, changing nothing, for the card the wearer dismissed.
  @discardableResult
  mutating func show(card newCard: ResultCard?) -> Bool {
    if let newCard, newCard == dismissedCard { return false }
    if newCard == nil { dismissedClaim = nil }
    dismissedCard = nil
    feedback = nil
    card = newCard
    search = nil
    return true
  }

  /// Returns false, changing nothing, for the search the wearer dismissed: its later source
  /// updates keep the same claim.
  @discardableResult
  mutating func show(search newSearch: Search) -> Bool {
    guard newSearch.claimText != dismissedClaim else { return false }
    dismissedClaim = nil
    feedback = nil
    card = nil
    search = newSearch
    return true
  }

  mutating func show(feedback newFeedback: NativeTriggerFeedback?) {
    feedback = newFeedback
  }

  /// The wearer swiped the lens away or pressed back, or the card timed out.
  mutating func dismiss() {
    if let card { dismissedCard = card }
    if let search { dismissedClaim = search.claimText }
    feedback = nil
    card = nil
    search = nil
  }

  mutating func reset() {
    self = LensContent()
  }
}
