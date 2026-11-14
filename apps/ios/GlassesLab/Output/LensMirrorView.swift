import SwiftUI

// No MWDATDisplay import here: SwiftUI's Text and Image would clash with the SDK's.

/// The lens card redrawn on the phone or a big screen, so an audience sees what the wearer
/// sees. The SDK has no lens-mirroring API (decision 11), so this view replays the
/// DisplayCardBuilder layout from the same `LensCardViewModel`.
///
/// It lays the card out on a 600x600 canvas (the lens size) with the builder's padding and
/// spacing, then scales the whole canvas to fit. Black stands for the clear lens.
struct LensMirrorView: View {
  let model: LensCardViewModel

  var body: some View {
    LensMirrorCanvas(card: model.card)
  }
}

/// Stateless renderer, usable in previews and lists of history cards.
struct LensMirrorCanvas: View {
  static let lensSize: CGFloat = 600

  let card: ResultCard?

  var body: some View {
    GeometryReader { geometry in
      let side = min(geometry.size.width, geometry.size.height)
      let scale = side / Self.lensSize
      content
        .frame(width: Self.lensSize, height: Self.lensSize, alignment: .topLeading)
        .scaleEffect(scale, anchor: .topLeading)
        .frame(width: side, height: side, alignment: .topLeading)
    }
    .aspectRatio(1, contentMode: .fit)
    .background(Color.black)
    .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(card?.accessibilityLabel ?? "Lens mirror. No result on the lens.")
  }

  @ViewBuilder private var content: some View {
    if let card {
      VStack(alignment: .leading, spacing: DisplayMetrics.spacing) {
        HStack(spacing: DisplayCardBuilder.rowSpacing) {
          Image(systemName: Self.symbol(for: card.kind))
            .font(.system(size: DisplayMetrics.headingSize, weight: .semibold))
          Text(card.verdictWord)
            .font(.system(size: DisplayMetrics.headingSize, weight: .semibold))
        }
        if !card.excerpt.isEmpty {
          Text(card.excerpt)
            .font(.system(size: DisplayMetrics.bodySize))
            .fixedSize(horizontal: false, vertical: true)
            .padding(DisplayCardBuilder.excerptPadding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(DisplayMetrics.cardFill, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
        if let sourceLine = card.sourceLine {
          Text(sourceLine)
            .font(.system(size: DisplayMetrics.metaSize))
            .foregroundStyle(DisplayMetrics.secondary)
        }
        Text(card.hint)
          .font(.system(size: DisplayMetrics.metaSize))
          .foregroundStyle(DisplayMetrics.secondary)
      }
      .foregroundStyle(DisplayMetrics.primary)
      .lineLimit(nil)
      .padding(DisplayMetrics.padding)
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    } else {
      Color.clear
    }
  }

  /// SF Symbols closest to the lens icons in DisplayCardBuilder.icon(for:).
  static func symbol(for kind: CardKind) -> String {
    switch kind {
    case .supported: "checkmark.circle.fill"
    case .contradicted: "exclamationmark.triangle.fill"
    case .misleading: "exclamationmark.circle.fill"
    case .unverified: "info.circle.fill"
    case .needsConfirmation: "eye.fill"
    case .checkFailed: "xmark"
    }
  }
}

/// Lens text styles in 600 pt canvas units. Padding and spacing match DisplayCardBuilder;
/// sizes are estimates until checked against a real Display (docs/device-capabilities.md).
private enum DisplayMetrics {
  static let padding = DisplayCardBuilder.padding
  static let spacing = DisplayCardBuilder.spacing
  static let headingSize: CGFloat = 36
  static let bodySize: CGFloat = 28
  static let metaSize: CGFloat = 22
  static let primary = Color.white
  static let secondary = Color.white.opacity(0.6)
  static let cardFill = Color.white.opacity(0.12)
}

#Preview("Supported") {
  LensMirrorCanvas(card: ResultCard(
    kind: .supported, verdictWord: "Supported", excerpt: "The Eiffel Tower opened in 1889.",
    sourceName: "Eiffel Tower", hint: "Details on your phone"
  ))
  .padding()
}

#Preview("Empty") {
  LensMirrorCanvas(card: nil).padding()
}
