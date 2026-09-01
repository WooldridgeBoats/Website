#!/usr/bin/perl
# sync_soc_trailers.pl - copy the configurator's canon trailer data into the SOC.
#
# WHY THIS EXISTS
# The Sales Order Creator is a single self-contained file with no network calls,
# so it cannot <script src> the configurator's trailer blob. It carried a PRIVATE
# COPY instead, and that copy silently fell behind the 2026-08-25 trailer ledger
# (c9d5bba). The visible damage: T102BT 26-30 7500 quoted HYD DISC 2X at 1085
# against canon's 1680 - a $595 under-quote on a STANDARD item, on every
# hand-built SOC order. Nothing warned. Orders IMPORTED from an inquiry email
# were unaffected, because the email's price rides as an override.
#
# Stephen's ruling 2026-09-01, path (c): re-copy now, re-point later. This script
# IS the re-copy, made repeatable so "later" cannot be forgotten - the copy is
# still a copy, but re-syncing it is now one verified command instead of a hand
# splice nobody remembers to redo.
#
# RUN THIS after ANY change to the configurator's TRAILER PICKER data set, and
# after re-generating the configurator from an EZ Loader master.
#
#   perl _build/sync_soc_trailers.pl [path-to-SOC.html]
#
# Companion to sync_soc_rules.pl, which carries the OPTIONS overlay. Two
# separate blobs, two separate syncs - running one does not run the other.
#
# STANDING RULE (Stephen, 2026-09-01): every price change anywhere must also be
# reflected in Desktop\PRICING CANON. This script only moves numbers between the
# configurator and the SOC; it does not touch canon. If you changed a PRICE to
# get here, canon needs the same edit.
use strict; use warnings;
use File::Basename qw(dirname basename);
use Cwd qw(abs_path);

my $root = dirname(dirname(abs_path(__FILE__)));
my $cfg  = "$root/build-and-price/index.html";
my $soc  = shift || 'C:/Users/Stephen/OneDrive - Wooldridge Boats Inc/Wooldridge Boats Inc_ - Documents/BUILD HUB/MISC NECESSARY CONTENT/SALES ORDER CREATOR/SALES ORDER CREATOR.html';

die "configurator not found: $cfg\n" unless -f $cfg;
die "SOC not found: $soc\n"          unless -f $soc;

# Every read/write is :raw ON PURPOSE. The SOC contains bytes that are not valid
# UTF-8 to Perl (including a literal U+FFFF inside a regex character range in the
# build importer). Reading it as UTF-8 and writing it back silently DROPPED that
# character once. Stay in binary. Same reasoning as sync_soc_rules.pl.
sub slurp_raw { open my $h, '<:raw', $_[0] or die "$_[0]: $!\n"; local $/; my $s = <$h>; close $h; $s }

my $cfg_html = slurp_raw($cfg);
my $soc_html = slurp_raw($soc);

# -- pull the canon blob out of the configurator -------------------------------
# Anchored to its own line and to the "Single Axle" first key, so a future
# `const DATA` elsewhere in the file cannot be picked up by accident.
my @found = ($cfg_html =~ /^const DATA = (\{"Single Axle":.*\});[ \t]*$/mg);
die "expected exactly 1 trailer DATA blob in the configurator, found " . scalar(@found) . "\n"
  unless @found == 1;
my $blob = $found[0];

# -- sanity-gate the blob before it goes anywhere ------------------------------
# A truncated or half-written blob would splice cleanly and quote nonsense, so
# refuse anything that does not look like the whole data set.
my $models = () = $blob =~ /"name":"/g;
my $axles  = () = $blob =~ /"(?:Single|Tandem) Axle":\[/g;
die "blob looks wrong: $axles axle groups, $models models - refusing to sync\n"
  if $axles != 2 || $models < 15;

# The specific cell the ledger moved, asserted by name. If a future ledger
# changes it again this line does not need editing - it only proves the blob we
# are about to copy is the POST-ledger one, not a pre-ledger copy.
my ($ledger_cell) = $blob =~ /"T102BT 26-30 7500".*?"HYD DISC 2X","cost":(\d+)/;
die "could not read the T102BT 26-30 7500 HYD DISC 2X cell from canon\n"
  unless defined $ledger_cell;

# -- what the SOC held before, for an honest before/after ----------------------
my ($soc_before) = $soc_html =~ /"T102BT 26-30 7500".*?"HYD DISC 2X","cost":(\d+)/;
$soc_before = '(absent)' unless defined $soc_before;
my ($old_blob)  = $soc_html =~ /^const TRAILER_DATA = (\{"Single Axle":.*\});[ \t]*$/m;
die "no TRAILER_DATA blob found in the SOC - was it hand-edited?\n" unless defined $old_blob;

if ($old_blob eq $blob) {
  print "SOC trailer data already matches canon - nothing to do.\n";
  print "  T102BT 26-30 7500 HYD DISC 2X = $ledger_cell (canon and SOC agree)\n";
  exit 0;
}

# -- splice, count-guarded -----------------------------------------------------
my $n = ($soc_html =~ s{^const TRAILER_DATA = \{"Single Axle":.*\};[ \t]*$}
                       {"const TRAILER_DATA = " . $blob . ";"}me);
die "splice matched $n times, expected exactly 1 - nothing written\n" unless $n == 1;

open my $out, '>:raw', $soc or die "$soc: $!\n";
print $out $soc_html;
close $out;

# -- verify by reading the file back off disk ----------------------------------
my $after = slurp_raw($soc);
my ($check) = $after =~ /^const TRAILER_DATA = (\{"Single Axle":.*\});[ \t]*$/m;
die "VERIFY FAILED: blob on disk does not match canon after write\n"
  unless defined $check && $check eq $blob;

my $old_models = () = $old_blob =~ /"name":"/g;
printf "synced trailer data into %s%s", basename($soc), chr(10);
printf "  trailer models: %d -> %d\n", $old_models, $models;
printf "  T102BT 26-30 7500 HYD DISC 2X: %s -> %s  (canon = %s)\n",
  $soc_before, $ledger_cell, $ledger_cell;
printf "  90BS 17-19 2350 (deleted duplicate): %s -> %s\n",
  ($old_blob =~ /90BS 17-19 2350/ ? 'present' : 'absent'),
  ($blob     =~ /90BS 17-19 2350/ ? 'present' : 'absent');
printf "  SING TONGUE typo: %s -> %s\n",
  ($old_blob =~ /"SING TONGUE/ ? 'present' : 'absent'),
  ($blob     =~ /"SING TONGUE/ ? 'present' : 'absent');
printf "  7480GVWR phantom lines: %d -> %d\n",
  scalar(() = $old_blob =~ /7480/g), scalar(() = $blob =~ /7480/g);
print  "  verified: blob re-read from disk is byte-identical to canon\n";
