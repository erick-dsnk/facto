import Foundation

// Wording for spoken and on-lens output, in the website's words: True, False, Misleading,
// Can’t verify. Pure functions, no audio, no SDK. Visible strings use ’ (U+2019).

/// What the wearer is told about one check. Verdicts come from `claim.result`; the other two
/// come from `claim.needs_confirmation` and `pipeline.error` / timeouts.
enum OutputOutcome: Equatable, Sendable {
  case verdict(Verdict)
  /// `heard` is true for audio input ("said"), false for OCR or typed input ("read").
  case needsConfirmation(heard: Bool)
  /// Error or timeout. Never a factual verdict.
  case checkFailed
}

/// Visual category of a card. The lens has only two text colours, so every kind carries
/// its own word and icon; colour is never the only signal.
enum CardKind: String, Equatable, Sendable {
  case supported, contradicted, misleading, unverified, needsConfirmation, checkFailed
}

enum ResultWording {
  /// Spoken lines stay at or under this many words.
  static let maxSpokenWords = 20
  /// Claim excerpt length on the card, in Unicode code points.
  static let maxExcerptCodePoints = 70
  /// Source names longer than this are shortened before they are spoken or shown.
  static let maxSourceNameCodePoints = 40
  /// Evidence quote length on the card, quotation marks included, in code points.
  static let maxQuoteCodePoints = 140

  /// Brief update when a spoken result was corrected (plan: "late correction").
  static let correctionLine = "That statement was corrected."
  /// Detail and spoken reason for Can’t verify.
  static let noSourceDetail = "No reliable source addresses it"
  /// The full spoken line for Can’t verify and unknown verdicts.
  static let cantVerifyLine = "Can’t verify. \(noSourceDetail)."

  // MARK: Outcomes

  /// The short line for an outcome without its result (no counts, no source).
  static func line(for outcome: OutputOutcome) -> String {
    switch outcome {
    case .verdict(.supported): "True."
    case .verdict(.contradicted): "False."
    case .verdict(.misleading): "Misleading."
    // A verdict this build does not know is not a factual verdict; say so neutrally.
    case .verdict(.insufficientEvidence), .verdict(.unknown): cantVerifyLine
    case .needsConfirmation(let heard): heard ? "I’m not sure what was said." : "I’m not sure what was read."
    case .checkFailed: "The check didn’t finish."
    }
  }

  static func kind(for outcome: OutputOutcome) -> CardKind {
    switch outcome {
    case .verdict(.supported): .supported
    case .verdict(.contradicted): .contradicted
    case .verdict(.misleading): .misleading
    case .verdict(.insufficientEvidence), .verdict(.unknown): .unverified
    case .needsConfirmation: .needsConfirmation
    case .checkFailed: .checkFailed
    }
  }

  /// The verdict word at the top of the card, as on the website.
  static func verdictWord(for kind: CardKind) -> String {
    switch kind {
    case .supported: "True"
    case .contradicted: "False"
    case .misleading: "Misleading"
    case .unverified: "Can’t verify"
    case .needsConfirmation: "Not sure"
    case .checkFailed: "Check failed"
    }
  }

  /// Why a claim is misleading, from the backend's `reasonCode`. No code means the claim is
  /// true only in part; a code this build does not know reads "Missing context".
  static func misleadingReason(code: String?) -> String {
    let code = code?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() ?? ""
    switch code {
    case "omitted_condition": return "Missing context"
    case "outdated_fact": return "Out of date"
    case "exaggeration": return "Exaggerated"
    case "", "partly_true", "partially_true", "true_in_part": return "True only in part"
    default: return "Missing context"
    }
  }

  // MARK: Sources

  /// How many selected sources back the verdict: `matching` of `total`.
  struct StanceCount: Equatable {
    let matching: Int
    let total: Int
  }

  /// The stance a source needs to back the verdict: supports for True, contradicts for False.
  /// Nil for every other verdict.
  static func matchingStance(for verdict: Verdict) -> EvidenceStance? {
    switch verdict {
    case .supported: .supports
    case .contradicted: .contradicts
    default: nil
    }
  }

