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
})();
