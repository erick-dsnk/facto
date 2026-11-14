import Foundation
import ImageIO
import os

/// On-device debug log for field tests on real glasses.
///
/// While the toggle is on (the default), the app appends one JSON object per line to
/// `Library/Application Support/DebugLog/YYYY-MM-DD.jsonl` (local date) and saves each
/// look-and-check photo next to it as `photo-<UTC timestamp>-<id>.jpg`:
///
///     {"ts":"2026-11-14T15:30:12.345Z","kind":"ws.recv","payload":{...}}
///
/// It keeps what the rest of the app never logs: raw backend events with transcripts, check
/// request bodies with OCR text, and the photos OCR ran on. The project owner turned this on
/// for debugging, with these limits:
/// - Files stay in the app container. The app never uploads them, and the folder is excluded
///   from device backups. Share them from the Debug log section or pull them with devicectl
///   (apps/ios/README.md).
/// - Entries and photos older than 24 hours are deleted on launch and every hour.
/// - The join code, session token, `Authorization` header and API keys are never written:
///   those fields are replaced with "[redacted]", as is any "Bearer …" value.
///
/// All file work runs on one serial utility queue, so callers on the main actor (audio,
/// capture) never wait for the disk. Entries keep the order in which they were logged.
final class DebugLog: @unchecked Sendable {
  static let enabledKey = "debugLog.enabled"
  static let retention: TimeInterval = 24 * 60 * 60
  static let pruneInterval: TimeInterval = 60 * 60
  static let redacted = "[redacted]"

  /// The app's log. Suspended while unit tests run, so the suite never writes into the
  /// simulator's container; tests make their own instance with a temporary directory.
  static let shared = DebugLog(suspended: DebugLog.isRunningTests)

  struct Stats: Equatable, Sendable {
    var entries = 0
    var photos = 0
    var bytes: Int64 = 0

    var isEmpty: Bool { entries == 0 && photos == 0 && bytes == 0 }
  }

  let directory: URL

  private static let osLog = Logger(subsystem: "com.davidvasilescu.junction.glasseslab", category: "debug-log")
  private static let linePrefix = Array("{\"ts\":\"".utf8)
  /// "2026-11-14T15:30:12.345Z": fixed width, so string order is time order.
  private static let timestampLength = 24

  private let defaults: UserDefaults
  private let now: @Sendable () -> Date
  private let suspended: Bool
  private let queue = DispatchQueue(label: "com.davidvasilescu.junction.glasseslab.debug-log", qos: .utility)
  private let lock = NSLock()
  // Guarded by `lock`.
  private var enabled: Bool
  private var currentStats = Stats()
  // Used on `queue` only, except the formatters, which are thread-safe.
  private let timestampFormatter: ISO8601DateFormatter
  private let dayFormatter: DateFormatter
  private let photoStampFormatter: DateFormatter
  private var pruneTimer: DispatchSourceTimer?

  /// - Parameters:
  ///   - directory: defaults to `Library/Application Support/DebugLog`.
  ///   - timeZone: names the day files; entry timestamps are always UTC.
  ///   - now: the clock; tests inject one.
  ///   - suspended: never logs and ignores the toggle.
  init(
    directory: URL? = nil,
    defaults: UserDefaults = .standard,
    timeZone: TimeZone = .current,
    now: @escaping @Sendable () -> Date = { Date() },
    suspended: Bool = false
  ) {
    self.directory = directory ?? Self.defaultDirectory
    self.defaults = defaults
    self.now = now
    self.suspended = suspended
    enabled = !suspended && (defaults.object(forKey: Self.enabledKey) as? Bool ?? true)

    timestampFormatter = ISO8601DateFormatter()
    timestampFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    timestampFormatter.timeZone = TimeZone(identifier: "UTC")
    dayFormatter = DateFormatter()
    dayFormatter.locale = Locale(identifier: "en_US_POSIX")
    dayFormatter.calendar = Calendar(identifier: .gregorian)
    dayFormatter.timeZone = timeZone
    dayFormatter.dateFormat = "yyyy-MM-dd"
    photoStampFormatter = DateFormatter()
    photoStampFormatter.locale = Locale(identifier: "en_US_POSIX")
    photoStampFormatter.calendar = Calendar(identifier: .gregorian)
    photoStampFormatter.timeZone = TimeZone(identifier: "UTC")
    photoStampFormatter.dateFormat = "yyyyMMdd'T'HHmmss.SSS'Z'"

    queue.async { self.recomputeStats() }
  }

