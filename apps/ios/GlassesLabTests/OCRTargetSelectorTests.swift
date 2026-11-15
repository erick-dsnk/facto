import CoreGraphics
import XCTest
@testable import GlassesLab

final class OCRTargetSelectorTests: XCTestCase {
  private func line(_ id: String, _ text: String, x: Double = 0.1, y: Double = 0.7,
                    width: Double = 0.6, height: Double = 0.04,
                    view: String = "original", confidence: Double = 0.95) -> OCRTargetLine {
    .init(id: id, text: text, confidence: confidence, polygon: [
      .init(x: x, y: y + height), .init(x: x + width, y: y + height),
      .init(x: x + width, y: y), .init(x: x, y: y),
    ], viewId: view)
  }

  func testDominantTitleExcludesSmallerBadgeAndSidebar() {
    let input = OCRTargetInput(lines: [
      line("title-1", "US aviation shutdown blamed on", height: 0.05),
      line("title-2", "installed router from supplier", y: 0.64, height: 0.05),
      line("badge", "Soft paywall", y: 0.61, width: 0.1, height: 0.015),
      line("sidebar", "Read the community rules here", x: 0.78, y: 0.65, width: 0.2, height: 0.02),
    ], aspect: 1)
    let result = OCRTargetSelector.select(input)
    XCTAssertEqual(result.status, .selected)
    XCTAssertEqual(result.selectedLineIds, ["title-1", "title-2"])
    XCTAssertEqual(result.resolvedLines(in: input)?.map(\.text), ["US aviation shutdown blamed on", "installed router from supplier"])
  }

  func testFeedWithPeersNeedsTargetRatherThanDroppingLeftEdgeText() {
    let input = OCRTargetInput(lines: [
      line("first", "US aviation shutdown blamed on router", x: 0, y: 0.7),
      line("second", "City bus drivers receive additional training", x: 0, y: 0.4),
    ], aspect: 1)
    let result = OCRTargetSelector.select(input)
    XCTAssertEqual(result.status, .needsTarget)
    XCTAssertEqual(result.candidates.count, 2)
    XCTAssertTrue(result.selectedLineIds.isEmpty)
  }

  func testExplicitDescriptionResolvesOnePeer() {
    let input = OCRTargetInput(lines: [
      line("first", "US aviation shutdown blamed on router", y: 0.7),
      line("second", "City bus drivers receive additional training", y: 0.4),
    ], aspect: 1)
    XCTAssertEqual(OCRTargetSelector.select(input, intent: "Check the aviation shutdown story").selectedLineIds, ["first"])
    XCTAssertEqual(OCRTargetSelector.select(input, intent: "check this").status, .needsTarget)
  }

  func testExplicitRegionChoosesParagraphInsteadOfHeadline() {
    let input = OCRTargetInput(lines: [
      line("title", "This headline has larger type", y: 0.8, height: 0.06),
      line("paragraph", "The relevant paragraph contains the actual claim", y: 0.4, height: 0.025),
    ], aspect: 1, preferredRegion: CGRect(x: 0.05, y: 0.35, width: 0.7, height: 0.12))
    XCTAssertEqual(OCRTargetSelector.select(input).selectedLineIds, ["paragraph"])
  }

  func testCollapsedTextIsIncompleteWithoutInventingCompletion() {
    let input = OCRTargetInput(lines: [line("post", "President is officially Dea... View more")], aspect: 1)
    XCTAssertEqual(OCRTargetSelector.select(input).status, .incomplete)
    XCTAssertTrue(OCRTargetSelector.select(input).selectedLineIds.isEmpty)
  }

  func testBadCropCannotDeleteOriginalContext() {
    let input = OCRTargetInput(lines: [
      line("first", "US aviation shutdown blamed on router", y: 0.7),
      line("second", "City bus drivers receive additional training", y: 0.4),
      line("cropped-first", "US aviation shutdown blamed on router", y: 0.7, view: "screen"),
    ], aspect: 1)
    XCTAssertEqual(OCRTargetSelector.select(input).status, .needsTarget)
    XCTAssertEqual(OCRTargetSelector.select(input).candidates.count, 2)
  }

