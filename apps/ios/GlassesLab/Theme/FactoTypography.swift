import SwiftUI
import UIKit

// Onest, the website's font (SIL OFL 1.1), ships in the app as one variable font with a
// weight (wght) axis from 100 to 900. Info.plist registers it through UIAppFonts. Every size
// follows a text style, so Dynamic Type scales it.

enum FactoTypography {
  /// The family name Onest registers under.
  static let familyName = "Onest"
  /// PostScript name of the default (Regular) instance of the variable font.
  static let regularPostScriptName = "Onest-Regular"
  /// OpenType tag 'wght' as an integer, the key of a variation attribute.
  static let weightAxisTag = 0x7767_6874

  /// True once the app registered Onest. False when the font file is missing, in which
  /// case `UIFont.onest` falls back to the system font.
  static var isOnestAvailable: Bool {
    UIFont(name: regularPostScriptName, size: 17) != nil
  }

  /// The point size of each text style at the default (Large) content size.
  static func baseSize(for style: Font.TextStyle) -> CGFloat {
    switch style {
    case .largeTitle: 34
    case .title: 28
    case .title2: 22
    case .title3: 20
    case .headline: 17
    case .body: 17
    case .callout: 16
    case .subheadline: 15
    case .footnote: 13
    case .caption: 12
    case .caption2: 11
    @unknown default: 17
    }
  }

  static func baseSize(for style: UIFont.TextStyle) -> CGFloat {
    switch style {
    case .largeTitle: 34
    case .title1: 28
    case .title2: 22
    case .title3: 20
    case .headline: 17
    case .body: 17
    case .callout: 16
    case .subheadline: 15
    case .footnote: 13
    case .caption1: 12
    case .caption2: 11
    default: 17
    }
  }

  /// The wght axis value for a UIKit weight (CSS scale: 400 regular, 700 bold).
  static func axisValue(for weight: UIFont.Weight) -> CGFloat {
    switch weight {
    case .ultraLight: 100
    case .thin: 200
    case .light: 300
    case .medium: 500
    case .semibold: 600
    case .bold: 700
    case .heavy: 800
    case .black: 900
    default: 400
    }
  }
}

extension Font {
  /// Onest at a text style's size, scaled with Dynamic Type.
  static func onest(_ style: Font.TextStyle, weight: Font.Weight = .regular) -> Font {
    onest(size: FactoTypography.baseSize(for: style), weight: weight, relativeTo: style)
  }

  /// Onest at `size` points for the default content size, scaled like `style`.
  static func onest(size: CGFloat, weight: Font.Weight = .regular, relativeTo style: Font.TextStyle) -> Font {
    // The variable font maps `.weight` onto its wght axis (ThemeTests checks bold renders
    // wider than regular).
    Font.custom(FactoTypography.familyName, size: size, relativeTo: style).weight(weight)
  }

  /// The lowercase "facto" wordmark. Callers add `.tracking(-1)`, as the website does.
  static var factoWordmark: Font {
    onest(size: 24, weight: .bold, relativeTo: .title2)
  }
}

extension UIFont {
  /// Onest for UIKit (navigation bars, attributed text), scaled by `UIFontMetrics` for the
  /// current content size. Falls back to the system font if Onest is missing.
  static func onest(_ style: UIFont.TextStyle, weight: UIFont.Weight) -> UIFont {
    let size = FactoTypography.baseSize(for: style)
    let base = onestFont(size: size, weight: weight) ?? .systemFont(ofSize: size, weight: weight)
    return UIFontMetrics(forTextStyle: style).scaledFont(for: base)
  }

  /// Onest at a fixed size and weight, driven through the wght axis. Nil without the font.
  static func onestFont(size: CGFloat, weight: UIFont.Weight) -> UIFont? {
    guard FactoTypography.isOnestAvailable else { return nil }
    let variation = UIFontDescriptor.AttributeName(rawValue: kCTFontVariationAttribute as String)
    let descriptor = UIFontDescriptor(fontAttributes: [
      .name: FactoTypography.regularPostScriptName,
      variation: [FactoTypography.weightAxisTag: FactoTypography.axisValue(for: weight)],
    ])
    return UIFont(descriptor: descriptor, size: size)
  }
}
