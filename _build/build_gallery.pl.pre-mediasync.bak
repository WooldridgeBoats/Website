#!/usr/bin/perl
# Generate photo-data.js + rebuilt photos/index.html for the Wooldridge site.
use strict; use warnings; use utf8;
use JSON::PP;

my $ROOT   = 'C:/Users/steph/Desktop/ALMOST DONE (1)/ALMOST DONE';
my $PHOTOS = "$ROOT/assets/photos";
my $PAGE   = "$ROOT/photos/index.html";

# slug, display name, category, offered lengths, single-length inference
my @MODELS = (
  ['alaskan-lt',              'Alaskan LT',                 'Outboard Jet', [16,18,20], undef],
  ['alaskan',                 'Alaskan',                    'Outboard Jet', [18,20],    undef],
  ['alaskan-xlt',             'Alaskan XLT',                'Outboard Jet', [18,20],    undef],
  ['alaskanxl',               'Alaskan XL',                 'Outboard Jet', [20],       20],
  ['rogue',                   'Rogue HDPE',                 'Outboard Jet', [16,18,20], undef],
  ['skagit',                  'Skagit',                     'Outboard Jet', [18,20],    undef],
  ['sport',                   'Sport',                      'Outboard Jet', [18,20],    undef],
  ['supersportdrifter',       'Super Sport Drifter',        'Outboard Jet', [21,23,25], undef],
  ['sportster',               'Sportster',                  'Outboard Jet', [21,23,25], undef],
  ['alaskan-xl-inboard',      'Alaskan XL Inboard',         'Inboard Jet',  [20,21],    undef],
  ['scout',                   'Scout',                      'Inboard Jet',  [19,21,23], undef],
  ['scout-widebody',          'Scout Widebody',             'Inboard Jet',  [21,23,25], undef],
  ['skagit-inboard',          'Skagit Inboard',             'Inboard Jet',  [18,20],    undef],
  ['sportinboard',            'Sport Inboard',              'Inboard Jet',  [18,20],    undef],
  ['supersportdrifterinboard','Super Sport Drifter Inboard','Inboard Jet',  [20,23,25], undef],
  ['skagit-x',                'Skagit-X',                   'Inboard Jet',  [21],       21],
  ['sportoffshore',           'Sport Offshore',             'Offshore',     [18,20],    undef],
  ['super-sport-offshore',    'Super Sport Offshore',       'Offshore',     [20,21,23,26], undef],
  ['landing-craft',           'Landing Craft',              'Specialty Workboat', [],   undef],
  ['agency-lc29',             "29' LC — In The Shop",       'Agency Build', [29],       29],
);

my %CFG  = ('cc','Center Console','ws','Windshield','tiller','Tiller','first-responder','First Responder');
my %SHOT = ('product','Product','photo','Field','water','On the water','delivery','Delivery','finish','Finish work','build','In the shop');

