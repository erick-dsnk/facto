import Foundation
import MWDATDisplay
import UIKit

// No SwiftUI import here: MWDATDisplay has its own Text, Button and Image.

/// Builds the result card for the Meta Ray-Ban Display lens (600x600), in the website
/// popup's look. Every send replaces the whole screen, so the card is always complete. When
/// the card is dismissed, call `Display.clearDisplay()` instead of sending an empty layout.
///
/// MWDATDisplay draws text in two colours on one dark card background, so the verdict colour
/// reaches the lens as a small image: the website's swatch, lightened toward white as the
/// popup does (`FactoPalette.lensTrue` / `lensFalse`). Layout, inside 24 pt padding with
/// 12 pt spacing:
///
///     Claim excerpt                      body, secondary
///     ┌ card ───────────────────────┐
///     │ [swatch] Verdict word         heading
///     │ Detail                        body, secondary
///     │ Source name                   meta
///     └─────────────────────────────┘
///     [Repeat] [Dismiss]                 only when handlers are given
///
/// Not sure, Check failed and sends without swatches show the kind's icon instead.
enum DisplayCardBuilder {
  static let padding: CGFloat = 24
  static let spacing: CGFloat = 12
  /// Spacing inside the card and between the swatch and the verdict word.
  static let rowSpacing: CGFloat = 8
  static let cardPadding: CGFloat = 16

  /// Swatch bitmap side and corner radius, in pixels.
  static let swatchPixels: CGFloat = 64
  static let swatchCornerRadius: CGFloat = 14
  /// Width of the Can’t verify ring, in pixels.
  static let swatchRingWidth: CGFloat = 4

  static func build(
    _ card: ResultCard,
    includeSwatch: Bool = true,
    onRepeat: (@Sendable () -> Void)? = nil,
    onDismiss: (@Sendable () -> Void)? = nil
  ) -> FlexBox {
    let swatch = includeSwatch ? swatchImage(for: card.kind) : nil
    return FlexBox(direction: .column, spacing: spacing) {
      if !card.excerpt.isEmpty {
        Text(card.excerpt, style: .body, color: .secondary)
      }
      FlexBox(direction: .column, spacing: rowSpacing) {
        FlexBox(direction: .row, spacing: rowSpacing, crossAlignment: .center) {
          if let swatch {
            // The bitmap has its own rounded corners. `.small` would clip the icon-sized
            // image to a circle and cut the Can’t verify ring (seen on the simulated Display).
            Image(image: swatch, sizePreset: .icon, cornerRadius: .none)
          } else {
            Icon(name: icon(for: card.kind))
          }
          Text(card.verdictWord, style: .heading)
        }
        if let detail = card.detail {
          Text(detail, style: .body, color: .secondary)
        }
        if let sourceLine = card.sourceLine {
          Text(sourceLine, style: .meta)
        }
      }
      .padding(cardPadding)
      .background(.card)
      if onRepeat != nil || onDismiss != nil {
        ButtonGroup(alignment: .start) {
          if let onRepeat {
            Button(label: "Repeat", style: .secondary, onClick: onRepeat)
          }
          if let onDismiss {
            Button(label: "Dismiss", style: .outline, onClick: onDismiss)
          }
        }
      }
    }
    .padding(padding)
  }

  /// The screen the lens shows for a moment after it connects.
  static func buildReady() -> FlexBox {
    FlexBox(direction: .column, spacing: rowSpacing) {
      Text("facto", style: .heading)
      Text("Ready", style: .meta, color: .secondary)
    }
    .padding(padding)
  }

