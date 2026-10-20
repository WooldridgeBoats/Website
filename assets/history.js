/* history.js: the /our-history/ timeline (2026-10-12).
   1. the rope between dates draws itself in blue as you scroll; each date's
      compass star lights when the rope reaches it; the big ghost year drifts
   2. each date's carousel: arrows, "3 / 10" counter, edge fades
   3. one flip-through viewer for every photo and video on the page, in order,
      so "next" runs from the end of one date into the start of the next
   4. the year rail on wide screens
   5. the closing Rogue River map: its route upriver draws itself on scroll
   6. From the Archives: the taped-in brochures settle in, and open in the viewer
   7. Heritage Videos: a strip of little video thumbs that play in the viewer
   Markup comes from _build/build_history.pl; styles are the OUR HISTORY block
   in house.css. Without JS everything still shows and tiles open the image.
   The homepage's Featured Videos (2026-10-20) is the same strip (.hvidcar, from
   _build/build_home_videos.pl), so on that page only 2, 3 and 7 run. */
(function () {
  var page = document.querySelector('.hist');
  var eras = [].slice.call(document.querySelectorAll('.hera'));
  var timeline = !!(page && eras.length);
  if (!timeline && !document.querySelector('.hvidcar')) return;
  if (page) page.classList.add('hjs');
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── 1 + 4: scroll-driven rope, stars, ghost years, rail ── */
  var rail = document.querySelector('.hrail'), railLinks = [];
  var tl = document.querySelector('.htl');
  // the brochure strip runs nearly side to side, so the rail steps aside while it passes
  // through its spot; Heritage Videos are sized to clear the rail instead (Tyler, 2026-10-14)
  var wideStrips = [].slice.call(document.querySelectorAll('.hclipcar .htrack'));
  if (rail) {
    eras.forEach(function (e) {
      var a = document.createElement('a');
      a.href = '#' + e.id; a.textContent = e.getAttribute('data-yr');
      rail.appendChild(a); railLinks.push(a);
    });
  }
  var parts = eras.map(function (e) {
    return { el: e, seg: e.querySelector('.hseg'), fill: e.querySelector('.hseg i'),
             head: e.querySelector('.hhead'), ghost: e.querySelector('.hghost') };
  });
  // the closing map: rope into it, then the route upriver draws as it comes up the screen
  var map = document.querySelector('.hmap'), mapLine, mapGlow, mapArt, mapRope, mapLen = 0;
  var extraRopes = [].slice.call(document.querySelectorAll('.harch .hseg i, .hmap .hseg i, .hvids .hseg i'));
  if (map) {
    mapLine = map.querySelector('.hmap-line'); mapGlow = map.querySelector('.hmap-glow');
    mapArt = map.querySelector('.hmap-art'); mapRope = map.querySelector('.hseg i');
    mapLen = mapLine.getTotalLength();
    [mapLine, mapGlow].forEach(function (p) { p.style.strokeDasharray = mapLen; });
  }
  function drawMap(vh, reach) {
    extraRopes.forEach(function (i) {
      var s = i.parentNode.getBoundingClientRect();
      i.style.height = (Math.max(0, Math.min(1, (reach - s.top) / s.height)) * 100).toFixed(2) + '%';
    });
    var r = mapArt.getBoundingClientRect();
    var f = reduce ? 1 : Math.max(0, Math.min(1, (vh * 0.85 - r.top) / (vh * 0.45 + r.height * 0.35)));
    var off = (mapLen * (1 - f)).toFixed(1);
    mapLine.style.strokeDashoffset = off; mapGlow.style.strokeDashoffset = off;
    map.classList.toggle('done', f >= 0.995);
  }
  var queued = false;
  function frame() {
    queued = false;
    var vh = window.innerHeight, reach = vh * 0.62, cur = 0;
    parts.forEach(function (p, i) {
      var r = p.seg.getBoundingClientRect();
      var f = Math.max(0, Math.min(1, (reach - r.top) / r.height));
      p.fill.style.height = (f * 100).toFixed(2) + '%';
      p.el.classList.toggle('lit', f >= 1);
      if (r.top < reach) cur = i;
      if (p.ghost && !reduce) {
        var h = p.head.getBoundingClientRect();
        var c = (h.top + h.height / 2 - vh / 2) / vh;
        if (c > -1.2 && c < 1.2) p.ghost.style.transform = 'translate(-50%,-50%) translateY(' + (c * 46).toFixed(1) + 'px)';
      }
    });
    if (map) drawMap(vh, reach);
    if (rail) {
      railLinks.forEach(function (a, i) { a.classList.toggle('on', i === cur); });
      var t = tl.getBoundingClientRect();
      var rr = rail.getBoundingClientRect();
      var clash = wideStrips.some(function (w) { var b = w.getBoundingClientRect(); return b.bottom > rr.top && b.top < rr.bottom; });
      rail.classList.toggle('on', t.top < vh * 0.55 && t.bottom > vh * 0.45 && !clash);
    }
  }
  function queue() { if (!queued) { queued = true; requestAnimationFrame(frame); } }
  if (timeline) {
    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue);
    frame();
  }

  /* fade each date in as it arrives */
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('seen'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -12% 0px' });
    eras.forEach(function (e) { io.observe(e); });
    var arch = document.querySelector('.harch .hclips');
    if (arch) new IntersectionObserver(function (es, o) {
      es.forEach(function (en) { if (en.isIntersecting) { en.target.closest('.harch').classList.add('seen'); o.disconnect(); } });
    }, { rootMargin: '0px 0px -18% 0px' }).observe(arch);
  } else {
    eras.forEach(function (e) { e.classList.add('seen'); });
    [].forEach.call(document.querySelectorAll('.harch'), function (a) { a.classList.add('seen'); });
  }

  /* ── 3: the viewer's page list (built before the carousels so tiles know their index) ── */
  var items = [];
  // the scrapbook sits above the timeline, so it opens the book
  var clips = [].slice.call(document.querySelectorAll('.hclip'));
  clips.forEach(function (t, n) {
    t.setAttribute('data-i', items.length);
    items.push({ src: t.getAttribute('href'), alt: (t.querySelector('img') || {}).alt || '',
      pc: t.getAttribute('data-cap') || '', yr: 'From the Archives', cap: '', n: n + 1, of: clips.length });
  });

  eras.forEach(function (e) {
    var tiles = [].slice.call(e.querySelectorAll('.htile'));
    var cap = e.querySelector('.hcap');
    tiles.forEach(function (t, n) {
      t.setAttribute('data-i', items.length);
      items.push({
        yt: t.getAttribute('data-yt'), src: t.getAttribute('href'),
        title: t.getAttribute('data-vtitle'), alt: (t.querySelector('img') || {}).alt || '',
        pc: t.hasAttribute('data-yt') ? '' : (t.getAttribute('data-cap') || ''),   // the tile only shows the date
        yr: e.getAttribute('data-yr'), cap: cap ? cap.innerHTML : '', n: n + 1, of: tiles.length
      });
    });
  });

  // the Heritage Videos strip (after the timeline, above the map) closes the book;
  // on the homepage the Featured Videos strip is the whole book (its data-label is the blue title)
  [].forEach.call(document.querySelectorAll('.hvidcar'), function (car) {
    var hv = [].slice.call(car.querySelectorAll('.htile'));
    var label = car.getAttribute('data-label') || 'Heritage Videos';
    hv.forEach(function (t, n) {
      t.setAttribute('data-i', items.length);
      items.push({ yt: t.getAttribute('data-yt'), title: t.getAttribute('data-vtitle'), alt: '',
        pc: '', yr: label, cap: '', n: n + 1, of: hv.length });
    });
  });

  /* ── 2: carousels ── */
  [].slice.call(document.querySelectorAll('.hcar')).forEach(function (car) {
    var track = car.querySelector('.htrack');
    // the edge fades sit over the track in this wrapper (house.css .hview): no mask on the scroller
    var view = document.createElement('div'); view.className = 'hview';
    track.parentNode.insertBefore(view, track); view.appendChild(track);
    var tiles = [].slice.call(track.children);
    var prev = car.querySelector('.hprev'), next = car.querySelector('.hnext'), count = car.querySelector('.hcount');
    // the little scroll bar under the prints: shows where you are, click or drag it to move
    var bar = document.createElement('div'), thumb = document.createElement('i');
    bar.className = 'hbar'; bar.setAttribute('aria-hidden', 'true'); bar.appendChild(thumb);
    car.insertBefore(bar, car.querySelector('.hcarui'));
    function seek(ev) {
      var r = bar.getBoundingClientRect(), max = track.scrollWidth - track.clientWidth;
      var f = (ev.clientX - r.left - thumb.offsetWidth / 2) / (r.width - thumb.offsetWidth);
      track.scrollTo({ left: Math.max(0, Math.min(1, f)) * max, behavior: 'auto' });
    }
    var dragging = false;
    bar.addEventListener('pointerdown', function (ev) { dragging = true; bar.setPointerCapture(ev.pointerId); car.classList.add('drag'); seek(ev); });
    bar.addEventListener('pointermove', function (ev) { if (dragging) seek(ev); });
    bar.addEventListener('pointerup', function () { dragging = false; car.classList.remove('drag'); });
    function step() { return tiles.length > 1 ? tiles[1].offsetLeft - tiles[0].offsetLeft : track.clientWidth; }
    function update() {
      var max = track.scrollWidth - track.clientWidth;
      var fits = max <= 2;
      car.classList.toggle('fits', fits);
      car.classList.toggle('more-l', !fits && track.scrollLeft > 4);
      car.classList.toggle('more-r', !fits && track.scrollLeft < max - 4);
      if (count) {
        // the tile nearest the middle of the track is "the one you're on"
        var mid = track.scrollLeft + track.clientWidth / 2, at = 0, best = 1e9;
        tiles.forEach(function (t, i) { var d = Math.abs(t.offsetLeft + t.offsetWidth / 2 - mid); if (d < best) { best = d; at = i; } });
        if (track.scrollLeft < 4) at = 0; else if (track.scrollLeft > max - 4) at = tiles.length - 1;
        count.innerHTML = '<b>' + (at + 1) + '</b> / ' + tiles.length;
      }
      var vis = track.clientWidth / track.scrollWidth;
      thumb.style.width = (vis * 100).toFixed(2) + '%';
      thumb.style.left = (max > 0 ? track.scrollLeft / max * (1 - vis) * 100 : 0).toFixed(2) + '%';
      if (prev) prev.disabled = track.scrollLeft < 4;
      if (next) next.disabled = track.scrollLeft > max - 4;
    }
    if (prev) prev.addEventListener('click', function () { track.scrollBy({ left: -step(), behavior: reduce ? 'auto' : 'smooth' }); });
    if (next) next.addEventListener('click', function () { track.scrollBy({ left: step(), behavior: reduce ? 'auto' : 'smooth' }); });
    track.addEventListener('scroll', function () { requestAnimationFrame(update); }, { passive: true });
    window.addEventListener('resize', update);
    tiles.forEach(function (t) { var im = t.querySelector('img'); if (im && !im.complete) im.addEventListener('load', update); });
    update();
  });

  /* ── 3: the viewer ── */
  var lb, fig, yrEl, txtEl, nEl, bPrev, bNext, at = -1, lastFocus = null;
  function build() {
    lb = document.createElement('div');
    lb.className = 'hlb'; lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-modal', 'true');
    lb.setAttribute('aria-label', timeline ? 'Wooldridge history photos' : 'Wooldridge videos');
    lb.innerHTML =
      '<button type="button" class="hlb-x">CLOSE &#10005;</button>' +
      '<div class="hlb-stage"><button type="button" class="hlb-prev" aria-label="Previous"></button>' +
      '<div class="hlb-fig"></div><button type="button" class="hlb-next" aria-label="Next"></button></div>' +
      '<div class="hlb-cap"><div class="hlb-yr"></div><div class="hlb-txt"></div><div class="hlb-n"></div></div>';
    document.body.appendChild(lb);
    fig = lb.querySelector('.hlb-fig'); yrEl = lb.querySelector('.hlb-yr');
    txtEl = lb.querySelector('.hlb-txt'); nEl = lb.querySelector('.hlb-n');
    bPrev = lb.querySelector('.hlb-prev'); bNext = lb.querySelector('.hlb-next');
    lb.querySelector('.hlb-x').addEventListener('click', close);
    bPrev.addEventListener('click', function () { go(-1); });
    bNext.addEventListener('click', function () { go(1); });
    lb.querySelector('.hlb-stage').addEventListener('click', function (ev) { if (ev.target === ev.currentTarget) close(); });
    // Touch (Tyler, 2026-10-15): pinch zooms the PHOTO, never the page; drag to look around
    // while zoomed; double-tap zooms in on that spot and back out. Only a clear one-finger
    // swipe flips, never during or after a pinch. Before, any finger moving 45px flipped
    // (so pinching flipped), and a pinch zoomed the whole page with 200+ photos behind the
    // viewer, which made iPhone Safari run out of memory and reload the page.
    lb.addEventListener('touchstart', function (ev) {
      var t = ev.touches;
      if (t.length >= 2) {
        if (!zimg()) { G = { multi: true }; return; }
        var m = mid(t), h = home();
        G = { multi: true, pinch: true, d0: dist(t), s0: Z.s, x0: Z.x, y0: Z.y, mx: m.x, my: m.y, cx: h.cx, cy: h.cy };
      } else if (!G) {
        G = { x: t[0].clientX, y: t[0].clientY, t: Date.now(), px: Z.x, py: Z.y, moved: false };
      }
    }, { passive: true });
    lb.addEventListener('touchmove', function (ev) {
      if (!G) return;
      ev.preventDefault();   // the viewer handles every gesture itself: no page zoom, no page scroll
      var t = ev.touches;
      if (G.pinch && t.length >= 2) {
        var s = Math.max(1, Math.min(ZMAX, G.s0 * dist(t) / G.d0)), m = mid(t);
        Z.x = m.x - G.cx - (G.mx - G.cx - G.x0) * (s / G.s0);   // the spot under the fingers stays under them
        Z.y = m.y - G.cy - (G.my - G.cy - G.y0) * (s / G.s0);
        Z.s = s; zset(false);
      } else if (t.length === 1 && G.px !== undefined) {
        var dx = t[0].clientX - G.x, dy = t[0].clientY - G.y;
        if (Math.abs(dx) > 8 || Math.abs(dy) > 8) G.moved = true;
        if (Z.s > 1) { Z.x = G.px + dx; Z.y = G.py + dy; zset(false); }
      }
    }, { passive: false });
    lb.addEventListener('touchend', function (ev) {
      if (!G) return;
      var t = ev.touches;
      if (t.length === 1 && G.multi) {   // one finger of a pinch lifted: keep dragging with the other
        G = { multi: true, x: t[0].clientX, y: t[0].clientY, px: Z.x, py: Z.y, moved: true }; return;
      }
      if (t.length) return;
      var e = ev.changedTouches[0], dx = e.clientX - G.x, dy = e.clientY - G.y, dt = Date.now() - G.t;
      if (!G.multi && Z.s === 1 && Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.8 && dt < 800) {
        G = null; go(dx < 0 ? 1 : -1); return;
      }
      if (!G.multi && !G.moved && dt < 300 && zimg() && ev.target === zimg()) {
        var now = Date.now();
        if (now - lastTap < 320) { lastTap = 0; toggleZoom(e.clientX, e.clientY); G = null; return; }
        lastTap = now;
      }
      G = null; clampZ(); zset(true);
    });
    lb.addEventListener('touchcancel', function () { G = null; clampZ(); zset(true); });
    // Safari's own pinch gesture events: never let them zoom the page behind the viewer
    lb.addEventListener('gesturestart', function (ev) { ev.preventDefault(); });
    lb.addEventListener('gesturechange', function (ev) { ev.preventDefault(); });
  }
  // photo zoom state: scale + offset of the photo, applied as a transform around its centre
  var Z = { s: 1, x: 0, y: 0 }, G = null, lastTap = 0, ZMAX = 4;
  function zimg() { return fig && fig.querySelector('img'); }
  function dist(t) { return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY); }
  function mid(t) { return { x: (t[0].clientX + t[1].clientX) / 2, y: (t[0].clientY + t[1].clientY) / 2 }; }
  function zset(anim) {
    var im = zimg(); if (!im) return;
    im.style.transition = anim ? 'transform .25s ease-out' : 'none';
    im.style.transform = Z.s === 1 && !Z.x && !Z.y ? '' : 'translate(' + Z.x + 'px,' + Z.y + 'px) scale(' + Z.s + ')';
    lb.classList.toggle('zoomed', Z.s > 1);
  }
  function zreset() { Z.s = 1; Z.x = 0; Z.y = 0; G = null; if (lb) lb.classList.remove('zoomed'); }
  function home() {   // the photo's centre and size with no zoom (its layout box never moves)
    var r = zimg().getBoundingClientRect();
    return { cx: r.left + r.width / 2 - Z.x, cy: r.top + r.height / 2 - Z.y, w: r.width / Z.s, h: r.height / Z.s };
  }
  function clampZ() {   // smaller than the screen: stays fully on it; bigger: no empty gap at an edge
    if (!zimg() || Z.s <= 1.03) { Z.s = 1; Z.x = 0; Z.y = 0; return; }
    var h = home(), W = h.w * Z.s, H = h.h * Z.s, vw = window.innerWidth, vh = window.innerHeight;
    var ax = W / 2 - h.cx, bx = vw - h.cx - W / 2, ay = H / 2 - h.cy, by = vh - h.cy - H / 2;
    Z.x = Math.max(Math.min(ax, bx), Math.min(Math.max(ax, bx), Z.x));
    Z.y = Math.max(Math.min(ay, by), Math.min(Math.max(ay, by), Z.y));
  }
  function toggleZoom(px, py) {
    if (Z.s > 1) { Z.s = 1; Z.x = 0; Z.y = 0; }
    else { var h = home(); Z.s = 2.5; Z.x = (px - h.cx) * (1 - Z.s); Z.y = (py - h.cy) * (1 - Z.s); }
    clampZ(); zset(true);
  }
  function split(it) {   // { yr: the blue date, txt: the caption without it }
    var own = (it.yt ? (it.title || '') : it.pc).trim();
    var m = own.match(/^((?:(?:Early|Late|Mid)\s+)?\d{4}s?|[A-Z][a-z]+\.?\s+\d{1,2},\s+\d{4})(?:\s*[\u2014\u2013-]\s*([\s\S]*))?$/);
    return { yr: m ? m[1] : it.yr, txt: m ? (m[2] || '') : own };
  }
  // Phones (Tyler, 2026-10-14): the caption box is as tall as the LONGEST caption in the
  // whole book at this screen width, so the date sits in the same spot on every photo and
  // nothing bounces as you flip. Photos sit right on top of the date (see house.css).
  var capFor = 0;
  function sizeCaption() {
    if (window.innerWidth > 900) { txtEl.style.minHeight = ''; lb.style.removeProperty('--caph'); capFor = 0; return; }
    if (capFor === window.innerWidth) return;
    var probe = txtEl.cloneNode(false);
    probe.style.cssText = 'position:absolute;visibility:hidden;left:0;right:0;min-height:0;width:' + txtEl.clientWidth + 'px';
    txtEl.parentNode.appendChild(probe);
    var tallest = 0;
    items.forEach(function (it) { probe.textContent = split(it).txt; tallest = Math.max(tallest, probe.offsetHeight); });
    probe.remove();
    txtEl.style.minHeight = tallest + 'px'; capFor = window.innerWidth;
    lb.style.setProperty('--caph', lb.querySelector('.hlb-cap').offsetHeight + 'px');   // the photo gets the rest
  }
  window.addEventListener('resize', function () { if (lb && lb.classList.contains('on')) { capFor = 0; sizeCaption(); } });
  function show(i, dir) {
    at = i; var it = items[i]; zreset();
    if (it.yt) {
      fig.innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/' + it.yt +
        '?autoplay=1&rel=0&modestbranding=1" title="' + (it.title || 'Video') + '" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>';
    } else {
      fig.innerHTML = '<img src="' + it.src + '" alt="' + it.alt.replace(/"/g, '&quot;') + '">';
    }
    fig.classList.remove('fn', 'fp'); void fig.offsetWidth;
    if (dir && !reduce) fig.classList.add(dir > 0 ? 'fn' : 'fp');
    // Just the photo's own caption (Tyler, 2026-10-14). A date leading the caption
    // ("1964 — ...", "Late 1960s — ...", "October 31, 1977 — ...") becomes the blue
    // date and comes off the text, so it never shows twice; no date in the caption
    // means the section's own year.
    var c = split(it);
    yrEl.textContent = c.yr;
    txtEl.textContent = c.txt;
    nEl.textContent = it.of > 1 ? (it.yt ? 'Video' : 'Photo') + ' ' + it.n + ' of ' + it.of : (it.yt ? 'Video' : '');
    bPrev.disabled = i === 0; bNext.disabled = i === items.length - 1;
    [i - 1, i + 1].forEach(function (j) { if (items[j] && !items[j].yt) { var p = new Image(); p.src = items[j].src; } });
  }
  function go(d) { var j = at + d; if (j >= 0 && j < items.length) show(j, d); }
  // The viewer gets its own history entry, so the phone's back swipe / back button closes
  // the viewer instead of leaving the page (Tyler, 2026-10-15).
  if (history.state && history.state.hlb) history.replaceState(null, '');
  window.addEventListener('popstate', function () { if (lb && lb.classList.contains('on')) close(true); });
  function open(i) {
    if (!lb) build();
    lastFocus = document.activeElement;
    lb.classList.add('on'); document.body.classList.add('hlb-open');
    if (!(history.state && history.state.hlb)) history.pushState({ hlb: 1 }, '');
    sizeCaption(); show(i, 0); lb.querySelector('.hlb-x').focus();
  }
  function close(fromBack) {
    if (!lb.classList.contains('on')) return;
    lb.classList.remove('on'); document.body.classList.remove('hlb-open');
    zreset(); fig.innerHTML = '';   // stops a playing video
    if (fromBack !== true && history.state && history.state.hlb) history.back();
    if (lastFocus) lastFocus.focus();
  }
  document.addEventListener('keydown', function (ev) {
    if (!lb || !lb.classList.contains('on')) return;
    if (ev.key === 'Escape') close();
    else if (ev.key === 'ArrowRight') go(1);
    else if (ev.key === 'ArrowLeft') go(-1);
  });
  document.addEventListener('click', function (ev) {
    var t = ev.target.closest && ev.target.closest('.htile, .hclip');
    if (!t || ev.metaKey || ev.ctrlKey || ev.shiftKey) return;
    ev.preventDefault(); open(+t.getAttribute('data-i'));
  });
})();
