import SwiftUI

/// One past check in the Recent list. Placeholder: LENS adds the time, the meta line and
/// the final layout.
struct RecentRow: View {
  let entry: ResultHistory.Entry

  init(entry: ResultHistory.Entry) {
    self.entry = entry
  }

  var body: some View {
    VStack(alignment: .leading, spacing: FactoSpacing.xxs) {
      HStack(spacing: FactoSpacing.xs) {
        VerdictSwatch(kind: entry.card.kind)
        Text(entry.card.verdictWord)
          .font(.onest(.headline, weight: .semibold))
      }
      if !entry.card.excerpt.isEmpty {
        Text(entry.card.excerpt)
          .lineLimit(2)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(entry.card.accessibilityLabel)
  }
}
