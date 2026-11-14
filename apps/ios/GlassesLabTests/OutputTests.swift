import XCTest
@testable import GlassesLab

// MARK: - Fakes

@MainActor
private final class FakeSpeaker: SpeechSpeaking {
  private(set) var spoken: [String] = []
  private(set) var stopCount = 0
  private var finishes: [@MainActor () -> Void] = []
  var log: EventLog?

  func speak(_ text: String, rate: Float, onFinish: @escaping @MainActor () -> Void) {
    spoken.append(text)
    finishes.append(onFinish)
    log?.events.append("speak")
  }

  /// Like AVSpeechSynthesizer: stopping cancels the current line, whose finish still runs.
  func stopSpeaking() {
    stopCount += 1
    finishAll()
  }

  func finishAll() {
    let pending = finishes
    finishes.removeAll()
    pending.forEach { $0() }
  }
}

@MainActor
private final class FakeChime: ChimePlaying {
  private(set) var count = 0
  func playChime() { count += 1 }
}

@MainActor
private final class EventLog: PlaybackReporting {
  var events: [String] = []
  func playbackStarted() { events.append("started") }
  func playbackEnded() { events.append("ended") }
}

// MARK: - Helpers

private func evidence(id: String = "ev-1", title: String = "Eiffel Tower history", publisher: String? = "Eiffel Tower") -> Evidence {
  Evidence(
    id: id, url: "https://www.toureiffel.paris/en/the-monument/history", title: title, publisher: publisher,
    publishedAt: nil, retrievedAt: "2026-11-14T10:00:01Z", contentBasis: "highlight",
    excerpt: "The Eiffel Tower opened in 1889.", sourceGroup: "toureiffel.paris", echoGroup: nil,
    sourceRole: "primary", directlyAddressesClaim: true, matchesTimePlaceAndPopulation: true,
    stance: .supports, stanceProbability: 0.96
  )
}

private func result(
  _ verdict: Verdict = .supported,
  action: PresentationAction = .respond,
  checkedText: String = "The Eiffel Tower opened in 1889.",
  evidence items: [Evidence] = [evidence()],
  selected: [String]? = nil
) -> ClaimResult {
  ClaimResult(
    verdict: verdict, reasonCode: "fixture", selectedEvidenceIds: selected ?? items.map(\.id),
    summary: "", originalText: checkedText, checkedText: checkedText,
    sourceSpan: SourceSpan(start: 0, end: CodePoints.count(checkedText)), evidence: items,
    checkedAt: "2026-11-14T10:00:02Z", expiresAt: "2026-11-14T10:01:02Z", durationMs: 1_200, cached: false,
    policyVersion: "glasses-p0.1", modelVersion: "fixture",
    presentation: Presentation(action: action, reasonCode: "fixture")
  )
}

private func identity(_ claim: String = "claim-1", request: String = "req-1", revision: Int = 1) -> ClaimIdentity {
  ClaimIdentity(requestId: request, claimId: claim, revision: revision)
}

// MARK: - Wording

final class ResultWordingTests: XCTestCase {
  func testWordingForEveryOutcomeMatchesThePlan() {
    XCTAssertEqual(ResultWording.line(for: .verdict(.supported)), "Supported by the sources I found.")
    XCTAssertEqual(ResultWording.line(for: .verdict(.contradicted)), "The evidence I found contradicts that claim.")
    XCTAssertEqual(ResultWording.line(for: .verdict(.misleading)), "That needs context.")
    XCTAssertEqual(ResultWording.line(for: .verdict(.insufficientEvidence)), "I couldn't verify that.")
    XCTAssertEqual(ResultWording.line(for: .verdict(.unknown("new_verdict"))), "I couldn't verify that.")
    XCTAssertEqual(ResultWording.line(for: .needsConfirmation(heard: false)), "I'm not sure what was read.")
    XCTAssertEqual(ResultWording.line(for: .needsConfirmation(heard: true)), "I'm not sure what was said.")
    XCTAssertEqual(ResultWording.line(for: .checkFailed), "The check didn't finish.")
  }

