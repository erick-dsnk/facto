import AVFoundation
import MWDATCore
import MWDATMockDevice
import Observation

/// Registration with Meta AI, the device list, and the simulated glasses.
@Observable
@MainActor
final class WearablesModel {
  struct DeviceRow: Identifiable {
    let id: DeviceIdentifier
    let name: String
    let link: String
    let hasDisplay: Bool
    let needsUpdate: Bool
    /// Type, compatibility, wear, hinge, battery and thermal, as the SDK reports them.
    let details: String
  }

  enum MockModel: String, CaseIterable, Identifiable {
    case rayBanMeta = "Ray-Ban Meta"
    case display = "Meta Ray-Ban Display"
    var id: String { rawValue }
  }

  /// How far the glasses are from being usable, for the home screen.
  enum GlassesLink: Equatable {
    /// Facto isn't registered with Meta AI yet.
    case notRegistered
    /// Registration is open in Meta AI.
    case registering
    /// Registered, but no pair is connected or connecting.
    case noGlasses
    case connecting
    case connected
  }

  var registration: RegistrationState
  var devices: [DeviceRow] = []
  var lastError: String?

  var glassesLink: GlassesLink {
    if mockModel != nil || devices.contains(where: { $0.link == Self.connectedLink }) { return .connected }
    switch registration {
    case .registered: return devices.contains { $0.link == Self.connectingLink } ? .connecting : .noGlasses
    case .registering: return .registering
    case .available, .unavailable: return .notRegistered
    }
  }

  /// A simulated Display, or connected glasses with a display (Meta Ray-Ban Display).
  var hasDisplayGlasses: Bool {
    mockModel == .display || devices.contains { $0.link == Self.connectedLink && $0.hasDisplay }
  }

  /// False when Meta AI can't take a registration, for example when it isn't installed.
  var canRegister: Bool {
    registration != .unavailable
  }

  /// Some pair needs a firmware update before it can connect.
  var needsFirmwareUpdate: Bool {
    devices.contains(where: \.needsUpdate)
  }

  private static let connectedLink = "Connected"
  private static let connectingLink = "Connecting"

  /// Non-nil while a simulated pair of glasses is active.
  var mockModel: MockModel?
  /// The simulated display surface, for the in-app preview.
  var mockDisplay: (any MockDisplayKit)?

  #if DEBUG
  var mockDisplayDeviceIdentifier: DeviceIdentifier? {
    mockModel == .display ? mockDevice?.deviceIdentifier : nil
  }
  private(set) var nativePreviewServerPort: UInt16?
  private(set) var nativePreviewServerBusy = false
  @ObservationIgnored private var nativePreviewServerOperation: Task<Void, Never>?
  @ObservationIgnored private var nativePreviewServerGeneration = UUID()

  /// The SDK's own HTTP preview server, as used by Meta's DisplayAccess sample.
  /// Operations serialize so stopping/re-pairing cannot leave an old start alive.
  func startNativePreviewServer() async {
    guard mockModel == .display, nativePreviewServerPort == nil, !nativePreviewServerBusy else { return }
    let previous = nativePreviewServerOperation
    let generation = UUID()
    nativePreviewServerGeneration = generation
    nativePreviewServerBusy = true
    let operation = Task { [weak self] in
      await previous?.value
      guard let self, self.nativePreviewServerGeneration == generation, self.mockModel == .display else { return }
      do {
        // Prefer 9000 as documented; fall back to a system-assigned port when it is taken.
        let port: UInt16
        do {
          port = try await MockDeviceKit.shared.startTestServer(port: 9000)
        } catch {
          port = try await MockDeviceKit.shared.startTestServer(port: 0)
        }
        guard self.nativePreviewServerGeneration == generation, self.mockModel == .display else {
          await MockDeviceKit.shared.stopTestServer()
          return
        }
        self.nativePreviewServerPort = port
      } catch {
        if self.nativePreviewServerGeneration == generation {
          self.lastError = "Native preview server: \(error.localizedDescription)"
        }
      }
      if self.nativePreviewServerGeneration == generation { self.nativePreviewServerBusy = false }
    }
    nativePreviewServerOperation = operation
    await operation.value
  }

  func stopNativePreviewServer() {
    guard nativePreviewServerOperation != nil || nativePreviewServerPort != nil else { return }
    let previous = nativePreviewServerOperation
    let generation = UUID()
    nativePreviewServerGeneration = generation
    nativePreviewServerPort = nil
    nativePreviewServerBusy = true
    nativePreviewServerOperation = Task { [weak self] in
      await previous?.value
      await MockDeviceKit.shared.stopTestServer()
      if self?.nativePreviewServerGeneration == generation { self?.nativePreviewServerBusy = false }
    }
  }
  #endif

  /// Newest first: registration, device and link changes with timestamps.
  var log: [String] = []

  @ObservationIgnored private var mockDevice: MockGlasses?
  @ObservationIgnored private var deviceIds: [DeviceIdentifier] = []
  @ObservationIgnored private var deviceTokens: [any AnyListenerToken] = []

