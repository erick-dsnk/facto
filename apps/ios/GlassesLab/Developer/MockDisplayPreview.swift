import MWDATMockDevice
import SwiftUI

/// Shows what the simulated Display glasses would render.
struct MockDisplayPreview: UIViewRepresentable {
  let display: any MockDisplayKit

  func makeUIView(context: Context) -> UIView {
    display.createPreviewView()
  }

  func updateUIView(_ uiView: UIView, context: Context) {}
}
