/* ==========================================================================
   WOOLDRIDGE FLEET GALLERY v2
   Shared photo experience: full-screen lightbox with filmstrip, carousels,
   by-model / by-length organization, history-aware back button, deep links.
   Used by photos/index.html and every model page with a .gallery grid.
   ========================================================================== */
(function () {
  'use strict';

  var DATA = window.WB_PHOTOS || null;
  var MODEL = {};           /* slug -> {name, cat, lens} */
  var PHOTO = {};           /* slug -> file -> photo meta */
  if (DATA) {
    DATA.models.forEach(function (m) {
      MODEL[m.slug] = m;
      PHOTO[m.slug] = {};
      m.photos.forEach(function (p) { PHOTO[m.slug][p.f] = p; });
    });
  }

  /* ── nav height → CSS var (sticky toolbar offset) ─────────────────────── */
  var nav = document.querySelector('.nav');
  function setNavH() {
    if (nav) document.documentElement.style.setProperty('--navh', nav.offsetHeight + 'px');
  }
  setNavH();
  window.addEventListener('resize', setNavH);

  /* ── helpers ──────────────────────────────────────────────────────────── */
  function parseHref(a) {
    var m = /assets\/photos\/([^\/]+)\/([^\/]+\.jpe?g)$/i.exec(a.getAttribute('href') || '');
    return m ? { slug: m[1], file: m[2] } : null;
  }
  function metaFor(a) {
    var loc = parseHref(a);
    var p = (loc && PHOTO[loc.slug]) ? PHOTO[loc.slug][loc.file] : null;
    var mdl = loc ? MODEL[loc.slug] : null;
    return {
      slug: loc ? loc.slug : '',
      file: loc ? loc.file : '',
      name: mdl ? mdl.name : (a.dataset.m || ''),
      len: a.dataset.len || (p && p.len) || '',
      cfg: a.dataset.cfg || (p && p.cfg) || '',
      hull: a.dataset.hull || (p && p.hull) || '',
      shot: a.dataset.shot || (p && p.shot) || '',
      year: (p && p.year) || ''
    };
  }
  function visible(el) { return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length); }
  function collect() {
    var els = document.querySelectorAll('.pcartrack a, .gallery a');
    var out = [];
    for (var i = 0; i < els.length; i++) {
      if (/\.jpe?g$/i.test(els[i].getAttribute('href') || '') && visible(els[i])) out.push(els[i]);
    }
    return out;
  }

  /* ══════════════════════════════════════════════════════════════════════
     LIGHTBOX
     ══════════════════════════════════════════════════════════════════════ */
  var lb, lbImg, lbTitle, lbCount, lbCap, lbStrip, seq = [], cur = -1, pushed = false;

  function buildLb() {
    if (lb) return;
    lb = document.createElement('div');
    lb.className = 'wblb';
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-label', 'Photo viewer');
    lb.innerHTML =
      '<div class="wblbhead"><span class="wblbtitle"></span><span class="wblbcount"></span>' +
      '<button class="wblbx" type="button">Close &#215;</button></div>' +
      '<div class="wblbstage"><button class="wblbnav wblbprev" type="button" aria-label="Previous photo">&#8592;</button>' +
      '<img alt=""><div class="wblbspin"></div>' +
      '<button class="wblbnav wblbnext" type="button" aria-label="Next photo">&#8594;</button></div>' +
      '<div class="wblbcap"></div><div class="wblbstrip"></div>';
    document.body.appendChild(lb);
    lbImg = lb.querySelector('.wblbstage img');
    lbTitle = lb.querySelector('.wblbtitle');
    lbCount = lb.querySelector('.wblbcount');
    lbCap = lb.querySelector('.wblbcap');
    lbStrip = lb.querySelector('.wblbstrip');

    lb.querySelector('.wblbx').addEventListener('click', function () { closeLb(true); });
    lb.querySelector('.wblbprev').addEventListener('click', function () { showLb(cur - 1); });
    lb.querySelector('.wblbnext').addEventListener('click', function () { showLb(cur + 1); });
    lb.querySelector('.wblbstage').addEventListener('click', function (e) {
      if (e.target === e.currentTarget) closeLb(true);
    });
    document.addEventListener('keydown', function (e) {
      if (!lb.classList.contains('on')) return;
      if (e.key === 'Escape') closeLb(true);
      else if (e.key === 'ArrowLeft') showLb(cur - 1);
      else if (e.key === 'ArrowRight') showLb(cur + 1);
    });
    /* swipe */
    var tx = null, ty = null;
    lb.addEventListener('touchstart', function (e) {
      if (e.touches.length === 1) { tx = e.touches[0].clientX; ty = e.touches[0].clientY; }
    }, { passive: true });
    lb.addEventListener('touchend', function (e) {
      if (tx === null) return;
      var dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty;
      tx = ty = null;
      if (Math.abs(dx) > 44 && Math.abs(dy) < 90) showLb(cur + (dx < 0 ? 1 : -1));
    }, { passive: true });

    lbImg.addEventListener('load', function () {
      lb.classList.remove('loading');
      lbImg.classList.remove('fade');
    });
  }

  function buildStrip() {
    lbStrip.innerHTML = '';
    seq.forEach(function (a, n) {
      var t = a.querySelector('img');
      var im = document.createElement('img');
      im.src = t ? t.src : a.href;
      im.alt = '';
      im.loading = 'lazy';
      im.addEventListener('click', function () { showLb(n); });
      lbStrip.appendChild(im);
    });
  }

  function photoHash(a) {
    var loc = parseHref(a);
    return loc ? '#p=' + loc.slug + '/' + loc.file : '#photo';
  }

  function showLb(n) {
    if (!seq.length) return;
    cur = (n + seq.length) % seq.length;
    var a = seq[cur], m = metaFor(a);
    lb.classList.add('loading');
    lbImg.classList.add('fade');
    lbImg.src = a.href;
    lbImg.alt = (a.querySelector('img') || {}).alt || '';

    lbTitle.innerHTML = (m.len ? '<span class="len">' + m.len + '&#8242;</span>' : '') +
      (m.name || 'Wooldridge');
    lbCount.textContent = (cur + 1) + ' / ' + seq.length;

    var bits = [];
    if (m.cfg) bits.push(m.cfg);
    if (m.hull) bits.push('Hull #' + m.hull);
    if (m.year) bits.push(String(m.year));
    if (m.shot) bits.push(m.shot);
    lbCap.innerHTML = bits.map(function (b) { return '<span>' + b + '</span>'; }).join('') +
      '<a href="' + a.href + '" target="_blank" rel="noopener">Open original &#8599;</a>';

    var imgs = lbStrip.children;
    for (var i = 0; i < imgs.length; i++) imgs[i].classList.toggle('on', i === cur);
    if (imgs[cur]) imgs[cur].scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });

    /* preload neighbours */
    [cur + 1, cur - 1].forEach(function (k) {
      var b = seq[(k + seq.length) % seq.length];
      if (b) { var pre = new Image(); pre.src = b.href; }
    });

    history.replaceState({ wblb: 1 }, '', photoHash(a));
  }

  function openLb(anchor, viaHistory, subset) {
    buildLb();
    seq = (subset && subset.length) ? subset.slice() : collect();
    var idx = seq.indexOf(anchor);
    if (idx < 0) { seq = [anchor]; idx = 0; }
    buildStrip();
    lb.classList.add('on');
    document.body.style.overflow = 'hidden';
    if (!viaHistory) {
      history.pushState({ wblb: 1 }, '', photoHash(anchor));
      pushed = true;
    } else {
      pushed = false;
    }
    showLb(idx);
  }

  function closeLb(viaUi) {
    if (!lb || !lb.classList.contains('on')) return;
    lb.classList.remove('on');
    document.body.style.overflow = '';
    if (viaUi) {
      if (pushed) { pushed = false; history.back(); }
      else if (/^#p=/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search);
    }
  }

  /* click delegation: any gallery/carousel photo opens the lightbox */
  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('.pcartrack a, .gallery a') : null;
    if (!a || !/\.jpe?g$/i.test(a.getAttribute('href') || '')) return;
    e.preventDefault();
    openLb(a, false);
  });

  function openFromHash() {
    var m = /^#p=([^\/]+)\/(.+)$/.exec(location.hash);
    if (!m) return false;
    var file = decodeURIComponent(m[2]);
    var els = document.querySelectorAll('.pcartrack a, .gallery a');
    for (var i = 0; i < els.length; i++) {
      var loc = parseHref(els[i]);
      if (loc && loc.slug === m[1] && loc.file === file) { openLb(els[i], true); return true; }
    }
    return false;
  }

  /* ══════════════════════════════════════════════════════════════════════
     CAROUSELS  (photos page rows)
     ══════════════════════════════════════════════════════════════════════ */
  function wireCarousel(car) {
    if (car.dataset.wired) return;
    car.dataset.wired = '1';
    var track = car.querySelector('.pcartrack');
    var prev = car.querySelector('.pcarprev');
    var next = car.querySelector('.pcarnext');
    if (!track || !prev || !next) return;
    function update() {
      var max = track.scrollWidth - track.clientWidth - 4;
      prev.classList.toggle('can', track.scrollLeft > 4);
      next.classList.toggle('can', track.scrollLeft < max);
    }
    prev.addEventListener('click', function () { track.scrollBy({ left: -track.clientWidth * 0.9, behavior: 'smooth' }); });
    next.addEventListener('click', function () { track.scrollBy({ left: track.clientWidth * 0.9, behavior: 'smooth' }); });
    track.addEventListener('scroll', function () { requestAnimationFrame(update); }, { passive: true });
    window.addEventListener('resize', update);
    update();
    car._update = update;
  }
  function wireAllCarousels(root) {
    (root || document).querySelectorAll('.pcar').forEach(wireCarousel);
  }

  /* row carousel ⇄ grid toggle */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('.prowmode') : null;
    if (!btn) return;
    var car = btn.closest('.prow').querySelector('.pcar');
    var grid = !car.classList.toggle('asgrid') ? false : true;
    btn.setAttribute('aria-pressed', grid ? 'true' : 'false');
    btn.textContent = grid ? 'Carousel' : 'Grid view';
    if (!grid && car._update) car._update();
  });

  /* ══════════════════════════════════════════════════════════════════════
     PHOTOS PAGE — by-model / by-length views
     ══════════════════════════════════════════════════════════════════════ */
  var gal = document.getElementById('pgallery');
  var lenView = null, mode = 'model', homes = [];

  function buildLenView() {
    if (lenView) return;
    lenView = document.createElement('div');
    lenView.className = 'wrap';
    lenView.id = 'pgallery-len';
    lenView.hidden = true;
    gal.parentNode.appendChild(lenView);

    /* remember every anchor's home track + order */
    gal.querySelectorAll('.pcartrack').forEach(function (t) {
      homes.push({ track: t, anchors: Array.prototype.slice.call(t.children) });
    });

    /* index anchors by length then model (section order preserved) */
    var order = [], byLen = {};
    gal.querySelectorAll('.psec').forEach(function (sec) { order.push(sec.id); });
    var all = gal.querySelectorAll('.pcartrack a');
    all.forEach(function (a) {
      var L = a.dataset.len || 'x';
      byLen[L] = byLen[L] || {};
      var s = a.dataset.m;
      (byLen[L][s] = byLen[L][s] || []).push(a);
    });
    var lens = Object.keys(byLen).filter(function (k) { return k !== 'x'; })
      .sort(function (a, b) { return a - b; });
    if (byLen.x) lens.push('x');

    lens.forEach(function (L) {
      var models = order.filter(function (s) { return byLen[L][s]; });
      var count = models.reduce(function (n, s) { return n + byLen[L][s].length; }, 0);
      var head = document.createElement('div');
      head.className = 'sechead tight plensec';
      head.id = 'len-' + L;
      var title = L === 'x' ? 'Length unlisted' : L + '-Foot';
      var sub = L === 'x'
        ? 'Field and factory shots whose file names don&#8217;t carry a hull length.'
        : 'Every ' + L + '-footer in the archive, across ' + models.length +
          (models.length === 1 ? ' model.' : ' models.');
      head.innerHTML = '<div class="eyebrow">' + (L === 'x' ? 'UNSORTED' : L + ' FT') + ' &#183; ' +
        models.length + (models.length === 1 ? ' MODEL' : ' MODELS') + ' &#183; ' + count + ' PHOTOS</div>' +
        '<h2 style="font-size:clamp(22px,3vw,32px);">' + title +
        ' <span style="color:var(--slate); font-weight:400; font-size:.6em;">&#8212; ' + count + ' photos</span></h2>' +
        '<p class="lede">' + sub + '</p>';
      lenView.appendChild(head);

      models.forEach(function (s) {
        var n = byLen[L][s].length;
        var row = document.createElement('div');
        row.className = 'prow';
        row.innerHTML =
          '<div class="prowhead"><span class="prowtitle"><b>' + (MODEL[s] ? MODEL[s].name : s) + '</b>' +
          (MODEL[s] ? ' <span class="prowsub">&#8212; ' + MODEL[s].cat + '</span>' : '') + '</span>' +
          '<span class="prowcount">' + n + ' photo' + (n === 1 ? '' : 's') + '</span>' +
          '<button class="prowmode" type="button" aria-pressed="false">Grid view</button></div>' +
          '<div class="pcar"><button class="pcarbtn pcarprev" type="button" aria-label="Scroll back">&#8592;</button>' +
          '<div class="pcartrack"></div>' +
          '<button class="pcarbtn pcarnext" type="button" aria-label="Scroll forward">&#8594;</button></div>';
        lenView.appendChild(row);
        row.querySelector('.pcartrack')._fill = byLen[L][s];   /* anchors to adopt on switch */
      });
    });
  }

  function setMode(m, skipHistory) {
    if (!gal || m === mode) return;
    mode = m;
    buildLenView();
    if (m === 'length') {
      lenView.querySelectorAll('.pcartrack').forEach(function (t) {
        (t._fill || []).forEach(function (a) { t.appendChild(a); });
      });
      gal.hidden = true;
      lenView.hidden = false;
      wireAllCarousels(lenView);
      lenView.querySelectorAll('.pcar').forEach(function (c) { if (c._update) c._update(); });
    } else {
      homes.forEach(function (h) {
        h.anchors.forEach(function (a) { h.track.appendChild(a); });
      });
      lenView.hidden = true;
      gal.hidden = false;
      gal.querySelectorAll('.pcar').forEach(function (c) { if (c._update) c._update(); });
    }
    document.querySelectorAll('.pmode').forEach(function (b) {
      var on = b.dataset.mode === m;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    document.querySelectorAll('.pchips').forEach(function (c) {
      c.hidden = c.dataset.for !== m;
    });
    if (!skipHistory) history.pushState({ view: m }, '', '#view=' + m);
  }

  function route(viaHistory) {
    var h = location.hash;
    if (/^#p=/.test(h)) { openFromHash(); return; }
    closeLb(false);
    if (h === '#view=length') setMode('length', true);
    else if (h === '#view=model' || h === '') setMode('model', true);
    else if (/^#len-/.test(h)) {
      setMode('length', true);
      var el = document.getElementById(h.slice(1));
      if (el) el.scrollIntoView({ behavior: viaHistory ? 'auto' : 'smooth' });
    } else {
      var sec = document.getElementById(h.slice(1));
      if (sec && sec.classList.contains('psec')) setMode('model', true);
    }
  }

  if (gal) {
    document.querySelectorAll('.pmode').forEach(function (b) {
      b.addEventListener('click', function () { setMode(b.dataset.mode, false); });
    });
    wireAllCarousels(gal);

    /* jump chips need mode awareness (a #len-* chip only exists in length mode, but
       deep links / back-forward can arrive in either) */
    window.addEventListener('popstate', function () { route(true); });
    window.addEventListener('hashchange', function () {
      /* chip clicks change hash without popstate handling in some browsers */
      if (/^#len-/.test(location.hash)) setMode('length', true);
    });

    /* back-to-top */
    var top = document.createElement('button');
    top.className = 'ptop';
    top.type = 'button';
    top.innerHTML = '&#8593; TOP';
    document.body.appendChild(top);
    top.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
    window.addEventListener('scroll', function () {
      top.classList.toggle('on', window.scrollY > 900);
    }, { passive: true });

    /* initial route (deep links: #view=length, #len-20, #alaskan, #p=slug/file) */
    if (location.hash) route(false);
  }

  /* ══════════════════════════════════════════════════════════════════════
     MODEL PAGES — annotate grid, length filter chips, fleet-gallery link
     ══════════════════════════════════════════════════════════════════════ */
  if (!gal) {
    document.querySelectorAll('.gallery').forEach(function (grid) {
      var anchors = Array.prototype.slice.call(grid.querySelectorAll('a'))
        .filter(function (a) { return /\.jpe?g$/i.test(a.getAttribute('href') || ''); });
      if (!anchors.length) return;

      var groups = {}, slug = '';
      anchors.forEach(function (a) {
        var m = metaFor(a);
        if (m.slug) slug = m.slug;
        if (m.len) a.dataset.len = m.len;
        if (m.cfg) a.dataset.cfg = m.cfg;
        if (m.hull) a.dataset.hull = m.hull;
        if (m.shot) a.dataset.shot = m.shot;
        var img = a.querySelector('img');
        if (img && m.name) {
          img.alt = (m.len ? m.len + "' " : '') + m.name +
            (m.cfg ? ' — ' + m.cfg : '') + (m.hull ? ' — hull ' + m.hull : '');
        }
        var key = m.len || 'x';
        (groups[key] = groups[key] || []).push(a);
      });

      var keys = Object.keys(groups).filter(function (k) { return k !== 'x'; })
        .sort(function (a, b) { return a - b; });
      if (groups.x) keys.push('x');

      /* length filter chips — only when the grid actually spans groups */
      if (keys.length > 1) {
        var bar = document.createElement('div');
        bar.className = 'pfilter';
        function chip(label, key, on) {
          var c = document.createElement('button');
          c.type = 'button';
          c.className = 'optchip' + (on ? ' on' : '');
          c.innerHTML = label;
          c.addEventListener('click', function () {
            bar.querySelectorAll('.optchip').forEach(function (x) { x.classList.remove('on'); });
            c.classList.add('on');
            anchors.forEach(function (a) {
              var k = a.dataset.len || 'x';
              a.classList.toggle('pfhide', key !== 'all' && k !== key);
            });
          });
          return c;
        }
        bar.appendChild(chip('All &#183; ' + anchors.length, 'all', true));
        keys.forEach(function (k) {
          var label = (k === 'x' ? 'Unlisted' : k + '-Foot') + ' &#183; ' + groups[k].length;
          bar.appendChild(chip(label, k, false));
        });
        grid.parentNode.insertBefore(bar, grid);
      }

      /* grouped cover cards (hero-area gallery) — filled into .modelcards-slot */
      var slot = document.querySelector('.modelcards-slot');
      if (slot) {
        var by = 'length', g = groups, ks = keys.slice();
        var realLens = ks.filter(function (k) { return k !== 'x'; });
        if (realLens.length < 2) {
          var gc = {}, kc = [];
          anchors.forEach(function (a) {
            var c = a.dataset.cfg || 'All builds';
            if (!gc[c]) { gc[c] = []; kc.push(c); }
            gc[c].push(a);
          });
          if (kc.length > 1) { by = 'config'; g = gc; ks = kc; }
          else { by = 'all'; g = { all: anchors }; ks = ['all']; }
        }

        var modelName = (MODEL[slug] && MODEL[slug].name) ||
          (document.querySelector('.pagemast h1') || {}).textContent || 'Wooldridge';

        function shortCfg(c) { return c === 'Center Console' ? 'Console' : c; }
        function cfgLine(list) {
          var seen = {}, names = [];
          list.forEach(function (a) {
            var c = a.dataset.cfg;
            if (c && !seen[c]) { seen[c] = 1; names.push(shortCfg(c)); }
          });
          if (!names.length) return modelName + ' builds';
          if (names.length === 1) return names[0];
          return names.map(function (n, i) { return i ? n.toLowerCase() : n; })
            .join(' & ') + ' trims';
        }

        var lede;
        if (by === 'length') {
          var lens = ks.filter(function (k) { return k !== 'x'; })
            .map(function (k) { return k + '&#8242;'; });
          var last = lens.pop();
          lede = 'Browse by length &#8212; ' + (lens.length ? lens.join(', ') + ' and ' : '') +
            last + ' builds. Tap a gallery to open it full-screen and scroll through every photo.';
        } else if (by === 'config') {
          lede = 'Browse by build style. Tap a gallery to open it full-screen and scroll through every photo.';
        } else {
          lede = 'Tap the gallery to open it full-screen and scroll through every photo.';
        }

        var head = document.createElement('div');
        head.className = 'sechead tight';
        head.innerHTML = '<div class="eyebrow">In The Field</div>' +
          '<h2 style="font-size:clamp(20px,2.6vw,28px);">Photo gallery</h2>' +
          '<p class="lede">' + lede + '</p>';
        slot.appendChild(head);

        var cards = document.createElement('div');
        cards.className = 'modelcards';
        slot.appendChild(cards);

        ks.forEach(function (k) {
          var list = g[k];
          if (!list || !list.length) return;
          var title, sub;
          if (by === 'length') {
            title = (k === 'x' ? '' : k + '&#8242; ') + modelName +
              (k === 'x' ? ' &#8212; more shots' : '');
            sub = cfgLine(list);
          } else if (by === 'config') {
            title = shortCfg(k);
            sub = modelName;
          } else {
            title = modelName;
            sub = cfgLine(list);
          }
          var cover = list[0].querySelector('img');
          var card = document.createElement('button');
          card.type = 'button';
          card.className = 'mcard';
          card.innerHTML =
            '<img src="' + (cover ? cover.src : list[0].href) + '" alt="" loading="lazy">' +
            '<span class="mcbadge">' + list.length + ' photo' + (list.length === 1 ? '' : 's') + '</span>' +
            '<span class="mcmeta"><b>' + title + '</b><span>' + sub + '</span></span>';
          card.addEventListener('click', function () { openLb(list[0], false, list); });
          cards.appendChild(card);
        });

        /* a lone group would otherwise stretch full-width (grid-auto-columns:1fr);
           flag it so the CSS can cap it to a normal card size */
        if (cards.children.length === 1) cards.classList.add('mc-single');
      }

      /* link through to the fleet gallery, anchored at this model */
      if (slug) {
        var more = document.createElement('p');
        more.className = 'pmore';
        more.innerHTML = '<a href="../../photos/index.html#' + slug +
          '">Browse the full fleet gallery &#8594;</a>';
        grid.parentNode.insertBefore(more, grid.nextSibling);
      }
    });
  }

  /* deep-linked photo on a model page */
  if (!gal && /^#p=/.test(location.hash)) openFromHash();
  window.addEventListener('popstate', function () {
    if (!gal) { if (/^#p=/.test(location.hash)) openFromHash(); else closeLb(false); }
  });
})();
