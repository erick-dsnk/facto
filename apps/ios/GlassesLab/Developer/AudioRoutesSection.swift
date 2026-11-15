import SwiftUI

/// Audio routes, the HFP mic test and a spoken sample.
struct AudioRoutesSection: View {
  let audioLab: AudioLabModel
  let camera: CameraModel

  var body: some View {
    Section {
      LabeledContent("Input route", value: audioLab.inputRoute)
      LabeledContent("Output route", value: audioLab.outputRoute)
      if audioLab.isListening {
        LabeledContent("HFP format", value: audioLab.hfpFormat ?? "–")
        LabeledContent("HFP level", value: String(format: "%.0f dBFS", audioLab.hfpLevelDb))
        Button("Stop HFP mic", role: .destructive) { audioLab.stopHFP() }
      } else {
        Button("Start HFP mic test") { Task { await audioLab.startHFP() } }
          .disabled(camera.isStreaming)
      }
      Button("Speak a sample result") { audioLab.speakSample() }
      Button("Refresh routes") { audioLab.refreshRoute() }
      if let error = audioLab.lastError {
        Label(error, systemImage: "exclamationmark.triangle")
          .font(.onest(.footnote))
      }
    } header: {
      SettingsHeader("Audio routes")
    } footer: {
      SettingsFooter(
        "HFP is the fallback for the wearer’s own dictation. Run it with no stream active, have someone talk about 1 m away, and compare levels. Spoken output should play from the glasses speakers."
      )
    }
  }
}
