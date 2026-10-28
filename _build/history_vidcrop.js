// Heritage Videos: measure YouTube's black bars on each thumbnail and print the 4:3 crop
// box for _build/history_videos.txt (5th field). Old 4:3 footage comes back from YouTube
// padded to widescreen with black side bars (sd/hq thumbnails also get top/bottom bars).
//
// HOW: open /about-history/ in the browser pane, then paste this whole file into
// javascript_tool. It prints one line per video: "ID | wide" (a true 16:9 video, no bars)
// or "ID | x,y,w,h" (the picture with the bars cut off, trimmed 2% so no bar edge shows,
// cut to exactly 4:3). Paste the value after the thumbnail column, then rebuild.
// i.ytimg.com allows cross-origin reads, so the canvas can read the pixels.
(async () => {
  const TH = 8;   // bars are pure black (~1); old film can be dark, so keep this low
  const load = src => new Promise((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = rej; i.src = src; });
  const out = [];
  for (const t of document.querySelectorAll('.hvids .htile')) {
    const im = await load(t.querySelector('img').src); const W = im.naturalWidth, H = im.naturalHeight;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d'); x.drawImage(im, 0, 0); const d = x.getImageData(0, 0, W, H).data;
    const lum = (px, py) => { const k = (py * W + px) * 4; return Math.max(d[k], d[k + 1], d[k + 2]); };
    const colAvg = (cx, y0, y1) => { let s = 0, n = 0; for (let y = y0; y < y1; y += 2) { s += lum(cx, y); n++; } return s / n; };
    const rowAvg = (cy, x0, x1) => { let s = 0, n = 0; for (let xx = x0; xx < x1; xx += 2) { s += lum(xx, cy); n++; } return s / n; };
    // skip up to 12px of bright sliver at the very edge (sd thumbnails have one), then run the bar
    const edge = (f, limit) => { let i = 0; while (i < 12 && f(i) >= TH) i++; if (i >= 12) return 0; while (i < limit && f(i) < TH) i++; return i; };
    const T = edge(i => rowAvg(i, W * .3 | 0, W * .7 | 0), H / 2), B = edge(i => rowAvg(H - 1 - i, W * .3 | 0, W * .7 | 0), H / 2);
    const m = (H - T - B) * .15 | 0;
    const L = edge(i => colAvg(i, T + m, H - B - m), W / 2), R = edge(i => colAvg(W - 1 - i, T + m, H - B - m), W / 2);
    let cx = L, cy = T, cw = W - L - R, ch = H - T - B; const ins = .02;
    cx += cw * ins; cy += ch * ins; cw *= 1 - 2 * ins; ch *= 1 - 2 * ins;
    let w = cw, h = ch; if (cw / ch > 4 / 3) w = ch * 4 / 3; else h = cw * 3 / 4;
    const x0 = cx + (cw - w) / 2, y0 = cy + (ch - h) / 2;
    out.push(L + R < 8 && T + B < 8 ? `${t.dataset.yt} | wide`
      : `${t.dataset.yt} | ${Math.round(x0)},${Math.round(y0)},${Math.round(w)},${Math.round(h)}`);
  }
  return out.join('\n');
})()
