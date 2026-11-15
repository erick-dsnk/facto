import SwiftUI

/// What the lens shows right now, redrawn on the phone: the claim, then its result card.
/// Cross-fades when the card changes, without animation under Reduce Motion.
/// VoiceOver hears a new card from ResultPresenter, which announces every card it shows
/// without speaking it.
struct LensPreview: View {
  let card: ResultCard?

  @ScaledMetric(relativeTo: .body) private var emptyHeight: CGFloat = 96
  @Environment(\.accessibilityReduceMotion) private var reduceMotion

  init(card: ResultCard?) {
    self.card = card
  }

  var body: some View {
    ZStack(alignment: .topLeading) {
      if let card {
        VStack(alignment: .leading, spacing: FactoSpacing.s) {
          if !card.excerpt.isEmpty {
            Text(card.excerpt)
              .font(.onest(.title3, weight: .medium))
              .foregroundStyle(.factoText)
          }
          ResultCardView(card: card)
        }
        .fixedSize(horizontal: false, vertical: true)
        .id(CardKey(card))
        .transition(.opacity)
      } else {
        Text("Nothing on the lens yet")
          .foregroundStyle(.factoTextSecondary)
          .multilineTextAlignment(.center)
          .frame(maxWidth: .infinity, minHeight: emptyHeight)
          .transition(.opacity)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(FactoSpacing.m)
    .overlay {
      RoundedRectangle(cornerRadius: FactoRadius.panel, style: .continuous)
        .strokeBorder(.factoHairline, lineWidth: 1)
    }
    .animation(reduceMotion ? nil : .easeOut(duration: 0.2), value: card.map(CardKey.init))
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(card?.accessibilityLabel ?? String(localized: "Nothing on the lens yet"))
  }
}

/// Identity of a card's content, so a new card cross-fades in instead of changing in place.
private struct CardKey: Hashable {
  let kind: CardKind
  let verdictWord: String
  let detail: String?
  let excerpt: String
  let quote: String?
  let sourceName: String?

  init(_ card: ResultCard) {
    kind = card.kind
    verdictWord = card.verdictWord
    detail = card.detail
    excerpt = card.excerpt
    quote = card.quote
    sourceName = card.sourceName
  }
}

#if DEBUG
#Preview("Each kind") {
  ScrollView {
    VStack(spacing: FactoSpacing.m) {
      LensPreview(card: nil)
      ForEach(ResultCard.previewSamples, id: \.verdictWord) { card in
        LensPreview(card: card)
      }
    }
    .padding(FactoSpacing.gutter)
  }
  .factoScreen()
}

#Preview("Cross-fade") {
  LensPreviewCycler()
}

/// Steps through the empty lens and every kind, to watch the cross-fade.
private struct LensPreviewCycler: View {
  @State private var index = 0
  private let cards: [ResultCard?] = [nil] + ResultCard.previewSamples

  var body: some View {
    VStack(spacing: FactoSpacing.m) {
      LensPreview(card: cards[index])
      Button("Next card") { index = (index + 1) % cards.count }
        .buttonStyle(.factoPill)
    }
    .padding(FactoSpacing.gutter)
    .frame(maxHeight: .infinity, alignment: .top)
    .factoScreen()
  }
}
#endif
