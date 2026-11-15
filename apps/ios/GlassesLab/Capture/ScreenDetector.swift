import CoreGraphics
import CoreImage
import Foundation
import Vision

// Finds the display (laptop, monitor, phone, TV) the wearer is looking at. A rectangle only
// counts as the screen when it holds recognised text, so an empty frame or window is
// ignored. Nothing here keeps or logs text; scoring sees only line boxes.

/// A quadrilateral in Vision's normalised coordinates (origin bottom-left) of the upright image.
struct ScreenQuad: Equatable, Sendable {
  var topLeft: CGPoint
  var topRight: CGPoint
  var bottomRight: CGPoint
  var bottomLeft: CGPoint

  init(topLeft: CGPoint, topRight: CGPoint, bottomRight: CGPoint, bottomLeft: CGPoint) {
    self.topLeft = topLeft
    self.topRight = topRight
    self.bottomRight = bottomRight
    self.bottomLeft = bottomLeft
  }

  /// An axis-aligned quad covering `rect`.
  init(rect: CGRect) {
    self.init(
      topLeft: CGPoint(x: rect.minX, y: rect.maxY), topRight: CGPoint(x: rect.maxX, y: rect.maxY),
      bottomRight: CGPoint(x: rect.maxX, y: rect.minY), bottomLeft: CGPoint(x: rect.minX, y: rect.minY)
    )
  }

  init(_ observation: VNRectangleObservation) {
    self.init(
      topLeft: observation.topLeft, topRight: observation.topRight,
      bottomRight: observation.bottomRight, bottomLeft: observation.bottomLeft
    )
  }

  var corners: [CGPoint] { [topLeft, topRight, bottomRight, bottomLeft] }

  /// Exact homography from a corrected unit square back to the original quadrilateral.
  /// Both spaces have bottom-left origins. This also preserves skewed line polygons.
  var unitToOriginal: [Double] {
    let p = [bottomLeft, bottomRight, topRight, topLeft]
    let x = p.map { Double($0.x) }, y = p.map { Double($0.y) }
    let dx1 = x[1] - x[2], dx2 = x[3] - x[2], dx3 = x[0] - x[1] + x[2] - x[3]
    let dy1 = y[1] - y[2], dy2 = y[3] - y[2], dy3 = y[0] - y[1] + y[2] - y[3]
    let determinant = dx1 * dy2 - dx2 * dy1
    let g: Double, h: Double
    if abs(dx3) + abs(dy3) < 1e-12 || abs(determinant) < 1e-12 { g = 0; h = 0 }
    else { g = (dx3 * dy2 - dx2 * dy3) / determinant; h = (dx1 * dy3 - dx3 * dy1) / determinant }
    return [x[1] - x[0] + g * x[1], x[3] - x[0] + h * x[3], x[0],
            y[1] - y[0] + g * y[1], y[3] - y[0] + h * y[3], y[0], g, h, 1]
  }

  func mapFromUnit(_ points: [OCRTargetPoint]) -> [OCRTargetPoint] {
    let m = unitToOriginal
    return points.map { p in
      let divisor = m[6] * p.x + m[7] * p.y + m[8]
      return .init(x: (m[0] * p.x + m[1] * p.y + m[2]) / divisor,
                   y: (m[3] * p.x + m[4] * p.y + m[5]) / divisor)
    }
  }

  /// Shoelace area (normalised units squared).
  var area: CGFloat {
    let points = corners
    var sum: CGFloat = 0
    for index in points.indices {
      let a = points[index], b = points[(index + 1) % points.count]
      sum += a.x * b.y - b.x * a.y
    }
    return abs(sum) / 2
  }

  /// Even-odd point-in-polygon test.
  func contains(_ point: CGPoint) -> Bool {
    let points = corners
    var inside = false
    var previous = points[points.count - 1]
    for current in points {
      if (current.y > point.y) != (previous.y > point.y),
         point.x < (previous.x - current.x) * (point.y - current.y) / (previous.y - current.y) + current.x {
        inside.toggle()
      }
      previous = current
    }
    return inside
  }
}

