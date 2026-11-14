import CoreGraphics
import Foundation
import ImageIO
import Vision

// On-device OCR for "look and check" (decision 5). The photo stays in memory, only the
// recognised text leaves this module, and nothing here logs that text. The coordinator copies
// the result, observations included, into the on-device DebugLog while it is on.

/// What OCR produced for one photo. `text` holds the kept lines in reading order, one row
/// per line. Log `lineCount`, `codePointCount` and `meanConfidence`, never `text`.
struct OCRResult: Equatable, Sendable {
  var text: String
  /// Mean Vision confidence (0...1) of the kept lines; 0 when nothing was kept.
  var meanConfidence: Double
  /// Lines kept after the confidence filter.
  var lineCount: Int
  /// Lines Vision found but the confidence filter dropped.
  var droppedLineCount: Int
  /// Where the text came from: a detected screen or the whole photo.
  var source: Source = .wholePhoto
  /// Rectangles Vision proposed as screens, whether or not one was chosen.
  var candidateCount: Int = 0

  enum Source: String, Sendable {
    case screen
    case wholePhoto
  }
  /// Every observation Vision returned, in Vision's order, with its confidence, including the
  /// ones the filter dropped. For the debug log; `assemble` alone leaves it empty.
  var observations: [OCRService.OCRLine] = []

  static let empty = OCRResult(text: "", meanConfidence: 0, lineCount: 0, droppedLineCount: 0)

  var codePointCount: Int { CodePoints.count(text) }
  var isEmpty: Bool { text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
}

/// The OCR seam, so the coordinator can be tested with a fake.
protocol TextRecognizing: AnyObject {
  /// Recognises text in an encoded image (JPEG from the glasses camera).
  func recognizeText(in imageData: Data) async throws -> OCRResult
}

enum OCRError: Error, Equatable {
  /// The bytes are not a decodable image.
  case undecodableImage
}

/// Apple Vision text recognition: accurate mode with language correction, English plus
/// Finnish when this OS version supports it.
final class OCRService: TextRecognizing {
  /// Lines below this Vision confidence are dropped as noise.
  let minimumLineConfidence: Float
  /// Recognition languages in priority order.
  let preferredLanguages: [String]

  init(minimumLineConfidence: Float = 0.4, preferredLanguages: [String] = ["en-US", "fi-FI"]) {
    self.minimumLineConfidence = minimumLineConfidence
    self.preferredLanguages = preferredLanguages
  }

  func recognizeText(in imageData: Data) async throws -> OCRResult {
    guard let source = CGImageSourceCreateWithData(imageData as CFData, nil),
          let image = CGImageSourceCreateImageAtIndex(source, 0, nil)
    else { throw OCRError.undecodableImage }
    return try await recognizeText(in: image, orientation: Self.orientation(of: source))
  }

  /// Runs Vision off the main thread. `orientation` comes from the photo's EXIF data so a
  /// rotated JPEG still reads top to bottom.
  func recognizeText(in image: CGImage, orientation: CGImagePropertyOrientation = .up) async throws -> OCRResult {
    try await withCheckedThrowingContinuation { continuation in
      DispatchQueue.global(qos: .userInitiated).async {
        do {
          continuation.resume(returning: try self.recognizeSync(image, orientation: orientation))
        } catch {
          continuation.resume(throwing: error)
        }
      }
    }
  }

  /// A display holding text is read first, from a perspective-corrected crop; without one
  /// the whole photo is read as before.
  private func recognizeSync(_ image: CGImage, orientation: CGImagePropertyOrientation) throws -> OCRResult {
    let wholeLines = try recognizeLines(in: image, orientation: orientation)
    // Rectangle detection is best effort: a failure means "no screen", not "no OCR".
    let quads = (try? ScreenDetector.detectRectangles(in: image, orientation: orientation)) ?? []
    let confident = wholeLines.filter { $0.confidence >= minimumLineConfidence }.map(\.boundingBox)
    if let index = ScreenDetector.chooseScreen(quads: quads, lineBoxes: confident),
       let crop = ScreenDetector.crop(image, orientation: orientation, quad: quads[index]),
       let lines = try? recognizeLines(in: crop, orientation: .up) {
      var result = Self.assemble(lines, minimumConfidence: minimumLineConfidence, aspect: Self.aspect(of: crop, orientation: .up))
      if !result.isEmpty {
        result.source = .screen
        result.candidateCount = quads.count
        result.observations = lines
        return result
      }
    }
    var result = Self.assemble(wholeLines, minimumConfidence: minimumLineConfidence, aspect: Self.aspect(of: image, orientation: orientation))
    result.candidateCount = quads.count
    result.observations = wholeLines
    return result
  }

