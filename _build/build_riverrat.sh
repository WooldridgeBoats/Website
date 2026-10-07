#!/bin/bash
# ------------------------------------------------------------------------------
# build_riverrat.sh: photos for the River Rat DIY Kit page (models/riverrat-diy-kit/).
#
# The kit has no length, no hull # and no configuration (Tyler, 2026-10-07: "just a
# few photos to show kits customers have built"), so the standard Model Ready
# (apply_model_photos.sh), which needs a length on every photo, doesn't fit. This
# does the same job for a one-gallery page:
#   HERO-*.jpg                  -> hero-riverrat.jpg (+ thumbs/hero.jpg)
#   <folder>/GALLERY-THUMB*.jpg -> thumbs/cover.jpg (the gallery card)
#   <folder>/NN-*.jpg           -> riverrat-NN.jpg + 800px thumb
#   <folder>-MOBILE/NN-*.jpg    -> mobile/riverrat-NN.jpg + 400px thumb (copied as-is)
# then rewrites the page's gallery block, WB_COVERS + WB_MOBILE (both keyed "all",
# gallery.js's no-length key), regenerates provenance, photo-data.js and the stamps.
#
# Usage: _build/build_riverrat.sh ["/path/to/RIVER RAT-WEB"]
# ------------------------------------------------------------------------------
set -uo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
SLUG=riverrat-diy-kit
SRC="${1:-/Users/tylerlee/Library/CloudStorage/OneDrive-WooldridgeBoatsInc/Wooldridge Boats Inc_ - SQUIRREL HOLE/70 MARKETING AND BRAND/WEBSITE/MASTER-WEBSITE PHOTOS/RIVER RAT-WEB}"
DEST="$REPO/assets/photos/$SLUG"
PAGE="$REPO/models/$SLUG/index.html"
[ -d "$SRC" ] || { echo "ERROR: source not found: $SRC"; exit 2; }

DESK=""; MOB=""
for d in "$SRC"/*/; do case "$(basename "$d" | tr 'a-z' 'A-Z')" in *MOBILE*) MOB="$d";; *) DESK="$d";; esac; done
[ -n "$DESK" ] || { echo "ERROR: no desktop photo folder in $SRC"; exit 1; }
shopt -s nullglob nocaseglob
HEROES=( "$SRC"/HERO-*.jpg ); COVERS=( "$DESK"GALLERY-THUMB*.jpg )
shopt -u nocaseglob
[ "${#HEROES[@]}" -gt 0 ] || { echo "ERROR: no HERO-*.jpg"; exit 1; }

echo "River Rat DIY Kit  <-  $(basename "$SRC")"
rm -rf "$DEST"; mkdir -p "$DEST/thumbs" "$DEST/mobile/thumbs"
cp "${HEROES[0]}" "$DEST/hero-riverrat.jpg"
sips -s format jpeg -Z 800 "${HEROES[0]}" --out "$DEST/thumbs/hero.jpg" >/dev/null 2>&1
echo "  hero: $(basename "${HEROES[0]}")"
COV=""
if [ "${#COVERS[@]}" -gt 0 ]; then
  sips -s format jpeg -Z 800 "${COVERS[0]}" --out "$DEST/thumbs/cover.jpg" >/dev/null 2>&1
  COV="\"all\":\"../../assets/photos/$SLUG/thumbs/cover.jpg\""
  echo "  cover: $(basename "${COVERS[0]}")"
fi

GAL="$(mktemp)"; n=0
for f in "$DESK"[0-9][0-9]-*.jpg; do
  nn="$(basename "$f" | grep -oE '^[0-9]{2}')"; dest="riverrat-$nn.jpg"
  cp "$f" "$DEST/$dest"
  sips -s format jpeg -Z 800 "$f" --out "$DEST/thumbs/$dest" >/dev/null 2>&1
  printf '          <a href="../../assets/photos/%s/%s"><img src="../../assets/photos/%s/thumbs/%s" alt="River Rat DIY Kit &#8212; customer build %s" loading="lazy"><span class="gcap"><b>River Rat DIY Kit</b></span></a>\n' \
    "$SLUG" "$dest" "$SLUG" "$dest" "$((10#$nn))" >> "$GAL"
  n=$((n+1))
done
echo "  desktop photos: $n"

MOBJ=""; m=0
if [ -n "$MOB" ]; then
  for f in "$MOB"[0-9][0-9]-*.jpg; do
    nn="$(basename "$f" | grep -oE '^[0-9]{2}')"; dest="riverrat-$nn.jpg"
    cp "$f" "$DEST/mobile/$dest"
    sips -s format jpeg -Z 400 "$f" --out "$DEST/mobile/thumbs/$dest" >/dev/null 2>&1
    MOBJ="$MOBJ{\"f\":\"$dest\",\"cfg\":\"\",\"hull\":\"\"},"
    m=$((m+1))
  done
fi
shopt -u nullglob
echo "  phone photos: $m"

COV="$COV" MOBJ="${MOBJ%,}" SLUG="$SLUG" GALF="$GAL" perl - "$PAGE" <<'PERL'
use strict; use warnings;
my $page=shift; my %E=%ENV;
open my $g,'<',$E{GALF} or die $!; local $/; my $gal=<$g>; close $g; chomp $gal;
open my $f,'<',$page or die $!; my $h=<$f>; close $f;
$h =~ s{<div class="gallery captioned">.*?</div>}{<div class="gallery captioned">\n$gal\n        </div>}s or die "no gallery block in the page\n";
$h =~ s{<script>window\.WB_COVERS=.*?</script>\n?}{}s;
$h =~ s{<script>window\.WB_MOBILE=.*?</script>\n?}{}s;
my $tags = qq{<script>window.WB_COVERS={"$E{SLUG}":{$E{COV}}};</script>\n};
$tags .= qq{<script>window.WB_MOBILE={"$E{SLUG}":{"all":[$E{MOBJ}]}};</script>\n} if $E{MOBJ} ne '';
$h =~ s{(<script src="\.\./\.\./assets/photo-data\.js)}{$tags$1} or die "no photo-data.js tag in the page\n";
open my $o,'>',$page or die $!; print $o $h; close $o;
print "  page rewritten\n";
PERL
rm -f "$GAL"

# provenance (internal ?wbph=1 view): list the current files as vetted
SLUG="$SLUG" DEST="$DEST" perl - "$REPO/assets/media-provenance.js" <<'PERL'
use strict; use warnings; my $prov=shift; my $s=$ENV{SLUG};
opendir my $dh,$ENV{DEST} or die $!; my @files=sort grep {/\.jpe?g$/i} readdir $dh; closedir $dh;
open my $f,'<',$prov or die $!; local $/; my $h=<$f>; close $f;
$h =~ s/"\Q$s\E\/[^"]*":[01],//g;
my $ins=join('',map {"\"$s/$_\":1,"} @files);
$h =~ s/(window\.WB_VETTED\s*=\s*\{)/$1$ins/ or die "no WB_VETTED anchor";
open my $o,'>',$prov or die $!; print $o $h; close $o;
print "  provenance: ".scalar(@files)." keys\n";
PERL

( cd "$REPO" && perl _build/build_gallery.pl 2>&1 | grep -E "$SLUG" )
( cd "$REPO" && perl _build/stamp_assets.pl >/dev/null 2>&1 && echo "  cache-stamped" )
echo "DONE."
