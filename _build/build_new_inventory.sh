#!/bin/bash
# build_new_inventory.sh — photos for the New Inventory page (new-inventory/), Tyler 2026-10-20.
#
# Source: MASTER-WEBSITE PHOTOS/NEW INVENTORY/, ONE folder per boat for sale, named by hull so the
# exact boat from the shop is clear:
#     <HULL>-<LEN>-<CFG>-<MODEL>/          e.g. 5334-18-WS-ALASKAN/
#         HERO-<HULL>-<LEN>-<CFG>-<MDL>.jpg        hero slide (2000x1250) + homepage thumb
#         GALLERY-THUMB-<HULL>-....jpg             gallery card cover
#         NN-<HULL>-<LEN>-<CFG>-<MDL>.jpg          gallery, in order
#     <HULL>-<LEN>-...-MOBILE/                 phone set, NN-<HULL>-...-MOBILE.jpg (1080x1350)
# Output: assets/newinv/<HULL>/ hero.jpg, NN.jpg, thumbs/{hero,cover,NN}.jpg, mobile/NN.jpg,
# mobile/thumbs/NN.jpg, and the WB_NEWINV_PHOTOS line in new-inventory/index.html (photo counts +
# a cache stamp per boat) and assets/instock.js (the In Stock menu link, main site + store). Price, engine,
# words and SOLD live in the NEWINV list in that page: after changing sold:, re-run this script.
#
# Usage: _build/build_new_inventory.sh [--dry-run] ["/path/to/NEW INVENTORY"]
# Checks every file name first and stops if any is wrong (Tyler fixes them; no workarounds).
# A sold boat's folder can stay; boats not in the master are left alone in assets/ (remove by hand).
set -u
REPO="$(cd "$(dirname "$0")/.." && pwd)"
SRC="/Users/tylerlee/Library/CloudStorage/OneDrive-WooldridgeBoatsInc/Wooldridge Boats Inc_ - SQUIRREL HOLE/70 MARKETING AND BRAND/WEBSITE/MASTER-WEBSITE PHOTOS/NEW INVENTORY"
DRY=0
for a in "$@"; do if [ "$a" = "--dry-run" ]; then DRY=1; else SRC="$a"; fi; done
[ -d "$SRC" ] || { echo "ERROR: no folder: $SRC"; exit 1; }
PAGE="$REPO/new-inventory/index.html"
shopt -s nullglob

