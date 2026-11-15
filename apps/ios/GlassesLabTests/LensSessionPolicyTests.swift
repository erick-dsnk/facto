import XCTest
@testable import GlassesLab

/// The lens session rules, replayed from the phone log of 14 Nov: an empty lens reopened about
/// 1 s after every back press, and glasses off the face retried about once a second.
final class LensSessionPolicyTests: XCTestCase {
  private let t0 = Date(timeIntervalSince1970: 1_000)

  private func card(_ verdict: String = "False", detail: String = "3 of 3 sources disagree") -> ResultCard {
    ResultCard(kind: .contradicted, verdictWord: verdict, detail: detail, excerpt: "Anthropic has a two year evaluation",
               quote: nil, sourceName: "Example", spokenLine: "\(verdict). \(detail).")
  }

  private func search(_ claim: String) -> LensContent.Search {
    LensContent.Search(claimText: claim, captureLabel: "Heard nearby", sources: [])
  }

  // MARK: Nothing to show, nothing open

  func testWornDisplayWithNothingToShowOpensNoSession() {
    var policy = LensSessionPolicy()
    policy.lensVisible = true
    XCTAssertEqual(policy.action(sessionOpen: false, now: t0), .none, "an empty session is the grey box")
    XCTAssertEqual(policy.action(sessionOpen: true, now: t0), .closeWhenIdle)
  }

  func testCardOnWornDisplayOpensTheLens() {
    var policy = LensSessionPolicy()
    policy.lensVisible = true
    policy.hasContent = true
    XCTAssertEqual(policy.action(sessionOpen: false, now: t0), .open)
    XCTAssertEqual(policy.action(sessionOpen: true, now: t0), .none)
  }

  func testGlassesNotWornNeverOpenAndCloseAnOpenLens() {
    var policy = LensSessionPolicy()
    policy.lensVisible = false
    policy.hasContent = true
    XCTAssertEqual(policy.action(sessionOpen: false, now: t0), .none)
    XCTAssertEqual(policy.action(sessionOpen: true, now: t0), .close)
  }

  // MARK: Back press (23:04 to 23:06)

  func testBackPressKeepsTheLensClosedUntilDifferentContent() {
    var content = LensContent()
    var policy = LensSessionPolicy()
    policy.lensVisible = true
    let shown = card()
    content.show(card: shown)
    policy.hasContent = !content.isEmpty
    XCTAssertEqual(policy.action(sessionOpen: false, now: t0), .open)

    // "Session ended by device", or a swipe.
    content.dismiss()
    policy.hasContent = !content.isEmpty
    XCTAssertEqual(policy.action(sessionOpen: false, now: t0.addingTimeInterval(1)), .none,
                   "the lens used to reopen 1 s after back")

    // The same card arriving again (a restore) can't bring it back.
    XCTAssertFalse(content.show(card: shown))
    policy.hasContent = !content.isEmpty
    XCTAssertEqual(policy.action(sessionOpen: false, now: t0.addingTimeInterval(2)), .none)

    // A different card can.
    XCTAssertTrue(content.show(card: card("True", detail: "2 of 2 sources agree")))
    policy.hasContent = !content.isEmpty
    XCTAssertEqual(policy.action(sessionOpen: false, now: t0.addingTimeInterval(3)), .open)
  }

  func testSourceUpdatesCannotReopenADismissedSearchButItsResultCan() {
    var content = LensContent()
    content.show(search: search("Anthropic has a two year evaluation"))
    content.dismiss()
    XCTAssertFalse(content.show(search: search("Anthropic has a two year evaluation")))
    XCTAssertTrue(content.isEmpty)
    XCTAssertTrue(content.show(card: card()))
    XCTAssertNotNil(content.card)
  }

  func testClearingTheLensForgetsWhatWasDismissed() {
    var content = LensContent()
    let shown = card()
    content.show(card: shown)
    content.dismiss()
    content.show(card: nil)
    XCTAssertTrue(content.show(card: shown), "after a clear, the same verdict on a new check shows")
  }

  func testNewResultReplacesAcknowledgementAndSearch() {
    var content = LensContent()
    content.show(search: search("claim"))
    content.show(feedback: .checking)
    content.show(card: card())
    XCTAssertNil(content.feedback)
    XCTAssertNil(content.search)
    XCTAssertNotNil(content.card)
  }

