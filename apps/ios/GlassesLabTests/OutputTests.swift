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

private func evidence(
  id: String = "ev-1",
  title: String = "Eiffel Tower history",
  publisher: String? = "Eiffel Tower",
  url: String = "https://www.toureiffel.paris/en/the-monument/history",
  stance: EvidenceStance = .supports,
  excerpt: String = "The Eiffel Tower opened in 1889."
) -> Evidence {
  Evidence(
    id: id, url: url, title: title, publisher: publisher,
    publishedAt: nil, retrievedAt: "2026-11-14T10:00:01Z", contentBasis: "highlight",
    excerpt: excerpt, sourceGroup: "toureiffel.paris", echoGroup: nil,
    sourceRole: "primary", directlyAddressesClaim: true, matchesTimePlaceAndPopulation: true,
    stance: stance, stanceProbability: 0.96
  )
}

private func result(
  _ verdict: Verdict = .supported,
  action: PresentationAction = .respond,
  reasonCode: String = "fixture",
  checkedText: String = "The Eiffel Tower opened in 1889.",
  evidence items: [Evidence] = [evidence()],
  selected: [String]? = nil
) -> ClaimResult {
  ClaimResult(
    verdict: verdict, reasonCode: reasonCode, selectedEvidenceIds: selected ?? items.map(\.id),
    summary: "", originalText: checkedText, checkedText: checkedText,
    sourceSpan: SourceSpan(start: 0, end: CodePoints.count(checkedText)), evidence: items,
    checkedAt: "2026-11-14T10:00:02Z", expiresAt: "2026-11-14T10:01:02Z", durationMs: 1_200, cached: false,
    policyVersion: "glasses-p0.1", modelVersion: "fixture",
    presentation: Presentation(action: action, reasonCode: "fixture")
  )
}

/// The website's False example: three selected sources contradict the claim.
private func falseEiffel() -> ClaimResult {
  result(.contradicted, checkedText: "The Eiffel Tower opened in 1890.", evidence: [
    evidence(id: "ls", publisher: "Live Science", url: "https://www.livescience.com/eiffel", stance: .contradicts,
             excerpt: "The tower opened to the public on 31 March 1889."),
    evidence(id: "te", publisher: nil, url: "https://www.toureiffel.paris/en", stance: .contradicts),
    evidence(id: "bb", publisher: "BBC", url: "https://www.bbc.co.uk/news/eiffel", stance: .contradicts),
  ])
}

/// The website's True example: two of three selected sources support the claim.
private func trueNASA() -> ClaimResult {
  result(.supported, checkedText: "The Moon has no atmosphere to speak of.", evidence: [
    evidence(id: "nasa", publisher: "NASA", url: "https://science.nasa.gov/moon", stance: .supports),
    evidence(id: "esa", publisher: "ESA", url: "https://www.esa.int/moon", stance: .supports),
    evidence(id: "wiki", publisher: "Wikipedia", url: "https://en.wikipedia.org/wiki/Moon", stance: .unrelated),
  ])
}

private extension ClaimResult {
  func withAction(_ action: PresentationAction) -> ClaimResult {
    var copy = self
    copy.presentation = Presentation(action: action, reasonCode: "fixture")
    return copy
  }
}

private func identity(_ claim: String = "claim-1", request: String = "req-1", revision: Int = 1) -> ClaimIdentity {
  ClaimIdentity(requestId: request, claimId: claim, revision: revision)
}

// MARK: - Wording

final class ResultWordingTests: XCTestCase {
  // MARK: Words and lines

  func testVerdictWordsMatchTheWebsite() {
    let kinds: [CardKind] = [.supported, .contradicted, .misleading, .unverified, .needsConfirmation, .checkFailed]
    XCTAssertEqual(
      kinds.map(ResultWording.verdictWord(for:)),
      ["True", "False", "Misleading", "Can\u{2019}t verify", "Not sure", "Check failed"]
    )
    XCTAssertEqual(ResultWording.kind(for: .verdict(.unknown("x"))), .unverified)
  }

