#!/usr/bin/perl
# Assembles tools/RULES_OVERLAY.js.
#
# Each rule block is keyed to a question in "9 - QUESTIONS FOR STEPHEN".
# Add a Q-id to %APPROVED and re-run: that block moves from the inert
# PROPOSED section into the LIVE keys the configurator applies at load.
use strict; use warnings;
use JSON::PP;

# ─────────── APPROVALS (Stephen, in session) ───────────
my %APPROVED = map { $_ => 1 } qw(
  Q-CFG-01
  Q-CFG-02
  Q-CFG-03
  Q-CFG-04
  Q-CFG-05
  Q-CFG-06
  Q-CFG-07
  Q-CFG-08
  Q-CFG-09
  Q-CFG-10
  Q-CFG-12
  Q-E-4
  AUD-TYPO-01
  AUD-TYPO-02
  Q-CFG-13
  CANON-2026-10-10-A
  CANON-2026-10-10-B
  CANON-2026-10-27
);
# ───────────────────────────────────────────────────────

# PRICES OF ADDED OPTIONS (Stephen 2026-10-14: "Workbook owns them"). The canon
# workbook is the one place an addItems price is set. The numbers typed in the
# blocks below are only the starting price of a brand-new item. Each addItems
# price is taken from, in order:
#   1. --prices <file>  a JSON object { item id => price or null }, written by
#      _build/gen_from_canon.pl from the canon OPTIONS tab;
#   2. the price the same item already carries in the overlay file being
#      replaced (so a re-run for a new rule never undoes a canon price);
#   3. the number typed here (new items only).
my $prices_file;
if (@ARGV >= 2 && $ARGV[0] eq '--prices') { (undef, $prices_file) = splice @ARGV, 0, 2 }
my ($cfg, $out) = @ARGV; die "usage: gen_rules_overlay.pl [--prices <json>] <configurator> <overlay-out>\n" unless $out;
open my $fh, '<:raw', $cfg or die $!;
my $l;
while (<$fh>) { if (/^\s*const MODELS = /) { $l = $_; last } }
close $fh;
$l =~ s/^\s*const MODELS = //; $l =~ s/;\s*$//;
my $models = decode_json($l);
my $J = JSON::PP->new->canonical;
my %multi = map { $_->{id} => 1 } grep { @{$_->{styles}} > 1 } @$models;

