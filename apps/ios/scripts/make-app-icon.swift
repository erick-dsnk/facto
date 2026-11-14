#!/usr/bin/env swift
// Draws the Facto app icon: the website favicon's lens glyph in off-white on mahogany.
//
//   swift scripts/make-app-icon.swift GlassesLab/Assets.xcassets/AppIcon.appiconset/AppIcon.png
//
// Output: 1024x1024, opaque (no alpha channel), sRGB, full bleed. iOS rounds the corners.
// The glyph is the favicon path "M14 22h36l-3 18c-1 5-5 8-10 8h-10c-5 0-9-3-10-8z"
// (64x64 box) scaled x16. CoreGraphics draws with y up, so every SVG y becomes 1024 - y.

import CoreGraphics
import Foundation
import ImageIO

let side = 1024
let mahogany = (red: 0x38, green: 0x0C, blue: 0x00)
let offWhite = (red: 0xF5, green: 0xF5, blue: 0xF7)

func color(_ rgb: (red: Int, green: Int, blue: Int), in space: CGColorSpace) -> CGColor {
  let components = [CGFloat(rgb.red) / 255, CGFloat(rgb.green) / 255, CGFloat(rgb.blue) / 255, 1]
  return CGColor(colorSpace: space, components: components)!
}

/// SVG coordinates (y down) to CoreGraphics coordinates (y up).
func point(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
  CGPoint(x: x, y: CGFloat(side) - y)
}

let arguments = CommandLine.arguments
guard arguments.count == 2 else {
  FileHandle.standardError.write(Data("usage: make-app-icon.swift <output.png>\n".utf8))
  exit(64)
}
let output = URL(fileURLWithPath: arguments[1])

let space = CGColorSpace(name: CGColorSpace.sRGB)!
guard let context = CGContext(
  data: nil, width: side, height: side, bitsPerComponent: 8, bytesPerRow: 0, space: space,
  bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue
) else {
  FileHandle.standardError.write(Data("could not create the bitmap context\n".utf8))
  exit(1)
}

context.setFillColor(color(mahogany, in: space))
context.fill(CGRect(x: 0, y: 0, width: side, height: side))

let glyph = CGMutablePath()
glyph.move(to: point(224, 352))
glyph.addLine(to: point(800, 352))
glyph.addLine(to: point(752, 640))
glyph.addCurve(to: point(592, 768), control1: point(736, 720), control2: point(672, 768))
glyph.addLine(to: point(432, 768))
glyph.addCurve(to: point(272, 640), control1: point(352, 768), control2: point(288, 720))
glyph.closeSubpath()

context.setShouldAntialias(true)
context.setFillColor(color(offWhite, in: space))
context.addPath(glyph)
context.fillPath()

guard let image = context.makeImage(),
      let destination = CGImageDestinationCreateWithURL(output as CFURL, "public.png" as CFString, 1, nil)
else {
  FileHandle.standardError.write(Data("could not encode the PNG\n".utf8))
  exit(1)
}
CGImageDestinationAddImage(destination, image, nil)
guard CGImageDestinationFinalize(destination) else {
  FileHandle.standardError.write(Data("could not write \(output.path)\n".utf8))
  exit(1)
}
print("wrote \(output.path) (\(side)x\(side))")