  /// Sends `card` through `send`, with its swatch when `includeSwatch` is true. If a send
  /// with a swatch throws, sends the card again with the icon instead.
  ///
  /// - Returns: whether later sends should still include swatches. False once a send with
  ///   a swatch failed and the resend without it worked.
  @MainActor
  static func send(
    _ card: ResultCard,
    includeSwatch: Bool,
    onRepeat: (@Sendable () -> Void)?,
    onDismiss: (@Sendable () -> Void)?,
    using send: (FlexBox) async throws -> Void
  ) async throws -> Bool {
    guard includeSwatch, swatchImage(for: card.kind) != nil else {
      try await send(build(card, includeSwatch: false, onRepeat: onRepeat, onDismiss: onDismiss))
      return includeSwatch
    }
    do {
      try await send(build(card, includeSwatch: true, onRepeat: onRepeat, onDismiss: onDismiss))
      return true
    } catch {
      try await send(build(card, includeSwatch: false, onRepeat: onRepeat, onDismiss: onDismiss))
      return false
    }
  }

  static func icon(for kind: CardKind) -> IconName {
    switch kind {
    case .supported: .checkmarkCircle
    case .contradicted: .exclamationTriangle
    case .misleading: .exclamationCircle
    case .unverified: .iCircle
    case .needsConfirmation: .eye
    case .checkFailed: .x
    }
  }

  // MARK: Swatches

  /// The verdict swatch for the lens: 64x64 px, corner radius 14. True and False use the
  /// lens verdict colours, Misleading is off-white and Can’t verify is a 4 px off-white ring.
  /// Nil for Not sure and Check failed, which show an icon. Drawn once per kind.
  static func swatchImage(for kind: CardKind) -> UIImage? {
    swatches[kind]
  }

  private static let swatches: [CardKind: UIImage] = {
    let kinds: [CardKind] = [.supported, .contradicted, .misleading, .unverified]
    return Dictionary(uniqueKeysWithValues: kinds.compactMap { kind in drawSwatch(kind).map { (kind, $0) } })
  }()

  private enum SwatchStyle {
    case fill(UIColor)
    case ring(UIColor)
  }

  private static func swatchStyle(for kind: CardKind) -> SwatchStyle? {
    switch kind {
    case .supported: .fill(FactoPalette.lensTrue)
    case .contradicted: .fill(FactoPalette.lensFalse)
    case .misleading: .fill(FactoPalette.offWhite)
    case .unverified: .ring(FactoPalette.offWhite)
    case .needsConfirmation, .checkFailed: nil
    }
  }

  private static func drawSwatch(_ kind: CardKind) -> UIImage? {
    guard let style = swatchStyle(for: kind) else { return nil }
    let format = UIGraphicsImageRendererFormat()
    format.scale = 1
    format.opaque = false
    format.preferredRange = .standard
    let rect = CGRect(x: 0, y: 0, width: swatchPixels, height: swatchPixels)
    return UIGraphicsImageRenderer(size: rect.size, format: format).image { _ in
      switch style {
      case .fill(let color):
        color.setFill()
        UIBezierPath(roundedRect: rect, cornerRadius: swatchCornerRadius).fill()
      case .ring(let color):
        // Stroke on the centre line, inset so the whole ring stays inside the bitmap.
        let inset = swatchRingWidth / 2
        let path = UIBezierPath(roundedRect: rect.insetBy(dx: inset, dy: inset), cornerRadius: swatchCornerRadius - inset)
        path.lineWidth = swatchRingWidth
        color.setStroke()
        path.stroke()
      }
    }
  }

  // MARK: Inspection

  /// The text of every Text node, depth first. For tests and debug logging of lengths;
  /// never log the strings themselves.
  static func textContents(of box: FlexBox) -> [String] {
    box.children.flatMap { child -> [String] in
      if let text = child as? Text { return [text.content] }
      if let nested = child as? FlexBox { return textContents(of: nested) }
      if let group = child as? ButtonGroup { return group.buttons.map(\.label) }
      return []
    }
  }

  /// True when the layout contains an image, i.e. a verdict swatch.
  static func containsImage(_ box: FlexBox) -> Bool {
    box.children.contains { child in
      if child is Image { return true }
      if let nested = child as? FlexBox { return containsImage(nested) }
      return false
    }
  }
}
