#!/bin/bash
# ------------------------------------------------------------------------------
# check_model_photos.sh — PRE-FLIGHT validator for a model's photo folder.
#
# Run this the moment you finish naming/sizing a model's master folder, BEFORE
# Claude converts the gallery. It vets every file against the naming convention
# and flags problems while they're still cheap to fix.
#
# Usage:
#   _build/check_model_photos.sh "/path/to/MASTER-WEBSITE PHOTOS/<MODEL>-WEB"
#
# Expects, inside that folder:
#   - one  HERO-<hull>-<len>-<style>-<model>.jpg      (top level; or several
#     NN-HERO-....jpg for a hero SLIDER, e.g. Deepwater 2026-10-07)
#   - per-length subfolders whose name STARTS with the length (e.g. 18-AK, 20-AK)
#     each containing:
#        NN-<hull>-<len>-<style>-<model>.jpg           (gallery photos)
#        one GALLERY-THUMB-<...>.jpg                    (that length's cover)
#
# Convention decoded POSITIONALLY: order-hull-length-style-model
#   hull  = 4xxx or 5xxx           length = 14..39           style = trim code
#   (style may also sit one token later, after the model name, e.g.
#    NN-HULL-33-DEEPWATER-ANGLER: the first known trim after LEN wins)
#   Known trims: cc ws tiller first-responder  (add new codes here AND in
#   build_gallery.pl %CFG + apply_model_photos.sh before building.)
#   All fulls should be 2000x1250 (16:10).
#
# Exit 0 = clean (safe to build). Exit 1 = issues found (fix first).
# ------------------------------------------------------------------------------
set -uo pipefail

SRC="${1:-}"
[ -n "$SRC" ] || { echo "usage: $0 \"/path/to/<MODEL>-WEB\""; exit 2; }
[ -d "$SRC" ] || { echo "ERROR: folder not found: $SRC"; exit 2; }

KNOWN_TRIMS="cc ws tiller aft-ws cabin pybus first-responder explorer angler"
errs=0; warns=0
err(){  echo "  ✗ $*"; errs=$((errs+1)); }
warn(){ echo "  ! $*"; warns=$((warns+1)); }
ok(){   echo "  ✓ $*"; }

is_trim(){ case " $KNOWN_TRIMS " in *" $1 "*) return 0;; *) return 1;; esac; }

echo "=============================================================="
echo "PRE-FLIGHT: $(basename "$SRC")"
echo "=============================================================="

# ---- HERO --------------------------------------------------------------------
shopt -s nullglob nocaseglob
heroes=( "$SRC"/HERO-*.jpg "$SRC"/[0-9][0-9]-HERO-*.jpg )   # NN-HERO-... = numbered slider heroes
shopt -u nocaseglob
if   [ "${#heroes[@]}" -eq 0 ]; then err "no HERO-*.jpg at top level"
elif [ "${#heroes[@]}" -gt 1 ]; then ok "${#heroes[@]} heroes (slider; the first is the card thumb): $(for h in "${heroes[@]}"; do printf '%s ' "$(basename "$h")"; done)"
else ok "hero: $(basename "${heroes[0]}")"; fi

