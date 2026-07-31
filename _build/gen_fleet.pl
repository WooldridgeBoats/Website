#!/usr/bin/perl
# gen_fleet.pl — regenerate every duplicated copy of the model catalogue
# from the configurator's const MODELS (the single source of truth) plus
# the display patches in tools/RULES_OVERLAY.js.
#
# Targets (all between BEGIN/END markers, replaced in place):
#   index.html                        — const FLEET   (home fleet rail)
#   tools/WHICH_WOOLDRIDGE_QUIZ_2.html— const FACTS   (quiz fleet facts)
#   tools/QUOTE_REQUEST.html          — const FACTS   (quote fleet facts)
#
# This exists because the home page and both tools carried hand-typed
# copies of the catalogue, and they drifted (LE-1 — the drift Carrie
# caught). Presentation-only fields the catalogue cannot know (home-rail
# photo, marketing blurb, model-page URL) live in %PRESENTATION below;
# a new model without a presentation entry fails the run loudly rather
# than silently publishing a half-dressed card.
#
# Derivations, verified against the previous hand values on first run:
#   drive  = model.drive // 'ob'
#   from   = min over style+length of (hull + cheapest engine)   [ob/ib]
#          = min hull alone                                      [offshore]
#   maxLen = max(lengths);  pp = (drive eq 'offshore')
#   tag    = model.tag after overlay patches (lenRename rewrites it)
#
# Run after any catalogue regeneration or overlay change:
#   perl _build/gen_fleet.pl
use strict; use warnings;
# REQUIRED — do not remove. The %PRESENTATION tags below are typed with real em
# dashes, so this file is UTF-8 source. Without this pragma Perl reads each em
# dash as its three raw bytes (E2 80 94) treated as three Latin-1 characters,
# JSON::PP->ascii dutifully escapes them as â, and the home page
# renders "sled â the boat" instead of "sled — the boat". That was
# live on 2026-07-30 until Stephen spotted it in the Alaskan card. The other
# generated copies were clean, which is why it hid for so long: only the home
# page's FLEET block carries these hardcoded tags.
use utf8;
use JSON::PP;
use File::Basename qw(dirname);
use Cwd qw(abs_path);

my $root = dirname(dirname(abs_path(__FILE__)));
my $J = JSON::PP->new->canonical->ascii;

# ── presentation: fields no catalogue knows (photo, home blurb, page URL) ──
my %PRESENTATION = (
  lt        => { ph=>'assets/photos/alaskan-lt/thumbs/2026-18-ws-3.jpg',                          tag=>'Light utility jet sled. The easiest way into a real Wooldridge.',            url=>'models/alaskan-lt/' },
  ak        => { ph=>'assets/photos/alaskan/thumbs/4459-product-18-ws-ak-1.jpg',                  tag=>'The classic Wooldridge sled — the boat that built the name.',                 url=>'models/alaskan/' },
  xlt       => { ph=>'assets/photos/alaskan-xlt/thumbs/5053-product-1.jpg',                       tag=>'Extra-wide tiller and console sled for load and stability.',                  url=>'models/xlt/' },
  xl        => { ph=>'assets/photos/alaskanxl/thumbs/5226-product-1.jpg',                         tag=>'Big-water 20-foot heavy hauler.',                                             url=>'models/alaskanxl/' },
  rogue     => { ph=>'assets/photos/rogue/thumbs/5162-water-1.jpg',                               tag=>'Fully welded HDPE hull — slides over what aluminum bounces off.',             url=>'models/rogue/' },
  skagit    => { ph=>'assets/photos/skagit/thumbs/4647-product-1.jpg',                            tag=>'Deep-sided sled for bigger water and rougher days.',                          url=>'models/skagit/' },
  sport     => { ph=>'assets/photos/sport/thumbs/4589-product-3.jpg',                             tag=>'Pointed-bow crossover — river manners, open-water reach.',                    url=>'models/sport/' },
  ssd       => { ph=>'assets/photos/supersportdrifter/thumbs/5175-product-1.jpg',                 tag=>'Pointed-bow jet drifter with room for the whole crew.',                       url=>'models/supersportdrifter/' },
  sportster => { ph=>'assets/photos/sportster/thumbs/sportster-water-1.jpg',                      tag=>'Outboard jet sportster — fast, refined, and capable.',                        url=>'models/sportster/' },
  xlib      => { ph=>'assets/photos/alaskan-xl-inboard/thumbs/2026-20-first-responder-30.jpg',    tag=>'The XL heavy hauler with inboard jet power.',                                 url=>'models/alaskan-xl-inboard/' },
  scout     => { ph=>'assets/photos/scout/thumbs/5113-product-1.jpg',                             tag=>'Inboard jet workhorse — the guide-boat standard.',                            url=>'models/scout/' },
  scoutwb   => { ph=>'assets/photos/scout-widebody/thumbs/5119-scout-widebody-product-27.jpg',    tag=>'Full-cabin inboard for all-season, all-weather running.',                     url=>'models/scout-widebody/' },
  skagitib  => { ph=>'assets/photos/skagit-inboard/thumbs/5094-product-12.jpg',                   tag=>'Deep-sided sled, inboard jet drive.',                                         url=>'models/skagit-inboard/' },
  sportib   => { ph=>'assets/photos/sportinboard/thumbs/sportib-water-1.jpg',                     tag=>'The pointed-bow crossover with inboard jet power.',                           url=>'models/sportinboard/' },
  ssdib     => { ph=>'assets/photos/supersportdrifterinboard/thumbs/4403-photo-1.jpg',            tag=>'Big drifter platform, inboard jet drive.',                                    url=>'models/supersportdrifterinboard/' },
  skagitx   => { ph=>'assets/photos/skagit-x/thumbs/5092-21-skagit-x-blue-01.jpg',                tag=>'Low-side, aft-helm inboard built for working water.',                         url=>'models/skagit-x/' },
  so        => { ph=>'assets/photos/sportoffshore/thumbs/5021-product-2.jpg',                     tag=>'Offshore-bracket crossover — river to salt in one hull.',                     url=>'models/sportoffshore/' },
  sso       => { ph=>'assets/photos/super-sport-offshore/thumbs/4660-product-7.jpg',              tag=>'Big-water offshore boat, up to 26 feet of it.',                               url=>'models/super-sport-offshore/' },
);