  private func recognizeLines(in image: CGImage, orientation: CGImagePropertyOrientation) throws -> [OCRLine] {
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true
    request.recognitionLanguages = Self.supportedLanguages(preferredLanguages, request: request)
    try VNImageRequestHandler(cgImage: image, orientation: orientation, options: [:]).perform([request])
    return (request.results ?? []).compactMap { observation -> OCRLine? in
      guard let candidate = observation.topCandidates(1).first else { return nil }
      return OCRLine(text: candidate.string, confidence: candidate.confidence, boundingBox: observation.boundingBox)
    }
  }

  /// The preferred languages this request can recognise, keeping English as the floor.
  /// Finnish is added only when `supportedRecognitionLanguages()` lists it.
  static func supportedLanguages(_ preferred: [String], request: VNRecognizeTextRequest) -> [String] {
    let supported = (try? request.supportedRecognitionLanguages()) ?? []
    let kept = preferred.compactMap { language -> String? in
      if supported.contains(language) { return language }
      // Match on the language code too, e.g. "fi" when the OS lists "fi-FI" or the reverse.
      let code = language.split(separator: "-").first.map(String.init) ?? language
      return supported.first { $0 == code || $0.hasPrefix(code + "-") }
    }
    return kept.isEmpty ? ["en-US"] : kept
  }

  // MARK: Reading order

  /// One recognised line. `boundingBox` is Vision's normalised rect, origin bottom-left.
  struct OCRLine: Equatable, Sendable {
    var text: String
    var confidence: Float
    var boundingBox: CGRect
  }

  /// Drops low-confidence and blank lines, then orders the rest by block. A block is a column
  /// or paragraph: lines that overlap horizontally and sit close vertically (relative to line
  /// height), or share a row across a small gap. Lines run top to bottom inside a block;
  /// blocks run top to bottom, then left to right. Same-row lines are joined with a space
  /// only across a small gap; everything else is separated by a newline.
  /// `aspect` is the upright pixel width over height. Vision boxes are normalised per axis, so
  /// horizontal distances are scaled by it to be comparable with line heights.
  static func assemble(_ lines: [OCRLine], minimumConfidence: Float, aspect: CGFloat = 1) -> OCRResult {
    var kept: [OCRLine] = []
    var dropped = 0
    for line in lines {
      let text = line.text.trimmingCharacters(in: .whitespacesAndNewlines)
      if text.isEmpty || line.confidence < minimumConfidence {
        dropped += 1
      } else {
        kept.append(OCRLine(text: text, confidence: line.confidence, boundingBox: line.boundingBox))
      }
    }
    guard !kept.isEmpty else {
      return OCRResult(text: "", meanConfidence: 0, lineCount: 0, droppedLineCount: dropped)
    }

    let text = orderedBlocks(kept, aspect: aspect).map { blockText($0, aspect: aspect) }.joined(separator: "\n")
    let mean = kept.reduce(0.0) { $0 + Double($1.confidence) } / Double(kept.count)
    return OCRResult(text: text, meanConfidence: mean, lineCount: kept.count, droppedLineCount: dropped)
  }

  /// Max gap between same-row lines, in line heights, that still counts as one row.
  static let sameRowGap: CGFloat = 2
  /// Max vertical gap between stacked lines of one block, in line heights.
  static let blockLineGap: CGFloat = 1.5

  /// Whether two lines belong to the same block.
  static func sameBlock(_ a: CGRect, _ b: CGRect, aspect: CGFloat = 1) -> Bool {
    let height = max(a.height, b.height)
    let horizontalOverlap = (min(a.maxX, b.maxX) - max(a.minX, b.minX)) * aspect
    let verticalOverlap = min(a.maxY, b.maxY) - max(a.minY, b.minY)
    if verticalOverlap > min(a.height, b.height) / 2 {
      return -horizontalOverlap <= height * sameRowGap
    }
    guard -verticalOverlap <= height * blockLineGap else { return false }
    return abs(a.minX - b.minX) * aspect <= height || horizontalOverlap >= max(a.width, b.width) * aspect * 0.5
  }

  /// Blocks at least this share of the text's overall width are full-width (a title or banner).
  static let fullWidthShare: CGFloat = 0.6

