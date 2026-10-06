/* agency-gallery.js — the per-boat photo galleries on the Agency & Work Boats page
 * (agency-work-boats/). Built 2026-09-30.
 *
 * _build/build_agency_galleries.pl writes the cover cards (a.mcard[data-gal]) and
 * window.WB_AGENCY = { key: { m, len, cfg, dir, alt, d:[{f,hull}], mob:[{f,hull}] } }.
 * Tapping a card opens gallery.js's shared full-screen viewer (window.WBGallery)
 * on that boat's photos: the portrait "mob" set on a phone (<=700px, same line as
 * the model pages), otherwise the desktop set. Without JS a card just links to
 * the boat's first full-size photo.
 */
(function () {
  'use strict';
  var DATA = window.WB_AGENCY;
  if (!DATA) return;
  var mq = window.matchMedia ? window.matchMedia('(max-width:700px)') : { matches: false };

  function anchors(g, mobile) {
    var dir = g.dir + (mobile ? 'mobile/' : '');
    return (mobile ? g.mob : g.d).map(function (p) {
      var a = document.createElement('a');
      a.setAttribute('href', dir + p.f);
      a.dataset.m = g.m; a.dataset.len = g.len; a.dataset.cfg = g.cfg; a.dataset.slug = 'agency-work';
      if (p.hull) a.dataset.hull = p.hull;
      var img = document.createElement('img');
      img.src = dir + 'thumbs/' + p.f; img.alt = g.alt || '';
      a.appendChild(img);
      return a;
    });
  }

  document.addEventListener('click', function (e) {
    var card = e.target.closest ? e.target.closest('a[data-gal]') : null;
    if (!card || !window.WBGallery) return;
    var g = DATA[card.getAttribute('data-gal')];
    if (!g) return;
    e.preventDefault();
    window.WBGallery.open(anchors(g, mq.matches && g.mob && g.mob.length > 0), 0);
  });

  /* Bottom "Photo gallery" (Tyler, 2026-10-06): the model pages' flat photo grid, made for
     many boats. The builder writes every boat's thumbs into .agrid in round-robin order
     (each boat's 1st photo, then each 2nd, ...). Here: one filter chip per boat (its
     mission title; a repeated title gets the length, e.g. "18′ Fire & Rescue"), the "All"
     view opens at PREVIEW photos with a "Show all" link, and tapping a photo opens THAT
     boat's set at that photo. Phones hide the whole section (house.css .agphotos), like
     the model pages: there the cards above open each boat's portrait set. */
  var grid = document.querySelector('.agrid');
  if (!grid) return;
  var PREVIEW = 20;
  var all = [].slice.call(grid.querySelectorAll('a[data-agp]')), groups = {}, order = [];
  all.forEach(function (a) {
    var k = a.dataset.agp, g = DATA[k];
    if (!g) return;
    a.dataset.m = g.m; a.dataset.len = g.len; a.dataset.cfg = g.cfg; a.dataset.slug = 'agency-work';
    if (!groups[k]) { groups[k] = []; order.push(k); }
    groups[k].push(a);
  });
  if (!order.length) return;
  var cur = 'all', expanded = false;
  var esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); };

  var more = document.createElement('p');
  more.className = 'pmore';
  more.innerHTML = '<a href="#" role="button">Show all ' + all.length + ' photos &#8595;</a>';
  more.firstChild.addEventListener('click', function (e) { e.preventDefault(); expanded = true; apply(); });

  function apply() {
    var n = 0;
    all.forEach(function (a) {
      var hide = cur === 'all' ? (!expanded && n++ >= PREVIEW) : a.dataset.agp !== cur;
      a.classList.toggle('pfhide', hide);
    });
    more.hidden = !(cur === 'all' && !expanded && all.length > PREVIEW);
  }

  var bar = document.createElement('div');
  bar.className = 'pfilter';
  function chip(label, key) {
    var c = document.createElement('button');
    c.type = 'button';
    c.className = 'optchip' + (key === cur ? ' on' : '');
    c.innerHTML = label;
    c.addEventListener('click', function () {
      bar.querySelectorAll('.optchip').forEach(function (x) { x.classList.remove('on'); });
      c.classList.add('on');
      cur = key;
      apply();
    });
    bar.appendChild(c);
  }
  var seen = {};
  order.forEach(function (k) { var t = DATA[k].t || DATA[k].m; seen[t] = (seen[t] || 0) + 1; });
  chip('All &#183; ' + all.length, 'all');
  order.forEach(function (k) {
    var g = DATA[k], t = g.t || g.m;
    chip((seen[t] > 1 ? g.len + '&#8242; ' : '') + esc(t) + ' &#183; ' + groups[k].length, k);
  });
  grid.parentNode.insertBefore(bar, grid);
  grid.parentNode.insertBefore(more, grid.nextSibling);

  grid.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a[data-agp]') : null;
    if (!a || !window.WBGallery || !groups[a.dataset.agp]) return;
    e.preventDefault();
    e.stopPropagation();          /* keep gallery.js's page-wide grid handler out of it */
    var set = groups[a.dataset.agp];
    window.WBGallery.open(set, set.indexOf(a));
  });
  apply();
})();
