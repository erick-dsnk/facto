import SwiftUI

/// One result in the website popup's look: the verdict word and its detail on one line, then
/// the source's quote and name.
///
/// True and False fill the card with their verdict colour and use off-white text. Misleading
/// uses the inverse fill. Can’t verify, Not sure and Check failed stay clear inside a 2 pt
/// outline. Verdict colours only ever fill the card, never text.
struct ResultCardView: View {
  let card: ResultCard

  @Environment(\.dynamicTypeSize) private var dynamicTypeSize

  init(card: ResultCard) {
    self.card = card
  }

  var body: some View {
    let style = CardStyle(kind: card.kind)
    VStack(alignment: .leading, spacing: 0) {
      headLine(secondary: style.secondaryText)
      if let quote = card.quote {
        Text(quote)
          .font(.onest(.body))
          .foregroundStyle(style.secondaryText)
          .padding(.top, 6)
      }
      if let sourceName = card.sourceName {
        Text(sourceName)
          .font(.onest(.subheadline, weight: .semibold))
          .padding(.top, FactoSpacing.xxs)
      }
    }
    // Keep every line: inside a stack, SwiftUI otherwise squeezes the card by a line when
    // the text above it wraps.
    .fixedSize(horizontal: false, vertical: true)
    .foregroundStyle(style.text)
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(.top, FactoSpacing.s)
    .padding([.horizontal, .bottom], FactoSpacing.m)
    .background {
      let shape = RoundedRectangle(cornerRadius: FactoRadius.card, style: .continuous)
      if let fill = style.fill {
        shape.fill(fill)
      } else {
        shape.strokeBorder(.factoText, lineWidth: 2)
      }
    }
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(card.accessibilityLabel)
  }

  /// The verdict word and "  ·  detail" as one Text, so a long detail wraps under the word.
  /// The spaces after the dot don't break, so the dot stays with the detail. At accessibility
  /// sizes the detail starts its own line, without the dot.
  private func headLine(secondary: Color) -> Text {
    let word = Text(card.verdictWord).font(.onest(.title3, weight: .semibold))
    guard let detail = card.detail, !detail.isEmpty else { return word }
    let separator = dynamicTypeSize.isAccessibilitySize ? "\n" : "  ·\u{00A0}\u{00A0}"
    let after = Text(verbatim: separator + detail)
      .font(.onest(.subheadline))
      .foregroundStyle(secondary)
    return Text("\(word)\(after)")
  }
}

/// Fill and text colours for one kind of card.
private struct CardStyle {
  /// Nil for the clear, outlined cards.
  let fill: Color?
  let text: Color
  let secondaryText: Color

  init(kind: CardKind) {
    switch kind {
    case .supported:
      fill = .factoVerdictTrue
      text = .factoOnVerdict
      secondaryText = .factoOnVerdictSecondary
    case .contradicted:
      fill = .factoVerdictFalse
      text = .factoOnVerdict
      secondaryText = .factoOnVerdictSecondary
    case .misleading:
      fill = .factoInverseFill
      text = .factoInverseText
      secondaryText = .factoInverseTextSecondary
    case .unverified, .needsConfirmation, .checkFailed:
      fill = nil
      text = .factoText
      secondaryText = .factoTextSecondary
    }
  }
}

#if DEBUG
extension ResultCard {
  /// One card of each kind, for previews.
  static let previewSamples: [ResultCard] = [
    ResultCard(
      kind: .supported, verdictWord: "True", detail: "2 of 3 sources agree",
      excerpt: "The Moon has no atmosphere to speak of.",
      quote: "“The Moon’s exosphere is so thin that it is nearly a vacuum.”", sourceName: "NASA",
      spokenLine: "True. 2 of 3 sources agree, including NASA."
    ),
    ResultCard(
      kind: .contradicted, verdictWord: "False", detail: "3 of 3 sources disagree",
      excerpt: "The Eiffel Tower opened in 1890.",
      quote: "“The tower opened to the public on 31 March 1889.”", sourceName: "Live Science",
      spokenLine: "False. 3 of 3 sources disagree, including Live Science."
    ),
    ResultCard(
      kind: .misleading, verdictWord: "Misleading", detail: "Exaggerated",
      excerpt: "Coffee dehydrates you.",
      quote: "“Regular coffee drinkers barely notice its mild diuretic effect.”", sourceName: "Mayo Clinic",
      spokenLine: "Misleading. Exaggerated."
    ),
    ResultCard(outcome: .verdict(.insufficientEvidence), claimText: "The new bridge cost twice its budget."),
    ResultCard(outcome: .needsConfirmation(heard: true), claimText: nil),
    ResultCard(outcome: .checkFailed, claimText: "The Eiffel Tower is 330 metres tall."),
  ]
}

#Preview("All kinds") {
  ScrollView {
    VStack(spacing: FactoSpacing.s) {
      ForEach(ResultCard.previewSamples, id: \.verdictWord) { card in
        ResultCardView(card: card)
      }
    }
    .padding(FactoSpacing.gutter)
  }
  .factoScreen()
}

#Preview("All kinds, dark, AX3") {
  ScrollView {
    VStack(spacing: FactoSpacing.s) {
      ForEach(ResultCard.previewSamples, id: \.verdictWord) { card in
        ResultCardView(card: card)
      }
    }
    .padding(FactoSpacing.gutter)
  }
  .factoScreen()
  .preferredColorScheme(.dark)
  .dynamicTypeSize(.accessibility3)
}
#endif
