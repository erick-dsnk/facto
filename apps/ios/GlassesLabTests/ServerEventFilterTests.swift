import XCTest
@testable import GlassesLab

final class ServerEventFilterTests: XCTestCase {
  private func event(_ json: String) throws -> ServerEvent {
    try ServerEvent.decode(from: Data(json.utf8))
  }

  func testDeliversCurrentEventsAndDropsRepeatedEventIds() throws {
    var filter = ServerEventFilter(sessionId: "session-1", epoch: 1)
    let checking = try event(EventJSON.checking(id: "e1"))
    XCTAssertEqual(filter.accept(checking), .deliver)
    XCTAssertEqual(filter.accept(checking), .drop(.duplicateEventId))
  }

  func testDropsOtherSessionsAndOldEpochs() throws {
    var filter = ServerEventFilter(sessionId: "session-1", epoch: 2)
    XCTAssertEqual(filter.accept(try event(EventJSON.ready(id: "e1", session: "session-2"))), .drop(.otherSession))
    XCTAssertEqual(filter.accept(try event(EventJSON.checking(id: "e2", epoch: 1))), .drop(.oldEpoch))
    XCTAssertEqual(filter.epoch, 2)
  }

  func testHigherEpochIsAdoptedAndOlderEpochIsThenDropped() throws {
    var filter = ServerEventFilter(sessionId: "session-1", epoch: 1)
    // The server raises the epoch on pause or disconnect and announces it with session.ready.
    XCTAssertEqual(filter.accept(try event(EventJSON.ready(id: "e1", epoch: 2, active: false))), .deliver)
    XCTAssertEqual(filter.epoch, 2)
    XCTAssertEqual(filter.accept(try event(EventJSON.checking(id: "e2", epoch: 1))), .drop(.oldEpoch))
  }

  func testOldRevisionIsDroppedButSupersededForTheOldRevisionPasses() throws {
    var filter = ServerEventFilter(sessionId: "session-1", epoch: 1)
    XCTAssertEqual(filter.accept(try event(EventJSON.checking(id: "e1", revision: 1))), .deliver)
    let superseded = EventJSON.make(id: "e2", type: "claim.superseded", requestId: "req-1", revision: 1,
                                    payload: "{\"reasonCode\":\"corrected\"}")
    XCTAssertEqual(filter.accept(try event(superseded)), .deliver)
    XCTAssertEqual(filter.accept(try event(EventJSON.checking(id: "e3", revision: 2))), .deliver)
    XCTAssertEqual(filter.accept(try event(EventJSON.checking(id: "e4", revision: 1))), .drop(.oldRevision))
    let lateSuperseded = EventJSON.make(id: "e5", type: "claim.superseded", requestId: "req-1", revision: 1,
                                        payload: "{\"reasonCode\":\"corrected\"}")
    XCTAssertEqual(filter.accept(try event(lateSuperseded)), .deliver)
    // Other requests track their own revisions.
    XCTAssertEqual(filter.accept(try event(EventJSON.checking(id: "e6", requestId: "req-2", revision: 1))), .deliver)
  }

  func testRevisionTrackingResetsWithANewEpoch() throws {
    var filter = ServerEventFilter(sessionId: "session-1", epoch: 1)
    XCTAssertEqual(filter.accept(try event(EventJSON.checking(id: "e1", revision: 3))), .deliver)
    XCTAssertEqual(filter.accept(try event(EventJSON.checking(id: "e2", epoch: 2, revision: 1))), .deliver)
  }

  func testUnknownTypesAndMalformedPayloadsAreDropped() throws {
    var filter = ServerEventFilter(sessionId: "session-1", epoch: 1)
    let future = EventJSON.make(id: "e1", type: "session.future_thing", payload: "{\"x\":1}")
    XCTAssertEqual(filter.accept(try event(future)), .drop(.unknownType))
    let broken = EventJSON.make(id: "e2", type: "claim.waiting", requestId: "req-1", revision: 1, payload: "{\"admissionAction\":\"wait\"}")
    XCTAssertEqual(filter.accept(try event(broken)), .drop(.malformedPayload))
    // A dropped event still counts as seen.
    XCTAssertEqual(filter.accept(try event(future)), .drop(.duplicateEventId))
  }

  func testCaptureRequestIsDelivered() throws {
    var filter = ServerEventFilter(sessionId: "session-1", epoch: 1)
    let capture = EventJSON.make(id: "e1", type: "capture.request", payload: "{}")
    XCTAssertEqual(filter.accept(try event(capture)), .deliver)
  }

  func testDuplicateWindowIsBounded() throws {
    var filter = ServerEventFilter(sessionId: "session-1", epoch: 1)
    let first = try event(EventJSON.ready(id: "e0"))
    XCTAssertEqual(filter.accept(first), .deliver)
    for index in 1...ServerEventFilter.rememberedEventIds {
      _ = filter.accept(try event(EventJSON.ready(id: "e\(index)")))
    }
    // The oldest id has left the window; only the recent ones are remembered.
    XCTAssertEqual(filter.accept(first), .deliver)
    XCTAssertEqual(filter.accept(try event(EventJSON.ready(id: "e\(ServerEventFilter.rememberedEventIds)"))), .drop(.duplicateEventId))
  }

  func testFixtureEventStreamPassesInOrder() throws {
    let bundle = Bundle(for: Self.self)
    let url = try XCTUnwrap(bundle.url(forResource: "events", withExtension: "json", subdirectory: "Fixtures"))
    let events = try JSONDecoder().decode([ServerEvent].self, from: Data(contentsOf: url))
    var filter = ServerEventFilter(sessionId: events[0].sessionId, epoch: events[0].sessionEpoch)
    XCTAssertEqual(events.map { filter.accept($0) }, Array(repeating: .deliver, count: events.count))
    XCTAssertEqual(events.map { filter.accept($0) }, Array(repeating: .drop(.duplicateEventId), count: events.count))
  }
}
