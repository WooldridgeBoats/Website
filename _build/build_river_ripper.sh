#!/bin/bash
# build_river_ripper.sh — publish River Ripper at /river-ripper/ (Tyler, 2026-10-26).
#
# The game's MASTER lives in ~/Projects/RIVER-RIPPER (its own folder, its own
# PROJECT-HANDOFF.md). This copies just what a browser needs into
# river-ripper/ here, so it plays at dev.wooldridgeboats.com/river-ripper/ on
# any computer with no app. Re-run it after every change to the game, then
# commit river-ripper/ and push.
#
# Left out: the .wav audio masters (384 MB; the game loads the .m4a copies),
# the local-server script, empty and test folders, and backups.
#
# KEPT OUT OF GOOGLE FOR NOW: the page gets a noindex meta tag here and
# robots.txt disallows /river-ripper/. It IS linked from the footer ("River
# Ripper Game", Tyler 2026-10-26). To let search engines in, drop both.
#
# Usage: _build/build_river_ripper.sh [--dry-run]
set -eu
REPO="$(cd "$(dirname "$0")/.." && pwd)"
SRC="/Users/tylerlee/Projects/RIVER-RIPPER"
DST="$REPO/river-ripper"
DRY=""
[ "${1:-}" = "--dry-run" ] && DRY="--dry-run"
[ -f "$SRC/index.html" ] || { echo "ERROR: no game at $SRC"; exit 1; }

mkdir -p "$DST"
/usr/bin/rsync -a --delete $DRY --prune-empty-dirs \
    --exclude '.DS_Store' --exclude '*.wav' --exclude '*.bak' \
    --exclude 'serve-nocache.py' --exclude 'TESTS/' --exclude 'HTML/' \
    --include 'index.html' --include 'GAME/***' --exclude '*' \
    "$SRC/" "$DST/"

if [ -z "$DRY" ]; then
    # A REAL SITE PAGE, NOT A BARE GAME (Tyler, 2026-10-26): "once you click on
    # the link you are taken out of the website ... the goal is to keep
    # customers on our website". The master index.html is a full-window game;
    # the website copy is rebuilt here as a normal Wooldridge page -- site
    # header + menu on top (PARTIAL:header, so the phone menu needs shop.js),
    # the game in a 16:9 frame sized to fit the screen below the menu, the
    # site footer under it. The game's own <script> tags are lifted from the
    # master so their ?v= keys stay in step. Header/footer are stamped in by
    # inject_partials.pl at the end.
    /usr/bin/python3 - "$SRC/index.html" "$DST/index.html" "$REPO/faq/index.html" <<'PY'
import re, sys
master, out, ref = sys.argv[1], sys.argv[2], sys.argv[3]
m = open(master, encoding='utf-8').read()
r = open(ref, encoding='utf-8').read()
scripts = '\n'.join(re.findall(r'^\s*<script src="GAME/[^"]+"></script>', m, re.M))
house = re.search(r'house\.css\?v=([0-9a-z]+)', r).group(1)
shop = re.search(r'shop\.js\?v=([0-9a-z]+)', r).group(1)
page = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="robots" content="noindex, nofollow">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>River Ripper Game — Wooldridge Boats</title>
<meta name="description" content="River Ripper: run real Wooldridge jet boats up eight of the world's rivers.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@200;300;400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/house.css?v=HOUSE">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="/assets/brand/favicon-32.png">
<link rel="apple-touch-icon" sizes="180x180" href="/assets/brand/favicon-180.png">
<style>
  /* The game draws at a fixed 1280x720 and scales to whatever box holds it,
     so the frame only has to be 16:9 and fit under the menu. --rr-top is the
     menu's real height, measured below; 150px until then. */
  .rr-stage { background: #0d141a; padding: 18px 16px 20px; }
  .rr-frame {
    position: relative; margin: 0 auto;
    width: min(100%, 1280px, calc((100vh - var(--rr-top, 150px) - 74px) * 16 / 9));
    aspect-ratio: 16 / 9; background: #0a0a14; border-radius: 6px; overflow: hidden;
    box-shadow: 0 10px 30px rgba(0,0,0,0.35);
  }
  .rr-frame canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
  #glCanvas { z-index: 1; }
  #gameCanvas { z-index: 2; pointer-events: none; }
  .rr-help { color: #DFE3E6; opacity: .72; text-align: center; font: 500 13px Inter, -apple-system, Segoe UI, Arial, sans-serif;
             letter-spacing: .06em; margin: 12px 0 0; }
  .rr-help b { color: #fff; font-weight: 700; }
  .rr-touch { display: none; color: #F2C14E; text-align: center; font: 600 14px Inter, -apple-system, Segoe UI, Arial, sans-serif;
              margin: 0 0 12px; }
  .rr-touchhelp { display: none; }
  @media (hover: none) and (pointer: coarse) {
    .rr-touch, .rr-touchhelp { display: block; }
    .rr-keyhelp { display: none; }
  }
  /* See-through OUR BOATS dropdown on this page only (Tyler, 2026-10-26):
     the game stays visible behind it, softened by a blur so the boat names
     still read. Every other page keeps the solid white panel. */
  .rr-page .mega-in {
    background: rgba(255, 255, 255, 0.82);
    -webkit-backdrop-filter: blur(7px) saturate(1.15);
    backdrop-filter: blur(7px) saturate(1.15);
  }
</style>
</head>
<body class="rr-page">
<!-- PARTIAL:header -->
<!-- /PARTIAL:header -->
<main class="rr-stage">
  <p class="rr-touch">Tap the game to play &mdash; turn your phone sideways.</p>
  <div class="rr-frame">
    <canvas id="glCanvas" width="1280" height="720"></canvas>
    <canvas id="gameCanvas" width="1280" height="720"></canvas>
  </div>
  <p class="rr-help rr-touchhelp"><b>LEFT THUMB</b> slide to steer &nbsp;·&nbsp; <b>JUMP</b> &amp; <b>REVERSE</b> right thumb &nbsp;·&nbsp; the throttle runs itself</p>
  <p class="rr-help rr-keyhelp"><b>ENTER</b> start &nbsp;·&nbsp; <b>&uarr;</b> throttle &nbsp;·&nbsp; <b>&larr; &rarr;</b> steer &nbsp;·&nbsp; <b>&darr;</b> reverse &nbsp;·&nbsp; <b>SPACE</b> jump &nbsp;·&nbsp; <b>ESC</b> pause &nbsp;·&nbsp; <b>M</b> sound &nbsp;·&nbsp; <span style="opacity:.7">W A S D work too</span></p>
</main>
<script>
  (function () {
    function fit() {
      var nav = document.querySelector('.nav');
      if (nav) document.documentElement.style.setProperty('--rr-top', Math.ceil(nav.getBoundingClientRect().bottom + window.scrollY) + 'px');
    }
    fit(); window.addEventListener('resize', fit); window.addEventListener('load', fit);
  })();
</script>
<!-- PARTIAL:footer -->
<!-- /PARTIAL:footer -->
SCRIPTS
<script src="/assets/shop.js?v=SHOP"></script>
</body>
</html>
"""
page = page.replace('HOUSE', house).replace('SHOP', shop).replace('SCRIPTS', scripts)
open(out, 'w', encoding='utf-8').write(page)
PY
    /usr/bin/perl "$REPO/_build/inject_partials.pl" >/dev/null
    echo "river-ripper/: $(find "$DST" -type f | wc -l | tr -d ' ') files, $(du -sh "$DST" | cut -f1)"
fi
