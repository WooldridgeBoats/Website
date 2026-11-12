/* adsource.js - which ad or tagged link a visitor arrived on (2026-11-12, paid video campaign prep).
   Loaded from header.html, so every page that carries the header partial runs it.

   On landing it reads utm_source / utm_medium / utm_campaign / utm_content (plus whether a
   gclid or fbclid rode along) and keeps the FIRST tagged landing of the browser session in
   sessionStorage. The lead tools then add one line to what they send:

     Ad source: meta / paid-video / lt-video-2026 / bc-test (fbclid)
                source / medium   / campaign      / content

   A missing utm slot prints as '-'. No utm on the landing = nothing stored and NO line at all.
   A later tagged landing in the same session does not overwrite the first (first touch).

   Values are folded to [A-Za-z0-9._~-] and capped at 60 characters each, so a crafted link
   can never put a line break, a ':' or a '|' into the WB-INQUIRY block that the Build Hub and
   the Sales Order Creator parse line by line (a value like "x%0AModel:%20Fake" would otherwise
   forge a Model line).

   API for page scripts (always guard: window.WBAdSource may be absent):
     WBAdSource.value()  -> 'meta / paid-video / lt-video-2026 / bc-test' or ''
     WBAdSource.line()   -> 'Ad source: ' + value(), or '' when there is no tagged landing
   Storage failures (private windows, blocked site data) fall back to this page only. */
(function(){
  'use strict';
  var KEY = 'wbAdSource';
  var mem = null;
  function clean(v){
    return String(v || '').replace(/[^A-Za-z0-9._~-]+/g, '-').replace(/-{2,}/g, '-')
      .replace(/^-+|-+$/g, '').slice(0, 60);
  }
  function load(){
    if (mem) return mem;
    try {
      var s = window.sessionStorage.getItem(KEY);
      if (s){ var o = JSON.parse(s); if (o && typeof o === 'object') return o; }
    } catch (e) {}
    return null;
  }
  try {
    var q = new URLSearchParams(window.location.search || '');
    var got = {
      src: clean(q.get('utm_source')), med: clean(q.get('utm_medium')),
      cmp: clean(q.get('utm_campaign')), cnt: clean(q.get('utm_content')),
      gclid: q.has('gclid') ? 1 : 0, fbclid: q.has('fbclid') ? 1 : 0,
      land: clean(window.location.pathname), at: new Date().toISOString()
    };
    if ((got.src || got.med || got.cmp || got.cnt) && !load()){
      mem = got;
      try { window.sessionStorage.setItem(KEY, JSON.stringify(got)); } catch (e) {}
    }
  } catch (e) {}
  function value(){
    var o = load();
    if (!o || !(o.src || o.med || o.cmp || o.cnt)) return '';
    var v = [o.src, o.med, o.cmp, o.cnt].map(function(x){ return clean(x) || '-'; }).join(' / ');
    if (o.gclid) v += ' (gclid)';
    if (o.fbclid) v += ' (fbclid)';
    return v;
  }
  window.WBAdSource = {
    value: value,
    line: function(){ var v = value(); return v ? 'Ad source: ' + v : ''; }
  };
})();
