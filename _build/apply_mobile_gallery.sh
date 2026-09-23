#!/bin/bash
# ------------------------------------------------------------------------------
# apply_mobile_gallery.sh — ingest a model's INDEPENDENT mobile gallery.
#
# Mobile is its OWN per-length set of portrait photos, supplied separately in the
# master's  <L>-<MODEL>-MOBILE/  folders — NOT derived from the desktop set, and
# free to have a different count/curation. Copies them to
#   assets/photos/<slug>/mobile/<hull>-<len>-<cfg>-NN.jpg   (+ 400px thumbs in mobile/thumbs/)
# and writes onto the model page:
#   <script>window.WB_MOBILE = { "<slug>": { "<len>": [ {f,cfg,hull}, ... ], ... } };</script>
# On a phone (<=700px) the shared lightbox shows this set for the tapped length,
# fully independent of the desktop gallery; >700px shows the desktop landscape
# gallery. HERO + GALLERY-THUMB stay shared from the desktop set (mobile folders
# are gallery images only). No *-MOBILE folders -> nothing to do.
#
# Usage:
#   _build/apply_mobile_gallery.sh <slug> "/path/to/<MODEL>-WEB" [--dry-run]
#   PHOTOSLUG=<photodir> _build/apply_mobile_gallery.sh <pageslug> "<SRC>"   # page dir != photo dir
#
# Auto-invoked at the end of apply_model_photos.sh, so a normal "Model Ready"
# build produces desktop + mobile in one shot. Idempotent (wipes mobile/ first).
# ------------------------------------------------------------------------------
set -uo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
SLUG="${1:-}"; SRC="${2:-}"; shift 2 2>/dev/null || true
DRY=0; for a in "$@"; do case "$a" in --dry-run) DRY=1;; esac; done
[ -n "$SLUG" ] && [ -n "$SRC" ] || { echo "usage: $0 <slug> \"/path/to/<MODEL>-WEB\" [--dry-run]"; exit 2; }
[ -d "$SRC" ] || { echo "ERROR: source not found: $SRC"; exit 2; }
PSLUG="${PHOTOSLUG:-$SLUG}"
PAGE="$REPO/models/$SLUG/index.html"
[ -f "$PAGE" ] || { echo "ERROR: model page not found: $PAGE"; exit 2; }
DEST="$REPO/assets/photos/$PSLUG/mobile"
MOBQ="${MOBQ:-75}"   # mozjpeg quality for the full portraits (keep-smaller: never enlarges, no visible loss on a phone)
HAVE_MOZ=0; command -v cjpeg >/dev/null 2>&1 && command -v djpeg >/dev/null 2>&1 && HAVE_MOZ=1
run(){ if [ "$DRY" = 1 ]; then echo "  [dry] $*"; else eval "$*"; fi; }
cfg_disp(){ case "$1" in cc)echo "Center Console";; ws)echo "Windshield";; tiller)echo "Tiller";; aft-ws)echo "Aft Windshield";; cabin)echo "Cabin";; first-responder)echo "First Responder";; *)echo "$1";; esac; }

