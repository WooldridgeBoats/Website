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
# model page's standard-features grid, SPECS block, tagline + intro, its price
# note under "2026 Base Pricing" (since 2026-11-03: what the ENGINES tab's
# base-engine flag calls for - read from the workbook, or ENGINES.csv beside the
# spec mirrors in --canon mode), its "2026 Base Pricing" fold (since 2026-11-03:
# the "from $" and the per-configuration base-hull tables against the BOATS tab -
# the workbook's, or BOATS.csv beside the spec mirrors in --canon mode), its
# "2026 Package Pricing" fold under it (since 2026-11-04: against the PACKAGES
# tab, or PACKAGES.csv beside the spec mirrors in --canon mode; its "what each
# package includes" lists against the sheets' recipes in PRICE SHEETS/_PIPELINE,
# --pipeline or found beside CANON), and
# tools/SPEC_DATA.js. The generator (_build/gen_from_canon.pl) runs this at the
# end of every real run so an update is proven landed in the same command.
use strict;
use warnings;
use File::Basename qw(dirname basename);
use Cwd qw(abs_path);
use Getopt::Long;
use Encode qw(decode);
use lib dirname(abs_path(__FILE__));
use WBSpecCanon qw(slurp_text read_csv read_xlsx_tabs tabs_to_csv_text load_canon load_canon_from_tabs
                   check_surfaces fmt_len base_engine_models engines_grid_from_csv price_notes DRIVEN_TABS);
use WBPriceCanon qw(rows_of check_pricing_folds check_package_folds package_legends);
binmode STDOUT, ':encoding(UTF-8)';
binmode STDERR, ':encoding(UTF-8)';

my ($canon_dir, $xlsx, $repo, $sales, $tmp, $quiet, $pipeline);
GetOptions('canon=s' => \$canon_dir, 'xlsx=s' => \$xlsx, 'repo=s' => \$repo, 'sales-tools=s' => \$sales,
           'tmp=s' => \$tmp, 'quiet' => \$quiet, 'pipeline=s' => \$pipeline) or die "see the header of $0 for usage\n";
die "give --canon <folder> or --xlsx <workbook>\n" unless defined $canon_dir || defined $xlsx;
$repo = dirname(dirname(abs_path(__FILE__))) unless defined $repo;
$repo =~ s{[\\/]+$}{};
die "repo not found (no build-and-price/index.html under $repo)\n" unless -f "$repo/build-and-price/index.html";

# ------------------------------------------------------------- the canon ----
my $C; my $engines; my $boats;       # $engines = the ENGINES grid, for the price-note surface; $boats = BOATS rows, for the pricing fold
my $packages;                        # PACKAGES rows, for the package fold (with $boats for the configuration names' casing)
if (defined $xlsx) {
  my $tabs = read_xlsx_tabs($xlsx);
  my %texts;
  for my $t (DRIVEN_TABS) { die "workbook has no tab named '$t'\n" unless $tabs->{$t}; $texts{$t} = tabs_to_csv_text($tabs->{$t}, $t) }
  $C = load_canon_from_tabs(\%texts);
  die "workbook has no tab named 'ENGINES' (the model pages' price note follows its base-engine flag)\n" unless $tabs->{ENGINES};
  $engines = $tabs->{ENGINES};
  die "workbook has no tab named 'BOATS' (the model pages' 2026 Base Pricing fold is rendered from it)\n" unless $tabs->{BOATS};
  $boats = rows_of($tabs->{BOATS}, 'BOATS');
  die "workbook has no tab named 'PACKAGES' (the model pages' 2026 Package Pricing fold is rendered from it)\n" unless $tabs->{PACKAGES};
  $packages = rows_of($tabs->{PACKAGES}, 'PACKAGES');
  print "canon: workbook $xlsx (tabs read in memory, nothing written)\n" unless $quiet;
} else {
  $C = load_canon($canon_dir);
  $engines = engines_grid_from_csv("$canon_dir/ENGINES.csv") if -f "$canon_dir/ENGINES.csv";
  $boats = (read_csv("$canon_dir/BOATS.csv"))[1] if -f "$canon_dir/BOATS.csv";
  $packages = (read_csv("$canon_dir/PACKAGES.csv"))[1] if -f "$canon_dir/PACKAGES.csv";
  print "canon: folder $canon_dir\n" unless $quiet;
  print "price note: ENGINES.csv not beside the spec mirrors - that surface is not checked\n" unless $engines || $quiet;
  print "pricing fold: BOATS.csv not beside the spec mirrors - that surface is not checked\n" unless $boats || $quiet;
  print "package fold: PACKAGES.csv or BOATS.csv not beside the spec mirrors - that surface is not checked\n" unless ($packages && $boats) || $quiet;
}
print "repo : $repo\n" unless $quiet;

