import MWDATCore
import SwiftUI

/// Registration with Meta AI and every pair the SDK reports, with its raw device state.
struct MetaAISection: View {
  let wearables: WearablesModel

  var body: some View {
    Section {
      LabeledContent("Meta AI registration", value: registrationLabel)
      if wearables.registration == .registered {
        Button("Disconnect from Meta AI", role: .destructive) {
          Task { await wearables.unregister() }
        }
      } else {
        Button("Connect to Meta AI") {
          Task { await wearables.register() }
        }
        .disabled(wearables.registration == .registering)
      }
      if wearables.devices.isEmpty {
        Text("No glasses found")
          .foregroundStyle(.factoTextSecondary)
      }
      ForEach(wearables.devices) { device in
        VStack(alignment: .leading, spacing: FactoSpacing.xxs) {
          Text(device.name)
            .font(.onest(.headline, weight: .semibold))
          Text("\(device.link)\(device.hasDisplay ? " · display" : "")")
            .font(.onest(.subheadline))
            .foregroundStyle(.factoTextSecondary)
          Text(device.details)
            .font(.caption.monospaced())
            .foregroundStyle(.factoTextSecondary)
            .textSelection(.enabled)
          if device.needsUpdate {
            Button("Firmware update required") {
              Task { await wearables.openFirmwareUpdate() }
            }
          }
        }
      }
      if let error = wearables.lastError {
        Label(error, systemImage: "exclamationmark.triangle")
          .font(.onest(.footnote))
      }
    } header: {
      SettingsHeader("Meta AI")
    } footer: {
      SettingsFooter("Opens the Meta AI app. Turn on Developer Mode there first.")
    }
  }

  private var registrationLabel: String {
    switch wearables.registration {
    case .registered: "Registered"
    case .registering: "Registering…"
    case .available: "Not registered"
    case .unavailable: "Unavailable"
    }
  }
}