  func testVerdictWordsAreDistinctLabels() {
    let kinds: [CardKind] = [.supported, .contradicted, .misleading, .unverified, .needsConfirmation, .checkFailed]
    let words = kinds.map(ResultWording.verdictWord(for:))
    XCTAssertEqual(Set(words).count, kinds.count, "Each kind needs its own word; colour is never the only signal")
    XCTAssertEqual(ResultWording.kind(for: .verdict(.unknown("x"))), .unverified)
  }

  func testSpokenLineNamesTheBestSourceWithinTwentyWords() {
    let verdicts: [Verdict] = [.supported, .contradicted, .misleading, .insufficientEvidence]
    for verdict in verdicts {
      let card = ResultCard(result: result(verdict))
      let line = ResultWording.spokenLine(for: .verdict(verdict), sourceName: card.sourceName)
      XCTAssertTrue(line.hasPrefix(ResultWording.line(for: .verdict(verdict))))
      XCTAssertTrue(line.contains("Eiffel Tower"), line)
      XCTAssertLessThanOrEqual(ResultWording.wordCount(line), ResultWording.maxSpokenWords)
      XCTAssertFalse(line.contains("http"), line)
      XCTAssertFalse(ResultWording.looksLikeURL(line), line)
    }
  }

  func testSourceNameNeverUsesAURL() {
    let urlPublisher = result(evidence: [evidence(title: "Eiffel Tower history", publisher: "www.toureiffel.paris")])
    XCTAssertEqual(ResultWording.bestSourceName(for: urlPublisher), "Eiffel Tower history")

    let domainEverywhere = result(evidence: [evidence(title: "https://example.com/page", publisher: "example.com")])
    XCTAssertNil(ResultWording.bestSourceName(for: domainEverywhere))
    XCTAssertEqual(
      ResultWording.spokenLine(for: .verdict(.supported), sourceName: nil),
      "Supported by the sources I found."
    )

    let unselected = result(evidence: [evidence()], selected: [])
    XCTAssertNil(ResultWording.bestSourceName(for: unselected), "Only selected evidence is named")
  }

  func testLongSourceNameIsDroppedRatherThanExceedingTheWordCap() {
    let name = Array(repeating: "word", count: 12).joined(separator: " ")
    let line = ResultWording.spokenLine(for: .verdict(.contradicted), sourceName: name)
    XCTAssertEqual(line, "The evidence I found contradicts that claim.")
  }

  func testLooksLikeURL() {
    XCTAssertTrue(ResultWording.looksLikeURL("https://a.b"))
    XCTAssertTrue(ResultWording.looksLikeURL("bbc.co.uk"))
    XCTAssertTrue(ResultWording.looksLikeURL("Reuters.com"))
    XCTAssertFalse(ResultWording.looksLikeURL("Eiffel Tower"))
    XCTAssertFalse(ResultWording.looksLikeURL("U.S. Census Bureau"))
    XCTAssertFalse(ResultWording.looksLikeURL("Version 2.0 notes"))
  }

  // MARK: Excerpt

  func testShortExcerptIsUnchanged() {
    XCTAssertEqual(CardText.excerpt("  The Eiffel Tower opened in 1889.  ", maxCodePoints: 70), "The Eiffel Tower opened in 1889.")
  }

  func testLongExcerptIsCutAtAWordWithinTheCodePointLimit() {
    let text = "🙂 The Eiffel Tower opened to the public in March 1889 after two years of construction work in Paris."
    let excerpt = CardText.excerpt(text, maxCodePoints: 70)
    XCTAssertLessThanOrEqual(CodePoints.count(excerpt), 70)
    XCTAssertTrue(excerpt.hasSuffix("…"))
    let body = String(excerpt.dropLast())
    XCTAssertTrue(text.hasPrefix(body))
    // The cut lands on a word boundary: the next character in the source is a space.
    let next = text[text.index(text.startIndex, offsetBy: body.count)]
    XCTAssertEqual(next, " ")
    XCTAssertEqual(excerpt, "🙂 The Eiffel Tower opened to the public in March 1889 after two years…")
  }

