#!/bin/bash
# ------------------------------------------------------------------------------
# apply_model_photos.sh — one-command per-model gallery conversion.
#
# Converts ONE boat model's page + gallery to the new (Alaskan LT) scheme from a
# vetted master photo folder. Run check_model_photos.sh FIRST; this script also
# re-runs that check and refuses to build if it finds errors (override: --force).
#
# Usage:
#   _build/apply_model_photos.sh <slug> "<Display Name>" "/path/to/<MODEL>-WEB" [--dry-run] [--force]
# Example:
#   _build/apply_model_photos.sh alaskanxl "Alaskan XL" "/Users/.../MASTER-WEBSITE PHOTOS/ALASKAN-XL-WEB"
#
# <slug> is the PAGE dir (models/<slug>/). Photos go in assets/photos/<slug>/ by default.
# When the photo dir differs from the page dir, set PHOTOSLUG, e.g. Alaskan XLT:
#   PHOTOSLUG=alaskan-xlt _build/apply_model_photos.sh xlt "Alaskan XLT" "/Users/.../ALASKAN XLT-WEB"
#
# Does: wipe old assets/photos/<slug> fulls+thumbs -> copy fulls (remapped to
# HULL-LEN-cfg-NN.jpg) -> 800x500 thumbs -> per-length cover-NN thumbs -> hero
# full + hero.jpg card thumb -> rewrite the model page gallery (captioned) + hero
# figcaption + WB_COVERS -> repoint homepage fleet card + compare thumb to the
# hero -> regen provenance -> build_gallery.pl + stamp_assets.pl. Prints a
# verification checklist and any leftover refs (e.g. lp/) to review by hand.
# ------------------------------------------------------------------------------
set -uo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
SLUG="${1:-}"; MODEL="${2:-}"; SRC="${3:-}"; shift 3 2>/dev/null || true
DRY=0; FORCE=0
for a in "$@"; do case "$a" in --dry-run) DRY=1;; --force) FORCE=1;; esac; done
[ -n "$SLUG" ] && [ -n "$MODEL" ] && [ -n "$SRC" ] || { echo "usage: $0 <slug> \"<Display Name>\" \"/path/to/<MODEL>-WEB\" [--dry-run] [--force]"; exit 2; }
[ -d "$SRC" ] || { echo "ERROR: source not found: $SRC"; exit 2; }
PAGE="$REPO/models/$SLUG/index.html"
[ -f "$PAGE" ] || { echo "ERROR: model page not found: $PAGE"; exit 2; }
PSLUG="${PHOTOSLUG:-$SLUG}"   # photo dir under assets/photos/; set PHOTOSLUG when it differs from the page slug (e.g. page 'xlt' / photos 'alaskan-xlt')
DEST="$REPO/assets/photos/$PSLUG"
say(){ echo "$*"; }
run(){ if [ "$DRY" = 1 ]; then echo "  [dry] $*"; else eval "$*"; fi; }

# ---- 0) pre-flight -----------------------------------------------------------
if [ -x "$REPO/_build/check_model_photos.sh" ]; then
  if ! bash "$REPO/_build/check_model_photos.sh" "$SRC" >/tmp/pf.$$ 2>&1; then
    tail -25 /tmp/pf.$$; rm -f /tmp/pf.$$
    [ "$FORCE" = 1 ] || { echo "ABORT: pre-flight found errors (use --force to override)"; exit 1; }
    echo "WARNING: pre-flight errors ignored (--force)"
  else rm -f /tmp/pf.$$; say "pre-flight: PASS"; fi
fi

cfg_disp(){ case "$1" in cc)echo "Center Console";; ws)echo "Windshield";; tiller)echo "Tiller";; aft-ws)echo "Aft Windshield";; cabin)echo "Cabin";; first-responder)echo "First Responder";; *)echo "?$1";; esac; }
upper(){ printf '%s' "$1" | tr 'a-z' 'A-Z'; }

