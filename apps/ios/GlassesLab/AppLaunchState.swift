/// Hosted unit tests need the application executable, but not its hardware connections.
/// Keep configuration and model construction behind the same gate: the DAT SDK traps if
/// any model accesses its singleton after configuration has failed.
enum AppLaunchState<Runtime> {
  case testHost
  case ready(Runtime)
  case failed(String)

  @MainActor
  static func start(isRunningTests: Bool, configure: () throws -> Void,
                    makeRuntime: () -> Runtime) -> Self {
    guard !isRunningTests else { return .testHost }
    do {
      try configure()
      return .ready(makeRuntime())
    } catch {
      return .failed(String(describing: error))
    }
  }
}