  init() {
    registration = Wearables.shared.registrationState
    addLog("Start. Registration: \(String(describing: registration))")
    Task { [weak self] in
      for await state in Wearables.shared.registrationStateStream() {
        self?.registration = state
        self?.addLog("Registration: \(String(describing: state))")
      }
    }
    Task { [weak self] in
      for await ids in Wearables.shared.devicesStream() {
        self?.addLog("Device list: \(ids.count) pair(s)")
        await self?.watchDevices(ids)
      }
    }
  }

  func addLog(_ line: String) {
    let time = Date.now.formatted(date: .omitted, time: .standard)
    log.insert("\(time)  \(line)", at: 0)
    if log.count > 60 { log.removeLast(log.count - 60) }
  }

  /// Re-reads every device. Called on list changes, listener events and the Refresh button.
  func refreshNow() {
    refreshDevices(deviceIds)
  }

  /// Listens for link, compatibility and wear/battery changes on every pair, as Meta's
  /// BirdSpotter sample does, so the rows never show a stale state.
  private func watchDevices(_ ids: [DeviceIdentifier]) async {
    for token in deviceTokens { await token.cancel() }
    deviceTokens.removeAll()
    deviceIds = ids
    refreshDevices(ids)
    for id in ids {
      guard let device = Wearables.shared.deviceForIdentifier(id) else { continue }
      deviceTokens.append(device.addLinkStateListener { [weak self] state in
        Task { @MainActor in
          self?.addLog("Link: \(String(describing: state))")
          self?.refreshNow()
        }
      })
      deviceTokens.append(device.addCompatibilityListener { [weak self] compatibility in
        Task { @MainActor in
          self?.addLog("Compatibility: \(String(describing: compatibility))")
          self?.refreshNow()
        }
      })
      deviceTokens.append(device.addDeviceStateListener { [weak self] _ in
        Task { @MainActor in self?.refreshNow() }
      })
    }
  }

  // MARK: Registration

  func register() async {
    lastError = nil
    do {
      try await Wearables.shared.startRegistration()
    } catch {
      lastError = "Registration: \(error)"
    }
  }

  func unregister() async {
    lastError = nil
    do {
      try await Wearables.shared.startUnregistration()
    } catch {
      lastError = "Unregistration: \(error)"
    }
  }

  func openFirmwareUpdate() async {
    do {
      try await Wearables.shared.openFirmwareUpdate()
    } catch {
      lastError = "\(error)"
    }
  }

  /// Opens App Connections in Meta AI, where the app's copy on the glasses is updated.
  func openGlassesAppUpdate() async {
    do {
      try await Wearables.shared.openDATGlassesAppUpdate()
    } catch {
      lastError = "\(error)"
    }
  }

  private func refreshDevices(_ ids: [DeviceIdentifier]) {
    devices = ids.compactMap { id in
      guard let device = Wearables.shared.deviceForIdentifier(id) else { return nil }
      let link: String
      switch device.linkState {
      case .connected: link = Self.connectedLink
      case .connecting: link = Self.connectingLink
      case .disconnected: link = "Disconnected"
      @unknown default: link = "Unknown"
      }
      let battery = device.batteryLevel.map { "\($0)%" } ?? "?"
      let details = [
        "type \(String(describing: device.deviceType()))",
        "compat \(String(describing: device.compatibility()))",
        "worn \(String(describing: device.donState))",
        "hinge \(String(describing: device.hingeState))",
        "battery \(battery)",
        "thermal \(String(describing: device.thermalLevel))",
      ].joined(separator: " · ")
      return DeviceRow(
        id: id,
        name: device.name.isEmpty ? "Meta glasses" : device.name,
        link: link,
        hasDisplay: device.supportsDisplay(),
        needsUpdate: device.compatibility() == .deviceUpdateRequired,
        details: details
      )
    }
  }

  // MARK: Simulated glasses (MockDeviceKit)

  /// Pairs simulated glasses that are powered on, unfolded and worn, with the phone's
  /// back camera as their video feed. Registration and permissions start granted.
  func startMock(_ model: MockModel) async {
    stopMock()
    lastError = nil

    if AVCaptureDevice.authorizationStatus(for: .video) == .notDetermined {
      _ = await AVCaptureDevice.requestAccess(for: .video)
    }

    MockDeviceKit.shared.enable()
    do {
      let device = try MockDeviceKit.shared.pairGlasses(
        model: model == .display ? .metaRayBanDisplay : .rayBanMeta
      )
      device.powerOn()
      device.unfold()
      device.don()
      device.services.camera.setCameraFeed(cameraFacing: .back)
      mockDevice = device
      mockModel = model
      mockDisplay = model == .display ? device.services.display : nil
    } catch {
      await MockDeviceKit.shared.disable()
      lastError = "Mock pairing failed: \(error.localizedDescription)"
    }
  }

  func stopMock() {
    #if DEBUG
    stopNativePreviewServer()
    #endif
    if let mockDevice {
      MockDeviceKit.shared.unpairDevice(mockDevice)
      MockDeviceKit.shared.disable()
    }
    mockDevice = nil
    mockModel = nil
    mockDisplay = nil
  }

  /// Simulates a single touchpad tap (pauses or resumes an active stream).
  func mockTap() {
    mockDevice?.services.captouch.tap()
  }
}
