import UIKit
import XCTest
@testable import GlassesLab

final class HomeStatusTests: XCTestCase {
  private let healthy = "Glasses connected · Online"

  /// Every state a broken setup can be in, each with the glasses connected and with them not.
  private var failures: [(WearablesModel.GlassesLink, LiveStatus, Bool)] {
    let backendFailures: [(LiveStatus, Bool)] = [
      (.offline, true), (.offline, false), (.connecting, true), (.startingToListen, true), (.reconnecting(attempt: 0), true),
      (.reconnecting(attempt: 2), true),
      (.listeningStopped(.glassesDisconnected), true), (.listeningStopped(.noConnection), true),
      (.listeningStopped(.sessionEnded(reasonCode: "deleted")), true),
      (.listeningStopped(.audioUnavailable(reasonCode: "asr_failed")), true),
      (.backendError(code: "network_lost"), true), (.backendError(code: "connect_failed"), true),
      (.backendError(code: "unauthorized"), true), (.backendError(code: "http_401"), true),
      (.backendError(code: "http_403"), true), (.backendError(code: "deleted"), true), (.backendError(code: "expired"), true),
      (.backendError(code: "connect_timeout"), true), (.backendError(code: "timed_out"), true),
      (.backendError(code: "invalid_url"), true), (.backendError(code: "insecure_url"), true),
      (.backendError(code: "missing_join_code"), true), (.backendError(code: "missing_join_code"), false),
      (.backendError(code: "internal_error"), true),
    ]
    let glassesFailures: [WearablesModel.GlassesLink] = [.notRegistered, .registering, .noGlasses, .connecting]
    return backendFailures.map { (.connected, $0.0, $0.1) }
      + glassesFailures.flatMap { link in
        [(link, LiveStatus.connected, true), (link, LiveStatus.listening, true)] + backendFailures.map { (link, $0.0, $0.1) }
      }
  }

  func testHealthyLine() {
    let status = HomeStatus.make(glasses: .connected, live: .connected, hasJoinCode: true)
    XCTAssertEqual(status.text, healthy)
    XCTAssertEqual(status.detail, "Tap Start listening, or Check this to read what’s in front of you.")
    XCTAssertEqual(status.tone, .good)
    XCTAssertNil(status.action)

    let listening = HomeStatus.make(glasses: .connected, live: .listening, hasJoinCode: true)
    XCTAssertEqual(listening.text, "Glasses connected · Listening")
    XCTAssertEqual(listening.detail, "No alert doesn’t mean a claim is true.")
    XCTAssertEqual(listening.tone, .good)
  }

  func testEveryFailureReadsDifferentlyFromTheHealthyLine() {
    for (glasses, live, hasJoinCode) in failures {
      let status = HomeStatus.make(glasses: glasses, live: live, hasJoinCode: hasJoinCode)
      let label = "\(glasses) \(live) joinCode=\(hasJoinCode)"
      XCTAssertNotEqual(status.text, healthy, label)
      XCTAssertTrue(status.tone == .bad || status.tone == .warning, label)
      XCTAssertFalse(status.detail.isEmpty, label)
    }
  }

  func testGlassesPart() {
    let expected: [(WearablesModel.GlassesLink, String)] = [
      (.connected, "Glasses connected"), (.connecting, "Glasses connecting…"), (.noGlasses, "Glasses not connected"),
      (.notRegistered, "Glasses not set up"), (.registering, "Glasses not set up"),
    ]
    for (link, text) in expected {
      XCTAssertEqual(HomeStatus.make(glasses: link, live: .connected, hasJoinCode: true).text, "\(text) · Online")
    }
  }