  func testExcerptCountsCodePointsNotCharacters() {
    // Each flag is one Character but two code points.
    let flags = String(repeating: "🇫🇮", count: 40)
    let excerpt = CardText.excerpt(flags, maxCodePoints: 70)
    XCTAssertLessThanOrEqual(CodePoints.count(excerpt), 70)
    XCTAssertEqual(excerpt, String(repeating: "🇫🇮", count: 34) + "…", "Flags are never split")
  }

  func testOneLongWordIsHardCut() {
    let word = String(repeating: "a", count: 100)
    XCTAssertEqual(CardText.excerpt(word, maxCodePoints: 70), String(repeating: "a", count: 69) + "…")
  }

  func testCardUsesClaimExcerptAndSource() {
    let card = ResultCard(result: result(.contradicted))
    XCTAssertEqual(card.kind, .contradicted)
    XCTAssertEqual(card.verdictWord, "Contradicted")
    XCTAssertEqual(card.excerpt, "The Eiffel Tower opened in 1889.")
    XCTAssertEqual(card.sourceLine, "Source: Eiffel Tower")
    XCTAssertFalse(card.accessibilityLabel.contains("http"))
  }
}

// MARK: - Presenter

@MainActor
final class ResultPresenterTests: XCTestCase {
  private var speaker: FakeSpeaker!
  private var chime: FakeChime!
  private var playback: EventLog!
  private var history: ResultHistory!
  private var lens: LensCardViewModel!
  private var presenter: ResultPresenter!

  override func setUp() async throws {
    speaker = FakeSpeaker()
    chime = FakeChime()
    playback = EventLog()
    speaker.log = playback
    history = ResultHistory()
    lens = LensCardViewModel()
    presenter = ResultPresenter(speaker: speaker, chime: chime, playback: playback, history: history, lens: lens)
  }

  private func present(_ result: ClaimResult, _ id: ClaimIdentity = identity(), userInitiated: Bool = false) {
    presenter.present(result, presentation: result.presentation, userInitiated: userInitiated, identity: id)
  }

  func testRespondSpeaksTheLineAndSourceInsidePlaybackReports() {
    present(result(.supported, action: .respond), userInitiated: true)

    XCTAssertEqual(speaker.spoken, ["Supported by the sources I found. The best source is Eiffel Tower."])
    XCTAssertEqual(playback.events, ["started", "speak"])
    XCTAssertEqual(chime.count, 0)
    XCTAssertEqual(lens.card?.verdictWord, "Supported")

    speaker.finishAll()
    XCTAssertEqual(playback.events, ["started", "speak", "ended"])
    XCTAssertFalse(presenter.isSpeaking)
    XCTAssertEqual(history.entries.first?.delivery, .spoken)
  }

  func testSilentNeverSpeaksOrChimesButIsKeptInHistory() {
    for verdict in [Verdict.supported, .contradicted, .misleading, .insufficientEvidence] {
      present(result(verdict, action: .silent), identity("claim-\(verdict.rawValue)"))
    }
    XCTAssertTrue(speaker.spoken.isEmpty)
    XCTAssertEqual(chime.count, 0)
    XCTAssertTrue(playback.events.isEmpty)
    XCTAssertNil(lens.card, "silent shows no card")
    XCTAssertEqual(history.entries.count, 4)
    XCTAssertTrue(history.entries.allSatisfy { $0.delivery == .silent })
    XCTAssertNil(history.latestDelivered)
    XCTAssertFalse(presenter.repeatLatest(), "silent entries are never promoted by repeat")
  }

