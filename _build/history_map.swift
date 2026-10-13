// history_map.swift: the Rogue River map that closes the /our-history/ timeline (2026-10-13).
//
//   swiftc -O _build/history_map.swift -o <scratchpad>/history_map
//   <scratchpad>/history_map "<…/ABOUT | HISTORY/GENERAL HISTORICAL-UNKOWN DATES/ROGUE RIVER BASIN.JPG>" \
//       assets/history/rogue-map.jpg  > <scratchpad>/rogue-path.txt
//
// 1. Cleans Glen's map scan (a photo of a book page, xiv): crops off the page edge
//    and page number, drops the colour, and pushes the paper to pure white so the
//    page can lay it on with mix-blend-mode:multiply like ink.
// 2. Finds the Rogue's own line from Gold Beach up to Grants Pass, the route of the
//    1947 and 1962 firsts, so the blue line drawn on scroll sits exactly on the river.
//    It's a cheapest-path search over the ink that strongly prefers THICK strokes, so
//    it follows the main river and not the creeks or the lettering.
// Prints the SVG path (in output-pixel coordinates) and its length to stdout.
import Foundation
import CoreGraphics
import CoreImage
import ImageIO
import UniformTypeIdentifiers

let args = CommandLine.arguments
guard args.count >= 3 else { print("usage: history_map <scan.jpg> <out.jpg>"); exit(1) }
let src = CGImageSourceCreateWithURL(URL(fileURLWithPath: args[1]) as CFURL, nil)!
let scan = CGImageSourceCreateImageAtIndex(src, 0, nil)!
let SW = Double(scan.width), SH = Double(scan.height)

// crop, as fractions of the scan (measured on the 3883x2389 original)
let crop = CGRect(x: SW * 0.052, y: SH * 0.036, width: SW * (0.995 - 0.052), height: SH * (0.985 - 0.036))
let OUTW = 2200
let k = Double(OUTW) / Double(crop.width)
let OUTH = Int((Double(crop.height) * k).rounded())

// grayscale, scaled, lighting flattened, then levels: paper -> white, ink -> black
var ci = CIImage(cgImage: scan).cropped(to: CGRect(x: crop.minX, y: SH - crop.maxY, width: crop.width, height: crop.height))
ci = ci.transformed(by: CGAffineTransform(translationX: -crop.minX, y: -(SH - crop.maxY)))
ci = ci.applyingFilter("CIColorControls", parameters: ["inputSaturation": 0])
ci = ci.applyingFilter("CILanczosScaleTransform", parameters: ["inputScale": k, "inputAspectRatio": 1])
// flatten the lighting: the scan is a photo of a book page, shadowed toward the
// lower right. Estimate the bare paper (spread the light paper over the ink, then
// blur) and divide it out, so the whole sheet reads the same white.
let full = CGRect(x: 0, y: 0, width: Double(OUTW), height: (Double(crop.height) * k).rounded())
let paper = ci.clampedToExtent()
  .applyingFilter("CIMorphologyMaximum", parameters: ["inputRadius": 9])
  .applyingFilter("CIGaussianBlur", parameters: ["inputRadius": 28])
  .cropped(to: full)
ci = ci.applyingFilter("CIDivideBlendMode", parameters: ["inputBackgroundImage": ci, kCIInputImageKey: paper]).cropped(to: full)
let lo = 0.30, hi = 0.86, g = 1.0 / (hi - lo)
ci = ci.applyingFilter("CIColorMatrix", parameters: [
  "inputRVector": CIVector(x: g, y: 0, z: 0, w: 0), "inputGVector": CIVector(x: 0, y: g, z: 0, w: 0),
  "inputBVector": CIVector(x: 0, y: 0, z: g, w: 0), "inputBiasVector": CIVector(x: -lo * g, y: -lo * g, z: -lo * g, w: 0)])
ci = ci.applyingFilter("CIColorClamp")
let ctx = CIContext()
let gray = CGColorSpaceCreateDeviceGray()
let out = ctx.createCGImage(ci, from: CGRect(x: 0, y: 0, width: OUTW, height: OUTH), format: .L8, colorSpace: gray)!
let dest = CGImageDestinationCreateWithURL(URL(fileURLWithPath: args[2]) as CFURL, UTType.jpeg.identifier as CFString, 1, nil)!
CGImageDestinationAddImage(dest, out, [kCGImageDestinationLossyCompressionQuality: 0.82] as CFDictionary)
CGImageDestinationFinalize(dest)

// ── read the cleaned pixels back (row 0 = top) ──
let W = OUTW, H = OUTH
var px = [UInt8](repeating: 255, count: W * H)
let bctx = CGContext(data: &px, width: W, height: H, bitsPerComponent: 8, bytesPerRow: W, space: gray, bitmapInfo: 0)!
bctx.draw(out, in: CGRect(x: 0, y: 0, width: W, height: H))
func ink(_ i: Int) -> Bool { px[i] < 110 }

// depth = distance (chamfer 3-4) from each ink pixel to the paper: thick strokes run deep
var depth = [Int](repeating: 0, count: W * H)
let BIG = 1 << 20
for i in 0..<(W * H) { depth[i] = ink(i) ? BIG : 0 }
for y in 1..<(H - 1) { for x in 1..<(W - 1) { let i = y * W + x; if depth[i] == 0 { continue }
  depth[i] = min(depth[i], depth[i - 1] + 3, depth[i - W] + 3, depth[i - W - 1] + 4, depth[i - W + 1] + 4) } }
