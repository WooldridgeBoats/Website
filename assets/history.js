/* history.js: the /our-history/ timeline (2026-10-12).
   1. the rope between dates draws itself in blue as you scroll; each date's
      compass star lights when the rope reaches it; the big ghost year drifts
   2. each date's carousel: arrows, "3 / 10" counter, edge fades
   3. one flip-through viewer for every photo and video on the page, in order,
      so "next" runs from the end of one date into the start of the next
   4. the year rail on wide screens
   5. the closing Rogue River map: its route upriver draws itself on scroll
   Markup comes from _build/build_history.pl; styles are the OUR HISTORY block
   in house.css. Without JS everything still shows and tiles open the image. */
(function () {
  var page = document.querySelector('.hist');
  var eras = [].slice.call(document.querySelectorAll('.hera'));
  if (!page || !eras.length) return;
  page.classList.add('hjs');
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── 1 + 4: scroll-driven rope, stars, ghost years, rail ── */
  var rail = document.querySelector('.hrail'), railLinks = [];
  var tl = document.querySelector('.htl');
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
  if (map) {
    mapLine = map.querySelector('.hmap-line'); mapGlow = map.querySelector('.hmap-glow');
    mapArt = map.querySelector('.hmap-art'); mapRope = map.querySelector('.hseg i');
    mapLen = mapLine.getTotalLength();
    [mapLine, mapGlow].forEach(function (p) { p.style.strokeDasharray = mapLen; });
  }
  function drawMap(vh, reach) {
    var s = mapRope.parentNode.getBoundingClientRect();
    mapRope.style.height = (Math.max(0, Math.min(1, (reach - s.top) / s.height)) * 100).toFixed(2) + '%';
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
      rail.classList.toggle('on', t.top < vh * 0.55 && t.bottom > vh * 0.45);
    }
  }
  function queue() { if (!queued) { queued = true; requestAnimationFrame(frame); } }
  window.addEventListener('scroll', queue, { passive: true });
  window.addEventListener('resize', queue);
  frame();

  /* fade each date in as it arrives */
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('seen'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -12% 0px' });
    eras.forEach(function (e) { io.observe(e); });
  } else eras.forEach(function (e) { e.classList.add('seen'); });

  /* ── 3: the viewer's page list (built before the carousels so tiles know their index) ── */
  var items = [];
  eras.forEach(function (e) {
    var tiles = [].slice.call(e.querySelectorAll('.htile'));
    var cap = e.querySelector('.hcap');
    tiles.forEach(function (t, n) {
      t.setAttribute('data-i', items.length);
      items.push({
        yt: t.getAttribute('data-yt'), src: t.getAttribute('href'),
        title: t.getAttribute('data-vtitle'), alt: (t.querySelector('img') || {}).alt || '',
        pc: t.hasAttribute('data-yt') ? '' : ((t.querySelector('.hpc') || {}).textContent || ''),
        yr: e.getAttribute('data-yr'), cap: cap ? cap.innerHTML : '', n: n + 1, of: tiles.length
      });
    });
  });

  /* ── 2: carousels ── */
  [].slice.call(document.querySelectorAll('.hcar')).forEach(function (car) {
    var track = car.querySelector('.htrack');
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
  var lb, fig, yrEl, txtEl, subEl, nEl, bPrev, bNext, at = -1, lastFocus = null;
  function build() {
    lb = document.createElement('div');
    lb.className = 'hlb'; lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-modal', 'true');
    lb.setAttribute('aria-label', 'Wooldridge history photos');
    lb.innerHTML =
      '<button type="button" class="hlb-x">CLOSE &#10005;</button>' +
      '<div class="hlb-stage"><button type="button" class="hlb-prev" aria-label="Previous"></button>' +
      '<div class="hlb-fig"></div><button type="button" class="hlb-next" aria-label="Next"></button></div>' +
      '<div class="hlb-cap"><div class="hlb-yr"></div><div class="hlb-txt"></div><div class="hlb-sub"></div><div class="hlb-n"></div></div>';
    document.body.appendChild(lb);
    fig = lb.querySelector('.hlb-fig'); yrEl = lb.querySelector('.hlb-yr');
    txtEl = lb.querySelector('.hlb-txt'); subEl = lb.querySelector('.hlb-sub'); nEl = lb.querySelector('.hlb-n');
    bPrev = lb.querySelector('.hlb-prev'); bNext = lb.querySelector('.hlb-next');
    lb.querySelector('.hlb-x').addEventListener('click', close);
    bPrev.addEventListener('click', function () { go(-1); });
    bNext.addEventListener('click', function () { go(1); });
    lb.querySelector('.hlb-stage').addEventListener('click', function (ev) { if (ev.target === ev.currentTarget) close(); });
    var x0 = null;
    lb.addEventListener('touchstart', function (ev) { x0 = ev.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', function (ev) {
      if (x0 === null) return; var dx = ev.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) > 45) go(dx < 0 ? 1 : -1);
    });
  }
  function show(i, dir) {
    at = i; var it = items[i];
    if (it.yt) {
      fig.innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/' + it.yt +
        '?autoplay=1&rel=0&modestbranding=1" title="' + (it.title || 'Video') + '" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>';
    } else {
      fig.innerHTML = '<img src="' + it.src + '" alt="' + it.alt.replace(/"/g, '&quot;') + '">';
    }
    fig.classList.remove('fn', 'fp'); void fig.offsetWidth;
    if (dir && !reduce) fig.classList.add(dir > 0 ? 'fn' : 'fp');
    yrEl.textContent = it.yr;
    // the photo's own caption leads; the date's story sits under it
    var own = it.yt ? (it.title || '') : it.pc;
    if (own) { txtEl.textContent = own; subEl.innerHTML = it.cap; }
    else { txtEl.innerHTML = it.cap; subEl.innerHTML = ''; }
    nEl.textContent = it.of > 1 ? (it.yt ? 'Video' : 'Photo') + ' ' + it.n + ' of ' + it.of : (it.yt ? 'Video' : '');
    bPrev.disabled = i === 0; bNext.disabled = i === items.length - 1;
    [i - 1, i + 1].forEach(function (j) { if (items[j] && !items[j].yt) { var p = new Image(); p.src = items[j].src; } });
  }
  function go(d) { var j = at + d; if (j >= 0 && j < items.length) show(j, d); }
  function open(i) {
    if (!lb) build();
    lastFocus = document.activeElement;
    lb.classList.add('on'); document.body.classList.add('hlb-open');
    show(i, 0); lb.querySelector('.hlb-x').focus();
  }
  function close() {
    lb.classList.remove('on'); document.body.classList.remove('hlb-open');
    fig.innerHTML = '';   // stops a playing video
    if (lastFocus) lastFocus.focus();
  }
  document.addEventListener('keydown', function (ev) {
    if (!lb || !lb.classList.contains('on')) return;
    if (ev.key === 'Escape') close();
    else if (ev.key === 'ArrowRight') go(1);
    else if (ev.key === 'ArrowLeft') go(-1);
  });
  document.addEventListener('click', function (ev) {
    var t = ev.target.closest && ev.target.closest('.htile');
    if (!t || ev.metaKey || ev.ctrlKey || ev.shiftKey) return;
    ev.preventDefault(); open(+t.getAttribute('data-i'));
  });
})();
