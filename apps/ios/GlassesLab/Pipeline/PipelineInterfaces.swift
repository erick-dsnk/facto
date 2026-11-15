import Foundation
import Security

// Seams between the live-pipeline modules. Each module codes against these protocols and
// ships a concrete type plus a test fake; app wiring connects the concrete types.
//
// Rules that apply to every implementation:
// - Provider keys (Deepgram, JEV, Exa) live on the backend only. The app never holds them.
// - Never log raw audio, transcripts or OCR text. Log ids, types and lengths. The exception is
//   the on-device DebugLog (Debug/DebugLog.swift): while its toggle is on it keeps photos, OCR
//   text and transcripts on the phone for 24 hours. Audio bytes are never kept.
// - Stay compatible with contract v1 (Contracts/ContractsV1.swift).

// MARK: - Session channel (Networking)

enum ChannelConnectionState: Equatable, Sendable {
  case idle
  case connecting
  case connected
  /// A blip under ~5 s: reconnecting with a new audio generation. Audio from the gap is
  /// discarded, never replayed.
  case reconnecting(attempt: Int)
  /// Stopped. `reason` is a short code such as "session_ended" or "network_lost", safe to log.
  case disconnected(reason: String)
}

/// The authenticated WebSocket session (`WS /v1/sessions/{id}/stream`).
///
/// The concrete type owns session creation, connect, reconnect and close. Connect the
/// stream before submitting text: there is no event replay.
@MainActor
protocol SessionChannel: AnyObject {
  /// Nil until a session exists.
  var sessionId: String? { get }
  /// Current epoch. Every control message carries it; ignore events from other epochs.
  var sessionEpoch: Int? { get }
  var connectionState: ChannelConnectionState { get }

  /// A new stream of connection-state changes per call. Starts with the current state.
  func connectionStates() -> AsyncStream<ChannelConnectionState>
  /// A new stream of server events per call, so several modules can each subscribe.
  /// Delivers events from the current epoch only, without repeated `eventId`s.
  func events() -> AsyncStream<ServerEvent>
  /// Sends one JSON text frame, e.g. `ControlMessage` or `AudioStartControl`.
  func sendControl<Message: Encodable & Sendable>(_ message: Message) async throws
  /// Sends one binary frame (an audio frame with the 13-byte header from the contract).
  func sendBinary(_ data: Data) async throws
}

// MARK: - Check submission (Networking)

/// `POST /v1/sessions/{id}/checks`. Returns once the server answers 202; the result
/// arrives later on `SessionChannel.events()`.
protocol CheckSubmitter: AnyObject {
  func submit(_ input: TextInputEnvelope) async throws
}

// MARK: - Photo capture (Capture)

/// Takes a still from the glasses camera while the live stream keeps running.
///
/// NEVER stop or pause the camera stream to take a photo. Use
/// `stream.capturePhoto(format: .jpeg)` on the running stream (1080x1440 in about 0.2 s on
/// Ray-Ban Meta Gen 2) and fall back to the photo child of the same running camera.
/// `camera.stop()` belongs only to the user's own Stop stream action.
@MainActor
protocol PhotoCapturing: AnyObject {
  /// JPEG bytes. Keep them in memory and discard after OCR. The only copy written to disk is
  /// the debug log's, made by `LookAndCheckCoordinator` while that log is on.
  func captureStillDuringStream() async throws -> Data
}

// MARK: - Result presentation (Output)

/// Identity of one claim's output. A request can produce up to two claims; never overwrite
/// one claim's result with another's. A higher `revision` supersedes a lower one.
struct ClaimIdentity: Hashable, Sendable {
  var requestId: String
  var claimId: String
  var revision: Int

  /// Nil unless the event carries all three ids (claim.result always does).
  init?(event: ServerEvent) {
    guard let requestId = event.requestId, let claimId = event.claimId, let revision = event.revision else { return nil }
    self.init(requestId: requestId, claimId: claimId, revision: revision)
  }

  init(requestId: String, claimId: String, revision: Int) {
    self.requestId = requestId
    self.claimId = claimId
    self.revision = revision
  }
}

/// Renders a claim result on the lens, the phone and in speech.
///
/// Act on `presentation.action`, not on the verdict: `respond` speaks a short answer plus a
/// card, `notify` plays a chime plus a card, `silent` shows nothing beyond the inspectable
/// history and is never promoted to a warning. URLs are never read aloud.
@MainActor
protocol ResultPresenting: AnyObject {
  /// `presentation` is passed separately because a repeat or a local mute may override
  /// `result.presentation`. `userInitiated` comes from the app's own record of the request.
  func present(_ result: ClaimResult, presentation: Presentation, userInitiated: Bool, identity: ClaimIdentity)
}

// MARK: - Playback reporting (Output -> Networking)

/// Tells the backend when spoken output starts and ends so the ASR drops our own voice.
/// A chime is not playback: do not report it, so listening continues.
@MainActor
protocol PlaybackReporting: AnyObject {
  func playbackStarted()
  func playbackEnded()
}

// MARK: - Backend configuration

/// Where the app finds the backend. The base URL defaults to the hosted backend; a URL saved
/// in UserDefaults overrides it, so a build can point at a laptop without code changes. The
/// join code creates sessions, so it is kept in the Keychain. No secrets in source: the join
/// code defaults to empty and is entered on the device.
struct BackendConfig: Equatable, Sendable {
  static let baseURLKey = "backend.baseURL"
  static let joinCodeKey = "backend.joinCode"
  static let remoteOCRSelectionEnabledKey = "backend.remoteOCRSelectionEnabled"
  /// Set once the one-time removal of old localhost and Railway URLs has run.
  static let baseURLMigratedKey = "backend.baseURLMigrated"
  /// The hosted backend (Cloudflare Workers).
  static let defaultBaseURL = URL(string: "https://actually-api.lively-voice-2bf8.workers.dev")!

