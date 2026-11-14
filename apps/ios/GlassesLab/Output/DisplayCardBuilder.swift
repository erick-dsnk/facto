import Foundation
import MWDATDisplay

// No SwiftUI import here: MWDATDisplay has its own Text, Button and Image.

/// Builds the result card for the Meta Ray-Ban Display lens (600x600). Every send replaces
/// the whole screen, so the card is always complete. When the card is dismissed, call
/// `Display.clearDisplay()` instead of sending an empty layout.
///
/// Layout, top to bottom, inside 24 pt padding with 12 pt spacing:
///   [icon] Verdict word        heading
///   Claim excerpt              body, on a card background
///   Source name                meta, secondary
///   Detail                     meta, secondary
///   [Repeat] [Dismiss]         only when handlers are given
/// LensMirrorView draws the same layout on the phone; keep the two in step.
enum DisplayCardBuilder {
  static let padding: CGFloat = 24
  static let spacing: CGFloat = 12
  static let rowSpacing: CGFloat = 8
  static let excerptPadding: CGFloat = 16

  static func build(
    _ card: ResultCard,
    onRepeat: (@Sendable () -> Void)? = nil,
    onDismiss: (@Sendable () -> Void)? = nil
  ) -> FlexBox {
    FlexBox(direction: .column, spacing: spacing) {
      FlexBox(direction: .row, spacing: rowSpacing, crossAlignment: .center) {
        Icon(name: icon(for: card.kind))
        Text(card.verdictWord, style: .heading)
      }
      if !card.excerpt.isEmpty {
        FlexBox(direction: .column) {
          Text(card.excerpt, style: .body)
        }
        .padding(excerptPadding)
        .background(.card)
      }
      if let sourceLine = card.sourceLine {
        Text(sourceLine, style: .meta, color: .secondary)
      }
      if let detail = card.detail {
        Text(detail, style: .meta, color: .secondary)
      }
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
