import SwiftUI

/// The small verdict square from the website. Placeholder: LENS draws the real swatch
/// (verdict fills for True and False, an outline for Can’t verify).
struct VerdictSwatch: View {
  let kind: CardKind

  init(kind: CardKind) {
    self.kind = kind
  }

  var body: some View {
    RoundedRectangle(cornerRadius: 3, style: .continuous)
      .strokeBorder(.factoText, lineWidth: 2)
      .frame(width: 12, height: 12)
      .accessibilityHidden(true)
  }
}
