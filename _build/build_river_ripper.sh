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
# UNLISTED FOR NOW: the copy gets a noindex meta tag here and robots.txt
# disallows /river-ripper/, and nothing on the site links to it. When Tyler
# wants it public, drop both and link it.
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
    # noindex, once.
    if ! grep -q 'name="robots"' "$DST/index.html"; then
        /usr/bin/sed -i '' 's#<meta charset="UTF-8">#<meta charset="UTF-8">\
    <meta name="robots" content="noindex, nofollow">#' "$DST/index.html"
    fi
    echo "river-ripper/: $(find "$DST" -type f | wc -l | tr -d ' ') files, $(du -sh "$DST" | cut -f1)"
fi
