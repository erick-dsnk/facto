import MWDATCore
import SwiftUI

/// The app's root: the home screen, the Settings sheet, and the wiring that connects the
/// backend without a tap. The display reconnects by itself (DisplayModel recovery, fed by
/// GlassesLabApp's scene phase and registration).
struct ContentView: View {
  let wearables: WearablesModel
  let camera: CameraModel
  let display: DisplayModel
  let audioLab: AudioLabModel
  let live: LiveModel

  @Environment(\.scenePhase) private var scenePhase
  @State private var isShowingSettings = false
  /// The join code and URL when Settings opened, to tell whether they changed.
  @State private var settingsBaseline = BackendFields()

  var body: some View {
    NavigationStack {
      HomeView(wearables: wearables, live: live, display: display, onOpenSettings: openSettings)
    }
    .sheet(isPresented: $isShowingSettings, onDismiss: settingsClosed) {
      SettingsView(live: live, wearables: wearables, camera: camera, display: display, audioLab: audioLab)
    }
    .task { await live.connectIfConfigured() }
    .onChange(of: scenePhase) { _, phase in
      guard phase == .active else { return }
      Task { await live.connectIfConfigured() }
    }
  }

  private func openSettings() {
    settingsBaseline = BackendFields(live)
    isShowingSettings = true
  }

  /// A new join code or URL takes effect when Settings closes. An empty join code disconnects
  /// and is forgotten, so the next launch doesn't connect with the old one.
  private func settingsClosed() {
    let fields = BackendFields(live)
    guard fields != settingsBaseline else { return }
    Task {
      if fields.joinCode.isEmpty {
        await live.forgetJoinCode()
      } else {
        await live.reconnect()
      }
    }
  }
}

/// The backend settings the Settings sheet can change, trimmed.
private struct BackendFields: Equatable {
  var joinCode = ""
  var baseURL = ""

  init() {}

  @MainActor
  init(_ live: LiveModel) {
    joinCode = live.joinCode.trimmingCharacters(in: .whitespacesAndNewlines)
    baseURL = live.baseURLText.trimmingCharacters(in: .whitespacesAndNewlines)
  }
}
