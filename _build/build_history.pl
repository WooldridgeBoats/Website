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
#   photo folders, one per date/era    named by the DATE ("1947", "1920s",
#                                      "1947-RUNNING THE ROGUE"). Four-digit
#                                      numbers here are years, never hull numbers.
#   Sources are tried in order; the first one with photos for a date wins:
#     1. Tyler's master:  OneDrive .../MASTER-WEBSITE PHOTOS/ABOUT | HISTORY/
#     2. the archive:     /Volumes/X Drive/HERITAGE MEDIA/HERITAGE PHOTOS/
#   So as Tyler fills a date folder in the master, it replaces the archive set.
#   The hero comes from the master: the file starting "01-HERO".
#
# WRITES
#   assets/history/hero.jpg
#   assets/history/<date>/NN.jpg + thumbs/NN.jpg   (rebuilt from scratch each run)
#   our-history/index.html, between <!-- HIST:timeline --> and <!-- /HIST:timeline -->
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
@src = ($MASTER, $ARCHIVE) unless @src;
@src = grep { -d $_ or (warn "  (skipping missing source: $_)\n", 0) } @src;
sub where { my $p = shift; $p =~ s{^\Q$MASTER\E}{ABOUT | HISTORY}; $p =~ s{^\Q$ARCHIVE\E}{X Drive HERITAGE PHOTOS}; $p }

my $FULL  = 2000;   # long side of the lightbox image
my $THUMB = 720;    # short side of the carousel tile (tiles are ~340px square)
my $Q     = 82;

# ── timeline data ──
my @eras;
open my $tf, '<:encoding(UTF-8)', "$root/_build/history_timeline.txt" or die "timeline: $!";
while (my $l = <$tf>) {
  chomp $l; next if $l =~ /^\s*#/;
  if ($l =~ /^==\s*(\S+)/) { push @eras, { key => $1, text => [], videos => [], links => [] }; next; }
  next unless @eras;
  if    ($l =~ /^video:\s*(\S+)\s*\|\s*(.+?)\s*$/) { push @{$eras[-1]{videos}}, [ytid($1), $2]; }
  elsif ($l =~ /^link:\s*(\S+)\s*\|\s*(.+?)\s*$/)  { push @{$eras[-1]{links}},  [$1, $2]; }
  elsif ($l =~ /\S/) { push @{$eras[-1]{text}}, $l; }
}
close $tf;
die "no timeline entries\n" unless @eras;