sub slurp { my ($f)=@_; open my $fh,'<:raw',$f or die "read $f: $!"; local $/; <$fh> }
sub spew  { my ($f,$c)=@_; open my $fh,'>:raw',$f or die "write $f: $!"; print $fh $c; close $fh }

# ── load catalogue ──
my $cfg = slurp("$root/tools/Boat_Configurator_-_Customer_Version.html");
$cfg =~ /^const MODELS = (\[.*?\]);\r?$/m or die "const MODELS not found";
my $models = decode_json($1);

# ── load the overlay's display patches (written by gen_rules_overlay.pl as JSON) ──
my $ovl = slurp("$root/tools/RULES_OVERLAY.js");
my $patches   = $ovl =~ /^\s*catalogPatches:\s*(\[.*?\]),\r?$/m ? decode_json($1) : [];
my $addstyles = $ovl =~ /^\s*addStyles:\s*(\[.*?\]),\r?$/m      ? decode_json($1) : [];

my %by_id = map { $_->{id} => $_ } @$models;

# apply the same patches the configurator applies at load
for my $p (@$patches){
  my $mo = $by_id{$p->{m}} or next;
  if ($p->{lenRename}){
    my ($from,$to) = @{$p->{lenRename}}{qw(from to)};
    $mo->{lengths} = [ map { $_ == $from ? $to : $_ } @{$mo->{lengths}} ];
    for my $s (@{$mo->{styles}}){
      for my $k (qw(hulls hullNotes)){
        next unless $s->{$k} && exists $s->{$k}{$from};
        $s->{$k}{$to} = delete $s->{$k}{$from};
      }
    }
    my %ne; $ne{ ($_ =~ /^(.*?)\Q$from\E$/) ? "$1$to" : $_ } = $mo->{engines}{$_} for keys %{$mo->{engines}};
    $mo->{engines} = \%ne;
    $mo->{tag} =~ s/\b\Q$from\E\b/$to/ if $mo->{tag};
    next;
  }
  if ($p->{styleId}){
    my ($s) = grep { $_->{id} eq $p->{styleId} } @{$mo->{styles}};
    $s->{$p->{prop}} = $p->{v} if $s;
  } else {
    $mo->{$p->{prop}} = $p->{v};
  }
}
for my $s (@$addstyles){
  my $mo = $by_id{$s->{m}} or next;
  next if grep { $_->{id} eq $s->{id} } @{$mo->{styles}};
  my ($src) = grep { $_->{id} eq $s->{copyHullsFrom} } @{$mo->{styles}};
  next unless $src;
  push @{$mo->{styles}}, { id=>$s->{id}, nm=>$s->{nm}, hulls=>{ %{$src->{hulls}} } };
  for my $len (@{$mo->{lengths}}){
    my ($f,$t) = ($s->{copyHullsFrom}.$len, $s->{id}.$len);
    $mo->{engines}{$t} = $mo->{engines}{$f} if $mo->{engines}{$f} && !$mo->{engines}{$t};
  }
}

