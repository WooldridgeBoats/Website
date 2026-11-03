#!/usr/bin/perl
# build_shop_live.pl — the monthly "In The Shop" update (Tyler's /shop-ready, built 2026-11-03).
# Replaces Stephen's retired Windows sync (sync_shop_live.ps1). Reads Tyler's master folder, crops
# + compresses each photo, and rewrites the SHOP-LIVE blocks on the homepage and /in-the-shop/.
#
#   perl _build/build_shop_live.pl [--dry-run] ["/path/to/IN THE SHOP-WEB"]
#
# Source: OneDrive …/MASTER-WEBSITE PHOTOS/IN THE SHOP-WEB/ — files loose or in one folder per boat.
# File names:  HULL-LEN-[CFG-]MODEL-<anything>-NNN.jpg
#   e.g. 5398-18-CC-AK LT-MONTEITH JOEL-001.JPG   5333-29-LANDING CRAFT-GOHR ED-004.jpg
#   <anything> is usually the customer and is NEVER used: not in captions, file names or alt text
#   (Tyler 2026-11-03: captions = boat model, configuration and hull # only).
#
# Settings: _build/shop-live-settings.json
#   "hold":     ["5400-001", ...]   photos left out (HULL-NNN) until Tyler OKs them (vetting flags)
#   "crop":     {"5389-001": {"w":0.68, "cx":0.51, "cy":0.55}}   w = crop width as a share of the photo
#               (1 = full width), cx/cy = crop centre (0-1). Default: full width, cx 0.5, cy 0.52.
#               Crops are 16:10 with the BOAT centred: set cx/cy per photo after looking at it.
# Homepage strip: every build's -001 photo (the lowest number if 001 is held), newest hull first.
#   "first": ["5333"]   builds that lead the homepage strip, in this order (Tyler picks the lead shot)
#
# Writes assets/photos/shop-<hull>/<hull>-shop-N.jpg (2000x1250, 300-600 KB, max 700, no EXIF/GPS)
# + thumbs/ (480x300); shop-* folders no longer in the master are removed. Rows: newest hull first,
# titled "Hull #5398 - 18' Alaskan LT Center Console". Then stamp_assets.pl.
# VETTING IS NOT AUTOMATIC: look at every photo against the NO-SHOW list (memory in-the-shop-photos)
# and put doubtful ones in "hold" before running. Originals are never touched.
use strict; use warnings;
use File::Basename qw(dirname basename);
use File::Path qw(make_path remove_tree);
use File::Copy qw(copy);
use File::Find;
use Cwd qw(abs_path);
use JSON::PP;

my $REPO = dirname(dirname(abs_path(__FILE__)));
my $SRC  = "/Users/tylerlee/Library/CloudStorage/OneDrive-WooldridgeBoatsInc/Wooldridge Boats Inc_ - SQUIRREL HOLE/70 MARKETING AND BRAND/WEBSITE/MASTER-WEBSITE PHOTOS/IN THE SHOP-WEB";
my $SET  = "$REPO/_build/shop-live-settings.json";
my $DEST = "$REPO/assets/photos";
my $DRY  = 0;
for (@ARGV) { if ($_ eq '--dry-run') { $DRY = 1 } else { $SRC = $_ } }
$SRC =~ s{/+$}{};
-d $SRC or die "no source folder: $SRC\n";

my $MAXKB = 600; my $HARDKB = 700;     # Tyler: 300-600 KB, never over 700
my ($W, $H, $TW, $TH) = (2000, 1250, 480, 300);

# model codes in Tyler's file names, longest first so "AK LT" wins over "AK"
my %MODEL = (
  'LANDING CRAFT' => 'Landing Craft', 'AK XL IB' => 'Alaskan XL Inboard', 'AK XLT' => 'Alaskan XLT',
  'AK XL' => 'Alaskan XL', 'AK LT' => 'Alaskan LT', 'AK' => 'Alaskan', 'XLT' => 'Alaskan XLT',
  'SSD IB' => 'Super Sport Drifter Inboard', 'SSD' => 'Super Sport Drifter', 'SSO' => 'Super Sport Offshore',
  'SCOUT WIDEBODY' => 'Scout Widebody', 'SCOUT WB' => 'Scout Widebody', 'SCOUT' => 'Scout',
  'SKAGIT-X' => 'Skagit-X', 'SKAGIT IB' => 'Skagit Inboard', 'SKAGIT' => 'Skagit',
  'SPORT OFFSHORE' => 'Sport Offshore', 'SPORT IB' => 'Sport Inboard', 'SPORTSTER' => 'Sportster',
  'SPORT' => 'Sport', 'ROGUE' => 'Rogue', 'CANYON' => 'Canyon', 'DEEPWATER' => 'Deepwater',
  'BSR SW' => 'BSR SW', 'RIVER RAT' => 'River Rat',
);
my %CFG = (CC => 'Center Console', WS => 'Windshield', TILLER => 'Tiller', CABIN => 'Cabin',
           PILOTHOUSE => 'Pilothouse', 'AFT WS' => 'Aft Windshield');