  static var defaultDirectory: URL {
    let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
      ?? FileManager.default.temporaryDirectory
    return base.appendingPathComponent("DebugLog", isDirectory: true)
  }

  static let isRunningTests: Bool = {
    let environment = ProcessInfo.processInfo.environment
    return NSClassFromString("XCTestCase") != nil
      || environment["XCTestConfigurationFilePath"] != nil
      || environment["XCTestSessionIdentifier"] != nil
  }()

  // MARK: Toggle and stats

  /// Persisted in UserDefaults. Off stops new entries; existing files stay until deleted or
  /// 24 hours old.
  var isEnabled: Bool {
    get { lock.withLock { enabled } }
    set {
      guard !suspended else { return }
      lock.withLock { enabled = newValue }
      defaults.set(newValue, forKey: Self.enabledKey)
    }
  }

  /// What is on disk now, counted on the log's queue. Cheap to read from any thread.
  var stats: Stats { lock.withLock { currentStats } }

  // MARK: Logging

  /// Appends one entry. `payload` holds JSON values (strings, numbers, booleans, arrays,
  /// dictionaries, nil); anything else is written as its description.
  func log(_ kind: String, _ payload: [String: Any] = [:]) {
    guard isEnabled else { return }
    let date = now()
    let box = UncheckedBox(value: payload)
    queue.async { self.append(kind: kind, payload: box.value, at: date) }
  }

