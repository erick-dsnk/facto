import Foundation
import Observation
import os

/// The one active card. The lens (via DisplayCardBuilder) and the phone preview both render
/// from this model, so they always match.
@Observable
@MainActor
final class LensCardViewModel {
  private(set) var card: ResultCard?

  /// Called after every change, so app wiring can send the card to the glasses display.
  @ObservationIgnored var onChange: (@MainActor (ResultCard?) -> Void)?

  func show(_ card: ResultCard) {
    self.card = card
    onChange?(card)
  }

  func clear() {
    guard card != nil else { return }
    card = nil
    onChange?(nil)
  }
}

/// Turns check outcomes into speech, chimes, cards and history (decisions 7 and 11).
///
/// - `respond`: speaks the card's line ("False. 3 of 3 sources disagree, including Live
///   Science.", never a URL) and shows the card.
///   `playbackStarted` / `playbackEnded` wrap the speech so the backend ignores our voice.
/// - `notify`: a quiet chime plus a card. No playback reporting, so listening continues.
/// - `silent` (and any action this build does not know): history only. Never promoted.
/// - Muted: no speech and no chime; cards and history stay.
/// - VoiceOver hears every card the wearer doesn't: a muted answer or a chimed alert is
///   announced. A spoken card isn't, so VoiceOver never talks over the line.
@MainActor
final class ResultPresenter: ResultPresenting {
  private static let log = Logger(subsystem: "com.davidvasilescu.junction.glasseslab", category: "output")

  let history: ResultHistory
  let lens: LensCardViewModel
  /// Suppresses speech and chimes. Never turns a muted card into speech later.
  var isMuted = false
  /// Speech rate for spoken answers; lower it for slower speech.
  var speechRate: Float = SystemSpeechSpeaker.defaultRate

  private let speaker: SpeechSpeaking
  private let chime: ChimePlaying
  private weak var playback: PlaybackReporting?
  private let now: () -> Date
  private let debugLog: DebugLog
  /// Posts a VoiceOver announcement.
  private let announce: @MainActor (String) -> Void
  /// Set while a line is speaking. Only the newest line's finish ends playback, so
  /// interrupting one answer with another reports a single started/ended pair.
  private var activeUtterance: UUID?

  init(
    speaker: SpeechSpeaking,
    chime: ChimePlaying,
    playback: PlaybackReporting?,
    history: ResultHistory,
    lens: LensCardViewModel,
    now: @escaping () -> Date = Date.init,
    debugLog: DebugLog = .shared,
    announce: @escaping @MainActor (String) -> Void = { VoiceOverAnnouncer.post($0) }
  ) {
    self.speaker = speaker
    self.chime = chime
    self.playback = playback
    self.history = history
    self.lens = lens
    self.now = now
    self.debugLog = debugLog
    self.announce = announce
  }

  /// Production wiring with the system speaker and chime.
  convenience init(playback: PlaybackReporting?, history: ResultHistory? = nil, lens: LensCardViewModel? = nil) {
    self.init(
      speaker: SystemSpeechSpeaker(), chime: ToneChimePlayer(), playback: playback,
      history: history ?? ResultHistory(), lens: lens ?? LensCardViewModel()
    )
  }

  var isSpeaking: Bool { activeUtterance != nil }

  // MARK: ResultPresenting

  func present(_ result: ClaimResult, presentation: Presentation, userInitiated: Bool, identity: ClaimIdentity) {
    guard history.accepts(identity) else {
      Self.log.info("drop stale result claim=\(identity.claimId, privacy: .public) rev=\(identity.revision)")
      debugLog.log("present.dropped_stale", [
        "requestId": identity.requestId, "claimId": identity.claimId, "revision": identity.revision,
        "verdict": result.verdict.rawValue,
      ])
      return
    }
    let outcome = OutputOutcome.verdict(result.verdict)
    let card = ResultCard(result: result)
    deliver(
      outcome: outcome, result: result, card: card, line: card.spokenLine, presentation: presentation,
      userInitiated: userInitiated, identity: identity
    )
  }

  // MARK: Outcomes without a result

  /// For `claim.needs_confirmation`, `pipeline.error` and client-side timeouts. An explicit
  /// request always gets an answer (`respond`); an automatic one stays in history (`silent`)
  /// because a failed automatic check has its own health indicator.
  /// `claimText` is the text the app sent; it appears only on the card, never in logs.
  func presentOutcome(_ outcome: OutputOutcome, userInitiated: Bool, claimText: String? = nil, identity: ClaimIdentity? = nil) {
    if let identity, !history.accepts(identity) {
      debugLog.log("present.dropped_stale", [
        "requestId": identity.requestId, "claimId": identity.claimId, "revision": identity.revision,
        "outcome": String(describing: outcome),
      ])
      return
    }
    let presentation = Presentation(
      action: userInitiated ? .respond : .silent,
      reasonCode: userInitiated ? "manual_request" : "automatic_no_alert"
    )
    let card = ResultCard(outcome: outcome, claimText: claimText)
    deliver(
      outcome: outcome, result: nil, card: card, line: card.spokenLine, presentation: presentation,
      userInitiated: userInitiated, identity: identity
    )
  }

