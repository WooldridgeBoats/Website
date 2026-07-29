/* pagenav.js — the reusable back / prev-next navigation bar.
   WEB-N-05: prev / next on model pages (mega-menu order, wrapping)
   WEB-N-06: a way back from pre-owned (individual listings open in new
             tabs since the WEB-P rebuild, so "back" there is close-tab;
             this bar covers the pre-owned page itself)
   WEB-N-07: back + back-to-top on the photo galleries
   WEB-N-08: return home from the Dealers page
   One file, included with <script src="/assets/pagenav.js" defer> — the
   page decides nothing; this script reads location.pathname and renders
   the right bar at the top of <main> and above the footer.
   Model ORDER mirrors the mega menu columns (header.html): Inboard,
   Outboard, Offshore, Custom Builds. If a model is added to the menu it
   must be added here — the sitewide audit checks the two lists agree. */
(function(){
  'use strict';
  var ORDER = [
    /* Inboard */
    ['alaskan-xl-inboard',          'Alaskan XL Inboard'],
    ['scout',                       'Scout'],
    ['scout-widebody',              'Scout Widebody'],
    ['skagit-inboard',              'Skagit Inboard'],
    ['skagit-x',                    'Skagit-X'],
    ['sportinboard',                'Sport Inboard'],
    ['supersportdrifterinboard',    'Super Sport Drifter Inboard'],
    /* Outboard */
    ['alaskan',                     'Alaskan'],
    ['alaskan-lt',                  'Alaskan LT'],
    ['alaskanxl',                   'Alaskan XL'],
    ['xlt',                         'Alaskan XLT'],
    ['rogue',                       'Rogue'],
    ['skagit',                      'Skagit'],
    ['sport',                       'Sport'],
    ['sportster',                   'Sportster'],
    ['supersportdrifter',           'Super Sport Drifter'],
    /* Offshore */
    ['sportoffshore',               'Sport Offshore'],
    ['super-sport-offshore',        'Super Sport Offshore'],
    /* Custom Builds */
    ['canyon',                      'Canyon'],
    ['riverrat-diy-kit',            'River Rat DIY Kit'],
    ['landing-craft',               'Landing Craft'],
    ['deepwater',                   'Deepwater Series'],
    ['pybus-offshore',              'Pybus Offshore'],
    ['angler',                      'SSO Angler'],
    ['supersportoffshorepilothouse','SSO Pilothouse']
  ];

  function el(html){
    var d = document.createElement('div');
    d.className = 'pagenav';
    d.innerHTML = html;
    return d;
  }
  function link(href, cls, label){
    return '<a class="' + cls + '" href="' + href + '">' + label + '</a>';
  }
  function backLink(){
    /* real history back when the visitor came from this site; home otherwise
       (deep links from search results should not back out of the site) */
    var sameSite = document.referrer && document.referrer.indexOf(location.origin) === 0;
    if (sameSite) return '<a class="pn-prev" href="#" data-back="1">&lsaquo; Back</a>';
    return link('/', 'pn-prev', '&lsaquo; Back');
  }

  var path = location.pathname.replace(/\/index\.html$/, '/');
  var m = path.match(/^\/models\/([a-z0-9-]+)\/$/);
  var top, bottom;

  if (m){
    var i = -1;
    for (var k = 0; k < ORDER.length; k++) if (ORDER[k][0] === m[1]) { i = k; break; }
    if (i === -1) return;                       /* unknown slug (e.g. a redirect stub) */
    var prev = ORDER[(i + ORDER.length - 1) % ORDER.length];
    var next = ORDER[(i + 1) % ORDER.length];
    var bar = link('/models/' + prev[0] + '/', 'pn-prev', '&lsaquo; ' + prev[1])
            + link('/#fleet', 'pn-home', 'All Boats')
            + link('/models/' + next[0] + '/', 'pn-next', next[1] + ' &rsaquo;');
    top = el(bar); bottom = el(bar);
  } else if (path === '/photos/'){
    top    = el(backLink() + link('/', 'pn-home', '&#8962; Home'));
    bottom = el('<a class="pn-prev" href="#" data-top="1">&uarr; Back to top</a>' + link('/', 'pn-home', '&#8962; Home'));
  } else if (path === '/dealers/' || path === '/pre-owned/'){
    top    = el(backLink() + link('/', 'pn-home', '&#8962; Home'));
    bottom = el(link('/', 'pn-home', '&#8962; Return to Home'));
  } else {
    return;
  }

  var main = document.querySelector('main') || document.body;
  if (top)    main.insertAdjacentElement('afterbegin', top);
  if (bottom) main.insertAdjacentElement('beforeend', bottom);

  document.addEventListener('click', function(e){
    var a = e.target.closest ? e.target.closest('a[data-back],a[data-top]') : null;
    if (!a) return;
    e.preventDefault();
    if (a.hasAttribute('data-back')) history.back();
    else window.scrollTo({top:0, behavior:'smooth'});
  });
})();
