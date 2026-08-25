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
  Q-CFG-11
  Q-CFG-12
  Q-E-4
  AUD-TYPO-01
  AUD-TYPO-02
  Q-CFG-13
);
# ───────────────────────────────────────────────────────

my ($cfg, $out) = @ARGV; die "usage: gen_overlay.pl <configurator> <overlay-out>\n" unless $out;
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
#    The Garmin STRIKER stays undef ON PURPOSE. Stephen left it blank because
#    the open question is not the price, it is WHICH Striker model(s) we sell —
#    the line has several. NAMED 3 Aug 2026: Stephen confirmed it is the
#    STRIKER Vivid 7cv, so the name now says so (append form on purpose -
#    codeify() in gen_qb_import.pl truncates at 30 chars, so the QB leaf stays
#    GARMIN-STRIKER-GPS-FISHFINDER and the imported item is not orphaned).
#    The price stays undef: QB carries $999 but no website price has been
#    approved - written up for Stephen rather than decided here.
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
        nm=>'Garmin STRIKER GPS / Fishfinder (budget option), installed - STRIKER Vivid 7cv', price=>undef },
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
  { q => 'Q-CFG-11', t => 'Drifter Inboard 20ft retired -> 21/23/25 (Luke, doc 4). Stephen confirmed the 20ft hull price carries to the 21 — it is the same boat remeasured, not a bigger one',
    live => { catalogPatches => [ { m => 'ssdib', lenRename => { from => 20, to => 21 } } ] } },
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
for my $k (qw(radioCategories styleTags qtyMax qtyEnable excludes reqAdd lock241Add catalogPatches renameItems hideItems addItems catLimits addStyles)) {
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