  /// Appends `text` exactly as received (a WebSocket event, say) under `raw`, plus the
  /// envelope's `type` when the text is a JSON object. Malformed text is kept as it is and
  /// marked `"malformed": true`.
  func logJSONText(_ kind: String, _ text: String, _ extra: [String: Any] = [:]) {
    guard isEnabled else { return }
    let date = now()
    let box = UncheckedBox(value: extra)
    queue.async {
      var payload = box.value
      let data = Data(text.utf8)
      if let object = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] {
        if let type = object["type"] as? String { payload["type"] = type }
      } else {
        payload["malformed"] = true
      }
      payload["bytes"] = data.count
      payload["raw"] = text
      self.append(kind: kind, payload: payload, at: date)
    }
  }

  /// Like `log(_:_:)`, with a UTF-8 JSON body (an HTTP request body, say) parsed into the
  /// payload under `key`, so its fields read as JSON. Bytes that don't parse are kept as text.
  func log(_ kind: String, _ payload: [String: Any], jsonBody: Data, key: String = "body") {
    guard isEnabled else { return }
    let date = now()
    let box = UncheckedBox(value: payload)
    queue.async {
      var payload = box.value
      payload[key] = (try? JSONSerialization.jsonObject(with: jsonBody, options: [.fragmentsAllowed]))
        ?? String(decoding: jsonBody, as: UTF8.self)
      self.append(kind: kind, payload: payload, at: date)
    }
  }

  /// Saves `jpeg` as `photo-<UTC timestamp>-<id>.jpg` next to the day file and appends a
  /// `kind` entry naming the file, its byte size and its pixel size. Returns the file name,
  /// or nil when the log is off. The bytes are released once written.
  @discardableResult
  func logPhoto(_ jpeg: Data, kind: String = "photo", id: String, _ payload: [String: Any] = [:]) -> String? {
    guard isEnabled else { return nil }
    let date = now()
    let allowed = String(id.unicodeScalars.filter { $0.isASCII && (CharacterSet.alphanumerics.contains($0) || $0 == "-" || $0 == "_") })
    let safeId = String(allowed.prefix(40))
    let name = "photo-\(photoStampFormatter.string(from: date))-\(safeId.isEmpty ? "photo" : safeId).jpg"
    let box = UncheckedBox(value: payload)
    queue.async {
      var payload = box.value
      payload["file"] = name
      payload["bytes"] = jpeg.count
      if let size = Self.pixelSize(of: jpeg) {
        payload["pixelWidth"] = size.width
        payload["pixelHeight"] = size.height
        payload["exifOrientation"] = size.orientation
      }
      do {
        try self.ensureDirectory()
        try jpeg.write(to: self.directory.appendingPathComponent(name), options: .atomic)
        self.adjustStats(photos: 1, bytes: Int64(jpeg.count))
      } catch {
        payload["file"] = nil
        payload["writeError"] = String(describing: error)
      }
      self.append(kind: kind, payload: payload, at: date)
    }
    return name
  }

  // MARK: Housekeeping

  /// Prunes now, then every hour while the app runs. Pruning runs whether or not the log is
  /// on, so files from an earlier session still go after 24 hours.
  func startAutomaticPruning() {
    queue.async { [weak self] in
      guard let self, self.pruneTimer == nil else { return }
      let timer = DispatchSource.makeTimerSource(queue: self.queue)
      timer.schedule(deadline: .now(), repeating: Self.pruneInterval, leeway: .seconds(60))
      timer.setEventHandler { [weak self] in self?.pruneNow() }
      timer.resume()
      self.pruneTimer = timer
    }
  }

  /// Deletes entries and photos older than 24 hours.
  func prune() {
    queue.async { self.pruneNow() }
  }

  /// Removes every log file and photo.
  func deleteAll() {
    queue.async { self.deleteAllNow() }
  }

  /// The log files, then the photos, oldest first, for the share sheet.
  func files() async -> [URL] {
    await withCheckedContinuation { continuation in
      queue.async { continuation.resume(returning: self.currentFiles()) }
    }
  }

  /// Returns once everything logged so far is on disk.
  func flush() async {
    await withCheckedContinuation { continuation in
      queue.async { continuation.resume() }
    }
  }

  /// Blocks until everything logged so far is on disk. For tests; never call it on the main
  /// thread in the app.
  func waitUntilWritten() {
    queue.sync {}
  }

  // MARK: Redaction

  /// Field names whose values are never written, compared without case, "-" or "_".
  static let secretKeys: Set<String> = [
    "authorization", "proxyauthorization", "cookie", "setcookie",
    "joincode", "token", "sessiontoken", "accesstoken", "refreshtoken", "bearertoken", "clienttoken",
    "apikey", "xapikey", "secret", "clientsecret", "password",
  ]

  static func isSecretKey(_ key: String) -> Bool {
    secretKeys.contains(String(key.lowercased().unicodeScalars.filter { CharacterSet.alphanumerics.contains($0) }))
  }

  private static let secretFieldPattern = try! NSRegularExpression(
    pattern: #"("(?:authorization|proxy-authorization|cookie|join_?code|token|session_?token|access_?token|refresh_?token|bearer_?token|client_?token|api_?key|x-api-key|secret|client_?secret|password)"\s*:\s*)"(?:[^"\\]|\\.)*""#,
    options: [.caseInsensitive]
  )
  private static let bearerPattern = try! NSRegularExpression(pattern: #"\bBearer\s+[A-Za-z0-9._~+/=-]+"#, options: [.caseInsensitive])

  /// Replaces secret fields inside JSON text (`"token":"…"` → `"token":"[redacted]"`) and any
  /// "Bearer …" credential in free text.
  static func redactSecrets(in text: String) -> String {
    guard text.contains("\"") || text.range(of: "bearer", options: .caseInsensitive) != nil else { return text }
    let mutable = NSMutableString(string: text)
    secretFieldPattern.replaceMatches(
      in: mutable, range: NSRange(location: 0, length: mutable.length), withTemplate: "$1\"\(redacted)\""
    )
    bearerPattern.replaceMatches(
      in: mutable, range: NSRange(location: 0, length: mutable.length), withTemplate: "Bearer \(redacted)"
    )
    return mutable as String
  }

  /// Turns a payload value into something `JSONSerialization` accepts, redacting secret
  /// fields on the way.
  static func sanitize(_ value: Any, key: String? = nil) -> Any {
    if let key, isSecretKey(key) { return redacted }
    guard let value = unwrapOptional(value) else { return NSNull() }
    switch value {
    case let string as String:
      return redactSecrets(in: string)
    case let number as NSNumber:
      if CFGetTypeID(number) == CFBooleanGetTypeID() { return number.boolValue }
      let double = number.doubleValue
      return double.isFinite ? number : String(describing: number)
    case let dictionary as [String: Any]:
      var clean: [String: Any] = [:]
      for (key, value) in dictionary { clean[key] = sanitize(value, key: key) }
      return clean
    case let array as [Any]:
      return array.map { sanitize($0) }
    case is NSNull:
      return NSNull()
    case let date as Date:
      return ISO8601DateFormatter().string(from: date)
    case let url as URL:
      return redactSecrets(in: url.absoluteString)
    case let data as Data:
      return "<\(data.count) bytes>"
    default:
      return redactSecrets(in: String(describing: value))
    }
  }

  private static func unwrapOptional(_ value: Any) -> Any? {
    let mirror = Mirror(reflecting: value)
    guard mirror.displayStyle == .optional else { return value }
    guard let child = mirror.children.first else { return nil }
    return unwrapOptional(child.value)
  }

  // MARK: Queue work

  private func append(kind: String, payload: [String: Any], at date: Date) {
    let clean = Self.sanitize(payload) as? [String: Any] ?? [:]
    guard JSONSerialization.isValidJSONObject(clean),
          let payloadData = try? JSONSerialization.data(withJSONObject: clean, options: [.sortedKeys, .withoutEscapingSlashes]),
          let kindData = try? JSONSerialization.data(withJSONObject: kind, options: [.fragmentsAllowed])
    else {
      Self.osLog.error("debug log entry not serializable kind=\(kind, privacy: .public)")
      return
    }
    // Built by hand so "ts" leads every line: pruning reads it without parsing the line.
    var line = Data("{\"ts\":\"\(timestampFormatter.string(from: date))\",\"kind\":".utf8)
    line.append(kindData)
    line.append(contentsOf: Array(",\"payload\":".utf8))
    line.append(payloadData)
    line.append(contentsOf: Array("}\n".utf8))

    let url = directory.appendingPathComponent("\(dayFormatter.string(from: date)).jsonl")
    do {
      try ensureDirectory()
      if !FileManager.default.fileExists(atPath: url.path) {
        FileManager.default.createFile(atPath: url.path, contents: nil)
      }
      let handle = try FileHandle(forWritingTo: url)
      defer { try? handle.close() }
      try handle.seekToEnd()
      try handle.write(contentsOf: line)
      adjustStats(entries: 1, bytes: Int64(line.count))
    } catch {
      Self.osLog.error("debug log write failed: \(String(describing: error), privacy: .public)")
    }
  }

  private func pruneNow() {
    let cutoff = now().addingTimeInterval(-Self.retention)
    let cutoffStamp = timestampFormatter.string(from: cutoff)
    let fileManager = FileManager.default
    guard let names = try? fileManager.contentsOfDirectory(atPath: directory.path) else { return }
    for name in names {
      let url = directory.appendingPathComponent(name)
      if name.hasSuffix(".jsonl") {
        pruneLogFile(url, cutoffStamp: cutoffStamp)
      } else if let taken = photoDate(fileName: name) {
        if taken < cutoff { try? fileManager.removeItem(at: url) }
      } else if let modified = try? url.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate,
                modified < cutoff {
        // Anything else, such as the leftover of an interrupted write.
        try? fileManager.removeItem(at: url)
      }
    }
    recomputeStats()
  }

  /// Keeps only the lines from the last 24 hours. Lines are appended in time order, so a file
  /// whose first line is recent is left alone without reading the rest.
  private func pruneLogFile(_ url: URL, cutoffStamp: String) {
    if let first = firstLineTimestamp(url), first >= cutoffStamp { return }
    // Mapped, so a long day of transcripts isn't copied into memory twice.
    guard let data = try? Data(contentsOf: url, options: .alwaysMapped) else { return }
    var kept = Data()
    var removed = 0
    for line in data.split(separator: UInt8(ascii: "\n")) {
      if let stamp = Self.timestamp(ofLine: line), stamp >= cutoffStamp {
        kept.append(line)
        kept.append(UInt8(ascii: "\n"))
      } else {
        removed += 1
      }
    }
    if kept.isEmpty {
      try? FileManager.default.removeItem(at: url)
    } else if removed > 0 {
      try? kept.write(to: url, options: .atomic)
    }
  }

  private func firstLineTimestamp(_ url: URL) -> String? {
    guard let handle = try? FileHandle(forReadingFrom: url) else { return nil }
    defer { try? handle.close() }
    guard let head = try? handle.read(upToCount: Self.linePrefix.count + Self.timestampLength) else { return nil }
    return Self.timestamp(ofLine: head)
  }

  /// The "ts" value of a line this log wrote, or nil for anything else.
  static func timestamp<Bytes: Collection>(ofLine line: Bytes) -> String? where Bytes.Element == UInt8 {
    guard line.count >= linePrefix.count + timestampLength, line.starts(with: linePrefix) else { return nil }
    let start = line.index(line.startIndex, offsetBy: linePrefix.count)
    let end = line.index(start, offsetBy: timestampLength)
    return String(decoding: line[start..<end], as: UTF8.self)
  }

  private func photoDate(fileName name: String) -> Date? {
    guard name.hasPrefix("photo-"), name.hasSuffix(".jpg") else { return nil }
    return photoStampFormatter.date(from: String(name.dropFirst("photo-".count).prefix(20)))
  }

  private func deleteAllNow() {
    let fileManager = FileManager.default
    for name in (try? fileManager.contentsOfDirectory(atPath: directory.path)) ?? [] {
      try? fileManager.removeItem(at: directory.appendingPathComponent(name))
    }
    recomputeStats()
  }

  private func currentFiles() -> [URL] {
    let names = ((try? FileManager.default.contentsOfDirectory(atPath: directory.path)) ?? []).sorted()
    let logs = names.filter { $0.hasSuffix(".jsonl") }
    let photos = names.filter { $0.hasSuffix(".jpg") }
    return (logs + photos).map { directory.appendingPathComponent($0) }
  }

  private func ensureDirectory() throws {
    guard !FileManager.default.fileExists(atPath: directory.path) else { return }
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    var url = directory
    var values = URLResourceValues()
    values.isExcludedFromBackup = true
    try? url.setResourceValues(values)
  }

  private func recomputeStats() {
    var stats = Stats()
    let names = (try? FileManager.default.contentsOfDirectory(atPath: directory.path)) ?? []
    for name in names {
      let url = directory.appendingPathComponent(name)
      let size = (try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0
      stats.bytes += Int64(size)
      if name.hasSuffix(".jsonl") {
        stats.entries += Self.countLines(in: url)
      } else if name.hasSuffix(".jpg") {
        stats.photos += 1
      }
    }
    lock.withLock { currentStats = stats }
  }

  private func adjustStats(entries: Int = 0, photos: Int = 0, bytes: Int64) {
    lock.withLock {
      currentStats.entries += entries
      currentStats.photos += photos
      currentStats.bytes += bytes
    }
  }

  private static func countLines(in url: URL) -> Int {
    guard let data = try? Data(contentsOf: url, options: .alwaysMapped) else { return 0 }
    return data.withUnsafeBytes { raw -> Int in
      guard var cursor = raw.baseAddress else { return 0 }
      var remaining = raw.count
      var count = 0
      while remaining > 0, let hit = memchr(cursor, 0x0A, remaining) {
        count += 1
        let step = cursor.distance(to: UnsafeRawPointer(hit)) + 1
        cursor += step
        remaining -= step
      }
      return count
    }
  }

  private static func pixelSize(of jpeg: Data) -> (width: Int, height: Int, orientation: Int)? {
    guard let source = CGImageSourceCreateWithData(jpeg as CFData, nil),
          let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
          let width = properties[kCGImagePropertyPixelWidth] as? Int,
          let height = properties[kCGImagePropertyPixelHeight] as? Int
    else { return nil }
    return (width, height, properties[kCGImagePropertyOrientation] as? Int ?? 1)
  }
}

/// Carries a payload of plain JSON values onto the log's queue. Nothing mutates it after the
/// hand-off.
private struct UncheckedBox<Value>: @unchecked Sendable {
  let value: Value
}
