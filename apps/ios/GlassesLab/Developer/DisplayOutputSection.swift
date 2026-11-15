import SwiftUI

/// Where cards go on Meta Ray-Ban Display glasses: the native DAT display (default) or the
/// hosted web app, which gets a temporary reader link. The phone keeps the wake phrase, photo
/// capture and spoken output in either mode. Ported from Eric's Live screen controls (#60).
struct DisplayOutputSection: View {
  @Bindable var live: LiveModel

  var body: some View {
    Section {
      Picker("Display output", selection: $live.displayOutputMode) {
        ForEach(DisplayOutputMode.allCases) { mode in
          Text(mode.title).tag(mode)
        }
      }
      if live.displayOutputMode == .web {
        TextField("HTTPS glasses web app URL", text: Binding(
          get: { live.webDisplay.appURLText }, set: { live.webDisplay.appURLText = $0 }
        ))
        .keyboardType(.URL)
        .textContentType(.URL)
        .textInputAutocapitalization(.never)
        .autocorrectionDisabled()
        Button(live.webDisplay.isPreparing ? "Creating link…" : "Create temporary display link") {
          Task { await live.prepareWebDisplay() }
        }
        .disabled(!live.isConnected || live.webDisplay.isPreparing || live.isSwitchingDisplay)
        if let link = live.webDisplay.link {
          ShareLink(item: link) { Label("Share display link", systemImage: "square.and.arrow.up") }
          Link("Preview on this phone", destination: link)
        }
        if let expiry = live.webDisplay.expiresAt {
          Text("Link expires at \(expiry.formatted(date: .omitted, time: .shortened)).")
            .font(.onest(.footnote))
            .foregroundStyle(.factoTextSecondary)
        }
        if let message = live.webDisplay.message {
          Text(message)
            .font(.onest(.footnote))
            .foregroundStyle(.factoTextSecondary)
        }
      }
    } header: {
      SettingsHeader("Glasses display")
    } footer: {
      SettingsFooter(
        live.displayOutputMode == .web
          ? "Open the hosted web app on Meta Ray-Ban Display with this temporary reader link. The phone still owns the wake phrase, photos and spoken answers. Make a fresh link after a reconnect or a new session."
          : "Native display uses the glasses’ DAT display connection below. The phone card and spoken answers work in either mode."
      )
    }
  }
}
