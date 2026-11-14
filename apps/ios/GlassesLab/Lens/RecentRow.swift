import SwiftUI

/// One past check in the Recent list: swatch, verdict word and time, the claim, then how it
/// reached the wearer ("You asked · spoken · Live Science").
struct RecentRow: View {
  let entry: ResultHistory.Entry

  @Environment(\.dynamicTypeSize) private var dynamicTypeSize

  init(entry: ResultHistory.Entry) {
    self.entry = entry
  }

  var body: some View {
    VStack(alignment: .leading, spacing: FactoSpacing.xxs) {
      headLayout {
        HStack(spacing: FactoSpacing.xs) {
          VerdictSwatch(kind: entry.card.kind)
          Text(entry.card.verdictWord)
            .font(.onest(.headline, weight: .semibold))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        Text(entry.receivedAt, style: .time)
          .font(.onest(.caption))
          .foregroundStyle(.factoTextSecondary)
      }
      if !entry.card.excerpt.isEmpty {
        // Two lines keep the list scannable. Accessibility sizes show it all; the excerpt
        // is already capped at 70 code points.
        Text(entry.card.excerpt)
          .lineLimit(dynamicTypeSize.isAccessibilitySize ? nil : 2)
      }
      Text(Self.metaParts(for: entry).joined(separator: " · "))
        .font(.onest(.footnote))
        .foregroundStyle(.factoTextSecondary)
    }
    .fixedSize(horizontal: false, vertical: true)
    .foregroundStyle(.factoText)
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(.vertical, FactoSpacing.s)
    .contentShape(.rect)
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(entry.card.accessibilityLabel)
    .accessibilityValue(accessibilityValue)
  }

  /// Verdict and time share a line; at accessibility sizes the time moves under the verdict.
  private var headLayout: AnyLayout {
    dynamicTypeSize.isAccessibilitySize
      ? AnyLayout(VStackLayout(alignment: .leading, spacing: FactoSpacing.xxs))
      : AnyLayout(HStackLayout(alignment: .firstTextBaseline, spacing: FactoSpacing.xs))
  }

  /// The meta line without the source, which the label already names, plus the time.
  private var accessibilityValue: String {
    var parts = Self.metaParts(for: entry, includeSource: false)
    parts.append(entry.receivedAt.formatted(date: .omitted, time: .shortened))
    return parts.joined(separator: ", ")
  }

  /// Who started the check, how it was delivered, whether a correction replaced it, and the
  /// source name.
  static func metaParts(for entry: ResultHistory.Entry, includeSource: Bool = true) -> [String] {
    var parts = [entry.userInitiated ? "You asked" : "Automatic", deliveryWord(entry.delivery)]
    if entry.superseded { parts.append("corrected") }
    if includeSource, let sourceName = entry.card.sourceName { parts.append(sourceName) }
    return parts
  }

  private static func deliveryWord(_ delivery: OutputDelivery) -> String {
    switch delivery {
    case .spoken: "spoken"
    case .chimed: "chime"
    case .cardOnly: "card only"
    case .silent: "silent"
    }
  }
}

#if DEBUG
#Preview("Each kind") {
  let deliveries: [OutputDelivery] = [.spoken, .chimed, .cardOnly, .silent, .spoken, .spoken]
  let entries = ResultCard.previewSamples.enumerated().map { index, card in
    ResultHistory.Entry(
      id: UUID(), identity: nil, outcome: .checkFailed, result: nil,
      presentation: Presentation(action: .respond, reasonCode: "preview"),
      userInitiated: index.isMultiple(of: 2), card: card, delivery: deliveries[index],
      receivedAt: Date(timeIntervalSince1970: 1_794_652_200 + Double(index) * 90), superseded: index == 2
    )
  }
  return ScrollView {
    VStack(spacing: 0) {
      ForEach(entries) { entry in
        RecentRow(entry: entry)
        Divider().overlay(.factoHairline)
      }
    }
    .padding(.horizontal, FactoSpacing.gutter)
  }
  .factoScreen()
}
#endif