  // MARK: Glasses off the face (from 23:06)

  func testFailedOpensBackOffAndFlickeringGlassesCannotSkipIt() {
    var policy = LensSessionPolicy()
    policy.lensVisible = true
    policy.hasContent = true
    XCTAssertEqual(policy.action(sessionOpen: false, now: t0), .open)
    policy.openFailed(at: t0) // "Device unavailable"

    // The failed session drops the link: the glasses read as gone, then back, within a second.
    policy.lensVisible = false
    XCTAssertEqual(policy.action(sessionOpen: false, now: t0.addingTimeInterval(0.1)), .none)
    policy.lensVisible = true
    XCTAssertEqual(policy.action(sessionOpen: false, now: t0.addingTimeInterval(0.5)), .retry(after: 0.5),
                   "coming back must not retry at once")
    XCTAssertEqual(policy.action(sessionOpen: false, now: t0.addingTimeInterval(1)), .open)
  }

  func testBackoffGrowsThenSettlesAtFifteenSeconds() {
    var policy = LensSessionPolicy()
    policy.lensVisible = true
    policy.hasContent = true
    var now = t0
    for expected in [1.0, 2, 4, 8, 15, 15] {
      policy.openFailed(at: now)
      XCTAssertEqual(policy.action(sessionOpen: false, now: now), .retry(after: expected))
      now = now.addingTimeInterval(expected)
      XCTAssertEqual(policy.action(sessionOpen: false, now: now), .open)
    }
  }

  func testSuccessfulOpenResetsTheBackoff() {
    var policy = LensSessionPolicy()
    policy.lensVisible = true
    policy.hasContent = true
    policy.openFailed(at: t0)
    policy.openFailed(at: t0)
    policy.opened()
    XCTAssertEqual(policy.failures, 0)
    XCTAssertEqual(policy.action(sessionOpen: false, now: t0), .open)
  }

  // MARK: Photo on Display glasses (23:12:59)

  func testLensStepsAsideWhileTheCameraTakesAPhotoAndComesBackAfter() {
    var policy = LensSessionPolicy()
    policy.lensVisible = true
    policy.hasContent = true
    policy.cameraBusy = true
    XCTAssertEqual(policy.action(sessionOpen: true, now: t0), .close, "a running stream holds back the lens")
    XCTAssertEqual(policy.action(sessionOpen: false, now: t0), .none)
    policy.cameraBusy = false
    XCTAssertEqual(policy.action(sessionOpen: false, now: t0), .open, "the search or card shows once the photo is done")
  }

  func testAcknowledgementAloneDoesNotOpenTheLens() {
    var content = LensContent()
    content.show(feedback: .checking)
    XCTAssertFalse(content.opensLens)
    XCTAssertFalse(content.isEmpty)
    content.show(search: search("claim"))
    XCTAssertTrue(content.opensLens)
  }

  func testEndedByDeviceIsRecognisedFromTheSDKMessage() {
    XCTAssertTrue(GlassesSession.isEndedByDevice("Session ended by device"))
    XCTAssertFalse(GlassesSession.isEndedByDevice("Device unavailable"))
  }
}

/// Listening took AirPods Max over the glasses on 14 Nov because it used the first HFP input.
final class GlassesHFPInputTests: XCTestCase {
  func testGlassesWinOverAirPods() {
    XCTAssertEqual(GlassesHFPInput.preferredIndex(["David’s AirPods Max", "Meta Ray-Ban Display 0021"]), 1)
    XCTAssertEqual(GlassesHFPInput.preferredIndex(["AirPods Pro", "Ray-Ban Meta 00J5"]), 1)
  }

  func testUnknownNameBeatsAKnownHeadset() {
    XCTAssertEqual(GlassesHFPInput.preferredIndex(["David’s AirPods Max", "0021"]), 1)
  }

  func testFallsBackToTheOnlyInputAndNilWithNone() {
    XCTAssertEqual(GlassesHFPInput.preferredIndex(["David’s AirPods Max"]), 0)
    XCTAssertNil(GlassesHFPInput.preferredIndex([]))
  }
}