  func testUnknownActionIsTreatedAsSilent() {
    present(result(.contradicted, action: .unknown("shout")))
    XCTAssertTrue(speaker.spoken.isEmpty)
    XCTAssertEqual(chime.count, 0)
    XCTAssertNil(lens.card)
    XCTAssertEqual(history.entries.first?.delivery, .silent)
  }

  func testNotifyChimesAndShowsACardWithoutPlaybackReporting() {
    present(result(.contradicted, action: .notify))
    XCTAssertEqual(chime.count, 1)
    XCTAssertTrue(speaker.spoken.isEmpty)
    XCTAssertTrue(playback.events.isEmpty, "a chime must not pause listening")
    XCTAssertEqual(lens.card?.kind, .contradicted)
    XCTAssertEqual(history.entries.first?.delivery, .chimed)
  }

  func testMutedSuppressesAudioButKeepsCards() {
    presenter.isMuted = true
    present(result(.supported, action: .respond), identity("a"), userInitiated: true)
    XCTAssertTrue(speaker.spoken.isEmpty)
    XCTAssertTrue(playback.events.isEmpty)
    XCTAssertEqual(lens.card?.kind, .supported)

    present(result(.contradicted, action: .notify), identity("b"))
    XCTAssertEqual(chime.count, 0)
    XCTAssertEqual(lens.card?.kind, .contradicted)
    XCTAssertEqual(history.entries.map(\.delivery), [.cardOnly, .cardOnly])
    XCTAssertFalse(presenter.repeatLatest(), "muted output never turns into speech")

    presenter.isMuted = false
    XCTAssertTrue(speaker.spoken.isEmpty, "unmuting does not replay muted results")
  }

  func testInterruptingSpeechReportsOnePlaybackPair() {
    present(result(.supported), identity("a"), userInitiated: true)
    present(result(.contradicted), identity("b"), userInitiated: true)
    XCTAssertEqual(speaker.spoken.count, 2)
    XCTAssertEqual(speaker.stopCount, 1)
    XCTAssertEqual(playback.events, ["started", "speak", "speak"])
    speaker.finishAll()
    XCTAssertEqual(playback.events, ["started", "speak", "speak", "ended"])
  }

  func testStopOutputEndsPlaybackAndClearsTheCard() {
    present(result(.supported), userInitiated: true)
    presenter.stopOutput()
    XCTAssertEqual(playback.events, ["started", "speak", "ended"])
    XCTAssertNil(lens.card)
    XCTAssertEqual(history.entries.count, 1, "history keeps the entry")
  }

  func testStaleRevisionIsDroppedWithoutOutput() {
    present(result(.contradicted, action: .notify), identity(revision: 2))
    present(result(.supported, action: .respond), identity(revision: 1), userInitiated: true)
    XCTAssertTrue(speaker.spoken.isEmpty)
    XCTAssertEqual(chime.count, 1)
    XCTAssertEqual(history.entries.count, 1)
    XCTAssertEqual(history.entries.first?.identity?.revision, 2)
  }

  func testRepeatSpeaksTheLatestDeliveredEntry() {
    present(result(.contradicted, action: .notify))
    XCTAssertTrue(presenter.repeatLatest())
    XCTAssertEqual(speaker.spoken, ["The evidence I found contradicts that claim. The best source is Eiffel Tower."])
    XCTAssertEqual(playback.events, ["started", "speak"])
  }

  func testExplicitFailureAlwaysAnswersAndAutomaticFailureStaysQuiet() {
    presenter.presentOutcome(.checkFailed, userInitiated: true, claimText: "The Eiffel Tower opened in 1889.")
    XCTAssertEqual(speaker.spoken, ["The check didn't finish."])
    XCTAssertEqual(lens.card?.verdictWord, "Check failed")

    presenter.presentOutcome(.needsConfirmation(heard: true), userInitiated: false)
    XCTAssertEqual(speaker.spoken.count, 1)
    XCTAssertEqual(history.entries.first?.delivery, .silent)
    XCTAssertEqual(history.entries.first?.card.kind, .needsConfirmation)
  }

