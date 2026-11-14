import XCTest
@testable import GlassesLab

@MainActor
final class WebDisplayConnectionTests: XCTestCase {
  private let now = Date(timeIntervalSince1970: 1_800_000_000)

  private func grant(epoch: Int = 1, lifetime: TimeInterval = 180) -> DisplayGrant {
    DisplayGrant(schemaVersion: 1, sessionId: "session-1", sessionEpoch: epoch,
      displayToken: "reader-secret_123", expiresAt: ISO8601DateFormatter().string(from: now.addingTimeInterval(lifetime)),
      streamPath: "/v1/sessions/session-1/display-stream")
  }

  func testLinkCarriesOnlyReaderCredentialsInFragment() throws {
    let url = try WebDisplayConnection.makeURL(appURL: URL(string: "https://display.example.test/app")!,
      apiURL: URL(string: "https://api.example.test")!, grant: grant())
    let parts = try XCTUnwrap(URLComponents(url: url, resolvingAgainstBaseURL: false))
    XCTAssertEqual(parts.query, "display=1&live=1")
    XCTAssertFalse(try XCTUnwrap(parts.query).contains("secret"))
    let fragment = try XCTUnwrap(URLComponents(string: "?" + (parts.fragment ?? "")))
    let values = Dictionary(uniqueKeysWithValues: (fragment.queryItems ?? []).map { ($0.name, $0.value ?? "") })
    XCTAssertEqual(Set(values.keys), ["sessionId", "displayToken", "api"])
    XCTAssertEqual(values["displayToken"], "reader-secret_123")
    XCTAssertEqual(values["api"], "https://api.example.test")
    XCTAssertFalse(grant().description.contains("reader-secret"))
  }

  func testURLValidationAllowsHTTPSAndLoopbackOnly() {
    for url in ["https://display.example.test/app", "http://localhost:3030", "http://127.0.0.1:3030"] {
      XCTAssertNoThrow(try WebDisplayConnection.validatedBaseURL(url))
    }
    for url in ["http://display.example.test", "javascript:alert(1)", "https://user:pass@display.example.test", "https://display.example.test?token=secret", "https://display.example.test#secret"] {
      XCTAssertThrowsError(try WebDisplayConnection.validatedBaseURL(url), url)
    }
    XCTAssertThrowsError(try WebDisplayConnection.expiry(of: grant(lifetime: -1), now: now))
    XCTAssertThrowsError(try WebDisplayConnection.expiry(of: grant(lifetime: 600), now: now))
  }

  func testSessionEpochChangeClearsReaderAndOnlyStoresPublicAppURL() async throws {
    let suite = "WebDisplayConnectionTests-\(UUID())"
    let defaults = try XCTUnwrap(UserDefaults(suiteName: suite))
    defer { defaults.removePersistentDomain(forName: suite) }
    let model = WebDisplayConnection(defaults: defaults, now: { self.now })
    model.appURLText = "https://display.example.test"
    model.updateSession(id: "session-1", epoch: 1)
    await model.prepare(apiURL: URL(string: "https://api.example.test")!) { self.grant() }
    XCTAssertNotNil(model.link)
    XCTAssertFalse(defaults.dictionaryRepresentation().description.contains("reader-secret"))
    model.appURLText = "https://display.example.test#displayToken=pasted-secret"
    XCTAssertNil(defaults.string(forKey: WebDisplayConnection.urlKey))
    model.appURLText = "https://display.example.test"
    model.updateSession(id: "session-1", epoch: 2)
    XCTAssertNil(model.link)
    XCTAssertNil(model.expiresAt)
    await model.prepare(apiURL: URL(string: "https://api.example.test")!) { self.grant() }
    XCTAssertNil(model.link, "An old-epoch response cannot create a reader link")
  }

  func testLateGrantAfterDisconnectCannotRestoreReader() async throws {
    let suite = "WebDisplayConnectionTests-\(UUID())"
    let defaults = try XCTUnwrap(UserDefaults(suiteName: suite))
    defer { defaults.removePersistentDomain(forName: suite) }
    let model = WebDisplayConnection(defaults: defaults, now: { self.now })
    model.appURLText = "https://display.example.test"
    model.updateSession(id: "session-1", epoch: 1)
    var pending: CheckedContinuation<DisplayGrant, Never>?
    let task = Task {
      await model.prepare(apiURL: URL(string: "https://api.example.test")!) {
        await withCheckedContinuation { pending = $0 }
      }
    }
    while pending == nil { await Task.yield() }
    model.updateSession(id: nil, epoch: nil)
    pending?.resume(returning: grant())
    await task.value
    XCTAssertNil(model.link)
    XCTAssertFalse(model.isPreparing)
  }
}
