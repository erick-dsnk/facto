import SwiftUI

/// MockDeviceKit glasses: no hardware needed, the phone's back camera stands in for theirs.
struct SimulatedGlassesSection: View {
  let wearables: WearablesModel

  var body: some View {
    Section {
      if let model = wearables.mockModel {
        LabeledContent("Simulating", value: model.rawValue)
        Button("Simulate touchpad tap") { wearables.mockTap() }
        Button("Stop simulation", role: .destructive) { wearables.stopMock() }
        if let mockDisplay = wearables.mockDisplay {
          MockDisplayPreview(display: mockDisplay)
            .frame(height: 300)
            .clipShape(.rect(cornerRadius: FactoRadius.card, style: .continuous))
        }
      } else {
        ForEach(WearablesModel.MockModel.allCases) { model in
          Button("Simulate \(model.rawValue)") {
            Task { await wearables.startMock(model) }
          }
        }
      }
    } header: {
      SettingsHeader("Simulated glasses")
    } footer: {
      SettingsFooter(
        "MockDeviceKit pairs glasses without hardware. The phone’s back camera stands in for the glasses camera. Pick Meta Ray-Ban Display to see what the lens shows."
      )
    }
  }
}
