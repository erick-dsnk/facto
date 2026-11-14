#if DEBUG
import SwiftUI

/// Phone-only controls; none of these controls are sent to the wearable.
struct NativeCardPreviewControls: View {
  let wearables: WearablesModel
  let display: DisplayModel
  let captureOrLiveActive: Bool
  @State private var fixture: NativeCardPreviewFixture = .searching

  private var blocked: Bool {
    captureOrLiveActive || display.webDisplayEnabled
      || (display.sessionState != .idle && display.nativePreviewFixture == nil)
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      Text("Native DAT card comparison").font(.headline)
      Picker("Fixture", selection: $fixture) {
        ForEach(NativeCardPreviewFixture.allCases) { value in
          Text(value.rawValue).tag(value)
        }
      }
      .pickerStyle(.segmented)
      Button(display.nativePreviewFixture == nil ? "Show native fixture" : "Replay native fixture") {
        if let device = wearables.mockDisplayDeviceIdentifier {
          display.startNativePreview(fixture, device: device)
        }
      }
      .disabled(blocked)
      if let active = display.nativePreviewFixture {
        Text(active == .searching ? "Searching · \(display.nativePreviewSourceCount) of 4 sources" : "Showing \(active.rawValue)")
          .font(.caption).foregroundStyle(.secondary)
        Button("Stop native fixture", role: .destructive) { display.disconnect() }
      }
      if let port = wearables.nativePreviewServerPort {
        // String(port): Text interpolation would add locale grouping ("9,000").
        Text("Native simulator: http://127.0.0.1:\(String(port))/")
          .font(.caption).textSelection(.enabled)
        Button("Stop native simulator server") { wearables.stopNativePreviewServer() }
      } else {
        Button(wearables.nativePreviewServerBusy ? "Preparing simulator server…" : "Start native simulator server") {
          Task { await wearables.startNativePreviewServer() }
        }
        .disabled(wearables.nativePreviewServerBusy)
      }
      Text("Actual MockDeviceKit output appears above. For Chrome, run this app in iOS Simulator and enable Meta’s extension on the native simulator URL. Searching adds four static source icons, then shows True. DAT uses preset card/type styling and discrete layout updates.")
        .font(.caption).foregroundStyle(.secondary)
      if blocked {
        Text("Stop Live/capture, disconnect the regular display, and select Native display before trying this mock-only comparison.")
          .font(.caption).foregroundStyle(.secondary)
      }
    }
    // Several buttons share one List row; without this, a tap fires every button in the row.
    .buttonStyle(.borderless)
    .onChange(of: captureOrLiveActive) { _, active in
      if active, display.nativePreviewFixture != nil { display.disconnect() }
    }
    .onDisappear {
      if display.nativePreviewFixture != nil { display.disconnect() }
    }
  }
}
#endif