for y in stride(from: H - 2, through: 1, by: -1) { for x in stride(from: W - 2, through: 1, by: -1) { let i = y * W + x; if depth[i] == 0 { continue }
  depth[i] = min(depth[i], depth[i + 1] + 3, depth[i + W] + 3, depth[i + W + 1] + 4, depth[i + W - 1] + 4) } }

// endpoints: Gold Beach (river mouth) and Grants Pass, as fractions of the output, snapped to the deepest ink nearby
func snap(_ fx: Double, _ fy: Double) -> Int {
  let cx = Int(fx * Double(W)), cy = Int(fy * Double(H)); var best = -1, bd = 0
  for y in max(1, cy - 40)..<min(H - 1, cy + 40) { for x in max(1, cx - 40)..<min(W - 1, cx + 40) {
    let i = y * W + x; let d = depth[i] * 100 - ((x - cx) * (x - cx) + (y - cy) * (y - cy)) / 8
    if depth[i] > 0 && (best < 0 || d > bd) { best = i; bd = d } } }
  return best
}
let start = snap(Double(CommandLine.arguments.count > 3 ? Double(args[3])! : 0.0595), Double(args.count > 4 ? Double(args[4])! : 0.546))
let goal  = snap(Double(args.count > 5 ? Double(args[5])! : 0.486), Double(args.count > 6 ? Double(args[6])! : 0.533))

// cheapest path over ink; a step costs far more on thin ink than on the thick river
var cost = [Double](repeating: .infinity, count: W * H)
var prev = [Int32](repeating: -1, count: W * H)
struct Heap { var a: [(Double, Int)] = []
  mutating func push(_ e: (Double, Int)) { a.append(e); var c = a.count - 1
    while c > 0 { let p = (c - 1) / 2; if a[p].0 <= a[c].0 { break }; a.swapAt(p, c); c = p } }
  mutating func pop() -> (Double, Int)? { guard !a.isEmpty else { return nil }; let r = a[0]; let l = a.removeLast()
    if !a.isEmpty { a[0] = l; var c = 0; while true { let x = 2 * c + 1, y = x + 1; var m = c
      if x < a.count && a[x].0 < a[m].0 { m = x }; if y < a.count && a[y].0 < a[m].0 { m = y }
      if m == c { break }; a.swapAt(m, c); c = m } }; return r } }
var heap = Heap(); cost[start] = 0; heap.push((0, start))
let nb = [(-1, 0, 1.0), (1, 0, 1.0), (0, -1, 1.0), (0, 1, 1.0), (-1, -1, 1.414), (1, -1, 1.414), (-1, 1, 1.414), (1, 1, 1.414)]
while let (c, i) = heap.pop() {
  if i == goal { break }; if c > cost[i] { continue }
  let x = i % W, y = i / W
  for (dx, dy, step) in nb { let nx = x + dx, ny = y + dy
    if nx < 1 || ny < 1 || nx >= W - 1 || ny >= H - 1 { continue }
    let j = ny * W + nx; let d = Double(depth[j]); if d == 0 { continue }
    let nc = c + step * pow(12.0 / d, 3)
    if nc < cost[j] { cost[j] = nc; prev[j] = Int32(i); heap.push((nc, j)) } } }
guard prev[goal] >= 0 else { print("no path found"); exit(2) }
var pts: [(Double, Double)] = []; var i = goal
while i != start { pts.append((Double(i % W), Double(i / W))); i = Int(prev[i]) }
pts.append((Double(start % W), Double(start / W))); pts.reverse()   // Gold Beach -> Grants Pass

// simplify (Ramer-Douglas-Peucker) then emit
func rdp(_ p: ArraySlice<(Double, Double)>, _ eps: Double) -> [(Double, Double)] {
  guard p.count > 2, let f = p.first, let l = p.last else { return Array(p) }
  var dmax = 0.0, idx = p.startIndex
  let dx = l.0 - f.0, dy = l.1 - f.1, len = max(1e-9, (dx * dx + dy * dy).squareRoot())
  for j in p.indices.dropFirst().dropLast() { let d = abs(dy * p[j].0 - dx * p[j].1 + l.0 * f.1 - l.1 * f.0) / len; if d > dmax { dmax = d; idx = j } }
  if dmax <= eps { return [f, l] }
  return Array(rdp(p[p.startIndex...idx], eps).dropLast()) + rdp(p[idx...], eps)
}
let simple = rdp(pts[...], 1.2)
var length = 0.0
for j in 1..<simple.count { length += ((simple[j].0 - simple[j - 1].0) * (simple[j].0 - simple[j - 1].0) + (simple[j].1 - simple[j - 1].1) * (simple[j].1 - simple[j - 1].1)).squareRoot() }
print("size \(W) \(H)")
print("length \(Int(length.rounded()))")
print("start \(start % W) \(start / W)")
print("end \(goal % W) \(goal / W)")
print("path M" + simple.map { String(format: "%.0f %.0f", $0.0, $0.1) }.joined(separator: "L"))