  func testLinesForOutcomesWithoutAResult() {
    XCTAssertEqual(ResultWording.line(for: .verdict(.supported)), "True.")
    XCTAssertEqual(ResultWording.line(for: .verdict(.contradicted)), "False.")
    XCTAssertEqual(ResultWording.line(for: .verdict(.misleading)), "Misleading.")
    XCTAssertEqual(ResultWording.line(for: .verdict(.insufficientEvidence)), "Can’t verify. No reliable source addresses it.")
    XCTAssertEqual(ResultWording.line(for: .verdict(.unknown("new_verdict"))), "Can’t verify. No reliable source addresses it.")
    XCTAssertEqual(ResultWording.line(for: .needsConfirmation(heard: true)), "I’m not sure what was said.")
    XCTAssertEqual(ResultWording.line(for: .needsConfirmation(heard: false)), "I’m not sure what was read.")
    XCTAssertEqual(ResultWording.line(for: .checkFailed), "The check didn’t finish.")
  }

  func testMisleadingReasons() {
    XCTAssertEqual(ResultWording.misleadingReason(code: "omitted_condition"), "Missing context")
    XCTAssertEqual(ResultWording.misleadingReason(code: "outdated_fact"), "Out of date")
    XCTAssertEqual(ResultWording.misleadingReason(code: "exaggeration"), "Exaggerated")
    for code in [nil, "", "partly_true", "partially_true", "true_in_part"] {
      XCTAssertEqual(ResultWording.misleadingReason(code: code), "True only in part", String(describing: code))
    }
    XCTAssertEqual(ResultWording.misleadingReason(code: "something_new"), "Missing context")
  }

  // MARK: Spoken lines

  func testSpokenLineExamplesFromTheSpec() {
    XCTAssertEqual(ResultWording.spokenLine(for: falseEiffel()), "False. 3 of 3 sources disagree, including Live Science.")
    XCTAssertEqual(ResultWording.spokenLine(for: trueNASA()), "True. 2 of 3 sources agree, including NASA.")

    let oneFalse = result(.contradicted, evidence: [evidence(publisher: "Live Science", stance: .contradicts)])
    XCTAssertEqual(ResultWording.spokenLine(for: oneFalse), "False. 1 source disagrees: Live Science.")
    let oneTrue = result(.supported, evidence: [evidence(publisher: "NASA", stance: .supports)])
    XCTAssertEqual(ResultWording.spokenLine(for: oneTrue), "True. 1 source agrees: NASA.")

    XCTAssertEqual(ResultWording.spokenLine(for: result(.misleading, reasonCode: "outdated_fact")), "Misleading. Out of date.")
    XCTAssertEqual(ResultWording.spokenLine(for: result(.misleading, reasonCode: "omitted_condition")), "Misleading. Missing context.")
    XCTAssertEqual(ResultWording.spokenLine(for: result(.misleading, reasonCode: "exaggeration")), "Misleading. Exaggerated.")
    XCTAssertEqual(ResultWording.spokenLine(for: result(.insufficientEvidence)), "Can’t verify. No reliable source addresses it.")
    XCTAssertEqual(ResultWording.spokenLine(for: result(.unknown("new"))), "Can’t verify. No reliable source addresses it.")
  }

  func testSpokenLineWithoutAMatchingSourceIsTheVerdictAlone() {
    let unrelated = result(.contradicted, evidence: [evidence(stance: .unrelated)])
    XCTAssertEqual(ResultWording.spokenLine(for: unrelated), "False.")
    XCTAssertEqual(ResultWording.spokenLine(for: result(.supported, selected: [])), "True.")
  }

  func testSpokenLineDropsAMissingOrOverlongSource() {
    let nameless = result(.contradicted, evidence: [
      evidence(id: "a", publisher: nil, url: "", stance: .contradicts),
      evidence(id: "b", publisher: nil, url: "", stance: .contradicts),
    ])
    XCTAssertEqual(ResultWording.spokenLine(for: nameless), "False. 2 of 2 sources disagree.")

    // 20 one-letter words fit the 40 code point name cap but push the line past 20 words.
    let wordy = (0..<20).map { _ in "a" }.joined(separator: " ")
    let long = result(.supported, evidence: [evidence(id: "a", publisher: wordy), evidence(id: "b", publisher: wordy)])
    XCTAssertEqual(ResultWording.spokenLine(for: long), "True. 2 of 2 sources agree.")
    let longSingle = result(.supported, evidence: [evidence(publisher: wordy)])
    XCTAssertEqual(ResultWording.spokenLine(for: longSingle), "True. 1 source agrees.")
  }

