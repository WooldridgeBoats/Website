#!/usr/bin/perl
# ─────────────────────────────────────────────────────────────────────────────
# build_history.pl: builds the /our-history/ timeline (2026-10-12).
#
#   perl _build/build_history.pl                 # default photo sources
#   perl _build/build_history.pl --src <dir> ... # override (repeatable, in order)
#   perl _build/build_history.pl --captions      # also list each photo's caption
#
# READS
#   _build/history_timeline.txt        the approved dates + captions + videos
#   _build/history_videos.txt          the Heritage Videos strip (YouTube "Heritage" playlist)
#   photo folders, one per date/era    named by the DATE ("1947", "1920s",
#                                      "1947-RUNNING THE ROGUE"). Four-digit
#                                      numbers here are years, never hull numbers.
#   Source: Tyler's master, OneDrive .../MASTER-WEBSITE PHOTOS/ABOUT | HISTORY/
#   (only, since 2026-10-13). The X Drive HERITAGE PHOTOS archive seeded V1;
#   --src can still point at it, or at several folders tried in order.
#   The hero comes from the master: the file starting "01-HERO".
#
# WRITES
#   assets/history/hero.jpg, assets/history/endcap.jpg   (from 01-HERO... / 01-END CAP...)
#   assets/history/<date>/NN.jpg + thumbs/NN.jpg   (rebuilt from scratch each run)
#   assets/history/archives/NN.jpg + clip/NN.jpg   (From the Archives: brochures & ads)
#   our-history/index.html, between <!-- HIST:timeline --> and <!-- /HIST:timeline -->
#                           and between <!-- HIST:archives --> and <!-- /HIST:archives -->
#
# Then run perl _build/stamp_assets.pl if house.css or history.js changed.
# ─────────────────────────────────────────────────────────────────────────────
use strict;
use warnings;
use utf8;
use File::Basename qw(dirname);
use File::Path qw(make_path remove_tree);
use Digest::MD5 qw(md5_hex);
use Cwd qw(abs_path);

binmode STDOUT, ':encoding(UTF-8)';
my $root = abs_path(dirname(__FILE__) . '/..');
my $MASTER = '/Users/tylerlee/Library/CloudStorage/OneDrive-WooldridgeBoatsInc/Wooldridge Boats Inc_ - SQUIRREL HOLE/70 MARKETING AND BRAND/WEBSITE/MASTER-WEBSITE PHOTOS/ABOUT | HISTORY';
my $ARCHIVE = '/Volumes/X Drive/HERITAGE MEDIA/HERITAGE PHOTOS';

my @src;
my $list_caps = 0;
while (@ARGV) { my $a = shift @ARGV; if ($a eq '--src') { push @src, shift @ARGV } elsif ($a eq '--captions') { $list_caps = 1 } }
@src = ($MASTER) unless @src;   # Tyler's master only (2026-10-13); the X Drive archive was the seed set
@src = grep { -d $_ or (warn "  (skipping missing source: $_)\n", 0) } @src;
sub where { my $p = shift; $p =~ s{^\Q$MASTER\E}{ABOUT | HISTORY}; $p =~ s{^\Q$ARCHIVE\E}{X Drive HERITAGE PHOTOS}; $p }

my $FULL  = 2000;   # long side of the lightbox image
my $THUMB = 720;    # side of the square carousel tile (tiles show at up to ~320px; 720 covers 2x screens)
my $Q     = 82;
# File-size budgets (Tyler, 2026-10-14: fast loads, but NO visible softening). Pixel
# sizes never change for this; a photo only steps down the quality ladder if it is
# still over budget, and never below the last rung.
my @LADDER  = (82, 78, 75);
my $FULL_KB = 800;
my $TILE_KB = 200;

# ── timeline data ──
my @eras;
open my $tf, '<:encoding(UTF-8)', "$root/_build/history_timeline.txt" or die "timeline: $!";
while (my $l = <$tf>) {
  chomp $l; next if $l =~ /^\s*#/;
  if ($l =~ /^==\s*(\S+)/) { push @eras, { key => $1, text => [], videos => [], links => [] }; next; }
  next unless @eras;
  if    ($l =~ /^video:\s*(\S+)\s*\|\s*(.+?)\s*(?:\|\s*after\s+(.+?)\s*)?$/i) { push @{$eras[-1]{videos}}, [ytid($1), $2, $3]; }
  elsif ($l =~ /^link:\s*(\S+)\s*\|\s*(.+?)\s*$/)  { push @{$eras[-1]{links}},  [$1, $2]; }
  elsif ($l =~ /\S/) { push @{$eras[-1]{text}}, $l; }
}
close $tf;
die "no timeline entries\n" unless @eras;

