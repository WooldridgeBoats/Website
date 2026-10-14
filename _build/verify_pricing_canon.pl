#!/usr/bin/perl
# verify_pricing_canon.pl - is the website in step with the PRICING canon?
#
# READ-ONLY. Run it on command; it is never scheduled. It reads the pricing tabs
# straight from the canon workbook and checks every price surface it can reach,
# one line per surface, then PASS or FAIL (exit 1 on any FAIL).
#
# Core Perl only; runs on macOS system perl and on Git for Windows perl.
#
#   perl _build/verify_pricing_canon.pl --xlsx <CANON>/WB\ PRICING\ CANON.xlsx [--repo <Website folder>]
#   options: --mirrors <folder>    the CSV MIRRORS folder        (default: beside the workbook)
#            --soc <file>          WB CANON SOC.json             (default: beside the workbook)
#            --pipeline <folder>   PRICE SHEETS\_PIPELINE        (default: found from the workbook's
#                                  library, skipped when it is not there, e.g. on a Mac without it)
#            --no-mirrors          skip the mirror and SOC-file rows (the generator uses this
#                                  before it has written them)
#            --quiet               table only
#
# Surfaces checked: the configurator's hull / engine / option / adder prices
# (const MODELS with tools/RULES_OVERLAY.js applied), the trailer picker
# (const DATA), the Center Console twins (Grant's rule Q-CFG-12), the workbook's
# own arithmetic (option units, trailer as-stocked totals), the "from" prices on
# the home page, quiz, quote and compare pages, the CSV mirrors, the Sales Order
# Creator file and the trailer shop add-ons the price sheets print.
# The generator (_build/gen_from_canon.pl) runs these same checks on every run.
use strict;
use warnings;
use File::Basename qw(dirname);
use Cwd qw(abs_path);
use Getopt::Long;
use lib dirname(abs_path(__FILE__));
use WBSpecCanon qw(read_xlsx_tabs);
use WBPriceCanon qw(verify_pricing);
binmode STDOUT, ':encoding(UTF-8)';
binmode STDERR, ':encoding(UTF-8)';

my ($xlsx, $repo, $mirrors, $soc, $pipeline, $nomir, $quiet);
GetOptions('xlsx=s' => \$xlsx, 'repo=s' => \$repo, 'mirrors=s' => \$mirrors, 'soc=s' => \$soc,
           'pipeline=s' => \$pipeline, 'no-mirrors' => \$nomir, 'quiet' => \$quiet) or die "see the header of $0 for usage\n";
die "--xlsx <the canon workbook> is required\n" unless defined $xlsx && -f $xlsx;
$repo = dirname(dirname(abs_path(__FILE__))) unless defined $repo;
$repo =~ s{[\\/]+$}{};
my $canon = dirname(abs_path($xlsx));
$mirrors  = "$canon/CSV MIRRORS"      unless defined $mirrors;
$soc      = "$canon/WB CANON SOC.json" unless defined $soc;
unless (defined $pipeline) { my $p = dirname($canon) . '/60 SALES AND DEALERS/PRICE SHEETS/_PIPELINE'; $pipeline = $p if -d $p }

my ($rows, $R) = verify_pricing(repo => $repo, tabs => read_xlsx_tabs($xlsx, { dates => 1 }),
  ($nomir ? () : (mirrors => $mirrors, soc_file => $soc)), (defined $pipeline ? (pipeline => $pipeline) : ()));
push @$rows, ['trailer shop add-ons (price sheets)', 'SKIP', 'PRICE SHEETS\_PIPELINE not reachable from here'] unless defined $pipeline;

my $w = 0; for (@$rows) { $w = length $_->[0] if length $_->[0] > $w }
printf "%-*s  %-4s  %s\n", $w, $_->[0], $_->[1], $_->[2] for @$rows;
my $fail = grep { $_->[1] eq 'FAIL' } @$rows;
unless ($quiet) {
  my $show = sub { my ($title, $list) = @_; return unless @$list; print "\n$title (" . scalar(@$list) . "):\n"; print "  $_\n" for @$list[0 .. ($#$list < 39 ? $#$list : 39)]; print "  ... and " . (@$list - 40) . " more\n" if @$list > 40 };
  $show->('PRICES THAT DIFFER (workbook -> site)', [ map { "$_->{tab} $_->{key}: workbook " . ($_->{canon} eq '' ? '(blank)' : $_->{canon}) . ", site " . ($_->{site} eq '' ? '(on request)' : $_->{site}) } @{ $R->{price} } ]);
  $show->('NOT WIRED YET (only prices are driven from the workbook today)', [ map { "$_->{tab} $_->{key}: $_->{msg}" } @{ $R->{other} } ]);
  $show->('CENTER CONSOLE TWINS', $R->{link});
  $show->('WORKBOOK ARITHMETIC', $R->{math});
}
print "\n", ($fail ? "FAIL - $fail surface(s) out of step with the pricing canon\n" : "PASS - every reachable price surface matches the pricing canon\n");
exit($fail ? 1 : 0);