# ---- 1) check names ---------------------------------------------------------------
bad=0; boats=()
for d in "$SRC"/*/; do
  name="$(basename "$d")"
  case "$name" in *-MOBILE) continue;; esac
  if ! [[ "$name" =~ ^([0-9]{4})-([0-9]{2})- ]]; then echo "  ✗ folder not HULL-LEN-…: $name"; bad=1; continue; fi
  hull="${BASH_REMATCH[1]}"; len="${BASH_REMATCH[2]}"; boats+=("$hull|$len|$d")
  h=("$d"HERO-"$hull"-"$len"-*.jpg); g=("$d"GALLERY-THUMB-"$hull"-"$len"-*.jpg)
  [ ${#h[@]} -eq 1 ] || { echo "  ✗ $name: need exactly one HERO-$hull-$len-….jpg (found ${#h[@]})"; bad=1; }
  [ ${#g[@]} -eq 1 ] || { echo "  ✗ $name: need exactly one GALLERY-THUMB-$hull-$len-….jpg (found ${#g[@]})"; bad=1; }
  for f in "$d"*; do
    b="$(basename "$f")"
    [[ "$b" =~ ^(HERO|GALLERY-THUMB|[0-9]{2})-$hull-$len-.+\.jpg$ ]] || { echo "  ✗ $name/$b: not NN-$hull-$len-….jpg"; bad=1; }
  done
  m=("$SRC"/"$hull"-"$len"-*-MOBILE/)
  [ ${#m[@]} -le 1 ] || { echo "  ✗ $hull: more than one -MOBILE folder"; bad=1; }
  if [ ${#m[@]} -eq 1 ]; then
    [ "$(basename "${m[0]}")" = "$name-MOBILE" ] || echo "  ! phone folder is $(basename "${m[0]}") (expected $name-MOBILE); matched by hull, builds fine"
    for f in "${m[0]}"*; do
      b="$(basename "$f")"
      [[ "$b" =~ ^[0-9]{2}-$hull-$len-.+-MOBILE\.jpg$ ]] || { echo "  ✗ $(basename "${m[0]}")/$b: not NN-$hull-$len-…-MOBILE.jpg"; bad=1; }
    done
  fi
done
[ ${#boats[@]} -gt 0 ] || { echo "ERROR: no boat folders in $SRC"; exit 1; }
[ $bad -eq 0 ] || { echo "FIX THE NAMES ABOVE, then re-run. Nothing written."; exit 1; }
echo "names: OK (${#boats[@]} boat(s))"

# ---- 2) copy + thumbs --------------------------------------------------------------
json=""
for row in "${boats[@]}"; do
  IFS='|' read -r hull len d <<< "$row"
  out="$REPO/assets/newinv/$hull"
  gal=("$d"[0-9][0-9]-"$hull"-*.jpg); m=("$SRC"/"$hull"-"$len"-*-MOBILE/); mob=()
  [ ${#m[@]} -eq 1 ] && mob=("${m[0]}"[0-9][0-9]-*.jpg)
  echo "  $hull: ${#gal[@]} desktop, ${#mob[@]} phone  <- $(basename "$d")"
  if [ $DRY -eq 1 ]; then continue; fi
  rm -rf "$out"; mkdir -p "$out/thumbs" "$out/mobile/thumbs"
  h=("$d"HERO-*.jpg); g=("$d"GALLERY-THUMB-*.jpg)
  cp "${h[0]}" "$out/hero.jpg"; sips -s format jpeg -Z 800 "${h[0]}" --out "$out/thumbs/hero.jpg" >/dev/null
  sips -s format jpeg -Z 800 "${g[0]}" --out "$out/thumbs/cover.jpg" >/dev/null
  for f in "${gal[@]}"; do nn="$(basename "$f" | cut -c1-2)"
    cp "$f" "$out/$nn.jpg"; sips -s format jpeg -Z 800 "$f" --out "$out/thumbs/$nn.jpg" >/dev/null; done
  for f in "${mob[@]}"; do nn="$(basename "$f" | cut -c1-2)"
    cp "$f" "$out/mobile/$nn.jpg"; sips -s format jpeg -Z 400 "$f" --out "$out/mobile/thumbs/$nn.jpg" >/dev/null; done
  v="$(cat "$out"/*.jpg "$out"/thumbs/*.jpg | md5 -q | cut -c1-8)"
  json="$json${json:+,}\"$hull\":{\"n\":${#gal[@]},\"m\":${#mob[@]},\"v\":\"$v\"}"
done
[ $DRY -eq 1 ] && { echo "[dry run] nothing written."; exit 0; }

# ---- 3) the page's photo line ------------------------------------------------------
line="<script>window.WB_NEWINV_PHOTOS={$json};</script>"
LINE="$line" perl -0pi -e 's{<script>window\.WB_NEWINV_PHOTOS=.*?</script>}{$ENV{LINE}}s or die "no WB_NEWINV_PHOTOS line in page\n"' "$PAGE" && echo "  page: $line"
# ---- 4) the "In Stock" menu switch: on while any NEWINV boat has sold:false ------------------
# Both menus read assets/instock.js: the main site (header.html) and the store header, so they always
# match. Selling the last boat (sold:true) or emptying NEWINV turns the link off on both.
avail="$(perl -0ne 'print scalar(() = /sold:\s*false/g) if /const NEWINV = \[(.*?)\n  \];/s && ($_ = $1)' "$PAGE")"
avail="${avail:-0}"
perl -0pi -e "s{window\.WB_INSTOCK = \d+;}{window.WB_INSTOCK = $avail;}" "$REPO/assets/instock.js"
echo "  In Stock link: $([ "$avail" -gt 0 ] && echo "ON ($avail for sale)" || echo OFF)"
perl "$REPO/_build/stamp_assets.pl" >/dev/null && echo "  cache-stamped"
echo "DONE. Check /new-inventory/ at 1440 + 390, then commit with explicit paths."