  func testCropCanRecoverTextWhenOriginalRecognitionFailed() {
    let input = OCRTargetInput(lines: [
      line("original-noise", "A damaged reading of title", confidence: 0.2),
      line("recovered", "The recovered title contains the claim", view: "screen"),
    ], aspect: 1)
    XCTAssertEqual(OCRTargetSelector.select(input).selectedLineIds, ["recovered"])
  }

  func testCropAddsMissingTextWithoutLosingOriginalPeer() {
    let input = OCRTargetInput(lines: [
      line("original-peer", "City bus drivers receive additional training", y: 0.4),
      line("recovered", "US aviation shutdown blamed on router", y: 0.7, view: "screen"),
    ], aspect: 1)
    XCTAssertEqual(OCRTargetSelector.select(input).status, .needsTarget)
    XCTAssertEqual(OCRTargetSelector.select(input).candidates.count, 2)
  }

  func testThreeWordClaimIsStillACheckableBlock() {
    let input = OCRTargetInput(lines: [line("claim", "Earth is flat")], aspect: 1)
    XCTAssertEqual(OCRTargetSelector.select(input).selectedLineIds, ["claim"])
  }

  func testModelCannotReverseWrappedTitleOrder() {
    let input = OCRTargetInput(lines: [
      line("top", "US aviation shutdown blamed on", y: 0.7),
      line("bottom", "installed router from supplier", y: 0.65),
    ], aspect: 1)
    let result = OCRTargetSelection(status: .selected, selectedLineIds: ["bottom", "top"])
    XCTAssertEqual(result.resolvedLines(in: input)?.map(\.id), ["top", "bottom"])
  }

  func testUnknownAndDuplicateIDsFailClosed() {
    let input = OCRTargetInput(lines: [line("a", "A visible claim with several words")], aspect: 1)
    XCTAssertNil(OCRTargetSelection(status: .selected, selectedLineIds: ["hallucinated"]).resolvedLines(in: input))
    XCTAssertNil(OCRTargetSelection(status: .selected, selectedLineIds: ["a", "a"]).resolvedLines(in: input))
    XCTAssertNil(OCRTargetSelection(status: .selected).resolvedLines(in: input))
  }

  func testOverlappingAlternateViewsCannotDuplicateClaim() {
    let input = OCRTargetInput(lines: [
      line("raw", "A visible claim with several words"),
      line("crop", "A visible claim with several words", view: "screen"),
    ], aspect: 1)
    XCTAssertNil(OCRTargetSelection(status: .selected, selectedLineIds: ["raw", "crop"]).resolvedLines(in: input))
    XCTAssertEqual(OCRTargetSelection(status: .selected, selectedLineIds: ["crop"]).resolvedLines(in: input)?.count, 1)
  }

  func testUnreadableIsDistinctFromCompetingTargets() {
    let input = OCRTargetInput(lines: [line("noise", "A damaged uncertain text line", confidence: 0.2)], aspect: 1)
    XCTAssertEqual(OCRTargetSelector.select(input).status, .unreadable)
    XCTAssertEqual(OCRTargetSelector.select(.init(lines: [], aspect: 1)).status, .unreadable)
  }

  func testStandaloneExpansionControlMeansIncompleteButOrdinaryWordsDoNot() {
    XCTAssertTrue(OCRTargetSelector.isVisiblyTruncated("A claim that is visibly collapsed\nView more"))
    XCTAssertTrue(OCRTargetSelector.isVisiblyTruncated("A collapsed excerpt\nRead more"))
    XCTAssertFalse(OCRTargetSelector.isVisiblyTruncated("Children who read more score higher on tests"))
  }

  func testPerspectiveViewMapsBackToOriginalCorners() {
    let quad = ScreenQuad(topLeft: CGPoint(x: 0.2, y: 0.8), topRight: CGPoint(x: 0.9, y: 0.7),
                          bottomRight: CGPoint(x: 0.8, y: 0.2), bottomLeft: CGPoint(x: 0.25, y: 0.3))
    let mapped = quad.mapFromUnit([.init(x: 0, y: 1), .init(x: 1, y: 1), .init(x: 1, y: 0), .init(x: 0, y: 0)])
    for (point, expected) in zip(mapped, quad.corners) {
      XCTAssertEqual(point.x, Double(expected.x), accuracy: 1e-9)
      XCTAssertEqual(point.y, Double(expected.y), accuracy: 1e-9)
    }
  }
}
