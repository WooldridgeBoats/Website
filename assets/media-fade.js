/* media-fade.js — placeholder indicator (hand-written; not generator output).
 *
 * Any gallery photo under assets/photos/ that is NOT in the vetted set
 * (window.WB_VETTED, generated into media-provenance.js by
 * _build/sync_sales_tools.ps1 from Tyler's SALES TOOLS library) renders
 * slightly faded, sitewide. First time a visitor sees a faded photo, a small
 * dismissible pill explains why; the dismissal sticks via localStorage.
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

  var NOTE_KEY = 'wbPhNote';
  var PH_TITLE = 'Placeholder photo - not from the vetted media library';
  var noteShown = false;

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
    if (noteShown || dismissed()) return;
    if (document.getElementById('wb-phnote')) return;
    noteShown = true;
    var pill = document.createElement('div');
    pill.id = 'wb-phnote';
    pill.className = 'wb-phnote';
    var msg = document.createElement('span');
    msg.textContent = 'Faded photos are placeholders — vetted media is rolling in model by model.';
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
    if (!vetted) return; // provenance script missing: fade nothing (fail open)
    var src = img.getAttribute('src') || '';
    if (src.indexOf('assets/photos/') === -1) return;
    if (src.indexOf('/shop-') !== -1) return; // live-build carousels: excluded
    var key = keyFor(src);
    if (!key) return;
    var wrap = img.parentElement;
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