  /// Counts the selected evidence for True and False. `total` is every selected item;
  /// `matching` is those that support (True) or contradict (False) the claim.
  static func stanceCount(for result: ClaimResult) -> StanceCount? {
    guard let stance = matchingStance(for: result.verdict) else { return nil }
    let selected = result.selectedEvidence
    return StanceCount(matching: selected.filter { $0.stance == stance }.count, total: selected.count)
  }

  /// The source to name: the first selected item with the matching stance, else the first
  /// selected item. Unselected evidence is never named.
  static func bestEvidence(for result: ClaimResult) -> Evidence? {
    let selected = result.selectedEvidence
    if let stance = matchingStance(for: result.verdict), let match = selected.first(where: { $0.stance == stance }) {
      return match
    }
    return selected.first
  }

  /// A source's name, safe to speak and show: the publisher, or the registrable domain of
  /// its URL (e.g. "toureiffel.paris") when the publisher is missing. A publisher that looks
  /// like a URL becomes its domain. Never the page title. At most 40 code points.
  static func sourceName(for evidence: Evidence) -> String? {
    var name: String?
    if let publisher = evidence.publisher?.trimmingCharacters(in: .whitespacesAndNewlines), !publisher.isEmpty {
      name = looksLikeURL(publisher) ? registrableDomain(of: publisher) : publisher
    }
    guard let name = name ?? registrableDomain(of: evidence.url) else { return nil }
    return CardText.excerpt(name, maxCodePoints: maxSourceNameCodePoints)
  }

  /// The name of the best selected source (see `bestEvidence`). Nil when nothing qualifies.
  static func bestSourceName(for result: ClaimResult) -> String? {
    bestEvidence(for: result).flatMap(sourceName(for:))
  }

  /// Second-level labels under which a registrable domain keeps three labels.
  private static let secondLevelSuffixes: Set<String> = [
    "co.uk", "org.uk", "ac.uk", "gov.uk", "com.au", "co.nz", "co.jp", "com.br", "co.in", "co.za",
  ]

  /// The lowercased host of `url` without "www.", cut to its registrable domain: two labels,
  /// or three after a suffix such as co.uk. Accepts a bare host ("www.bbc.co.uk"). Nil for
  /// an IP address or a missing host.
  static func registrableDomain(of url: String) -> String? {
    let trimmed = url.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { return nil }
    let withScheme = trimmed.contains("://") ? trimmed : "https://\(trimmed)"
    guard let host = URLComponents(string: withScheme)?.host?.lowercased(), !host.isEmpty else { return nil }
    // IPv6 hosts contain colons; IPv4 hosts are digits and dots only.
    if host.contains(":") || host.allSatisfy({ $0.isASCII && ($0.isNumber || $0 == ".") }) { return nil }
    var labels = host.split(separator: ".", omittingEmptySubsequences: true).map(String.init)
    if labels.count > 1, labels.first == "www" { labels.removeFirst() }
    guard labels.count > 2 else { return labels.isEmpty ? nil : labels.joined(separator: ".") }
    let lastTwo = labels.suffix(2).joined(separator: ".")
    return labels.suffix(secondLevelSuffixes.contains(lastTwo) ? 3 : 2).joined(separator: ".")
  }