  func testSupersededResultLeavesTheLensAndIsNeverRepeated() {
    present(result(.contradicted, action: .notify), identity("c1", request: "asr-1-1-x", revision: 1))
    XCTAssertEqual(lens.card?.kind, .contradicted)

    presenter.supersede(requestId: "asr-1-1-x", revision: 1, announce: true)

    XCTAssertNil(lens.card)
    XCTAssertEqual(history.entries.first?.superseded, true)
    XCTAssertNil(history.latestDelivered, "a corrected result is not repeated")
    XCTAssertEqual(speaker.spoken, [ResultWording.correctionLine])
    XCTAssertEqual(playback.events, ["started", "speak"], "the update is speech, so it is reported")

    // An unrelated request, or a later revision of the same one, is left alone.
    present(result(.supported, action: .notify), identity("c1", request: "asr-1-1-x", revision: 2))
    presenter.supersede(requestId: "asr-1-1-y", revision: 3, announce: true)
    presenter.supersede(requestId: "asr-1-1-x", revision: 1, announce: true)
    XCTAssertEqual(lens.card?.kind, .supported)
    XCTAssertEqual(speaker.spoken.count, 1)
  }

  func testLensChangeCallbackFires() {
    var seen: [ResultCard?] = []
    lens.onChange = { seen.append($0) }
    present(result(.supported, action: .notify))
    presenter.dismissCard()
    XCTAssertEqual(seen.count, 2)
    XCTAssertEqual(seen.first??.kind, .supported)
    XCTAssertNil(seen.last ?? nil)
  }
}

// MARK: - History

@MainActor
final class ResultHistoryTests: XCTestCase {
  private func entry(_ id: ClaimIdentity?, at seconds: TimeInterval, verdict: Verdict = .supported) -> ResultHistory.Entry {
    let claim = result(verdict, action: .silent)
    return ResultHistory.Entry(
      id: UUID(), identity: id, outcome: .verdict(verdict), result: claim, presentation: claim.presentation,
      userInitiated: false, card: ResultCard(result: claim), delivery: .silent,
      receivedAt: Date(timeIntervalSince1970: seconds)
    )
  }

  func testNewestEntryComesFirst() {
    let history = ResultHistory()
    history.record(entry(identity("a"), at: 1))
    history.record(entry(identity("b"), at: 2))
    history.record(entry(nil, at: 3))
    XCTAssertEqual(history.entries.map(\.receivedAt.timeIntervalSince1970), [3, 2, 1])
    XCTAssertEqual(history.entries.map { $0.identity?.claimId }, [nil, "b", "a"])
  }

  func testNewerRevisionReplacesOlderAndMovesToTop() {
    let history = ResultHistory()
    history.record(entry(identity("a", revision: 1), at: 1))
    history.record(entry(identity("b"), at: 2))
    XCTAssertTrue(history.record(entry(identity("a", revision: 2), at: 3, verdict: .contradicted)))
    XCTAssertEqual(history.entries.map { $0.identity?.claimId }, ["a", "b"])
    XCTAssertEqual(history.entries.first?.identity?.revision, 2)
    XCTAssertFalse(history.record(entry(identity("a", revision: 1), at: 4)), "stale revision ignored")
    XCTAssertFalse(history.record(entry(identity("a", revision: 2), at: 5)), "repeated revision ignored")
    XCTAssertEqual(history.entries.count, 2)
  }

  func testTwoClaimsOfOneRequestAreBothKept() {
    let history = ResultHistory()
    history.record(entry(identity("claim-1", request: "req"), at: 1))
    history.record(entry(identity("claim-2", request: "req"), at: 2))
    XCTAssertEqual(history.entries.count, 2)
  }

