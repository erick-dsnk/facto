import SwiftUI

/// The website's verdict square (`.verdict__swatch`): a rounded square beside the verdict
/// word. True and False fill it with their verdict colour, Misleading with the text colour,
/// and the rest leave it empty inside a 2 pt outline. Decorative: the verdict word next to
/// it carries the meaning.
struct VerdictSwatch: View {
  let kind: CardKind

  @ScaledMetric(relativeTo: .headline) private var side: CGFloat = 12

  init(kind: CardKind) {
    self.kind = kind
  }

  var body: some View {
    let shape = RoundedRectangle(cornerRadius: side * 0.24, style: .continuous)
    Group {
      switch kind {
      case .supported:
        shape.fill(.factoVerdictTrue)
      case .contradicted:
        shape.fill(.factoVerdictFalse)
      case .misleading:
        shape.fill(.factoText)
      case .unverified, .needsConfirmation, .checkFailed:
        shape.strokeBorder(.factoText, lineWidth: 2)
      }
    }
    .frame(width: side, height: side)
    .accessibilityHidden(true)
  }
}

#if DEBUG
#Preview("Swatches") {
  VStack(alignment: .leading, spacing: FactoSpacing.s) {
    ForEach(ResultCard.previewSamples, id: \.verdictWord) { card in
      HStack(spacing: FactoSpacing.xs) {
        VerdictSwatch(kind: card.kind)
        Text(card.verdictWord)
      }
    }
  }
  .padding(FactoSpacing.m)
  .factoScreen()
}
#endif
