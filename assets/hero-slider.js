/* hero-slider.js — the multi-photo hero slider on the Agency & Work Boats page
 * (agency-work-boats/). Built 2026-09-30.
 *
 * Markup: figure.modelhero.hslider > .hs-view > .hs-track > .hs-slide[data-cap][data-hull] > img,
 * plus a figcaption holding .hs-cap and .ref (same header strip as a model-page hero).
 * Without JS the first photo simply shows as a normal hero.
 *
 * Auto-advances every DELAY ms (4s — Tyler, 2026-09-30) and loops seamlessly (a copy of slide 1 sits after
 * the last slide). Arrows, dots, swipe and the arrow keys all work. Autoplay pauses
 * while a mouse is over it, while it has keyboard focus, and while the tab is
 * hidden; with the OS "reduce motion" setting on it never autoplays.
 */
(function () {
  'use strict';
  var DELAY = 4000, SPEED = 700;   // SPEED must match the .hs-track transition in house.css

  var root = document.querySelector('.hslider');
  if (!root) return;
  var view = root.querySelector('.hs-view'), track = root.querySelector('.hs-track');
  var slides = [].slice.call(track.querySelectorAll('.hs-slide'));
  var n = slides.length;
  if (n < 2) return;
  var cap = root.querySelector('.hs-cap'), ref = root.querySelector('.ref');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // seamless loop: a copy of slide 1 after slide N
  var clone = slides[0].cloneNode(true);
  clone.setAttribute('aria-hidden', 'true');
  track.appendChild(clone);

  // ---- controls (built here so a no-JS visitor never sees dead buttons) ----
  function btn(cls, label) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = cls; b.setAttribute('aria-label', label);
    return b;
  }
  var prev = btn('hs-arrow hs-prev', 'Previous photo');
  var next = btn('hs-arrow hs-next', 'Next photo');
  var dotsWrap = document.createElement('div');
  dotsWrap.className = 'hs-dots';
  var dots = slides.map(function (s, j) {
    var d = btn('hs-dot', 'Show photo ' + (j + 1) + ' of ' + n);
    d.addEventListener('click', function () { go(j); restart(); });
    dotsWrap.appendChild(d);
    return d;
  });
  view.appendChild(prev); view.appendChild(next); view.appendChild(dotsWrap);

  // ---- movement ----
  var i = 0, busy = false, settle = null;
  function place(k, animate) {
    track.style.transition = animate ? '' : 'none';
    track.style.transform = 'translate3d(' + (-100 * k) + '%,0,0)';
    if (!animate) void track.offsetWidth;   // commit the jump before the next transition starts
  }
  // data-cap is "MODEL — LEN′ CONFIG — PURPOSE"; split off the model so a phone can
  // show it on its own row beside the hull # (desktop still reads as one line)
  function span(cls, text) { var e = document.createElement('span'); e.className = cls; e.textContent = text; return e; }
  function label(k) {
    var s = slides[k], hull = s.getAttribute('data-hull');
    var parts = (s.getAttribute('data-cap') || '').split(' — ');
    var model = parts.shift();
    cap.textContent = '';
    cap.appendChild(span('hs-model', model));
    if (parts.length) { cap.appendChild(span('hs-sep', ' — ')); cap.appendChild(span('hs-spec', parts.join(' — '))); }
    if (ref) ref.textContent = hull ? 'HULL #' + hull : '';
    dots.forEach(function (d, j) { d.setAttribute('aria-current', j === k ? 'true' : 'false'); });
  }
  function done() {
    clearTimeout(settle); busy = false;
    if (i >= n) { i = 0; place(0, false); }   // landed on the copy of slide 1: jump home unseen
  }
  function go(k) {
    if (busy || k === i) return;
    if (k < 0) { place(n, false); k = n - 1; }   // back from slide 1: start from the copy
    busy = true; i = k;
    place(i, true); label(i % n);
    settle = setTimeout(done, SPEED + 150);   // fallback when transitionend never fires
  }
  track.addEventListener('transitionend', function (e) { if (e.target === track && busy) done(); });

  // ---- autoplay ----
  var timer = null, hover = false, kbFocus = false;
  function stop() { clearTimeout(timer); timer = null; }
  function restart() {
    stop();
    if (reduce || hover || kbFocus || document.hidden) return;
    timer = setTimeout(function () { go(i + 1); restart(); }, DELAY);
  }
  root.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') { hover = true; stop(); } });
  root.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') { hover = false; restart(); } });
  root.addEventListener('focusin', function (e) {
    var kb = false;
    try { kb = e.target.matches(':focus-visible'); } catch (err) {}
    if (kb) { kbFocus = true; stop(); }
  });
  root.addEventListener('focusout', function () { if (kbFocus) { kbFocus = false; restart(); } });
  document.addEventListener('visibilitychange', restart);

  // ---- input ----
  prev.addEventListener('click', function () { go(i - 1); restart(); });
  next.addEventListener('click', function () { go(i + 1); restart(); });
  root.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') { go(i - 1); restart(); e.preventDefault(); }
    else if (e.key === 'ArrowRight') { go(i + 1); restart(); e.preventDefault(); }
  });
  var x0 = null, y0 = 0;   // swipe (touch / pen; .hs-view has touch-action:pan-y)
  view.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse') { x0 = e.clientX; y0 = e.clientY; } });
  view.addEventListener('pointerup', function (e) {
    if (x0 === null) return;
    var dx = e.clientX - x0, dy = e.clientY - y0;
    x0 = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) { go(dx < 0 ? i + 1 : i - 1); restart(); }
  });
  view.addEventListener('pointercancel', function () { x0 = null; });

  // size the caption strip to its tallest caption, so the page below never jumps
  // as slides change (long captions wrap to more lines on a phone)
  var strip = cap.parentNode, rs = null;
  function fitStrip() {
    strip.style.minHeight = '';
    var max = 0;
    slides.forEach(function (s, j) { label(j); max = Math.max(max, strip.offsetHeight); });
    strip.style.minHeight = max + 'px';
    label(i % n);
  }
  window.addEventListener('resize', function () { clearTimeout(rs); rs = setTimeout(fitStrip, 150); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitStrip);

  // slides 2..N are lazy in the markup; fetch them once the page itself has loaded
  window.addEventListener('load', function () {
    track.querySelectorAll('img[loading="lazy"]').forEach(function (im) { im.loading = 'eager'; });
  });

  place(0, false); fitStrip(); restart();
})();
