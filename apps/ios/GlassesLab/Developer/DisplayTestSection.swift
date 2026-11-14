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
          .disabled(display.webDisplayEnabled)
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
        display.webDisplayEnabled
          ? "Native display output is off while Web display is selected in Glasses display above. The camera still takes photos."
          : "Needs Meta Ray-Ban Display glasses or the simulated Display. Facto reconnects the display by itself while those glasses are around. Ray-Ban Meta Gen 2 has no display."
      )
    }
  }
}
