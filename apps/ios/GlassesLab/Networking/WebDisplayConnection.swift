import Foundation
import Observation

/// A short-lived read-only capability. Never persist or log the token or generated URL.
struct DisplayGrant: Decodable, Equatable, Sendable, CustomStringConvertible {
  let schemaVersion: Int
  let sessionId: String
  let sessionEpoch: Int
  let displayToken: String
  let expiresAt: String
  let streamPath: String
  var description: String { "DisplayGrant(sessionId: \(sessionId), epoch: \(sessionEpoch), token: <redacted>)" }
}

enum WebDisplayLinkError: Error, Equatable {
  case invalidURL, invalidGrant, staleSession, unavailable
}

enum DisplayOutputMode: String, CaseIterable, Identifiable {
  case native, web
  var id: String { rawValue }
  var title: String { self == .native ? "Native display" : "Web display" }
}

/// The companion remains the owner/capture controller; the web app gets a reader only.
@Observable
@MainActor
final class WebDisplayConnection {
  static let urlKey = "display.webAppURL"
  var appURLText: String {
    didSet {
      // A pasted reader link may contain a token; never save query/fragment-bearing input.
      if let publicURL = try? Self.validatedBaseURL(appURLText) {
        defaults.set(publicURL.absoluteString, forKey: Self.urlKey)
      } else {
        defaults.removeObject(forKey: Self.urlKey)
      }
      invalidate()
    }
  }
  private(set) var link: URL?
  private(set) var expiresAt: Date?
  private(set) var isPreparing = false
  private(set) var message: String?
  @ObservationIgnored private let defaults: UserDefaults
  @ObservationIgnored private let now: () -> Date
  @ObservationIgnored private var sessionId: String?
  @ObservationIgnored private var sessionEpoch: Int?
  @ObservationIgnored private var generation = 0
  @ObservationIgnored private var expiryTask: Task<Void, Never>?

  init(defaults: UserDefaults = .standard, now: @escaping () -> Date = Date.init) {
    self.defaults = defaults
    self.now = now
    self.appURLText = defaults.string(forKey: Self.urlKey) ?? ""
  }

  /// Clear the local share link on an owner epoch change. Server reader revocation is
  /// separate (mode handoff or parent-session end); this method never promises revocation.
  func updateSession(id: String?, epoch: Int?) {
    guard id != sessionId || epoch != sessionEpoch else { return }
    sessionId = id
    sessionEpoch = epoch
    invalidate()
  }

  func invalidate() {
    generation += 1
    expiryTask?.cancel()
    expiryTask = nil
    link = nil
    expiresAt = nil
    isPreparing = false
    message = nil
  }

  func prepare(apiURL: URL, requestGrant: @MainActor () async throws -> DisplayGrant) async {
    invalidate()
    let current = generation
    guard let sessionId, let sessionEpoch else {
      message = "Connect the companion to the backend first."
      return
    }
    isPreparing = true
    do {
      let appURL = try Self.validatedBaseURL(appURLText)
      _ = try Self.validatedBaseURL(apiURL.absoluteString)
      let grant = try await requestGrant()
      guard current == generation else { return }
      guard grant.sessionId == sessionId, grant.sessionEpoch == sessionEpoch else { throw WebDisplayLinkError.staleSession }
      let expiry = try Self.expiry(of: grant, now: now())
      link = try Self.makeURL(appURL: appURL, apiURL: apiURL, grant: grant)
      expiresAt = expiry
      isPreparing = false
      message = "Open this temporary link in the Meta Web Apps launcher. Opening it on this phone is a preview."
      let delay = max(0, expiry.timeIntervalSince(now()))
      expiryTask = Task { [weak self] in
        try? await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
        guard !Task.isCancelled, let self, self.generation == current else { return }
        self.invalidate()
        self.message = "The display link expired. Create a new link."
      }
    } catch {
      guard current == generation else { return }
      isPreparing = false
      message = "Couldn't create a display link. Check the HTTPS web app URL and backend connection, then try again."
    }
  }

  static func expiry(of grant: DisplayGrant, now: Date) throws -> Date {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    let date = formatter.date(from: grant.expiresAt) ?? ISO8601DateFormatter().date(from: grant.expiresAt)
    guard grant.schemaVersion == 1, WireID.isValid(grant.sessionId), grant.sessionEpoch > 0,
          !grant.displayToken.isEmpty, grant.displayToken.count <= 4096,
          grant.streamPath == "/v1/sessions/\(grant.sessionId)/display-stream",
          let date, date > now, date.timeIntervalSince(now) <= 300 else { throw WebDisplayLinkError.invalidGrant }
    return date
  }

  static func validatedBaseURL(_ text: String) throws -> URL {
    guard let components = URLComponents(string: text.trimmingCharacters(in: .whitespacesAndNewlines)),
          let host = components.host?.lowercased(), !host.isEmpty,
          components.user == nil, components.password == nil,
          components.query == nil, components.fragment == nil,
          components.scheme == "https" || (components.scheme == "http" && ["localhost", "127.0.0.1", "[::1]", "::1"].contains(host)),
          let url = components.url else { throw WebDisplayLinkError.invalidURL }
    return url
  }

  static func makeURL(appURL: URL, apiURL: URL, grant: DisplayGrant) throws -> URL {
    _ = try validatedBaseURL(appURL.absoluteString)
    _ = try validatedBaseURL(apiURL.absoluteString)
    guard var components = URLComponents(url: appURL, resolvingAgainstBaseURL: false) else { throw WebDisplayLinkError.invalidURL }
    components.queryItems = [URLQueryItem(name: "display", value: "1"), URLQueryItem(name: "live", value: "1")]
    var fragment = URLComponents()
    fragment.queryItems = [
      URLQueryItem(name: "sessionId", value: grant.sessionId),
      URLQueryItem(name: "displayToken", value: grant.displayToken),
      URLQueryItem(name: "api", value: apiURL.absoluteString),
    ]
    components.percentEncodedFragment = fragment.percentEncodedQuery
    guard let url = components.url else { throw WebDisplayLinkError.invalidURL }
    return url
  }
}
