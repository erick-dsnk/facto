import SwiftUI
import UIKit
import XCTest
@testable import GlassesLab

/// The bundled font, its licence and the colour tokens.
@MainActor
final class ThemeTests: XCTestCase {
  /// The app bundle (tests run hosted in the app).
  private var appBundle: Bundle { Bundle(for: ResultHistory.self) }

  // MARK: Font

  func testOnestIsRegistered() {
    XCTAssertTrue(UIFont.familyNames.contains(FactoTypography.familyName), "UIAppFonts registers Onest at launch")
    XCTAssertTrue(FactoTypography.isOnestAvailable)
    XCTAssertNotNil(appBundle.url(forResource: "Onest-Variable", withExtension: "ttf"))
  }

  func testLicenceShipsWithTheFont() throws {
    let url = try XCTUnwrap(appBundle.url(forResource: "Onest-OFL", withExtension: "txt"))
    let text = try String(contentsOf: url, encoding: .utf8)
    XCTAssertTrue(text.contains("SIL OPEN FONT LICENSE Version 1.1"))
  }

  func testBoldRendersWiderThanRegular() {
    let regular = renderedWidth(.onest(size: 64, weight: .regular, relativeTo: .body))
    let bold = renderedWidth(.onest(size: 64, weight: .bold, relativeTo: .body))
    let system = renderedWidth(.system(size: 64, weight: .regular))
    XCTAssertGreaterThan(regular, 0)
    XCTAssertGreaterThan(bold, regular + 1, "the wght axis follows .weight")
    XCTAssertNotEqual(regular, system, accuracy: 1, "Onest renders, not the system fallback")
  }

  func testUIKitFontDrivesTheWeightAxisAndScales() throws {
    let bold = UIFont.onest(.headline, weight: .bold)
    XCTAssertEqual(bold.familyName, FactoTypography.familyName)
    let variation = UIFontDescriptor.AttributeName(rawValue: kCTFontVariationAttribute as String)
    let axes = try XCTUnwrap(bold.fontDescriptor.object(forKey: variation) as? [NSNumber: NSNumber])
    XCTAssertEqual(axes[NSNumber(value: FactoTypography.weightAxisTag)]?.doubleValue, 700)

    let large = UIFont.onest(.body, weight: .regular)
    XCTAssertEqual(large.pointSize, UIFontMetrics(forTextStyle: .body).scaledValue(for: 17), accuracy: 0.01)
  }

  private func renderedWidth(_ font: Font) -> CGFloat {
    let renderer = ImageRenderer(content: Text("facto").font(font).fixedSize())
    renderer.scale = 1
    return renderer.uiImage?.size.width ?? 0
  }

  // MARK: Colours

  private func assertColor(
    _ color: Color, light lightHex: UInt32, _ lightAlpha: CGFloat = 1,
    dark darkHex: UInt32, _ darkAlpha: CGFloat = 1, file: StaticString = #filePath, line: UInt = #line
  ) {
    let uiColor = UIColor(color)
    let light = UITraitCollection(userInterfaceStyle: .light)
    let dark = UITraitCollection(userInterfaceStyle: .dark)
    for (traits, hex, alpha) in [(light, lightHex, lightAlpha), (dark, darkHex, darkAlpha)] {
      var red: CGFloat = 0, green: CGFloat = 0, blue: CGFloat = 0, actualAlpha: CGFloat = 0
      XCTAssertTrue(uiColor.resolvedColor(with: traits).getRed(&red, green: &green, blue: &blue, alpha: &actualAlpha), file: file, line: line)
      let actual = (UInt32((red * 255).rounded()) << 16) | (UInt32((green * 255).rounded()) << 8) | UInt32((blue * 255).rounded())
      XCTAssertEqual(String(format: "%06X", actual), String(format: "%06X", hex), "\(traits.userInterfaceStyle)", file: file, line: line)
      XCTAssertEqual(actualAlpha, alpha, accuracy: 0.005, "\(traits.userInterfaceStyle)", file: file, line: line)
    }
  }

  func testTokensMatchTheWebsiteInBothModes() {
    assertColor(.factoBackground, light: 0xF5F5F7, dark: 0x380C00)
    assertColor(.factoText, light: 0x380C00, dark: 0xF5F5F7)
    assertColor(.factoTextSecondary, light: 0x380C00, 0.72, dark: 0xF5F5F7, 0.74)
    assertColor(.factoHairline, light: 0x380C00, 0.16, dark: 0xF5F5F7, 0.16)
    assertColor(.factoInverseFill, light: 0x380C00, dark: 0xF5F5F7)
    assertColor(.factoInverseText, light: 0xF5F5F7, dark: 0x380C00)
    assertColor(.factoInverseTextSecondary, light: 0xF5F5F7, 0.74, dark: 0x380C00, 0.72)
    assertColor(.factoVerdictTrue, light: 0x2F6F3E, dark: 0x2F6F3E)
    assertColor(.factoVerdictFalse, light: 0x8B1E24, dark: 0x8B1E24)
    assertColor(.factoOnVerdict, light: 0xF5F5F7, dark: 0xF5F5F7)
    assertColor(.factoOnVerdictSecondary, light: 0xF5F5F7, 0.74, dark: 0xF5F5F7, 0.74)
  }

  func testPaletteMatchesTheWebsite() {
    let expected: [(UIColor, UInt32)] = [
      (FactoPalette.offWhite, 0xF5F5F7), (FactoPalette.mahogany, 0x380C00),
      (FactoPalette.verdictTrue, 0x2F6F3E), (FactoPalette.verdictFalse, 0x8B1E24),
      (FactoPalette.lensTrue, 0x7EA484), (FactoPalette.lensFalse, 0xBD7672),
    ]
    for (color, hex) in expected {
      assertColor(Color(uiColor: color), light: hex, dark: hex)
    }
  }
}
