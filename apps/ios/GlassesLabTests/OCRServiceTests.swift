import CoreGraphics
import CoreText
import ImageIO
import UniformTypeIdentifiers
import Vision
import XCTest
@testable import GlassesLab

/// Runs real Vision OCR on text drawn with Core Graphics, plus the pure reading-order logic.
final class OCRServiceTests: XCTestCase {
  /// Black text on white, one entry per line, top to bottom.
  private func renderLines(_ lines: [String], width: Int = 1_400, lineHeight: Int = 110, fontSize: CGFloat = 56) throws -> CGImage {
    let height = lineHeight * (lines.count + 1)
    let context = try XCTUnwrap(CGContext(
      data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0,
      space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    ))
    context.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1))
    context.fill(CGRect(x: 0, y: 0, width: width, height: height))
    let font = CTFontCreateWithName("Helvetica" as CFString, fontSize, nil)
    let black = CGColor(red: 0, green: 0, blue: 0, alpha: 1)
    for (index, line) in lines.enumerated() {
      let attributed = NSAttributedString(string: line, attributes: [
        NSAttributedString.Key(kCTFontAttributeName as String): font,
        NSAttributedString.Key(kCTForegroundColorAttributeName as String): black,
      ])
      let ctLine = CTLineCreateWithAttributedString(attributed)
      // Core Graphics puts the origin bottom-left, so the first line gets the highest y.
      context.textPosition = CGPoint(x: 40, y: CGFloat(height - lineHeight * (index + 1)))
      CTLineDraw(ctLine, context)
    }
    return try XCTUnwrap(context.makeImage())
  }

  private func jpeg(_ image: CGImage, orientation: CGImagePropertyOrientation = .up) throws -> Data {
    let data = NSMutableData()
    let destination = try XCTUnwrap(CGImageDestinationCreateWithData(data, UTType.jpeg.identifier as CFString, 1, nil))
    CGImageDestinationAddImage(destination, image, [kCGImageDestinationLossyCompressionQuality: 0.9,
      kCGImagePropertyOrientation: orientation.rawValue] as CFDictionary)
    XCTAssertTrue(CGImageDestinationFinalize(destination))
    return data as Data
  }

  func testRecognisesRenderedTextInReadingOrder() async throws {
    let image = try renderLines([
      "The Eiffel Tower opened in 1889.",
      "Helsinki is the capital of Finland.",
    ])
    let result = try await OCRService().recognizeText(in: image)

    XCTAssertGreaterThanOrEqual(result.lineCount, 2)
    XCTAssertGreaterThanOrEqual(result.meanConfidence, 0.5)
    for word in ["Eiffel", "Tower", "1889", "Helsinki", "Finland"] {
      XCTAssertTrue(result.text.contains(word), "missing \(word)")
    }
    let eiffel = try XCTUnwrap(result.text.range(of: "Eiffel"))
    let helsinki = try XCTUnwrap(result.text.range(of: "Helsinki"))
    XCTAssertLessThan(eiffel.lowerBound, helsinki.lowerBound, "top line must come first")
    XCTAssertEqual(result.codePointCount, CodePoints.count(result.text))
  }

  func testRecognisesTextFromJPEGBytes() async throws {
    let data = try jpeg(renderLines(["Water boils at 100 degrees Celsius."]))
    let result = try await OCRService().recognizeText(in: data)
    XCTAssertTrue(result.text.contains("Water"))
    XCTAssertTrue(result.text.contains("100"))
  }

  func testBlankImageIsEmpty() async throws {
    let result = try await OCRService().recognizeText(in: renderLines([]))
    XCTAssertTrue(result.isEmpty)
    XCTAssertEqual(result.lineCount, 0)
    XCTAssertEqual(result.meanConfidence, 0)
  }

  func testUndecodableBytesThrow() async {
    do {
      _ = try await OCRService().recognizeText(in: Data("not an image".utf8))
      XCTFail("expected an error")
    } catch {
      XCTAssertEqual(error as? OCRError, .undecodableImage)
    }
  }

  func testSelectionUploadNormalizesEXIFAndKeepsWholeFrameAspect() throws {
    let original = try jpeg(renderLines(["A full frame"], width: 1_400), orientation: .right)
    let prepared = try OCRService.selectionJPEG(original, maximumDimension: 700)
    let source = try XCTUnwrap(CGImageSourceCreateWithData(prepared as CFData, nil))
    let image = try XCTUnwrap(CGImageSourceCreateImageAtIndex(source, 0, nil))
    // The 1400x220 encoded frame becomes 110x700 upright pixels, without cropping.
    XCTAssertEqual(image.width, 110)
    XCTAssertEqual(image.height, 700)
    let properties = try XCTUnwrap(CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any])
    XCTAssertEqual((properties[kCGImagePropertyOrientation] as? NSNumber)?.intValue ?? 1, 1)
    XCTAssertLessThanOrEqual(prepared.count, OCRTargetRequestLimits.maximumImageBytes)
  }

  func testSelectionUploadBoundsNoisyImageByBytesWithoutChangingOriginal() throws {
    let width = 1_200, height = 800
    var seed: UInt32 = 17
    var pixels = [UInt8](repeating: 0, count: width * height * 4)
    for index in pixels.indices {
      seed = seed &* 1_664_525 &+ 1_013_904_223
      pixels[index] = index % 4 == 3 ? 255 : UInt8(truncatingIfNeeded: seed >> 24)
    }
    let provider = try XCTUnwrap(CGDataProvider(data: Data(pixels) as CFData))
    let image = try XCTUnwrap(CGImage(width: width, height: height, bitsPerComponent: 8, bitsPerPixel: 32,
      bytesPerRow: width * 4, space: CGColorSpaceCreateDeviceRGB(),
      bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.noneSkipLast.rawValue), provider: provider,
      decode: nil, shouldInterpolate: false, intent: .defaultIntent))
    let original = try jpeg(image)
    let snapshot = original
    XCTAssertGreaterThan(original.count, 180_000)
    let prepared = try OCRService.selectionJPEG(original, maximumBytes: 180_000, maximumDimension: 1_200)
    XCTAssertLessThanOrEqual(prepared.count, 180_000)
    XCTAssertEqual(original, snapshot)
    let source = try XCTUnwrap(CGImageSourceCreateWithData(prepared as CFData, nil))
    let decoded = try XCTUnwrap(CGImageSourceCreateImageAtIndex(source, 0, nil))
    XCTAssertEqual(Double(decoded.width) / Double(decoded.height), 1.5, accuracy: 0.01)
  }

  func testSelectionUploadReportsImpossibleByteLimit() throws {
    let original = try jpeg(renderLines(["Keep this source text"]))
    XCTAssertThrowsError(try OCRService.selectionJPEG(original, maximumBytes: 1)) {
      XCTAssertEqual($0 as? OCRError, .selectionImageTooLarge)
    }
    XCTAssertThrowsError(try OCRService.selectionJPEG(Data("invalid".utf8))) {
      XCTAssertEqual($0 as? OCRError, .undecodableImage)
    }
  }

  // MARK: Pure assembly

  private func line(_ text: String, x: CGFloat, y: CGFloat, confidence: Float = 1, height: CGFloat = 0.05) -> OCRService.OCRLine {
    OCRService.OCRLine(text: text, confidence: confidence, boundingBox: CGRect(x: x, y: y, width: 0.3, height: height))
  }

  func testAssembleOrdersTopToBottomThenLeftToRightAndDropsLowConfidence() {
    let result = OCRService.assemble([
      line("bottom", x: 0.1, y: 0.10),
      line("right", x: 0.45, y: 0.81),
      line("noise", x: 0.1, y: 0.50, confidence: 0.2),
      line("left", x: 0.1, y: 0.80),
      line("   ", x: 0.1, y: 0.40),
    ], minimumConfidence: 0.4)

    XCTAssertEqual(result.text, "left right\nbottom")
    XCTAssertEqual(result.lineCount, 3)
    XCTAssertEqual(result.droppedLineCount, 2)
    XCTAssertEqual(result.meanConfidence, 1, accuracy: 0.0001)
  }

  func testAssembleWithOnlyLowConfidenceLinesIsEmpty() {
    let result = OCRService.assemble([line("blur", x: 0.1, y: 0.5, confidence: 0.1)], minimumConfidence: 0.4)
    XCTAssertEqual(result, OCRResult(text: "", meanConfidence: 0, lineCount: 0, droppedLineCount: 1))
  }

  func testMeanConfidenceAveragesKeptLines() {
    let result = OCRService.assemble([
      line("a", x: 0.1, y: 0.8, confidence: 0.5),
      line("b", x: 0.1, y: 0.5, confidence: 1.0),
    ], minimumConfidence: 0.4)
    XCTAssertEqual(result.meanConfidence, 0.75, accuracy: 0.0001)
  }

  func testRecognitionLanguagesKeepEnglishAndOnlySupportedExtras() throws {
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    let supported = try request.supportedRecognitionLanguages()
    let languages = OCRService.supportedLanguages(["en-US", "fi-FI"], request: request)
    XCTAssertEqual(languages.first, "en-US")
    XCTAssertTrue(languages.allSatisfy(supported.contains))
    XCTAssertEqual(OCRService.supportedLanguages(["xx-XX"], request: request), ["en-US"])
  }
}
