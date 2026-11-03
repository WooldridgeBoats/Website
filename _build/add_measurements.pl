#!/usr/bin/perl
# Add (or replace) a boat's Measurements sheet on its model page.
#
#   perl _build/add_measurements.pl <slug> "<Display Name>" "/path/to/<HULL>-<LEN>-[CFG-]<MODEL>-MEASUREMENTS.jpg" [--dry-run]
#
#   e.g. perl _build/add_measurements.pl supersportdrifter "Super Sport Drifter" \
#          ".../MASTER-WEBSITE PHOTOS/BOAT MODEL MEASUREMENTS/5175-23-WS-SSD-MEASUREMENTS.jpg"
#
# What it does (Tyler, 2026-11-03):
#  1. copies the sheet byte-for-byte to assets/photos/<slug>/measurements-<hull>-<len>[-<cfg>].jpg
#     (Tyler's graphic: never re-compressed)
#  2. writes a "Measurements" fold (<details class="pfold measfold">) right after the canon
#     <!-- SPECS --> block, inside its own <!-- MEASUREMENTS:slug --> markers. A re-run replaces
#     that block. It sits OUTSIDE the SPECS markers, so /canon-sync never touches it.
#  3. the diagram + "Open full size" button carry data-meas="<title>", so modelpage.js opens
#     them in the measurements lightbox (Close x / Esc / phone Back closes; Zoom to pan).
# Works for main and custom model pages. A page needs a SPECS block; for a custom page without
# specs (Deepwater, River Rat) the fold goes before the "Included On Every Boat" sechead or
# ask Tyler where. Agency page is different: see _build/MEASUREMENTS-HANDOFF.md.
# After a run: perl _build/stamp_assets.pl only if CSS/JS changed (this script changes neither).
use strict; use warnings;
use File::Copy qw(copy);
use File::Basename qw(basename);

my $dry = grep { $_ eq '--dry-run' } @ARGV;
my @a = grep { $_ ne '--dry-run' } @ARGV;
die "usage: $0 <slug> \"<Display Name>\" <sheet.jpg> [--dry-run]\n" unless @a == 3;
my ($slug, $name, $src) = @a;
-f $src or die "sheet not found: $src\n";

my $page = "models/$slug/index.html";
-f $page or die "no page: $page (run from LOCAL-WEBSITE)\n";

# 5175-23-WS-SSD-MEASUREMENTS.jpg  /  5119-21-SCOUT WIDEBODY-MEASUREMENTS.jpg
my $base = basename($src);
my ($hull, $len, $rest) = $base =~ /^([03-9]\d{3})-(\d{2})-(.*)-MEASUREMENTS\.jpe?g$/i
  or die "name must be HULL-LEN-[CFG-]MODEL-MEASUREMENTS.jpg: $base\n";
my %CFG = map { $_ => 1 } qw(CC WS TILLER CABIN AFT-WS);
my ($cfg) = $rest =~ /^([A-Z-]+?)-/;
$cfg = ($cfg && $CFG{uc $cfg}) ? lc $cfg : '';

my $file = "measurements-$hull-$len" . ($cfg ? "-$cfg" : '') . ".jpg";
my $dest = "assets/photos/$slug/$file";
my $rel  = "../../$dest";

open my $fh, '<', $page or die; local $/; my $h = <$fh>; close $fh;

my $blk = <<"B";
  <!-- MEASUREMENTS:$slug  Tyler's measurement sheet (master: MASTER-WEBSITE PHOTOS/BOAT MODEL MEASUREMENTS/).
       Hand-placed OUTSIDE the canon SPECS block so /canon-sync never touches it. Built by _build/add_measurements.pl -->
  <details class="pfold measfold">
    <summary><span class="pfoldeyebrow">Measurements</span><span class="pfoldtitle">${len}&#8242; Layout &amp; Dimensions</span><span class="pfoldchev" aria-hidden="true"></span></summary>
    <div class="pfoldbody">
      <a class="measimg" href="$rel" data-meas="${len}&#8242; $name Measurements" target="_blank" rel="noopener"><img src="$rel" alt="${len}&#8242; $name measurement diagram with interior and layout dimensions, Hull $hull" width="2000" height="1250" loading="lazy"></a>
      <div class="measbar"><p class="bspec-foot">Shown: ${len}&#8242; $name, Hull #$hull. Approximate measurements.</p><a class="measopen" href="$rel" data-meas="${len}&#8242; $name Measurements" target="_blank" rel="noopener">Open full size</a></div>
    </div>
  </details>
  <!-- /MEASUREMENTS -->
B

if ($h =~ /[ \t]*<!-- MEASUREMENTS:\Q$slug\E .*?<!-- \/MEASUREMENTS -->\n/s) {
  $h =~ s/[ \t]*<!-- MEASUREMENTS:\Q$slug\E .*?<!-- \/MEASUREMENTS -->\n/$blk/s;
  print "replaced Measurements fold\n";
} elsif ($h =~ s{(<!-- /SPECS -->\n)}{$1$blk}) {
  print "added Measurements fold after SPECS\n";
} else {
  die "$slug: no <!-- /SPECS --> block. Ask Tyler where the fold goes on this page.\n";
}

print "  sheet: $base -> $dest\n  title: ${len}' Layout & Dimensions   (Hull #$hull" . ($cfg ? ", cfg $cfg" : '') . ")\n";
exit 0 if $dry and print "DRY-RUN, nothing written\n";

copy($src, $dest) or die "copy failed: $!\n";
open $fh, '>', $page or die; print $fh $h; close $fh;
print "done. Check it in the browser (desktop + 390/360/320 phone), then commit.\n";
