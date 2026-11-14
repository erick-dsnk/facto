import MWDATCore
import SwiftUI

/// The Meta Ray-Ban Display session and its test screen.
struct DisplayTestSection: View {
  let display: DisplayModel

  var body: some View {
    Section {
      LabeledContent("Session", value: "\(display.sessionState)")
      LabeledContent("Display", value: "\(display.displayState)")
      LabeledContent("Taps from glasses", value: "\(display.taps)")
      if display.sessionState == .idle {
        Button("Connect display") { display.connect() }
      } else {
        Button("Send test screen") { Task { await display.sendHome() } }
          .disabled(!display.isConnected)
        Button("Disconnect display", role: .destructive) { display.disconnect() }
      }
      if let error = display.lastError {
        Label(error, systemImage: "exclamationmark.triangle")
          .font(.onest(.footnote))
      }
    } header: {
      SettingsHeader("Display")
    } footer: {
      SettingsFooter(
        "Needs Meta Ray-Ban Display glasses or the simulated Display. Facto connects the display by itself when those glasses connect. Ray-Ban Meta Gen 2 has no display."
      )
    }
  }
}