sub parse_file {
  my ($single, $fname) = @_;
  (my $stem = $fname) =~ s/\.jpe?g$//i;
  my @toks = split /-/, $stem;
  my $idx;
  if (@toks && $toks[-1] =~ /^\d+$/) { $idx = 0 + pop @toks; $stem = join '-', @toks; }
  my ($hull, $year);
  if (@toks && $toks[0] =~ /^[45]\d{3}$/) { $hull = shift @toks; }
  elsif (@toks && $toks[0] =~ /^y?20\d\d$/) { ($year = shift @toks) =~ s/^y//; }
  my ($len, @rest);
  for my $t (@toks) {
    if (!defined $len && $t =~ /^(1[4-9]|2[0-9]|3[0-2])$/) { $len = 0 + $t; }
    else { push @rest, $t; }
  }
  my $joined = join('-', @rest);
  my ($cfg, $shot);
  $cfg = 'first-responder' if $joined =~ /first-responder/;
  for my $t (@rest) {
    $cfg  = $t if !defined $cfg  && exists $CFG{$t};
    $shot = $t if !defined $shot && exists $SHOT{$t};
  }
  $len = $single if !defined $len && defined $single;
  return { f=>$fname, len=>$len, cfg=>(defined $cfg ? $CFG{$cfg} : undef),
           shot=>(defined $shot ? $SHOT{$shot} : undef),
           hull=>$hull, year=>$year, idx=>($idx // 0), stem=>$stem };
}

# ---- enumerate photos from disk (manifest is stale) ---------------------------
my (@catalog, $total, $known);
for my $M (@MODELS) {
  my ($slug, $name, $cat, $lens, $single) = @$M;
  my @photos;
  opendir my $dh, "$PHOTOS/$slug" or die "no folder $slug";
  for my $fn (sort readdir $dh) {
    next unless $fn =~ /\.jpe?g$/i;
    -f "$PHOTOS/$slug/thumbs/$fn" or do { print "MISSING THUMB: $slug/$fn\n"; next };
    push @photos, parse_file($single, $fn);
  }
  closedir $dh;
  @photos = sort {
    (defined $a->{len} ? 0 : 1) <=> (defined $b->{len} ? 0 : 1)
    || ($a->{len} // 0) <=> ($b->{len} // 0)
    || $a->{stem} cmp $b->{stem}
    || $a->{idx} <=> $b->{idx}
  } @photos;
  my $k = grep { defined $_->{len} } @photos;
  $total += @photos; $known += $k;
  printf "  %-26s %4d photos, %4d with length\n", $slug, scalar(@photos), $k;
  push @catalog, { slug=>$slug, name=>$name, cat=>$cat, lens=>$lens, photos=>\@photos };
}
printf "TOTAL %d photos, %d with length (%.0f%%)\n", $total, $known, 100*$known/$total;

# ---- emit photo-data.js ------------------------------------------------------
my $out = { models => [] };
for my $m (@catalog) {
  push @{$out->{models}}, {
    slug=>$m->{slug}, name=>$m->{name}, cat=>$m->{cat}, lens=>$m->{lens},
    photos=>[ map { my $p=$_; my %h;
        for my $k (qw(f len cfg shot hull year)) { $h{$k}=$p->{$k} if defined $p->{$k} }
        \%h } @{$m->{photos}} ],
  };
}
my $json = JSON::PP->new->canonical->encode($out);
open my $jf, '>:encoding(UTF-8)', "$ROOT/assets/photo-data.js" or die $!;
print $jf "// Generated by build_gallery.pl — photo catalog with lengths parsed from filenames.\n";
print $jf "window.WB_PHOTOS = $json;\n";
close $jf;
printf "wrote assets/photo-data.js (%d KB)\n", (-s "$ROOT/assets/photo-data.js")/1024;

# ---- extract copy from existing page -----------------------------------------
open my $pf, '<:encoding(UTF-8)', $PAGE or die $!;
my $old = do { local $/; <$pf> }; close $pf;

my ($head_nav) = $old =~ /^(.*?)<main>/s or die "no <main>";
my ($footer)   = $old =~ /(<footer>.*?<\/footer>)/s or die "no footer";

my %sec_meta;
while ($old =~ m{<div class="sechead tight" id="([^"]+)"[^>]*><div class="eyebrow">(.*?)</div>\s*<h2[^>]*>(.*?)</h2>\s*<p class="lede">(.*?)</p></div>}sg) {
  my ($sid, $eb, $h2, $lede) = ($1, $2, $3, $4);
  $sec_meta{$sid} = { eyebrow=>$eb, lede=>$lede };
}
printf "extracted %d section ledes\n", scalar keys %sec_meta;

# ---- build new page -----------------------------------------------------------
my %MNAME = map { $_->[0] => $_->[1] } @MODELS;

sub row_html {
  my ($slug, $title, $photos, $len_attr) = @_;
  my $count = scalar @$photos;
  my @a;
  for my $p (@$photos) {
    my @bits;
    push @bits, ($p->{len} ? "$p->{len}' " : '') . $MNAME{$slug};
    push @bits, $p->{cfg}  if $p->{cfg};
    push @bits, "hull $p->{hull}" if $p->{hull};
    my $alt = join(' — ', @bits);
    $alt =~ s/&/&amp;/g; $alt =~ s/"/&quot;/g; $alt =~ s/—/&#8212;/g;
    my $d = ' data-len="' . ($p->{len} // '') . '"';
    $d .= " data-cfg=\"$p->{cfg}\""   if $p->{cfg};
    $d .= " data-hull=\"$p->{hull}\"" if $p->{hull};
    $d .= " data-shot=\"$p->{shot}\"" if $p->{shot};
    push @a, "<a href=\"../assets/photos/$slug/$p->{f}\" data-m=\"$slug\"$d>"
           . "<img src=\"../assets/photos/$slug/thumbs/$p->{f}\" alt=\"$alt\" loading=\"lazy\"></a>";
  }
  my $pl = $count == 1 ? '' : 's';
  return qq{<div class="prow" data-len="$len_attr">\n}
    . qq{  <div class="prowhead"><span class="prowtitle">$title</span>}
    . qq{<span class="prowcount">$count photo$pl</span>}
    . qq{<button class="prowmode" type="button" aria-pressed="false">Grid view</button></div>\n}
    . qq{  <div class="pcar"><button class="pcarbtn pcarprev" type="button" aria-label="Scroll back">&#8592;</button>}
    . qq{<div class="pcartrack">\n    } . join("\n    ", @a) . qq{\n  </div>}
    . qq{<button class="pcarbtn pcarnext" type="button" aria-label="Scroll forward">&#8594;</button></div>\n}
    . qq{</div>\n};
}

my @body;
push @body, "<main>\n";
push @body, <<"MAST";
<header class="pagemast"><div class="wrap">
  <div class="co">Wooldridge Boats &nbsp;&#183;&nbsp; Seattle, Washington</div>
  <div class="crumb"><a href="../index.html">HOME</a> / FLEET GALLERY</div>
  <h1>The fleet, on film.</h1><div class="kick">$total PHOTOS &#183; ${\ scalar @MODELS} BOATS &#183; SHOT IN THE FIELD AND ON THE FLOOR</div>
  <div class="tag">Real boats, real water &#8212; no renderings. Browse by model or by length, tap any photo for the full-screen viewer, and use your back button anytime &#8212; it always brings you right back here.</div>
  <div class="dbl mastrule"></div>
</div></header>
MAST

my @model_chips;
for my $m (@catalog) {
  (my $label = $m->{name}) =~ s/' LC — In The Shop/&#8242; LC/;
  $label =~ s/—/&#8212;/g;
  push @model_chips, qq{<a class="optchip pjump" href="#$m->{slug}">$label &#183; ${\ scalar @{$m->{photos}}}</a>};
}
my %lens_seen;
for my $m (@catalog) { $lens_seen{$_->{len}} = 1 for grep { defined $_->{len} } @{$m->{photos}}; }
my @all_lens = sort { $a <=> $b } keys %lens_seen;
my @len_chips = map { qq{<a class="optchip pjump" href="#len-$_">$_-Foot</a>} } @all_lens;
push @len_chips, qq{<a class="optchip pjump" href="#len-x">Unlisted</a>};

push @body, qq{<div class="ptoolbar" id="ptoolbar"><div class="wrap">\n}
  . qq{  <div class="pmodes" role="tablist" aria-label="Gallery organization">\n}
  . qq{    <button class="pmode on" type="button" data-mode="model" role="tab" aria-selected="true">By Model</button>\n}
  . qq{    <button class="pmode" type="button" data-mode="length" role="tab" aria-selected="false">By Length</button>\n}
  . qq{    <span class="ptotal">$total PHOTOS</span>\n  </div>\n}
  . qq{  <div class="pchips" data-for="model">} . join('', @model_chips) . qq{</div>\n}
  . qq{  <div class="pchips" data-for="length" hidden>} . join('', @len_chips) . qq{</div>\n}
  . qq{</div></div>\n};

push @body, qq{<section class="pagebody"><div class="wrap" id="pgallery" data-view="model">\n};

my $si = 0;
for my $m (@catalog) {
  $si++;
  my $slug = $m->{slug};
  my $meta = $sec_meta{$slug} // { eyebrow=>sprintf('SEC. %02d', $si), lede=>'' };
  my $n = scalar @{$m->{photos}};
  (my $nm_html = $m->{name}) =~ s/—/&#8212;/g;
  push @body,
      qq{<div class="sechead tight psec" id="$slug"><div class="eyebrow">$meta->{eyebrow}</div>\n}
    . qq{  <h2 style="font-size:clamp(22px,3vw,32px);">$nm_html <span style="color:var(--slate); font-weight:400; font-size:.6em;">&#8212; $n photos</span></h2>\n}
    . qq{  <p class="lede">$meta->{lede}</p></div>\n};
  my %groups;
  push @{ $groups{ defined $_->{len} ? $_->{len} : 'x' } }, $_ for @{$m->{photos}};
  my @keys = sort { $a <=> $b } grep { $_ ne 'x' } keys %groups;
  push @keys, 'x' if $groups{'x'};
  for my $k (@keys) {
    my $pl = $groups{$k};
    my ($title, $la);
    if ($k ne 'x') {
      my (%seen, @cfgs);
      for my $p (@$pl) { push @cfgs, $p->{cfg} if $p->{cfg} && !$seen{$p->{cfg}}++; }
      my $sub = @cfgs ? qq{ <span class="prowsub">&#8212; } . join(' &nbsp;&#183;&nbsp; ', @cfgs) . qq{</span>} : '';
      $title = qq{<b>$k-Foot</b>$sub};
      $la = $k;
    } else {
      $title = qq{<b>Field &amp; Factory</b> <span class="prowsub">&#8212; length not tagged</span>};
      $la = 'x';
    }
    push @body, row_html($slug, $title, $pl, $la);
  }
}
push @body, qq{</div></section>\n</main>\n};

my $new = $head_nav . join('', @body) . $footer
  . qq{\n<script src="../assets/photo-data.js"></script>}
  . qq{<script src="../assets/gallery.js"></script>}
  . qq{<script src="../assets/shop.js"></script>\n</body>\n</html>\n};

$new =~ s{<title>Photos by Model &#8212; Wooldridge Boats</title>}
         {<title>Fleet Photo Gallery &#8212; Wooldridge Boats</title>};
$new =~ s{content="Field and factory photography of the Wooldridge fleet, organized by model\."}
         {content="Field and factory photography of the Wooldridge fleet &#8212; browse by model or by boat length, with a full-screen photo viewer."};

open my $of, '>:encoding(UTF-8)', $PAGE or die $!;
print $of $new; close $of;
printf "wrote photos/index.html (%d KB)\n", (-s $PAGE)/1024;
