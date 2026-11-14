import MWDATCore
import SwiftUI

@main
struct GlassesLabApp: App {
  @State private var wearables: WearablesModel
  @State private var camera: CameraModel
  @State private var display: DisplayModel
  @State private var audioLab = AudioLabModel()
  @State private var live: LiveModel
  @Environment(\.scenePhase) private var scenePhase
  private let networkRecovery = NativeNetworkRecovery()

  init() {
    do {
      try Wearables.configure()
    } catch {
      NSLog("[GlassesLab] Wearables.configure failed: \(error)")
    }
    // The models use Wearables.shared, so they are created after configure().
    let camera = CameraModel()
    let display = DisplayModel()
    _wearables = State(initialValue: WearablesModel())
    _camera = State(initialValue: camera)
    _display = State(initialValue: display)
    _live = State(initialValue: LiveModel(camera: camera, display: display))
  }

  var body: some Scene {
    WindowGroup {
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
}
