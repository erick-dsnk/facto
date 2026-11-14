import SwiftUI

/// Debug log controls on the Developer screen: the toggle, what is saved, share and delete.
struct DebugLogSection: View {
  let log: DebugLog
  @State private var isEnabled: Bool
  @State private var stats = DebugLog.Stats()
  @State private var files: [URL] = []
  @State private var isConfirmingDelete = false

  init(log: DebugLog = .shared) {
    self.log = log
    _isEnabled = State(initialValue: log.isEnabled)
  }

  var body: some View {
    Section {
      VStack(alignment: .leading, spacing: 4) {
        Toggle("Debug log", isOn: $isEnabled)
          .factoToggleTint()
          .onChange(of: isEnabled) { _, enabled in log.isEnabled = enabled }
        Text("Off until you turn it on. When on, saves photos, OCR text and transcripts on this phone for 24 hours.")
          .font(.onest(.footnote))
          .foregroundStyle(.factoTextSecondary)
      }
      LabeledContent("Entries", value: "\(stats.entries)")
      LabeledContent("Photos", value: "\(stats.photos)")
      LabeledContent("Size", value: ByteCountFormatter.string(fromByteCount: stats.bytes, countStyle: .file))
      ShareLink(items: files) {
        SwiftUI.Label("Share log", systemImage: "square.and.arrow.up")
      }
      .disabled(files.isEmpty)
      SwiftUI.Button("Delete debug log", role: .destructive) { isConfirmingDelete = true }
        .disabled(stats.isEmpty)
        .confirmationDialog("Delete the debug log?", isPresented: $isConfirmingDelete, titleVisibility: .visible) {
          SwiftUI.Button("Delete", role: .destructive) { Task { await deleteAll() } }
        } message: {
          Text("Removes every saved entry and photo from this phone.")
        }
    } header: {
      SettingsHeader("Debug log")
    } footer: {
      SettingsFooter("Facto never uploads these files. Share them from here or copy them to a Mac with devicectl.")
    }
    .task { await refreshWhileVisible() }
  }

  /// Stats come from memory and the file list is one directory read, so a short poll is cheap.
  private func refreshWhileVisible() async {
    while !Task.isCancelled {
      await refresh()
      try? await Task.sleep(for: .seconds(2))
    }
  }

  private func refresh() async {
    files = await log.files()
    stats = log.stats
  }

  private func deleteAll() async {
    log.deleteAll()
    await log.flush()
    await refresh()
  }
}
