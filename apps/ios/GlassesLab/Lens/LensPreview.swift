import SwiftUI

/// What the lens shows right now, redrawn on the phone. Placeholder: LENS adds the claim
/// styling, the cross-fade and the scaled empty state.
struct LensPreview: View {
  let card: ResultCard?

  init(card: ResultCard?) {
    self.card = card
  }

  var body: some View {
    VStack(alignment: .leading, spacing: FactoSpacing.s) {
      if let card {
        if !card.excerpt.isEmpty {
          Text(card.excerpt)
            .font(.onest(.title3, weight: .medium))
        }
        ResultCardView(card: card)
      } else {
        Text("Nothing on the lens yet")
          .foregroundStyle(.factoTextSecondary)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(FactoSpacing.m)
    .overlay {
      RoundedRectangle(cornerRadius: FactoRadius.panel, style: .continuous)
        .strokeBorder(.factoHairline, lineWidth: 1)
    }
  }
}
