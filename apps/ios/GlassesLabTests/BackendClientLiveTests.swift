import XCTest
@testable import GlassesLab

/// Runs `BackendClient` against a real services/api in fixture mode. Skipped unless the
/// backend is named in the environment, e.g.:
///
///   PIPELINE_MODE=fixture DEMO_JOIN_CODE=local-ios-test DEMO_JOIN_EXPIRES_AT=2027-01-01T00:00:00Z \
///     PORT=3077 npm start
///   TEST_RUNNER_BACKEND_LIVE_URL=http://127.0.0.1:3077 TEST_RUNNER_BACKEND_LIVE_JOIN_CODE=local-ios-test \
///     xcodebuild test ... -only-testing:GlassesLabTests/BackendClientLiveTests
///
/// xcodebuild strips the TEST_RUNNER_ prefix before the variables reach the test process.
@MainActor
final class BackendClientLiveTests: XCTestCase {
  func testFixtureCheckRoundTripOverTheRealStream() async throws {
    let environment = ProcessInfo.processInfo.environment
    guard let base = environment["BACKEND_LIVE_URL"].flatMap(URL.init(string:)),
          let joinCode = environment["BACKEND_LIVE_JOIN_CODE"]
    else { throw XCTSkip("Set BACKEND_LIVE_URL and BACKEND_LIVE_JOIN_CODE to run against a backend.") }

    let client = BackendClient(config: BackendConfig(baseURL: base, joinCode: joinCode))
    let events = Collector(client.events())
    try await client.connect()
    XCTAssertEqual(client.connectionState, .connected)
    let sessionId = try XCTUnwrap(client.sessionId)
    await waitUntil { events.values.contains { $0.type == .sessionReady } }

    // Fixture mode checks this sentence and answers `supported`.
    let input = TextInputEnvelope(
      requestId: WireID.makeRequestId(prefix: "live"),
      sessionId: sessionId,
      sessionEpoch: try XCTUnwrap(client.sessionEpoch),
      mode: .typed,
      text: "Helsinki is the capital of Finland.",
      capturedAt: Date(),
      capture: .init(source: .typedFixture, segmentId: "typed-live-1", confidence: 1, final: true),
      userInitiated: true
    )
    try await client.submit(input)
    await waitUntil(timeout: 10) { events.values.contains { $0.type == .claimResult } }
    let resultEvent = try XCTUnwrap(events.values.first { $0.type == .claimResult })
    guard case .claimResult(let result) = resultEvent.payload else { return XCTFail("Expected a result payload") }
    XCTAssertEqual(result.verdict, .supported)
    XCTAssertEqual(resultEvent.requestId, input.requestId)
    XCTAssertTrue(result.spanMatchesCheckedText)

    // Cancel is idempotent, even for a finished request.
    try await client.cancel(requestId: input.requestId)

    // Pause raises the epoch; resume must carry the new one.
    try await client.sendControl(ControlMessage.pause(epoch: input.sessionEpoch))
    await waitUntil { client.sessionEpoch == input.sessionEpoch + 1 }
    try await client.sendControl(ControlMessage.resume(epoch: try XCTUnwrap(client.sessionEpoch)))
    await waitUntil {
      events.values.contains { event in
        if case .sessionReady(let payload) = event.payload { return payload.active && event.sessionEpoch == input.sessionEpoch + 1 }
        return false
      }
    }

    await client.close()
    XCTAssertEqual(client.connectionState, .disconnected(reason: "closed"))
    XCTAssertEqual(Set(events.values.map(\.eventId)).count, events.values.count, "No repeated event ids")
  }
}
