#!/usr/bin/perl
# build_agency_galleries.pl — builds the per-boat photo galleries on the Agency &
# Work Boats page (agency-work-boats/index.html) from Tyler's master folder,
# the way apply_model_photos.sh does for a model page. Built 2026-09-30.
#
#   perl _build/build_agency_galleries.pl [--dry-run] ["/path/to/AGENCY-WORK-WEB"]
#
# Default source: OneDrive …/MASTER-WEBSITE PHOTOS/AGENCY-WORK-WEB. Every folder is
# scanned: "<LEN>-<CFG>-<MODEL>" holds desktop photos (2000x1250), "…-MOBILE" the
# phone portraits (1080x1350). A model with several builds can instead hold one
# SUB-FOLDER per build, e.g. 20-CC-SKAGIT/20-CC-SKAGIT-FIRE/ (+ 20-CC-SKAGIT-MOBILE/
# 20-CC-SKAGIT-FIRE-MOBILE/); each sub-folder is its own gallery (see scan_folder).
# Loose files at the top level are the hero-slider photos and are NOT touched here.
#
# File names:  NN-HULL-LEN-CFG-MODEL-PURPOSE[-MOBILE].jpg
#   e.g.  04-4572-18-CC-SKAGIT-FIRE.jpg    03-5320-20-CC-AK XL-IB-FIRST RESPONDER.jpg
#   HULL is optional; a HERO token is ignored. The COVER is a file named the way
#   the model folders do it: GALLERY-THUMB-HULL-LEN-CFG-MODEL-PURPOSE.jpg (in a
#   one-boat folder plain GALLERY-THUMB.jpg is enough); no cover = lowest NN.
#   PURPOSE is the gallery title (blue caps above the card), shown as written
#   (title-cased except acronyms like USCG) — except FIRE, which reads "Fire &
#   Rescue" (write FIRE ONLY for just "Fire"); see %PURPOSE.
#
# ONE GALLERY (one big cover card) PER BOAT = LEN + CFG + MODEL + PURPOSE, so a
# folder holding two missions (e.g. 20′ Skagit WORK and FIRE) becomes two cards.
# Mixed hulls inside one gallery are fine — each photo's caption carries its own.
#
# Writes: assets/photos/agency-work/<key>/{NN files, thumbs/, cover.jpg,
# mobile/, mobile/thumbs/} (each <key> dir is wiped + rebuilt from the master),
# the block between <!-- AGENCY-GALLERIES:BEGIN/END --> in the page, the
# WB_VETTED keys, then runs stamp_assets.pl. Nothing is written if any file
# fails the checks. Re-runs are safe; hand edits outside the markers survive.
use strict; use warnings;
use File::Basename qw(dirname);
use File::Path qw(make_path remove_tree);
use File::Copy qw(copy);
use Cwd qw(abs_path);
use JSON::PP;
use Digest::MD5;

# content-hash tag for an image URL — Cloudflare caches images ~4h, so a re-exported
# photo that keeps its file name needs a new URL to show up (same idea as stamp_assets.pl).
# $VERLEN is 10 since 2026-10-05: a page viewed mid-deploy had its new photos 404,
# and Cloudflare + browsers cached those 404s for 4h under the 8-char URLs; changing
# the length moved every gallery URL off the poisoned ones. Bump it again (11, 12...)
# if cached 404s ever need flushing (.cpanel.yml now copies assets first to prevent it).
my $VERLEN = 10;
sub file_md5 { open my $fh, "<:raw", $_[0] or die "$_[0]: $!"; Digest::MD5->new->addfile($fh)->hexdigest }
sub ver { open my $fh, "<:raw", $_[0] or die "$_[0]: $!"; "?v=" . substr(Digest::MD5->new->addfile($fh)->hexdigest, 0, $VERLEN) }