enum ScreenDetector {
  /// A candidate needs at least this many text lines inside it...
  static let minimumLineCount = 2
  /// ...covering at least this much of the image (normalised area, about 0.4%).
  static let minimumTextArea: CGFloat = 0.004
  /// A quad covering nearly the whole photo is the photo's own edge, not a display.
  static let maximumQuadArea: CGFloat = 0.92
  /// A nested candidate holding at least this share of the best text score wins on tighter framing.
  static let nestedScoreShare: CGFloat = 0.9

  /// Whether a recognised line belongs to a quad: its centre and at least three corners lie inside.
  static func holds(_ quad: ScreenQuad, line box: CGRect) -> Bool {
    guard quad.contains(CGPoint(x: box.midX, y: box.midY)) else { return false }
    let corners = [
      CGPoint(x: box.minX, y: box.minY), CGPoint(x: box.maxX, y: box.minY),
      CGPoint(x: box.minX, y: box.maxY), CGPoint(x: box.maxX, y: box.maxY),
    ]
    return corners.filter(quad.contains).count >= 3
  }

  /// Index into `quads` of the one that is the screen, or nil. Each quad scores the lines it
  /// holds (count and total area). The best score wins, except that a smaller quad holding
  /// nearly as much text frames the text better and takes over.
  static func chooseScreen(quads: [ScreenQuad], lineBoxes: [CGRect]) -> Int? {
    struct Score { var index: Int; var textArea: CGFloat; var quadArea: CGFloat }
    let scores = quads.enumerated().compactMap { index, quad -> Score? in
      let quadArea = quad.area
      guard quadArea <= maximumQuadArea else { return nil }
      let held = lineBoxes.filter { holds(quad, line: $0) }
      let textArea = held.reduce(0) { $0 + $1.width * $1.height }
      guard held.count >= minimumLineCount, textArea >= minimumTextArea else { return nil }
      return Score(index: index, textArea: textArea, quadArea: quadArea)
    }
    guard let best = scores.max(by: { $0.textArea < $1.textArea }) else { return nil }
    return scores
      .filter { $0.textArea >= best.textArea * nestedScoreShare }
      .min { $0.quadArea < $1.quadArea }?.index
  }

  /// Rectangles tuned for a display seen at an angle from head height: wide aspect range,
  /// generous perspective skew, and a size floor so small stray boxes are ignored.
  static func detectRectangles(in image: CGImage, orientation: CGImagePropertyOrientation) throws -> [ScreenQuad] {
    let request = VNDetectRectanglesRequest()
    request.minimumAspectRatio = 0.3
    request.maximumAspectRatio = 1.0
    request.minimumSize = 0.15
    request.quadratureTolerance = 30
    request.maximumObservations = 8
    request.minimumConfidence = 0.5
    try VNImageRequestHandler(cgImage: image, orientation: orientation, options: [:]).perform([request])
    return (request.results ?? []).map(ScreenQuad.init)
  }

  /// A perspective-corrected, upright crop of `quad`. Vision and Core Image both use a
  /// bottom-left origin, so the corners scale straight to pixels of the oriented image.
  static func crop(_ image: CGImage, orientation: CGImagePropertyOrientation, quad: ScreenQuad) -> CGImage? {
    let upright = CIImage(cgImage: image).oriented(orientation)
    let extent = upright.extent
    func point(_ p: CGPoint) -> CIVector {
      CIVector(x: extent.minX + p.x * extent.width, y: extent.minY + p.y * extent.height)
    }
    guard let filter = CIFilter(name: "CIPerspectiveCorrection") else { return nil }
    filter.setValue(upright, forKey: kCIInputImageKey)
    filter.setValue(point(quad.topLeft), forKey: "inputTopLeft")
    filter.setValue(point(quad.topRight), forKey: "inputTopRight")
    filter.setValue(point(quad.bottomRight), forKey: "inputBottomRight")
    filter.setValue(point(quad.bottomLeft), forKey: "inputBottomLeft")
    guard let output = filter.outputImage, output.extent.width >= 8, output.extent.height >= 8,
          output.extent.width.isFinite, output.extent.height.isFinite
    else { return nil }
    return CIContext().createCGImage(output, from: output.extent)
  }
}