# parse "NN-HULL-LEN-STYLE-..." -> "dest hull len cfg" (positional; hull optional)
parse_one(){
  local base stem; base="$(basename "$1")"; stem="${base%.jpg}"
  local -a t; IFS='-' read -r -a t <<< "$stem"
  local nn="${t[0]:-}" hull len style styn
  if printf '%s' "${t[1]:-}" | grep -qE '^[45][0-9]{3}$'; then hull="${t[1]:-}"; len="${t[2]:-}"; style="${t[3]:-}"; styn="${t[4]:-}";
  else hull=""; len="${t[1]:-}"; style="${t[2]:-}"; styn="${t[3]:-}"; fi
  local sl nl cfg; sl="$(printf %s "$style" | tr 'A-Z' 'a-z')"; nl="$(printf %s "$styn" | tr 'A-Z' 'a-z')"
  if [ "$sl" = "aft" ] && [ "$nl" = "ws" ]; then cfg=aft-ws   # two-token config "AFT-WS" -> Aft Windshield
  else case "$sl" in cc)cfg=cc;; ws)cfg=ws;; tiller)cfg=tiller;; cabin)cfg=cabin;; first-responder)cfg=first-responder;; *)cfg="?";; esac; fi
  local nn2; nn2="$(printf '%02d' "$((10#$nn))")"
  if [ -n "$hull" ]; then echo "${hull}-${len}-${cfg}-${nn2}.jpg $hull $len $cfg"; else echo "${len}-${cfg}-${nn2}.jpg  $len $cfg"; fi
}

# ---- 1) discover length subfolders (leading number) --------------------------
LENDIRS=()
for d in "$SRC"/*/; do bn="$(basename "$d")"; if printf '%s' "$bn" | grep -qE '^(1[4-9]|2[0-9]|3[0-2])'; then LENDIRS+=("$d"); fi; done
[ "${#LENDIRS[@]}" -gt 0 ] || { echo "ERROR: no length subfolders in $SRC"; exit 1; }

# ---- 2) assets: wipe + copy fulls/thumbs, build gallery HTML + covers list ----
GAL="$(mktemp)"; COVERKEYS=""
say "converting: $MODEL ($SLUG)  <-  $(basename "$SRC")"
run "rm -f \"$DEST\"/*.jpg; mkdir -p \"$DEST/thumbs\"; rm -f \"$DEST/thumbs\"/*.jpg"
: > "$GAL"

# order length dirs ascending by their leading number (no global IFS mutation)
LENDIRS_SORTED=()
while IFS= read -r _line; do LENDIRS_SORTED+=("${_line#*|}"); done < <(
  for d in "${LENDIRS[@]}"; do n=$(basename "$d"|grep -oE '^[0-9]{2}'); echo "$n|$d"; done | sort -n
)

for d in "${LENDIRS_SORTED[@]}"; do
  L="$(basename "$d" | grep -oE '^[0-9]{2}')"
  # gallery photos in this length, sorted by filename (zero-padded order = numeric order)
  shopt -s nullglob
  for f in "$d"*.jpg; do
    case "$(basename "$f")" in GALLERY-THUMB*|GALLERY-thumb*|.*) continue;; esac
    read -r dest hull len cfg <<< "$(parse_one "$f")"
    [ "$cfg" = "?" ] && { echo "  SKIP unknown trim: $(basename "$f")"; continue; }
    run "cp \"$f\" \"$DEST/$dest\""
    run "sips -s format jpeg -Z 800 \"$f\" --out \"$DEST/thumbs/$dest\" >/dev/null 2>&1"
    local_cd="$(cfg_disp "$cfg")"
    if [ -n "$hull" ]; then altsuf=" &#8212; Hull $hull"; else altsuf=""; fi
    printf '          <a href="../../assets/photos/%s/%s"><img src="../../assets/photos/%s/thumbs/%s" alt="%s&#8242; %s %s%s" loading="lazy"><span class="gcap"><b>%s&#8242; %s</b>%s</span></a>\n' \
      "$PSLUG" "$dest" "$PSLUG" "$dest" "$L" "$local_cd" "$MODEL" "$altsuf" "$L" "$local_cd" "$MODEL" >> "$GAL"
  done
  # cover for this length
  cov=""; for c in "$d"GALLERY-THUMB*.jpg "$d"GALLERY-thumb*.jpg; do [ -f "$c" ] && cov="$c" && break; done
  shopt -u nullglob
  if [ -n "$cov" ]; then
    run "sips -s format jpeg -Z 800 \"$cov\" --out \"$DEST/thumbs/cover-$L.jpg\" >/dev/null 2>&1"
    COVERKEYS="$COVERKEYS\"$L\":\"../../assets/photos/$PSLUG/thumbs/cover-$L.jpg\","
  fi
done

# ---- 3) hero (full, NO thumb) + hero.jpg card thumb --------------------------
shopt -s nullglob nocaseglob; HEROES=("$SRC"/HERO-*.jpg); shopt -u nocaseglob nullglob
[ "${#HEROES[@]}" -gt 0 ] || { echo "ERROR: no HERO-*.jpg"; exit 1; }
HERO="${HEROES[0]}"
read -r hdest hhull hlen hcfg <<< "$(parse_one "$(basename "$HERO" | sed 's/^HERO-/00-/')")"   # reuse parser (fake order 00)
HERODEST="hero-${hhull}-${hlen}-${hcfg}.jpg"
run "cp \"$HERO\" \"$DEST/$HERODEST\""
run "sips -s format jpeg -Z 800 \"$HERO\" --out \"$DEST/thumbs/hero.jpg\" >/dev/null 2>&1"
HCFG_DISP="$(cfg_disp "$hcfg")"

say "  hero: $HERODEST  (hull $hhull, ${hlen}ft, $HCFG_DISP)"
say "  covers: [${COVERKEYS%,}]"
say "  gallery photos: $(wc -l < "$GAL" | tr -d ' ')"

# ---- 4) rewrite the model page (hero figure, gallery block, WB_COVERS) -------
if [ "$DRY" = 1 ]; then
  echo "  [dry] would rewrite $PAGE (hero figcaption, gallery captioned block, WB_COVERS)"
  echo "  ---- gallery HTML preview (first 3) ----"; head -3 "$GAL" | sed 's/^/    /'
else
  MODEL="$MODEL" SLUG="$PSLUG" HERODEST="$HERODEST" HHULL="$hhull" HLEN="$hlen" \
  HCFG_DISP="$HCFG_DISP" HCFG_UP="$(upper "$HCFG_DISP")" MODEL_UP="$(upper "$MODEL")" \
  COVERKEYS="${COVERKEYS%,}" GALF="$GAL" perl - "$PAGE" <<'PERL'
use strict; use warnings;
my $page=shift; my %E=%ENV;
open my $g,'<',$E{GALF} or die $!; local $/; my $gal=<$g>; close $g; chomp $gal;
open my $f,'<',$page or die $!; my $h=<$f>; close $f;
my ($slug,$model)=@E{qw/SLUG MODEL/};
# hero figure
my $hero=qq{<figure class="modelhero"><img src="../../assets/photos/$slug/$E{HERODEST}" alt="$model &#8212; $E{HLEN}&#8242; $E{HCFG_DISP}, Hull $E{HHULL}"><figcaption>$E{MODEL_UP} &#8212; $E{HLEN}&#8242; $E{HCFG_UP}<span class="ref">HULL #$E{HHULL}</span></figcaption></figure>};
$h =~ s{<figure class="modelhero">.*?</figure>}{$hero}s or warn "  (no modelhero figure found)\n";
# gallery block
my $block=qq{<div class="gallery captioned">\n$gal\n        </div>};
$h =~ s{<div class="gallery(?: captioned)?">.*?</div>}{$block}s or warn "  (no gallery block found)\n";
# WB_COVERS: drop any existing, insert fresh before photo-data.js
$h =~ s{<script>window\.WB_COVERS=.*?</script>\n?}{}s;
my $cov=qq{<script>window.WB_COVERS={"$slug":{$E{COVERKEYS}}};</script>\n};
$h =~ s{(<script src="\.\./\.\./assets/photo-data\.js)}{$cov$1} or warn "  (no photo-data.js tag)\n";
open my $o,'>',$page or die $!; print $o $h; close $o;
print "  model page rewritten\n";
PERL
fi

# ---- 5) cross-page: homepage fleet card + compare thumb -> hero.jpg ----------
if [ "$DRY" = 1 ]; then
  echo "  [dry] would repoint homepage fleet card + compare thumb -> assets/photos/$PSLUG/thumbs/hero.jpg"
else
  SLUG="$SLUG" PSLUG="$PSLUG" perl -0pi -e 'my $s=$ENV{SLUG}; my $p=$ENV{PSLUG}; s{(\{[^{}]*?)"ph":"[^"]*"([^{}]*?"url":"models/\Q$s\E/")}{$1"ph":"assets/photos/$p/thumbs/hero.jpg"$2}s' "$REPO/index.html"
  SLUG="$SLUG" PSLUG="$PSLUG" perl -0pi -e 'my $s=$ENV{SLUG}; my $p=$ENV{PSLUG}; s{(\bph:\s*'"'"')[^'"'"']*('"'"'[^{}]*?url:\s*'"'"'/models/\Q$s\E/'"'"')}{$1/assets/photos/$p/thumbs/hero.jpg$2}s' "$REPO/compare/index.html"
  say "  repointed homepage + compare -> hero.jpg"
fi

# ---- 6) provenance: swap bare "<slug>/..." keys for current files ------------
if [ "$DRY" = 1 ]; then echo "  [dry] would regen WB_VETTED keys for $PSLUG"; else
  SLUG="$PSLUG" DEST="$DEST" perl - "$REPO/assets/media-provenance.js" <<'PERL'
use strict; use warnings; my $prov=shift; my $s=$ENV{SLUG};
opendir my $dh,$ENV{DEST} or die $!; my @files=sort grep {/\.jpe?g$/i} readdir $dh; closedir $dh;
open my $f,'<',$prov or die $!; local $/; my $h=<$f>; close $f;
$h =~ s/"\Q$s\E\/[^"]*":[01],//g;
my $ins=join('',map {"\"$s/$_\":1,"} @files);
$h =~ s/(window\.WB_VETTED\s*=\s*\{)/$1$ins/ or die "no WB_VETTED anchor";
open my $o,'>',$prov or die $!; print $o $h; close $o;
print "  provenance: ".scalar(@files)." keys for $s\n";
PERL
fi

# ---- 7) rebuild data + fleet page + cache-bust -------------------------------
if [ "$DRY" = 1 ]; then echo "  [dry] would run build_gallery.pl + stamp_assets.pl"; else
  ( cd "$REPO" && perl _build/build_gallery.pl 2>&1 | grep -iE "(^| )$PSLUG |MISSING THUMB: $PSLUG/" )
  ( cd "$REPO" && perl _build/stamp_assets.pl >/dev/null 2>&1 && echo "  cache-stamped" )
fi
rm -f "$GAL"

# ---- 8) post-build report ----------------------------------------------------
echo "--------------------------------------------------------------"
if [ "$DRY" = 1 ]; then echo "DRY-RUN complete — nothing written."; else
  echo "DONE. Verify:"
  echo "  • serve: python3 -m http.server 8811   then open /models/$SLUG/"
  echo "  • model page: N cover cards (one per length), gcaps, hero loads, 0 broken imgs, no console errors"
  echo "  • lightbox caption switches config+hull; homepage fleet card = hero"
  leftover="$(grep -rl "photos/$PSLUG/" "$REPO"/lp/*.html 2>/dev/null || true)"
  [ -n "$leftover" ] && { echo "  • REVIEW lp/ refs to photos/$PSLUG/ (persona heroes are model-specific):"; echo "$leftover" | sed 's/^/      /'; }
  echo "  • commit when happy (you drive the push):"
  echo "      cd $REPO && git add -A && git commit -m \"$MODEL: 2026 photo set\""
fi
