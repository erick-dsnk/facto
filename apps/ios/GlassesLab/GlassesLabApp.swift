import MWDATCore
import SwiftUI

@main
struct GlassesLabApp: App {
  @State private var wearables: WearablesModel
  @State private var camera: CameraModel
  @State private var display: DisplayModel
  @State private var audioLab = AudioLabModel()

  init() {
    do {
      try Wearables.configure()
    } catch {
      NSLog("[GlassesLab] Wearables.configure failed: \(error)")
    }
    // The models use Wearables.shared, so they are created after configure().
    _wearables = State(initialValue: WearablesModel())
    _camera = State(initialValue: CameraModel())
    _display = State(initialValue: DisplayModel())
  }

  var body: some Scene {
    WindowGroup {
      ContentView(wearables: wearables, camera: camera, display: display, audioLab: audioLab)
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
