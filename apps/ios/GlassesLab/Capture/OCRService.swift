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
    let minimumLineConfidence = minimumLineConfidence
    let preferredLanguages = preferredLanguages
    return try await withCheckedThrowingContinuation { continuation in
      DispatchQueue.global(qos: .userInitiated).async {
        do {
          let request = VNRecognizeTextRequest()
          request.recognitionLevel = .accurate
          request.usesLanguageCorrection = true
          request.recognitionLanguages = Self.supportedLanguages(preferredLanguages, request: request)
          let handler = VNImageRequestHandler(cgImage: image, orientation: orientation, options: [:])
          try handler.perform([request])
          let lines = (request.results ?? []).compactMap { observation -> OCRLine? in
            guard let candidate = observation.topCandidates(1).first else { return nil }
            return OCRLine(text: candidate.string, confidence: candidate.confidence, boundingBox: observation.boundingBox)
          }
          var result = Self.assemble(lines, minimumConfidence: minimumLineConfidence)
          result.observations = lines
          continuation.resume(returning: result)
        } catch {
          continuation.resume(throwing: error)
        }
      }
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

  /// Drops low-confidence and blank lines, then orders the rest top to bottom and, within a
  /// row, left to right. Lines whose vertical centres sit within half a line height of the
  /// row's first line share that row and are joined with a space.
  static func assemble(_ lines: [OCRLine], minimumConfidence: Float) -> OCRResult {
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

    // Vision's y axis points up, so a higher midY is nearer the top of the image.
    let byTop = kept.sorted { $0.boundingBox.midY > $1.boundingBox.midY }
    var rows: [[OCRLine]] = []
    for line in byTop {
      if let anchor = rows.last?.first,
         abs(anchor.boundingBox.midY - line.boundingBox.midY) <= max(anchor.boundingBox.height, line.boundingBox.height) / 2 {
        rows[rows.count - 1].append(line)
      } else {
        rows.append([line])
      }
    }
    let text = rows
      .map { row in row.sorted { $0.boundingBox.minX < $1.boundingBox.minX }.map(\.text).joined(separator: " ") }
      .joined(separator: "\n")
    let mean = kept.reduce(0.0) { $0 + Double($1.confidence) } / Double(kept.count)
    return OCRResult(text: text, meanConfidence: mean, lineCount: kept.count, droppedLineCount: dropped)
  }

  private static func orientation(of source: CGImageSource) -> CGImagePropertyOrientation {
    guard let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
          let raw = properties[kCGImagePropertyOrientation] as? UInt32,
          let orientation = CGImagePropertyOrientation(rawValue: raw)
    else { return .up }
    return orientation
  }
}
