import Foundation

// Wording for spoken and on-lens output. Source: docs/plan.md section 5 (wording table)
// and decision 7 in docs/live-pipeline.md. Pure functions, no audio, no SDK.

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
  /// Spoken lines stay at or under this many words (plan: roughly 10 to 20).
  static let maxSpokenWords = 20
  /// Claim excerpt length on the card, in Unicode code points.
  static let maxExcerptCodePoints = 70
  /// Source names longer than this are shortened before they are spoken or shown.
  static let maxSourceNameCodePoints = 40

  /// Brief update when a spoken result was corrected (plan: "late correction").
  static let correctionLine = "That statement was corrected."

  /// The plan's wearable wording for each outcome.
  static func line(for outcome: OutputOutcome) -> String {
    switch outcome {
    case .verdict(.supported): "Supported by the sources I found."
    case .verdict(.contradicted): "The evidence I found contradicts that claim."
    case .verdict(.misleading): "That needs context."
    case .verdict(.insufficientEvidence): "I couldn't verify that."
    // A verdict this build does not know is not a factual verdict; say so neutrally.
    case .verdict(.unknown): "I couldn't verify that."
    case .needsConfirmation(let heard): heard ? "I'm not sure what was said." : "I'm not sure what was read."
    case .checkFailed: "The check didn't finish."
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

  /// The short verdict word at the top of the card.
  static func verdictWord(for kind: CardKind) -> String {
    switch kind {
    case .supported: "Supported"
    case .contradicted: "Contradicted"
    case .misleading: "Needs context"
    case .unverified: "Unverified"
    case .needsConfirmation: "Not sure"
    case .checkFailed: "Check failed"
    }
  }

  /// The small hint at the bottom of the card.
  static func hint(for kind: CardKind) -> String {
    switch kind {
    case .supported, .contradicted, .misleading, .unverified: "Details on your phone"
    case .needsConfirmation: "Rescan or repeat"
    case .checkFailed: "Try again"
    }
  }

  /// The spoken answer: the plan's line plus the best source's name, never a URL.
  /// Capped at `maxSpokenWords`; the source is dropped first if the line would run over.
  static func spokenLine(for outcome: OutputOutcome, sourceName: String?) -> String {
    let base = line(for: outcome)
    guard let sourceName, !sourceName.isEmpty else { return base }
    let withSource = "\(base) The best source is \(sourceName)."
    return wordCount(withSource) <= maxSpokenWords ? withSource : base
  }

  /// The name of the best selected source, safe to speak and show: the publisher, or the
  /// title when the publisher is missing or looks like a URL. Nil when nothing qualifies.
  /// Only selected evidence counts; an unselected source is never named.
  static func bestSourceName(for result: ClaimResult) -> String? {
    guard let best = result.selectedEvidence.first else { return nil }
    for candidate in [best.publisher, best.title] {
      guard let name = candidate?.trimmingCharacters(in: .whitespacesAndNewlines), !name.isEmpty,
            !looksLikeURL(name) else { continue }
      return CardText.excerpt(name, maxCodePoints: maxSourceNameCodePoints)
    }
    return nil
  }

  /// True for strings a speech engine would read out as an address: schemes, "www.",
  /// email-like text and bare domains such as "example.com".
  static func looksLikeURL(_ text: String) -> Bool {
    let lower = text.lowercased()
    if lower.contains("://") || lower.contains("www.") || lower.contains("@") { return true }
    return lower.range(of: #"\b[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}\b"#, options: .regularExpression) != nil
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

/// Everything the lens card and its phone mirror show. One value drives both renderers so
/// the mirror matches what the wearer sees.
struct ResultCard: Equatable, Sendable {
  var kind: CardKind
  var verdictWord: String
  var excerpt: String
  var sourceName: String?
  var hint: String
  /// Backend explanation, distinct from the claim being checked.
  var detailText: String?
  /// Omitted unless the input mode is known by the caller.
  var captureLabel: String?

  init(kind: CardKind, verdictWord: String, excerpt: String, sourceName: String?, hint: String, detailText: String? = nil, captureLabel: String? = nil) {
    self.kind = kind
    self.verdictWord = verdictWord
    self.excerpt = excerpt
    self.sourceName = sourceName
    self.hint = hint
    self.detailText = detailText
    self.captureLabel = captureLabel
  }

  /// A card for a claim result.
  init(result: ClaimResult) {
    let kind = ResultWording.kind(for: .verdict(result.verdict))
    self.init(
      kind: kind,
      verdictWord: ResultWording.verdictWord(for: kind),
      excerpt: CardText.excerpt(result.checkedText, maxCodePoints: ResultWording.maxExcerptCodePoints),
      sourceName: ResultWording.bestSourceName(for: result),
      hint: ResultWording.hint(for: kind),
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
      excerpt: claimText.map { CardText.excerpt($0, maxCodePoints: ResultWording.maxExcerptCodePoints) } ?? "",
      sourceName: nil,
      hint: ResultWording.hint(for: kind),
      detailText: ResultWording.line(for: outcome)
    )
  }

  /// The source line as the card prints it.
  var sourceLine: String? { sourceName.map { "Source: \($0)" } }

  /// One sentence for VoiceOver on the phone mirror.
  var accessibilityLabel: String {
    var parts = ["Verdict: \(verdictWord)."]
    if !excerpt.isEmpty { parts.append("Claim: \(excerpt)") }
    if let sourceName { parts.append("Source: \(sourceName).") }
    parts.append(hint + ".")
    return parts.joined(separator: " ")
  }
}