  var baseURL: URL
  var joinCode: String
  /// Explicit opt-in: uploads a photo and OCR observations to the configured backend.
  var remoteOCRSelectionEnabled: Bool

  init(baseURL: URL = BackendConfig.defaultBaseURL, joinCode: String = "", remoteOCRSelectionEnabled: Bool = false) {
    self.baseURL = baseURL
    self.joinCode = joinCode
    self.remoteOCRSelectionEnabled = remoteOCRSelectionEnabled
  }

  static func load(from defaults: UserDefaults = .standard, secrets: SecretStoring = KeychainSecretStore()) -> BackendConfig {
    migrateStoredBaseURL(in: defaults)
    let url = defaults.string(forKey: baseURLKey)
      .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
      .flatMap(URL.init(string:))
      .flatMap { $0.scheme == "http" || $0.scheme == "https" ? $0 : nil }
    var joinCode = secrets.read(joinCodeKey)
    // Builds before the Keychain kept the join code in UserDefaults: move it once.
    if let legacy = defaults.string(forKey: joinCodeKey) {
      if joinCode == nil {
        secrets.write(legacy, for: joinCodeKey)
        joinCode = legacy
      }
      defaults.removeObject(forKey: joinCodeKey)
    }
    return BackendConfig(baseURL: url ?? defaultBaseURL, joinCode: joinCode ?? "", remoteOCRSelectionEnabled: defaults.bool(forKey: remoteOCRSelectionEnabledKey))
  }

  /// `connect()` saves the URL it used, so builds before the hosted default kept localhost or
  /// a Railway URL. Runs once: drops such a URL so those installs move to the default. Any
  /// other saved URL (a laptop on the LAN, say) stays.
  static func migrateStoredBaseURL(in defaults: UserDefaults) {
    guard !defaults.bool(forKey: baseURLMigratedKey) else { return }
    defaults.set(true, forKey: baseURLMigratedKey)
    guard let stored = defaults.string(forKey: baseURLKey),
          let host = URL(string: stored.trimmingCharacters(in: .whitespacesAndNewlines))?.host?.lowercased()
    else { return }
    if host == "localhost" || host == "railway.app" || host.hasSuffix(".railway.app") {
      defaults.removeObject(forKey: baseURLKey)
    }
  }

  func save(to defaults: UserDefaults = .standard, secrets: SecretStoring = KeychainSecretStore()) {
    defaults.set(baseURL.absoluteString, forKey: Self.baseURLKey)
    defaults.set(remoteOCRSelectionEnabled, forKey: Self.remoteOCRSelectionEnabledKey)
    defaults.removeObject(forKey: Self.joinCodeKey)
    secrets.write(joinCode, for: Self.joinCodeKey)
  }

  /// `POST /v1/sessions`
  var sessionsURL: URL { baseURL.appending(path: "v1/sessions") }

  /// `POST /v1/sessions/{id}/checks`
  func checksURL(sessionId: String) -> URL {
    baseURL.appending(path: "v1/sessions/\(sessionId)/checks")
  }

  /// `WS /v1/sessions/{id}/stream`: http becomes ws, https becomes wss.
  func streamURL(sessionId: String) -> URL? {
    guard var components = URLComponents(url: baseURL.appending(path: "v1/sessions/\(sessionId)/stream"), resolvingAgainstBaseURL: false)
    else { return nil }
    components.scheme = components.scheme == "https" ? "wss" : "ws"
    return components.url
  }
}

// MARK: - Secrets

/// Small secrets the app keeps on the device, such as the join code.
protocol SecretStoring: Sendable {
  func read(_ key: String) -> String?
  /// Nil or empty deletes the value.
  func write(_ value: String?, for key: String)
}

/// The Keychain, readable after the first unlock and never synced to other devices.
struct KeychainSecretStore: SecretStoring {
  var service = "com.davidvasilescu.junction.glasseslab"

  func read(_ key: String) -> String? {
    var query = baseQuery(key)
    query[kSecReturnData as String] = true
    query[kSecMatchLimit as String] = kSecMatchLimitOne
    var item: CFTypeRef?
    guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess, let data = item as? Data else { return nil }
    return String(data: data, encoding: .utf8)
  }

  func write(_ value: String?, for key: String) {
    SecItemDelete(baseQuery(key) as CFDictionary)
    guard let value, !value.isEmpty else { return }
    var attributes = baseQuery(key)
    attributes[kSecValueData as String] = Data(value.utf8)
    attributes[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
    SecItemAdd(attributes as CFDictionary, nil)
  }

  private func baseQuery(_ key: String) -> [String: Any] {
    [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: key]
  }
}

// MARK: - IDs

/// Wire id helpers. Ids match `^[a-zA-Z0-9_-]+$` and are 1...100 characters.
enum WireID {
  private static let allowed = Set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-".unicodeScalars)

  static func isValid(_ id: String) -> Bool {
    let scalars = id.unicodeScalars
    return (1...ContractsV1.maxIdLength).contains(scalars.count) && scalars.allSatisfy(allowed.contains)
  }

  /// A fresh request id, e.g. "ocr-3f2a...". Use a new one for each deliberate new check;
  /// a correction keeps the id and increments `revision`.
  static func makeRequestId(prefix: String = "ios") -> String {
    "\(prefix)-\(UUID().uuidString.lowercased())"
  }

  /// A fresh capture segment id, e.g. "photo-3f2a...".
  static func makeSegmentId(prefix: String = "seg") -> String {
    "\(prefix)-\(UUID().uuidString.lowercased())"
  }
}
