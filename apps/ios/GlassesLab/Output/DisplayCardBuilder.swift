import Foundation
import MWDATDisplay
import UIKit

// No SwiftUI import here: MWDATDisplay has its own Text, Button and Image.

/// Builds the result card for the Meta Ray-Ban Display lens. The layout is Eric's native lens
/// card (`NativeLensCardLayout`, the hierarchy verified on the Mac fixture) filled with Facto's
/// wording: the verdict word (True, False, Misleading, Can’t verify), the stance count next to
/// it ("3 of 3 sources disagree"), the backend's explanation and the source. Every DAT send
/// replaces the whole screen. Repeat and Dismiss stay on the phone; the lens has no buttons.
///
/// The swatch helpers below draw the website's verdict colours for the phone mirror and tests.
enum DisplayCardBuilder {
  // Retained for the companion's approximate mirror layout.
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
    NativeLensCardLayout.build(
      capture: card.captureLabel,
      claim: card.excerpt,
      verdict: card.verdictWord,
      kind: card.kind,
      context: card.detail,
      detail: card.detailText ?? ResultWording.lensSentence(for: card.kind),
      publisher: card.sourceName,
      includeDot: includeSwatch
    )
  }

  /// The screen the lens shows for a moment after it connects.
  static func buildReady() -> FlexBox {
    FlexBox(direction: .column, spacing: rowSpacing) {
      Text("facto", style: .heading)
      Text("Ready", style: .meta, color: .secondary)
    }
    .padding(padding)
  }

  /// Sends `card` through `send`, with its verdict dot (an image) when `includeSwatch` is true.
  /// If a send with the dot throws, sends the card again without any image.
  ///
  /// - Returns: whether later sends should still include the dot. False once a send with it
  ///   failed and the resend without it worked.
  @MainActor
  static func send(
    _ card: ResultCard,
    includeSwatch: Bool,
    onRepeat: (@Sendable () -> Void)?,
    onDismiss: (@Sendable () -> Void)?,
    using send: (FlexBox) async throws -> Void
  ) async throws -> Bool {
    // Not sure and Check failed have no verdict colour, so they go out without the dot.
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

/// Shared native layout: fixture strings are supplied only by the DEBUG preview builder.
enum NativeLensCardLayout {
  static func build(
    capture: String?, claim: String, verdict: String, kind: CardKind,
    context: String? = nil, detail: String, publisher: String?, includeDot: Bool = true
  ) -> FlexBox {
    FlexBox(
      direction: .column, spacing: 16,
      padding: EdgeInsets(top: 160, bottom: 24, leading: 86, trailing: 86)
    ) {
      if let capture, !capture.isEmpty {
        Text(capture, style: .meta, color: .secondary)
      }
      if !claim.isEmpty {
        Text(claim, style: .heading)
      }
      FlexBox(direction: .column, spacing: 12) {
        FlexBox(direction: .row, spacing: 8, crossAlignment: .center) {
          // Left out after a send with an image failed, so the card still reaches the lens.
          if includeDot { Image(image: dot(for: kind), sizePreset: .icon, cornerRadius: .none) }
          Text(verdict, style: .body)
          if let context, !context.isEmpty {
            Text(context, style: .meta, color: .secondary)
          }
        }
        if !detail.isEmpty { Text(detail, style: .body) }
        if let publisher, !publisher.isEmpty { Text(publisher, style: .meta) }
      }
      .padding(18)
      .background(.card)
    }
  }

  /// Uses only real source hostnames. A source arrival is progress, never a verdict.
  static func searching(
    claimText: String, captureLabel: String? = nil, sources: [ClaimSourcesPayload.Source] = []
  ) -> FlexBox {
    let hostnames = sourceHostnames(sources)
    return FlexBox(
      direction: .column, spacing: 16,
      padding: EdgeInsets(top: 160, bottom: 24, leading: 86, trailing: 86)
    ) {
      if let captureLabel, !captureLabel.isEmpty {
        Text(captureLabel, style: .meta, color: .secondary)
      }
      Text(CardText.excerpt(claimText, maxCodePoints: ResultWording.maxExcerptCodePoints), style: .heading)
      FlexBox(direction: .row, spacing: 4, crossAlignment: .center) {
        Text("Searching...", style: .body, color: .secondary)
        for index in hostnames.indices {
          Image(image: sourceBadge(hostname: hostnames[index], index: index), sizePreset: .icon, cornerRadius: .small)
        }
      }
      .padding(12)
      .background(.card)
      .alignSelf(.start)
    }
  }

  /// Reject URLs, credentials, paths and malformed hosts rather than turning them into icons.
  static func sourceHostnames(_ sources: [ClaimSourcesPayload.Source]) -> [String] {
    var seen = Set<String>()
    return sources.compactMap { source -> String? in
      let host = source.hostname.lowercased()
      guard host.count <= 253,
            host.range(of: #"^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*$"#, options: .regularExpression) != nil,
            URLComponents(string: "https://" + host)?.host?.lowercased() == host,
            seen.insert(host).inserted else { return nil }
      return host
    }.prefix(4).map { $0 }
  }

  private static func sourceBadge(hostname: String, index: Int) -> UIImage {
    // One consistent palette, assigned by arrival order; these are publication initials,
    // not retrieval-provider identities. No remote favicon requests or frame streaming.
    let colors = [
      UIColor(red: 0.66, green: 0.48, blue: 0.33, alpha: 1),
      UIColor(red: 0.23, green: 0.39, blue: 0.65, alpha: 1),
      UIColor(red: 0.47, green: 0.48, blue: 0.53, alpha: 1),
      UIColor(red: 0.35, green: 0.53, blue: 0.51, alpha: 1),
    ]
    let name = hostname.hasPrefix("www.") ? String(hostname.dropFirst(4)) : hostname
    let letter = String(name.prefix(1)).uppercased() as NSString
    return UIGraphicsImageRenderer(size: CGSize(width: 26, height: 26)).image { _ in
      colors[index % colors.count].setFill()
      UIBezierPath(roundedRect: CGRect(x: 0, y: 0, width: 26, height: 26), cornerRadius: 7).fill()
      let attributes: [NSAttributedString.Key: Any] = [
        .font: UIFont.systemFont(ofSize: 18, weight: .semibold), .foregroundColor: UIColor.white,
      ]
      let size = letter.size(withAttributes: attributes)
      letter.draw(at: CGPoint(x: (26 - size.width) / 2, y: (26 - size.height) / 2), withAttributes: attributes)
    }
  }

  private static let trueDot = dot(color: UIColor(red: 0.60, green: 0.70, blue: 0.63, alpha: 1))
  private static let falseDot = dot(color: UIColor(red: 0.75, green: 0.56, blue: 0.57, alpha: 1))
  private static let neutralDot = dot(color: UIColor(red: 0.78, green: 0.74, blue: 0.60, alpha: 1))

  private static func dot(for kind: CardKind) -> UIImage {
    switch kind {
    case .supported: trueDot
    case .contradicted: falseDot
    default: neutralDot
    }
  }

  private static func dot(color: UIColor) -> UIImage {
    UIGraphicsImageRenderer(size: CGSize(width: 26, height: 26)).image { _ in
      color.setFill()
      UIBezierPath(ovalIn: CGRect(x: 7, y: 7, width: 12, height: 12)).fill()
    }
  }
}
