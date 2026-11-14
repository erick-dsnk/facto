import SwiftUI

/// One result in the website popup's look. Placeholder: LENS adds the verdict fills, the
/// quote and the final layout.
struct ResultCardView: View {
  let card: ResultCard

  init(card: ResultCard) {
    self.card = card
  }

  var body: some View {
    VStack(alignment: .leading, spacing: FactoSpacing.xxs) {
      Text(card.verdictWord)
        .font(.onest(.title3, weight: .semibold))
      if let detail = card.detail {
        Text(detail)
          .font(.onest(.subheadline))
          .foregroundStyle(.factoTextSecondary)
      }
      if let sourceName = card.sourceName {
        Text(sourceName)
          .font(.onest(.subheadline, weight: .semibold))
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(FactoSpacing.m)
    .overlay {
      RoundedRectangle(cornerRadius: FactoRadius.card, style: .continuous)
        .strokeBorder(.factoText, lineWidth: 2)
    }
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(card.accessibilityLabel)
  }
}