  func testNoSpokenLineContainsAURLOrRunsOver() {
    let sources: [Evidence] = [
      evidence(id: "a", publisher: nil, url: "https://www.toureiffel.paris/en"),
      evidence(id: "b", publisher: "www.example.com", url: "https://www.example.com/x"),
      evidence(id: "c", publisher: "https://news.example.org/story", url: "https://news.example.org/story"),
      evidence(id: "d", publisher: "info@example.net", url: "http://example.net"),
      evidence(id: "e", publisher: String(repeating: "Long Publisher Name ", count: 5), url: "https://x.example"),
    ]
    let verdicts: [Verdict] = [.supported, .contradicted, .misleading, .insufficientEvidence, .unknown("x")]
    for source in sources {
      for stance in [EvidenceStance.supports, .contradicts] {
        var item = source
        item.stance = stance
        for verdict in verdicts {
          let line = ResultWording.spokenLine(for: result(verdict, evidence: [item, evidence(id: "z", stance: stance)]))
          XCTAssertFalse(line.lowercased().contains("http"), line)
          XCTAssertFalse(line.contains("://"), line)
          XCTAssertFalse(line.lowercased().contains("www."), line)
          XCTAssertLessThanOrEqual(ResultWording.wordCount(line), ResultWording.maxSpokenWords, line)
        }
      }
    }
  }

  // MARK: Counts and detail

  func testStanceCountCoversAllSelectedEvidence() {
    XCTAssertEqual(ResultWording.stanceCount(for: falseEiffel()), ResultWording.StanceCount(matching: 3, total: 3))
    XCTAssertEqual(ResultWording.stanceCount(for: trueNASA()), ResultWording.StanceCount(matching: 2, total: 3))

    let partlyUnselected = result(.contradicted, evidence: [
      evidence(id: "a", stance: .contradicts), evidence(id: "b", stance: .supports), evidence(id: "c", stance: .contradicts),
    ], selected: ["a", "b"])
    XCTAssertEqual(ResultWording.stanceCount(for: partlyUnselected), ResultWording.StanceCount(matching: 1, total: 2), "unselected evidence never counts")

    XCTAssertNil(ResultWording.stanceCount(for: result(.misleading)))
    XCTAssertNil(ResultWording.stanceCount(for: result(.insufficientEvidence)))
    XCTAssertNil(ResultWording.stanceCount(for: result(.unknown("x"))))
  }

  func testDetailForResults() {
    XCTAssertEqual(ResultWording.detail(for: trueNASA()), "2 of 3 sources agree")
    XCTAssertEqual(ResultWording.detail(for: result(.supported)), "1 source agrees")
    XCTAssertEqual(ResultWording.detail(for: falseEiffel()), "3 of 3 sources disagree")
    XCTAssertEqual(ResultWording.detail(for: result(.contradicted, evidence: [evidence(stance: .contradicts)])), "1 source disagrees")
    XCTAssertNil(ResultWording.detail(for: result(.contradicted, evidence: [evidence(stance: .supports)])))
    XCTAssertNil(ResultWording.detail(for: result(.supported, selected: [])))
    XCTAssertEqual(ResultWording.detail(for: result(.misleading, reasonCode: "exaggeration")), "Exaggerated")
    XCTAssertEqual(ResultWording.detail(for: result(.misleading, reasonCode: "partly_true")), "True only in part")
    XCTAssertEqual(ResultWording.detail(for: result(.insufficientEvidence)), "No reliable source addresses it")
    XCTAssertEqual(ResultWording.detail(for: result(.unknown("x"))), "No reliable source addresses it")
  }

  func testDetailForOutcomes() {
    XCTAssertEqual(ResultWording.detail(for: OutputOutcome.needsConfirmation(heard: true)), "Say it again")
    XCTAssertEqual(ResultWording.detail(for: OutputOutcome.needsConfirmation(heard: false)), "Move closer and try again")
    XCTAssertEqual(ResultWording.detail(for: OutputOutcome.checkFailed), "Try again")
  }

  // MARK: Sources

