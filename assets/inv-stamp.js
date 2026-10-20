/* inv-stamp.js: the round rope stamp on the New Inventory hero photos (Tyler, 2026-10-20).
 * window.WBStamp({top:'AVAILABLE', bottom:'NOW'}) returns an SVG string. Clean (no distress),
 * golden-brown rope ring, thin red ring, white top with a red Rockwell word, blue bottom with a
 * white Rockwell word, the site's compass stars (house.css .secrule) round the edge, tilted like
 * a real stamp. The page adds the drop shadow (.invstamp). A SOLD design is still to come:
 * when a boat sells, ask Tyler how it should look before adding it here.
 * Uses the page's Rockwell @font-face (house.css), so it must stay an inline SVG, not an <img>.
 */
(function () {
  'use strict';
  var RED = '#b8262c', BLUE = '#1b75bb';
  var C = 200, TILT = -14;
  function f(n) { return n.toFixed(2); }
  function pt(r, deg) { var a = deg * Math.PI / 180; return [C + r * Math.cos(a), C + r * Math.sin(a)]; }

  /* rope ring: each strand is a lens leaning ~50deg across the rope, shaded so it reads round */
  function rope() {
    var R = 185, W = 20, rin = R - W / 2, rout = R + W / 2, N = 72;   // "a tad thinner" rope (Tyler)
    var step = 360 / N, lean = step * 2.1, out = '';
    for (var i = 0; i < N; i++) {
      var a = i * step, up = '', dn = '', mid = '', hi = '', k, t, p;
      for (k = 0; k <= 8; k++) { t = k / 8; p = pt(rin + W * t, a + lean * t + Math.sin(Math.PI * t) * step * 0.55); up += (k ? 'L' : 'M') + f(p[0]) + ' ' + f(p[1]); }
      for (k = 8; k >= 0; k--) { t = k / 8; p = pt(rin + W * t, a + lean * t - Math.sin(Math.PI * t) * step * 0.55); dn += 'L' + f(p[0]) + ' ' + f(p[1]); }
      for (k = 1; k <= 7; k++) {
        t = k / 8;
        p = pt(rin + W * t, a + lean * t - Math.sin(Math.PI * t) * step * 0.3);  mid += (k > 1 ? 'L' : 'M') + f(p[0]) + ' ' + f(p[1]);
        p = pt(rin + W * t, a + lean * t + Math.sin(Math.PI * t) * step * 0.12); hi  += (k > 1 ? 'L' : 'M') + f(p[0]) + ' ' + f(p[1]);
      }
      out += '<path d="' + up + dn + 'Z" fill="#c79f5c" stroke="#5e4218" stroke-width="1.9" stroke-linejoin="round"/>' +
             '<path d="' + mid + '" fill="none" stroke="#a47c3c" stroke-width="3.2" stroke-linecap="round" opacity=".75"/>' +
             '<path d="' + hi + '" fill="none" stroke="#f3e1b4" stroke-width="2.2" stroke-linecap="round" opacity=".9"/>';
    }
    return '<circle cx="200" cy="200" r="' + R + '" fill="none" stroke="#c79f5c" stroke-width="' + W + '"/>' + out +
           '<circle cx="200" cy="200" r="' + rout + '" fill="none" stroke="#4f3712" stroke-width="2.2"/>' +
           '<circle cx="200" cy="200" r="' + rin + '" fill="none" stroke="#4f3712" stroke-width="2.2"/>';
  }
  var ROPE = null;   // same ring on every stamp: build it once

  /* compass stars round the face, kept off the split line and off both words */
  function stars() {
    var split = 14, out = '', s = 19;
    for (var k = 0; k < 24; k++) {
      var p = pt(147, k * 15 + 7.5), xx = p[0] - C, yy = p[1] - C, pad = 13;
      if (yy > split - 14) continue;                 // top (red) half only (Tyler, 2026-10-20)
      if (xx > -133 - pad && xx < 135 + pad && yy > -48 - pad && yy < -8 + pad) continue;
      if (xx > -100 - pad && xx < 118 + pad && yy > split + 22 - pad && yy < split + 90 + pad) continue;
      out += '<path transform="translate(' + f(p[0] - s / 2) + ' ' + f(p[1] - s / 2) + ') scale(' + f(s / 24) + ')" ' +
             'd="M12 1L13.7 10.3L23 12L13.7 13.7L12 23L10.3 13.7L1 12L10.3 10.3Z" fill="' + RED + '"/>';
    }
    return out;
  }

  var n = 0;
  window.WBStamp = function (o) {
    o = o || {};
    var top = o.top || 'AVAILABLE', bottom = o.bottom || 'NOW', id = 'wbst' + (++n);
    if (!ROPE) ROPE = rope();
    return '<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' + top + ' ' + bottom + '">' +
      '<defs><clipPath id="' + id + '"><circle cx="200" cy="200" r="161"/></clipPath></defs>' +
      '<g transform="rotate(' + TILT + ' 200 200)">' +
        '<circle cx="200" cy="200" r="176" fill="#fff"/>' +
        '<circle cx="200" cy="200" r="166" fill="none" stroke="' + RED + '" stroke-width="4"/>' +
        '<g clip-path="url(#' + id + ')"><rect x="0" y="214" width="400" height="200" fill="' + BLUE + '"/></g>' +
        stars() +
        '<text transform="translate(202 188) scale(.88 1)" text-anchor="middle" font-family="Rockwell, Georgia, serif" font-weight="700" font-size="46" letter-spacing="4" fill="' + RED + '">' + top + '</text>' +
        '<text transform="translate(209 302) scale(.86 1)" text-anchor="middle" font-family="Rockwell, Georgia, serif" font-weight="700" font-size="90" letter-spacing="9" fill="#fff">' + bottom + '</text>' +
        ROPE +
      '</g></svg>';
  };
})();
