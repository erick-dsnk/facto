import SwiftUI

/// The one screen the wearer needs: status, listening and Check this, what's on the lens,
/// and recent checks. Diagnostics live in Settings → Developer.
struct HomeView: View {
  let wearables: WearablesModel
  let live: LiveModel
  let display: DisplayModel
  let onOpenSettings: () -> Void

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: FactoSpacing.xl) {
        StatusLine(status: status, notice: live.notice, onAction: perform)
        glassesContent
        lensSection
        recentSection
      }
      .padding(.horizontal, FactoSpacing.gutter)
      .padding(.top, FactoSpacing.s)
      .padding(.bottom, FactoSpacing.xl)
    }
    .safeAreaInset(edge: .top, spacing: 0) { topBar }
    .factoScreen()
    .toolbar(.hidden, for: .navigationBar)
  }

  private var status: HomeStatus {
    .make(
      glasses: wearables.glassesLink,
      live: live.status,
      hasJoinCode: !live.joinCode.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    )
  }

  private func perform(_ action: HomeStatus.Action) {
    switch action {
    case .reconnect: Task { await live.reconnect() }
    case .openSettings: onOpenSettings()
    }
  }

  // MARK: Top bar

  private var topBar: some View {
    HStack(spacing: FactoSpacing.s) {
      Text("facto")
        .font(.factoWordmark)
        .tracking(-1)
        .accessibilityLabel("Facto")
        .accessibilityAddTraits(.isHeader)
      Spacer()
      Button(action: onOpenSettings) {
        Image(systemName: "gearshape")
          .font(.onest(.title3))
          .frame(minWidth: 44, minHeight: 44)
          .contentShape(.rect)
      }
      .accessibilityLabel("Settings")
      .accessibilityShowsLargeContentViewer {
        Label("Settings", systemImage: "gearshape")
      }
    }
    // Chrome stays compact at the largest sizes; the gear offers the large content viewer.
    .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
    .padding(.leading, FactoSpacing.gutter)
    .padding(.trailing, FactoSpacing.xs)
    .background(.factoBackground)
  }

  // MARK: Glasses and listening

  @ViewBuilder private var glassesContent: some View {
    if wearables.glassesLink == .connected || live.isListening {
      listeningControls
    } else {
      GlassesSetupCard(
        link: wearables.glassesLink,
        canRegister: wearables.canRegister,
        needsFirmwareUpdate: wearables.needsFirmwareUpdate,
        error: wearables.lastError,
        onConnect: { Task { await wearables.register() } },
        onUpdateFirmware: { Task { await wearables.openFirmwareUpdate() } }
      )
    }
  }

  private var listeningControls: some View {
    VStack(alignment: .leading, spacing: FactoSpacing.s) {
      // Listening checks what's said nearby (camera-stream audio on Ray-Ban Meta, the Bluetooth
      // mic on Display glasses). Check this, by button or by saying it, takes one photo.
      Button(listenTitle) {
        if live.isListening {
          live.stopListening()
        } else {
          Task { await live.startListening() }
        }
      }
      .buttonStyle(FactoPillButtonStyle(size: .large))
      .disabled(!live.isListening && (!live.isConnected || live.isStartingStream))

      Button(checkTitle) { Task { await live.checkThis() } }
        .buttonStyle(.factoPillSecondary)
        .disabled(!live.isConnected || live.isChecking)

      if GlassesSession.shared.needsGlassesAppUpdate {
        Button("Update in Meta AI") { Task { await wearables.openGlassesAppUpdate() } }
          .buttonStyle(.factoPillSecondary)
          .accessibilityHint("Opens App Connections in Meta AI to update Facto on your glasses.")
      }
      if let message = live.checkMessage {
        footnote(message)
      }
      if !live.pendingChecks.isEmpty {
        footnote(live.pendingChecks.count == 1 ? "Waiting for 1 result" : "Waiting for \(live.pendingChecks.count) results")
      }
      if live.wakeWordEnabled {
        footnote(live.wakeState.detail.map { "\(live.wakeState.title). \($0)" } ?? live.wakeState.title)
      }
    }
  }

  private var listenTitle: String {
    if live.isListening { return "Stop listening" }
    return live.isStartingStream ? "Starting…" : "Start listening"
  }

  private var checkTitle: String {
    switch live.checkPhase {
    case .idle: "Check this"
    case .capturing: "Taking photo…"
    case .recognizing: "Reading text…"
    case .submitting: "Sending…"
    }
  }

  // MARK: Lens

  private var lensSection: some View {
    VStack(alignment: .leading, spacing: FactoSpacing.s) {
      SectionHeader(title: "On the lens") {
        Button("Clear") { live.dismissCard() }
          .accessibilityLabel("Clear the lens")
          .disabled(live.lens.card == nil)
      }
      LensPreview(card: live.lens.card)
      footnote(display.isConnected ? "Also on your Meta Ray-Ban Display." : "Shown on this phone only.")
    }
  }

  // MARK: Recent

  private var recentSection: some View {
    VStack(alignment: .leading, spacing: FactoSpacing.xs) {
      SectionHeader(title: "Recent") {
        Button("Repeat") { live.repeatLatest() }
          .disabled(live.isMuted || live.history.latestDelivered == nil)
      }
      if live.history.entries.isEmpty {
        Text("No checks yet. Say “\(WakePhrase.spoken)” or tap Check this.")
          .foregroundStyle(.factoTextSecondary)
          .frame(maxWidth: .infinity, alignment: .leading)
      } else {
        VStack(spacing: 0) {
          ForEach(live.history.entries) { entry in
            if entry.id != live.history.entries.first?.id {
              Divider().overlay(.factoHairline)
            }
            Button { live.show(entry) } label: {
              RecentRow(entry: entry)
                .contentShape(.rect)
            }
            .buttonStyle(.plain)
            .accessibilityHint("Shows it on the lens.")
          }
        }
      }
    }
  }

  private func footnote(_ text: String) -> some View {
    Text(text)
      .font(.onest(.footnote))
      .foregroundStyle(.factoTextSecondary)
      .frame(maxWidth: .infinity, alignment: .leading)
  }
}

