import QuartzCore
import SwiftUI

/// Large millisecond clock for measuring glasses-to-phone frame delay. Black and white on
/// purpose: it has to read clearly through the glasses camera.
struct LatencyClock: View {
  var body: some View {
    TimelineView(.periodic(from: .now, by: 1.0 / 30.0)) { _ in
      let ms = Int((CACurrentMediaTime() * 1000).truncatingRemainder(dividingBy: 100_000))
      Text(String(format: "%05d", ms))
        .font(.system(size: 44, weight: .bold, design: .monospaced))
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
        .background(.black, in: RoundedRectangle(cornerRadius: 8))
        .foregroundStyle(.white)
    }
    .accessibilityHidden(true)
  }
}
