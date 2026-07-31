#!/usr/bin/perl
# gen_std_data.pl — derive tools/STD_DATA.js from the configurator catalog.
#
# TOOL-04: the compare tool shows each model's standard features WITHOUT
# keeping a third hand-maintained copy of the data. The configurator's
# const MODELS is generated from the price sheets; this script derives the
# std-features file from it, so the chain stays
#   price sheets -> configurator -> (this script) -> compare tool.
#
# RE-RUN THIS after the configurator is regenerated:
#   perl _build/gen_std_data.pl
use strict; use warnings;
use JSON::PP;
use File::Basename qw(dirname);
use Cwd qw(abs_path);

my $root = dirname(dirname(abs_path(__FILE__)));
my $cfg  = "$root/build-and-price/index.html";
my $out  = "$root/tools/STD_DATA.js";

open my $fh, '<:raw', $cfg or die "can't read configurator: $!";
my $line;
while (<$fh>) { if (/^\s*const MODELS = /) { $line = $_; last } }
close $fh;
die "const MODELS not found\n" unless defined $line;
$line =~ s/^\s*const MODELS = //;
$line =~ s/;\s*$//;
my $models = decode_json($line);

my %std;
for my $m (@$models) {
  my @groups;
  for my $g (@{ $m->{std} || [] }) {
    my @items;
    for my $it (@{ $g->{items} || [] }) {
      my %e = (t => $it->{t});
      $e{tag} = $it->{tag} if $it->{tag};
      push @items, \%e;
    }
    push @groups, { h => $g->{h}, items => \@items };
  }
  $std{ $m->{id} } = \@groups;
}

my $J = JSON::PP->new->canonical;
open my $o, '>:encoding(UTF-8)', $out or die "can't write $out: $!";
print $o "/* GENERATED FILE - do not edit by hand.\n"
       . "   Derived from the configurator catalog by _build/gen_std_data.pl.\n"
       . "   Re-run that script after the configurator is regenerated from the\n"
       . "   price sheets, or this data silently goes stale. */\n"
       . "const WB_STD = " . $J->encode(\%std) . ";\n";
close $o;
printf "wrote %s (%d models)\n", $out, scalar keys %std;
