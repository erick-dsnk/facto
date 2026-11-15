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

  /// Which glasses the wearer is using. Each kind runs a different setup:
  /// - `display` (Meta Ray-Ban Display): result cards on the lens, listening through the
  ///   glasses' Bluetooth mic, photos from a stream that runs only for the photo (a running
  ///   camera stream holds back the lens and draws a viewfinder).
  /// - `rayBanMeta`: no lens, so answers are spoken; listening and photos go through a quiet
  ///   camera stream, whose mic hears nearby voices best.
  /// - `none`: no pair is worn or unfolded; nothing opens a session on its own.
  enum Kind: String {
    case none, rayBanMeta, display

    var label: String {
      switch self {
      case .none: "No glasses on"
      case .rayBanMeta: "Ray-Ban Meta: answers are spoken"
      case .display: "Meta Ray-Ban Display: answers show on the lens"
      }
    }
  }

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
  /// The glasses in use, kept current from each pair's wear, hinge and link state.
  private(set) var kind: Kind = .none
  /// The pair in use reports being on the wearer's face. A Display pair that isn't worn
  /// refuses every session with "Device unavailable", and nobody would see the lens anyway.
  private(set) var pairWorn = false
  @ObservationIgnored private var kindObservers: [@MainActor (Kind) -> Void] = []
  /// How long a new reading of the pair in use must hold before it counts. A failing session
  /// briefly drops the link, and acting on each flicker restarted the lens retries every second.
  static let settleDelay: Duration = .milliseconds(1500)
  private struct InUse: Equatable {
    var kind: Kind
    var worn: Bool
  }
  @ObservationIgnored private var settling: InUse?
  @ObservationIgnored private var settleTask: Task<Void, Never>?
  /// One state listener per registered pair, kept here rather than in a ListenerTokenBag: the
  /// bag's clear and insert are separate actor hops, so a late clear could drop new listeners.
  @ObservationIgnored private var deviceListeners: [DeviceIdentifier: any AnyListenerToken] = [:]
  @ObservationIgnored private var devicesTask: Task<Void, Never>?

  @ObservationIgnored private var holders: [Holder: Handlers] = [:]
  @ObservationIgnored private var holderObservers: [@MainActor () -> Void] = []
  /// Set when the session starts winding down; cleared once it has stopped.
  @ObservationIgnored private var stoppingSince: Date?

  /// The session is stopping. `acquire` refuses until it has stopped; observers hear
  /// `observeHolders` then, and `waitUntilStopped()` returns.
  /// After 3 s it no longer counts, and the next `acquire` drops the stuck session.
  var isWindingDown: Bool {
    guard session != nil, let stoppingSince else { return false }
    return Date().timeIntervalSince(stoppingSince) <= 3
  }

  /// Waits (up to `limit`) for a stopping session to finish, so the next `acquire` opens a
  /// fresh one. Stops take 150 to 450 ms on the glasses.
  func waitUntilStopped(limit: Duration = .seconds(2)) async {
    let clock = ContinuousClock()
    let deadline = clock.now + limit
    while isWindingDown, clock.now < deadline {
      try? await Task.sleep(for: .milliseconds(50))
    }
  }

  /// The camera is on the session (on Display glasses, a photo). Its stream holds back the lens,
  /// so the lens steps aside until the camera leaves.
  var cameraHolds: Bool { holders[.camera] != nil }

  /// Calls `handler` after the camera or the display joins or leaves the session.
  func observeHolders(_ handler: @escaping @MainActor () -> Void) {
    holderObservers.append(handler)
  }

  /// Asynchronous, so an observer can acquire or release without re-entering the caller.
  private func holdersChanged() {
    let observers = holderObservers
    Task { @MainActor in observers.forEach { $0() } }
  }
  @ObservationIgnored private let tokens = ListenerTokenBag()

  private struct Handlers {
    let onState: (DeviceSessionState) -> Void
    let onError: (String) -> Void
  }

  private init() {
    watch(Wearables.shared.devices)
    devicesTask = Task { [weak self] in
      for await identifiers in Wearables.shared.devicesStream() {
        guard let self else { return }
        self.watch(identifiers)
      }
    }
  }

  /// Calls `handler` whenever `kind` or `pairWorn` changes (the wearer swaps, folds, puts on or
  /// takes off glasses), once the change has held for `settleDelay`.
  func observeKind(_ handler: @escaping @MainActor (Kind) -> Void) {
    kindObservers.append(handler)
  }

  /// "Session ended by device": the glasses closed the session, usually because the wearer
  /// pressed back. The SDK reports it only as `unexpectedError(description:)`.
  nonisolated static func isEndedByDevice(_ message: String) -> Bool {
    message.localizedCaseInsensitiveContains("ended by device")
  }

  /// Follows every registered pair: putting glasses on, taking them off or folding them changes
  /// which pair is in use.
  private func watch(_ identifiers: [DeviceIdentifier]) {
    let current = Set(identifiers)
    for (identifier, token) in deviceListeners where !current.contains(identifier) {
      deviceListeners[identifier] = nil
      Task { await token.cancel() }
    }
    for identifier in identifiers where deviceListeners[identifier] == nil {
      guard let device = Wearables.shared.deviceForIdentifier(identifier) else { continue }
      deviceListeners[identifier] = device.addDeviceStateListener { [weak self] _ in
        Task { @MainActor in self?.refreshKind() }
      }
    }
    refreshKind()
  }

  /// Publishes a new pair in use only after it has held for `settleDelay`.
  private func refreshKind() {
    let observed = Self.inUse(Self.pairInUse(Self.pairs()))
    guard observed != InUse(kind: kind, worn: pairWorn) else {
      settling = nil
      settleTask?.cancel()
      settleTask = nil
      return
    }
    guard observed != settling else { return }
    settling = observed
    settleTask?.cancel()
    settleTask = Task { [weak self] in
      try? await Task.sleep(for: Self.settleDelay)
      guard !Task.isCancelled, let self else { return }
      self.settleTask = nil
      self.settling = nil
      let pick = Self.pairInUse(Self.pairs())
      let current = Self.inUse(pick)
      // Changed again while settling: start over from the newest reading.
      guard current == observed else { return self.refreshKind() }
      self.kind = current.kind
      self.pairWorn = current.worn
      NSLog("[glasses] in use: %@ worn=%d (%@)", current.kind.rawValue, current.worn, pick?.nameOrId() ?? "none")
      DebugLog.shared.log("glasses.kind", ["kind": current.kind.rawValue, "worn": current.worn, "device": pick?.nameOrId() ?? "none"])
      self.kindObservers.forEach { $0(current.kind) }
    }
  }

  private static func inUse(_ pick: Device?) -> InUse {
    // Only a pair that says it's off the face counts as not worn (mock glasses report unknown).
    InUse(kind: pick.map { $0.supportsDisplay() ? .display : .rayBanMeta } ?? .none, worn: pick.map { $0.donState != .doffed } ?? false)
  }

  private static func pairs() -> [Device] {
    Wearables.shared.devices.compactMap { Wearables.shared.deviceForIdentifier($0) }
  }

  /// The pair the wearer is using: a worn, connected pair (a Display pair first among them), or
  /// when none reports being worn, a connected pair that is unfolded. The pair on the face wins,
  /// so a Display pair left on and charging never takes the photo while Ray-Ban Meta are worn.
  /// Folded glasses refuse sessions with "Device unavailable", so they never count unless worn.
  private static func pairInUse(_ pairs: [Device]) -> Device? {
    let connected = pairs.filter { $0.linkState == .connected }
    let worn = connected.filter { $0.donState == .donned }
    let pool = worn.isEmpty ? connected.filter { $0.hingeState != .closed } : worn
    return pool.first(where: { $0.supportsDisplay() }) ?? pool.first
  }

  /// Joins the running session, or creates and starts one. The holder hears every later state
  /// change and error; read `state` right after for the current one (a joined session may
  /// already be started).
  func acquire(
    _ holder: Holder,
    onState: @escaping (DeviceSessionState) -> Void,
    onError: @escaping (String) -> Void
  ) throws -> DeviceSession {
    if let stoppingSince, session != nil {
      // A stop that never reported `.stopped`: give up on it so the glasses aren't stuck.
      guard Date().timeIntervalSince(stoppingSince) > 3 else { throw DeviceSessionError.sessionAlreadyExists }
      NSLog("[glasses] stopping session never stopped; dropping it")
      DebugLog.shared.log("glasses.session_stuck", ["holders": holders.keys.map { "\($0)" }])
      let current = Array(holders.values)
      reset()
      current.forEach { $0.onState(.stopped) }
    }
    if let session, state != .stopping, state != .stopped {
      // The lens only makes sense on a Display pair: don't attach it to Ray-Ban Meta.
      if holder == .display, session.device?.supportsDisplay() == false { throw DeviceSessionError.noEligibleDevice }
      holders[holder] = Handlers(onState: onState, onError: onError)
      holdersChanged()
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
    holdersChanged()
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

  /// True when the open session runs on glasses with a display (Meta Ray-Ban Display).
  var sessionHasDisplay: Bool { session?.device?.supportsDisplay() ?? false }

  /// Whether photos and listening should follow the Display setup: the open session's pair when
  /// there is one, otherwise the pair in use.
  var usesDisplaySetup: Bool { session?.device.map { $0.supportsDisplay() } ?? (kind == .display) }

  /// The pair to open the session on (`pairInUse`). With two registered pairs,
  /// AutoDeviceSelector can pick one that isn't nearby, and the session then fails with
  /// "device unavailable". Logs every pair's state, since a pair that is folded, not worn or
  /// too hot also refuses sessions.
  private func preferredPair(for holder: Holder, log: Bool = true) -> Device? {
    let pairs = Self.pairs()
    for device in pairs where log {
      let row = "name=\(device.nameOrId()) link=\(device.linkState) display=\(device.supportsDisplay()) "
        + "don=\(device.donState) hinge=\(device.hingeState) thermal=\(device.thermalLevel) "
        + "compat=\(device.compatibility()) type=\(device.deviceType())"
      NSLog("[glasses] pair %@", row)
      DebugLog.shared.log("glasses.pair", ["state": row])
    }
    guard let pick = Self.pairInUse(pairs) else {
      if log { NSLog("[glasses] %@: no connected pair, letting the SDK choose", "\(holder)") }
      return nil
    }
    guard log else { return pick }
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
      // Winding down from now, not from when the SDK reports `.stopping`: a camera or lens
      // acquiring in between would join a dying session, or open a second one the glasses refuse.
      stoppingSince = Date()
      session?.stop()
      return true
    }
    holders[holder] = nil
    holdersChanged()
    return false
  }

  private func handle(_ newState: DeviceSessionState, from source: DeviceSession) {
    guard source === session else { return }
    NSLog("[glasses] session state %@", "\(newState)")
    DebugLog.shared.log("glasses.session_state", ["state": "\(newState)", "holders": holders.keys.map { "\($0)" }])
    state = newState
    if newState == .stopping, stoppingSince == nil { stoppingSince = Date() }
    if newState == .started { needsGlassesAppUpdate = false }
    let current = Array(holders.values)
    if newState == .stopped { reset() }
    current.forEach { $0.onState(newState) }
  }

  private func reset() {
    tokens.clear()
    stoppingSince = nil
    session = nil
    state = .idle
    holders = [:]
    holdersChanged()
  }
}
