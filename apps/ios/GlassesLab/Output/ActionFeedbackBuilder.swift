import Foundation
import MWDATDisplay
import UIKit

/// A short acknowledgement of an accepted action, never an indication of a verdict.
enum NativeTriggerFeedback: Equatable, Sendable {
  case listening, checking

  var displayText: String {
    switch self {
    case .listening: "Listening…"
    case .checking: "Checking…"
    }
  }

  var duration: TimeInterval { self == .listening ? 1.4 : 1.1 }
}

enum NativeTriggerFeedbackBuilder {
  static func build(_ feedback: NativeTriggerFeedback) -> FlexBox {
    FlexBox(
      direction: .column,
      padding: EdgeInsets(top: 156, bottom: 24, leading: 86, trailing: 86)
    ) {
      FlexBox(direction: .row, spacing: 8, crossAlignment: .center) {
        Image(image: feedback == .listening ? waveform : viewfinder, sizePreset: .icon, cornerRadius: .none)
        Text(feedback.displayText, style: .body, color: .secondary)
      }
      .padding(12)
      .background(.card)
      .alignSelf(.start)
    }
  }

  // Immutable line icons, not rasterized cards or animation frames.
  private static let waveform = icon { path in
    for (x, height) in [(4.0, 6.0), (9.0, 14.0), (14.0, 20.0), (19.0, 10.0), (24.0, 4.0)] {
      path.move(to: CGPoint(x: x, y: 14 - height / 2))
      path.addLine(to: CGPoint(x: x, y: 14 + height / 2))
    }
  }
  private static let viewfinder = icon { path in
    for (x, y, dx, dy) in [(4.0, 4.0, 1.0, 1.0), (24.0, 4.0, -1.0, 1.0), (4.0, 24.0, 1.0, -1.0), (24.0, 24.0, -1.0, -1.0)] {
      path.move(to: CGPoint(x: x, y: y + 6 * dy))
      path.addLine(to: CGPoint(x: x, y: y))
      path.addLine(to: CGPoint(x: x + 6 * dx, y: y))
    }
  }

  private static func icon(_ draw: (UIBezierPath) -> Void) -> UIImage {
    UIGraphicsImageRenderer(size: CGSize(width: 28, height: 28)).image { _ in
      UIColor(red: 0.82, green: 0.82, blue: 0.85, alpha: 1).setStroke()
      let path = UIBezierPath()
      path.lineWidth = 2
      path.lineCapStyle = .round
      path.lineJoinStyle = .round
      draw(path)
      path.stroke()
    }
  }
}
