/* tool-nudge.js — the bottom-right discovery nudge (hand-written; not generator
 * output).
 *
 * A small pill sits in the bottom-right corner. Clicking it opens a card
 * offering the two front-door tools: the Which Wooldridge quiz and the model
 * comparison. The point is discovery — the tools are in the nav and the footer,
 * but a visitor reading a model page has no reason to look there.
 *
 * Corner choice matters: media-fade.js's placeholder pill is bottom-LEFT, so
 * the two never collide.
 *
 * Not shown on the tool pages themselves (see SKIP) — offering the quiz to
 * someone already taking the quiz is noise, and the configurator and quote form
 * are further down the funnel than this nudge is trying to push.
 *
 * Dismissal (the x) is a 14-day snooze via localStorage, not forever — Stephen
 * dismissed it while testing on 2026-07-31, expected it back, and it wasn't:
 * for a discovery nudge, one misclick should not mean permanent invisibility.
 * The stored value is the dismissal timestamp; the old permanent flag ("1")
 * fails the timestamp check and therefore un-dismisses itself. Collapsing
 * (Escape, or a click outside) is lighter still — the pill returns instantly,
 * because collapsing means "not now", not "not this fortnight".
 */
(function () {
  'use strict';

  var KEY = 'wbToolNudge';
  var DELAY = 1200;   // let the page settle first; an instant pill reads as a popup ad
  var SNOOZE = 14 * 24 * 60 * 60 * 1000;   // how long the x keeps it away

  // Pages where the nudge has nothing useful to offer. Matched as path prefixes.
  var SKIP = [
    '/which-wooldridge/',   // it links here
    '/compare/',            // it links here
    '/build-and-price/',    // already deeper in the funnel
    '/request-a-quote/',    // mid-form: do not distract
    '/option-guide/'        // reference page reached FROM the tools
  ];

  function dismissed() {
    try {
      var at = parseInt(window.localStorage.getItem(KEY), 10);
      // NaN (never dismissed, or the retired permanent "1"... 1 is a valid int:
      // it parses to epoch-1970, which is older than any snooze) fails the
      // window test below, so both cases correctly mean "show the pill".
      return !isNaN(at) && (Date.now() - at) < SNOOZE;
    }
    catch (e) { return true; } // storage blocked: stay quiet rather than nag
  }

  function skipped() {
    var path = window.location.pathname;
    for (var i = 0; i < SKIP.length; i++) {
      if (path.indexOf(SKIP[i]) === 0) return true;
    }
    return false;
  }

  function link(href, text) {
    var a = document.createElement('a');
    a.href = href;
    a.textContent = text;
    return a;
  }

  function build() {
    var root = document.createElement('div');
    root.className = 'wb-nudge';
    root.id = 'wb-nudge';

    var tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'wb-nudge-tab';
    tab.id = 'wb-nudge-tab';
    tab.setAttribute('aria-expanded', 'false');
    tab.setAttribute('aria-controls', 'wb-nudge-panel');
    tab.textContent = 'Not sure which boat?';

    var panel = document.createElement('div');
    panel.className = 'wb-nudge-panel';
    panel.id = 'wb-nudge-panel';

    // Stephen's copy, verbatim: the two phrases are the two destinations.
    var msg = document.createElement('p');
    msg.className = 'wb-nudge-msg';
    msg.appendChild(document.createTextNode('Take our '));
    msg.appendChild(link('/which-wooldridge/', 'Which Wooldridge quiz'));
    msg.appendChild(document.createTextNode(' or '));
    msg.appendChild(link('/compare/', 'compare models'));
    msg.appendChild(document.createTextNode(' now'));

    var x = document.createElement('button');
    x.type = 'button';
    x.className = 'wb-nudge-x';
    x.setAttribute('aria-label', 'Dismiss');
    x.textContent = '×';

    panel.appendChild(msg);
    panel.appendChild(x);
    root.appendChild(tab);
    root.appendChild(panel);

    function open() {
      root.classList.add('wb-nudge-open');
      tab.setAttribute('aria-expanded', 'true');
      var first = panel.querySelector('a');
      if (first) first.focus();
    }

    function collapse() {
      root.classList.remove('wb-nudge-open');
      tab.setAttribute('aria-expanded', 'false');
    }

    function dismiss() {
      try { window.localStorage.setItem(KEY, String(Date.now())); } catch (e) {}
      if (root.parentNode) root.parentNode.removeChild(root);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('click', onOutside);
    }

    function onKey(e) {
      if (e.key === 'Escape' && root.classList.contains('wb-nudge-open')) {
        collapse();
        tab.focus();
      }
    }

    function onOutside(e) {
      if (root.classList.contains('wb-nudge-open') && !root.contains(e.target)) collapse();
    }

    tab.addEventListener('click', open);
    x.addEventListener('click', dismiss);
    document.addEventListener('keydown', onKey);
    document.addEventListener('click', onOutside);

    document.body.appendChild(root);
    // A tick later, so the entrance transition has a start state to animate
    // from. setTimeout rather than requestAnimationFrame on purpose: rAF is
    // SUSPENDED while a tab is hidden, so a page opened in a background tab
    // (middle-click, "open in new tab") would append the nudge and then never
    // add the class that makes it visible. setTimeout still fires.
    window.setTimeout(function () { root.classList.add('wb-nudge-in'); }, 20);
  }

  function start() {
    if (dismissed() || skipped()) return;
    window.setTimeout(build, DELAY);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