  func testBackendPart() {
    let expected: [(LiveStatus, Bool, String)] = [
      (.listening, true, "Listening"), (.startingToListen, true, "Starting to listen…"), (.connecting, true, "Connecting…"),
      (.reconnecting(attempt: 1), true, "Reconnecting…"), (.offline, true, "Offline"), (.offline, false, "Join code needed"),
      (.backendError(code: "missing_join_code"), true, "Join code needed"),
      (.backendError(code: "network_lost"), true, "Connection lost"), (.backendError(code: "connect_failed"), true, "Connection lost"),
      (.backendError(code: "unauthorized"), true, "Join code rejected"), (.backendError(code: "http_401"), true, "Join code rejected"),
      (.backendError(code: "http_403"), true, "Join code rejected"), (.backendError(code: "deleted"), true, "Session ended"),
      (.backendError(code: "expired"), true, "Session ended"), (.backendError(code: "connect_timeout"), true, "Backend not responding"),
      (.backendError(code: "timed_out"), true, "Backend not responding"),
      (.backendError(code: "invalid_url"), true, "Backend URL not valid"),
      (.backendError(code: "insecure_url"), true, "Backend URL needs https"),
      (.backendError(code: "internal_error"), true, "Backend error"),
      (.listeningStopped(.glassesDisconnected), true, "Listening stopped: glasses disconnected"),
      (.listeningStopped(.noConnection), true, "Listening stopped: no connection"),
      (.listeningStopped(.sessionEnded(reasonCode: "expired")), true, "Listening stopped: session ended"),
      (.listeningStopped(.audioUnavailable(reasonCode: "asr_failed")), true, "Listening stopped: mic unavailable"),
    ]
    for (live, hasJoinCode, text) in expected {
      XCTAssertEqual(HomeStatus.make(glasses: .connected, live: live, hasJoinCode: hasJoinCode).text, "Glasses connected · \(text)")
    }
  }

  func testDetailLines() {
    func detail(_ live: LiveStatus, joinCode: Bool = true) -> String {
      HomeStatus.make(glasses: .connected, live: live, hasJoinCode: joinCode).detail
    }
    XCTAssertEqual(detail(.startingToListen), "Waiting for the glasses stream and the backend.")
    XCTAssertEqual(detail(.connecting), "Opening a session.")
    XCTAssertEqual(detail(.reconnecting(attempt: 2)), "Connection dropped. Attempt 2 of 3.")
    XCTAssertEqual(detail(.reconnecting(attempt: 0)), "Connection dropped.")
    XCTAssertEqual(detail(.offline), "Tap Reconnect to go online.")
    XCTAssertEqual(detail(.offline, joinCode: false), "Add your join code in Settings.")
    XCTAssertEqual(detail(.backendError(code: "missing_join_code")), "Add your join code in Settings.")
    XCTAssertEqual(detail(.backendError(code: "network_lost")), "Reason: network_lost.")
    XCTAssertEqual(detail(.listeningStopped(.noConnection)), "Tap Start listening to try again.")
  }

  func testActions() {
    func action(_ live: LiveStatus, joinCode: Bool = true) -> HomeStatus.Action? {
      HomeStatus.make(glasses: .connected, live: live, hasJoinCode: joinCode).action
    }
    XCTAssertEqual(action(.offline), .reconnect)
    for code in ["network_lost", "connect_failed", "connect_timeout", "timed_out", "deleted", "expired", "internal_error"] {
      XCTAssertEqual(action(.backendError(code: code)), .reconnect, code)
    }
    XCTAssertEqual(action(.offline, joinCode: false), .openSettings)
    for code in ["missing_join_code", "unauthorized", "http_401", "http_403", "invalid_url", "insecure_url"] {
      XCTAssertEqual(action(.backendError(code: code)), .openSettings, code)
    }
    for live: LiveStatus in [.connected, .listening, .connecting, .startingToListen, .reconnecting(attempt: 1), .listeningStopped(.noConnection)] {
      XCTAssertNil(action(live), "\(live)")
    }
    XCTAssertEqual(HomeStatus.Action.reconnect.title, "Reconnect")
    XCTAssertEqual(HomeStatus.Action.openSettings.title, "Open Settings")
  }

  /// A fresh install: no glasses registered and no join code.
  func testFreshInstall() {
    let status = HomeStatus.make(glasses: .notRegistered, live: .offline, hasJoinCode: false)
    XCTAssertEqual(status.text, "Glasses not set up · Join code needed")
    XCTAssertEqual(status.action, .openSettings)
    XCTAssertEqual(status.tone, .warning)
  }

  /// The setup card below the line explains the glasses; the line doesn't point at the
  /// listening buttons the home screen hides until they connect.
  func testOnlineWithoutGlassesPointsAtTheGlasses() {
    let status = HomeStatus.make(glasses: .noGlasses, live: .connected, hasJoinCode: true)
    XCTAssertFalse(status.detail.contains("Start listening"))
    XCTAssertEqual(status.symbol, "eyeglasses")
    XCTAssertEqual(status.tone, .warning)
    XCTAssertNil(status.action)
  }

  func testSymbolsExist() {
    for (glasses, live, hasJoinCode) in failures + [(.connected, .connected, true), (.connected, .listening, true)] {
      let symbol = HomeStatus.make(glasses: glasses, live: live, hasJoinCode: hasJoinCode).symbol
      XCTAssertNotNil(UIImage(systemName: symbol), symbol)
    }
  }
}
