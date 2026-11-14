#if DEBUG
import MWDATDisplay

/// Comparison fixtures only. These are real DAT components, not a phone-side mirror.
enum NativeCardPreviewFixture: String, CaseIterable, Identifiable, Hashable {
  case searching = "Searching"
  case supported = "True"
  case contradicted = "False"
  case listening = "Listening"
  case checking = "Checking"
  var id: String { rawValue }
}

enum NativeCardPreviewBuilder {
  static func build(_ fixture: NativeCardPreviewFixture, sourceCount: Int = 0) -> FlexBox {
    if fixture == .listening || fixture == .checking {
      return NativeTriggerFeedbackBuilder.build(fixture == .listening ? .listening : .checking)
    }
    let isFalse = fixture == .contradicted
    if fixture != .searching {
      return NativeLensCardLayout.build(
        capture: isFalse ? "Heard nearby" : "Read from screen",
        claim: isFalse ? "Goldfish only remember things\nfor three seconds." : "The Eiffel Tower grows up to\n15 cm taller in summer.",
        verdict: isFalse ? "False" : "True",
        kind: isFalse ? .contradicted : .supported,
        context: isFalse ? "· 3 of 3 sources disagree" : "· official site",
        detail: isFalse ? "“Goldfish can remember things\nfor months, not seconds.”" : "“The tower can grow up to 15 cm\nas its iron expands in the heat.”",
        publisher: isFalse ? "Live Science" : "toureiffel.paris"
      )
    }
    return NativeLensCardLayout.searching(
      claimText: "The Eiffel Tower grows up to\n15 cm taller in summer.",
      captureLabel: "Read from screen",
      sources: Array(fixtureSources.prefix(min(4, max(0, sourceCount))))
    )
  }

  private static let fixtureSources = ["toureiffel.paris", "britannica.com", "wikipedia.org", "sciencemuseum.org.uk"].map { host in
    ClaimSourcesPayload.Source(id: host, hostname: host, title: host, stage: "found", provider: "fixture")
  }
}
#endif
