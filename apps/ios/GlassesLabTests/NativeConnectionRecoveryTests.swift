import Foundation
import XCTest
@testable import GlassesLab

final class NativeConnectionRecoveryTests: XCTestCase {
  func testNativeCardReplayRequiresSameSessionEpochAndUnexpiredDeadline() throws {
    let lease = try XCTUnwrap(NativeCardEligibility(sessionId: "session-1", sessionEpoch: 3, expiresAt: "2026-11-14T12:00:00.500Z"))
    let before = lease.expiresAt.addingTimeInterval(-0.1)
    XCTAssertTrue(lease.permits(sessionId: "session-1", epoch: 3, now: before))
    XCTAssertFalse(lease.permits(sessionId: "session-2", epoch: 3, now: before))
    XCTAssertFalse(lease.permits(sessionId: "session-1", epoch: 4, now: before))
    XCTAssertFalse(lease.permits(sessionId: nil, epoch: nil, now: before))
    XCTAssertFalse(lease.permits(sessionId: "session-1", epoch: 3, now: lease.expiresAt))
  }

  func testMalformedDeadlineCannotBecomeAnIndefiniteCard() {
    XCTAssertNil(NativeCardEligibility(sessionId: "session-1", sessionEpoch: 1, expiresAt: "invalid"))
    XCTAssertNotNil(NativeCardEligibility(sessionId: "session-1", sessionEpoch: 1, expiresAt: "2026-11-14T12:00:00Z"))
  }
}
