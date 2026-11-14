import MWDATCore
import SwiftUI

/// The app's root: the home screen, the Settings sheet, and the wiring that connects the
/// backend and the display without a tap.
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
  /// Re-armed each time the glasses disconnect, so the display connects once per connection.
  @State private var displayAutoConnectArmed = true

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
    .onChange(of: wearables.glassesLink) { _, link in
      if link != .connected { displayAutoConnectArmed = true }
    }
    .task(id: shouldConnectDisplay) {
      guard shouldConnectDisplay, displayAutoConnectArmed else { return }
      // The display session picks its device through the SDK's own device list, which can
      // lag the link change by a moment. Connecting at once fails with "No eligible device".
      try? await Task.sleep(for: Self.displaySettleDelay)
      guard !Task.isCancelled, shouldConnectDisplay, displayAutoConnectArmed else { return }
      displayAutoConnectArmed = false
      display.connect()
    }
  }

  private static let displaySettleDelay: Duration = .seconds(1.5)

  /// Display glasses just connected and the display session is idle without an error. After
  /// an error the Developer screen's Connect display button retries.
  private var shouldConnectDisplay: Bool {
    wearables.glassesLink == .connected
      && wearables.hasDisplayGlasses
      && display.sessionState == .idle
      && display.lastError == nil
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
