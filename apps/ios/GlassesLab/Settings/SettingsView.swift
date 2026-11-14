import SwiftUI

/// The gear sheet: output, camera quality, the join code, the backend URL and the Developer
/// screen. Changes to the join code or the URL apply when the sheet closes (ContentView).
struct SettingsView: View {
  @Bindable var live: LiveModel
  let wearables: WearablesModel
  let camera: CameraModel
  let display: DisplayModel
  let audioLab: AudioLabModel

  @Environment(\.dismiss) private var dismiss

  var body: some View {
    NavigationStack {
      Form {
        Section {
          Toggle("Mute", isOn: $live.isMuted)
            .factoToggleTint()
        } header: {
          SettingsHeader("Output")
        } footer: {
          SettingsFooter("No speech or chimes. Cards still show on the lens.")
        }
        .factoRowBackground()

        Section {
          Toggle("Automatic alerts", isOn: $live.automaticAlerts)
            .factoToggleTint()
        } footer: {
          SettingsFooter("Facto chimes and shows a card when it hears a false claim nearby.")
        }
        .factoRowBackground()

        Section {
          Toggle("Wake on “\(WakePhrase.spoken)”", isOn: $live.wakeWordEnabled)
            .factoToggleTint()
        } footer: {
          SettingsFooter(
            "The glasses stay off and nothing is sent until this phone hears “\(WakePhrase.spoken)”. Then Facto listens for a minute. Say “\(WakePhrase.spokenCommand)” to check what you’re looking at."
          )
        }
        .factoRowBackground()

        Section {
          Toggle("Demo quality", isOn: $live.demoQuality)
            .factoToggleTint()
            .disabled(camera.isStreaming)
        } header: {
          SettingsHeader("Camera")
        } footer: {
          SettingsFooter(
            "On: \(StreamQuality.demo.summary). Off: \(StreamQuality.listening.summary). Applies when the stream starts."
          )
        }
        .factoRowBackground()

        Section {
          SecureField("Join code", text: $live.joinCode)
            .textContentType(.password)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
        } header: {
          SettingsHeader("Join code")
        } footer: {
          SettingsFooter("Enter it once. Facto keeps it in this phone’s Keychain and connects on launch.")
        }
        .factoRowBackground()

        Section {
          TextField("Backend URL", text: $live.baseURLText)
            .keyboardType(.URL)
            .textContentType(.URL)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
          Button("Use default URL") {
            live.baseURLText = BackendConfig.defaultBaseURL.absoluteString
          }
          .disabled(isDefaultURL)
        } header: {
          SettingsHeader("Advanced")
        } footer: {
          SettingsFooter("Default: \(BackendConfig.defaultBaseURL.absoluteString)")
        }
        .factoRowBackground()

        Section {
          NavigationLink {
            DeveloperView(wearables: wearables, camera: camera, display: display, audioLab: audioLab, live: live)
          } label: {
            Text("Developer")
          }
        } footer: {
          SettingsFooter("Glasses diagnostics, camera tests and the debug log.")
        }
        .factoRowBackground()

        Section {
        } footer: {
          SettingsFooter("Facto \(Self.version) (\(Self.build))")
            .frame(maxWidth: .infinity)
        }
      }
      .navigationTitle("Settings")
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .confirmationAction) {
          Button("Done") { dismiss() }
        }
      }
      .factoScreen()
    }
  }

  private var isDefaultURL: Bool {
    live.baseURLText.trimmingCharacters(in: .whitespacesAndNewlines) == BackendConfig.defaultBaseURL.absoluteString
  }

  private static let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "?"
  private static let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "?"
}

/// A Facto form section title: Onest, sentence case, secondary text.
struct SettingsHeader: View {
  let title: String

  init(_ title: String) {
    self.title = title
  }

  var body: some View {
    Text(title)
      .font(.onest(.footnote, weight: .semibold))
      .foregroundStyle(.factoTextSecondary)
      .textCase(nil)
  }
}

/// A Facto form section footer: Onest footnote in secondary text.
struct SettingsFooter: View {
  let text: String

  init(_ text: String) {
    self.text = text
  }

  var body: some View {
    Text(text)
      .font(.onest(.footnote))
      .foregroundStyle(.factoTextSecondary)
  }
}

extension View {
  /// Form and list rows tinted from the text colour, so they read as one surface on the
  /// off-white (or mahogany) screen in both modes.
  func factoRowBackground() -> some View {
    listRowBackground(Color.factoHairline.opacity(0.5))
  }

  /// Toggle track colour when on: mahogany in light mode. In dark mode, off-white at half
  /// strength, so the white thumb still stands out against the track.
  func factoToggleTint() -> some View {
    tint(Color(uiColor: UIColor { traits in
      traits.userInterfaceStyle == .dark ? FactoPalette.offWhite.withAlphaComponent(0.5) : FactoPalette.mahogany
    }))
  }
}