  /// Groups lines into blocks and orders them. Blocks that overlap horizontally form a column;
  /// a column is read top to bottom, columns left to right. Full-width blocks (titles) split
  /// the page into bands that are read top to bottom.
  static func orderedBlocks(_ lines: [OCRLine], aspect: CGFloat = 1) -> [[OCRLine]] {
    var parent = Array(lines.indices)
    func root(_ i: Int) -> Int {
      var i = i
      while parent[i] != i { parent[i] = parent[parent[i]]; i = parent[i] }
      return i
    }
    for i in lines.indices {
      for j in lines.indices where j > i && sameBlock(lines[i].boundingBox, lines[j].boundingBox, aspect: aspect) {
        parent[root(j)] = root(i)
      }
    }
    var groups: [Int: [OCRLine]] = [:]
    for i in lines.indices { groups[root(i), default: []].append(lines[i]) }
    // Vision's y axis points up, so a higher maxY is nearer the top of the image.
    let blocks = groups.values.map { group -> (lines: [OCRLine], box: CGRect) in
      (group, group.map(\.boundingBox).reduce(CGRect.null) { $0.union($1) })
    }.sorted { $0.box.maxY > $1.box.maxY }
    let total = blocks.map(\.box).reduce(CGRect.null) { $0.union($1) }
    let isFullWidth = { (box: CGRect) in blocks.count > 1 && box.width >= total.width * fullWidthShare }

    var ordered: [[OCRLine]] = []
    var band: [(lines: [OCRLine], box: CGRect)] = []
    func flushBand() {
      ordered += columns(of: band).flatMap { $0 }
      band = []
    }
    for block in blocks {
      if isFullWidth(block.box) {
        flushBand()
        ordered.append(block.lines)
      } else {
        band.append(block)
      }
    }
    flushBand()
    return ordered
  }

  /// Clusters blocks (already top to bottom) into columns by horizontal overlap; columns come
  /// back left to right, each holding its blocks top to bottom.
  private static func columns(of blocks: [(lines: [OCRLine], box: CGRect)]) -> [[[OCRLine]]] {
    var parent = Array(blocks.indices)
    func root(_ i: Int) -> Int {
      var i = i
      while parent[i] != i { parent[i] = parent[parent[i]]; i = parent[i] }
      return i
    }
    for i in blocks.indices {
      for j in blocks.indices where j > i {
        let overlap = min(blocks[i].box.maxX, blocks[j].box.maxX) - max(blocks[i].box.minX, blocks[j].box.minX)
        if overlap > min(blocks[i].box.width, blocks[j].box.width) * 0.25 { parent[root(j)] = root(i) }
      }
    }
    var grouped: [Int: [Int]] = [:]
    for i in blocks.indices { grouped[root(i), default: []].append(i) }
    return grouped.values
      .map { $0.sorted() }  // indices follow top-to-bottom order
      .sorted { lhs, rhs in
        let l = lhs.map { blocks[$0].box.minX }.min() ?? 0
        let r = rhs.map { blocks[$0].box.minX }.min() ?? 0
        return l < r
      }
      .map { $0.map { blocks[$0].lines } }
  }

  /// Text of one block: rows top to bottom, same-row lines left to right.
  private static func blockText(_ block: [OCRLine], aspect: CGFloat) -> String {
    let byTop = block.sorted { $0.boundingBox.midY > $1.boundingBox.midY }
    var rows: [[OCRLine]] = []
    for line in byTop {
      if let anchor = rows.last?.first,
         abs(anchor.boundingBox.midY - line.boundingBox.midY) <= max(anchor.boundingBox.height, line.boundingBox.height) / 2 {
        rows[rows.count - 1].append(line)
      } else {
        rows.append([line])
      }
    }
    var out: [String] = []
    for row in rows {
      let sorted = row.sorted { $0.boundingBox.minX < $1.boundingBox.minX }
      var current = sorted[0]
      var text = current.text
      for next in sorted.dropFirst() {
        let gap = next.boundingBox.minX - current.boundingBox.maxX
        if gap * aspect <= max(current.boundingBox.height, next.boundingBox.height) * sameRowGap {
          text += " " + next.text
        } else {
          out.append(text)
          text = next.text
        }
        current = next
      }
      out.append(text)
    }
    return out.joined(separator: "\n")
  }

  /// Upright pixel width over height, accounting for EXIF orientations that swap the axes.
  static func aspect(of image: CGImage, orientation: CGImagePropertyOrientation) -> CGFloat {
    guard image.width > 0, image.height > 0 else { return 1 }
    let w = CGFloat(image.width), h = CGFloat(image.height)
    switch orientation {
    case .left, .right, .leftMirrored, .rightMirrored: return h / w
    default: return w / h
    }
  }

  private static func orientation(of source: CGImageSource) -> CGImagePropertyOrientation {
    guard let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
          let raw = properties[kCGImagePropertyOrientation] as? UInt32,
          let orientation = CGImagePropertyOrientation(rawValue: raw)
    else { return .up }
    return orientation
  }
}
