// history_focus.swift: where each /our-history/ thumbnail should crop (2026-10-13).
//
// The carousel tiles are square, so a tall photo loses its top and bottom and a wide
// one its sides. Tyler: "if the head of a person is cut off, have the thumb show the
// head." This finds faces (macOS Vision), and failing that people's upper bodies, and
// prints a CSS object-position that keeps them in the square. A tall photo with
// nobody found anchors near the top, where heads usually are.
//
// Built and run by _build/build_history.pl:
//   history_focus <image> ...                      prints "<x>% <y>%" per image (CSS object-position)
//   history_focus --crop <in> <out.png> [<in> <out.png> ...]
//                                                  also CUTS each one square at that spot (lossless PNG)
// (The cut happens here, not in sips: sips ignores a --cropOffset of 0 0 and centre-crops,
//  which is exactly the "keep the top" case for a tall photo.)
import Foundation
import Vision
import ImageIO
import CoreImage
import UniformTypeIdentifiers

// The tiles' light sepia, baked in (Tyler, 2026-10-15). It used to be a CSS filter
// (sepia(.14) contrast(1.03)) on all ~150 tiles, which iPhone Safari re-ran on every tile
// at every zoom level when the page was pinch-zoomed. Same maths as the CSS: the Filter
// Effects sepia matrix at 0.14, then contrast 1.03, on gamma-encoded sRGB values.
let ciCtx = CIContext(options: [.workingColorSpace: CGColorSpace(name: CGColorSpace.sRGB)!,
                                .outputColorSpace: CGColorSpace(name: CGColorSpace.sRGB)!])
func warm(_ img: CGImage) -> CGImage {
  let a = 0.14, k = 1 - a, c = 1.03, b = 0.5 - 0.5 * c
  let m = [[0.393 + 0.607 * k, 0.769 - 0.769 * k, 0.189 - 0.189 * k],
           [0.349 - 0.349 * k, 0.686 + 0.314 * k, 0.168 - 0.168 * k],
           [0.272 - 0.272 * k, 0.534 - 0.534 * k, 0.131 + 0.869 * k]]
  let ci = CIImage(cgImage: img).applyingFilter("CIColorMatrix", parameters: [
    "inputRVector": CIVector(x: m[0][0] * c, y: m[0][1] * c, z: m[0][2] * c, w: 0),
    "inputGVector": CIVector(x: m[1][0] * c, y: m[1][1] * c, z: m[1][2] * c, w: 0),
    "inputBVector": CIVector(x: m[2][0] * c, y: m[2][1] * c, z: m[2][2] * c, w: 0),
    "inputAVector": CIVector(x: 0, y: 0, z: 0, w: 1),
    "inputBiasVector": CIVector(x: b, y: b, z: b, w: 0)]).applyingFilter("CIColorClamp")
  return ciCtx.createCGImage(ci, from: CGRect(x: 0, y: 0, width: img.width, height: img.height),
                             format: .RGBA8, colorSpace: CGColorSpace(name: CGColorSpace.sRGB)!) ?? img
}

func focus(_ path: String, cropTo out: String? = nil) -> String {
  guard let src = CGImageSourceCreateWithURL(URL(fileURLWithPath: path) as CFURL, nil),
        let img = CGImageSourceCreateImageAtIndex(src, 0, nil) else { return "50% 50%" }
  let W = Double(img.width), H = Double(img.height)
  func cut(_ x: Double, _ y: Double) {
    guard let out = out else { return }
    let S = min(img.width, img.height)
    let sq = img.cropping(to: CGRect(x: Int(x.rounded()), y: Int(y.rounded()), width: S, height: S)) ?? img
    let d = CGImageDestinationCreateWithURL(URL(fileURLWithPath: out) as CFURL, UTType.png.identifier as CFString, 1, nil)!
    CGImageDestinationAddImage(d, warm(sq), nil); CGImageDestinationFinalize(d)
  }
  if abs(W - H) < 2 { cut(0, 0); return "50% 50%" }
  let faces = VNDetectFaceRectanglesRequest()
  let people = VNDetectHumanRectanglesRequest(); people.upperBodyOnly = true
  try? VNImageRequestHandler(cgImage: img, options: [:]).perform([faces, people])
  // Vision boxes are normalised with the origin bottom-left; flip to top-left pixels
  func px(_ r: CGRect) -> CGRect { CGRect(x: r.minX * W, y: (1 - r.maxY) * H, width: r.width * W, height: r.height * H) }
  var boxes = (faces.results ?? []).filter { $0.confidence > 0.5 }.map { px($0.boundingBox) }
  var fromBody = false
  if boxes.isEmpty {
    // upper bodies: keep the top quarter of each box, which is roughly the head
    boxes = (people.results ?? []).filter { $0.confidence > 0.4 }.map { let b = px($0.boundingBox); return CGRect(x: b.minX, y: b.minY, width: b.width, height: b.height * 0.25) }
    fromBody = !boxes.isEmpty
  }
  let S = min(W, H)
  if H > W {   // tall: choose how far down to slide the square
    let room = H - S
    var top: Double
    if let u = boxes.reduce(nil as CGRect?, { $0 == nil ? $1 : $0!.union($1) }) {
      // heads sit a little above the middle of the square; never cut the top of the highest one
      top = min(u.midY - S * 0.42, u.minY - S * (fromBody ? 0.04 : 0.08))
    } else { top = room * 0.12 }
    top = max(0, min(room, top))
    cut(0, top)
    return String(format: "50%% %.0f%%", top / room * 100)
  } else {     // wide: choose how far across
    let room = W - S
    guard let u = boxes.reduce(nil as CGRect?, { $0 == nil ? $1 : $0!.union($1) }) else { cut(room / 2, 0); return "50% 50%" }
    let left = max(0, min(room, u.midX - S / 2))
    cut(left, 0)
    return String(format: "%.0f%% 50%%", left / room * 100)
  }
}
var a = Array(CommandLine.arguments.dropFirst())
if a.first == "--crop" {
  a.removeFirst()
  for k in stride(from: 0, to: a.count - 1, by: 2) { print(focus(a[k], cropTo: a[k + 1])) }
} else { for p in a { print(focus(p)) } }