my $REPO = dirname(dirname(abs_path(__FILE__)));
my $SRC  = "/Users/tylerlee/Library/CloudStorage/OneDrive-WooldridgeBoatsInc/Wooldridge Boats Inc_ - SQUIRREL HOLE/70 MARKETING AND BRAND/WEBSITE/MASTER-WEBSITE PHOTOS/AGENCY-WORK-WEB";
my $DRY  = 0;
for (@ARGV) { if ($_ eq '--dry-run') { $DRY = 1 } else { $SRC = $_ } }
$SRC =~ s{/+$}{};
-d $SRC or die "no source folder: $SRC\n";

my $PAGE = "$REPO/agency-work-boats/index.html";
my $DEST = "$REPO/assets/photos/agency-work";
my $WEB  = "../assets/photos/agency-work";          # as the page references it
my $PROV = "$REPO/assets/media-provenance.js";

# ---- filename codes -> display names (add a line for a new code) ------------
my %MODEL = (
  'SKAGIT' => 'Skagit',        'SKAGIT-IB' => 'Skagit Inboard', 'SKAGIT-X' => 'Skagit-X',
  'AK' => 'Alaskan',           'AK LT' => 'Alaskan LT',         'AK XL' => 'Alaskan XL',
  'AK XL-IB' => 'Alaskan XL Inboard', 'AK XLT' => 'Alaskan XLT',
  'BSR SW' => 'BSR SW',        # USCG-specific model — Tyler: keep it literally "BSR SW"
  'SCOUT' => 'Scout',          'SCOUT WB' => 'Scout Widebody',  'ROGUE' => 'Rogue',
  'SPORT' => 'Sport',          'SPORT-IB' => 'Sport Inboard',   'SPORTSTER' => 'Sportster',
  'SSD' => 'Super Sport Drifter', 'SSD IB' => 'Super Sport Drifter Inboard',
  'SO' => 'Sport Offshore',    'SSO' => 'Super Sport Offshore', 'LC' => 'Landing Craft',
);
my %CFG = ('CC' => 'Center Console', 'WS' => 'Windshield', 'TILLER' => 'Tiller',
           'CABIN' => 'Cabin', 'AFT-WS' => 'Aft Windshield', 'PYBUS' => 'Pybus',
           'OPEN' => 'Open', 'PH' => 'Pilothouse');
my %ACRONYM = map { $_ => 1 } qw(USCG USN USACE NOAA DNR WDFW ODFW USFWS FWS CBP DHS SAR EMS EMT FD PD LE);
my @MCODES = sort { length($b) <=> length($a) } keys %MODEL;   # longest match first

sub pretty {   # "FIRST RESPONDER" -> "First Responder", "USCG" stays "USCG"
  join ' ', map { $ACRONYM{uc $_} ? uc $_ : ucfirst lc $_ } split / +/, $_[0];
}
# Gallery wording for a purpose token, where it differs from the token itself.
# Tyler (2026-10-05): a FIRE boat reads "Fire & Rescue"; write FIRE ONLY in the
# file names when a boat should say just "Fire". Everything else = the token.
my %PURPOSE = ('FIRE' => 'Fire & Rescue', 'FIRE ONLY' => 'Fire',
               'USCG' => 'U.S. Coast Guard',     # Tyler 2026-10-05: BSR SW gallery title
               'USFWS' => 'U.S. Fish & Wildlife Service');   # 20' Skagit USFWS (spelled out like USCG)