# ------------------------------------------------------------ surfaces ----
my $N = $engines ? price_notes($C, base_engine_models($engines)) : undef;
my $rows = check_surfaces($repo, $C, $N);
push @$rows, check_pricing_folds($repo, $C->{lineup}, $boats) if $boats;   # the "2026 Base Pricing" fold, from the BOATS tab (2026-11-03)
# the "2026 Package Pricing" fold, from the PACKAGES tab (2026-11-04), its package lists from the sheets' recipes in
# PRICE SHEETS/_PIPELINE (--pipeline, or found beside CANON: <SQUIRREL HOLE>/60 SALES AND DEALERS/PRICE SHEETS/_PIPELINE)
unless (defined $pipeline) {
  my $croot = defined $xlsx ? dirname(abs_path($xlsx)) : dirname(abs_path($canon_dir));   # CANON
  $pipeline = dirname($croot) . '/60 SALES AND DEALERS/PRICE SHEETS/_PIPELINE';
}
$pipeline =~ s{\x5c}{/}g; $pipeline =~ s{/+$}{};
if ($packages && $boats) {
  if (-f "$pipeline/package-recipes.json") { push @$rows, check_package_folds($repo, $C->{lineup}, $packages, $boats, package_legends($repo, $pipeline)) }
  else { push @$rows, { surface => 'model pages: 2026 Package Pricing fold', models => 0, mismatches => 0,
                        first => "NOT CHECKED - PRICE SHEETS/_PIPELINE not found at $pipeline (pass --pipeline)" } }
}

# ---------------------------------------------------------- PDF audits ----
my @audit;
{
  my $pdftotext;
  for my $d (split /[:;]/, ($ENV{PATH} || '')) { for my $n (qw(pdftotext pdftotext.exe)) { if (-x "$d/$n" || -f "$d/$n") { $pdftotext = "$d/$n"; last } } last if $pdftotext }
  # 2026-11-05: Git for Windows ships pdftotext in mingw64/bin, beside the usr/bin perl this runs under on the P3, but that
  # folder is not on PowerShell's PATH - so the audit was SKIPPED on the P3 although the tool was there all along
  unless ($pdftotext) { my $g = dirname(dirname(dirname($^X))) . '/mingw64/bin/pdftotext.exe'; $g =~ s{\\}{/}g; $pdftotext = $g if -f $g }
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
      my ($pdf, $layout) = @_;
      my $short = sprintf('%s/wbcanon_%d_%d.pdf', $tmp, $$, ++$n);
      open my $i, '<:raw', $pdf or return undef; open my $o, '>:raw', $short or return undef;
      my $bytes = do { local $/; <$i> }; print $o $bytes; close $i; close $o;
      # reading order (no -layout) for feature lines: a two-column layout would split a feature line in two.
      # -layout for the spec table: one printed row = one text line, so a row's values can be checked together.
      my $flag = $layout ? '-layout ' : '';
      my $t = `"$pdftotext" ${flag}-enc UTF-8 "$short" - 2>/dev/null`;
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
        my $s = $C->{specs}{$id}; my @vals; my @vmiss; my $vbad = 0;
        if ($s) {
          # 2026-11-05: a plain row is checked as a ROW - its values, in length order, on one line of the -layout text.
          # The old check looked for each value anywhere on the page, so Rogue 16 ft Transom Gauge "1 in." passed because
          # "1 in." is printed elsewhere (Tyler's report). Probed on all 18 PDFs that day: every plain row of 17 holds;
          # Rogue's 5 misaligned rows are the real fault. List and badge rows keep the page-wide check.
          my @lines = map { $norm->($_) } split /\n/, ($text_of->($spec, 1) // '');
          for my $cat (@{ $s->{categories} }) { for my $row (@{ $cat->{rows} }) {
            if ($row->{layout} eq 'plain' && !grep { ref $_ } @{ $row->{cells} }) {
              my @v = grep { defined && length } @{ $row->{cells} };
              next unless @v;
              push @vals, @v;
              my $want = join(' ', map { $norm->($_) } @v);
              unless (grep { index($_, $want) >= 0 } @lines) { push @vmiss, "$row->{label} = " . join(' / ', @v) . ' (not one printed row)'; $vbad += @v }
              next;
            }
            for my $i (0 .. $#{ $s->{lengths} }) {
              my $c = $row->{cells}[$i];
              my @v = $row->{layout} eq 'list' ? map { $_->[1] } @$c : ref $c ? $c->{v} : $c;
              for my $v (@v) { push @vals, $v; if (index($t, $norm->($v)) < 0) { push @vmiss, "$row->{label} @ " . fmt_len($s->{lengths}[$i]) . " = $v"; $vbad++ } }
            }
          } }
        }
        if (@vmiss) { $vmm++; $vf //= "$id: $vmiss[0] not in " . basename($spec) }
        push @detail, sprintf('  %-10s spec PDF %-48s values   %3d/%-3d present', $id, basename($spec), scalar(@vals) - $vbad, scalar @vals);
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
