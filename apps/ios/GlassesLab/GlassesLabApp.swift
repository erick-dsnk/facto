import MWDATCore
import SwiftUI

@main
struct GlassesLabApp: App {
  @State private var wearables: WearablesModel
  @State private var camera: CameraModel
  @State private var display: DisplayModel
  @State private var audioLab = AudioLabModel()
  @State private var live: LiveModel

  init() {
    FactoTheme.configureAppearance()
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
