import XCTest
@testable import GlassesLab

@MainActor
final class AppLaunchStateTests: XCTestCase {
  func testHostedTestsDoNotConfigureSDKOrCreateHardwareModels() {
    var events: [String] = []
    let launch = AppLaunchState<String>.start(isRunningTests: true, configure: {
      events.append("configure")
    }, makeRuntime: {
      events.append("models")
      return "runtime"
    })

    guard case .testHost = launch else { return XCTFail("expected an inert test host") }
    XCTAssertTrue(events.isEmpty)
  }

  func testFailedConfigurationDoesNotCreateModels() {
    enum ConfigurationFailure: Error { case unavailable }
    var createdModels = false
    let launch = AppLaunchState<String>.start(isRunningTests: false, configure: {
      throw ConfigurationFailure.unavailable
    }, makeRuntime: {
      createdModels = true
      return "runtime"
    })

    guard case .failed(let message) = launch else { return XCTFail("expected configuration failure") }
    XCTAssertFalse(createdModels, "accessing Wearables.shared after a configuration failure traps")
    XCTAssertTrue(message.contains("unavailable"))
  }

  func testSuccessfulConfigurationCreatesModelsAfterSDKIsReady() {
    var events: [String] = []
    let launch = AppLaunchState<String>.start(isRunningTests: false, configure: {
      events.append("configure")
    }, makeRuntime: {
      events.append("models")
      return "runtime"
    })

    guard case .ready(let runtime) = launch else { return XCTFail("expected a ready runtime") }
    XCTAssertEqual(runtime, "runtime")
    XCTAssertEqual(events, ["configure", "models"])
  }
}
