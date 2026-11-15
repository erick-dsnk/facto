import SwiftUI
import UIKit

/// The website's pill button: full width, a capsule, Onest medium.
///
/// - Primary: the inverse fill (mahogany on light, off-white on dark) with inverse text.
/// - Secondary: clear, with a 1.5 pt outline in the text colour.
/// - Pressed: 88% opacity and 97% scale (no scale under Reduce Motion). Disabled: 40% opacity.
struct FactoPillButtonStyle: ButtonStyle {
  enum Prominence { case primary, secondary }
  enum Size { case regular, large }

  var prominence: Prominence
  var size: Size

  init(_ prominence: Prominence = .primary, size: Size = .regular) {
    self.prominence = prominence
    self.size = size
  }

  func makeBody(configuration: Configuration) -> some View {
    FactoPill(configuration: configuration, prominence: prominence, size: size)
  }
}

extension ButtonStyle where Self == FactoPillButtonStyle {
  /// Primary pill at the regular size.
  static var factoPill: FactoPillButtonStyle { FactoPillButtonStyle() }
  /// Secondary (outlined) pill at the regular size.
  static var factoPillSecondary: FactoPillButtonStyle { FactoPillButtonStyle(.secondary) }
}

private struct FactoPill: View {
  let configuration: ButtonStyleConfiguration
  let prominence: FactoPillButtonStyle.Prominence
  let size: FactoPillButtonStyle.Size

  @Environment(\.isEnabled) private var isEnabled
  @Environment(\.accessibilityReduceMotion) private var reduceMotion

  var body: some View {
    let pressed = configuration.isPressed
    configuration.label
      .font(.onest(size == .large ? .title3 : .callout, weight: .medium))
      .multilineTextAlignment(.center)
      .foregroundStyle(prominence == .primary ? Color.factoInverseText : Color.factoText)
      .padding(.horizontal, FactoSpacing.l)
      .padding(.vertical, FactoSpacing.xs)
      .frame(maxWidth: .infinity, minHeight: size == .large ? 56 : 44)
      .background { background }
      .contentShape(.capsule)
      .opacity(isEnabled ? (pressed ? 0.88 : 1) : 0.4)
      .scaleEffect(pressed && !reduceMotion ? 0.97 : 1)
      .animation(.easeOut(duration: 0.2), value: pressed)
  }

  @ViewBuilder private var background: some View {
    switch prominence {
    case .primary:
      Capsule().fill(.factoInverseFill)
    case .secondary:
      Capsule().strokeBorder(.factoText, lineWidth: 1.5)
    }
  }
}

extension View {
  /// The base of every Facto screen: off-white (mahogany in dark mode) behind everything,
  /// list and form backgrounds hidden, Onest body text, and the text colour as tint.
  func factoScreen() -> some View {
    self
      .font(.onest(.body))
      .foregroundStyle(.factoText)
      .tint(.factoText)
      .scrollContentBackground(.hidden)
      .background(.factoBackground)
  }
}

enum FactoTheme {
  /// Styles UIKit chrome SwiftUI can't reach: navigation bar titles in Onest and the token
  /// colours. Call once at launch.
  @MainActor
  static func configureAppearance() {
    let text = UIColor(Color.factoText)
    let background = UIColor(Color.factoBackground)
    let titleAttributes: [NSAttributedString.Key: Any] = [
      .font: UIFont.onest(.headline, weight: .semibold), .foregroundColor: text,
    ]
    let largeTitleAttributes: [NSAttributedString.Key: Any] = [
      .font: UIFont.onest(.largeTitle, weight: .bold), .foregroundColor: text,
    ]

    let standard = UINavigationBarAppearance()
    standard.configureWithDefaultBackground()
    standard.backgroundColor = background
    standard.shadowColor = UIColor(Color.factoHairline)
    standard.titleTextAttributes = titleAttributes
    standard.largeTitleTextAttributes = largeTitleAttributes

    let scrollEdge = UINavigationBarAppearance()
    scrollEdge.configureWithTransparentBackground()
    scrollEdge.backgroundColor = background
    scrollEdge.titleTextAttributes = titleAttributes
    scrollEdge.largeTitleTextAttributes = largeTitleAttributes

    let bar = UINavigationBar.appearance()
    bar.standardAppearance = standard
    bar.compactAppearance = standard
    bar.scrollEdgeAppearance = scrollEdge
    bar.compactScrollEdgeAppearance = scrollEdge
    bar.tintColor = text
  }
}
