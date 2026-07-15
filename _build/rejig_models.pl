#!/usr/bin/perl
# rejig_models.pl — restructure every models/*/index.html:
#   hero → intro/facts/CTAs → grouped card gallery → product video →
#   standard features → condensed pricing folds → (options removed) →
#   original photo gallery.
# Also wires in assets/modelpage.js (PDF + video lightboxes).
# Idempotent: pages already carrying a "Watch" section are skipped.
use strict;
use warnings;
use File::Basename qw(dirname);

my $root = dirname(dirname(__FILE__));
my $modeldir = "$root/models";

# slug → [youtube id, verbatim title]  (from youtube.com/@WooldridgeBoats)
my %VIDEO = (
  'alaskan'                      => ['pXMC5nirKaQ', "The Wooldridge Alaskan 18' and 20'"],
  'alaskan-lt'                   => ['-tlsEB0o7x4', 'Wooldridge Alaskan LT Walkthrough'],
  'rogue'                        => ['ZBFK43pgHd0', "Meet the Rogue! An 18' HDPE plastic boat from Wooldridge Boats"],
  'scout'                        => ['mmAn8H32A6w', "Wooldridge 21' Scout | Review, On-Water Test & Performance Breakdown"],
  'scout-widebody'               => ['PlYjmMSFUTE', "Wooldridge 21' Scout Widebody | Features, Layout & On-Water Look"],
  'skagit-x'                     => ['UD5ofU2WHw8', "Wooldridge 21' Skagit-X | Features, Layout & On-Water Look"],
  'sport'                        => ['Pyt_mX3rLzU', 'The Wooldridge SPORT'],
  'sportinboard'                 => ['Pyt_mX3rLzU', 'The Wooldridge SPORT'],
  'skagit-inboard'               => ['nkN8eg9YQSo', "20' Wooldridge XP 2.3 EcoBoost Inboard with Hamilton 212 Jet"],
  'xp'                           => ['OtGWlLbysZQ', 'Wooldridge XP'],
  'deepwater'                    => ['m4ehkABeqEg', "33' Wooldridge Deepwater Explorer"],
  'supersportoffshorepilothouse' => ['h6p-gE16A9s', "30' Wooldridge Super Sport Offshore Pilothouse"],
  'supersportdrifter'            => ['jGDKF1hM_c8', "23' Super Sport Drifter Walkthrough"],
  'supersportdrifterinboard'     => ['jGDKF1hM_c8', "23' Super Sport Drifter Walkthrough"],
);

sub esc { my $s = shift; $s =~ s/&/&amp;/g; return $s; }

