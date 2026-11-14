import Foundation
import NaturalLanguage

/// OCR text split into check requests (decision 6).
struct OCRChunks: Equatable, Sendable {
  /// Each chunk is trimmed, non-empty and at most `maxCodePoints` code points.
  var chunks: [String]
  /// Code points in chunks past the per-photo limit, which were not sent. Zero when
  /// everything fits. Log this number so a dropped tail is never silent.
  var droppedCodePoints: Int
  /// Chunks past the per-photo limit.
  var droppedChunkCount: Int

  var droppedText: Bool { droppedChunkCount > 0 }
}

/// Splits recognised text into check requests: all text in reading order, cut at sentence
/// boundaries into chunks of at most 800 code points, at most 3 per photo.
///
/// A sentence is cut only when it alone exceeds the limit, and then at the last whitespace
/// that fits (or, with no whitespace at all, at the last character boundary that fits).
/// Lengths are Unicode code points, matching the contract.
enum OCRChunker {
  static let defaultMaxCodePoints = ContractsV1.maxTextCodePoints
  static let defaultMaxChunks = 3

  static func chunk(
    _ text: String,
    maxCodePoints: Int = defaultMaxCodePoints,
    maxChunks: Int = defaultMaxChunks
  ) -> OCRChunks {
    precondition(maxCodePoints > 0 && maxChunks > 0)
    var all: [String] = []
    var current = ""

    func flush() {
      let trimmed = trim(current)
      if !trimmed.isEmpty { all.append(trimmed) }
      current = ""
    }

    for sentence in sentences(in: text) {
      if CodePoints.count(trim(current + sentence)) <= maxCodePoints {
        current += sentence
        continue
      }
      flush()
      var rest = sentence
      while CodePoints.count(trim(rest)) > maxCodePoints {
        let (head, tail) = cutLongSentence(trim(rest), maxCodePoints: maxCodePoints)
        all.append(head)
        rest = tail
      }
      current = rest
    }
    flush()

    let sent = Array(all.prefix(maxChunks))
    let dropped = all.dropFirst(maxChunks)
    return OCRChunks(
      chunks: sent,
      droppedCodePoints: dropped.reduce(0) { $0 + CodePoints.count($1) },
      droppedChunkCount: dropped.count
    )
  }

  /// Sentences in order, each including the whitespace that follows it, so joining them
  /// reproduces `text` exactly. Uses NaturalLanguage, which knows abbreviations, decimals
  /// and non-Latin punctuation such as "。".
  static func sentences(in text: String) -> [String] {
    guard !text.isEmpty else { return [] }
    let tokenizer = NLTokenizer(unit: .sentence)
    tokenizer.string = text
    var starts: [String.Index] = []
    tokenizer.enumerateTokens(in: text.startIndex..<text.endIndex) { range, _ in
      starts.append(range.lowerBound)
      return true
    }
    // Text before the first token (leading whitespace) joins the first sentence.
    if starts.first != text.startIndex { starts.insert(text.startIndex, at: 0) }
    var result: [String] = []
    for (i, start) in starts.enumerated() {
      let end = i + 1 < starts.count ? starts[i + 1] : text.endIndex
      if start < end { result.append(String(text[start..<end])) }
    }
    return result
  }

  /// Cuts a trimmed sentence longer than `maxCodePoints`. The head ends at the last
  /// whitespace inside the limit; with none, at the last whole character inside it, so a
  /// flag or an accented letter made of several code points is never split.
  static func cutLongSentence(_ sentence: String, maxCodePoints: Int) -> (head: String, tail: String) {
    var used = 0
    var lastFit = sentence.startIndex
    var lastWhitespace: String.Index?
    for index in sentence.indices {
      let size = sentence[index].unicodeScalars.count
      if used + size > maxCodePoints { break }
      used += size
      if sentence[index].isWhitespace { lastWhitespace = index }
      lastFit = sentence.index(after: index)
    }
    if let space = lastWhitespace, space > sentence.startIndex {
      return (trim(String(sentence[..<space])), String(sentence[sentence.index(after: space)...]))
    }
    if lastFit == sentence.startIndex {
      // A single character larger than the limit; only possible with a tiny limit.
      lastFit = sentence.index(after: sentence.startIndex)
    }
    return (String(sentence[..<lastFit]), String(sentence[lastFit...]))
  }

  private static func trim(_ text: String) -> String {
    text.trimmingCharacters(in: .whitespacesAndNewlines)
  }
}