# ── derive per-model facts ──
my (%fleet, %facts);
for my $mo (@$models){
  my $id    = $mo->{id};
  my $drive = $mo->{drive} // 'ob';
  my @lens  = sort { $a <=> $b } @{$mo->{lengths}};
  my $from;
  for my $s (@{$mo->{styles}}){
    for my $len (keys %{$s->{hulls}}){
      my $hull = $s->{hulls}{$len};
      my $cost;
      if ($drive eq 'offshore'){ $cost = $hull }         # hull only, power priced with the team
      else {
        my $eng = $mo->{engines}{ $s->{id}.$len } || [];
        my ($cheapest) = sort { $a <=> $b } map { $_->{price} } @$eng;
        $cost = $hull + ($cheapest // 0);
      }
      $from = $cost if !defined $from || $cost < $from;
    }
  }
  die "no price derivable for $id\n" unless defined $from;
  $facts{$id} = {
    nm => $mo->{nm}, tag => $mo->{tag}, drive => $drive,
    lengths => \@lens, styles => [ map { $_->{id} } @{$mo->{styles}} ],
    from => $from, maxLen => $lens[-1],
    pp => ($drive eq 'offshore' ? JSON::PP::true : JSON::PP::false),
  };
  my $pres = $PRESENTATION{$id} or die "no PRESENTATION entry for new model '$id' — add photo/blurb/url above\n";
  $fleet{$id} = { id=>$id, nm=>$mo->{nm}, d=>$drive, lens=>\@lens, from=>$from, %$pres };
}

# ── writers ──
my $stamp = "generated by _build/gen_fleet.pl from the configurator catalog - do not hand-edit; re-run instead";

sub replace_block {
  my ($file, $name, $payload) = @_;
  my $c = slurp("$root/$file");
  my ($open, $close) = ("/* $name:BEGIN - $stamp */", "/* $name:END */");
  my $block = "$open\n$payload\n$close";
  $c =~ s{\Q$open\E.*?\Q$close\E}{$block}s
    or die "$file: $name markers not found — place '$open' and '$close' once, by hand, around the old block\n";
  spew("$root/$file", $c);
  print "wrote $name into $file\n";
}

# index.html — const FLEET, ordered ob, ib, offshore to match the rail tabs
my @ids = ( 'lt','ak','xlt','xl','rogue','skagit','sport','ssd','sportster',
            'xlib','scout','scoutwb','skagitib','sportib','ssdib','skagitx',
            'so','sso' );
for my $id (keys %facts){ die "model '$id' missing from the FLEET display order — add it to \@ids in gen_fleet.pl\n" unless grep { $_ eq $id } @ids }
@ids = grep { $facts{$_} } @ids;

my $fleet_js = "const FLEET = [\n" . join(",\n", map {
  my $f = $fleet{$_};
  '  ' . $J->encode({ id=>$f->{id}, nm=>$f->{nm}, d=>$f->{d}, lens=>$f->{lens},
                      from=>$f->{from}, ph=>$f->{ph}, tag=>$f->{tag}, url=>$f->{url} });
} @ids) . "\n];";
replace_block('index.html', 'FLEET', $fleet_js);

# quiz — full FACTS shape
my $quiz_js = "const FACTS = " . $J->encode({ map { $_ => $facts{$_} } @ids }) . ";";
replace_block('tools/WHICH_WOOLDRIDGE_QUIZ_2.html', 'FACTS', $quiz_js);

# quote request — slimmer FACTS shape (nm/from/drive/maxLen, pp only when true)
my $quote_js = "const FACTS = " . $J->encode({ map {
  my $f = $facts{$_};
  $_ => { nm=>$f->{nm}, from=>$f->{from}, drive=>$f->{drive}, maxLen=>$f->{maxLen},
          ($f->{pp} ? (pp=>JSON::PP::true) : ()) };
} @ids }) . ";";
replace_block('tools/QUOTE_REQUEST.html', 'FACTS', $quote_js);

# sales assist (internal) — quiz shape + slug (model page dir) + sheet
# (price sheet path fragment under /pricesheets/). This was a FIFTH
# hand-typed catalogue copy; found stale (old model names, slug 'xp').
my $assist_js = "const FACTS = " . $J->encode({ map {
  my $f = $facts{$_};
  (my $slug = $PRESENTATION{$_}{url}) =~ s{^models/|/$}{}g;
  $_ => { %$f, slug=>$slug, sheet=>"$_/" };
} @ids }) . ";";
replace_block('tools/WOOLDRIDGE_SALES_ASSIST.html', 'FACTS', $assist_js);

printf "%d models derived. from-prices: %s\n", scalar @ids,
  join(' ', map { "$_=$facts{$_}{from}" } @ids);