sub video_html {
  my ($slug) = @_;
  my $head = qq{  <div class="sechead tight"><div class="eyebrow">Watch</div>\n} .
             qq{        <h2 style="font-size:clamp(20px,2.6vw,28px);">See it on the water</h2></div>\n};
  if (my $v = $VIDEO{$slug}) {
    my ($id, $title) = @$v;
    my $t = esc($title);
    return $head .
      qq{        <figure class="vidsec">\n} .
      qq{          <button class="vidfacade" type="button" data-yt="$id" data-vtitle="$t" aria-label="Play video: $t">\n} .
      qq{            <img src="https://i.ytimg.com/vi/$id/maxresdefault.jpg" alt="$t" loading="lazy" onerror="this.onerror=null;this.src='https://i.ytimg.com/vi/$id/hqdefault.jpg';">\n} .
      qq{            <span class="vidplay" aria-hidden="true"></span>\n} .
      qq{          </button>\n} .
      qq{          <figcaption>$t<span class="ref">WOOLDRIDGE BOATS ON YOUTUBE</span></figcaption>\n} .
      qq{        </figure>\n};
  }
  return $head .
    qq{        <div class="vidsoon">\n} .
    qq{          <div class="vsbadge">VIDEO COMING SOON</div>\n} .
    qq{          <p>We&#8217;re putting this model in front of the camera. In the meantime our channel is full of walkthroughs, on-water tests, and how-tos from the Wooldridge fleet.</p>\n} .
    qq{          <a class="plate ghost" href="https://www.youtube.com/\@WooldridgeBoats" target="_blank" rel="noopener"><span class="k">YouTube</span>Visit \@WooldridgeBoats</a>\n} .
    qq{        </div>\n};
}

# split a sechead-led block into (eyebrow, h2, lede, rest-after-sechead)
sub parse_block {
  my ($block) = @_;
  my ($eyebrow) = $block =~ /class="eyebrow">(.*?)<\/div>/s;
  my ($h2)      = $block =~ /<h2[^>]*>(.*?)<\/h2>/s;
  my ($lede, $rest);
  if ($block =~ /<p class="lede">(.*?)<\/p><\/div>\s*(.*)$/s)   { ($lede, $rest) = ($1, $2); }
  elsif ($block =~ /<\/h2><\/div>\s*(.*)$/s)                    { ($lede, $rest) = ('', $1); }
  else { return; }
  return ($eyebrow, $h2, $lede, $rest);
}

sub fold_html {
  my ($block) = @_;
  my ($eyebrow, $h2, $lede, $rest) = parse_block($block);
  return $block unless defined $rest;   # unparseable — leave untouched
  my @prices = map { my $p = $_; $p =~ s/,//g; $p }
               $rest =~ /class="money">\$([\d,]+)/g;
  my $from = '';
  if (@prices) {
    my ($min) = sort { $a <=> $b } @prices;
    1 while $min =~ s/(\d)(\d{3})(?!\d)/$1,$2/;
    $from = qq{<span class="pfoldfrom">from \$$min</span>};
  }
  my $ledep = $lede ? qq{      <p class="lede">$lede</p>\n} : '';
  return qq{  <details class="pfold">\n} .
         qq{    <summary><span class="pfoldeyebrow">$eyebrow</span>} .
         qq{<span class="pfoldtitle">$h2</span>$from} .
         qq{<span class="pfoldchev" aria-hidden="true"></span></summary>\n} .
         qq{    <div class="pfoldbody">\n$ledep      $rest\n    </div>\n  </details>\n};
}

my $SECHEAD = qr/<div class="sechead tight"><div class="eyebrow">/;

opendir(my $dh, $modeldir) or die "no models dir: $modeldir";
my @slugs = sort grep { -f "$modeldir/$_/index.html" } grep { !/^\./ } readdir $dh;
closedir $dh;

my ($changed, $skipped) = (0, 0);
for my $slug (@slugs) {
  my $file = "$modeldir/$slug/index.html";
  open(my $in, '<:raw', $file) or die "read $file: $!";
  local $/; my $html = <$in>; close $in;

  if ($html =~ /class="eyebrow">Watch</) { print "skip (done)  $slug\n"; $skipped++; next; }

  my $has_gallery = $html =~ /class="gallery"/;
  my $has_pricing = $html =~ /class="eyebrow">2026 Base Pricing</;

  # ── pull out the reorderable blocks ────────────────────────────────────
  my ($base, $power, $std) = ('', '', '');
  if ($has_pricing) {
    $html =~ s/(\s*${SECHEAD}2026 Base Pricing<\/div>.*?)(?=\s*$SECHEAD)//s and $base = $1;
    $html =~ s/(\s*$SECHEAD(?:Power Options|Engine (?:&amp;|&) Jet Packages)[^<]*<\/div>.*?)(?=\s*$SECHEAD)//s and $power = $1;
    $html =~ s/(\s*${SECHEAD}Included On Every Boat<\/div>.*?)(?=\s*$SECHEAD)//s and $std = $1;
    unless ($base && $power && $std) { die "$slug: could not isolate pricing/std blocks\n"; }
  }
  # drop option categories entirely (ends at next sechead or at the fineprint)
  $html =~ s/\s*${SECHEAD}Make It Yours<\/div>.*?(?=\s*$SECHEAD|\s*<p class="fineprint")//s;

  # ── build the insertion that follows the CTA row ───────────────────────
  my $insert = "\n";
  $insert .= qq{  <div class="modelcards-slot"></div>\n} if $has_gallery;
  $insert .= video_html($slug);
  if ($has_pricing) {
    $std =~ s/^\s+//;
    $insert .= "  $std\n";
    $insert .= qq{  <div class="sechead tight"><div class="eyebrow">2026 Pricing</div>\n} .
               qq{        <h2 style="font-size:clamp(20px,2.6vw,28px);">Pricing &amp; power</h2>\n} .
               qq{        <p class="lede">Condensed for easy browsing &#8212; expand a section for the full tables, or build yours for a live, complete quote.</p></div>\n};
    $insert .= fold_html($base);
    $insert .= fold_html($power);
  }

  $html =~ s/(<div class="modelctas">.*?<\/div>)\s*\n/$1\n$insert/s
    or die "$slug: no modelctas row found\n";

  # ── wire in modelpage.js ───────────────────────────────────────────────
  unless ($html =~ /modelpage\.js/) {
    $html =~ s/(<script src="\.\.\/\.\.\/assets\/shop\.js"><\/script>)/$1<script src="..\/..\/assets\/modelpage.js"><\/script>/
      or $html =~ s/(<\/body>)/<script src="..\/..\/assets\/modelpage.js"><\/script>\n$1/;
  }

  open(my $out, '>:raw', $file) or die "write $file: $!";
  print $out $html; close $out;
  print "rejigged     $slug" . ($has_pricing ? ' [pricing folds]' : '') .
        ($has_gallery ? ' [cards]' : '') . ($VIDEO{$slug} ? ' [video]' : ' [coming soon]') . "\n";
  $changed++;
}
print "\n$changed page(s) updated, $skipped skipped.\n";
