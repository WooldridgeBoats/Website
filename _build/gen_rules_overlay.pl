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

# ── canvas rigid frame requires a canvas top ──
my %reqAdd;
for my $m (@$models) {
  my ($frame, @canvas);
  for my $c (@{$m->{cats}}) {
    for my $it (@{$c->{items}}) {
      $frame = $it if $it->{nm} =~ /rigid frame/i && !$it->{req};
      push @canvas, $it->{id} if $c->{name} eq 'Canvas Top' && $it->{nm} =~ /top/i && $it->{nm} !~ /rigid frame/i;
    }
  }
  $reqAdd{$frame->{id}} = { req => [@canvas], reqLabel => 'Requires a canvas top' } if $frame && @canvas;
}

# ── blocks, each keyed to its question ──
my @BLOCKS = (
  { q => 'Q-CFG-01', t => 'the 51 name-readable style tags (CFG-R-18)',
    live => { styleTags => \%tags } },
  { q => 'Q-CFG-02', t => 'SeaDek <-> non-slip powder floor (CFG-R-11/SOC-03) + one urethane jet foot per boat (CFG-R-08)',
    live => { excludes => \%exclBoth } },
  { q => 'Q-CFG-05', t => 'welded rigid frame requires a canvas top (CFG-R-17, Grant)',
    live => { reqAdd => \%reqAdd } },
  { q => 'Q-CFG-06', t => 'single-choice helm seat; swivels/slides/pedestals/box pairs/leaning post stay independent (CFG-R-10)',
    live => { radioCategories => [ { name => 'Seating', nonRadioPattern => 'swivel|slide|pedestal base|bracket|width of bench|pair upholstered|leaning post' } ] } },
  { q => 'Q-CFG-07', t => 'single-choice starting battery; chargers/tender/ACR/converter/trolling banks stay independent (CFG-R-13)',
    live => { radioCategories => [ { name => 'Battery System', nonRadioPattern => 'charger|tender|ACR|converter|trolling|forward upcharge' } ] } },
  { q => 'Q-CFG-08', t => 'single-choice Garmin display; NMEA backbone stays independent (CFG-R-12) — CAUTION: blocks two-display boats',
    live => { radioCategories => [ { name => 'Garmin Electronics', nonRadioPattern => 'NMEA' } ] } },
  { q => 'Q-CFG-09', t => 'single-choice kicker motor; brackets/tie-bar/bay kit/autopilot stay independent (CFG-R-09)',
    live => { radioCategories => [ { name => 'Kicker Installation', nonRadioPattern => 'bracket|tie-bar|bay kit|autopilot' } ] } },
  { q => 'Q-CFG-10', t => 'display names: Inboard suffixes (CFG-M-05) + Scout Widebody style title (CFG-M-10)',
    live => { catalogPatches => [
      { m => 'scout',   prop => 'nm', v => 'Scout Inboard' },
      { m => 'scoutwb', prop => 'nm', v => 'Scout Widebody Inboard' },
      { m => 'skagitx', prop => 'nm', v => 'Skagit-X Inboard' },
      { m => 'scoutwb', styleId => 'ws', prop => 'nm', v => 'Cabin with Idaho deck' },
    ] } },
  { q => 'Q-CFG-11', t => 'Drifter Inboard 20ft retired -> 21/23/25 (doc 4; 20ft hull price carries to the 21 pending confirmation)',
    live => { catalogPatches => [ { m => 'ssdib', lenRename => { from => 20, to => 21 } } ] } },
);

# ── merge approved blocks into the live keys ──
my %LIVE = (
  radioCategories => ['Steering'],   # pre-existing behaviour, was hard-coded before this file
  styleTags       => {},
  qtyMax          => {},
  qtyEnable       => [],
  excludes        => {},
  reqAdd          => {},
  lock241Add      => [],
  catalogPatches  => [],
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

   GENERATED by scratchpad/gen_overlay.pl — approvals are recorded in
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
for my $k (qw(radioCategories styleTags qtyMax qtyEnable excludes reqAdd lock241Add catalogPatches)) {
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
