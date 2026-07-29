#!/usr/bin/perl
# sync_soc_rules.pl — copy the approved rules overlay into the Sales Order Creator.
#
# The SOC is a single self-contained file with no network calls, so it cannot
# <script src> the website's tools/RULES_OVERLAY.js. This script inlines the
# overlay's data between the WB-RULES-OVERLAY markers in the SOC.
#
# RUN THIS after every rule approval (i.e. after _build/gen_rules_overlay.pl),
# or the sales floor and the customer configurator will disagree.
#
#   perl _build/sync_soc_rules.pl [path-to-SOC.html]
#
# Default target is the dated staging copy, NOT the live file — swapping the
# staging copy in is Stephen's call.
use strict; use warnings;
use File::Basename qw(dirname);
use Cwd qw(abs_path);

my $root    = dirname(dirname(abs_path(__FILE__)));
my $overlay = "$root/tools/RULES_OVERLAY.js";
my $soc     = shift || 'C:/Users/Stephen/OneDrive - Wooldridge Boats Inc/Wooldridge Boats Inc_ - Documents/BUILD HUB/MISC NECESSARY CONTENT/SALES ORDER CREATOR/SALES ORDER CREATOR (staging 2026-07-29).html';

die "overlay not found: $overlay\n" unless -f $overlay;
die "SOC not found: $soc\n"        unless -f $soc;

# NOTE: every read/write here is :raw on purpose. The SOC contains bytes that
# are not valid UTF-8 text to Perl (including a literal U+FFFF used inside a
# regex character range in the build importer). Reading it as UTF-8 and writing
# it back silently DROPPED that character, which turned
#   /[^\x20-\x7E\r\n -\x{FFFF}]+/  into  /[^\x20-\x7E\r\n -]+/
# — a valid regex with different meaning that would have stripped the curly
# quotes and em-dashes out of every imported option name. Stay in binary.

# ── pull the live object out of RULES_OVERLAY.js, dropping the PROPOSED block ──
open my $oh, '<:raw', $overlay or die $!;
local $/;
my $ov = <$oh>;
close $oh;

my %live;
for my $k (qw(radioCategories styleTags qtyMax qtyEnable excludes reqAdd lock241Add catalogPatches hideItems addItems catLimits)) {
  if ($ov =~ /^  \Q$k\E: (.*),$/m) { $live{$k} = $1 }
  else { $live{$k} = ($k =~ /^(radioCategories|qtyEnable|lock241Add|catalogPatches|hideItems|addItems|catLimits)$/) ? '[]' : '{}' }
}
my $json = '{' . join(',', map { "\"$_\":$live{$_}" } qw(radioCategories styleTags qtyMax qtyEnable excludes reqAdd lock241Add catalogPatches hideItems addItems catLimits)) . '}';

# ── splice it into the SOC between the markers ──
open my $sh, '<:raw', $soc or die $!;
my $html = <$sh>;
close $sh;

my $decl = "const RULES_OVERLAY = $json;";
my $n = ($html =~ s{(WB-RULES-OVERLAY:BEGIN.*?\*/\n)const RULES_OVERLAY = .*?;\n}{$1$decl\n}s);
die "marker block not found in the SOC — was it hand-edited?\n" unless $n;

open my $out, '>:raw', $soc or die $!;
print $out $html;
close $out;

printf "synced rules into %s\n", ($soc =~ m{([^/\\]+)$})[0];
printf "  styleTags=%d  excludes=%d  hideItems=%d  addItems=%d  qtyMax=%d\n",
  scalar(() = $live{styleTags}  =~ /"[a-z0-9_]+":/g),
  scalar(() = $live{excludes}   =~ /"[a-z0-9_]+":\[/g),
  scalar(() = $live{hideItems}  =~ /"/g) / 2,
  scalar(() = $live{addItems}   =~ /"id":/g),
  scalar(() = $live{qtyMax}     =~ /"[a-z0-9_]+":/g);
