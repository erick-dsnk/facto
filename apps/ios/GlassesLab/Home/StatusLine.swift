import SwiftUI

/// The top of the home screen: what works and what doesn't, the one button that fixes it, and
/// Live mode's latest notice.
///
/// Tone shows as the badge's weight, from a hairline ring to a solid disc, never as green or
/// red. VoiceOver announces the line when it turns into a problem.
struct StatusLine: View {
  let status: HomeStatus
  let notice: String?
  let onAction: (HomeStatus.Action) -> Void

  @ScaledMetric(relativeTo: .headline) private var scaledBadgeSize: CGFloat = 32
  @Environment(\.dynamicTypeSize) private var typeSize

  var body: some View {
    // At accessibility sizes the badge sits above the text, so the words get the full width.
    let layout = typeSize.isAccessibilitySize
      ? AnyLayout(VStackLayout(alignment: .leading, spacing: FactoSpacing.xs))
      : AnyLayout(HStackLayout(alignment: .top, spacing: FactoSpacing.s))
    VStack(alignment: .leading, spacing: FactoSpacing.s) {
      layout {
        badge
        VStack(alignment: .leading, spacing: FactoSpacing.xxs) {
          Text(status.text)
            .font(.onest(.headline, weight: .semibold))
          Text(status.detail)
            .font(.onest(.subheadline))
            .foregroundStyle(.factoTextSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
      }
      .accessibilityElement(children: .combine)

      if let action = status.action {
        Button(action.title) { onAction(action) }
          .buttonStyle(.factoPill)
      }

      if let notice {
        Text(notice)
          .font(.onest(.footnote))
          .foregroundStyle(.factoTextSecondary)
          .frame(maxWidth: .infinity, alignment: .leading)
      }
    }
    .onChange(of: status) { old, new in announceProblem(from: old, to: new) }
  }

  /// Announces going offline, an error, or a missing join code: any line with a fix button
  /// or the solid badge. Reconnecting and connecting stay quiet.
  private func announceProblem(from old: HomeStatus, to new: HomeStatus) {
    guard new.tone == .bad || new.action != nil else { return }
    guard new.text != old.text || new.detail != old.detail else { return }
    VoiceOverAnnouncer.post("\(new.text.replacingOccurrences(of: " · ", with: ", ")). \(new.detail)")
  }

  /// Grows with Dynamic Type up to 56 pt, enough to read without crowding the text.
  private var badgeSize: CGFloat { min(scaledBadgeSize, 56) }

  private var badge: some View {
    Image(systemName: status.symbol)
      .font(.system(size: badgeSize * 0.5, weight: .semibold))
      .foregroundStyle(status.tone == .bad ? Color.factoInverseText : Color.factoText)
      .frame(width: badgeSize, height: badgeSize)
      .background { badgeBackground }
      .accessibilityHidden(true)
  }

  @ViewBuilder private var badgeBackground: some View {
    switch status.tone {
    case .bad:
      Circle().fill(.factoInverseFill)
    case .warning:
      Circle().strokeBorder(.factoText, lineWidth: 1.5)
    case .good, .neutral:
      Circle().strokeBorder(.factoHairline, lineWidth: 1)
    }
  }
}

#Preview("States") {
  ScrollView {
    VStack(alignment: .leading, spacing: FactoSpacing.l) {
      StatusLine(status: .make(glasses: .connected, live: .connected, hasJoinCode: true), notice: nil) { _ in }
      StatusLine(status: .make(glasses: .connected, live: .listening, hasJoinCode: true), notice: nil) { _ in }
      StatusLine(status: .make(glasses: .notRegistered, live: .offline, hasJoinCode: false), notice: nil) { _ in }
      StatusLine(
        status: .make(glasses: .connected, live: .backendError(code: "network_lost"), hasJoinCode: true),
        notice: "No network. Check mobile data, then tap Reconnect."
      ) { _ in }
      StatusLine(status: .make(glasses: .connected, live: .reconnecting(attempt: 2), hasJoinCode: true), notice: nil) { _ in }
    }
    .padding(.horizontal, FactoSpacing.gutter)
  }
  .factoScreen()
}
