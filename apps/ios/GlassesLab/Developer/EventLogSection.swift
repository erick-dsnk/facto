import SwiftUI

/// Registration, device and link changes with timestamps, newest first.
struct EventLogSection: View {
  let wearables: WearablesModel

  var body: some View {
    Section {
      Button("Refresh device state") { wearables.refreshNow() }
      if wearables.log.isEmpty {
        Text("No events yet")
          .foregroundStyle(.factoTextSecondary)
      }
      ForEach(Array(wearables.log.enumerated()), id: \.offset) { _, line in
        Text(line)
          .font(.caption.monospaced())
          .textSelection(.enabled)
      }
    } header: {
      SettingsHeader("Event log")
    } footer: {
      SettingsFooter("Newest first. Take a screenshot of this section if the glasses won’t connect.")
    }
  }
}
