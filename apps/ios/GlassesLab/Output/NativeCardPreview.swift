#if DEBUG
import MWDATDisplay
import UIKit

/// Comparison fixtures only. These are real DAT components, not a phone-side mirror.
enum NativeCardPreviewFixture: String, CaseIterable, Identifiable, Hashable {
  case searching = "Searching"
  case supported = "True"
  case contradicted = "False"
  var id: String { rawValue }
}

enum NativeCardPreviewBuilder {
  static func build(_ fixture: NativeCardPreviewFixture, sourceCount: Int = 0) -> FlexBox {
    let isFalse = fixture == .contradicted
    return FlexBox(
      direction: .column, spacing: 16,
      padding: EdgeInsets(top: 160, bottom: 24, leading: 86, trailing: 86)
    ) {
      Text(isFalse ? "Heard nearby" : "Read from screen", style: .meta, color: .secondary)
      Text(
        isFalse
          ? "Goldfish only remember things\nfor three seconds."
          : "The Eiffel Tower grows up to\n15 cm taller in summer.",
        style: .heading
      )
      if fixture == .searching {
        FlexBox(direction: .row, spacing: 4, crossAlignment: .center) {
          Text("Searching...", style: .body, color: .secondary)
          for index in 0..<min(4, max(0, sourceCount)) {
            Image(image: sourceBadges[index], sizePreset: .icon, cornerRadius: .small)
          }
        }
        .padding(12)
        .background(.card)
        .alignSelf(.start)
      } else {
        FlexBox(direction: .column, spacing: 12) {
          FlexBox(direction: .row, spacing: 8, crossAlignment: .center) {
            Image(image: isFalse ? falseDot : trueDot, sizePreset: .icon, cornerRadius: .none)
            Text(isFalse ? "False" : "True", style: .body)
            Text(isFalse ? "· 3 of 3 sources disagree" : "· official site", style: .meta, color: .secondary)
          }
          Text(
            isFalse
              ? "“Goldfish can remember things\nfor months, not seconds.”"
              : "“The tower can grow up to 15 cm\nas its iron expands in the heat.”",
            style: .body
          )
          Text(isFalse ? "Live Science" : "toureiffel.paris", style: .meta)
        }
        .padding(18)
        .background(.card)
      }
    }
  }

  // Small immutable icon images. The card, text and layout are never rasterized.
  // DAT's .icon preset controls rendered size; arbitrary CSS sizing/overlap isn't available.
  private static let sourceBadges: [UIImage] = [
    badge("T", color: UIColor(red: 0.66, green: 0.48, blue: 0.33, alpha: 1)),
    badge("B", color: UIColor(red: 0.23, green: 0.39, blue: 0.65, alpha: 1)),
    badge("W", color: UIColor(red: 0.47, green: 0.48, blue: 0.53, alpha: 1)),
    badge("S", color: UIColor(red: 0.35, green: 0.53, blue: 0.51, alpha: 1)),
  ]
  private static let trueDot = dot(color: UIColor(red: 0.60, green: 0.70, blue: 0.63, alpha: 1))
  private static let falseDot = dot(color: UIColor(red: 0.75, green: 0.56, blue: 0.57, alpha: 1))

  private static func badge(_ letter: String, color: UIColor) -> UIImage {
    UIGraphicsImageRenderer(size: CGSize(width: 26, height: 26)).image { _ in
      color.setFill()
      UIBezierPath(roundedRect: CGRect(x: 0, y: 0, width: 26, height: 26), cornerRadius: 7).fill()
      let attributes: [NSAttributedString.Key: Any] = [
        .font: UIFont.systemFont(ofSize: 18, weight: .semibold), .foregroundColor: UIColor.white,
      ]
      let text = letter as NSString
      let size = text.size(withAttributes: attributes)
      text.draw(at: CGPoint(x: (26 - size.width) / 2, y: (26 - size.height) / 2), withAttributes: attributes)
    }
  }

  private static func dot(color: UIColor) -> UIImage {
    UIGraphicsImageRenderer(size: CGSize(width: 26, height: 26)).image { _ in
      color.setFill()
      UIBezierPath(ovalIn: CGRect(x: 7, y: 7, width: 12, height: 12)).fill()
    }
  }
}
#endif
