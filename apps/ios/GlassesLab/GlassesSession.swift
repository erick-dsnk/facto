import Foundation
import MWDATCore
import Observation

/// The one device session the app holds with the glasses. The camera and the display are
/// capabilities on a session (`addCamera`, `addDisplay`), and the glasses refuse a second
/// session from the same app with "Session start failed: device unavailable". So
/// CameraModel and DisplayModel share this one: the first `acquire` creates and starts it,
/// later ones join it, and it stops when the last holder releases it.
@Observable
@MainActor
final class GlassesSession {
  enum Holder: Hashable { case camera, display }

  /// Shared by the camera and the display. Created on first use, which is after
  /// `Wearables.configure()` (the models are built after it).
  static let shared = GlassesSession()

  /// Created once and kept, as in Meta's CameraAccess sample: a selector made at tap time has
  /// not seen any device yet.
  @ObservationIgnored let deviceSelector = AutoDeviceSelector(wearables: Wearables.shared)

  @ObservationIgnored private(set) var session: DeviceSession?
  @ObservationIgnored private(set) var state: DeviceSessionState = .idle
  /// The glasses refused the session because their copy of the app is out of date. Home then
  /// offers "Update in Meta AI" (`Wearables.openDATGlassesAppUpdate()`). Cleared once a
  /// session starts.
  private(set) var needsGlassesAppUpdate = false

  @ObservationIgnored private var holders: [Holder: Handlers] = [:]
  @ObservationIgnored private let tokens = ListenerTokenBag()

  private struct Handlers {
    let onState: (DeviceSessionState) -> Void
    let onError: (String) -> Void
  }

  /// Joins the running session, or creates and starts one. The holder hears every later state
  /// change and error; read `state` right after for the current one (a joined session may
  /// already be started).
  func acquire(
    _ holder: Holder,
    onState: @escaping (DeviceSessionState) -> Void,
    onError: @escaping (String) -> Void
  ) throws -> DeviceSession {
    if let session, state != .stopping, state != .stopped {
      // The lens only makes sense on a Display pair: don't attach it to Ray-Ban Meta.
      if holder == .display, session.device?.supportsDisplay() == false { throw DeviceSessionError.noEligibleDevice }
      holders[holder] = Handlers(onState: onState, onError: onError)
      return session
    }
    let pick = preferredPair(for: holder)
    // Opening a session moves the phone onto the glasses' Wi-Fi and drops the backend for a
    // moment, so the display never opens one on glasses without a display (it retried every
    // ~30 s on Ray-Ban Meta and kept knocking the connection off).
    if holder == .display, pick?.supportsDisplay() != true { throw DeviceSessionError.noEligibleDevice }
    tokens.clear()
    let newSession = try Wearables.shared.createSession(
      deviceSelector: pick.map { SpecificDeviceSelector(device: $0.identifier) } ?? deviceSelector
    )
    session = newSession
    state = .starting
    holders = [holder: Handlers(onState: onState, onError: onError)]
    // Subscribe before start() so no transition is missed.
    newSession.statePublisher.listen { [weak self, weak newSession] state in
      Task { @MainActor in
        guard let self, let newSession else { return }
        self.handle(state, from: newSession)
      }
    }.store(in: tokens)
    newSession.errorPublisher.listen { [weak self] error in
      let message = error.localizedDescription
      let needsUpdate = error == .datAppOnTheGlassesUpdateRequired
      NSLog("[glasses] session error: %@ (%@)", message, String(describing: error))
      DebugLog.shared.log("glasses.session_error", ["message": message, "error": String(describing: error)])
      Task { @MainActor in
        if needsUpdate { self?.needsGlassesAppUpdate = true }
        self?.holders.values.forEach { $0.onError(message) }
      }
    }.store(in: tokens)
    do {
      try newSession.start()
    } catch {
      if (error as? DeviceSessionError) == .datAppOnTheGlassesUpdateRequired { needsGlassesAppUpdate = true }
      NSLog("[glasses] session start threw: %@", String(describing: error))
      DebugLog.shared.log("glasses.session_start_failed", ["error": String(describing: error)])
      reset()
      throw error
    }
    return newSession
  }

  /// The pair to open the session on: a worn, connected pair first (a Display pair among them
  /// first), then a connected Display pair, then any connected pair. With two registered
  /// pairs, AutoDeviceSelector can pick one that isn't nearby, and the session then fails
  /// with "device unavailable". Logs every pair's
  /// state, since a pair that is folded, not worn or too hot also refuses sessions.
  /// True when the open session runs on glasses with a display (Meta Ray-Ban Display).
  var sessionHasDisplay: Bool { session?.device?.supportsDisplay() ?? false }

  private func preferredPair(for holder: Holder) -> Device? {
    let pairs = Wearables.shared.devices.compactMap { Wearables.shared.deviceForIdentifier($0) }
    for device in pairs {
      let row = "name=\(device.nameOrId()) link=\(device.linkState) display=\(device.supportsDisplay()) "
        + "don=\(device.donState) hinge=\(device.hingeState) thermal=\(device.thermalLevel) "
        + "compat=\(device.compatibility()) type=\(device.deviceType())"
      NSLog("[glasses] pair %@", row)
      DebugLog.shared.log("glasses.pair", ["state": row])
    }
    let connected = pairs.filter { $0.linkState == .connected }
    // The pair on the wearer's face wins: a Display pair left on and charging must not take
    // the photo while the wearer has Ray-Ban Meta on. Among the worn pairs (or all connected
    // ones when none reports being worn), a Display pair goes first.
    let worn = connected.filter { $0.donState == .donned }
    let pool = worn.isEmpty ? connected : worn
    guard let pick = pool.first(where: { $0.supportsDisplay() }) ?? pool.first else {
      NSLog("[glasses] %@: no connected pair, letting the SDK choose", "\(holder)")
      return nil
    }
    NSLog("[glasses] %@: opening the session on %@", "\(holder)", pick.nameOrId())
    DebugLog.shared.log("glasses.session_pick", ["holder": "\(holder)", "device": pick.nameOrId(), "display": pick.supportsDisplay()])
    return pick
  }

  /// Leaves the session. Returns true when this holder was the last one: the session is then
  /// stopping, and the holder still hears `.stopped`. Returns false when another holder keeps
  /// it running; the caller stops its own capability and clears its state itself.
  @discardableResult
  func release(_ holder: Holder) -> Bool {
    guard holders[holder] != nil else { return false }
    if holders.count == 1 {
      session?.stop()
      return true
    }
    holders[holder] = nil
    return false
  }

  private func handle(_ newState: DeviceSessionState, from source: DeviceSession) {
    guard source === session else { return }
    NSLog("[glasses] session state %@", "\(newState)")
    DebugLog.shared.log("glasses.session_state", ["state": "\(newState)", "holders": holders.keys.map { "\($0)" }])
    state = newState
    if newState == .started { needsGlassesAppUpdate = false }
    let current = Array(holders.values)
    if newState == .stopped { reset() }
    current.forEach { $0.onState(newState) }
  }

  private func reset() {
    tokens.clear()
    session = nil
    state = .idle
    holders = [:]
  }
}
