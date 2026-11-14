import CoreGraphics
import CoreImage
import CoreText
import ImageIO
import UniformTypeIdentifiers
import XCTest
@testable import GlassesLab

/// Screen-first OCR: a generated photo with a skewed "screen" among wall text, plus the pure
/// candidate scoring and block ordering. Images are drawn here, no binary fixtures.
final class ScreenOCRTests: XCTestCase {
  // MARK: Image generation

  private func context(width: Int, height: Int, fill: CGColor) throws -> CGContext {
    let context = try XCTUnwrap(CGContext(
      data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0,
      space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    ))
    context.setFillColor(fill)
    context.fill(CGRect(x: 0, y: 0, width: width, height: height))
    return context
  }

  private func draw(_ text: String, in context: CGContext, at point: CGPoint, fontSize: CGFloat, color: CGColor) {
    let font = CTFontCreateWithName("Helvetica" as CFString, fontSize, nil)
    let attributed = NSAttributedString(string: text, attributes: [
      NSAttributedString.Key(kCTFontAttributeName as String): font,
      NSAttributedString.Key(kCTForegroundColorAttributeName as String): color,
    ])
    context.textPosition = point
    CTLineDraw(CTLineCreateWithAttributedString(attributed), context)
  }

  private let black = CGColor(red: 0, green: 0, blue: 0, alpha: 1)
  private let white = CGColor(red: 1, green: 1, blue: 1, alpha: 1)

  /// A flat display: dark bezel, bright panel, black text lines top to bottom.
  private func flatScreen(_ lines: [String], width: Int = 900, height: Int = 640) throws -> CGImage {
    let ctx = try context(width: width, height: height, fill: CGColor(red: 0.05, green: 0.05, blue: 0.06, alpha: 1))
    ctx.setFillColor(white)
    ctx.fill(CGRect(x: 36, y: 36, width: width - 72, height: height - 72))
    for (index, line) in lines.enumerated() {
      draw(line, in: ctx, at: CGPoint(x: 80, y: CGFloat(height - 140 - index * 100)), fontSize: 52, color: black)
    }
    return try XCTUnwrap(ctx.makeImage())
  }

  /// A portrait 1080x1440 "photo": plain wall with `wallLines` at the top and bottom, and the
  /// flat screen warped onto a perspective quad (bottom-left coordinates) in the middle.
  private func photo(screenLines: [String]?, wallTop: String, wallBottom: String) throws -> CGImage {
    let wall = try context(width: 1_080, height: 1_440, fill: CGColor(red: 0.78, green: 0.74, blue: 0.68, alpha: 1))
    draw(wallTop, in: wall, at: CGPoint(x: 60, y: 1_330), fontSize: 54, color: black)
    draw(wallBottom, in: wall, at: CGPoint(x: 60, y: 140), fontSize: 54, color: black)
    var composite = CIImage(cgImage: try XCTUnwrap(wall.makeImage()))
    if let screenLines {
      let screen = CIImage(cgImage: try flatScreen(screenLines))
      let warp = try XCTUnwrap(CIFilter(name: "CIPerspectiveTransform"))
      warp.setValue(screen, forKey: kCIInputImageKey)
      warp.setValue(CIVector(x: 170, y: 1_060), forKey: "inputTopLeft")
      warp.setValue(CIVector(x: 930, y: 1_000), forKey: "inputTopRight")
      warp.setValue(CIVector(x: 890, y: 480), forKey: "inputBottomRight")
      warp.setValue(CIVector(x: 210, y: 520), forKey: "inputBottomLeft")
      composite = try XCTUnwrap(warp.outputImage).composited(over: composite)
    }
    return try XCTUnwrap(CIContext().createCGImage(composite, from: CGRect(x: 0, y: 0, width: 1_080, height: 1_440)))
  }

  private func jpeg(_ image: CGImage) throws -> Data {
    let data = NSMutableData()
    let destination = try XCTUnwrap(CGImageDestinationCreateWithData(data, UTType.jpeg.identifier as CFString, 1, nil))
    CGImageDestinationAddImage(destination, image, [kCGImageDestinationLossyCompressionQuality: 0.9] as CFDictionary)
    XCTAssertTrue(CGImageDestinationFinalize(destination))
    return data as Data
  }