# ---- one gallery file (desktop or phone) -------------------------------------
# $1 file  $2 folder length  $3 expected size (2000x1250 desktop, 1080x1350 phone)
# Uses seen_order + seen_dest, which each folder resets.
check_file(){
  local f="$1" L="$2" want="$3"
  local base stem nn hull flen style styn stylelc nlc j tj dim last key
  base="$(basename "$f")"; stem="${base%.jpg}"
  local -a t; IFS='-' read -r -a t <<< "$stem"
  nn="${t[0]:-}"
  if [[ "${t[1]:-}" =~ ^[03-9][0-9]{3}$ ]]; then hull="${t[1]:-}"; flen="${t[2]:-}"; style="${t[3]:-}"; styn="${t[4]:-}";
  else hull=""; flen="${t[1]:-}"; style="${t[2]:-}"; styn="${t[3]:-}"; fi
  stylelc="$(printf %s "$style" | tr 'A-Z' 'a-z')"
  nlc="$(printf %s "${styn:-}" | tr 'A-Z' 'a-z')"
  [ "$stylelc" = "aft" ] && [ "$nlc" = "ws" ] && stylelc="aft-ws"   # two-token AFT-WS config
  # trim AFTER the model name (NN-HULL-33-DEEPWATER-ANGLER): first known trim further on
  if [ "${NOCFG:-0}" != 1 ] && ! is_trim "$stylelc"; then
    if [[ "${t[1]:-}" =~ ^[03-9][0-9]{3}$ ]]; then j=4; else j=3; fi
    while [ "$j" -lt "${#t[@]}" ]; do
      tj="$(printf %s "${t[$j]}" | tr 'A-Z' 'a-z')"
      if is_trim "$tj"; then stylelc="$tj"; style="${t[$j]}"; break; fi
      j=$((j+1))
    done
  fi

  # order number
  [[ "$nn" =~ ^[0-9]{1,3}$ ]] || err "$base: order number '$nn' not numeric (name must start NN-)"
  # leftover copy: "...-ANGLER-MOBILE-1.jpg" (a Finder/Photoshop duplicate)
  last="${t[${#t[@]}-1]}"
  if [ "${#t[@]}" -gt 4 ] && [[ "$last" =~ ^[0-9]{1,2}$ ]]; then err "$base: ends in '-$last', which looks like a leftover copy; give it its own NN- number"; fi
  if [[ "$nn" =~ ^[0-9]{1,3}$ ]]; then
    # same order# + hull + length + trim = the SAME name on the site: one would overwrite the other
    key=" $hull|$flen|$stylelc|$((10#$nn)) "
    case "$seen_dest" in
      *"$key"*) err "$base: duplicate #$nn (same hull, length and trim as another file); one would overwrite the other, so renumber it";;
      *) case "$seen_order" in *" $((10#$nn)) "*) warn "$base: order #$nn is used twice in this folder (different hull, so both are kept); confirm that's intended";; esac;;
    esac
    seen_dest="$seen_dest$key"; seen_order="$seen_order$((10#$nn)) "
  fi
  # hull
  if [ -z "$hull" ]; then warn "$base: no hull# — caption will omit it (ok only if truly unknown)"; fi
  # length matches folder
  [ "$flen" = "$L" ] || err "$base: length token '$flen' != folder ${L}ft"
  # trim code
  if [ "${NOCFG:-0}" != 1 ]; then   # NOCFG models (e.g. Scout Widebody) have no trim — the token after LEN is the model name
    if [ -z "$stylelc" ]; then err "$base: no trim code"
    elif ! is_trim "$stylelc"; then err "$base: UNKNOWN trim '$style' — add it to ALL 4 scripts first: build_gallery.pl %CFG, apply_model_photos.sh (cfg_disp + parse_one), apply_mobile_gallery.sh (cfg_disp + parse_row), KNOWN_TRIMS here (or run with NOCFG=1 if this model has no configuration)"; fi
  fi
  # bytes / size
  if [ ! -s "$f" ]; then err "$base: 0 bytes (cloud-only placeholder? force-download it)"; else
    dim="$(sips -g pixelWidth -g pixelHeight "$f" 2>/dev/null | awk '/pixelWidth/{w=$2}/pixelHeight/{h=$2}END{print w"x"h}')"
    [ "$dim" = "$want" ] || warn "$base: $dim (template output should be $want)"
  fi
}

# ---- length subfolders: desktop <L>-<MODEL>, then phone <L>-<MODEL>-MOBILE -----
# (phone folders are checked too since 2026-10-07: a double #19 in a Deepwater
# phone folder slipped past when they were skipped)
lensfound=0; mobfound=0
for pass in desktop mobile; do
for d in "$SRC"/*/; do
  bn="$(basename "$d")"
  case "$(printf %s "$bn" | tr 'A-Z' 'a-z')" in *mobile*) [ "$pass" = mobile ] || continue;; *) [ "$pass" = desktop ] || continue;; esac
  # length = leading 2-digit number 14..39
  if [[ "$bn" =~ ^([0-9]{2}) ]]; then L="${BASH_REMATCH[1]}"; else continue; fi
  [[ "$L" =~ ^(1[4-9]|2[0-9]|3[0-9])$ ]] || continue

  shopt -s nullglob
  covers=( "$d"GALLERY-THUMB*.jpg "$d"GALLERY-thumb*.jpg )
  gal=()
  for f in "$d"*.jpg; do
    case "$(basename "$f")" in GALLERY-THUMB*|GALLERY-thumb*|.*) continue;; esac
    gal+=( "$f" )
  done
  shopt -u nullglob

  if [ "$pass" = desktop ]; then
    lensfound=$((lensfound+1))
    echo "--- ${L}ft  ($bn) ---"
    if   [ "${#covers[@]}" -eq 0 ]; then err "${L}ft: no GALLERY-THUMB-*.jpg cover"
    elif [ "${#covers[@]}" -gt 1 ]; then warn "${L}ft: ${#covers[@]} GALLERY-THUMB files (expected 1)"
    else ok "${L}ft cover: $(basename "${covers[0]}")"; fi
    want="2000x1250"
  else
    mobfound=$((mobfound+1))
    echo "--- ${L}ft phone  ($bn) ---"
    [ "${#covers[@]}" -eq 0 ] || warn "${L}ft phone: a GALLERY-THUMB in a phone folder is ignored (the cover comes from the desktop folder)"
    want="1080x1350"
  fi

  [ "${#gal[@]}" -gt 0 ] || { warn "${L}ft: no gallery photos in $bn"; continue; }
  ok "${L}ft $( [ "$pass" = mobile ] && echo 'phone ' )photos: ${#gal[@]}"

  seen_order=" "; seen_dest=" "   # space-delimited lists (bash 3.2: no assoc arrays)
  for f in "${gal[@]}"; do check_file "$f" "$L" "$want"; done
done
done

[ "$lensfound" -gt 0 ] || err "no length subfolders found (expected dirs like 18-AK, 20-AK)"

echo "=============================================================="
if [ "$errs" -eq 0 ]; then
  echo "RESULT: PASS  ($warns warning(s)) — safe to build."
else
  echo "RESULT: $errs error(s), $warns warning(s) — fix errors before building."
fi
echo "=============================================================="
[ "$errs" -eq 0 ]
