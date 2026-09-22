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
#   - one  HERO-<hull>-<len>-<style>-<model>.jpg      (top level)
#   - per-length subfolders whose name STARTS with the length (e.g. 18-AK, 20-AK)
#     each containing:
#        NN-<hull>-<len>-<style>-<model>.jpg           (gallery photos)
#        one GALLERY-THUMB-<...>.jpg                    (that length's cover)
#
# Convention decoded POSITIONALLY: order-hull-length-style-model
#   hull  = 4xxx or 5xxx           length = 14..32           style = trim code
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

KNOWN_TRIMS="cc ws tiller aft-ws cabin first-responder"
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
heroes=( "$SRC"/HERO-*.jpg )
shopt -u nocaseglob
if   [ "${#heroes[@]}" -eq 0 ]; then err "no HERO-*.jpg at top level"
elif [ "${#heroes[@]}" -gt 1 ]; then warn "more than one HERO-*.jpg (${#heroes[@]}); the builder uses the first"
else ok "hero: $(basename "${heroes[0]}")"; fi

# ---- length subfolders -------------------------------------------------------
lensfound=0
for d in "$SRC"/*/; do
  bn="$(basename "$d")"
  # length = leading 2-digit number 14..32
  if [[ "$bn" =~ ^([0-9]{2}) ]]; then L="${BASH_REMATCH[1]}"; else continue; fi
  [[ "$L" =~ ^(1[4-9]|2[0-9]|3[0-2])$ ]] || continue
  lensfound=$((lensfound+1))
  echo "--- ${L}ft  ($bn) ---"

  shopt -s nullglob
  covers=( "$d"GALLERY-THUMB*.jpg "$d"GALLERY-thumb*.jpg )
  gal=()
  for f in "$d"*.jpg; do
    case "$(basename "$f")" in GALLERY-THUMB*|GALLERY-thumb*|.*) continue;; esac
    gal+=( "$f" )
  done
  shopt -u nullglob

  if   [ "${#covers[@]}" -eq 0 ]; then err "${L}ft: no GALLERY-THUMB-*.jpg cover"
  elif [ "${#covers[@]}" -gt 1 ]; then warn "${L}ft: ${#covers[@]} GALLERY-THUMB files (expected 1)"
  else ok "${L}ft cover: $(basename "${covers[0]}")"; fi

  [ "${#gal[@]}" -gt 0 ] || { warn "${L}ft: no gallery photos"; continue; }
  ok "${L}ft gallery photos: ${#gal[@]}"

  seen_order=" "   # space-delimited list of seen order#s (bash 3.2: no assoc arrays)
  for f in "${gal[@]}"; do
    base="$(basename "$f")"; stem="${base%.jpg}"
    IFS='-' read -r -a t <<< "$stem"
    nn="${t[0]:-}";
    if [[ "${t[1]:-}" =~ ^[45][0-9]{3}$ ]]; then hull="${t[1]:-}"; flen="${t[2]:-}"; style="${t[3]:-}"; styn="${t[4]:-}";
    else hull=""; flen="${t[1]:-}"; style="${t[2]:-}"; styn="${t[3]:-}"; fi
    stylelc="$(printf %s "$style" | tr 'A-Z' 'a-z')"
    nlc="$(printf %s "${styn:-}" | tr 'A-Z' 'a-z')"
    [ "$stylelc" = "aft" ] && [ "$nlc" = "ws" ] && stylelc="aft-ws"   # two-token AFT-WS config

    # order number
    [[ "$nn" =~ ^[0-9]{1,3}$ ]] || err "$base: order number '$nn' not numeric (name must start NN-)"
    if [[ "$nn" =~ ^[0-9]{1,3}$ ]]; then
      key=" $((10#$nn)) "
      case "$seen_order" in *"$key"*) warn "$base: duplicate order #$nn in ${L}ft — builder keeps both, just confirm intent";; esac
      seen_order="$seen_order$((10#$nn)) "
    fi
    # hull
    if [ -z "$hull" ]; then warn "$base: no hull# — caption will omit it (ok only if truly unknown)"; fi
    # length matches folder
    [ "$flen" = "$L" ] || err "$base: length token '$flen' != folder ${L}ft"
    # trim code
    if [ -z "$stylelc" ]; then err "$base: no trim code"
    elif ! is_trim "$stylelc"; then err "$base: UNKNOWN trim '$style' — add to build_gallery.pl %CFG + apply_model_photos.sh first"; fi
    # bytes / size
    if [ ! -s "$f" ]; then err "$base: 0 bytes (cloud-only placeholder? force-download it)"; else
      dim="$(sips -g pixelWidth -g pixelHeight "$f" 2>/dev/null | awk '/pixelWidth/{w=$2}/pixelHeight/{h=$2}END{print w"x"h}')"
      [ "$dim" = "2000x1250" ] || warn "$base: $dim (template output should be 2000x1250)"
    fi
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
