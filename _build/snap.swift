// snap.swift: full-size page screenshots WITHOUT Chrome (headless Chrome trips macOS App Management on
// Tyler's Mac). Loads the page in an offscreen WKWebView and writes a 2x PNG of one region.
// Build:  swiftc -O _build/snap.swift -o <scratchpad>/snap
// Run:    <scratchpad>/snap "http://127.0.0.1:8814/models/<slug>/" out.png 1440 2400 <y> <height>
//         (width, view height, then the region from the top in CSS px; keep y+height inside the view height)
import Cocoa
import WebKit
// usage: snap <url> <out.png> <width> <viewHeight> <y> <h>
let a = CommandLine.arguments
let url = URL(string: a[1])!, out = a[2]
let W = CGFloat(Double(a[3])!), VH = CGFloat(Double(a[4])!), Y = CGFloat(Double(a[5])!), H = CGFloat(Double(a[6])!)
let app = NSApplication.shared
app.setActivationPolicy(.accessory)
class D: NSObject, WKNavigationDelegate {
  func webView(_ w: WKWebView, didFinish n: WKNavigation!) {
    DispatchQueue.main.asyncAfter(deadline: .now() + 4) {
      let c = WKSnapshotConfiguration(); c.rect = CGRect(x: 0, y: Y, width: W, height: H)
      w.takeSnapshot(with: c) { img, err in
        guard let img = img, let t = img.tiffRepresentation, let r = NSBitmapImageRep(data: t),
              let p = r.representation(using: .png, properties: [:]) else { print("snap failed \(String(describing: err))"); exit(1) }
        try! p.write(to: URL(fileURLWithPath: out)); print("wrote \(out)"); exit(0)
      }
    }
  }
}
let win = NSWindow(contentRect: NSRect(x: -30000, y: -30000, width: W, height: VH), styleMask: [.borderless], backing: .buffered, defer: false)
let wv = WKWebView(frame: NSRect(x: 0, y: 0, width: W, height: VH))
let d = D(); wv.navigationDelegate = d
win.contentView = wv; win.orderBack(nil)
wv.load(URLRequest(url: url))
DispatchQueue.main.asyncAfter(deadline: .now() + 30) { print("timeout"); exit(2) }
app.run()
