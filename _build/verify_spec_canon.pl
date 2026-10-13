#!/usr/bin/perl
# verify_spec_canon.pl - is the website in step with the informational canon?
#
# READ-ONLY. Run it on command; it is never scheduled. It compares every
# canon-driven surface in this repo with what the canon says and prints one
# line per surface, then PASS or FAIL (non-zero exit on any mismatch). The
# audit rows (Tyler's SPECS-STANDARD FEATURES PDFs and the brochures) only run
# when pdftotext is on PATH and are SKIPPED otherwise; they never fail the run.
#
# Core Perl only; runs on macOS system perl and on Git for Windows perl.
#
#   perl _build/verify_spec_canon.pl --canon <folder of canon CSVs> [--repo <Website folder>]
#   perl _build/verify_spec_canon.pl --xlsx <CANON workbook> [--repo ...]
#       reads the spec tabs straight from the workbook (nothing is written)
#   options: --sales-tools <SALES TOOLS folder>  turn the PDF audits on
#            --tmp <short writable folder>      where PDFs are copied for pdftotext
#            --quiet                            table only, no per-model detail
#
# Surfaces checked: configurator const MODELS std, tools/STD_DATA.js, every
# model page's standard-features grid, SPECS block, tagline + intro, and
# tools/SPEC_DATA.js. The generator (_build/gen_from_canon.pl) runs this at the
# end of every real run so an update is proven landed in the same command.
use strict;
use warnings;
use File::Basename qw(dirname basename);
use Cwd qw(abs_path);
use Getopt::Long;
use Encode qw(decode);
use lib dirname(abs_path(__FILE__));
use WBSpecCanon qw(slurp_text read_xlsx_tabs tabs_to_csv_text load_canon load_canon_from_tabs
                   check_surfaces fmt_len DRIVEN_TABS);
binmode STDOUT, ':encoding(UTF-8)';
binmode STDERR, ':encoding(UTF-8)';

my ($canon_dir, $xlsx, $repo, $sales, $tmp, $quiet);
GetOptions('canon=s' => \$canon_dir, 'xlsx=s' => \$xlsx, 'repo=s' => \$repo, 'sales-tools=s' => \$sales,
           'tmp=s' => \$tmp, 'quiet' => \$quiet) or die "see the header of $0 for usage\n";
die "give --canon <folder> or --xlsx <workbook>\n" unless defined $canon_dir || defined $xlsx;
$repo = dirname(dirname(abs_path(__FILE__))) unless defined $repo;
$repo =~ s{[\\/]+$}{};
die "repo not found (no build-and-price/index.html under $repo)\n" unless -f "$repo/build-and-price/index.html";

# ------------------------------------------------------------- the canon ----
my $C;
if (defined $xlsx) {
  my $tabs = read_xlsx_tabs($xlsx);
  my %texts;
  for my $t (DRIVEN_TABS) { die "workbook has no tab named '$t'\n" unless $tabs->{$t}; $texts{$t} = tabs_to_csv_text($tabs->{$t}, $t) }
  $C = load_canon_from_tabs(\%texts);
  print "canon: workbook $xlsx (tabs read in memory, nothing written)\n" unless $quiet;
} else {
  $C = load_canon($canon_dir);
  print "canon: folder $canon_dir\n" unless $quiet;
}
print "repo : $repo\n" unless $quiet;

# ------------------------------------------------------------ surfaces ----
my $rows = check_surfaces($repo, $C);