my $set = -f $SET ? decode_json(do { local $/; open my $f, '<', $SET or die; <$f> }) : {};
my %hold = map { $_ => 1 } @{ $set->{hold} || [] };
my %crop = %{ $set->{crop} || {} };

# ---- scan + parse -------------------------------------------------------------
my (@err, @warn, %B, %held);
my @files;
find({ no_chdir => 1, wanted => sub { push @files, $_ if -f $_ && /\.jpe?g$/i && basename($_) !~ /^\./ } }, $SRC);
for my $path (sort @files) {
  my $f = basename($path);
  my ($hull, $len, $rest, $nnn) = $f =~ /^([03-9]\d{3})-(\d{2})-(.+)-(\d{3})\.jpe?g$/i
    or do { push @err, "$f: name it HULL-LEN-[CFG-]MODEL-NAME-001.jpg"; next };
  $rest = uc $rest;
  my $cfg = '';
  for my $c (sort { length $b <=> length $a } keys %CFG) { if ($rest =~ s/^\Q$c\E-//) { $cfg = $CFG{$c}; last } }
  my ($code) = grep { $rest eq $_ || index($rest, "$_-") == 0 } sort { length $b <=> length $a } keys %MODEL;
  $code or do { push @err, "$f: don't know the model in '$rest' — add it to %MODEL"; next };
  my $b = $B{$hull} ||= { hull => $hull, len => $len, cfg => $cfg, model => $MODEL{$code}, photos => [] };
  push @err, "$f: hull $hull is a $b->{len}' $b->{model} in another file name" if $b->{len} ne $len || $b->{model} ne $MODEL{$code};
  push @warn, "$f: config differs from the other $hull files" if ($b->{cfg} // '') ne $cfg;
  my $key = "$hull-$nnn";
  push @err, "$f: two photos numbered $nnn for hull $hull" if grep { $_->{key} eq $key } @{ $b->{photos} };
  if ($hold{$key}) { $held{$key} = 1; push @warn, "$f: ON HOLD (shop-live-settings.json) — left out"; next }
  push @{ $b->{photos} }, { key => $key, nnn => $nnn, src => $path, file => $f };
}
for my $h (sort keys %B) {
  my @n = sort { $a <=> $b } map { $_->{nnn} + 0 } @{ $B{$h}{photos} };
  delete $B{$h}, push(@warn, "hull $h: every photo is on hold — no row"), next unless @n;
}
push @warn, "settings hold $_: no such photo in the master" for grep { !$held{$_} } sort keys %hold;
my @hulls = sort { $b <=> $a } keys %B;     # newest build first

sub title { my $b = shift; "$b->{len}' $b->{model}" . ($b->{cfg} ? " $b->{cfg}" : '') }
print "In The Shop from: $SRC\n";
for my $h (@hulls) {
  my $b = $B{$h};
  printf "  Hull #%s - %-40s %d photo%s\n", $h, title($b), scalar @{ $b->{photos} }, (@{ $b->{photos} } == 1 ? '' : 's');
}
print "WARN  $_\n" for @warn;
if (@err) { print "ERROR $_\n" for @err; print "Nothing written — fix the names above and re-run.\n"; exit 1 }
@hulls or die "no photos to publish\n";
if ($DRY) { print "[dry run] nothing written.\n"; exit 0 }

# ---- images -------------------------------------------------------------------
sub quiet { my $rc = system(join(' ', map { my $a = $_; $a =~ s/'/'\\''/g; "'$a'" } @_) . ' >/dev/null 2>&1'); $rc == 0 or die "failed: @_\n" }
sub dims { my $o = `sips -g pixelWidth -g pixelHeight '$_[0]' 2>/dev/null`; my ($w) = $o =~ /pixelWidth: (\d+)/; my ($h) = $o =~ /pixelHeight: (\d+)/; ($w, $h) }
sub kb { int((-s $_[0]) / 1024) }
my $TMP = "/tmp/shoplive.$$"; make_path($TMP);
sub squeeze {   # mozjpeg to <= $MAXKB; a source already right-sized and small enough goes in as-is
  my ($in, $out) = @_;
  for (my $q = 85; $q >= 60; $q -= 5) {
    system("djpeg '$in' 2>/dev/null | cjpeg -quality $q -optimize -progressive > '$out' 2>/dev/null");
    return $q if -s $out && kb($out) <= $MAXKB;
  }
  die "$out: still " . kb($out) . " KB at quality 60\n" if kb($out) > $HARDKB;
  return 60;
}
opendir my $dd, $DEST or die; my @old = grep { /^shop-\d{4}$/ } readdir $dd; closedir $dd;
for my $o (@old) { (my $h = $o) =~ s/^shop-//; next if $B{$h}; remove_tree("$DEST/$o"); print "  removed assets/photos/$o (no longer in the master)\n" }
for my $h (@hulls) {
  my $bt = $B{$h}; my $dir = "$DEST/shop-$h";   # not "$b": that would clobber sort's $b below
  remove_tree($dir); make_path("$dir/thumbs");
  my $n = 0;
  for my $p (sort { $a->{nnn} <=> $b->{nnn} } @{ $bt->{photos} }) {
    $n++;
    my $name = "$h-shop-$n.jpg"; my $out = "$dir/$name";
    my ($sw, $sh) = dims($p->{src});
    my $c = $crop{ $p->{key} } || {};
    my ($w, $cx, $cy) = ($c->{w} // 1, $c->{cx} // 0.5, $c->{cy} // 0.52);
    my $cw = $sw * $w; my $ch = $cw / 1.6;
    if ($ch > $sh) { $ch = $sh; $cw = $sh * 1.6 }
    $cw = int $cw; $ch = int $ch;
    my $x0 = int($cx * $sw - $cw / 2); $x0 = 0 if $x0 < 0; $x0 = $sw - $cw if $x0 > $sw - $cw;
    my $y0 = int($cy * $sh - $ch / 2); $y0 = 0 if $y0 < 0; $y0 = $sh - $ch if $y0 > $sh - $ch;
    my $mid = "$TMP/$h-$n.jpg";
    if ($sw == $W && $sh == $H && !%$c && kb($p->{src}) <= $MAXKB) {
      copy($p->{src}, $out) or die $!;                      # already the website size: no re-compress
    } else {
      quiet('sips', '-c', $ch, $cw, '--cropOffset', $y0, $x0, $p->{src}, '--out', $mid);
      quiet('sips', '-z', $H, $W, $mid, '--out', $mid);
      squeeze($mid, $out);
    }
    quiet('sips', '-Z', $TW, $out, '--out', "$dir/thumbs/$name");
    quiet('exiftool', '-all=', '-overwrite_original', $out, "$dir/thumbs/$name");   # no EXIF / GPS on the site
    $p->{name} = $name;
    printf "  %-24s <- %-3s %4d KB%s\n", "shop-$h/$name", $p->{nnn}, kb($out), (%$c ? ' (custom crop)' : '');
  }
}
remove_tree($TMP);

# ---- page blocks --------------------------------------------------------------
sub row {
  my ($b, $pre, $ind) = @_;
  my $t = title($b); my $np = @{ $b->{photos} };
  my $cfgattr = $b->{cfg} ? qq{ data-cfg="$b->{cfg}"} : '';
  my @a = map {
    my $i = $_ + 1; my $nm = $b->{photos}[$_]{name};
    qq{$ind  <a href="${pre}assets/photos/shop-$b->{hull}/$nm" data-m="$b->{model}" data-len="$b->{len}"$cfgattr data-hull="$b->{hull}" data-shot="In the shop">}
    . qq{<img src="${pre}assets/photos/shop-$b->{hull}/thumbs/$nm" alt="Hull #$b->{hull} $t - photo $i" loading="lazy"></a>}
  } 0 .. $np - 1;
  return join "\n",
    qq{$ind<div class="prow" data-shop-live="1">},
    qq{$ind  <div class="prowhead"><span class="prowtitle"><b>Hull #$b->{hull} - $t</b></span>},
    qq{$ind    <span class="prowcount">$np photo} . ($np == 1 ? '' : 's') . qq{</span></div>},
    qq{$ind  <div class="pcar"><button class="pcarbtn pcarprev" type="button" aria-label="Scroll back">&#8592;</button>},
    qq{$ind    <div class="pcartrack">}, @a,
    qq{$ind    </div>},
    qq{$ind    <button class="pcarbtn pcarnext" type="button" aria-label="Scroll forward">&#8594;</button></div>},
    qq{$ind</div>};
}
my $nb = @hulls;
# homepage strip (Tyler, 2026-11-03): ONE photo per build on the floor, its -001 shot (the lowest
# number if 001 is on hold). Order: the "first" hulls from the settings, then newest hull first.
# Each photo carries its own boat for the caption.
my @first = grep { $B{$_} } map { "$_" } @{ $set->{first} || [] };
print "WARN  settings first $_: no such build on the floor — skipped\n" for grep { !$B{$_} } map { "$_" } @{ $set->{first} || [] };
my %isfirst = map { $_ => 1 } @first;
my @strip = (@first, grep { !$isfirst{$_} } @hulls);
sub homerow {
  my $ind = '        ';
  my @a = map {
    my $bt = $B{$_}; my ($p) = sort { $a->{nnn} <=> $b->{nnn} } @{ $bt->{photos} };   # "$bt", not "$b" (sort's $b)
    my $cfgattr = $bt->{cfg} ? qq{ data-cfg="$bt->{cfg}"} : '';
    qq{$ind  <a href="assets/photos/shop-$bt->{hull}/$p->{name}" data-m="$bt->{model}" data-len="$bt->{len}"$cfgattr data-hull="$bt->{hull}" data-shot="In the shop">}
    . qq{<img src="assets/photos/shop-$bt->{hull}/thumbs/$p->{name}" alt="Hull #$bt->{hull} } . title($bt) . qq{" loading="lazy"></a>}
  } @strip;
  return join "\n",
    qq{$ind<div class="prow" data-shop-live="1">},
    qq{$ind  <div class="prowhead"><span class="prowtitle"><b>On the floor right now</b></span>},
    qq{$ind    <span class="prowcount">$nb build} . ($nb == 1 ? '' : 's') . qq{</span></div>},
    qq{$ind  <div class="pcar"><button class="pcarbtn pcarprev" type="button" aria-label="Scroll back">&#8592;</button>},
    qq{$ind    <div class="pcartrack">}, @a,
    qq{$ind    </div>},
    qq{$ind    <button class="pcarbtn pcarnext" type="button" aria-label="Scroll forward">&#8594;</button></div>},
    qq{$ind</div>};
}
my $homeBlock = join "\n", '',
  '    <div class="sechead tight">',
  '      <div class="eyebrow">In The Shop Right Now</div>',
  '      <h2>A look at the floor in Seattle</h2>',
  '      <p class="lede">Every build on the shop floor right now, one photo each. Scroll the row, or tap any photo to see it full size.</p>',
  '    </div>',
  homerow(),
  qq{    <p class="askline" style="margin-top:22px;"><a href="in-the-shop/">See all $nb boat} . ($nb == 1 ? '' : 's') . qq{ on the floor right now &#8594;</a></p>}, '    ';
my $pageBlock = join "\n", '',
  '  <div class="sechead tight">',
  qq{    <div class="eyebrow">$nb build} . ($nb == 1 ? '' : 's') . ' on the floor</div>',
  '    <h2 style="font-size:clamp(20px,2.6vw,28px);">Everything we&rsquo;re building right now</h2>',
  '  </div>',
  (map { row($B{$_}, '../', '      ') } @hulls), '  ';
my $MARK = '<!-- SHOP-LIVE:BEGIN (generated by _build/build_shop_live.pl - do not hand-edit; re-run instead) -->';
for ([ "$REPO/index.html", $homeBlock ], [ "$REPO/in-the-shop/index.html", $pageBlock ]) {
  my ($p, $blk) = @$_;
  open my $fh, '<:raw', $p or die "$p: $!"; my $h = do { local $/; <$fh> }; close $fh;
  $h =~ s{<!-- SHOP-LIVE:BEGIN[^\n]*-->.*?(<!-- SHOP-LIVE:END -->)}{$MARK$blk$1}s or die "no SHOP-LIVE markers in $p\n";
  open $fh, '>:raw', $p or die $!; print $fh $h; close $fh;
}
print "  pages: homepage strip = $nb photo(s), one per build (its -001); /in-the-shop/ = $nb build row(s)\n";
system('perl', "$REPO/_build/stamp_assets.pl") == 0 or die "stamp_assets.pl failed\n";
