#!/usr/bin/perl
# ─────────────────────────────────────────────────────────────────────────────
# build_history.pl: builds the /our-history/ timeline (2026-10-12).
#
#   perl _build/build_history.pl                 # default photo sources
#   perl _build/build_history.pl --src <dir> ... # override (repeatable, in order)
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
while (@ARGV) { my $a = shift @ARGV; push @src, shift @ARGV if $a eq '--src'; }
@src = ($MASTER, $ARCHIVE) unless @src;
@src = grep { -d $_ or (warn "  (skipping missing source: $_)\n", 0) } @src;

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
sub dims {
  my $f = shift; my ($w, $h);
  open my $p, '-|', 'sips', '-g', 'pixelWidth', '-g', 'pixelHeight', $f or die;
  while (<$p>) { $w = $1 if /pixelWidth:\s*(\d+)/; $h = $1 if /pixelHeight:\s*(\d+)/; }
  close $p; return ($w, $h);
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
  print "hero      <- $s/$h\n"; last;
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
      . qq{<img src="https://i.ytimg.com/vi/$id/sddefault.jpg" alt="" loading="lazy" decoding="async">}
      . qq{<span class="hplay" aria-hidden="true"></span><span class="hvt">Watch · } . esc(plain($title)) . qq{</span></button>};
  }
  if (@imgs) {
    make_path("$out/thumbs");
    my $i = 0; my $N = @imgs;
    my $short = plain(join ' ', @{$e->{text}}); $short =~ s/[.:].*$//s;
    for my $f (@imgs) {
      $i++; my $nn = sprintf '%02d', $i;
      my ($w, $h) = dims("$dir/$f");
      my $long = $w > $h ? $w : $h;
      sips_out("$dir/$f", "$out/$nn.jpg", ($long > $FULL ? ('-Z', $FULL) : ()));
      my @tr = $w >= $h ? ('--resampleHeight', $THUMB) : ('--resampleWidth', $THUMB);
      @tr = () if ($w < $h ? $w : $h) <= $THUMB;
      sips_out("$dir/$f", "$out/thumbs/$nn.jpg", @tr);
      my ($fw, $fh) = dims("$out/$nn.jpg");
      my ($tw, $th) = dims("$out/thumbs/$nn.jpg");
      my $alt = esc("$key: $short (photo $i of $N)");
      push @tiles, sprintf qq{    <a class="htile" href="/assets/history/%s/%s.jpg?v=%s" data-w="%d" data-h="%d"><img src="/assets/history/%s/thumbs/%s.jpg?v=%s" alt="%s" width="%d" height="%d" loading="lazy" decoding="async"></a>},
        $slug, $nn, ver("$out/$nn.jpg"), $fw, $fh, $slug, $nn, ver("$out/thumbs/$nn.jpg"), $alt, $tw, $th;
      $n_photos++;
    }
  }
  printf "%-9s %2d photo(s)%s%s\n", $key, scalar(@imgs), (@{$e->{videos}} ? ' + ' . @{$e->{videos}} . ' video' : ''), ($dir ? "  <- $dir" : '');

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
for my $s (@src) {
  opendir my $d, $s or next;
  for my $dir (sort grep { !/^\./ && -d "$s/$_" } readdir $d) {
    my ($k) = $dir =~ /^(\d{4}s?)/ or next;
    print "  no timeline entry for folder: $s/$dir\n" unless $keys{lc $k} || $used_dirs{"$s/$dir"};
  }
  closedir $d;
}
print "done: ", scalar(@eras), " dates, $n_photos photos\n";
