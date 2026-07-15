/* ==========================================================================
   Wooldridge shop.js — TYLER'S VERSION (V3 design language)
   The drawing-sheet dressing (frame, zone labels, title block) is retired;
   the shop-floor rituals stay.
   ========================================================================== */
(function () {
  "use strict";

  /* ---- 1. console easter egg ------------------------------------------- */
  try {
    var ink = "background:#1b75bb;color:#fff;padding:2px 6px;font-family:monospace";
    var blue = "color:#1b75bb;font-family:monospace;font-weight:700";
    var slate = "color:#71787e;font-family:monospace";
    console.log("%c  WOOLDRIDGE BOATS  //  EST. 1915  //  SEATTLE, WA  ", ink);
    console.log("%cGO FARTHER. GO SKINNY. GO WOOLDRIDGE.", blue);
    console.log(
      "%cEverything on this page was cut, welded, and floated by hand.\n" +
      "So was the website. If you read source for fun, you'd fit in here:\n" +
      "  jobs@wooldridgeboats.com\n\n" +
      "psst - the old ritual still works. up up down down left right left right B A.",
      slate
    );
  } catch (e) {}

  /* ---- 2. the ritual: konami code -> inverted palette ------------------- */
  var seq = [38, 38, 40, 40, 37, 39, 37, 39, 66, 65];
  var pos = 0;
  var toastTimer = null;

  function toast(msg) {
    var t = document.getElementById("shop-toast");
    if (!t) {
      t = document.createElement("div");
      t.id = "shop-toast";
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add("on");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("on"); }, 2600);
  }

  function toggleBlueprint() {
    var on = document.documentElement.classList.toggle("blueprint");
    toast(on ? "▲ NIGHT RUN // GO FARTHER" : "▼ BACK TO THE SHOP");
  }

  document.addEventListener("keydown", function (e) {
    if (document.documentElement.classList.contains("blueprint") && e.key === "Escape") {
      document.documentElement.classList.remove("blueprint");
      toast("▼ BACK TO THE SHOP");
      return;
    }
    pos = (e.keyCode === seq[pos]) ? pos + 1 : (e.keyCode === seq[0] ? 1 : 0);
    if (pos === seq.length) { pos = 0; toggleBlueprint(); }
  });

  /* ---- 3. mobile nav: inject hamburger + tap-open submenu -------------- */
  function initMobileNav() {
    var nav = document.querySelector(".nav");
    var wrap = nav && nav.querySelector(".wrap");
    if (!wrap || wrap.querySelector(".navtoggle")) return;

    var btn = document.createElement("button");
    btn.className = "navtoggle";
    btn.setAttribute("aria-label", "Menu");
    btn.setAttribute("aria-expanded", "false");
    btn.innerHTML = "<span></span><span></span><span></span>";
    // place the hamburger right after the logo so it sits at the top-right
    var brand = wrap.querySelector(".brand");
    if (brand && brand.nextSibling) wrap.insertBefore(btn, brand.nextSibling);
    else wrap.appendChild(btn);

    btn.addEventListener("click", function () {
      var open = nav.classList.toggle("nav-open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    });

    // "Our Boats" mega: tap toggles inline expansion on touch layouts
    var mega = wrap.querySelector(".hasmega");
    if (mega) {
      var link = mega.querySelector("a");
      link.addEventListener("click", function (e) {
        if (window.matchMedia("(max-width:900px)").matches) {
          e.preventDefault();
          mega.classList.toggle("mega-open");
        }
      });
    }

    // tapping a real destination closes the menu
    wrap.addEventListener("click", function (e) {
      var a = e.target.closest ? e.target.closest("a") : null;
      if (a && a.getAttribute("href") && a.getAttribute("href").charAt(0) !== "#" &&
          !a.classList.contains("brand")) {
        nav.classList.remove("nav-open");
      }
    });
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initMobileNav);
  } else {
    initMobileNav();
  }
})();
