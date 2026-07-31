#!/usr/bin/perl
# gen_pricesheets.pl — build a print-friendly price sheet page per model,
# straight from the configurator catalogue + the rules overlay.
#
# Replaces the 18 static PDFs in pricesheets/ (exported 4 Jul 2026, four
# of which still advertised retired Bentley seating). A separate document
# can drift; these pages cannot — they are derived from the same MODELS
# blob the configurator sells from, with the overlay's hides/adds/renames
# applied, so the paper always matches the tools. Customers print or
# save-as-PDF from the browser; an on-page button does it in one click.
#
# Writes pricesheets/<model-id>/index.html for every model. Pages carry
# the shared header/footer via inject_partials markers — run
# _build/inject_partials.pl after this script. Print CSS strips the
# chrome so the printed sheet is just the sheet.
#
# Run after any catalogue regeneration or overlay change:
#   perl _build/gen_pricesheets.pl && perl _build/inject_partials.pl
use strict; use warnings;
use JSON::PP;
use File::Basename qw(dirname);
use File::Path qw(make_path);
use Cwd qw(abs_path);
use POSIX qw(strftime);

my $root = dirname(dirname(abs_path(__FILE__)));
sub slurp { my ($f)=@_; open my $fh,'<:raw',$f or die "read $f: $!"; local $/; <$fh> }
sub spew  { my ($f,$c)=@_; open my $fh,'>:encoding(UTF-8)',$f or die "write $f: $!"; print $fh $c; close $fh }
# NOTE: decode_json yields wide characters (option names carry smart quotes),
# so output goes through an explicit UTF-8 layer. Writing wide chars to a :raw
# handle "works" but warns — and the same mistake with mixed byte/wide strings
# double-encoded a whole file earlier tonight. Encode on purpose, always.

my $cfg = slurp("$root/build-and-price/index.html");
$cfg =~ /^const MODELS = (\[.*?\]);\r?$/m or die "const MODELS not found";
my $models = decode_json($1);

# overlay keys this sheet needs: display patches, added styles/items, hidden items
my $ovl = slurp("$root/tools/RULES_OVERLAY.js");
my %OV;
for my $k (qw(catalogPatches addStyles addItems hideItems renameItems)){
  $OV{$k} = $ovl =~ /^\s*\Q$k\E:\s*([\[\{].*?[\]\}]),\r?$/m ? decode_json($1) : undef;
}
my %by_id = map { $_->{id} => $_ } @$models;

