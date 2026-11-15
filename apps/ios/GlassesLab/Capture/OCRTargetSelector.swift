import Foundation

/// Immutable source evidence. Coordinates are normalized in the EXIF-upright original photo,
/// with a bottom-left origin. A corrected view must map its polygons back before selection.
struct OCRTargetPoint: Equatable, Sendable {
  let x: Double
  let y: Double
}

struct OCRTargetLine: Equatable, Sendable {
  let id: String
  let text: String
  let confidence: Double
  let polygon: [OCRTargetPoint]
  let viewId: String

  init(id: String, text: String, confidence: Double, polygon: [OCRTargetPoint], viewId: String = "original") {
    self.id = id; self.text = text; self.confidence = confidence
    self.polygon = polygon; self.viewId = viewId
  }

  var box: CGRect {
    guard let first = polygon.first else { return .zero }
    let xs = polygon.map(\.x), ys = polygon.map(\.y)
    return CGRect(x: xs.min() ?? first.x, y: ys.min() ?? first.y,
                  width: (xs.max() ?? first.x) - (xs.min() ?? first.x),
                  height: (ys.max() ?? first.y) - (ys.min() ?? first.y))
  }
}

struct OCRTargetInput: Equatable, Sendable {
  let lines: [OCRTargetLine]
  let aspect: Double
  /// An explicit user-selected/highlighted region, when capture supplies one.
  var preferredRegion: CGRect? = nil
}

/// Keep these in step with the backend request contract. Reject oversized evidence rather
/// than silently deleting lines that could contain the intended claim or its qualifiers.
enum OCRTargetRequestLimits {
  static let maximumImageBytes = 4_000_000

  static func failure(in input: OCRTargetInput, intent: String?) -> String? {
    // The server's JavaScript string limits count UTF-16 code units, not Swift Characters.
    if let intent, intent.utf16.count > 500 { return "target_selection_hint_too_long" }
    if input.lines.count > 300 || input.lines.contains(where: { $0.text.utf16.count > 1_000 }) ||
        input.lines.reduce(0, { $0 + $1.text.utf16.count }) > 60_000 {
      return "target_selection_input_too_large"
    }
    return nil
  }
}

struct OCRTargetCandidate: Equatable, Sendable {
  let id: String
  let role: String
  let lineIds: [String]
}

struct OCRTargetSelection: Equatable, Sendable {
  enum Status: String, Sendable {
    case selected
    case needsTarget = "needs_target"
    case unreadable
    case incomplete
    case unavailable
  }
  let status: Status
  var selectedLineIds: [String] = []
  var candidates: [OCRTargetCandidate] = []
  var reason: String? = nil

  /// Never trust generated transcription, duplicated/unknown IDs, or a blank selection.
  /// Text is reconstructed exclusively from the immutable observations in model order.
  func resolvedLines(in input: OCRTargetInput) -> [OCRTargetLine]? {
    guard status == .selected, !selectedLineIds.isEmpty,
          Set(selectedLineIds).count == selectedLineIds.count,
          Set(input.lines.map(\.id)).count == input.lines.count else { return nil }
    let byId = Dictionary(uniqueKeysWithValues: input.lines.map { ($0.id, $0) })
    let lines = selectedLineIds.compactMap { byId[$0] }
    guard lines.count == selectedLineIds.count,
          lines.allSatisfy({ line in
            !line.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
            line.confidence.isFinite && (0.4...1).contains(line.confidence) && line.polygon.count == 4 &&
            line.polygon.allSatisfy { $0.x.isFinite && $0.y.isFinite && (-0.001...1.001).contains($0.x) && (-0.001...1.001).contains($0.y) }
          }) else { return nil }
    // Alternate OCR views of the same pixels must not be submitted twice.
    for i in lines.indices {
      for j in lines.indices where j > i && lines[i].viewId != lines[j].viewId {
        let overlap = lines[i].box.intersection(lines[j].box)
        let smaller = min(lines[i].box.width * lines[i].box.height, lines[j].box.width * lines[j].box.height)
        if !overlap.isNull && overlap.width * overlap.height > smaller * 0.5 { return nil }
      }
    }
    return OCRTargetSelector.readingOrder(lines)
  }
}

@MainActor
protocol OCRTargetSelecting: AnyObject {
  func selectTarget(in input: OCRTargetInput, imageData: Data, intent: String?) async throws -> OCRTargetSelection
}