  func testCapacityDropsTheOldest() {
    let history = ResultHistory(capacity: 3)
    for index in 0..<5 {
      history.record(entry(identity("c\(index)"), at: TimeInterval(index)))
    }
    XCTAssertEqual(history.entries.map { $0.identity?.claimId }, ["c4", "c3", "c2"])
    XCTAssertFalse(history.accepts(identity("c0")), "evicted claims still reject stale revisions")
  }
}

// MARK: - Chime

final class ChimeToneTests: XCTestCase {
  func testChimeIsAShortValidWAV() {
    let data = ToneChimePlayer.chimeWAV(sampleRate: 22_050)
    XCTAssertEqual(String(decoding: data.prefix(4), as: UTF8.self), "RIFF")
    XCTAssertEqual(String(decoding: data.subdata(in: 8..<12), as: UTF8.self), "WAVE")
    let samples = (data.count - 44) / 2
    XCTAssertEqual(Double(samples) / 22_050, 0.18, accuracy: 0.01, "two 90 ms notes")
  }
}

// MARK: - Display card

@MainActor
final class DisplayCardBuilderTests: XCTestCase {
  func testCardUsesRealClaimSummaryAndPublisher() {
    var checked = result(.misleading)
    checked.summary = "The tower opened in 1889, after construction began in 1887."
    let card = ResultCard(result: checked)
    let texts = DisplayCardBuilder.textContents(of: DisplayCardBuilder.build(card))
    XCTAssertEqual(texts, ["The Eiffel Tower opened in 1889.", "Needs context", checked.summary, "Eiffel Tower"])
    XCTAssertNil(card.captureLabel, "The result contract alone does not identify the input mode")
  }

  func testDisplayControlsRemainOnThePhone() {
    let card = ResultCard(outcome: .checkFailed, claimText: nil)
    let plain = DisplayCardBuilder.textContents(of: DisplayCardBuilder.build(card))
    let withHandlers = DisplayCardBuilder.textContents(of: DisplayCardBuilder.build(card, onRepeat: {}, onDismiss: {}))
    XCTAssertEqual(plain, ["Check failed", "The check didn't finish."])
    XCTAssertEqual(withHandlers, plain)
  }

  func testEmptySummaryDoesNotInventACorrection() {
    let card = ResultCard(result: result(.contradicted))
    XCTAssertNil(card.detailText)
    let texts = DisplayCardBuilder.textContents(of: DisplayCardBuilder.build(card))
    XCTAssertTrue(texts.contains("The evidence I found contradicts that claim."))
  }

  func testNativeSearchingUsesOnlyFourDistinctValidHosts() {
    let hosts = ["toureiffel.paris", "https://bad.example/path", "TOUREIFFEL.PARIS", "user@bad.example", "britannica.com", "wikipedia.org", "sciencemuseum.org.uk", "extra.example"]
    let sources = hosts.enumerated().map { index, host in
      ClaimSourcesPayload.Source(id: String(index), hostname: host, title: "", stage: "found", provider: "exa")
    }
    XCTAssertEqual(NativeLensCardLayout.sourceHostnames(sources), ["toureiffel.paris", "britannica.com", "wikipedia.org", "sciencemuseum.org.uk"])
    let texts = DisplayCardBuilder.textContents(of: NativeLensCardLayout.searching(claimText: "A real incoming claim", captureLabel: "Read from screen", sources: sources))
    XCTAssertEqual(texts, ["Read from screen", "A real incoming claim", "Searching..."])
  }

  func testLensAndMirrorHaveAnIconForEveryKind() {
    let kinds: [CardKind] = [.supported, .contradicted, .misleading, .unverified, .needsConfirmation, .checkFailed]
    XCTAssertEqual(Set(kinds.map { DisplayCardBuilder.icon(for: $0).rawValue }).count, kinds.count)
    XCTAssertEqual(Set(kinds.map(LensMirrorCanvas.symbol(for:))).count, kinds.count)
  }
}
