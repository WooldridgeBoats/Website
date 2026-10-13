// history_focus.swift: where each /our-history/ thumbnail should crop (2026-10-13).
//
// The carousel tiles are square, so a tall photo loses its top and bottom and a wide
// one its sides. Tyler: "if the head of a person is cut off, have the thumb show the
// head." This finds faces (macOS Vision), and failing that people's upper bodies, and
// prints a CSS object-position that keeps them in the square. A tall photo with
// nobody found anchors near the top, where heads usually are.
//
// Built and run by _build/build_history.pl:  history_focus <image> ...
// Prints one line per image: "<x>% <y>%"  (the order the images were given)
import Foundation
import Vision
import ImageIO

func focus(_ path: String) -> String {
  guard let src = CGImageSourceCreateWithURL(URL(fileURLWithPath: path) as CFURL, nil),
        let img = CGImageSourceCreateImageAtIndex(src, 0, nil) else { return "50% 50%" }
  let W = Double(img.width), H = Double(img.height)
  if abs(W - H) < 2 { return "50% 50%" }
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
    return String(format: "50%% %.0f%%", top / room * 100)
  } else {     // wide: choose how far across
    guard let u = boxes.reduce(nil as CGRect?, { $0 == nil ? $1 : $0!.union($1) }) else { return "50% 50%" }
    let room = W - S
    let left = max(0, min(room, u.midX - S / 2))
    return String(format: "%.0f%% 50%%", left / room * 100)
  }
}
for p in CommandLine.arguments.dropFirst() { print(focus(p)) }