/// Conservative local fallback. It uses relative typography and adjacency, never a website
/// name, a screen edge, or a fixed column position. Semantics are supplied by the optional
/// multimodal selector; when peer blocks compete this fallback asks which one is intended.
enum OCRTargetSelector {
  static func select(_ input: OCRTargetInput, intent: String? = nil) -> OCRTargetSelection {
    let readable = input.lines.filter { line in
      let b = line.box
      return line.confidence.isFinite && line.confidence >= 0.4 && b.width > 0 && b.height > 0 &&
        b.minX >= 0 && b.minY >= 0 && b.maxX <= 1.001 && b.maxY <= 1.001 &&
        !line.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }
    // Retain original scene context and supplement it with newly recovered crop lines.
    // Overlapping alternate readings remain available to the semantic selector, but the
    // local fallback uses only one reading of each region and never double-counts them.
    var lines = readable.filter { $0.viewId == "original" }
    for line in readable where line.viewId != "original" {
      let duplicates = lines.contains { existing in
        guard existing.viewId != line.viewId else { return false }
        let intersection = existing.box.intersection(line.box)
        let area = min(existing.box.width * existing.box.height, line.box.width * line.box.height)
        return !intersection.isNull && intersection.width * intersection.height > area * 0.5
      }
      if !duplicates { lines.append(line) }
    }
    guard !lines.isEmpty else { return .init(status: .unreadable, reason: "no_readable_lines") }
    let groups = blocks(lines, aspect: input.aspect)
    // A badge/control may be near a title, but its smaller type should not join that title.
    let eligible = groups.filter { group in
      group.map(\.text).joined(separator: " ").split(whereSeparator: \.isWhitespace).count >= 3
    }
    let candidates = eligible.enumerated().map { index, group in
      OCRTargetCandidate(id: "block-\(index)", role: "content", lineIds: readingOrder(group).map(\.id))
    }
    guard !eligible.isEmpty else { return .init(status: .needsTarget, candidates: candidates, reason: "no_distinct_content_block") }
    if let region = input.preferredRegion {
      let matches = eligible.indices.filter { index in
        eligible[index].allSatisfy { region.contains(CGPoint(x: $0.box.midX, y: $0.box.midY)) }
      }
      if matches.count == 1 { return finish(eligible[matches[0]], candidates: candidates) }
      return .init(status: .needsTarget, candidates: candidates, reason: "region_has_multiple_or_no_targets")
    }
    if let intent, !intent.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
      // Require two distinctive words to match one candidate. Vague commands cannot
      // silently authorize choosing the most visually prominent of several peer stories.
      let terms = Set(words(intent).filter { $0.count >= 4 })
      let scores = eligible.map { Set(words($0.map(\.text).joined(separator: " "))).intersection(terms).count }
      if let best = scores.max(), best >= 2, scores.filter({ $0 == best }).count == 1,
         let index = scores.firstIndex(of: best) { return finish(eligible[index], candidates: candidates) }
      return .init(status: .needsTarget, candidates: candidates, reason: "intent_does_not_resolve_target")
    }
    let ranked = eligible.indices.sorted { prominence(eligible[$0]) > prominence(eligible[$1]) }
    let first = ranked[0]
    if ranked.count == 1 { return finish(eligible[first], candidates: candidates) }
    let runner = ranked[1]
    // Typography dominance, not total text area: long comments must not beat titles.
    if prominence(eligible[first]) >= prominence(eligible[runner]) * 1.45 {
      return finish(eligible[first], candidates: candidates)
    }
    return .init(status: .needsTarget, candidates: candidates, reason: "competing_content_blocks")
  }

  private static func finish(_ group: [OCRTargetLine], candidates: [OCRTargetCandidate]) -> OCRTargetSelection {
    let lines = readingOrder(group)
    let text = lines.map(\.text).joined(separator: "\n")
    if isVisiblyTruncated(text) {
      return .init(status: .incomplete, candidates: candidates, reason: "visible_truncation")
    }
    return .init(status: .selected, selectedLineIds: lines.map(\.id), candidates: candidates)
  }

  static func isVisiblyTruncated(_ text: String) -> Bool {
    if text.contains("…") || text.contains("...") { return true }
    guard let last = text.split(separator: "\n", omittingEmptySubsequences: true).last else { return false }
    let tail = String(last).trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    return ["view more", "show more", "read more"].contains(tail)
  }

  private static func words(_ text: String) -> [String] {
    text.lowercased().split { !$0.isLetter && !$0.isNumber }.map(String.init)
  }

  private static func prominence(_ group: [OCRTargetLine]) -> Double {
    let heights = group.map { Double($0.box.height) }.sorted()
    return heights[heights.count / 2]
  }

  static func readingOrder(_ lines: [OCRTargetLine]) -> [OCRTargetLine] {
    lines.sorted { a, b in
      if abs(a.box.midY - b.box.midY) <= min(a.box.height, b.box.height) * 0.5 {
        return a.box.minX < b.box.minX
      }
      return a.box.midY > b.box.midY
    }
  }

  private static func blocks(_ lines: [OCRTargetLine], aspect: Double) -> [[OCRTargetLine]] {
    var parent = Array(lines.indices)
    func root(_ index: Int) -> Int {
      var i = index
      while parent[i] != i { i = parent[i] }
      return i
    }
    for i in lines.indices {
      for j in lines.indices where j > i {
        let a = lines[i].box, b = lines[j].box
        let smaller = min(a.height, b.height), larger = max(a.height, b.height)
        guard larger <= smaller * 1.3 else { continue }
        let overlapX = min(a.maxX, b.maxX) - max(a.minX, b.minX)
        let overlapY = min(a.maxY, b.maxY) - max(a.minY, b.minY)
        let sameRow = overlapY > smaller * 0.5 && -overlapX * max(aspect, 0.1) <= larger * 1.3
        let stacked = overlapY <= smaller * 0.5 && -overlapY <= larger * 1.1 &&
          overlapX >= min(a.width, b.width) * 0.5 && abs(a.minX - b.minX) * max(aspect, 0.1) <= larger * 1.5
        if sameRow || stacked { parent[root(j)] = root(i) }
      }
    }
    var grouped: [Int: [OCRTargetLine]] = [:]
    for i in lines.indices { grouped[root(i), default: []].append(lines[i]) }
    return grouped.values.map(readingOrder).sorted { ($0.first?.id ?? "") < ($1.first?.id ?? "") }
  }
}
