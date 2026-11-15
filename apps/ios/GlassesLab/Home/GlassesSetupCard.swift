import SwiftUI

/// The next step to get the glasses working, shown on the home screen in place of the
/// listening controls until the glasses connect.
struct GlassesSetupCard: View {
  let link: WearablesModel.GlassesLink
  /// False when Meta AI can't take a registration, for example when it isn't installed.
  let canRegister: Bool
  let needsFirmwareUpdate: Bool
  let error: String?
  let onConnect: () -> Void
  let onUpdateFirmware: () -> Void

  var body: some View {
    VStack(alignment: .leading, spacing: FactoSpacing.s) {
      Text(isSetUp ? "Glasses not connected" : "Connect your glasses")
        .font(.onest(.title3, weight: .semibold))
        .accessibilityAddTraits(.isHeader)
      Text(message)
        .foregroundStyle(.factoTextSecondary)
        .frame(maxWidth: .infinity, alignment: .leading)

      if !isSetUp, canRegister {
        Button(link == .registering ? "Waiting for Meta AI…" : "Connect with Meta AI", action: onConnect)
          .buttonStyle(.factoPill)
          .disabled(link == .registering)
          .padding(.top, FactoSpacing.xxs)
      }
      if isSetUp, needsFirmwareUpdate {
        Button("Update glasses firmware", action: onUpdateFirmware)
          .buttonStyle(.factoPillSecondary)
          .padding(.top, FactoSpacing.xxs)
      }

      if let error {
        Label(error, systemImage: "exclamationmark.triangle")
          .font(.onest(.footnote))
          .foregroundStyle(.factoText)
      }
    }
    .padding(FactoSpacing.m)
    .frame(maxWidth: .infinity, alignment: .leading)
    .overlay {
      RoundedRectangle(cornerRadius: FactoRadius.panel, style: .continuous)
        .strokeBorder(.factoHairline, lineWidth: 1)
    }
  }

  /// Registered with Meta AI; only the glasses themselves are missing.
  private var isSetUp: Bool {
    link == .noGlasses || link == .connecting
  }

  private var message: String {
    if isSetUp {
      "Turn on your glasses and keep Meta AI open. Facto finds them by itself."
    } else if canRegister {
      "Facto reaches your glasses through the Meta AI app. Turn on Developer Mode there first."
    } else {
      "Install the Meta AI app, then come back."
    }
  }
}

#Preview("Steps") {
  ScrollView {
    VStack(spacing: FactoSpacing.l) {
      GlassesSetupCard(
        link: .notRegistered, canRegister: true, needsFirmwareUpdate: false, error: nil, onConnect: {}, onUpdateFirmware: {}
      )
      GlassesSetupCard(
        link: .registering, canRegister: true, needsFirmwareUpdate: false, error: nil, onConnect: {}, onUpdateFirmware: {}
      )
      GlassesSetupCard(
        link: .notRegistered, canRegister: false, needsFirmwareUpdate: false, error: nil, onConnect: {}, onUpdateFirmware: {}
      )
      GlassesSetupCard(
        link: .noGlasses, canRegister: true, needsFirmwareUpdate: true, error: "Registration: networkUnavailable",
        onConnect: {}, onUpdateFirmware: {}
      )
    }
    .padding(.horizontal, FactoSpacing.gutter)
  }
  .factoScreen()
}