# ── mirror the configurator's applyRulesOverlay(), data-side only ──
for my $p (@{$OV{catalogPatches} || []}){
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
    for my $c (@{$mo->{cats}}){
      for my $it (@{$c->{items}}){
        $it->{lens} = [ map { $_ == $from ? $to : $_ } @{$it->{lens}} ] if $it->{lens};
        if (ref $it->{price} eq 'HASH' && exists $it->{price}{$from}){
          $it->{price}{$to} = delete $it->{price}{$from};
        }
      }
    }
    if ($mo->{adder} && $mo->{adder}{lens}){
      $mo->{adder}{lens} = [ map { $_ == $from ? $to : $_ } @{$mo->{adder}{lens}} ];
    }
    next;
  }
  if ($p->{styleId}){
    my ($s) = grep { $_->{id} eq $p->{styleId} } @{$mo->{styles}};
    $s->{$p->{prop}} = $p->{v} if $s;
  } else { $mo->{$p->{prop}} = $p->{v} }
}
for my $s (@{$OV{addStyles} || []}){
  my $mo = $by_id{$s->{m}} or next;
  next if grep { $_->{id} eq $s->{id} } @{$mo->{styles}};
  my ($src) = grep { $_->{id} eq $s->{copyHullsFrom} } @{$mo->{styles}};
  next unless $src;
  push @{$mo->{styles}}, { id=>$s->{id}, nm=>$s->{nm},
    hulls=>{ %{$src->{hulls}} }, hullNotes=>{ %{$src->{hullNotes} || {}} } };
  for my $len (@{$mo->{lengths}}){
    my ($f,$t) = ($s->{copyHullsFrom}.$len, $s->{id}.$len);
    $mo->{engines}{$t} = $mo->{engines}{$f} if $mo->{engines}{$f} && !$mo->{engines}{$t};
  }
}
for my $a (@{$OV{addItems} || []}){
  my $mo = $by_id{$a->{m}} or next;
  my ($cat) = grep { $_->{name} eq $a->{cat} } @{$mo->{cats}};
  next if !$cat || grep { $_->{id} eq $a->{id} } @{$cat->{items}};
  my $row = { id=>$a->{id}, nm=>$a->{nm}, price=>$a->{price} };
  my ($at) = grep { $cat->{items}[$_]{id} eq ($a->{after} // '') } 0..$#{$cat->{items}};
  if (defined $at) { splice @{$cat->{items}}, $at+1, 0, $row } else { push @{$cat->{items}}, $row }
}
my %hide = map { $_ => 1 } @{$OV{hideItems} || []};
my %ren  = %{$OV{renameItems} || {}};
for my $mo (@$models){
  for my $c (@{$mo->{cats}}){
    $c->{items} = [ grep { !$hide{$_->{id}} } @{$c->{items}} ];
    $_->{nm} = $ren{$_->{id}} for grep { $ren{$_->{id}} } @{$c->{items}};
  }
}

# ── render helpers ──
sub esc { my $s = shift // ''; $s =~ s/&/&amp;/g; $s =~ s/</&lt;/g; $s =~ s/>/&gt;/g; $s }
sub money { my $n = shift; defined $n ? sprintf('$%s', commify($n)) : 'CALL' }
sub commify { my $n = reverse shift; $n =~ s/(\d{3})(?=\d)/$1,/g; scalar reverse $n }
sub price_cell {
  my ($it) = @_;
  my $p = $it->{price};
  return '<td class="pr call">Priced on request</td>' if !defined $p;
  if (ref $p eq 'HASH'){
    my @lens = sort { $a <=> $b } keys %$p;
    return '<td class="pr">' . join(' &nbsp;&middot;&nbsp; ',
      map { "$_&prime; " . money($p->{$_}) } @lens) . '</td>';
  }
  return '<td class="pr">' . money($p) . '</td>';
}

my $date = strftime('%e %B %Y', localtime); $date =~ s/^\s+//;
my $n = 0;
for my $mo (@$models){
  my $id = $mo->{id};
  my %style_nm = map { $_->{id} => $_->{nm} } @{$mo->{styles}};
  my @lens = sort { $a <=> $b } @{$mo->{lengths}};

  my $h = '';
  # hulls
  $h .= qq{<h2>Base Hull</h2>\n<table class="ps">\n<tr><th>Hull style</th>};
  $h .= qq{<th>$_&prime;</th>} for @lens;
  $h .= "</tr>\n";
  for my $s (@{$mo->{styles}}){
    $h .= '<tr><td>' . esc($s->{nm}) . '</td>';
    for my $len (@lens){
      my $v = $s->{hulls}{$len};
      my $note = $s->{hullNotes} && $s->{hullNotes}{$len} ? '<div class="nt">' . esc($s->{hullNotes}{$len}) . '</div>' : '';
      $h .= defined $v ? '<td class="pr">' . money($v) . $note . '</td>' : '<td class="pr">&mdash;</td>';
    }
    $h .= "</tr>\n";
  }
  $h .= "</table>\n";

  # engines, grouped per style+length
  if (keys %{$mo->{engines}}){
    $h .= qq{<h2>Power</h2>\n};
    for my $s (@{$mo->{styles}}){
      for my $len (@lens){
        my $eng = $mo->{engines}{ $s->{id}.$len } or next;
        next unless @$eng;
        $h .= '<h3>' . esc($s->{nm}) . " &mdash; $len&prime;</h3>\n<table class=\"ps\">\n";
        $h .= '<tr><td>' . esc($_->{nm}) . '</td><td class="pr">' . money($_->{price}) . "</td></tr>\n" for @$eng;
        $h .= "</table>\n";
      }
    }
  }
  # windshield adder
  if (my $ad = $mo->{adder}){
    $h .= '<h2>' . esc($ad->{nm}) . '</h2><table class="ps"><tr><td>' . esc($ad->{desc} // '')
        . '</td><td class="pr">' . money($ad->{price}) . "</td></tr></table>\n";
  }
  # option categories
  for my $c (@{$mo->{cats}}){
    next unless @{$c->{items}};
    $h .= '<h2>' . esc($c->{name}) . "</h2>\n";
    if ($c->{notes} && @{$c->{notes}}){
      $h .= '<p class="catnote">' . join(' &middot; ', map { esc($_) } @{$c->{notes}}) . "</p>\n";
    }
    $h .= "<table class=\"ps\">\n";
    for my $it (@{$c->{items}}){
      my @flag;
      if (my $st = $it->{style}){
        my @st = ref $st ? @$st : ($st);
        push @flag, join(' / ', map { $style_nm{$_} // $_ } @st) . ' only';
      }
      push @flag, join('&prime;/', @{$it->{lens}}) . '&prime; only' if $it->{lens};
      my $f = @flag ? ' <span class="flag">(' . join('; ', @flag) . ')</span>' : '';
      $h .= '<tr><td>' . esc($it->{nm}) . $f . '</td>' . price_cell($it) . "</tr>\n";
    }
    $h .= "</table>\n";
  }
  if ($mo->{notes} && @{$mo->{notes}}){
    $h .= "<h2>Model notes</h2>\n<ul class=\"mnotes\">\n";
    $h .= '<li>' . esc($_) . "</li>\n" for @{$mo->{notes}};
    $h .= "</ul>\n";
  }

  my $nm = esc($mo->{nm});
  my $tag = esc($mo->{tag} // '');
  my $page = <<HTML;
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>$nm &mdash; 2026 Price Sheet &mdash; Wooldridge Boats</title>
<meta name="description" content="Official 2026 price sheet for the Wooldridge $nm: hulls, power, and every factory option. Generated from the live catalogue.">
<link rel="stylesheet" href="/house.css">
<style>
  .pswrap{ max-width:880px; margin:0 auto; padding:26px 24px 60px; }
  .pswrap h1{ font-size:clamp(24px,3.4vw,34px); }
  .pswrap .kick{ color:var(--slate); font-size:12.5px; letter-spacing:.1em; text-transform:uppercase; margin:6px 0 2px; }
  .pswrap h2{ font-size:17px; margin:30px 0 8px; border-bottom:2px solid var(--ink); padding-bottom:6px; }
  .pswrap h3{ font-size:13px; letter-spacing:.06em; text-transform:uppercase; color:var(--slate); margin:14px 0 4px; }
  table.ps{ width:100%; border-collapse:collapse; font-size:13.5px; }
  table.ps td, table.ps th{ padding:6px 8px; border-bottom:1px solid var(--line); vertical-align:top; text-align:left; }
  table.ps th{ font-size:11.5px; letter-spacing:.08em; text-transform:uppercase; color:var(--slate); }
  table.ps .pr{ text-align:right; white-space:nowrap; font-variant-numeric:tabular-nums; }
  table.ps .pr.call{ color:var(--blue); font-weight:600; white-space:normal; }
  table.ps .nt{ font-size:11px; color:var(--slate); white-space:normal; }
  .flag{ color:var(--slate); font-size:12px; }
  .catnote{ font-size:12px; color:var(--slate); margin:2px 0 6px; }
  .mnotes{ font-size:13px; padding-left:18px; } .mnotes li{ margin:4px 0; }
  .psmeta{ display:flex; justify-content:space-between; align-items:center; gap:14px; flex-wrap:wrap; margin-top:10px; }
  .psfine{ font-size:11.5px; color:var(--slate); }
  \@media print {
    .topstrip, nav.nav, footer, .pagenav, .psbtn{ display:none !important; }
    .pswrap{ padding:0; max-width:none; }
    table.ps td, table.ps th{ padding:3px 6px; }
    a{ color:inherit; text-decoration:none; }
  }
</style>
</head>
<body>

<!--#include virtual="/header.html" -->

<main>
<div class="pswrap">
  <div class="kick">2026 FACTORY PRICE SHEET &middot; GENERATED FROM THE LIVE CATALOGUE &middot; $date</div>
  <h1>$nm</h1>
  <div class="psmeta">
    <span class="psfine">$tag</span>
    <button class="plate ghost psbtn" onclick="window.print()">Print / Save as PDF</button>
  </div>
$h
  <p class="psfine" style="margin-top:26px;">Prices are 2026 factory list, subject to change without notice &mdash; contact Wooldridge Boats directly for an official quote: (206) 722-8998. Boat + power combinations exclude trailer, freight and rigging unless stated. This sheet is generated from the same catalogue that drives <a href="/build-and-price/">Build &amp; Price</a> and always matches it.</p>
</div>
</main>

<!--#include virtual="/footer.html" -->

</body>
</html>
HTML

  make_path("$root/pricesheets/$id");
  spew("$root/pricesheets/$id/index.html", $page);
  $n++;
}
print "wrote $n price sheet pages into pricesheets/<id>/\n";
print "now run: perl _build/inject_partials.pl\n";