  func testBestEvidencePrefersTheMatchingStanceAndNeverUnselected() {
    let mixed = result(.contradicted, evidence: [
      evidence(id: "wiki", publisher: "Wikipedia", stance: .unrelated),
      evidence(id: "ls", publisher: "Live Science", stance: .contradicts),
    ])
    XCTAssertEqual(ResultWording.bestEvidence(for: mixed)?.id, "ls")
    XCTAssertEqual(ResultWording.bestSourceName(for: mixed), "Live Science")

    let unselectedMatch = result(.contradicted, evidence: [
      evidence(id: "sel", publisher: "Selected", stance: .supports),
      evidence(id: "hidden", publisher: "Hidden", stance: .contradicts),
    ], selected: ["sel"])
    XCTAssertEqual(ResultWording.bestEvidence(for: unselectedMatch)?.id, "sel", "falls back to the first selected item")
    XCTAssertEqual(ResultWording.bestEvidence(for: result(.misleading))?.id, "ev-1")
    XCTAssertNil(ResultWording.bestEvidence(for: result(.supported, selected: [])))
    XCTAssertNil(ResultWording.bestSourceName(for: result(.supported, selected: [])), "only selected evidence is named")
  }

  func testSourceNameIsThePublisherOrTheDomainNeverTheTitle() {
    XCTAssertEqual(ResultWording.sourceName(for: evidence(publisher: "  Live Science ")), "Live Science")
    XCTAssertEqual(ResultWording.sourceName(for: evidence(publisher: nil, url: "https://www.toureiffel.paris/en")), "toureiffel.paris")
    XCTAssertEqual(ResultWording.sourceName(for: evidence(publisher: "   ", url: "https://www.toureiffel.paris/en")), "toureiffel.paris")
    XCTAssertEqual(ResultWording.sourceName(for: evidence(publisher: "www.toureiffel.paris")), "toureiffel.paris")
    XCTAssertEqual(ResultWording.sourceName(for: evidence(publisher: "https://www.bbc.co.uk/news")), "bbc.co.uk")
    XCTAssertEqual(ResultWording.sourceName(for: evidence(publisher: "Reuters.com")), "reuters.com")
    XCTAssertNil(ResultWording.sourceName(for: evidence(title: "Eiffel Tower history", publisher: nil, url: "")), "never the title")
    XCTAssertNil(ResultWording.sourceName(for: evidence(publisher: nil, url: "http://192.168.1.20:3000/page")))

    let long = ResultWording.sourceName(for: evidence(publisher: String(repeating: "Publisher ", count: 8)))
    XCTAssertLessThanOrEqual(CodePoints.count(long ?? ""), ResultWording.maxSourceNameCodePoints)
  }

  func testRegistrableDomain() {
    XCTAssertEqual(ResultWording.registrableDomain(of: "https://www.toureiffel.paris/en"), "toureiffel.paris")
    XCTAssertEqual(ResultWording.registrableDomain(of: "https://www.bbc.co.uk/news/world"), "bbc.co.uk")
    XCTAssertEqual(ResultWording.registrableDomain(of: "https://news.bbc.co.uk"), "bbc.co.uk")
    XCTAssertEqual(ResultWording.registrableDomain(of: "https://edition.cnn.com/2026/11/14"), "cnn.com")
    XCTAssertEqual(ResultWording.registrableDomain(of: "https://www.smh.com.au/national"), "smh.com.au")
    XCTAssertEqual(ResultWording.registrableDomain(of: "HTTPS://WWW.NASA.GOV/"), "nasa.gov")
    XCTAssertEqual(ResultWording.registrableDomain(of: "www.livescience.com"), "livescience.com")
    XCTAssertNil(ResultWording.registrableDomain(of: "http://192.168.1.20:3000/v1"))
    XCTAssertNil(ResultWording.registrableDomain(of: "http://[::1]:3000/"))
    XCTAssertNil(ResultWording.registrableDomain(of: "https://"))
    XCTAssertNil(ResultWording.registrableDomain(of: ""))
  }

  func testLooksLikeURL() {
    XCTAssertTrue(ResultWording.looksLikeURL("https://a.b"))
    XCTAssertTrue(ResultWording.looksLikeURL("bbc.co.uk"))
    XCTAssertTrue(ResultWording.looksLikeURL("Reuters.com"))
    XCTAssertFalse(ResultWording.looksLikeURL("Eiffel Tower"))
    XCTAssertFalse(ResultWording.looksLikeURL("U.S. Census Bureau"))
    XCTAssertFalse(ResultWording.looksLikeURL("Version 2.0 notes"))
  }

  // MARK: Card