sub ytid { my $u = shift; return $1 if $u =~ m{(?:youtu\.be/|v=|embed/|shorts/)([\w-]{11})}; die "bad YouTube URL: $u\n"; }
sub esc  { my $s = shift; $s =~ s/&/&amp;/g; $s =~ s/</&lt;/g; $s =~ s/>/&gt;/g; $s =~ s/"/&quot;/g; $s }
sub plain { my $s = shift; $s =~ s/<[^>]+>//g; $s }
sub dims { my @i = info(shift); @i[0, 1] }
sub info {   # (width, height, Description metadata)
  my $f = shift; my ($w, $h, $d);
  open my $p, '-|:encoding(UTF-8)', 'sips', '-g', 'pixelWidth', '-g', 'pixelHeight', '-g', 'description', $f or die;
  while (<$p>) { $w = $1 if /pixelWidth:\s*(\d+)/; $h = $1 if /pixelHeight:\s*(\d+)/; $d = $1 if /^\s*description:\s*(.*?)\s*$/; }
  close $p; return ($w, $h, $d);
}

# Photo captions: Tyler types each one into the photo's Description metadata
# (Finder Get Info / Preview / Photoshop all write it). Cleaned for the web here;
# his files are never touched. Run with --captions to list what each photo got.
sub caption {
  my ($d, $key) = @_;
  return '' unless defined $d;
  $d =~ s/^\s+|\s+$//g; $d =~ s/\s+/ /g;
  # his usual slips (customer-facing, so fixed here)
  $d =~ s/\bSlamon\b/Salmon/g; $d =~ s/\b1sr\b/1st/gi; $d =~ s/\bAuxilary\b/Auxiliary/gi;
  $d =~ s/(^|[-\s])len,/$1Glen,/; $d =~ s/\b(shop)\d\b/$1/gi;
  # a leading date that just repeats this entry's date comes off (the year is
  # already on screen); a more specific one ("1964" in 1960s, "Late 1970s") stays
  if ($d =~ /^((?:(?:late|early|mid)[\s-]+)?\d{4}s?)(?:\s*[-\x{2013}\x{2014}:]\s*|\s+|$)(.*)$/is) {
    my ($tok, $rest) = ($1, $2);
    if ($rest eq '')                  { $d = lc $tok eq lc $key ? '' : $tok; }
    elsif ($rest =~ /^[A-Z0-9"\x{201C}]/) { $d = lc $tok eq lc $key ? $rest : "$tok - $rest"; }
  }
  return '' if $d eq '';
  # dashes used as separators ("Rogue River-Left") become " · "; real hyphens
  # ("first-ever", "22-horsepower") are followed by lowercase and stay
  $d =~ s/\s+-\s+/ \x{00B7} /g;
  $d =~ s/(?<=\S)-(?=[A-Z0-9])/ \x{00B7} /g;
  $d =~ s/,(?=[^\s\d])/, /g;
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

# ── hero ──
make_path("$root/assets/history");
my $hero_v = '';
for my $s (@src) {
  opendir my $d, $s or next;
  my ($h) = grep { /^01-HERO.*\.(jpe?g|png|tiff?)$/i } readdir $d; closedir $d;
  next unless $h;
  my ($w) = dims("$s/$h");
  sips_out("$s/$h", "$root/assets/history/hero.jpg", ($w > 2400 ? ('-Z', 2400) : ()));
  $hero_v = ver("$root/assets/history/hero.jpg");
  print "hero      <- ", where("$s/$h"), "\n"; last;
}

# ── per-date photos + markup ──
my $html = "\n";
my $n_photos = 0;
for my $e (@eras) {
  my $key = $e->{key}; my $slug = lc $key;
  my $out = "$root/assets/history/$slug";
  remove_tree($out);
  my ($dir, @imgs) = photos_for($key);
  my @tiles;
  for my $v (@{$e->{videos}}) {
    my ($id, $title) = @$v;
    push @tiles, qq{    <button type="button" class="htile vid" data-yt="$id" data-vtitle="} . esc(plain($title)) . qq{">}
      . qq{<span class="hpic"><img src="https://i.ytimg.com/vi/$id/sddefault.jpg" alt="" loading="lazy" decoding="async"><span class="hplay" aria-hidden="true"></span></span>}
      . qq{<span class="hpc"><b>Watch</b> } . esc(plain($title)) . qq{</span></button>};
  }
  if (@imgs) {
    make_path("$out/thumbs");
    my $i = 0; my $N = @imgs;
    my $short = plain(join ' ', @{$e->{text}}); $short =~ s/[.:].*$//s;
    for my $f (@imgs) {
      $i++; my $nn = sprintf '%02d', $i;
      my ($w, $h, $desc) = info("$dir/$f");
      my $cap = caption($desc, $key);
      printf "    %-22s %s\n", $f, ($cap eq '' ? '(no caption)' : $cap) if $list_caps;
      my $long = $w > $h ? $w : $h;
      sips_out("$dir/$f", "$out/$nn.jpg", ($long > $FULL ? ('-Z', $FULL) : ()));
      my @tr = $w >= $h ? ('--resampleHeight', $THUMB) : ('--resampleWidth', $THUMB);
      @tr = () if ($w < $h ? $w : $h) <= $THUMB;
      sips_out("$dir/$f", "$out/thumbs/$nn.jpg", @tr);
      my ($fw, $fh) = dims("$out/$nn.jpg");
      my ($tw, $th) = dims("$out/thumbs/$nn.jpg");
      my $alt = esc($cap ne '' ? "$key: $cap" : "$key: $short (photo $i of $N)");
      push @tiles, sprintf qq{    <a class="htile" href="/assets/history/%s/%s.jpg?v=%s" data-w="%d" data-h="%d"><span class="hpic"><img src="/assets/history/%s/thumbs/%s.jpg?v=%s" alt="%s" width="%d" height="%d" loading="lazy" decoding="async"></span><span class="hpc">%s</span></a>},
        $slug, $nn, ver("$out/$nn.jpg"), $fw, $fh, $slug, $nn, ver("$out/thumbs/$nn.jpg"), $alt, $tw, $th, esc($cap);
      $n_photos++;
    }
  }
  printf "%-9s %2d photo(s)%s%s\n", $key, scalar(@imgs), (@{$e->{videos}} ? ' + ' . @{$e->{videos}} . ' video' : ''), ($dir ? '  <- ' . where($dir) : '');

  my $cap = join "</p>\n  <p class=\"hcap\">", @{$e->{text}};
  $html .= qq{<article class="hera" id="y$slug" data-yr="$key">\n};
  $html .= qq{  <div class="hseg" aria-hidden="true"><i></i></div>\n};
  $html .= qq{  <div class="hhead"><span class="hghost" aria-hidden="true">$key</span><span class="hnode" aria-hidden="true"></span><h2 class="hyr">$key</h2></div>\n};
  $html .= qq{  <p class="hcap">$cap</p>\n};
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

# ── write into the page ──
my $page = "$root/our-history/index.html";
open my $pf, '<:encoding(UTF-8)', $page or die; local $/; my $src = <$pf>; close $pf;
$src =~ s{(<!-- HIST:timeline -->).*?(<!-- /HIST:timeline -->)}{$1$html$2}s or die "markers missing in $page\n";
$src =~ s{(/assets/history/hero\.jpg)(\?v=\w+)?}{$1?v=$hero_v}g if $hero_v;
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
print "done: ", scalar(@eras), " dates, $n_photos photos\n";
