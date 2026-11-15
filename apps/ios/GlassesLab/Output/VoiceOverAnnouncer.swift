import SwiftUI

/// Speaks a status message through VoiceOver (WCAG 4.1.3), for changes that happen away from
/// the focused element: a verdict nobody heard, the backend going offline. Does nothing while
/// VoiceOver is off.
enum VoiceOverAnnouncer {
  @MainActor
  static func post(_ message: String) {
    guard !message.isEmpty else { return }
    AccessibilityNotification.Announcement(message).post()
  }
}
