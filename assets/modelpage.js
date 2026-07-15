/* ==========================================================================
   WOOLDRIDGE MODEL PAGE EXTRAS
   PDF lightbox (with download), product-video facade + lightbox.
   Loaded by every model page after gallery.js.
   ========================================================================== */
(function () {
  'use strict';

  /* Resolve assets/ base from this script's own <script src>, so pdf.js and
     its worker load correctly no matter how deep the page is nested. */
  var SELF_SRC = document.currentScript && document.currentScript.src;
  var ASSETS_BASE = SELF_SRC ? SELF_SRC.replace(/modelpage\.js.*$/, '') : '../../assets/';
  var PDFJS_BASE = ASSETS_BASE + 'vendor/pdfjs/';

  function lockScroll(on) { document.body.style.overflow = on ? 'hidden' : ''; }

  /* ── PDF lightbox — rendered with PDF.js (canvas), NOT a raw <iframe src=pdf>.
     A plain iframe hands the PDF off to the browser's native PDF handling,
     and on machines where "download PDFs instead of opening in browser" is
     on, that silently downloads the file and launches the OS default app
     (e.g. Acrobat) on top of our lightbox. Rendering to canvas ourselves
     sidesteps that setting entirely, on desktop and mobile alike. ────────── */
  var pdf, pdfTitle, pdfDl, pdfStage, pdfjsReady;

  function loadPdfJs() {
    if (pdfjsReady) return pdfjsReady;
    pdfjsReady = new Promise(function (resolve, reject) {
      if (window.pdfjsLib) { resolve(window.pdfjsLib); return; }
      var s = document.createElement('script');
      s.src = PDFJS_BASE + 'pdf.min.js';
      s.onload = function () {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_BASE + 'pdf.worker.min.js';
        resolve(window.pdfjsLib);
      };
      s.onerror = function () { reject(new Error('pdf.js failed to load')); };
      document.head.appendChild(s);
    });
    return pdfjsReady;
  }

  function buildPdf() {
    if (pdf) return;
    pdf = document.createElement('div');
    pdf.className = 'wbpdf';
    pdf.setAttribute('role', 'dialog');
    pdf.setAttribute('aria-label', 'Document viewer');
    pdf.innerHTML =
      '<div class="wbpdfhead"><span class="wbpdftitle"></span>' +
      '<a class="wbpdfdl" href="#">Download PDF</a>' +
      '<button class="wblbx" type="button">Close &#215;</button></div>' +
      '<div class="wbpdfstage"><div class="wbpdfpages"></div></div>';
    document.body.appendChild(pdf);
    pdfTitle = pdf.querySelector('.wbpdftitle');
    pdfDl = pdf.querySelector('.wbpdfdl');
    pdfStage = pdf.querySelector('.wbpdfpages');
    pdf.querySelector('.wblbx').addEventListener('click', closePdf);
    pdf.addEventListener('click', function (e) { if (e.target === pdf) closePdf(); });
  }

  function pdfFallback(href) {
    /* PDF.js couldn't read the bytes — happens when the page is served over
       file:// (browsers block fetch/Worker there) or the PDF is on another
       host with no CORS headers. Embed it natively instead: this shows the
       PDF inline in browsers set to display PDFs, and correctly renders the
       cross-origin Canyon brochure. The Download button still works too. */
    pdfStage.innerHTML =
      '<iframe class="wbpdfframe" title="PDF document" src="' + href + '"></iframe>' +
      '<div class="wbpdfhint">If the document doesn&#8217;t appear, ' +
      '<a href="' + href + '" target="_blank" rel="noopener">open it in a new tab</a>.</div>';
  }

  var openToken = 0;
  function renderPdf(href) {
    var token = ++openToken;
    /* file:// (page opened by double-clicking the HTML) blocks pdf.js's
       worker and fetch, so canvas rendering can't work — go straight to a
       native embed. Serve the site over http (the local preview server or a
       real host) to get the settings-proof canvas viewer. */
    if (location.protocol === 'file:') { pdfFallback(href); return; }
    pdfStage.innerHTML = '<div class="wbpdfspin"></div>';
    loadPdfJs().then(function (pdfjsLib) {
      if (token !== openToken) return;
      return pdfjsLib.getDocument(href).promise.then(function (doc) {
        if (token !== openToken) return;
        pdfStage.innerHTML = '';
        var stageWidth = pdfStage.clientWidth;
        var dpr = Math.min(window.devicePixelRatio || 1, 2);

        function renderPage(n) {
          if (token !== openToken || n > doc.numPages) return;
          return doc.getPage(n).then(function (page) {
            if (token !== openToken) return;
            var base = page.getViewport({ scale: 1 });
            var scale = Math.max(0.5, stageWidth / base.width);
            var viewport = page.getViewport({ scale: scale * dpr });
            var canvas = document.createElement('canvas');
            canvas.className = 'wbpdfpage';
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            canvas.style.width = (viewport.width / dpr) + 'px';
            canvas.style.height = (viewport.height / dpr) + 'px';
            pdfStage.appendChild(canvas);
            return page.render({ canvasContext: canvas.getContext('2d'), viewport: viewport }).promise
              .then(function () { return renderPage(n + 1); });
          });
        }
        return renderPage(1);
      });
    }).catch(function () {
      if (token !== openToken) return;
      pdfFallback(href);
    });
  }

  function openPdf(href, label) {
    buildPdf();
    pdfTitle.textContent = label;
    pdfDl.href = href;
    var sameOrigin = href.indexOf('://') < 0 || href.indexOf(location.origin) === 0;
    if (sameOrigin) {
      pdfDl.setAttribute('download', '');
      pdfDl.removeAttribute('target');
    } else {
      /* cross-origin: download attr is ignored by browsers — open natively */
      pdfDl.removeAttribute('download');
      pdfDl.setAttribute('target', '_blank');
      pdfDl.setAttribute('rel', 'noopener');
    }
    pdf.classList.add('on');
    lockScroll(true);
    renderPdf(href);
  }

  function closePdf() {
    if (!pdf || !pdf.classList.contains('on')) return;
    openToken++;                                    /* cancel any in-flight render */
    pdf.classList.remove('on');
    pdfStage.innerHTML = '';
    lockScroll(false);
  }

  function pdfLabel(a) {
    var clone = a.cloneNode(true);
    var k = clone.querySelector('.k');
    if (k) k.parentNode.removeChild(k);
    var t = (clone.textContent || '').replace(/\s+/g, ' ').trim();
    return t || 'Document';
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a[href]') : null;
    if (!a || !/\.pdf(\?|#|$)/i.test(a.getAttribute('href') || '')) return;
    if (a.closest('.wbpdf')) return;               /* the download button itself */
    e.preventDefault();
    openPdf(a.href, pdfLabel(a));
  });

  /* ── product video: facade click → lightbox slightly larger than embed ── */
  var vid, vidTitle, vidFrame;

  function buildVid() {
    if (vid) return;
    vid = document.createElement('div');
    vid.className = 'wbvid';
    vid.setAttribute('role', 'dialog');
    vid.setAttribute('aria-label', 'Video player');
    vid.innerHTML =
      '<div class="wbvidbox"><div class="wbvidhead"><span class="wbvidtitle"></span>' +
      '<button class="wblbx" type="button">Close &#215;</button></div>' +
      '<div class="wbvidframe"></div></div>';
    document.body.appendChild(vid);
    vidTitle = vid.querySelector('.wbvidtitle');
    vidFrame = vid.querySelector('.wbvidframe');
    vid.querySelector('.wblbx').addEventListener('click', closeVid);
    vid.addEventListener('click', function (e) { if (e.target === vid) closeVid(); });
  }

  function openVid(id, title) {
    buildVid();
    vidTitle.textContent = title;
    vidFrame.innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/' + id +
      '?autoplay=1&rel=0" title="' + title.replace(/"/g, '&quot;') +
      '" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>';
    vid.classList.add('on');
    lockScroll(true);
  }

  function closeVid() {
    if (!vid || !vid.classList.contains('on')) return;
    vid.classList.remove('on');
    vidFrame.innerHTML = '';                        /* stops playback */
    lockScroll(false);
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('.vidfacade') : null;
    if (!b || !b.dataset.yt) return;
    openVid(b.dataset.yt, b.dataset.vtitle || 'Wooldridge Boats');
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    closeVid();
    closePdf();
  });
})();
