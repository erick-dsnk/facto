import SwiftUI
import UIKit

// Facto's two colours, mahogany and off-white, from the website (apps/landing/src/styles.css).
// Light mode puts mahogany text on off-white; dark mode swaps them, like the site's mahogany
// sections. Verdict colours fill cards and swatches only. Never pass them to
// `foregroundStyle` as a text colour.

/// Raw brand colours for UIKit and the glasses display. Views use the dynamic tokens below.
enum FactoPalette {
  /// #F5F5F7, the website's `--bg`.
  static let offWhite = UIColor(factoHex: 0xF5F5F7)
  /// #380C00, the website's `--brown`.
  static let mahogany = UIColor(factoHex: 0x380C00)
  /// #2F6F3E, `--v-true`.
  static let verdictTrue = UIColor(factoHex: 0x2F6F3E)
  /// #8B1E24, `--v-false`.
  static let verdictFalse = UIColor(factoHex: 0x8B1E24)
  /// #E3E3E6, secondary text on both verdict fills. Solid, because off-white at 74% over the
  /// True fill drops to 3.9:1. This measures 4.7:1 on True and 7.1:1 on False (WCAG 1.4.3).
  static let onVerdictSecondary = UIColor(factoHex: 0xE3E3E6)
  /// `verdictTrue` lifted 38% toward white, as the website's lens popup does. For the lens.
  static let lensTrue = UIColor(factoHex: 0x7EA484)
  /// `verdictFalse` lifted 38% toward white. For the lens.
  static let lensFalse = UIColor(factoHex: 0xBD7672)
}

extension ShapeStyle where Self == Color {
  /// Screen background: off-white, mahogany in dark mode.
  static var factoBackground: Color { .facto(light: FactoPalette.offWhite, dark: FactoPalette.mahogany) }
  /// Primary text, icons and outlines: mahogany, off-white in dark mode.
  static var factoText: Color { .facto(light: FactoPalette.mahogany, dark: FactoPalette.offWhite) }
  /// Secondary text: `--brown-2` (72%), `--light-2` (74%) in dark mode.
  static var factoTextSecondary: Color {
    .facto(light: FactoPalette.mahogany.withAlphaComponent(0.72), dark: FactoPalette.offWhite.withAlphaComponent(0.74))
  }
  /// Dividers and quiet borders: the text colour at 16%.
  static var factoHairline: Color {
    .facto(light: FactoPalette.mahogany.withAlphaComponent(0.16), dark: FactoPalette.offWhite.withAlphaComponent(0.16))
  }

  /// Fill of primary buttons and the Misleading card: the text colour.
  static var factoInverseFill: Color { .factoText }
  /// Text on `factoInverseFill`: the background colour.
  static var factoInverseText: Color { .factoBackground }
  /// Secondary text on `factoInverseFill`.
  static var factoInverseTextSecondary: Color {
    .facto(light: FactoPalette.offWhite.withAlphaComponent(0.74), dark: FactoPalette.mahogany.withAlphaComponent(0.72))
  }

  /// True card and swatch fill. Not a text colour.
  static var factoVerdictTrue: Color { Color(uiColor: FactoPalette.verdictTrue) }
  /// False card and swatch fill. Not a text colour.
  static var factoVerdictFalse: Color { Color(uiColor: FactoPalette.verdictFalse) }
  /// Text on a verdict fill, in both modes.
  static var factoOnVerdict: Color { Color(uiColor: FactoPalette.offWhite) }
  /// Secondary text on a verdict fill, in both modes. At least 4.5:1 on both fills.
  static var factoOnVerdictSecondary: Color { Color(uiColor: FactoPalette.onVerdictSecondary) }
}

extension Color {
  /// A colour that follows the interface style.
  fileprivate static func facto(light: UIColor, dark: UIColor) -> Color {
    Color(uiColor: UIColor { traits in traits.userInterfaceStyle == .dark ? dark : light })
  }
}

extension UIColor {
  /// An opaque sRGB colour from a 0xRRGGBB literal.
  convenience init(factoHex hex: UInt32, alpha: CGFloat = 1) {
    self.init(
      red: CGFloat((hex >> 16) & 0xFF) / 255,
      green: CGFloat((hex >> 8) & 0xFF) / 255,
      blue: CGFloat(hex & 0xFF) / 255,
      alpha: alpha
    )
  }
}

/// Spacing on a 4 pt grid.
enum FactoSpacing {
  static let xxs: CGFloat = 4
  static let xs: CGFloat = 8
  static let s: CGFloat = 12
  static let m: CGFloat = 16
  static let l: CGFloat = 24
  static let xl: CGFloat = 32
  /// Side margin of every screen.
  static let gutter: CGFloat = 16
}

/// Corner radii. Use them with `style: .continuous`.
enum FactoRadius {
  static let small: CGFloat = 8
  static let card: CGFloat = 16
  static let panel: CGFloat = 20
}