  func testFalseCardCarriesEveryField() {
    let card = ResultCard(result: falseEiffel())
    XCTAssertEqual(card.kind, .contradicted)
    XCTAssertEqual(card.verdictWord, "False")
    XCTAssertEqual(card.detail, "3 of 3 sources disagree")
    XCTAssertEqual(card.excerpt, "The Eiffel Tower opened in 1890.")
    XCTAssertEqual(card.quote, "“The tower opened to the public on 31 March 1889.”")
    XCTAssertEqual(card.sourceName, "Live Science")
    XCTAssertEqual(card.sourceLine, "Live Science", "no Source: prefix")
    XCTAssertEqual(card.spokenLine, "False. 3 of 3 sources disagree, including Live Science.")
    XCTAssertEqual(
      card.accessibilityLabel,
      "False. 3 of 3 sources disagree. Claim: The Eiffel Tower opened in 1890. Source: Live Science."
    )
  }

  func testCardQuoteIsCappedAndNilWhenBlank() {
    let long = String(repeating: "The tower was the tallest structure in the world for 41 years. ", count: 5)
    let quote = ResultCard(result: result(evidence: [evidence(excerpt: long)])).quote ?? ""
    XCTAssertLessThanOrEqual(CodePoints.count(quote), ResultWording.maxQuoteCodePoints)
    XCTAssertTrue(quote.hasPrefix("“"))
    XCTAssertTrue(quote.hasSuffix("…”"))

    XCTAssertNil(ResultCard(result: result(evidence: [evidence(excerpt: "  ")])).quote)
    XCTAssertEqual(ResultCard(result: result(evidence: [evidence(excerpt: "\"Opened in 1889.\"")])).quote, "“Opened in 1889.”")
    XCTAssertNil(ResultCard(result: result(.supported, selected: [])).quote)
  }

  func testOutcomeCard() {
    let failed = ResultCard(outcome: .checkFailed, claimText: nil)
    XCTAssertEqual(failed.verdictWord, "Check failed")
    XCTAssertEqual(failed.detail, "Try again")
    XCTAssertNil(failed.quote)
    XCTAssertNil(failed.sourceName)
    XCTAssertEqual(failed.spokenLine, "The check didn’t finish.")
    XCTAssertEqual(failed.accessibilityLabel, "Check failed. Try again.")

    let unsure = ResultCard(outcome: .needsConfirmation(heard: false), claimText: "Opened in 1889")
    XCTAssertEqual(unsure.verdictWord, "Not sure")
    XCTAssertEqual(unsure.detail, "Move closer and try again")
    XCTAssertEqual(unsure.accessibilityLabel, "Not sure. Move closer and try again. Claim: Opened in 1889.")
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

    XCTAssertEqual(speaker.spoken, ["True. 1 source agrees: Eiffel Tower."])
    XCTAssertEqual(playback.events, ["started", "speak"])
    XCTAssertEqual(chime.count, 0)
    XCTAssertEqual(lens.card?.verdictWord, "True")

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
    present(falseEiffel().withAction(.notify))
    XCTAssertTrue(presenter.repeatLatest())
    XCTAssertEqual(speaker.spoken, ["False. 3 of 3 sources disagree, including Live Science."])
    XCTAssertEqual(playback.events, ["started", "speak"])
  }