sub purpose_name { my $u = uc $_[0]; $u =~ s/ +/ /g; $PURPOSE{$u} // pretty($_[0]) }
sub slug { (my $s = lc join '-', @_) =~ s/[^a-z0-9]+/-/g; $s =~ s/^-|-$//g; $s }
sub esc  { (my $s = $_[0]) =~ s/&/&amp;/g; $s =~ s/</&lt;/g; $s =~ s/>/&gt;/g; $s =~ s/"/&quot;/g; $s }
sub dims { my $o = `sips -g pixelWidth -g pixelHeight "$_[0]" 2>/dev/null`;
           my ($w) = $o =~ /pixelWidth: (\d+)/; my ($h) = $o =~ /pixelHeight: (\d+)/;
           ($w // 0) . 'x' . ($h // 0) }

# ---- parse one file name ------------------------------------------------------
sub parse {
  my ($file, $mobile) = @_;
  (my $stem = $file) =~ s/\.jpe?g$//i;
  $stem =~ s/-MOBILE$//i if $mobile;
  my $cover = ($stem =~ s/-GALLERY-?THUMB(?=-|$)//i) ? 1 : 0;
  $stem =~ s/-HERO(?=-|$)//i;
  my @t = split /-/, $stem;
  my $nn = shift @t;
  return (undef, "order number '" . ($nn // '') . "' not numeric (name must start NN-)") unless defined $nn && $nn =~ /^\d{1,3}$/;
  my $hull = (@t && $t[0] =~ /^[03-9]\d{3}$/) ? shift @t : '';
  my $len = shift(@t) // '';
  return (undef, "length '$len' isn't a 2-digit length") unless $len =~ /^\d{2}$/;
  my $cfgc = uc(shift(@t) // '');
  if ($cfgc eq 'AFT' && @t && uc($t[0]) eq 'WS') { shift @t; $cfgc = 'AFT-WS' }
  return (undef, "unknown config '$cfgc' — add it to %CFG in this script") unless $CFG{$cfgc};
  my $rest = join '-', @t;
  my ($mcode) = grep { $rest =~ /^\Q$_\E(?:-|$)/i } @MCODES;
  return (undef, "unknown model in '$rest' — add its code to %MODEL in this script") unless $mcode;
  (my $purp = substr($rest, length $mcode)) =~ s/^-//;
  return { nn => $nn + 0, hull => $hull, len => $len, cfgc => $cfgc, cfg => $CFG{$cfgc},
           mcode => $mcode, model => $MODEL{$mcode}, purp => uc $purp,
           purpose => ($purp eq '' ? '' : purpose_name($purp)), cover => $cover };
}

# ---- scan + check (no writes) -------------------------------------------------
my (%G, @err, @warn);
sub list_dir { my ($dir, $want_dirs) = @_; opendir my $h, $dir or die "$dir: $!";
  my @e = sort grep { !/^\./ && ($want_dirs ? -d "$dir/$_" : (/\.jpe?g$/i && -f "$dir/$_")) } readdir $h; closedir $h; @e }
# Two folder layouts, both supported:
#  - FLAT (the first boats): <LEN>-<CFG>-<MODEL>[-MOBILE]/NN-…jpg. The gallery is
#    worked out from each FILE NAME (len+cfg+model+purpose), so two missions in
#    one folder still make two cards.
#  - SUB-FOLDER (Tyler, 2026-10-05, for models with many builds, e.g. 20' Skagit):
#    <LEN>-<CFG>-<MODEL>/<LEN>-<CFG>-<MODEL>-<PURPOSE>/NN-…jpg, phone set in
#    <LEN>-<CFG>-<MODEL>-MOBILE/<LEN>-<CFG>-<MODEL>-<PURPOSE>-MOBILE/. EACH
#    SUB-FOLDER IS ITS OWN GALLERY (keyed by the sub-folder name), so two builds
#    with the same mission (two Fire boats) can still be separate cards.
my @dirs = list_dir($SRC, 1);
for my $d (@dirs) {
  my $mobile = ($d =~ /-MOBILE$/i) ? 1 : 0;
  (my $base = $d) =~ s/-MOBILE$//i;
  scan_folder($d, $mobile, $base, undef);
  for my $s (list_dir("$SRC/$d", 1)) {
    (my $sbase = $s) =~ s/-MOBILE$//i;
    push @warn, "$d/$s: sub-folder name doesn't start with $base" if index(lc $sbase, lc $base) != 0;
    scan_folder("$d/$s", ($mobile || $s =~ /-MOBILE$/i) ? 1 : 0, $base, slug($sbase));
  }
}
sub scan_folder {
  my ($d, $mobile, $base, $fkey) = @_;   # $fkey = the gallery key when the folder IS the gallery
  my @files = list_dir("$SRC/$d", 0);
  my @loose;   # GALLERY-THUMB files whose name doesn't say which boat (fine in a one-boat folder)
  for my $f (@files) {
    my $path = "$SRC/$d/$f";
    if ($f =~ /^GALLERY-?THUMB-?(.*)$/i) {   # Tyler's model-folder habit: GALLERY-THUMB-<...>.jpg = the cover
      my $rest = $1;
      if ($mobile) { push @warn, "$d/$f: covers come from the desktop folder — ignored here"; next }
      if (!-s $path) { push @err, "$d/$f: 0 bytes (cloud-only placeholder? open the folder so OneDrive downloads it)"; next }
      my $dim = dims($path);
      push @warn, "$d/$f: $dim (expected 2000x1250)" if $dim ne '2000x1250';
      my ($p) = parse("00-$rest", 0);
      if ($fkey)  { push @loose, [$f, $path, $fkey, ($p ? $p->{hull} : q{})] }   # in a gallery sub-folder: it's that gallery's cover
      elsif ($p)  { push @loose, [$f, $path, slug($p->{len}, $p->{cfgc}, $p->{mcode}, $p->{purp}), $p->{hull}] }
      else        { push @loose, [$f, $path, undef] }
      next;
    }
    my ($p, $why) = parse($f, $mobile);
    if (!$p) { push @err, "$d/$f: $why"; next }
    if (!-s $path) { push @err, "$d/$f: 0 bytes (cloud-only placeholder? open the folder so OneDrive downloads it)"; next }
    my $want = $mobile ? '1080x1350' : '2000x1250';
    my $dim = dims($path);
    push @warn, "$d/$f: $dim (expected $want)" if $dim ne $want;
    push @warn, "$d/$f: file says $p->{len}-$p->{cfgc}-$p->{mcode}, folder is $base"
      if lc("$p->{len}-$p->{cfgc}-$p->{mcode}") ne lc $base;
    my $key = $fkey || slug($p->{len}, $p->{cfgc}, $p->{mcode}, $p->{purp});
    my $g = $G{$key} ||= { key => $key, (map { ($_, $p->{$_}) } qw(len cfgc cfg mcode model purpose)), d => [], mob => [] };
    push @warn, "$d/$f: mission $p->{purpose} differs from the rest of $key ($g->{purpose}) — the card title uses $g->{purpose}"
      if $fkey && $p->{purpose} ne $g->{purpose};
    $p->{src} = $path; $p->{rel} = "$d/$f";
    if (!$mobile && $p->{cover}) {
      push @err, "$d/$f: a second GALLERY-THUMB for $key" if $g->{cover};
      $g->{cover} = $path; $g->{cover_hull} = $p->{hull}; next;
    }
    my $list = $mobile ? $g->{mob} : $g->{d};
    if (my ($dup) = grep { $_->{nn} == $p->{nn} } @$list) {
      # the same photo in two folders (e.g. a phone folder moved while the old copy
      # lingers) is harmless: keep one, say so. A DIFFERENT photo on the same # stops the build.
      if (file_md5($dup->{src}) eq file_md5($path)) { push @warn, "$d/$f: identical copy of $dup->{rel} — ignored (one of the two folders can be deleted)"; next }
      push @err, "$d/$f: duplicate order #$p->{nn} in $key" . ($mobile ? ' (mobile)' : '') . " (also $dup->{rel})";
    }
    push @$list, $p;
  }
  # attach this folder's GALLERY-THUMB cover(s) to their boat
  my @here = grep { my $g = $G{$_}; lc("$g->{len}-$g->{cfgc}-$g->{mcode}") eq lc $base } keys %G;
  for my $c (@loose) {
    my ($f, $path, $key, $chull) = @$c;
    $key = $here[0] if !$key && @here == 1;
    if (!$key || !$G{$key}) {
      push @err, "$d/$f: can't tell which boat this cover is for — name it GALLERY-THUMB-HULL-LEN-CFG-MODEL-PURPOSE.jpg"; next;
    }
    if ($G{$key}{cover}) { push @err, "$d/$f: a second cover for $key"; next }
    $G{$key}{cover} = $path; $G{$key}{cover_hull} = $chull;
  }
}
for my $key (sort keys %G) {
  next if @{ $G{$key}{d} };
  push @warn, "$key: phone photos but no desktop photos yet — skipped until the desktop set is in";
  delete $G{$key};
}

my @keys = sort { $G{$a}{len} <=> $G{$b}{len} || $G{$a}{model} cmp $G{$b}{model} || $G{$a}{purpose} cmp $G{$b}{purpose} || $a cmp $b } keys %G;   # last: folder key, so twin missions keep a steady order
print "Agency galleries from: $SRC\n";
for my $k (@keys) {
  my $g = $G{$k};
  printf "  %-28s %2d desktop, %2d phone  — %s′ %s %s%s\n", $k, scalar @{ $g->{d} }, scalar @{ $g->{mob} },
    $g->{len}, $g->{model}, $g->{cfg}, ($g->{purpose} ? " — $g->{purpose}" : '');
}
print "  (no gallery folders with photos yet)\n" unless @keys;
print "WARN  $_\n" for @warn;
if (@err) { print "ERROR $_\n" for @err; print "Nothing written — fix the names above and re-run.\n"; exit 1 }
if ($DRY) { print "[dry run] nothing written.\n"; exit 0 }

# ---- build photo folders ------------------------------------------------------
sub run_sips {   # sips echoes every path on stdout — keep the report readable
  open my $save, ">&", \*STDOUT or die $!; open STDOUT, ">", "/dev/null" or die $!;
  my $rc = system("sips", "-s", "format", "jpeg", "-Z", $_[0], $_[1], "--out", $_[2]);
  open STDOUT, ">&", $save or die $!;
  $rc == 0 or die "sips failed on $_[1]\n";
}
my (%DATA, @cards, @prov);
for my $k (@keys) {
  my $g = $G{$k};
  my $dir = "$DEST/$k";
  remove_tree($dir);
  make_path("$dir/thumbs");
  make_path("$dir/mobile/thumbs") if @{ $g->{mob} };
  my $name = sub { my $p = shift; ($p->{hull} ? "$p->{hull}-" : '') . "$p->{len}-" . lc($p->{cfgc}) . sprintf('-%02d.jpg', $p->{nn}) };
  my (@d, @m, %hulls);
  for my $p (sort { $a->{nn} <=> $b->{nn} } @{ $g->{d} }) {
    my $f = $name->($p);
    copy($p->{src}, "$dir/$f") or die "copy $p->{src}: $!";
    run_sips(800, $p->{src}, "$dir/thumbs/$f");
    push @d, { f => $f . ver("$dir/$f"), ($p->{hull} ? (hull => $p->{hull}) : ()) };
    $hulls{$p->{hull}}++ if $p->{hull};
    push @prov, "$k/$f";
  }
  for my $p (sort { $a->{nn} <=> $b->{nn} } @{ $g->{mob} }) {
    my $f = $name->($p);
    copy($p->{src}, "$dir/mobile/$f") or die "copy $p->{src}: $!";
    run_sips(400, $p->{src}, "$dir/mobile/thumbs/$f");
    push @m, { f => $f . ver("$dir/mobile/$f"), ($p->{hull} ? (hull => $p->{hull}) : ()) };
  }
  my $coverSrc = $g->{cover} || (sort { $a->{nn} <=> $b->{nn} } @{ $g->{d} })[0]{src};
  run_sips(1400, $coverSrc, "$dir/cover.jpg");      # big 2-across card: ~1200px wide on retina
  my $cv = ver("$dir/cover.jpg");
  push @prov, "$k/cover.jpg";

  my @h = sort keys %hulls;
  # the card shows ONE hull: the only one, or for a mixed-hull gallery the COVER photo's hull
  # (Tyler, 2026-10-05: BSR SW = 5335 + 5336, card shows its cover's 5335). The viewer
  # still captions every photo with its own hull.
  my $first = (sort { $a->{nn} <=> $b->{nn} } @{ $g->{d} })[0];
  my $hull = @h == 1 ? $h[0] : (($g->{cover} ? $g->{cover_hull} : $first->{hull}) || q{});
  my $cfgline = $g->{cfg} . ($g->{purpose} ? " \x{b7} $g->{purpose}" : '');
  my $alt = "$g->{len}\x{2032} $g->{model} $g->{cfg}" . ($g->{purpose} ? " \x{2014} $g->{purpose}" : '') . ($hull ? ", Hull $hull" : '');
  $DATA{$k} = { m => $g->{model}, len => $g->{len}, cfg => $cfgline, dir => "$WEB/$k/", alt => $alt, d => \@d, mob => \@m };

  my $nd = @d; my $nm = @m;
  my $badge = ($nm && $nm != $nd)
    ? qq{<span class="mcbadge"><span class="wbd">$nd photos</span><span class="wbm">$nm photos</span></span>}
    : qq{<span class="mcbadge">$nd photo} . ($nd == 1 ? '' : 's') . '</span>';
  # the mission is the blue Rockwell title ABOVE the card ("FIRE & RESCUE" — Tyler,
  # 2026-10-05); on the card: "18′ Skagit", then config + hull. No purpose -> the
  # model name stands in as the title so the cards in a row stay level.
  my @sub = (esc($g->{cfg}));
  push @sub, "Hull #$hull" if $hull;
  (my $altH = esc($alt)) =~ s/\x{2032}/&#8242;/g; $altH =~ s/\x{2014}/&#8212;/g;
  my $title = esc($g->{purpose} || $g->{model});
  push @cards, qq{    <div class="agcell"><h2 class="agtitle">$title</h2>}
    . qq{<a class="mcard" href="$WEB/$k/$d[0]{f}" data-gal="$k"><img src="$WEB/$k/cover.jpg$cv" alt="$altH" loading="lazy">$badge}
    . qq{<span class="mcmeta"><b>$g->{len}&#8242; } . esc($g->{model}) . "</b><span>" . join(' &#183; ', @sub) . "</span></span></a></div>";
  printf "  built %-28s -> %d + %d photos, cover %s\n", $k, $nd, $nm, ($g->{cover} ? "GALLERY-THUMB" : (split /\?/, $d[0]{f})[0]);
}
opendir my $xd, $DEST or die $!;
my %want = map { $_ => 1 } @keys;
# (agency-work/thumbs/ holds the homepage "Explore" tile image — made from slide-01, not a gallery)
for (sort grep { !/^\./ && -d "$DEST/$_" && !$want{$_} && $_ ne "thumbs" } readdir $xd) { print "WARN  stale folder assets/photos/agency-work/$_ (no longer in the master) — delete it if it's retired\n" }
closedir $xd;

# ---- page block ---------------------------------------------------------------
my $json = JSON::PP->new->canonical->ascii->encode(\%DATA);
my $block = !@keys ? '' : join "\n",
  '  <!-- generated by _build/build_agency_galleries.pl — change the master folder and re-run; don\'t hand-edit -->',
  '  <div class="agcards">', @cards, '  </div>',
  "  <script>window.WB_AGENCY=$json;</script>", '';
open my $ph, '<:raw', $PAGE or die "$PAGE: $!"; my $html = do { local $/; <$ph> }; close $ph;
$html =~ s{(<!-- AGENCY-GALLERIES:BEGIN -->\n).*?(\s*<!-- AGENCY-GALLERIES:END -->)}{$1$block$2}s
  or die "no AGENCY-GALLERIES markers in $PAGE\n";
open my $po, '>:raw', $PAGE or die $!; print $po $html; close $po;
print "  page: " . scalar(@keys) . " gallery card(s) written\n";

# ---- provenance (invisible "vetted" tag, same as the model builder) -----------
open my $vf, '<', $PROV or die "$PROV: $!"; my $v = do { local $/; <$vf> }; close $vf;
for my $k (@keys) { $v =~ s/"\Q$k\E\/[^"]*":[01],//g }
my $ins = join '', map { "\"$_\":1," } @prov;
$v =~ s/(window\.WB_VETTED\s*=\s*\{)/$1$ins/ or die "no WB_VETTED anchor\n";
open my $vo, '>', $PROV or die $!; print $vo $v; close $vo;
print "  provenance: " . scalar(@prov) . " keys\n";

system('perl', "$REPO/_build/stamp_assets.pl") == 0 or die "stamp_assets.pl failed\n";