  /// True for strings a speech engine would read out as an address: schemes, "www.",
  /// email-like text and bare domains such as "example.com".
  static func looksLikeURL(_ text: String) -> Bool {
    let lower = text.lowercased()
    if lower.contains("://") || lower.contains("www.") || lower.contains("@") { return true }
    return lower.range(of: #"\b[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}\b"#, options: .regularExpression) != nil
  }

  // MARK: Detail and speech

  /// The source count for True and False ("3 of 3 sources disagree", "1 source agrees").
  /// Nil when no selected source has the matching stance.
  private static func countPhrase(for result: ClaimResult) -> String? {
    guard let count = stanceCount(for: result), count.matching > 0 else { return nil }
    let agrees = result.verdict == .supported
    if count.total == 1 { return agrees ? "1 source agrees" : "1 source disagrees" }
    return "\(count.matching) of \(count.total) sources \(agrees ? "agree" : "disagree")"
  }

  /// The line after the verdict word on the card.
  ///
  /// - True / False: "2 of 3 sources agree", "1 source disagrees"; nil without a matching source.
  /// - Misleading: its reason ("Out of date").
  /// - Can’t verify and unknown verdicts: "No reliable source addresses it".
  static func detail(for result: ClaimResult) -> String? {
    switch result.verdict {
    case .supported, .contradicted: countPhrase(for: result)
    case .misleading: misleadingReason(code: result.reasonCode)
    case .insufficientEvidence, .unknown: noSourceDetail
    }
  }

  /// The card detail for an outcome without a result.
  static func detail(for outcome: OutputOutcome) -> String? {
    switch outcome {
    case .needsConfirmation(let heard): heard ? "Say it again" : "Move closer and try again"
    case .checkFailed: "Try again"
    case .verdict(.insufficientEvidence), .verdict(.unknown): noSourceDetail
    case .verdict: nil
    }
  }

  /// The spoken answer, at most `maxSpokenWords` words and never a URL.
  ///
  /// - "False. 3 of 3 sources disagree, including Live Science."
  /// - "True. 1 source agrees: NASA." (one selected source)
  /// - The source part goes first when it is missing or the line would run over.
  /// - "Misleading. Out of date."
  /// - "Can’t verify. No reliable source addresses it."
  static func spokenLine(for result: ClaimResult) -> String {
    switch result.verdict {
    case .supported, .contradicted:
      let word = verdictWord(for: kind(for: .verdict(result.verdict)))
      guard let phrase = countPhrase(for: result) else { return "\(word)." }
      let plain = "\(word). \(phrase)."
      guard let source = bestSourceName(for: result), !source.isEmpty else { return plain }
      let single = stanceCount(for: result)?.total == 1
      let withSource = single ? "\(word). \(phrase): \(source)." : "\(word). \(phrase), including \(source)."
      return wordCount(withSource) <= maxSpokenWords ? withSource : plain
    case .misleading:
      return "Misleading. \(misleadingReason(code: result.reasonCode))."
    case .insufficientEvidence, .unknown:
      return cantVerifyLine
    }
  }

  static func wordCount(_ text: String) -> Int {
    text.split(whereSeparator: { $0.isWhitespace }).count
  }
}

/// Text shortening that counts Unicode code points (the contract's unit) but only cuts
/// between whole characters, so an emoji or flag is never split.
enum CardText {
  static let ellipsis = "\u{2026}"

  /// `text` itself when it fits in `maxCodePoints`; otherwise a prefix cut at the last word
  /// break (or at a character when one word fills the space), plus an ellipsis. The result,
  /// ellipsis included, never exceeds `maxCodePoints` code points.
  static func excerpt(_ text: String, maxCodePoints: Int) -> String {
    let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
      .split(whereSeparator: { $0.isWhitespace }).joined(separator: " ")
    guard maxCodePoints > 0 else { return "" }
    if CodePoints.count(trimmed) <= maxCodePoints { return trimmed }

    let budget = maxCodePoints - CodePoints.count(ellipsis)
    var used = 0
    var kept: [Character] = []
    var lastBreak: Int?
    for character in trimmed {
      let size = character.unicodeScalars.count
      if used + size > budget { break }
      if character == " " { lastBreak = kept.count }
      kept.append(character)
      used += size
    }
    // Prefer a word break unless it would throw away more than half the excerpt. A break
    // right after the kept text (the next character is a space) keeps every word whole.
    let nextIndex = trimmed.index(trimmed.startIndex, offsetBy: kept.count)
    let endsOnWord = nextIndex < trimmed.endIndex && trimmed[nextIndex] == " "
    if !endsOnWord, let lastBreak, lastBreak >= kept.count / 2 {
      kept.removeSubrange(lastBreak...)
    }
    while let last = kept.last, last.isWhitespace || ",;:-".contains(last) {
      kept.removeLast()
    }
    return String(kept) + ellipsis
  }
}

/// Everything the lens card and its phone views show. One value drives every renderer, so
/// the phone matches what the wearer sees and hears.
struct ResultCard: Equatable, Sendable {
  var kind: CardKind
  /// "True", "False", "Misleading", "Can’t verify", "Not sure" or "Check failed".
  var verdictWord: String
  /// The line after the verdict word: a source count, a reason or a next step.
  var detail: String?
  /// The checked claim, shortened.
  var excerpt: String
  /// The best source's excerpt inside “ ”, or nil.
  var quote: String?
  /// Publisher or domain of the best source. Never a URL or a page title.
  var sourceName: String?
  /// What the presenter says for this card.
  var spokenLine: String
  /// The backend's explanation, distinct from the claim being checked. The native lens layout
  /// shows it; the phone card uses `detail`.
  var detailText: String?
  /// "Read from screen" or "Heard nearby", when the caller knows the input mode.
  var captureLabel: String?

