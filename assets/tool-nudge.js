/* tool-nudge.js — the bottom-right corner widgets (hand-written; not generator
 * output).
 *
 * A fixed stack sits in the bottom-right corner holding two blue pills:
 *
 *   1. "Not sure which boat?" — clicking opens a card offering the two
 *      front-door tools: the Which Wooldridge quiz and the model comparison.
 *      The point is discovery — the tools are in the nav and the footer, but a
 *      visitor reading a model page has no reason to look there.
 *   2. "Click here to Email Danny!" — clicking opens a card with Danny's
 *      address as a mailto link plus a copy button.
 *
 * Both pills wear the wing logo's blue-in-black livery (see .wb-nudge-tab in
 * house.css) — Stephen's 2026-08-02 direction: logo, slogan, BUILD & PRICE and
 * these pills share the treatment so the eye groups them.
 *
 * Corner choice matters: media-fade.js's placeholder pill is bottom-LEFT, so
 * the stacks never collide.
 *
 * The quiz nudge is not shown on the tool pages themselves (see SKIP) —
 * offering the quiz to someone already taking the quiz is noise. The Danny
 * pill shows everywhere: it is a line to a human, not a nudge.
 *
 * Lifecycle, per Stephen 2026-08-02, both pills identical: present on every
 * page load; the x (inside the opened card) removes that pill for the CURRENT
 * PAGE VIEW ONLY. Nothing is persisted — navigate anywhere and back, or
 * return to the site next week, and both pills are there again. This
 * deliberately replaced the earlier 14-day localStorage snooze (old visitors
 * may still carry the dead 'wbToolNudge' key; nothing reads it now). Clicking
 * outside an open card, or Escape, merely collapses it back to a pill.
 */
(function () {
  'use strict';

  var DELAY = 1200;   // let the page settle first; an instant pill reads as a popup ad

  // Capital D on purpose — Stephen wrote it that way and mail routing is
  // case-insensitive, so the friendlier form costs nothing.
  var DANNY = 'Danny@wooldridgeboats.com';

  // Pages where the QUIZ nudge has nothing useful to offer (the Danny pill
  // still shows on all of these). Matched as path prefixes.
  var SKIP = [
    '/which-wooldridge/',   // it links here
    '/compare/',            // it links here
    '/build-and-price/',    // already deeper in the funnel
    '/request-a-quote/',    // mid-form: do not distract
    '/option-guide/'        // reference page reached FROM the tools
  ];

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

  function el(tag, cls) {
    var e = document.createElement(tag);
    e.className = cls;
    return e;
  }

  // One collapsible pill-to-card widget. Returns its root; open/collapse are
  // wired so that opening one widget collapses its siblings (the corner stays
  // one card tall). The x removes the widget from this page view.
  var widgets = [];
  function widget(id, tabText, fillPanel) {
    var root = el('div', 'wb-nudge');
    root.id = id;

    var tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'wb-nudge-tab';
    tab.setAttribute('aria-expanded', 'false');
    tab.setAttribute('aria-controls', id + '-panel');
    tab.textContent = tabText;

    var panel = el('div', 'wb-nudge-panel');
    panel.id = id + '-panel';
    fillPanel(panel);

    var x = document.createElement('button');
    x.type = 'button';
    x.className = 'wb-nudge-x';
    x.setAttribute('aria-label', 'Dismiss');
    x.textContent = '×';
    panel.appendChild(x);

    root.appendChild(tab);
    root.appendChild(panel);

    var w = {
      root: root,
      open: function () {
        for (var i = 0; i < widgets.length; i++) {
          if (widgets[i] !== w) widgets[i].collapse();
        }
        root.classList.add('wb-nudge-open');
        tab.setAttribute('aria-expanded', 'true');
        var first = panel.querySelector('a');
        if (first) first.focus();
      },
      collapse: function () {
        root.classList.remove('wb-nudge-open');
        tab.setAttribute('aria-expanded', 'false');
      },
      isOpen: function () { return root.classList.contains('wb-nudge-open'); },
      focusTab: function () { tab.focus(); }
    };

    tab.addEventListener('click', w.open);
    x.addEventListener('click', function () {
      // gone for THIS page view only — the next page load rebuilds everything
      if (root.parentNode) root.parentNode.removeChild(root);
      widgets.splice(widgets.indexOf(w), 1);
    });

    widgets.push(w);
    return root;
  }

  function copyEmail(btn) {
    function done() {
      var was = btn.textContent;
      btn.textContent = 'Copied!';
      btn.disabled = true;
      window.setTimeout(function () {
        btn.textContent = was;
        btn.disabled = false;
      }, 1600);
    }
    // execCommand fallback: the clipboard API needs a secure context, and this
    // must also work off a plain-http preview or an emailed copy of a page.
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = DANNY;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); done(); } catch (e) {}
      document.body.removeChild(ta);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(DANNY).then(done, fallback);
    } else {
      fallback();
    }
  }

  function build() {
    var corner = el('div', 'wb-corner');
    corner.id = 'wb-corner';

    // 1. the quiz/compare discovery nudge (skips the tool pages)
    if (!skipped()) {
      corner.appendChild(widget('wb-nudge', 'Not sure which boat?', function (panel) {
        // Stephen's copy, verbatim: the two phrases are the two destinations.
        var msg = el('p', 'wb-nudge-msg');
        msg.appendChild(document.createTextNode('Take our '));
        msg.appendChild(link('/which-wooldridge/', 'Which Wooldridge quiz'));
        msg.appendChild(document.createTextNode(' or '));
        msg.appendChild(link('/compare/', 'compare models'));
        msg.appendChild(document.createTextNode(' now'));
        panel.appendChild(msg);
      }));
    }

    // 2. the email-Danny pill (always)
    corner.appendChild(widget('wb-danny', 'Click here to Email Danny!', function (panel) {
      var msg = el('p', 'wb-nudge-msg');
      msg.appendChild(link('mailto:' + DANNY, DANNY));
      panel.appendChild(msg);

      var copy = document.createElement('button');
      copy.type = 'button';
      copy.className = 'wb-copy';
      copy.textContent = 'Copy';
      copy.addEventListener('click', function () { copyEmail(copy); });
      panel.appendChild(copy);
    }));

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      for (var i = 0; i < widgets.length; i++) {
        if (widgets[i].isOpen()) {
          widgets[i].collapse();
          widgets[i].focusTab();
        }
      }
    });
    document.addEventListener('click', function (e) {
      if (corner.contains(e.target)) return;
      for (var i = 0; i < widgets.length; i++) widgets[i].collapse();
    });

    document.body.appendChild(corner);
    // A tick later, so the entrance transition has a start state to animate
    // from. setTimeout rather than requestAnimationFrame on purpose: rAF is
    // SUSPENDED while a tab is hidden, so a page opened in a background tab
    // (middle-click, "open in new tab") would append the corner and then never
    // add the class that makes it visible. setTimeout still fires.
    window.setTimeout(function () { corner.classList.add('wb-corner-in'); }, 20);
  }

  function start() {
    window.setTimeout(build, DELAY);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