# ---------------------------------------------------------- PDF audits ----
my @audit;
{
  my $pdftotext;
  for my $d (split /[:;]/, ($ENV{PATH} || '')) { for my $n (qw(pdftotext pdftotext.exe)) { if (-x "$d/$n" || -f "$d/$n") { $pdftotext = "$d/$n"; last } } last if $pdftotext }
  unless (defined $sales) {
    # derive: the OneDrive library beside the repo, if it is there (P3 layout); otherwise skip
    my $up = $repo; for (1 .. 4) { $up = dirname($up); my $cand = "$up/Wooldridge Boats Inc_ - Documents/SALES TOOLS"; if (-d $cand) { $sales = $cand; last } }
  }
  my $why = !$pdftotext ? 'pdftotext not on PATH' : (!defined $sales || !-d $sales) ? 'SALES TOOLS folder not found (pass --sales-tools)' : '';
  if ($why) {
    push @audit, { surface => "AUDIT  SALES TOOLS spec PDFs: feature items", models => 0, mismatches => 0, first => "SKIPPED - $why" };
    push @audit, { surface => "AUDIT  SALES TOOLS spec PDFs: spec values",   models => 0, mismatches => 0, first => "SKIPPED - $why" };
    push @audit, { surface => "AUDIT  SALES TOOLS brochures: feature items",  models => 0, mismatches => 0, first => "SKIPPED - $why" };
  } else {
    $tmp = ($ENV{TMPDIR} || $ENV{TEMP} || $ENV{TMP} || '/tmp') unless defined $tmp;
    $tmp =~ s{\\}{/}g;
    my $n = 0;
    my $text_of = sub {               # copy to a short path (long paths return ~300 bytes silently), then pdftotext
      my ($pdf) = @_;
      my $short = sprintf('%s/wbcanon_%d_%d.pdf', $tmp, $$, ++$n);
      open my $i, '<:raw', $pdf or return undef; open my $o, '>:raw', $short or return undef;
      my $bytes = do { local $/; <$i> }; print $o $bytes; close $i; close $o;
      # reading order (no -layout): a two-column layout would split a feature line in two
      my $t = `"$pdftotext" -enc UTF-8 "$short" - 2>/dev/null`;
      unlink $short;
      $t = decode('UTF-8', $t, Encode::FB_DEFAULT);
      return $t;
    };
    my $norm = sub { my $s = lc shift; $s =~ s/[\x{2018}\x{2019}\x{2032}]/'/g; $s =~ s/[\x{201c}\x{201d}\x{2033}]/"/g; $s =~ s/[\x{2013}\x{2014}]/-/g; $s =~ s/\s*\x{b0}/\x{b0}/g; $s =~ s/\s+/ /g; $s =~ s/^\s+|\s+$//g; return $s };
    my %fam = (OUTBOARDS => 'OB', INBOARDS => 'IB', OFFSHORES => 'OB');
    my ($pm, $pmm, $pf) = (0, 0, undef); my ($vm, $vmm, $vf) = (0, 0, undef); my ($bm, $bmm, $bf) = (0, 0, undef);
    my @detail;
    for my $m (@{ $C->{lineup} }) {
      my $id = $m->{model_id};
      (my $base = uc $m->{model_name}) =~ s/ INBOARD$//;
      my $suf = $fam{$m->{family}} || 'OB';
      my @cand = ("$base $suf", $base);        # never an OB file for an IB model, or the reverse
      my ($spec) = grep { -f $_ } map { "$sales/SPECS-STANDARD FEATURES/$_-SPECS-STANDARD FEATURES.pdf" } @cand;
      my ($bro)  = grep { -f $_ } map { "$sales/BROCHURES/$_-BROCHURE-DIGITAL.pdf" } @cand;
      my @items = map { @{ $_->{items} } } @{ $C->{std}{$id} || [] };
      if ($spec) {
        my $t = $norm->($text_of->($spec) // '');
        $pm++; $vm++;
        my @miss = grep { index($t, $norm->($_->{t})) < 0 } @items;
        if (@miss) { $pmm++; $pf //= "$id: \"$miss[0]{t}\" not in " . basename($spec) }
        push @detail, sprintf('  %-10s spec PDF %-48s features %3d/%-3d present', $id, basename($spec), scalar(@items) - scalar(@miss), scalar @items);
        my $s = $C->{specs}{$id}; my @vals; my @vmiss;
        if ($s) {
          for my $cat (@{ $s->{categories} }) { for my $row (@{ $cat->{rows} }) { for my $i (0 .. $#{ $s->{lengths} }) {
            my $c = $row->{cells}[$i];
            my @v = $row->{layout} eq 'list' ? map { $_->[1] } @$c : ref $c ? $c->{v} : $c;
            for my $v (@v) { push @vals, $v; push @vmiss, "$row->{label} @ " . fmt_len($s->{lengths}[$i]) . " = $v" if index($t, $norm->($v)) < 0 }
          } } }
        }
        if (@vmiss) { $vmm++; $vf //= "$id: $vmiss[0] not in " . basename($spec) }
        push @detail, sprintf('  %-10s spec PDF %-48s values   %3d/%-3d present', $id, basename($spec), scalar(@vals) - scalar(@vmiss), scalar @vals);
      } else { push @detail, sprintf('  %-10s spec PDF: none found for "%s"', $id, join('" / "', @cand)) }
      if ($bro) {
        my $t = $norm->($text_of->($bro) // '');
        $bm++;
        my @miss = grep { index($t, $norm->($_->{t})) < 0 } @items;
        if (@miss) { $bmm++; $bf //= "$id: \"$miss[0]{t}\" not in " . basename($bro) }
        push @detail, sprintf('  %-10s brochure %-48s features %3d/%-3d present', $id, basename($bro), scalar(@items) - scalar(@miss), scalar @items);
      } else { push @detail, sprintf('  %-10s brochure: none found', $id) }
    }
    push @audit, { surface => "AUDIT  SALES TOOLS spec PDFs: feature items", models => $pm, mismatches => $pmm, first => $pf // '' };
    push @audit, { surface => "AUDIT  SALES TOOLS spec PDFs: spec values",   models => $vm, mismatches => $vmm, first => $vf // '' };
    push @audit, { surface => "AUDIT  SALES TOOLS brochures: feature items",  models => $bm, mismatches => $bmm, first => $bf // '' };
    print join("\n", @detail), "\n" unless $quiet;
  }
}

# ----------------------------------------------------------------- table ----
my $fail = 0;
printf "%-46s %6s %9s  %s\n", 'SURFACE', 'MODELS', 'MISMATCH', 'FIRST DIFFERENCE';
for my $r (@$rows, @audit) {
  my $first = $r->{first}; $first = '' unless defined $first; $first = substr($first, 0, 150) . '...' if length $first > 153;
  printf "%-46s %6d %9d  %s\n", $r->{surface}, $r->{models}, $r->{mismatches}, $first;
  $fail++ if $r->{mismatches} && $r->{surface} !~ /^AUDIT/;
}
print "RESULT: ", ($fail ? "FAIL ($fail surface(s) out of step with the canon)" : 'PASS (every driven surface matches the canon)'), "  [audit rows never fail the run]\n";
exit($fail ? 1 : 0);