  // MARK: Controls

  /// "What was that?" / Repeat: speaks the newest delivered entry again. Returns false
  /// when there is nothing to repeat or output is muted.
  @discardableResult
  func repeatLatest() -> Bool {
    guard !isMuted, let entry = history.latestDelivered else {
      debugLog.log("present.repeat", ["repeated": false, "muted": isMuted])
      return false
    }
    debugLog.log("present.repeat", ["repeated": true, "kind": entry.card.kind.rawValue])
    lens.show(entry.card)
    speak(entry.card.spokenLine)
    return true
  }

  /// `claim.superseded`: a correction replaced the request's earlier result. Marks it in
  /// history and takes its card off the lens. With `announce` it says the plan's brief
  /// non-verdict update once; it never presents the new statement as checked.
  func supersede(requestId: String, revision: Int?, announce: Bool) {
    let cards = history.markSuperseded(requestId: requestId, throughRevision: revision)
    guard !cards.isEmpty else { return }
    if let shown = lens.card, cards.contains(shown) { lens.clear() }
    Self.log.info("superseded req=\(requestId, privacy: .public) rev=\(revision ?? 0) entries=\(cards.count) announce=\(announce)")
    debugLog.log("present.superseded", [
      "requestId": requestId, "revision": revision as Any, "entries": cards.count, "announce": announce, "muted": isMuted,
    ])
    if announce, !isMuted { speak(ResultWording.correctionLine) }
  }

  /// Dismiss: clears the active card. History keeps it.
  func dismissCard() {
    lens.clear()
  }

  /// Stop: cuts speech and clears the card so nothing plays after the user stopped.
  func stopOutput() {
    speaker.stopSpeaking()
    lens.clear()
  }

  // MARK: Delivery

  private func deliver(
    outcome: OutputOutcome, result: ClaimResult?, card: ResultCard, line: String, presentation: Presentation,
    userInitiated: Bool, identity: ClaimIdentity?
  ) {
    let delivery: OutputDelivery
    switch presentation.action {
    case .respond:
      lens.show(card)
      if isMuted {
        delivery = .cardOnly
      } else {
        speak(line)
        delivery = .spoken
      }
    case .notify:
      lens.show(card)
      if isMuted {
        delivery = .cardOnly
      } else {
        chime.playChime()
        delivery = .chimed
      }
    case .silent, .unknown:
      delivery = .silent
    }
    if delivery == .cardOnly || delivery == .chimed {
      announce(card.accessibilityLabel)
    }

    history.record(ResultHistory.Entry(
      id: UUID(), identity: identity, outcome: outcome, result: result, presentation: presentation,
      userInitiated: userInitiated, card: card, delivery: delivery, receivedAt: now()
    ))
    // Ids and categories only: never the claim, transcript or OCR text.
    Self.log.info(
      "present action=\(presentation.action.rawValue, privacy: .public) delivery=\(delivery.rawValue, privacy: .public) kind=\(card.kind.rawValue, privacy: .public) claim=\(identity?.claimId ?? "-", privacy: .public) rev=\(identity?.revision ?? 0)"
    )
    debugLog.log("present", [
      "action": presentation.action.rawValue, "delivery": delivery.rawValue, "kind": card.kind.rawValue,
      "reason": presentation.reasonCode, "outcome": String(describing: outcome),
      "verdict": result?.verdict.rawValue as Any, "resultReason": result?.reasonCode as Any,
      "userInitiated": userInitiated, "muted": isMuted, "line": line,
      "requestId": identity?.requestId as Any, "claimId": identity?.claimId as Any, "revision": identity?.revision as Any,
    ])
  }

  private func speak(_ line: String) {
    let id = UUID()
    let wasSpeaking = activeUtterance != nil
    activeUtterance = id
    if wasSpeaking {
      // The cancelled line's finish sees a different id and does not end playback.
      speaker.stopSpeaking()
    } else {
      playback?.playbackStarted()
    }
    speaker.speak(line, rate: speechRate) { [weak self] in
      guard let self, self.activeUtterance == id else { return }
      self.activeUtterance = nil
      self.playback?.playbackEnded()
    }
  }
}
