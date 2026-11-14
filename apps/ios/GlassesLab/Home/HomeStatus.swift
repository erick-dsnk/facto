import Foundation

/// The home screen's status line: the glasses and the backend in one sentence, such as
/// "Glasses connected · Online". Every failure reads differently from the healthy line, so a
/// broken connection never looks like "no alerts".
struct HomeStatus: Equatable, Sendable {
  /// How much attention the line needs, mildest first. Views show it with weight and fill,
  /// never with green or red.
  enum Tone: Int, Comparable, Sendable {
    case good, neutral, warning, bad

    static func < (lhs: Tone, rhs: Tone) -> Bool { lhs.rawValue < rhs.rawValue }
  }

  /// The one button that fixes the current problem.
  enum Action: Equatable, Sendable {
    case reconnect
    case openSettings

    var title: String {
      switch self {
      case .reconnect: "Reconnect"
      case .openSettings: "Open Settings"
      }
    }
  }

  /// "<glasses> · <backend>".
  let text: String
  let detail: String
  /// SF Symbol name.
  let symbol: String
  let tone: Tone
  let action: Action?

  static func make(glasses: WearablesModel.GlassesLink, live: LiveStatus, hasJoinCode: Bool) -> HomeStatus {
    let backend = Backend(live: live, hasJoinCode: hasJoinCode)
    let glassesReady = glasses == .connected
    // A healthy backend has nothing to say while the glasses aren't connected, and "Tap Start
    // listening" would point at a button the home screen doesn't show yet.
    let detail = !glassesReady && live == .connected ? glassesDetail(glasses) : backend.detail
    // The symbol follows the problem the action button fixes; otherwise the glasses.
    let symbol = !glassesReady && backend.action == nil && backend.tone < .bad ? "eyeglasses" : backend.symbol
    return HomeStatus(
      text: "\(glassesText(glasses)) · \(backend.text)",
      detail: detail,
      symbol: symbol,
      tone: max(glassesReady ? .good : .warning, backend.tone),
      action: backend.action
    )
  }

  private static func glassesText(_ link: WearablesModel.GlassesLink) -> String {
    switch link {
    case .connected: "Glasses connected"
    case .connecting: "Glasses connecting…"
    case .noGlasses: "Glasses not connected"
    case .notRegistered, .registering: "Glasses not set up"
    }
  }

  private static func glassesDetail(_ link: WearablesModel.GlassesLink) -> String {
    switch link {
    case .notRegistered: "Connect your glasses to start listening."
    case .registering: "Approve Facto in the Meta AI app."
    case .noGlasses: "Turn on your glasses to start listening."
    case .connecting, .connected: "Keep Meta AI open while your glasses connect."
    }
  }

  /// The backend half of the line.
  private struct Backend {
    var text: String
    var detail: String
    var symbol: String
    var tone: Tone
    var action: Action?

    init(live: LiveStatus, hasJoinCode: Bool) {
      text = live.title
      detail = live.detail
      symbol = live.symbol
      action = nil
      switch live {
      case .connected, .listening:
        tone = .good
      case .connecting, .startingToListen, .reconnecting:
        tone = .warning
      case .offline:
        tone = .warning
        if hasJoinCode {
          action = .reconnect
        } else {
          self = .joinCodeNeeded
        }
      case .listeningStopped(let reason):
        // The user's own Stop reads "Online" (LiveStatus.make never produces it anyway).
        tone = reason == .requested ? .good : .bad
      case .backendError(let code):
        tone = .bad
        symbol = "exclamationmark.triangle.fill"
        if code == "missing_join_code" {
          self = .joinCodeNeeded
        } else {
          action = LiveModel.settingsErrorCodes.contains(code) ? .openSettings : .reconnect
        }
      }
    }

    private init(text: String, detail: String, symbol: String, tone: Tone, action: Action?) {
      self.text = text
      self.detail = detail
      self.symbol = symbol
      self.tone = tone
      self.action = action
    }

    static let joinCodeNeeded = Backend(
      text: "Join code needed", detail: "Add your join code in Settings.", symbol: "key", tone: .warning,
      action: .openSettings
    )
  }
}