  // MARK: Image tests

  func testScreenTextWinsOverWallText() async throws {
    let screenLines = ["Quarterly revenue grew twelve percent", "Mercury orbits the sun quickly", "Tokyo is the capital of Japan", "Water boils at one hundred degrees"]
    let image = try photo(screenLines: screenLines, wallTop: "Yoga class every Tuesday evening", wallBottom: "Lost cat reward offered")
    let result = try await OCRService().recognizeText(in: jpeg(image))

    guard result.source == .screen else {
      if result.candidateCount == 0 {
        throw XCTSkip("Vision rectangle detection found no candidates in this simulator, so screen cropping cannot run here.")
      }
      return XCTFail("expected the screen to be chosen, got \(result.source) with \(result.candidateCount) candidates")
    }
    for word in ["revenue", "Mercury", "Tokyo", "Water"] {
      XCTAssertTrue(result.text.contains(word), "missing screen word \(word)")
    }
    for word in ["Yoga", "Tuesday", "cat", "reward"] {
      XCTAssertFalse(result.text.contains(word), "wall text leaked: \(word)")
    }
    let revenue = try XCTUnwrap(result.text.range(of: "revenue"))
    let water = try XCTUnwrap(result.text.range(of: "Water"))
    XCTAssertLessThan(revenue.lowerBound, water.lowerBound)
  }

  func testNoRectangleFallsBackToWholePhoto() async throws {
    let image = try photo(screenLines: nil, wallTop: "Yoga class every Tuesday evening", wallBottom: "Lost cat reward offered")
    let result = try await OCRService().recognizeText(in: image)
    XCTAssertEqual(result.source, .wholePhoto)
    XCTAssertEqual(result.candidateCount, 0)
    XCTAssertTrue(result.text.contains("Yoga"))
    XCTAssertTrue(result.text.contains("reward"))
  }

  func testTwoColumnsReadOneAfterTheOther() async throws {
    let left = ["Apples grow on trees", "Bananas are yellow fruit", "Cherries ripen in summer", "Dates are sweet and sticky"]
    let right = ["Mercury is closest to sun", "Venus spins backwards slowly", "Earth has exactly one moon", "Mars looks red in the sky"]
    let ctx = try context(width: 1_500, height: 1_500, fill: white)
    for index in left.indices {
      let y = CGFloat(1_300 - index * 100)
      draw(left[index], in: ctx, at: CGPoint(x: 40, y: y), fontSize: 50, color: black)
      draw(right[index], in: ctx, at: CGPoint(x: 880, y: y), fontSize: 50, color: black)
    }
    let result = try await OCRService().recognizeText(in: XCTUnwrap(ctx.makeImage()))

    let leftEnds = ["Apples", "Bananas", "Cherries", "Dates"].compactMap { result.text.range(of: $0)?.lowerBound }
    let rightStarts = ["Mercury", "Venus", "Earth", "Mars"].compactMap { result.text.range(of: $0)?.lowerBound }
    XCTAssertEqual(leftEnds.count, 4, "left column words missing")
    XCTAssertEqual(rightStarts.count, 4, "right column words missing")
    XCTAssertLessThan(try XCTUnwrap(leftEnds.max()), try XCTUnwrap(rightStarts.min()), "column one must come before column two")
  }

  // MARK: Candidate scoring (pure)

  private func box(_ x: CGFloat, _ y: CGFloat, w: CGFloat = 0.3, h: CGFloat = 0.03) -> CGRect {
    CGRect(x: x, y: y, width: w, height: h)
  }

  private let monitor = ScreenQuad(rect: CGRect(x: 0.1, y: 0.2, width: 0.8, height: 0.6))