# ── Heritage Videos (the YouTube "Heritage" playlist), _build/history_videos.txt ──
my (@hvids, %thumbq);
if (open my $vf, '<:encoding(UTF-8)', "$root/_build/history_videos.txt") {
  while (my $l = <$vf>) {
    next if $l =~ /^\s*(#|$)/; chomp $l;
    my ($id, $title, $len, $q) = map { s/^\s+|\s+$//gr } split /\|/, $l;
    next unless $id && $title;
    push @hvids, [$id, $title, $len // '']; $thumbq{$id} = lc($q // 'sd');
  }
  close $vf;
}
sub yt_thumb {   # the sharpest thumbnail YouTube has for this upload (listed in history_videos.txt)
  my $id = shift; my $q = $thumbq{$id} // 'sd';
  return "https://i.ytimg.com/vi/$id/" . ($q eq 'maxres' ? 'maxresdefault' : $q eq 'hq' ? 'hqdefault' : 'sddefault') . '.jpg';
}
# Page order is automatic: dates in order, and an era ("1970s") OPENS its
# decade, ahead of 1973, 1975 ... 1979 (Tyler, 2026-10-14; was the end of it).
sub when { my $k = shift; $k =~ /^(\d{4})(s?)$/i or return 1e9; $1 - ($2 ? 0.1 : 0) }
@eras = map { $_->[1] } sort { $a->[0] <=> $b->[0] || $a->[2] <=> $b->[2] } map { [when($eras[$_]{key}), $eras[$_], $_] } 0..$#eras;

sub ytid { my $u = shift; return $1 if $u =~ m{(?:youtu\.be/|v=|embed/|shorts/)([\w-]{11})}; die "bad YouTube URL: $u\n"; }
sub esc  { my $s = shift; $s =~ s/&/&amp;/g; $s =~ s/</&lt;/g; $s =~ s/>/&gt;/g; $s =~ s/"/&quot;/g; $s }
sub plain { my $s = shift; $s =~ s/<[^>]+>//g; $s }
sub dims { my @i = info(shift); @i[0, 1] }
sub info {   # (width, height, Description metadata)
  my $f = shift; my ($w, $h, $d);
  open my $p, '-|:encoding(UTF-8)', 'sips', '-g', 'pixelWidth', '-g', 'pixelHeight', '-g', 'description', $f or die;
  while (<$p>) { $w = $1 if /pixelWidth:\s*(\d+)/; $h = $1 if /pixelHeight:\s*(\d+)/; $d = $1 if /^\s*description:\s*(.*?)\s*$/; }
  $d = undef if defined $d && $d eq "<nil>";   # sips says <nil> when there is none
  close $p; return ($w, $h, $d);
}

# Finder "Comments" (Get Info): the fallback caption source (Tyler tried it
# 2026-10-13, then settled on Description). It is NOT inside the JPEG: macOS keeps it in an extended
# attribute beside the file, so it survives Finder copies between Mac drives but
# not an export/re-save, email or download. Read straight from the xattr so
# Spotlight indexing doesn't matter.
sub finder_comment {
  my $f = shift;
  open my $err, '>&', \*STDERR or die; open STDERR, '>', '/dev/null';   # "No such xattr" = no comment
  open my $x, '-|', 'xattr', '-px', 'com.apple.metadata:kMDItemFinderComment', $f;
  my $hex = $x ? do { local $/; <$x> } // '' : ''; close $x if $x;
  open STDERR, '>&', $err;
  $hex =~ s/\s+//g; return '' if $hex eq '';
  my $tmp = "/tmp/wb-hist-comment-$$.plist";
  open my $o, '>:raw', $tmp or return ''; print $o pack('H*', $hex); close $o;
  open my $p, '-|:encoding(UTF-8)', 'plutil', '-convert', 'xml1', '-o', '-', $tmp or return '';
  my $xml = do { local $/; <$p> } // ''; close $p; unlink $tmp;
  my ($c) = $xml =~ m{<string>(.*?)</string>}s or return '';
  $c =~ s/&lt;/</g; $c =~ s/&gt;/>/g; $c =~ s/&quot;/"/g; $c =~ s/&apos;/'/g; $c =~ s/&amp;/&/g;
  return $c;
}

# Photo captions: the Description metadata baked into the file first (Tyler's
# call, 2026-10-13), else Finder Comments. Cleaned for
# the web here; his files are never touched. --captions lists what each got.
sub caption {
  my ($d, $key) = @_;
  return '' unless defined $d;
  $d =~ s/^\s+|\s+$//g; $d =~ s/\s+/ /g;
  # his usual slips (customer-facing, so fixed here)
  $d =~ s/\bSlamon\b/Salmon/g; $d =~ s/\b1sr\b/1st/gi; $d =~ s/\bAuxilary\b/Auxiliary/gi;
  $d =~ s/(^|[-\s])len,/$1Glen,/; $d =~ s/\b(shop)\d\b/$1/gi; $d =~ s/\bwate$/water/;
  $d =~ s/\bDamn\b/Dam/g; $d =~ s/^ly (\d{4}s?)\b/Early $1/;
  # Dates in captions (Tyler, 2026-10-13): in an ERA ("1980s") every photo keeps
  # its own date as typed ("1984 — ...", or just "1980s"). On a single-year date
  # the repeat comes off, since the year is already big above it.
  if ($key !~ /s$/i && $d =~ /^(\d{4})(?:\s*[-\x{2013}\x{2014}:]\s*|\s+|$)(.*)$/s) {
    my ($tok, $rest) = ($1, $2);
    $d = $rest if $tok eq $key && ($rest eq '' || $rest =~ /^[A-Z0-9"\x{201C}]/);
  }
  return '' if $d eq '';
  # dashes used as separators ("Rogue River-Left") become " · "; real hyphens
  # ("first-ever", "22-horsepower") are followed by lowercase and stay
  $d =~ s/\s+-\s+/ \x{00B7} /g;
  $d =~ s/(?<=\S)-(?=[A-Z][a-z])/ \x{00B7} /g;   # a word after it, so "C-130" stays
  $d =~ s/,(?=[^\s\d])/, /g;
  # a date leading the caption always reads "1984 — ..." (Tyler's style)
  $d =~ s/^((?:(?:Early|Late|Mid)\s+)?\d{4}s?)\s*(?:\x{2014}|\x{2013}|\x{00B7}|-)\s*(?=\S)/$1 \x{2014} /i;
  # mostly-caps captions get title case (acronyms kept)
  my $up = () = $d =~ /[A-Z]/g; my $lo = () = $d =~ /[a-z]/g;
  if ($up > 2 * $lo) {
    my %keep = map { $_ => 1 } qw(SE NW NE SW BC US USA II III);
    my %small = map { $_ => 1 } qw(a an and at by for in of on or the to up);
    my $first = 1;
    $d =~ s{\b([A-Z][A-Z']+)\b}{ my $w = $1; my $o = $keep{$w} ? $w : ($small{lc $w} && !$first) ? lc $w : ucfirst lc $w; $first = 0; $o }ge;
  }
  return $d;
}
sub sips_out {   # sips to JPEG, only ever shrinking (its chatter goes to /dev/null)
  my ($in, $out, @resize) = @_;
  open my $keep, ">&", \*STDOUT or die; open STDOUT, ">", "/dev/null" or die;
  my $rc = system('sips', '-s', 'format', 'jpeg', '-s', 'formatOptions', $Q, @resize, $in, '--out', $out);
  open STDOUT, ">&", $keep or die; binmode STDOUT, ':encoding(UTF-8)';
  $rc == 0 or die "sips failed on $in\n";
}
sub sips_q {   # sips to JPEG at a given quality, chatter to /dev/null
  my ($in, $out, $q, @ops) = @_;
  open my $keep, ">&", \*STDOUT or die; open STDOUT, ">", "/dev/null" or die;
  my $rc = system('sips', '-s', 'format', 'jpeg', '-s', 'formatOptions', $q, @ops, $in, '--out', $out);
  open STDOUT, ">&", $keep or die; binmode STDOUT, ':encoding(UTF-8)';
  $rc == 0 or die "sips failed on $in\n";
}
sub budget_jpeg {   # encode from the ORIGINAL each time (never re-compress a JPEG we made)
  my ($in, $out, $kb, @ops) = @_;
  for my $q (@LADDER) { sips_q($in, $out, $q, @ops); return $q if -s $out <= $kb * 1024; }
  return $LADDER[-1];
}
sub cap_date {   # "1964 — ..." -> 1964; "Late 1960s — ..." -> Late 1960s; none -> the section's date
  my ($cap, $key) = @_;
  return $1 if $cap =~ /^((?:(?:Early|Late|Mid)\s+)?\d{4}s?|[A-Z][a-z]+\.?\s+\d{1,2},\s+\d{4})(?:\s*[\x{2014}\x{2013}-]|$)/;
  return $key;
}
sub ver { my $f = shift; open my $h, '<:raw', $f or die; local $/; substr(md5_hex(<$h>), 0, 8) }
sub natural { my ($x, $y) = @_; my @a = split /(\d+)/, lc $x; my @b = split /(\d+)/, lc $y;
  while (@a && @b) { my ($p, $q) = (shift @a, shift @b); next if $p eq $q;
    return ($p =~ /^\d+$/ && $q =~ /^\d+$/) ? $p <=> $q : $p cmp $q; } @a <=> @b }

# ── find each date's photos ──
my %used_dirs;
sub photos_for {
  my $key = shift;
  for my $s (@src) {
    opendir my $d, $s or next;
    my @dirs = grep { !/^\./ && -d "$s/$_" && (lc $_ eq lc $key || /^\Q$key\E[\s_-]/i) } readdir $d;
    closedir $d;
    for my $dir (sort @dirs) {
      opendir my $pd, "$s/$dir" or next;
      my @imgs = sort { natural($a, $b) } grep { !/^\./ && /\.(jpe?g|png|tiff?|heic)$/i && -s "$s/$dir/$_" } readdir $pd;
      closedir $pd;
      if (@imgs) { $used_dirs{"$s/$dir"} = 1; return ("$s/$dir", @imgs); }
    }
  }
  return ();
}

# ── face-finder for thumbnail framing (_build/history_focus.swift) ──
my $FOCUS = ($ENV{TMPDIR} || '/tmp') . '/wb-history-focus';
my $FOCUS_SRC = "$root/_build/history_focus.swift";
if (!-x $FOCUS || -M $FOCUS > -M $FOCUS_SRC) {
  print "compiling history_focus.swift (once) ...\n";
  system('swiftc', '-O', $FOCUS_SRC, '-o', $FOCUS) == 0 or do { warn "  face-finder didn't build; thumbs crop from the centre\n"; $FOCUS = '' };
}
sub square_cut {   # cut each [in.png, out.png] square, aimed at faces; falls back to a centre cut
  my @pairs = @_; return unless @pairs;
  if ($FOCUS) { system($FOCUS, '--crop', map { @$_ } @pairs) == 0 and return; }
  for my $pr (@pairs) { my ($w, $h) = dims($pr->[0]); my $S = $w < $h ? $w : $h;
    system('sips', '-c', $S, $S, $pr->[0], '--out', $pr->[1]) }
}

# ── the two full-width photos: hero (01-HERO...) and the closing end cap (01-END CAP...) ──
make_path("$root/assets/history");
my %wide_v;
for my $w (['hero', qr/^01-HERO.*\.(jpe?g|png|tiff?)$/i], ['endcap', qr/^01-END.*\.(jpe?g|png|tiff?)$/i]) {
  my ($name, $re) = @$w;
  for my $s (@src) {
    opendir my $d, $s or next;
    my ($h) = grep { $_ =~ $re } readdir $d; closedir $d;
    next unless $h;
    my ($pw) = dims("$s/$h");
    sips_out("$s/$h", "$root/assets/history/$name.jpg", ($pw > 2400 ? ('-Z', 2400) : ()));
    $wide_v{$name} = ver("$root/assets/history/$name.jpg");
    printf "%-9s <- %s\n", $name, where("$s/$h"); last;
  }
}

# ── per-date photos + markup ──
my $html = "\n";
my $n_photos = 0;
my $squeezed = 0; my %small;
my $TMP = ($ENV{TMPDIR} || '/tmp') . "/wb-history-$$"; make_path($TMP);
for my $e (@eras) {
  my $key = $e->{key}; my $slug = lc $key;
  my $out = "$root/assets/history/$slug";
  remove_tree($out);
  my ($dir, @imgs) = photos_for($key);
  my @tiles; my @vids; my @after;   # @after: the photo filename each tile came from
  for my $v (@{$e->{videos}}) {
    my ($id, $title, $anchor) = @$v;
    push @vids, [$anchor, qq{    <button type="button" class="htile vid" data-yt="$id" data-vtitle="} . esc(plain($title)) . qq{">}
      . qq{<span class="hpic"><img src="} . yt_thumb($id) . qq{" alt="" loading="lazy" decoding="async"><span class="hplay" aria-hidden="true"></span></span>}
      . qq{<span class="hpc"><b>Watch</b> } . esc(plain($title)) . qq{</span></button>}];
  }
  if (@imgs) {
    make_path("$out/thumbs");
    my $i = 0; my $N = @imgs; my @shots;
    my $short = plain(join ' ', @{$e->{text}}); $short =~ s/[.:].*$//s;
    for my $f (@imgs) {
      $i++; my $nn = sprintf '%02d', $i;
      my ($w, $h, $desc) = info("$dir/$f");
      my $com = finder_comment("$dir/$f");
      my $cap = caption(defined $desc && $desc =~ /\S/ ? $desc : $com, $key);
      printf "    %-22s %s\n", $f, ($cap eq '' ? '(no caption)' : $cap) if $list_caps;
      my $long = $w > $h ? $w : $h;
      my $qf = budget_jpeg("$dir/$f", "$out/$nn.jpg", $FULL_KB, ($long > $FULL ? ('-Z', $FULL) : ()));
      $squeezed++ if $qf < $LADDER[0];
      my @tr = $w >= $h ? ('--resampleHeight', $THUMB) : ('--resampleWidth', $THUMB);
      @tr = () if ($w < $h ? $w : $h) <= $THUMB;
      my $png = "$TMP/$slug-$nn.png";   # lossless stop-over, so the tile is only compressed once
      { open my $keep, ">&", \*STDOUT; open STDOUT, ">", "/dev/null";
        system('sips', '-s', 'format', 'png', @tr, "$dir/$f", '--out', $png);
        open STDOUT, ">&", $keep; binmode STDOUT, ':encoding(UTF-8)'; }
      my ($fw, $fh) = dims("$out/$nn.jpg");
      my $alt = esc($cap ne '' ? "$key: $cap" : "$key: $short (photo $i of $N)");
      push @shots, [$nn, $fw, $fh, $png, $alt, $cap, $f];
      $n_photos++;
      $small{"$key/$f"} = ($w < $h ? $w : $h) if ($w < $h ? $w : $h) < 600;
    }
    # Tiles are square, so the thumb is cut square, aimed at people's faces
    # (_build/history_focus.swift) so heads aren't cut off (Tyler, 2026-10-13).
    # Cutting it square also drops the part no one ever sees: 20-47% lighter.
    { open my $keep, ">&", \*STDOUT; open STDOUT, ">", "/dev/null";
      square_cut(map { [$_->[3], "$_->[3].sq.png"] } @shots);
      open STDOUT, ">&", $keep; binmode STDOUT, ':encoding(UTF-8)'; }
    for my $k (0..$#shots) {
      my ($nn, $fw, $fh, $png, $alt, $cap, $src) = @{$shots[$k]};
      push @after, $src;
      my ($S) = dims("$png.sq.png");
      budget_jpeg("$png.sq.png", "$out/thumbs/$nn.jpg", $TILE_KB);
      unlink $png, "$png.sq.png";
      push @tiles, sprintf qq{    <a class="htile" href="/assets/history/%s/%s.jpg?v=%s" data-w="%d" data-h="%d" data-cap="%s"><span class="hpic"><img src="/assets/history/%s/thumbs/%s.jpg?v=%s" alt="%s" width="%d" height="%d" loading="lazy" decoding="async"></span><span class="hpc">%s</span></a>},
        $slug, $nn, ver("$out/$nn.jpg"), $fw, $fh, esc($cap), $slug, $nn, ver("$out/thumbs/$nn.jpg"), $alt, $S, $S, esc($cap);
    }
  }
  # Videos go first, unless the timeline line says "| after 1970s-005" (Tyler,
  # 2026-10-14): then right after that photo (its filename, with or without .JPG).
  for my $v (reverse @vids) {
    my ($anchor, $tile) = @$v; my $at = 0;
    if (defined $anchor) {
      (my $a = lc $anchor) =~ s/\.(jpe?g|png|tiff?|heic)$//;
      my ($k) = grep { defined $after[$_] && (my $b = lc $after[$_]) =~ s/\.(jpe?g|png|tiff?|heic)$//r eq $a } 0..$#after;
      if (defined $k) { $at = $k + 1 + scalar(grep { !defined } @after[0..$k]); }
      else { warn "  $key: video placed first, no photo named \"$anchor\"\n" }
    }
    splice @tiles, $at, 0, $tile; splice @after, $at, 0, undef;
  }
  printf "%-9s %2d photo(s)%s%s\n", $key, scalar(@imgs), (@{$e->{videos}} ? ' + ' . @{$e->{videos}} . ' video' : ''), ($dir ? '  <- ' . where($dir) : '');

  my $cap = join "</p>\n  <p class=\"hcap\">", @{$e->{text}};
  $html .= qq{<article class="hera" id="y$slug" data-yr="$key">\n};
  $html .= qq{  <div class="hseg" aria-hidden="true"><i></i></div>\n};
  $html .= qq{  <div class="hhead"><span class="hghost" aria-hidden="true">$key</span><span class="hnode" aria-hidden="true"></span><h2 class="hyr">$key</h2></div>\n};
  $html .= qq{  <p class="hcap">$cap</p>\n} if @{$e->{text}};
  for my $l (@{$e->{links}}) {
    my ($u, $label) = @$l; my $ext = $u =~ /^https?:/ ? ' target="_blank" rel="noopener"' : '';
    $html .= qq{  <p class="hlink"><a class="plate ghost" href="} . esc($u) . qq{"$ext>$label</a></p>\n};
  }
  if (@tiles) {
    $html .= qq{  <div class="hcar">\n    <div class="htrack">\n} . join("\n", @tiles) . qq{\n    </div>\n};
    $html .= qq{    <div class="hcarui"><button type="button" class="hprev" aria-label="Previous photo"></button><span class="hcount"></span><button type="button" class="hnext" aria-label="Next photo"></button></div>\n  </div>\n} if @tiles > 1;
    $html .= qq{  </div>\n} if @tiles == 1;
  }
  $html .= qq{</article>\n};
}

# ── From the Archives: brochures & ads, taped in like clippings, above the timeline ──
# Source: the master's "HERITAGE BROCHURES-ADS" folder (Tyler, 2026-10-14). Captions and
# order work like the date folders. No folder or no photos = no section.
my $ARCH_DIR = 'HERITAGE BROCHURES-ADS';
my $arch_html = '';
{
  my $out = "$root/assets/history/archives"; remove_tree($out);
  my ($base) = grep { -d "$_/$ARCH_DIR" } @src;
  my @imgs;
  if ($base) {
    opendir my $ad, "$base/$ARCH_DIR" or die;
    @imgs = sort { natural($a, $b) } grep { !/^\./ && /\.(jpe?g|png|tiff?|heic)$/i && -s "$base/$ARCH_DIR/$_" } readdir $ad;
    closedir $ad;
  }
  if (@imgs) {
    my $dir = "$base/$ARCH_DIR"; make_path("$out/clip");
    # Tyler names these by date ("1984-BROCHURE", "EARLY 1980s-BROCHURE"), so the scrapbook
    # runs oldest to newest by that date, not alphabetically. Within a decade the generic
    # era comes first (as on the timeline), then Early, the specific years, Mid, Late.
    my $dkey = sub { my $d = shift // ''; $d =~ /^(?:(early|mid|late)\s+)?(\d{4})(s?)$/i or return 1e9;
      return $2 + ($3 ? { '' => 0, early => .2, mid => 5, late => 8 }->{lc($1 // '')} : 0) };
    my @pieces;
    for my $f (@imgs) {
      my ($w, $h, $desc) = info("$dir/$f");
      my $com = finder_comment("$dir/$f");
      my $cap = caption(defined $desc && $desc =~ /\S/ ? $desc : $com, 'archives');
      my ($fdate) = $f =~ /^((?:(?:early|mid|late)\s+)?\d{4}s?)\b/i;
      $fdate = join ' ', map { /^\d/ ? $_ : ucfirst lc } split ' ', $fdate if defined $fdate;
      my ($yr) = $cap =~ /^((?:(?:Early|Late|Mid)\s+)?\d{4}s?)\b/i;
      if (!defined $yr && defined $fdate) {   # a garbled caption date ("!908s-...") borrows the filename's
        $cap =~ s/^\S*\d\S*?s?\s*(?:[-\x{2014}\x{2013}\x{00B7}]\s*)?//;
        $cap = $cap eq '' ? $fdate : "$fdate \x{2014} $cap"; $yr = $fdate;
      }
      push @pieces, { f => $f, w => $w, h => $h, cap => $cap, yr => $yr, k => $dkey->($yr // $fdate) };
    }
    @pieces = sort { $a->{k} <=> $b->{k} || natural($a->{f}, $b->{f}) } @pieces;
    my @c; my $i = 0;
    for my $pc (@pieces) {
      my ($f, $w, $h, $cap, $yr) = @$pc{qw(f w h cap yr)};
      $i++; my $nn = sprintf '%02d', $i;
      printf "    %-34s %s\n", $f, ($cap eq '' ? '(no caption)' : $cap) if $list_caps;
      my $long = $w > $h ? $w : $h;
      budget_jpeg("$dir/$f", "$out/$nn.jpg", $FULL_KB, ($long > $FULL ? ('-Z', $FULL) : ()));
      # the strip sizes pieces by HEIGHT (up to 360px), so 760px tall covers 2x screens
      budget_jpeg("$dir/$f", "$out/clip/$nn.jpg", 300, ($h > 760 ? ('--resampleHeight', 760) : ()));
      my ($cw, $ch) = dims("$out/clip/$nn.jpg");
      # on the page just the date, like the carousels; the caption waits for the viewer (Tyler, 2026-10-14)
      push @c, sprintf qq{      <a class="hclip" href="/assets/history/archives/%s.jpg?v=%s" data-yr="%s" data-cap="%s"><img src="/assets/history/archives/clip/%s.jpg?v=%s" alt="%s" width="%d" height="%d" loading="lazy" decoding="async"><span class="hclip-cap">%s</span></a>},
        $nn, ver("$out/$nn.jpg"), esc($yr // ''), esc($cap), $nn, ver("$out/clip/$nn.jpg"), esc($cap ne '' ? $cap : 'Wooldridge Boats brochure'), $cw, $ch, esc($yr // '');
    }
    # sits between the about copy and the timeline (Tyler, 2026-10-14), so no rope above it
    $arch_html = qq{\n<section class="harch" aria-labelledby="harch-h"><div class="wrap">\n}
      . qq{  <p class="hmap-kick">From the Archives</p>\n  <h2 class="hmap-h" id="harch-h">Brochures &amp; Ads</h2>\n}
      . qq{  <div class="hcar hclipcar">\n    <div class="htrack hclips">\n} . join("\n", @c) . qq{\n    </div>\n}
      . qq{    <div class="hcarui"><button type="button" class="hprev" aria-label="Previous brochure"></button><span class="hcount"></span><button type="button" class="hnext" aria-label="Next brochure"></button></div>\n}
      . qq{  </div>\n</div></section>\n};
  }
  printf "archives  %2d piece(s)%s\n", scalar(@imgs), ($base && @imgs ? '  <- ' . where("$base/$ARCH_DIR") : '');
}

# ── Heritage Videos strip: between the map and the closing photo (Tyler, 2026-10-14) ──
my $vids_html = '';
if (@hvids) {
  my @t = map { my ($id, $title, $len) = @$_;
    qq{      <button type="button" class="htile vid hv" data-yt="$id" data-vtitle="} . esc($title) . qq{">}
    . qq{<span class="hpic"><img src="} . yt_thumb($id) . qq{" alt="" loading="lazy" decoding="async"><span class="hplay" aria-hidden="true"></span>}
    . ($len ne '' ? qq{<span class="hdur">$len</span>} : '') . qq{</span><span class="hpc">} . esc($title) . qq{</span></button>} } @hvids;
  $vids_html = qq{\n<section class="hvids" aria-labelledby="hvids-h"><div class="wrap">\n}
    . qq{  <div class="hseg" aria-hidden="true"><i></i></div>\n}
    . qq{  <p class="hmap-kick">From the Film Archive</p>\n  <h2 class="hmap-h" id="hvids-h">Heritage Videos</h2>\n}
    . qq{  <div class="hcar hvidcar">\n    <div class="htrack">\n} . join("\n", @t) . qq{\n    </div>\n}
    . qq{    <div class="hcarui"><button type="button" class="hprev" aria-label="Previous video"></button><span class="hcount"></span><button type="button" class="hnext" aria-label="Next video"></button></div>\n}
    . qq{  </div>\n</div></section>\n};
}
printf "videos    %2d heritage video(s)\n", scalar @hvids;

# ── image folders for dates no longer on the timeline go away ──
{
  my %live = map { lc $_->{key} => 1 } @eras; $live{archives} = 1;
  opendir my $ad, "$root/assets/history" or die;
  for my $dd (grep { !/^\./ && -d "$root/assets/history/$_" } readdir $ad) {
    next if $live{$dd};
    remove_tree("$root/assets/history/$dd"); print "  removed old images: assets/history/$dd\n";
  }
  closedir $ad;
}

# ── write into the page ──
my $page = "$root/our-history/index.html";
open my $pf, '<:encoding(UTF-8)', $page or die; local $/; my $src = <$pf>; close $pf;
$src =~ s{(<!-- HIST:timeline -->).*?(<!-- /HIST:timeline -->)}{$1$html$2}s or die "markers missing in $page\n";
$src =~ s{(<!-- HIST:archives -->).*?(<!-- /HIST:archives -->)}{$1$arch_html$2}s or die "archives markers missing in $page\n";
$src =~ s{(<!-- HIST:videos -->).*?(<!-- /HIST:videos -->)}{$1$vids_html$2}s or die "videos markers missing in $page\n";
for my $name (keys %wide_v) { $src =~ s{(/assets/history/\Q$name\E\.jpg)(\?v=\w+)?}{$1?v=$wide_v{$name}}g; }
open my $po, '>:encoding(UTF-8)', $page or die; print $po $src; close $po;

# ── folders with photos but no spot on the timeline (so nothing gets lost) ──
my %keys = map { lc $_->{key} => 1 } @eras;
my %told;
for my $s (@src) {
  opendir my $d, $s or next;
  for my $dir (sort grep { !/^\./ && -d "$s/$_" } readdir $d) {
    my ($k) = $dir =~ /^(\d{4}s?)/ or next;
    next if $keys{lc $k} || $used_dirs{"$s/$dir"} || $told{lc $dir}++;
    print "  no timeline entry yet for folder: $dir\n";
  }
  closedir $d;
}
remove_tree($TMP);
my ($tot, $big) = (0, 0); my @heavy;
for my $e (@eras) { my $d = "$root/assets/history/" . lc $e->{key}; next unless -d $d;
  for my $f (glob("$d/*.jpg"), glob("$d/thumbs/*.jpg")) { my $z = -s $f; $tot += $z; push @heavy, [$z, $f] } }
@heavy = sort { $b->[0] <=> $a->[0] } @heavy;
printf "sizes: %.1f MB of web images; biggest %s (%.0f KB); %d full-size photo(s) stepped down the quality ladder to fit %d KB\n",
  $tot / 1048576, ($heavy[0][1] =~ s{^\Q$root/\E}{}r), $heavy[0][0] / 1024, $squeezed, $FULL_KB if @heavy;
print "  low-res originals (short side under 600px; can look soft, ask for a bigger scan): ", join(', ', map { "$_ ($small{$_}px)" } sort keys %small), "\n" if %small;
print "done: ", scalar(@eras), " dates, $n_photos photos\n";
