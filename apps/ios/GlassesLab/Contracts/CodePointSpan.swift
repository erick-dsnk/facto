import Foundation

/// Unicode code-point helpers for contract lengths and spans.
///
/// Contract offsets are half-open indices into `unicodeScalars`. Swift `Character` counts
/// (grapheme clusters) and UTF-16 counts are both wrong for this: "🙂" is one code point,
/// two UTF-16 units, and a flag emoji is one Character but two code points.
enum CodePoints {
  /// Number of Unicode code points (`unicodeScalars.count`).
  static func count(_ text: String) -> Int {
    text.unicodeScalars.count
  }

  /// The half-open code-point range `start..<end` of `text`, or nil when out of bounds.
  static func slice(_ text: String, start: Int, end: Int) -> String? {
    guard let range = indexRange(in: text, start: start, end: end) else { return nil }
    return String(String.UnicodeScalarView(text.unicodeScalars[range]))
  }

  static func slice(_ text: String, span: SourceSpan) -> String? {
    slice(text, start: span.start, end: span.end)
  }

  /// String indices for a code-point range, for highlighting the span inside `text`.
  /// Nil when `start < 0`, `start > end` or `end` is past the last code point.
  static func indexRange(in text: String, start: Int, end: Int) -> Range<String.Index>? {
    let scalars = text.unicodeScalars
    guard start >= 0, start <= end else { return nil }
    guard let lower = scalars.index(scalars.startIndex, offsetBy: start, limitedBy: scalars.endIndex),
          let upper = scalars.index(lower, offsetBy: end - start, limitedBy: scalars.endIndex)
    else { return nil }
    return lower..<upper
  }

  /// The first `maxCodePoints` code points. For display only: never use this to fit text
  /// into a check request, where oversize input must be split instead of truncated.
  static func prefix(_ text: String, maxCodePoints: Int) -> String {
    String(String.UnicodeScalarView(text.unicodeScalars.prefix(max(0, maxCodePoints))))
  }
}

extension SourceSpan {
  /// Code-point length of the span.
  var length: Int { end - start }

  /// The text this span selects, or nil when it is out of bounds.
  func slice(_ text: String) -> String? {
    CodePoints.slice(text, span: self)
  }
}

extension ClaimResult {
  /// True when `sourceSpan` selects exactly `checkedText` inside `originalText`, the
  /// invariant wire.ts enforces on the server.
  var spanMatchesCheckedText: Bool {
    sourceSpan.end > sourceSpan.start && sourceSpan.slice(originalText) == checkedText
  }
}
