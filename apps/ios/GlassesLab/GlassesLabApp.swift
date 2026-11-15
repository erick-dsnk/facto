import MWDATCore
import SwiftUI

@main
struct GlassesLabApp: App {
  @State private var launch: AppLaunchState<GlassesLabRuntime>

  init() {
    _launch = State(initialValue: AppLaunchState.start(
      isRunningTests: DebugLog.isRunningTests,
      configure: {
        let debugLog = DebugLog.shared
        debugLog.startAutomaticPruning()
        let info = Bundle.main.infoDictionary
        debugLog.log("app.launch", [
          "version": info?["CFBundleShortVersionString"] as Any,
          "build": info?["CFBundleVersion"] as Any,
          "os": ProcessInfo.processInfo.operatingSystemVersionString,
        ])
        do {
          try Wearables.configure()
        } catch {
          NSLog("[GlassesLab] Wearables.configure failed: \(error)")
          throw error
        }
      },
      makeRuntime: { GlassesLabRuntime() }
    ))
  }

  var body: some Scene {
    WindowGroup {
      switch launch {
      case .testHost:
        // XCTest supplies its own fakes; starting the SDK here would require device
        // registration before the test bundle can even connect to its host process.
        Color.clear
      case .failed(let message):
        ContentUnavailableView {
          Label("Glasses connection unavailable", systemImage: "exclamationmark.triangle")
        } description: {
          Text("The glasses connection could not start. Close and reopen the app. If this continues, check Meta AI and Developer Mode.")
          Text(message).font(.caption)
        }
      case .ready(let runtime):
        GlassesLabRootView(wearables: runtime.wearables, camera: runtime.camera,
                           display: runtime.display, audioLab: runtime.audioLab, live: runtime.live,
                           networkRecovery: runtime.networkRecovery)
      }
    }
  }
}

/// Constructed only after successful SDK configuration. Keep audio and network startup
/// inside the live branch too, so the hosted tests do not acquire any device resources.
@MainActor
private struct GlassesLabRuntime {
  let wearables: WearablesModel
  let camera: CameraModel
  let display: DisplayModel
  let audioLab: AudioLabModel
  let live: LiveModel
  let networkRecovery: NativeNetworkRecovery

  init() {
    let camera = CameraModel()
    let display = DisplayModel()
    self.wearables = WearablesModel()
    self.camera = camera
    self.display = display
    self.audioLab = AudioLabModel()
    self.live = LiveModel(camera: camera, display: display)
    self.networkRecovery = NativeNetworkRecovery()
  }
}

private struct GlassesLabRootView: View {
  let wearables: WearablesModel
  let camera: CameraModel
  let display: DisplayModel
  let audioLab: AudioLabModel
  let live: LiveModel
  let networkRecovery: NativeNetworkRecovery
  @Environment(\.scenePhase) private var scenePhase

  var body: some View {
    ContentView(wearables: wearables, camera: camera, display: display, audioLab: audioLab, live: live)
      .task {
        networkRecovery.start { Task { await live.restoreConnection() } }
        display.setRecoveryAvailability(active: scenePhase == .active, authorized: wearables.registration == .registered)
        await live.setGlassesAuthorized(wearables.registration == .registered && !wearables.devices.isEmpty)
        await live.setAppActive(scenePhase == .active)
      }
      .onChange(of: scenePhase) { _, phase in
        display.setRecoveryAvailability(active: phase == .active, authorized: wearables.registration == .registered)
        Task { await live.setAppActive(phase == .active) }
      }
      .onChange(of: wearables.registration) { _, registration in
        display.setRecoveryAvailability(active: scenePhase == .active, authorized: registration == .registered)
        Task { await live.setGlassesAuthorized(registration == .registered && !wearables.devices.isEmpty) }
      }
      .onChange(of: wearables.devices.isEmpty) { _, empty in
        Task { await live.setGlassesAuthorized(wearables.registration == .registered && !empty) }
      }
      .onOpenURL { url in
        // Meta AI calls back here after registration and permission prompts.
        guard
          let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
          components.queryItems?.contains(where: { $0.name == "metaWearablesAction" }) == true
        else { return }
        Task {
          do {
            _ = try await Wearables.shared.handleUrl(url)
          } catch {
            wearables.lastError = error.localizedDescription
          }
        }
      }
  }
}
