import SwiftUI

/// Every lab panel from the old Glasses Lab list, for the device checklist and for debugging:
/// the live session, Meta AI, simulated glasses, the camera, audio routes, the display test,
/// the event log and the debug log. Pushed from Settings.
struct DeveloperView: View {
  let wearables: WearablesModel
  @Bindable var camera: CameraModel
  let display: DisplayModel
  let audioLab: AudioLabModel
  let live: LiveModel

  var body: some View {
    List {
      LiveSessionSection(live: live, camera: camera)
        .factoRowBackground()
      MetaAISection(wearables: wearables)
        .factoRowBackground()
      SimulatedGlassesSection(wearables: wearables)
        .factoRowBackground()
      CameraStreamSection(camera: camera)
        .factoRowBackground()
      AudioRoutesSection(audioLab: audioLab, camera: camera)
        .factoRowBackground()
      DisplayTestSection(display: display)
        .factoRowBackground()
      EventLogSection(wearables: wearables)
        .factoRowBackground()
      DebugLogSection()
        .factoRowBackground()
    }
    .navigationTitle("Developer")
    .navigationBarTitleDisplayMode(.inline)
    .factoScreen()
  }
}
