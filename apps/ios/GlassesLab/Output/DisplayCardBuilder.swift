import Foundation
import MWDATDisplay
import UIKit

/// The production lens uses the same native component hierarchy as the Mac-verified fixture.
/// Every DAT send replaces the complete screen. Controls remain on the companion phone.
enum DisplayCardBuilder {
  // Retained for the companion's approximate mirror layout.
  static let padding: CGFloat = 24
  static let spacing: CGFloat = 12
  static let rowSpacing: CGFloat = 8
  static let excerptPadding: CGFloat = 16

  static func build(
    _ card: ResultCard,
    onRepeat: (@Sendable () -> Void)? = nil,
    onDismiss: (@Sendable () -> Void)? = nil
  ) -> FlexBox {
    NativeLensCardLayout.build(
      capture: card.captureLabel,
      claim: card.excerpt,
      verdict: card.kind == .supported ? "True" : card.kind == .contradicted ? "False" : card.verdictWord,
      kind: card.kind,
      detail: card.detailText ?? ResultWording.line(for: outcome(for: card.kind)),
      publisher: card.sourceName
    )
  }

  private static func outcome(for kind: CardKind) -> OutputOutcome {
    switch kind {
    case .supported: .verdict(.supported)
    case .contradicted: .verdict(.contradicted)
    case .misleading: .verdict(.misleading)
    case .unverified: .verdict(.insufficientEvidence)
    case .needsConfirmation: .needsConfirmation(heard: false)
    case .checkFailed: .checkFailed
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
}

/// Shared native layout: fixture strings are supplied only by the DEBUG preview builder.
enum NativeLensCardLayout {
  static func build(
    capture: String?, claim: String, verdict: String, kind: CardKind,
    context: String? = nil, detail: String, publisher: String?
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
          Image(image: dot(for: kind), sizePreset: .icon, cornerRadius: .none)
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