  func testExplicitFailureAlwaysAnswersAndAutomaticFailureStaysQuiet() {
    presenter.presentOutcome(.checkFailed, userInitiated: true, claimText: "The Eiffel Tower opened in 1889.")
    XCTAssertEqual(speaker.spoken, ["The check didn’t finish."])
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
  private struct SendFailed: Error {}

  func testFalseCardShowsExcerptVerdictDetailAndSource() {
    let card = ResultCard(result: falseEiffel())
    let box = DisplayCardBuilder.build(card)
    XCTAssertEqual(
      DisplayCardBuilder.textContents(of: box),
      ["The Eiffel Tower opened in 1890.", "False", "3 of 3 sources disagree", "Live Science"]
    )
    XCTAssertTrue(DisplayCardBuilder.containsImage(box), "True and False carry the verdict swatch")
  }

  func testCardWithoutSwatchShowsTheIcon() {
    let card = ResultCard(result: falseEiffel())
    let box = DisplayCardBuilder.build(card, includeSwatch: false)
    XCTAssertFalse(DisplayCardBuilder.containsImage(box))
    XCTAssertEqual(DisplayCardBuilder.textContents(of: box), DisplayCardBuilder.textContents(of: DisplayCardBuilder.build(card)))
  }

  func testNotSureAndCheckFailedUseIconsNotSwatches() {
    for outcome in [OutputOutcome.needsConfirmation(heard: true), .checkFailed] {
      let box = DisplayCardBuilder.build(ResultCard(outcome: outcome, claimText: "x"))
      XCTAssertFalse(DisplayCardBuilder.containsImage(box), "\(outcome)")
    }
  }

  func testButtonsAppearOnlyWithHandlers() {
    let card = ResultCard(outcome: .checkFailed, claimText: nil)
    let plain = DisplayCardBuilder.textContents(of: DisplayCardBuilder.build(card))
    XCTAssertEqual(plain, ["Check failed", "Try again"])

    let withButtons = DisplayCardBuilder.textContents(of: DisplayCardBuilder.build(card, onRepeat: {}, onDismiss: {}))
    XCTAssertEqual(withButtons, ["Check failed", "Try again", "Repeat", "Dismiss"])

    let repeatOnly = DisplayCardBuilder.textContents(of: DisplayCardBuilder.build(card, onRepeat: {}))
    XCTAssertEqual(repeatOnly, ["Check failed", "Try again", "Repeat"])
  }

  func testReadyCard() {
    XCTAssertEqual(DisplayCardBuilder.textContents(of: DisplayCardBuilder.buildReady()), ["facto", "Ready"])
  }

  func testSwatchesExistForTheFourVerdictsOnly() throws {
    for kind in [CardKind.supported, .contradicted, .misleading, .unverified] {
      let image = try XCTUnwrap(DisplayCardBuilder.swatchImage(for: kind), "\(kind)")
      XCTAssertEqual(image.size, CGSize(width: 64, height: 64), "\(kind)")
      XCTAssertEqual(image.scale, 1, "\(kind)")
    }
    XCTAssertNil(DisplayCardBuilder.swatchImage(for: .needsConfirmation))
    XCTAssertNil(DisplayCardBuilder.swatchImage(for: .checkFailed))
    XCTAssertTrue(
      DisplayCardBuilder.swatchImage(for: .supported) === DisplayCardBuilder.swatchImage(for: .supported),
      "swatches are drawn once"
    )
  }

  func testLensHasAnIconForEveryKind() {
    let kinds: [CardKind] = [.supported, .contradicted, .misleading, .unverified, .needsConfirmation, .checkFailed]
    XCTAssertEqual(Set(kinds.map { DisplayCardBuilder.icon(for: $0).rawValue }).count, kinds.count)
  }

  // MARK: Swatch fallback

  func testFailedSwatchSendIsResentWithTheIcon() async throws {
    var sent: [Bool] = []
    let keepSwatches = try await DisplayCardBuilder.send(
      ResultCard(result: falseEiffel()), includeSwatch: true, onRepeat: nil, onDismiss: nil
    ) { box in
      let hasSwatch = DisplayCardBuilder.containsImage(box)
      sent.append(hasSwatch)
      if hasSwatch { throw SendFailed() }
    }
    XCTAssertEqual(sent, [true, false])
    XCTAssertFalse(keepSwatches)
  }

  func testSuccessfulSwatchSendKeepsSwatches() async throws {
    var sent: [Bool] = []
    let keepSwatches = try await DisplayCardBuilder.send(
      ResultCard(result: falseEiffel()), includeSwatch: true, onRepeat: nil, onDismiss: nil
    ) { sent.append(DisplayCardBuilder.containsImage($0)) }
    XCTAssertEqual(sent, [true])
    XCTAssertTrue(keepSwatches)
  }

  func testSendWithoutSwatchesNeverRetries() async {
    var attempts = 0
    do {
      _ = try await DisplayCardBuilder.send(
        ResultCard(result: falseEiffel()), includeSwatch: false, onRepeat: nil, onDismiss: nil
      ) { box in
        attempts += 1
        XCTAssertFalse(DisplayCardBuilder.containsImage(box))
        throw SendFailed()
      }
      XCTFail("the send error reaches the caller")
    } catch {
      XCTAssertEqual(attempts, 1)
    }
  }

  func testIconCardFailureKeepsSwatchesForLaterCards() async {
    var attempts = 0
    do {
      _ = try await DisplayCardBuilder.send(
        ResultCard(outcome: .checkFailed, claimText: nil), includeSwatch: true, onRepeat: nil, onDismiss: nil
      ) { _ in
        attempts += 1
        throw SendFailed()
      }
      XCTFail("the send error reaches the caller")
    } catch {
      XCTAssertEqual(attempts, 1, "a card without a swatch has nothing to drop")
    }
  }
}