# parse "NN-HULL-LEN-STYLE-..." -> echo "dest len cfgcode hull nn" (positional; hull optional)
parse_row(){
  local base stem; base="$(basename "$1")"; stem="${base%.jpg}"
  local -a t; IFS='-' read -r -a t <<< "$stem"
  local nn="${t[0]:-}" hull len style styn
  if printf '%s' "${t[1]:-}" | grep -qE '^[03-9][0-9]{3}$'; then hull="${t[1]:-}"; len="${t[2]:-}"; style="${t[3]:-}"; styn="${t[4]:-}";
  else hull=""; len="${t[1]:-}"; style="${t[2]:-}"; styn="${t[3]:-}"; fi
  local sl nl cfg
  if [ "${NOCFG:-0}" = 1 ]; then cfg=""   # NOCFG: model has no configuration (token after LEN is the model name)
  else
    sl="$(printf %s "$style"|tr 'A-Z' 'a-z')"; nl="$(printf %s "$styn"|tr 'A-Z' 'a-z')"
    if [ "$sl" = "aft" ] && [ "$nl" = "ws" ]; then cfg=aft-ws
    else case "$sl" in cc)cfg=cc;; ws)cfg=ws;; tiller)cfg=tiller;; cabin)cfg=cabin;; first-responder)cfg=first-responder;; *)cfg="?";; esac; fi
  fi
  local nn2; nn2="$(printf '%02d' "$((10#$nn))")"
  local seg=""; [ -n "$cfg" ] && seg="${cfg}-"
  local dest; if [ -n "$hull" ]; then dest="${hull}-${len}-${seg}${nn2}.jpg"; else dest="${len}-${seg}${nn2}.jpg"; fi
  printf '%s|%s|%s|%s|%s\n' "$dest" "$len" "$cfg" "$hull" "$nn2"   # pipe-delimited (NON-whitespace) so an empty cfg field is preserved by read (tab would collapse)
}

# copy a full portrait, recompressed with mozjpeg IF that comes out smaller
# (keep-smaller — never enlarge a well-compressed shot, no visible loss on a
# phone; dimensions preserved). Falls back to a plain copy without mozjpeg.
opt_full(){  # $1 src  $2 out
  if [ "$HAVE_MOZ" = 1 ]; then
    tmp="$2.opt.$$"
    if djpeg "$1" 2>/dev/null | cjpeg -quality "$MOBQ" -optimize -progressive > "$tmp" 2>/dev/null && [ -s "$tmp" ]; then
      os=$(stat -f %z "$1"); ns=$(stat -f %z "$tmp")
      if [ "$ns" -lt "$os" ]; then mv "$tmp" "$2"; return 0; fi
    fi
    rm -f "$tmp" 2>/dev/null
  fi
  cp "$1" "$2"
}

MOBDIRS=()
for d in "$SRC"/*/; do bn="$(basename "$d")"; case "$(printf %s "$bn"|tr 'A-Z' 'a-z')" in *mobile*) MOBDIRS+=("$d");; esac; done
[ "${#MOBDIRS[@]}" -gt 0 ] || { echo "no *-MOBILE folders in $(basename "$SRC") — nothing to do (desktop gallery stays as-is)"; exit 0; }

echo "mobile gallery: $SLUG  <-  $(basename "$SRC")  (${#MOBDIRS[@]} folder(s))"
[ "$HAVE_MOZ" = 1 ] && echo "  optimizing fulls: mozjpeg -quality $MOBQ (keep-smaller)" || echo "  (mozjpeg/cjpeg not found — fulls copied as-is)"
run "rm -rf \"$DEST\"; mkdir -p \"$DEST/thumbs\""
MAN="$(mktemp)"; n=0; skipped=0
shopt -s nullglob
for d in "${MOBDIRS[@]}"; do
  for f in "$d"*.jpg; do
    case "$(basename "$f")" in GALLERY-THUMB*|GALLERY-thumb*|.*) continue;; esac
    IFS='|' read -r dest len cfg hull nn <<< "$(parse_row "$f")"
    [ "$cfg" = "?" ] && { echo "  SKIP unknown trim: $(basename "$f")"; skipped=$((skipped+1)); continue; }
    if [ "$DRY" = 1 ]; then echo "  [dry] optimize+copy $(basename "$f") -> $dest"; else opt_full "$f" "$DEST/$dest"; fi
    run "sips -s format jpeg -Z 400 \"$f\" --out \"$DEST/thumbs/$dest\" >/dev/null 2>&1"
    printf '%s\t%s\t%s\t%s\n' "$len" "$nn" "$dest" "$(cfg_disp "$cfg")|$hull" >> "$MAN"
    n=$((n+1))
  done
done
shopt -u nullglob
echo "  mobile photos: $n  (skipped: $skipped)"

# Warn if the portraits aren't all the same pixel size — off-size shots letterbox
# in the fixed 4:5 frame instead of filling it (and used to bump the caption/
# thumbs on swipe). Keep every mobile shot identical (Tyler's 4:5 @1080×1350 spec).
if [ "$DRY" != 1 ]; then
  sz="$(for g in "$DEST"/*.jpg; do [ -e "$g" ] || continue; sips -g pixelWidth -g pixelHeight "$g" 2>/dev/null | awk '/pixelWidth/{w=$2}/pixelHeight/{h=$2}END{print w"x"h}'; done | sort | uniq -c)"
  if [ "$(printf '%s\n' "$sz" | sed '/^[[:space:]]*$/d' | wc -l | tr -d ' ')" -gt 1 ]; then
    echo "  ! SIZE MISMATCH — not all mobile shots share one pixel size (off-size ones letterbox instead of fill; re-export to match):"
    printf '%s\n' "$sz" | sed '/^[[:space:]]*$/d;s/^/      /'
  fi
fi

if [ "$DRY" = 1 ]; then
  echo "  [dry] would write per-length WB_MOBILE + $n thumbs, then stamp"; rm -f "$MAN"; exit 0
fi

SLUG="$PSLUG" MAN="$MAN" perl - "$PAGE" <<'PERL'
use strict; use warnings; my $page=shift;
open my $m,'<',$ENV{MAN} or die $!; my %by;
while(<$m>){ chomp; my ($len,$nn,$f,$rest)=split /\t/; my ($cfg,$hull)=split /\|/, ($rest//''), 2;
  push @{$by{$len}}, [$nn+0,$f,$cfg//'',$hull//'']; }
close $m;
my @lens = sort { $a <=> $b } keys %by;
my @lp;
for my $L (@lens){
  my @rows = sort { $a->[0] <=> $b->[0] } @{$by{$L}};
  my @objs = map { '{"f":"'.$_->[1].'","cfg":"'.$_->[2].'","hull":"'.$_->[3].'"}' } @rows;
  push @lp, '"'.$L.'":['.join(',',@objs).']';
}
my $json = '{"'.$ENV{SLUG}.'":{'.join(',',@lp).'}}';
open my $f,'<',$page or die $!; local $/; my $h=<$f>; close $f;
$h =~ s{<script>window\.WB_MOBILE=.*?</script>\n?}{}s;                       # drop any existing
my $tag = '<script>window.WB_MOBILE='.$json.';</script>'."\n";
$h =~ s{(<script src="\.\./\.\./assets/photo-data\.js)}{$tag$1}
  or warn "  (no photo-data.js tag found to anchor WB_MOBILE)\n";
open my $o,'>',$page or die $!; print $o $h; close $o;
my @c = map { $_.'ft='.scalar(@{$by{$_}}) } @lens;
print "  WB_MOBILE written: ".join(', ',@c)."\n";
PERL
rm -f "$MAN"
( cd "$REPO" && perl _build/stamp_assets.pl >/dev/null 2>&1 && echo "  cache-stamped" )
echo "  done. On phones (<=700px), $PSLUG shows its independent mobile set per length."