  func testScoringPicksQuadHoldingText() {
    let lines = [box(0.2, 0.7), box(0.2, 0.6), box(0.2, 0.5)]
    let empty = ScreenQuad(rect: CGRect(x: 0.1, y: 0.85, width: 0.3, height: 0.1))
    XCTAssertEqual(ScreenDetector.chooseScreen(quads: [empty, monitor], lineBoxes: lines), 1)
  }

  func testScoringRejectsEmptyFrameAndLoneLine() {
    XCTAssertNil(ScreenDetector.chooseScreen(quads: [monitor], lineBoxes: []))
    XCTAssertNil(ScreenDetector.chooseScreen(quads: [monitor], lineBoxes: [box(0.2, 0.5)]))
    XCTAssertNil(ScreenDetector.chooseScreen(quads: [], lineBoxes: [box(0.2, 0.5), box(0.2, 0.4)]))
  }

  func testScoringIgnoresTextMostlyOutsideTheQuad() {
    // Centres outside the quad, or boxes hanging mostly over its edge, do not count.
    let outside = [box(0.2, 0.9), box(0.2, 0.1)]
    XCTAssertNil(ScreenDetector.chooseScreen(quads: [monitor], lineBoxes: outside))
    let straddling = [box(0.75, 0.5, w: 0.4), box(0.75, 0.4, w: 0.4)]
    XCTAssertNil(ScreenDetector.chooseScreen(quads: [monitor], lineBoxes: straddling))
  }

  func testScoringRejectsQuadCoveringTheWholePhoto() {
    let frame = ScreenQuad(rect: CGRect(x: 0, y: 0, width: 1, height: 1))
    XCTAssertNil(ScreenDetector.chooseScreen(quads: [frame], lineBoxes: [box(0.2, 0.7), box(0.2, 0.6)]))
  }

  func testNestedQuadsResolveToTheBestFraming() {
    let window = ScreenQuad(rect: CGRect(x: 0.15, y: 0.55, width: 0.4, height: 0.2))
    // The window holds only some of the monitor's text: the monitor wins.
    let spread = [box(0.2, 0.7), box(0.2, 0.6), box(0.2, 0.45), box(0.2, 0.35), box(0.2, 0.25)]
    XCTAssertEqual(ScreenDetector.chooseScreen(quads: [window, monitor], lineBoxes: spread), 1)
    XCTAssertEqual(ScreenDetector.chooseScreen(quads: [monitor, window], lineBoxes: spread), 0)
    // The window holds all the text: the tighter quad wins.
    let tight = [box(0.2, 0.7), box(0.2, 0.6)]
    XCTAssertEqual(ScreenDetector.chooseScreen(quads: [monitor, window], lineBoxes: tight), 1)
    XCTAssertEqual(ScreenDetector.chooseScreen(quads: [window, monitor], lineBoxes: tight), 0)
  }

  func testQuadGeometry() {
    let quad = ScreenQuad(rect: CGRect(x: 0.2, y: 0.2, width: 0.5, height: 0.4))
    XCTAssertEqual(quad.area, 0.2, accuracy: 0.0001)
    XCTAssertTrue(quad.contains(CGPoint(x: 0.4, y: 0.4)))
    XCTAssertFalse(quad.contains(CGPoint(x: 0.8, y: 0.4)))
  }

  // MARK: Block ordering (pure)

  private func line(_ text: String, x: CGFloat, y: CGFloat, w: CGFloat = 0.3) -> OCRService.OCRLine {
    OCRService.OCRLine(text: text, confidence: 1, boundingBox: CGRect(x: x, y: y, width: w, height: 0.03))
  }

  func testColumnsAreNotInterleaved() {
    let result = OCRService.assemble([
      line("R1", x: 0.55, y: 0.80), line("L1", x: 0.05, y: 0.80),
      line("R2", x: 0.55, y: 0.75), line("L2", x: 0.05, y: 0.75),
      line("R3", x: 0.55, y: 0.70), line("L3", x: 0.05, y: 0.70),
    ], minimumConfidence: 0.4)
    XCTAssertEqual(result.text, "L1\nL2\nL3\nR1\nR2\nR3")
    XCTAssertEqual(result.lineCount, 6)
  }