/// A home section title with one small outlined button on the trailing edge. At accessibility
/// sizes the button moves under the title so neither gets squeezed.
private struct SectionHeader<Trailing: View>: View {
  let title: String
  @ViewBuilder let trailing: Trailing

  @Environment(\.dynamicTypeSize) private var typeSize

  var body: some View {
    let layout = typeSize.isAccessibilitySize
      ? AnyLayout(VStackLayout(alignment: .leading, spacing: 0))
      : AnyLayout(HStackLayout(alignment: .center, spacing: FactoSpacing.s))
    layout {
      Text(title)
        .font(.onest(.title3, weight: .semibold))
        .accessibilityAddTraits(.isHeader)
        .frame(maxWidth: .infinity, alignment: .leading)
      trailing
        .buttonStyle(HeaderButtonStyle())
    }
  }
}

/// The website's small pill, outlined: Onest medium inside a 1.5 pt capsule, so it reads as a
/// button next to plain labels. The hit area is at least 44 × 44 pt around the capsule.
private struct HeaderButtonStyle: ButtonStyle {
  func makeBody(configuration: Configuration) -> some View {
    HeaderButton(configuration: configuration)
  }

  private struct HeaderButton: View {
    let configuration: ButtonStyleConfiguration
    @Environment(\.isEnabled) private var isEnabled

    var body: some View {
      configuration.label
        .font(.onest(.subheadline, weight: .medium))
        .foregroundStyle(.factoText)
        .padding(.horizontal, FactoSpacing.s)
        .padding(.vertical, FactoSpacing.xs)
        .background { Capsule().strokeBorder(.factoText, lineWidth: 1.5) }
        .frame(minWidth: 44, minHeight: 44)
        .contentShape(.rect)
        .opacity(isEnabled ? (configuration.isPressed ? 0.6 : 1) : 0.4)
    }
  }
}
