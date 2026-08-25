/* media-fade.js — placeholder PROVENANCE MARKER (hand-written; not generator output).
 *
 * 2026-08-25, Stephen's decision: the customer-visible delineation is GONE.
 * Tyler and Grant gave the go-ahead to launch on the photos we have, and a
 * visitor seeing half a gallery faded out would read it as a broken site, not
 * as an internal to-do list. So this script no longer fades anything, tabs
 * anything, or explains anything. What it still does is TAG, invisibly.
 *
 * Any gallery photo under assets/photos/ that is NOT in the vetted set
 * (window.WB_VETTED, generated into media-provenance.js by
 * _build/sync_sales_tools.ps1 from Tyler's SALES TOOLS library) gets
 * data-wb-ph="1" in the DOM. Nothing styles that attribute. It costs a
 * visitor nothing and it keeps the in-with-the-new process addressable from
 * the page itself:
 *
 *   document.querySelectorAll('img[data-wb-ph="1"]').length   // still-placeholder
 *   document.querySelectorAll('img[data-wb-ph="0"]').length   // vetted
 *
 * THE LEDGER DID NOT MOVE. Vetted-vs-placeholder accounting still lives where
 * it always did — assets/photos/_media-manifest.json, _build/media_census.ps1
 * and _build/media-census.md — and the clean-break purge is untouched. This
 * file was only ever the paint.
 *
 * SEEING IT AGAIN (internal, opt-in, no deploy needed): add ?wbph=1 to any
 * URL to switch the old fade + corner tab back on for your browser; it sticks
 * across pages until you clear it with ?wbph=0. Customers never type that.
 *
 * Scope: images under assets/photos/ ONLY. Paths containing "/shop-" (the
 * live-build carousels) are excluded — those are current shop-floor shots,
 * not placeholders. Pre-owned / store / homepage-section imagery lives
 * outside assets/photos/ and is therefore excluded automatically.
 *
 * Model pages build their galleries dynamically, so a MutationObserver
 * catches images added after DOMContentLoaded (including the full-screen
 * lightbox image, which stays consistent with its thumbnail).
 */
(function () {
  'use strict';

  var DEBUG_KEY = 'wbPhDebug';
  var NOTE_KEY = 'wbPhNote';
  var PH_TITLE = 'Placeholder photo - not from the vetted media library';
  var noteShown = false;
  var showMarks = false; // set by readDebugFlag(); false for every real visitor

  /* ?wbph=1 turns the internal view on and remembers it; ?wbph=0 clears it.
     Storage being blocked is not an error here — the flag just won't persist. */
  function readDebugFlag() {
    var want = null;
    var m = /[?&]wbph=([01])/.exec(window.location.search || '');
    if (m) want = m[1] === '1';
    try {
      if (want === null) return window.localStorage.getItem(DEBUG_KEY) === '1';
      if (want) window.localStorage.setItem(DEBUG_KEY, '1');
      else window.localStorage.removeItem(DEBUG_KEY);
    } catch (e) {}
    return want === true;
  }

  function keyFor(src) {
    // "…/assets/photos/scout/thumbs/5113-19-product-1.jpg?v=x"
    //   -> "scout/5113-19-product-1.jpg"
    var path = src.split('?')[0].split('#')[0];
    var segs = path.split('/');
    var keep = [];
    for (var i = 0; i < segs.length; i++) {
      if (segs[i] !== 'thumbs' && segs[i] !== '') keep.push(segs[i]);
    }
    if (keep.length < 2) return null;
    return keep[keep.length - 2] + '/' + keep[keep.length - 1];
  }

  function dismissed() {
    try { return window.localStorage.getItem(NOTE_KEY) === '1'; }
    catch (e) { return true; } // storage blocked: stay quiet rather than nag
  }

  function showNote() {
    if (!showMarks || noteShown || dismissed()) return;
    if (document.getElementById('wb-phnote')) return;
    noteShown = true;
    var pill = document.createElement('div');
    pill.id = 'wb-phnote';
    pill.className = 'wb-phnote';
    var msg = document.createElement('span');
    msg.textContent = 'Internal view (?wbph=1): faded photos are not yet from the vetted library.';
    var x = document.createElement('button');
    x.type = 'button';
    x.setAttribute('aria-label', 'Dismiss');
    x.textContent = '×';
    x.addEventListener('click', function () {
      try { window.localStorage.setItem(NOTE_KEY, '1'); } catch (e) {}
      if (pill.parentNode) pill.parentNode.removeChild(pill);
    });
    pill.appendChild(msg);
    pill.appendChild(x);
    document.body.appendChild(pill);
  }

  function mark(img) {
    var vetted = window.WB_VETTED;
    if (!vetted) return; // provenance script missing: mark nothing (fail open)
    var src = img.getAttribute('src') || '';
    if (src.indexOf('assets/photos/') === -1) return;
    if (src.indexOf('/shop-') !== -1) return; // live-build carousels: excluded
    var key = keyFor(src);
    if (!key) return;
    var wrap = img.parentElement;

    // The tag itself — invisible, and the only thing that happens by default.
    img.setAttribute('data-wb-ph', vetted[key] ? '0' : '1');

    if (!showMarks) return; // customer path stops here: no class, no title, no tab

    if (vetted[key]) {
      img.classList.remove('wb-ph');
      if (img.getAttribute('title') === PH_TITLE) img.removeAttribute('title');
      // drop the corner tab unless another placeholder still lives in this wrapper
      if (wrap && wrap.classList && wrap.classList.contains('wb-ph-wrap')
          && !wrap.querySelector('img.wb-ph')) {
        wrap.classList.remove('wb-ph-wrap');
      }
    } else {
      img.classList.add('wb-ph');
      if (!img.getAttribute('title')) img.setAttribute('title', PH_TITLE);
      // corner tab: pseudo-elements cannot attach to <img>, so the immediate
      // wrapper carries it (gallery cells, fleet-card frames, the lightbox)
      if (wrap && wrap !== document.body && wrap.classList) {
        wrap.classList.add('wb-ph-wrap');
      }
      showNote();
    }
  }

  function scan(root) {
    if (!root || !root.querySelectorAll) return;
    var imgs = root.querySelectorAll('img');
    for (var i = 0; i < imgs.length; i++) mark(imgs[i]);
    if (root.tagName === 'IMG') mark(root);
  }

  function start() {
    showMarks = readDebugFlag();
    // The stylesheet keeps the fade and the tab behind .wb-ph-show, so a stray
    // class can never paint for a visitor even if one leaks in from elsewhere.
    if (showMarks) {
      var root = document.documentElement;
      if (root && root.classList) root.classList.add('wb-ph-show');
    }
    scan(document);
    var observer = new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var added = muts[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          if (added[j].nodeType === 1) scan(added[j]);
        }
        // dynamically re-pointed images (lightbox reuses one <img>)
        if (muts[i].type === 'attributes' && muts[i].target.tagName === 'IMG') {
          mark(muts[i].target);
        }
      }
    });
    observer.observe(document.body || document.documentElement, {
      childList: true, subtree: true, attributes: true, attributeFilter: ['src']
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