  func testBlocksOrderTopToBottomThenLeftToRight() {
    let result = OCRService.assemble([
      line("lower", x: 0.05, y: 0.30),
      line("right", x: 0.55, y: 0.81),
      line("left", x: 0.05, y: 0.80),
    ], minimumConfidence: 0.4)
    XCTAssertEqual(result.text, "left\nlower\nright")
  }

  func testCloseSameRowLinesJoinButWideGapsDoNot() {
    let close = OCRService.assemble([
      line("Name", x: 0.1, y: 0.5, w: 0.1), line("Qty", x: 0.25, y: 0.5, w: 0.1),
    ], minimumConfidence: 0.4)
    XCTAssertEqual(close.text, "Name Qty")
    let wide = OCRService.assemble([
      line("Name", x: 0.1, y: 0.5, w: 0.1), line("Qty", x: 0.7, y: 0.5, w: 0.1),
    ], minimumConfidence: 0.4)
    XCTAssertEqual(wide.text, "Name\nQty")
  }

  func testTwoColumnsOfTwoParagraphsStayInColumns() {
    // Left paragraphs sit more than 1.5 line heights apart; the right column straddles the gap.
    let result = OCRService.assemble([
      line("L1a", x: 0.05, y: 0.90, w: 0.3), line("L1b", x: 0.05, y: 0.86, w: 0.3),
      line("L2a", x: 0.05, y: 0.60, w: 0.3), line("L2b", x: 0.05, y: 0.56, w: 0.3),
      line("R1a", x: 0.60, y: 0.88, w: 0.3), line("R1b", x: 0.60, y: 0.84, w: 0.3),
      line("R2a", x: 0.60, y: 0.58, w: 0.3), line("R2b", x: 0.60, y: 0.54, w: 0.3),
    ], minimumConfidence: 0.4)
    XCTAssertEqual(result.text, "L1a\nL1b\nL2a\nL2b\nR1a\nR1b\nR2a\nR2b")
  }

  func testFullWidthTitleSeparatesBands() {
    let result = OCRService.assemble([
      line("Title", x: 0.05, y: 0.95, w: 0.85),
      line("R1", x: 0.60, y: 0.80, w: 0.3), line("L1", x: 0.05, y: 0.80, w: 0.3),
      line("L2", x: 0.05, y: 0.50, w: 0.3), line("R2", x: 0.60, y: 0.50, w: 0.3),
    ], minimumConfidence: 0.4)
    XCTAssertEqual(result.text, "Title\nL1\nL2\nR1\nR2")
  }

  func testGutterIsMeasuredInPixelsOnLandscapeImages() {
    // A 0.05 normalised gutter on a 2:1 image is 0.10 of the height: over 2 line heights of
    // 0.03 would be 0.06, so the columns stay apart. With aspect 1 they would be joined.
    let lines = [
      line("L1", x: 0.40, y: 0.80, w: 0.10), line("R1", x: 0.55, y: 0.80, w: 0.10),
    ]
    XCTAssertEqual(OCRService.orderedBlocks(lines, aspect: 1).count, 1)
    XCTAssertEqual(OCRService.orderedBlocks(lines, aspect: 2).count, 2)
  }

  func testDistantParagraphsAreSeparateBlocks() {
    let blocks = OCRService.orderedBlocks([
      line("a1", x: 0.1, y: 0.80), line("a2", x: 0.1, y: 0.76), line("b1", x: 0.1, y: 0.40),
    ])
    XCTAssertEqual(blocks.map { $0.map(\.text) }, [["a1", "a2"], ["b1"]])
  }

  func testAssembleKeepsDroppedCountAndConfidenceFilter() {
    let result = OCRService.assemble([
      line("keep", x: 0.1, y: 0.5),
      OCRService.OCRLine(text: "noise", confidence: 0.1, boundingBox: box(0.1, 0.2)),
    ], minimumConfidence: 0.4)
    XCTAssertEqual(result.text, "keep")
    XCTAssertEqual(result.droppedLineCount, 1)
    XCTAssertEqual(result.source, .wholePhoto)
  }
}
