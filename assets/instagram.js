/* ─────────────────────────────────────────────────────────────────────────────
 * instagram.js — turn the homepage Instagram strip into a live feed.
 *
 * HOW IT WORKS
 *   The 8 <a><img></a> tiles baked into index.html (assets/homepage/ig-1..8.jpg)
 *   are the FALLBACK. This script tries to fetch a small JSON file that a robot
 *   (a scheduled GitHub Action — see _build/instagram/INSTAGRAM-FEED-SETUP.md)
 *   rebuilds from the real @wooldridgeboats account a few times a day. If that
 *   fetch succeeds, the tiles are replaced with the latest real posts. If it
 *   fails — feed not set up yet, offline, CDN hiccup — the baked-in photos stay
 *   exactly as they are. The section can never look broken.
 *
 * WHERE THE FEED COMES FROM
 *   The URL is read from  <section id="instagram" data-feed="...">  so it can be
 *   changed without touching this file. If that attribute is missing it falls
 *   back to the jsDelivr CDN copy of the repo. See the setup doc for the knob.
 *
 * The feed file looks like:
 *   { "updated": "...", "posts": [ {permalink, image, caption}, ... ] }
 * ───────────────────────────────────────────────────────────────────────────── */
(function () {
  var section = document.getElementById('instagram');
  if (!section) return;
  var row = section.querySelector('.igrow');
  if (!row) return;

  var MAX = 8; // one clean desktop row (matches the .igrow grid in house.css)
  var DEFAULT_FEED =
    'https://cdn.jsdelivr.net/gh/WooldridgeBoats/Website@main/assets/homepage/instagram/feed.json';
  var feedUrl = section.getAttribute('data-feed') || DEFAULT_FEED;
  var profile = 'https://www.instagram.com/wooldridgeboats/';

  // Cache-bust so a fresh feed is never hidden behind a stale browser copy.
  var bust = feedUrl + (feedUrl.indexOf('?') === -1 ? '?' : '&') + 't=' + Date.now();

  fetch(bust, { cache: 'no-store' })
    .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
    .then(function (data) {
      var posts = (data && data.posts) || [];
      if (!posts.length) return; // nothing usable — keep the baked-in photos

      var frag = document.createDocumentFragment();
      posts.slice(0, MAX).forEach(function (p) {
        if (!p || !p.image) return;
        var a = document.createElement('a');
        a.href = p.permalink || profile;
        a.target = '_blank';
        a.rel = 'noopener';
        a.setAttribute('aria-label', p.caption ? clip(p.caption, 90) : 'Wooldridge Boats on Instagram');

        var img = document.createElement('img');
        img.src = p.image;
        img.loading = 'lazy';
        img.alt = p.caption ? clip(p.caption, 120) : 'Wooldridge Boats on Instagram';
        // If a single post's image 404s, drop just that tile rather than
        // showing a broken-image icon in the middle of the row.
        img.onerror = function () { if (a.parentNode) a.parentNode.removeChild(a); };

        a.appendChild(img);
        frag.appendChild(a);
      });

      if (frag.childNodes.length) {
        row.textContent = '';
        row.appendChild(frag);
      }
    })
    .catch(function () { /* leave the baked-in fallback photos in place */ });

  function clip(s, n) {
    s = String(s).replace(/\s+/g, ' ').trim();
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }
})();