  init(
    kind: CardKind, verdictWord: String, detail: String?, excerpt: String, quote: String?,
    sourceName: String?, spokenLine: String, detailText: String? = nil, captureLabel: String? = nil
  ) {
    self.kind = kind
    self.verdictWord = verdictWord
    self.detail = detail
    self.excerpt = excerpt
    self.quote = quote
    self.sourceName = sourceName
    self.spokenLine = spokenLine
    self.detailText = detailText
    self.captureLabel = captureLabel
  }

  /// A card for a claim result.
  init(result: ClaimResult) {
    let kind = ResultWording.kind(for: .verdict(result.verdict))
    self.init(
      kind: kind,
      verdictWord: ResultWording.verdictWord(for: kind),
      detail: ResultWording.detail(for: result),
      excerpt: CardText.excerpt(result.checkedText, maxCodePoints: ResultWording.maxExcerptCodePoints),
      quote: ResultWording.bestEvidence(for: result).flatMap { Self.quote($0.excerpt) },
      sourceName: ResultWording.bestSourceName(for: result),
      spokenLine: ResultWording.spokenLine(for: result),
      detailText: result.summary.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        ? nil : CardText.excerpt(result.summary, maxCodePoints: 140)
    )
  }

  /// A card for an outcome without a result (needs confirmation, failure). `claimText` is
  /// the text the app sent, if any.
  init(outcome: OutputOutcome, claimText: String?) {
    let kind = ResultWording.kind(for: outcome)
    self.init(
      kind: kind,
      verdictWord: ResultWording.verdictWord(for: kind),
      detail: ResultWording.detail(for: outcome),
      excerpt: claimText.map { CardText.excerpt($0, maxCodePoints: ResultWording.maxExcerptCodePoints) } ?? "",
      quote: nil,
      sourceName: nil,
      spokenLine: ResultWording.line(for: outcome),
      detailText: ResultWording.line(for: outcome)
    )
  }

  /// The source line as the card prints it: the source name alone.
  var sourceLine: String? { sourceName }

  /// One sentence for VoiceOver, e.g. "False. 3 of 3 sources disagree. Claim: The Eiffel
  /// Tower opened in 1890. Source: Live Science."
  var accessibilityLabel: String {
    var parts = [Self.sentence(verdictWord)]
    if let detail, !detail.isEmpty { parts.append(Self.sentence(detail)) }
    if !excerpt.isEmpty { parts.append("Claim: " + Self.sentence(excerpt)) }
    if let sourceName { parts.append("Source: " + Self.sentence(sourceName)) }
    return parts.joined(separator: " ")
  }

  /// An evidence excerpt inside curly quotes, at most `maxQuoteCodePoints` code points with
  /// the quotes. Nil when the excerpt is blank.
  static func quote(_ excerpt: String) -> String? {
    let quoteMarks = CharacterSet(charactersIn: "\"“”'‘’").union(.whitespacesAndNewlines)
    let bare = excerpt.trimmingCharacters(in: quoteMarks)
    guard !bare.isEmpty else { return nil }
    return "“" + CardText.excerpt(bare, maxCodePoints: ResultWording.maxQuoteCodePoints - 2) + "”"
  }

  /// `text` with a closing period unless it already ends a sentence.
  private static func sentence(_ text: String) -> String {
    guard let last = text.last, !".!?…".contains(last) else { return text }
    return text + "."
  }
}