# ── style tags (name-readable only) ──
my %tags;
for my $m (@$models) {
  next unless $multi{$m->{id}};
  for my $c (@{$m->{cats}}) {
    for my $it (@{$c->{items}}) {
      next if exists $it->{style};
      my $nm = $it->{nm};
      next unless $nm =~ /windshield|console|tiller/i;
      next if $nm =~ /tiller kicker|kicker.*tiller/i;
      my $tag;
      if    ($nm =~ /windshield model or console with fixed windshield/i) { $tag = ['ws','occ'] }
      elsif ($nm =~ /windshield on console|on center console|center console up to|powder coating center console|locking doors? on center console|recessed on console/i) { $tag = 'occ' }
      elsif ($nm =~ /windshield model only|in bow of windshield|windshield and interior|^self-draining deck \(windshield/i) { $tag = 'ws' }
      else { next }
      my %have = map { $_->{id} => 1 } @{$m->{styles}};
      my @t = grep { $have{$_} } (ref $tag ? @$tag : ($tag));
      next unless @t;
      $tags{$it->{id}} = @t > 1 ? [@t] : $t[0];
    }
  }
}

# ── excludes: SeaDek vs non-slip powder floor; one urethane jet foot ──
my (%exclFloor, %exclFoot);
for my $m (@$models) {
  my (@seadek, @powder, @feet);
  for my $c (@{$m->{cats}}) {
    for my $it (@{$c->{items}}) {
      push @seadek, $it->{id} if $it->{nm} =~ /SeaDek/i  && $it->{nm} =~ /floor/i;
      push @powder, $it->{id} if $it->{nm} =~ /non-slip powder coating.*floor/i;
      push @feet,   $it->{id} if $it->{nm} =~ /urethane jet foot|urethane foot/i;
    }
  }
  for my $s (@seadek) { push @{$exclFloor{$s}}, @powder if @powder }
  for my $i (0..$#feet) { for my $j ($i+1..$#feet) { push @{$exclFoot{$feet[$i]}}, $feet[$j] } }
}
my %exclBoth = (%exclFloor);
for my $k (keys %exclFoot) { push @{$exclBoth{$k}}, @{$exclFoot{$k}} }

# ── Q-CFG-03: retire Bentley, extend the Airwave line to those 4 models ──
# Stephen: "no bentley stuff period. we offer the airwave ecosystem across all boats now"
# Prices are the SAME items' existing published prices on the other 14 models —
# continuity, not invention. Low-back 2099 / High-back 2249 / swivel-slide 349.
my (@hide, @add, %seatQty, %seatCap);
for my $m (@$models) {
  for my $c (@{$m->{cats}}) {
    next unless $c->{name} eq 'Seating';
    my $lastBentley;
    for my $it (@{$c->{items}}) {
      push @hide, $it->{id} if $it->{nm} =~ /Bentley/i;
      $lastBentley = $it->{id} if $it->{nm} =~ /Bentley/i;
      # every Airwave-base seat becomes steppable (Stephen: multiple instances possible)
      if ($it->{nm} =~ /Airwave suspension base/i && $it->{nm} !~ /Bentley/i) {
        push @{$seatQty{list}}, $it->{id} unless $it->{qty};
        $seatCap{ $it->{id} } = 6;
      }
    }
    next unless $lastBentley;   # this model carried Bentley — graft the Airwave line in
    my $anchor = $c->{items}[0]{id};
    for my $it (@{$c->{items}}) { $anchor = $it->{id} if $it->{nm} =~ /Leaning post/i }
    my $p = "$m->{id}_seating_airwave";
    push @add,
      { m=>$m->{id}, cat=>'Seating', id=>$p.'_low',  nm=>'Low-back upholstered helm-seat with Airwave suspension base',  price=>2099, qty=>1, after=>$anchor },
      { m=>$m->{id}, cat=>'Seating', id=>$p.'_high', nm=>'High-back upholstered helm-seat with Airwave suspension base', price=>2249, qty=>1, after=>$p.'_low' },
      { m=>$m->{id}, cat=>'Seating', id=>$p.'_sws',  nm=>'Swivel / slide for upholstered helm-seat, installed',          price=>349,  qty=>1, after=>$p.'_high' };
    $seatCap{$p.'_low'} = 6; $seatCap{$p.'_high'} = 6;
  }
}

# ── Q-CFG-04: generous caps. Global default is 12 (in the configurator);
#    these are the reviewer-named options that warrant something different.
my %caps = %seatCap;
for my $m (@$models) {
  for my $c (@{$m->{cats}}) {
    for my $it (@{$c->{items}}) {
      next unless $it->{qty};
      $caps{$it->{id}} = 8 if $it->{nm} =~ /^Additional 12V plug|^Additional dual USB/i;
      $caps{$it->{id}} = 6 if $it->{nm} =~ /cup holder/i;
    }
  }
}

# ── Q-CFG-05: the welded rigid frame requires a canvas top (CFG-R-17, Grant) ──
# Match the TOP itself, not anything with the word "top" in it. Every model's
# Canvas Top category has the same shape: one base canvas top ("Canvas and side
# curtains with 1" stainless steel bows...") plus a hard-top alternative
# ("Removable hard top with canvas front and sides"). The rest are modifiers
# (cruise curtain, add 8" to height, slant back, tonneau, zipper, wrap for
# shipping) and must NOT satisfy the requirement — an earlier loose /top/i match
# picked those and left the frame unselectable even with a real top chosen.
my %reqAdd;
for my $m (@$models) {
  my ($frame, @tops);
  for my $c (@{$m->{cats}}) {
    next unless $c->{name} eq 'Canvas Top';
    for my $it (@{$c->{items}}) {
      if ($it->{nm} =~ /rigid frame/i) { $frame = $it unless $it->{req}; next }
      push @tops, $it->{id} if $it->{nm} =~ /^Canvas and side curtains/i
                            || $it->{nm} =~ /hard top with canvas/i;
    }
  }
  next unless $frame && @tops;
  # req is OR-semantics in itemStatus(), so either top satisfies it
  $reqAdd{$frame->{id}} = { req => [@tops], reqLabel => 'Requires a canvas top' };
}

# ── Q-E-4: Christian's four new options (SOC-09..12) — all UNPRICED.
#    price => undef becomes null: the engine renders "Priced on request"
#    and routes the item to the inquiry list instead of the total.
#    Stephen (28 Jul): build them, flag that prices are still needed from
#    Christian before public launch. NEVER put a number here by hand —
#    when Christian prices them, the numbers replace the undefs below.
#    PRICED 29 Jul 2026 — three of the four came from Stephen directly, so the
#    undefs are replaced as intended rather than by hand-guessing:
#      maps    $299   folbejr $99   rodbase $49
#      RE-PRICED 3 Aug 2026 - maps cut $299 -> $199, Stephen's call on the 9c
#      sheet; QuickBooks already carried $199, this closes that gap.
#    The Garmin STRIKER was left unpriced on purpose. Stephen left it blank because
#    the open question is not the price, it is WHICH Striker model(s) we sell —
#    the line has several. NAMED 3 Aug 2026: Stephen confirmed it is the
#    STRIKER Vivid 7cv, so the name now says so (append form on purpose -
#    codeify() in gen_qb_import.pl truncates at 30 chars, so the QB leaf stays
#    GARMIN-STRIKER-GPS-FISHFINDER and the imported item is not orphaned).
#    PRICED 1 Sep 2026 - $999, APPROVED BY STEPHEN. Sourced from his own
#    2026-08-05 note off the 9c sheet, and QuickBooks already carried $999,
#    so this closes the last website-vs-QB gap on the line rather than
#    setting a new price. DO NOT ASK HIM ABOUT THIS NUMBER AGAIN - it had
#    been open for months and being re-asked is what he objected to.
#    Placement is name-readable, not invented: the two Garmin items join
#    every "Garmin Electronics" category; the Folbe Junior sits directly
#    under the full-size Folbe it is the junior of; extra bases join every
#    "Rod Holder" category. Rod items are quantity-steppable like their
#    neighbours.
my @qe4;
for my $m (@$models){
  my $p = "$m->{id}_qe4";
  if (grep { $_->{name} eq 'Garmin Electronics' } @{$m->{cats}}){
    push @qe4,
      { m=>$m->{id}, cat=>'Garmin Electronics', id=>$p.'_striker',
        nm=>'Garmin STRIKER GPS / Fishfinder (budget option), installed - STRIKER Vivid 7cv', price=>999 },
      { m=>$m->{id}, cat=>'Garmin Electronics', id=>$p.'_maps',
        nm=>'Non-US inland maps card for Garmin display', price=>199 };
  }
  my ($rodcat) = grep { $_->{name} eq 'Rod Holder' } @{$m->{cats}};
  if ($rodcat){
    my ($folbe) = grep { $_->{nm} =~ /^Folbe Advantage rod holder/ } @{$rodcat->{items}};
    push @qe4,
      { m=>$m->{id}, cat=>'Rod Holder', id=>$p.'_folbejr',
        nm=>'Folbe Advantage Junior rod holder - surface mount or rail mount, installed',
        price=>99, qty=>1, ($folbe ? (after=>$folbe->{id}) : ()) },
      { m=>$m->{id}, cat=>'Rod Holder', id=>$p.'_rodbase',
        nm=>'Additional rod holder base / socket, installed - mounting locations noted on the order',
        price=>49, qty=>1 };
  }
}

# ── AUD-TYPO-01: the price sheets publish the same Airwave products under
#    two spellings — "upholstered helm-seat" on some models, "upholstered
#    helm-seat seat" (doubled) on others. One product, one name: the clean
#    spelling wins. Derived, not typed: any catalogue item whose name
#    carries the doubling gets the de-doubled name. The Q-CFG-03 addItems
#    names are fixed at the source below.
my %renames;
for my $m (@$models){
  for my $c (@{$m->{cats}}){
    for my $it (@{$c->{items}}){
      next unless $it->{nm} =~ /helm-seat seat/;
      (my $fixed = $it->{nm}) =~ s/helm-seat seat/helm-seat/g;
      $renames{$it->{id}} = $fixed;
    }
  }
}

# ── AUD-TYPO-02: 8 of the 18 Triple-135Ah lithium items (the inboards) lost
#    the closing ')' of "(for 36v trolling motor applications)" in the SOC's
#    embedded catalog — seam 4 of the 2026-08-03 pipeline seam audit. The
#    configurator's copy is correct on all 18, so its build emails carry the
#    name WITH the ')' and the SOC's importer misses exactly those 8 lines
#    (2,261 of 2,269 names resolve). Derived, not typed: every catalogue item
#    carrying the phrase gets id -> canonical name emitted, appending the ')'
#    if the walked copy is ever bare. On the website these renames are
#    identity no-ops; the SOC applies renameItems by id at load, so its 8
#    bare names heal there. Names only — prices untouched.
my %renames36;
for my $m (@$models){
  for my $c (@{$m->{cats}}){
    for my $it (@{$c->{items}}){
      next unless $it->{nm} =~ /\(for 36v trolling motor applications\)?$/;
      my $fixed = $it->{nm};
      $fixed .= ')' unless $fixed =~ /\)$/;
      $renames36{$it->{id}} = $fixed;
    }
  }
}

# ── CANON-2026-10-10-A / -B: Stephen's two rulings of 2026-10-10 (PRICING CANON
#    README, CHANGE LOG entry of that date). Canon changed FIRST; this makes the
#    configurator follow it. No price moves.
#    A. "Heater/defroster with circulation pump" ($1,999, Rigging) is renamed
#       "Inboard heater/defroster" on every INBOARD that carries it (xlib scout
#       scoutwb skagitib sportib ssdib skagitx). The new wording is what the
#       QuickBooks item was hand-edited to, so canon, the assemblies and the
#       website now all say the same thing; codeify() makes
#       ^OPTIONS:^RIGGING:^INBOARD-HEATER-DEFROSTER of it.
#    B. The Sportster (an outboard jet) no longer offers that heater, nor the
#       marine-treated plywood floors. hideItems removes both outright
#       (sportster_rigging_6_65, sportster_floor_1_7). The 14 inboard plywood
#       options are untouched.
#    Derived, not typed: every catalogue item carrying the old heater name is
#    walked - on the Sportster it is hidden, everywhere else renamed - and the
#    plywood item is found by name on the Sportster only. The expected ids are
#    ASSERTED below so a regenerated catalogue that drifts dies here instead of
#    silently renaming or hiding the wrong thing.
my $HEATER_OLD = 'Heater/defroster with circulation pump';
my $HEATER_NEW = 'Inboard heater/defroster';
my (%heaterRename, @sportsterHide);
for my $m (@$models){
  for my $c (@{$m->{cats}}){
    for my $it (@{$c->{items}}){
      if ($it->{nm} eq $HEATER_OLD){
        if ($m->{id} eq 'sportster') { push @sportsterHide, $it->{id} }
        else                         { $heaterRename{$it->{id}} = $HEATER_NEW }
      }
      if ($m->{id} eq 'sportster' && $it->{nm} =~ /^Marine treated plywood floors/i){
        push @sportsterHide, $it->{id};
      }
    }
  }
}
{
  my @wantRename = qw(xlib_rigging_6_63 scout_rigging_6_67 scoutwb_rigging_6_64
                      skagitib_rigging_6_66 sportib_rigging_6_65 ssdib_rigging_7_66
                      skagitx_rigging_6_65);
  my @wantHide   = qw(sportster_rigging_6_65 sportster_floor_1_7);
  my $got  = join(',', sort keys %heaterRename);
  my $want = join(',', sort @wantRename);
  die "CANON-2026-10-10-A: heater rename set drifted\n  got  $got\n  want $want\n" unless $got eq $want;
  $got  = join(',', sort @sportsterHide);
  $want = join(',', sort @wantHide);
  die "CANON-2026-10-10-B: Sportster hide set drifted\n  got  $got\n  want $want\n" unless $got eq $want;
}

# ── CANON-2026-10-13: Q-CFG-11 RETIRED. The Super Sport Drifter Inboard's
#    shortest hull is 21 ft in the RAW catalogue now (Stephen, 2026-10-13:
#    "21 ft; fix the configurator and fact row"). The lenRename 20->21 patch that
#    used to do it at load time (Q-CFG-11, Luke doc 4; the 20 ft hull price
#    carried to the 21 unchanged - canon BOATS.csv SSDIB-21-WS is the same
#    129,999) is gone: lengths, hulls, hullNotes, engines, the seven per-length
#    option prices and the tag were re-keyed in const MODELS itself (count-
#    guarded, proven equal to lenRename's result). ASSERTED here so a
#    regenerated catalogue that brings the 20 back dies instead of silently
#    selling a 20 ft hull again. Do NOT re-add the patch - fix the catalogue.
{
  my ($ssdib) = grep { $_->{id} eq 'ssdib' } @$models;
  die "CANON-2026-10-13: no ssdib model in the catalogue\n" unless $ssdib;
  my $lens = join(',', @{$ssdib->{lengths}});
  die "CANON-2026-10-13: ssdib lengths are [$lens], expected 21,23,25 - the raw catalogue regressed to the 20 ft hull\n" unless $lens eq '21,23,25';
  for my $s (@{$ssdib->{styles}}) {
    for my $k (qw(hulls hullNotes)) { die "CANON-2026-10-13: ssdib style $s->{id} $k still keyed on 20\n" if $s->{$k} && exists $s->{$k}{20} }
  }
  die "CANON-2026-10-13: ssdib engines still keyed on 20\n" if grep { /20$/ } keys %{$ssdib->{engines}};
  for my $c (@{$ssdib->{cats}}) { for my $it (@{$c->{items}}) {
    die "CANON-2026-10-13: ssdib option $it->{id} still priced under key 20\n" if ref $it->{price} eq 'HASH' && exists $it->{price}{20};
  } }
  die "CANON-2026-10-13: ssdib tag still advertises 20 ft ($ssdib->{tag})\n" if ($ssdib->{tag} || '') =~ /\b20\b/;
}

# ── CANON-2026-10-27: the "Add 6" to width of bench-seat box" option ($49, Scout
#    Inboard and Scout Widebody Inboard) stays in QuickBooks and stays orderable in
#    the Sales Order Creator, but leaves the PUBLIC configurator and the PUBLIC
#    price sheets (Stephen, 2026-10-27, the launch-eve removals pass). hideItems
#    cannot express that - the SOC honours it too - so this is a separate key,
#    publicHide, read by build-and-price/index.html, _build/gen_pricesheets.pl
#    and PRICE SHEETS/_PIPELINE/WBSheet.pm only. The canon OPTIONS rows are
#    untouched (the canon command's enumeration ignores this key on purpose).
#    Derived by NAME on the two Scouts and ASSERTED, like the 10-10 blocks.
my @publicHide;
for my $m (@$models){
  next unless $m->{id} eq 'scout' || $m->{id} eq 'scoutwb';
  for my $c (@{$m->{cats}}){ for my $it (@{$c->{items}}){
    push @publicHide, $it->{id} if $it->{nm} =~ /^Add 6\x{201d} to width of bench-seat box/;
  } }
}
{
  my $got  = join(',', sort @publicHide);
  my $want = join(',', sort qw(scout_seating_4_31 scoutwb_seating_4_30));
  die "CANON-2026-10-27: bench-seat publicHide set drifted\n  got  $got\n  want $want\n" unless $got eq $want;
}

# ── blocks, each keyed to its question ──
my @BLOCKS = (
  { q => 'AUD-TYPO-01', t => 'de-double "helm-seat seat" -> "helm-seat" (the clean spelling the other price sheets use for the same product)',
    live => { renameItems => \%renames } },
  { q => 'AUD-TYPO-02', t => 'close the truncated "(for 36v trolling motor applications" names — 8 SOC copies lost the paren and the email importer missed those lines (pipeline seam audit 2026-08-03, seam 4)',
    live => { renameItems => \%renames36 } },
  { q => 'Q-CFG-01', t => 'the 51 name-readable style tags (CFG-R-18)',
    live => { styleTags => \%tags } },
  { q => 'Q-CFG-02', t => 'SeaDek <-> non-slip powder floor (CFG-R-11/SOC-03) + one urethane jet foot per boat (CFG-R-08)',
    live => { excludes => \%exclBoth } },
  { q => 'Q-CFG-03', t => 'retire all Bentley seating, extend the Airwave line to Sport/SSD/SO/SSO, seats steppable to 6 (Stephen)',
    live => { hideItems => \@hide, addItems => \@add, qtyEnable => ($seatQty{list} || []) } },
  { q => 'Q-CFG-04', t => 'generous quantity caps: global default 12, 12V/USB 8, cup holders 6, Airwave seats 6 (Stephen)',
    live => { qtyMax => \%caps } },
  { q => 'Q-CFG-05', t => 'welded rigid frame requires a canvas top (CFG-R-17, Grant)',
    live => { reqAdd => \%reqAdd } },
  { q => 'Q-CFG-06', t => 'single-choice helm seat; swivels/slides/pedestals/box pairs/leaning post stay independent (CFG-R-10)',
    live => { radioCategories => [ { name => 'Seating', nonRadioPattern => 'swivel|slide|pedestal base|bracket|width of bench|pair upholstered|leaning post' } ] } },
  { q => 'Q-CFG-08', t => 'at most 3 Garmin displays per boat (CFG-R-12) — Stephen: "make it 3 max". A quantity cap could not express this: every Garmin row is a plain checkbox, so the customer was picking many DIFFERENT displays',
    live => { catLimits => [ { cat => 'Garmin Electronics', match => '^ECHOMAP', max => 3, label => 'MAX 3 DISPLAYS' } ] } },
  { q => 'Q-CFG-07', t => 'at most 2 starting batteries (CFG-R-13) — Stephen: cap it sensibly rather than force pick-one; chargers, tender, ACR, converter and lithium trolling banks are NOT counted',
    live => { catLimits => [ { cat => 'Battery System', match => '(group 2[47]|MCA starting)', max => 2, label => 'MAX 2 STARTING BATTERIES' } ] } },
  { q => 'Q-CFG-09', t => 'single-choice kicker motor; brackets/tie-bar/bay kit/autopilot stay independent (CFG-R-09)',
    live => { radioCategories => [ { name => 'Kicker Installation', nonRadioPattern => 'bracket|tie-bar|bay kit|autopilot' } ] } },
  { q => 'Q-CFG-10', t => 'display names: Inboard suffixes (CFG-M-05) + Scout Widebody style title (CFG-M-10)',
    live => { catalogPatches => [
      { m => 'scout',   prop => 'nm', v => 'Scout Inboard' },
      { m => 'scoutwb', prop => 'nm', v => 'Scout Widebody Inboard' },
      { m => 'skagitx', prop => 'nm', v => 'Skagit-X Inboard' },
      { m => 'scoutwb', styleId => 'ws', prop => 'nm', v => 'Cabin with Idaho deck' },
    ] } },
  # Q-CFG-11 ('Drifter Inboard 20ft retired -> 21/23/25', lenRename 20->21) was
  # RETIRED 2026-10-13: the raw catalogue now says 21 (see CANON-2026-10-13 above).
  { q => q{Q-E-4}, t => q{Christian: Garmin Striker budget option, non-US maps, Folbe Advantage Junior, extra rod holder bases w/ location note (SOC-09..12) - built UNPRICED, "Priced on request" until Stephen has numbers from Christian},
    live => { addItems => \@qe4 } },
  { q => 'Q-CFG-12', t => 'Center Console hull style on the five inboards that lack it (CFG-M-08) — priced identically to the windshield hull, which is Grant\'s own stated rule',
    live => { addStyles => [
      map { { m => $_, id => 'occ', nm => 'Center Console', copyHullsFrom => 'ws' } }
        qw(xlib scout skagitib sportib ssdib)
    ] } },
  { q => 'Q-CFG-13', t => q{Console powder coat is a center-console option only. Stephen (24 Aug 2026): "if a boat has a windshield, it will never need the option for powder coating of a center console." Tags the five ids the name-tagger missed: four models whose console style is overlay-added by Q-CFG-12 (the tagger saw them as single-style and skipped them) plus skagitx.},
    live => { styleTags => { map { ($_ . '_powdercoat_0_1' => 'occ') }
        qw(xlib skagitib sportib ssdib skagitx)
    } } },
  { q => 'CANON-2026-10-10-A', t => q{"Heater/defroster with circulation pump" -> "Inboard heater/defroster" on the 7 inboards (Stephen, 2026-10-10, PRICING CANON change log). Name only; $1,999 unchanged; QB code becomes ^OPTIONS:^RIGGING:^INBOARD-HEATER-DEFROSTER},
    live => { renameItems => \%heaterRename } },
  { q => 'CANON-2026-10-10-B', t => q{Sportster (outboard jet) no longer offers the circulation-pump heater or the marine-treated plywood floors (Stephen, 2026-10-10, PRICING CANON change log); the 14 inboard plywood options stay},
    live => { hideItems => \@sportsterHide } },
  { q => 'CANON-2026-10-27', t => q{"Add 6" to width of bench-seat box" ($49) stays in QuickBooks and the Sales Order Creator but leaves the public configurator and price sheets (Stephen, 2026-10-27); canon rows untouched},
    live => { publicHide => \@publicHide } },
);

# ── merge approved blocks into the live keys ──
my %LIVE = (
  radioCategories => ['Steering'],   # pre-existing behaviour, was hard-coded before this file
  renameItems     => {},
  styleTags       => {},
  qtyMax          => {},
  qtyEnable       => [],
  excludes        => {},
  reqAdd          => {},
  lock241Add      => [],
  catalogPatches  => [],
  hideItems       => [],
  publicHide      => [],
  addItems        => [],
  catLimits       => [],
);
my @applied;
for my $b (@BLOCKS) {
  next unless $APPROVED{$b->{q}};
  push @applied, $b->{q};
  for my $k (keys %{$b->{live}}) {
    my $v = $b->{live}{$k};
    if (ref $v eq 'HASH')  { $LIVE{$k}{$_} = $v->{$_} for keys %$v }
    elsif (ref $v eq 'ARRAY') { push @{$LIVE{$k}}, @$v }
  }
}

# ── addItems prices: canon first, then the overlay being replaced, then the typed number ──
{
  my %canon;
  if (defined $prices_file) {
    open my $pf, '<:raw', $prices_file or die "cannot read --prices $prices_file: $!\n";
    local $/; %canon = %{ decode_json(<$pf>) }; close $pf;
  }
  my %prev;
  if (-f $out) {
    open my $pf, '<:raw', $out or die "cannot read $out: $!\n";
    local $/; my $t = <$pf>; close $pf;
    if ($t =~ /^\s*addItems:\s*(\[.*?\]),\r?$/m) { $prev{ $_->{id} } = [ $_->{price} ] for @{ decode_json($1) } }
  }
  my %src;
  for my $a (@{ $LIVE{addItems} }) {
    if    (exists $canon{ $a->{id} }) { $a->{price} = $canon{ $a->{id} }; $src{canon}++ }
    elsif ($prev{ $a->{id} })         { $a->{price} = $prev{ $a->{id} }[0]; $src{'previous overlay'}++ }
    else                              { $src{'typed in this script (new item)'}++ }
  }
  my @unknown = grep { my $id = $_; !grep { $_->{id} eq $id } @{ $LIVE{addItems} } } sort keys %canon;
  die "--prices names options that are not overlay-added: @unknown\n" if @unknown;
  printf "  addItems prices: %s\n", join(', ', map { "$src{$_} from $_" } sort keys %src) if %src;
}

open my $o, '>:encoding(UTF-8)', $out or die $!;
print $o <<'HEAD';
/* ════════════════════════════════════════════════════════════════════
   RULES OVERLAY — Build & Price Configurator
   ════════════════════════════════════════════════════════════════════
   Option-compatibility data, kept out of the generated catalog on
   purpose: const MODELS (and the copy in SALES ORDER CREATOR.html) is
   regenerated from the price sheets — anything written into that blob
   is wiped on the next regeneration. This file is merged at load and
   survives.

   GENERATED by _build/gen_rules_overlay.pl — approvals are recorded in
   that script's %APPROVED list. Do not hand-edit; re-run instead.

   The top-level keys are LIVE. Everything under PROPOSED is INERT and
   keyed to a question in "9 - QUESTIONS FOR STEPHEN". Nothing here was
   guessed: every entry traces to a reviewer statement, an option's own
   name, or a decision in the decisions log.
   ════════════════════════════════════════════════════════════════════ */
HEAD
printf $o "/* APPROVED AND LIVE: %s */\n", (@applied ? join(', ', @applied) : 'none yet');
print  $o "const RULES_OVERLAY = {\n";
print  $o "  /* ─────────── LIVE — applied at load ─────────── */\n";
for my $k (qw(radioCategories styleTags qtyMax qtyEnable excludes reqAdd lock241Add catalogPatches renameItems hideItems publicHide addItems catLimits addStyles)) {
  printf $o "  %s: %s,\n", $k, $J->encode($LIVE{$k});
}
print $o "\n  /* ─────────── PROPOSED — inert until approved ─────────── */\n  PROPOSED: {\n";
for my $b (@BLOCKS) {
  next if $APPROVED{$b->{q}};
  printf $o "    /* %s — %s */\n    '%s': %s,\n\n", $b->{q}, $b->{t}, $b->{q}, $J->encode($b->{live});
}
print $o "  }\n};\n";
close $o;

printf "wrote %s\n  live: %s\n  proposed: %d blocks\n", $out,
  (@applied ? join(', ', @applied) : 'none'),
  scalar(grep { !$APPROVED{$_->{q}} } @BLOCKS);
printf "  styleTags=%d  excludePairs=%d  reqAdd=%d\n",
  scalar(keys %{$LIVE{styleTags}}), scalar(keys %{$LIVE{excludes}}), scalar(keys %{$LIVE{reqAdd}});
