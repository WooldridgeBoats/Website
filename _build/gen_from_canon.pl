#!/usr/bin/perl
# gen_from_canon.pl - the informational canon drives the website.
#
# ONE script regenerates every canon-driven surface in this repo from the
# canon's spec tabs (Stephen's ruling 2026-10-10: humans edit the workbook
# only; one script regenerates the mirrors and every driven surface; nobody
# re-types a canon fact downstream).
#
# Core Perl only; runs on macOS system perl and on Git for Windows perl.
#
#   perl _build/gen_from_canon.pl --canon <folder of canon CSVs> [--repo <Website folder>] [--dry-run]
#   perl _build/gen_from_canon.pl --xlsx <CANON workbook> --canon <folder> [--dry-run]
#       --xlsx reads the spec tabs straight from the workbook, REWRITES the CSV
#       files in --canon from them (the mirrors), then generates the surfaces.
#       --canon alone uses the CSVs as they are.
#   --dry-run reports what would change and writes nothing.
#
# Writes, in order:
#   1. build-and-price/index.html   the "std" array of every model in const MODELS
#                                   (count-guarded per model; dies on a model not in LINEUP)
#   2. tools/STD_DATA.js            via perl _build/gen_std_data.pl
#   3. models/<slug>/index.html     <!-- STD:slug --> grid, <!-- SPECS:slug --> block,
#                                   <!-- DESC:slug:tagline --> and <!-- DESC:slug:intro -->
#                                   (markers are added around the existing elements on the
#                                   first run, count-guarded one per page)
#   4. tools/SPEC_DATA.js           the compare page's figures (from SPECS)
#   5. perl _build/stamp_assets.pl  re-stamps ?v= on changed assets
#   6. perl _build/verify_spec_canon.pl  proves the result and prints its table
#
# NOT touched here, by design (P3-only or report-only; printed at the end):
#   the Sales Order Creator copy, the branded price sheets and SALES TOOLS
#   publish, the fleet / compare / quiz one-liners (see SPEC DISCREPANCIES),
#   Tyler's SPECS-STANDARD FEATURES PDFs.
#
# Line endings: text is handled as LF internally; a rewritten file keeps the
# line ending it already had on disk (LF on a Mac, CRLF on this Windows
# checkout), so git sees content changes only. The CSV mirrors are LF.
use strict;
use warnings;
use File::Basename qw(dirname);
use Cwd qw(abs_path);
use Getopt::Long;
use lib dirname(abs_path(__FILE__));
use WBSpecCanon qw(slurp_bytes slurp_text write_text read_xlsx_tabs tabs_to_csv_text load_canon load_canon_from_tabs
                   render_std_json models_std_spans render_stdgrid render_specs_block render_spec_data_js
                   tagline_html intro_html check_surfaces CANON_TABS DRIVEN_TABS);
use JSON::PP;

my ($canon_dir, $xlsx, $repo, $dry);
GetOptions('canon=s' => \$canon_dir, 'xlsx=s' => \$xlsx, 'repo=s' => \$repo, 'dry-run' => \$dry) or die "see the header of $0 for usage\n";
die "--canon <folder> is required (the CSV mirrors live there)\n" unless defined $canon_dir;
$repo = dirname(dirname(abs_path(__FILE__))) unless defined $repo;
$repo =~ s{[\\/]+$}{}; $canon_dir =~ s{[\\/]+$}{};
die "repo not found (no build-and-price/index.html under $repo)\n" unless -f "$repo/build-and-price/index.html";
my $build = dirname(abs_path(__FILE__));
my $mode = defined $xlsx ? 'xlsx' : 'csv';
print "mode : $mode", ($dry ? ' (DRY RUN - nothing written)' : ''), "\nrepo : $repo\ncanon: $canon_dir\n";

# ----------------------------------------------- 0. workbook -> CSV mirrors ----
my $C;
if ($mode eq 'xlsx') {
  print "xlsx : $xlsx\n";
  my $tabs = read_xlsx_tabs($xlsx);
  my %texts;
  for my $t (CANON_TABS) {
    unless ($tabs->{$t}) { die "workbook has no tab named '$t'\n" if grep { $_ eq $t } DRIVEN_TABS; printf "  %-20s (tab absent, CSV left alone)\n", $t; next }
    my $csv = tabs_to_csv_text($tabs->{$t}, $t);
    $texts{$t} = $csv;
    my $p = "$canon_dir/$t.csv";
    my $old = -f $p ? scalar slurp_text($p) : undef;
    my $state = !defined $old ? 'NEW' : $old eq $csv ? 'unchanged' : 'CHANGED';
    printf "  %-20s %5d rows  %s%s\n", $t, scalar(@{ $tabs->{$t} }) - 1, $state, ($dry && $state ne 'unchanged') ? ' (would rewrite)' : '';
    write_text($p, $csv, "\n") if !$dry && $state ne 'unchanged';
  }
  $C = load_canon_from_tabs({ map { $_ => $texts{$_} } DRIVEN_TABS });
} else {
  $C = load_canon($canon_dir);
}
printf "canon: %d models, %d with standard features, %d with specs, %d with descriptions\n",
  scalar @{ $C->{lineup} }, scalar keys %{ $C->{std} }, scalar keys %{ $C->{specs} }, scalar keys %{ $C->{desc} };

my ($changed_files, $content_changes, $marker_adds) = (0, 0, 0);
sub save {                           # write only when the text changed; keep the file's own line ending
  my ($p, $text, $eol, $what) = @_;
  my $old = scalar slurp_text($p);
  if ($old eq $text) { return 0 }
  $changed_files++;
  if ($dry) { print "  would write $what\n" } else { write_text($p, $text, $eol); print "  wrote $what\n" }
  return 1;
}

# ------------------------------------------------- 1. configurator MODELS ----
{
  my $p = "$repo/build-and-price/index.html";
  my ($t, $eol) = slurp_text($p);
  my @lines = split /\n/, $t, -1;
  my @at = grep { $lines[$_] =~ /^\s*const MODELS = / } 0 .. $#lines;
  die "const MODELS: expected 1 line, found " . scalar(@at) . "\n" unless @at == 1;
  my $line = $lines[$at[0]];
  my $json = JSON::PP->new->decode(($line =~ s/^\s*const MODELS = //r) =~ s/;\s*$//r);
  my @ids = map { $_->{id} } @$json;
  my @bad = grep { !$C->{by_id}{$_} } @ids;
  die "configurator models not in LINEUP: " . join(',', @bad) . " - the lineup is the canon's, fix LINEUP first\n" if @bad;
  my @missing = grep { !$C->{std}{$_} } @ids;
  die "canon has no STD FEATURES rows for: " . join(',', @missing) . "\n" if @missing;
  my $spans = models_std_spans($line, \@ids);
  my $new = ''; my $cur = 0; my $n = 0;
  for my $sp (@$spans) {
    my $want = render_std_json($C->{std}{$sp->{id}});
    my $have = substr($line, $sp->{start}, $sp->{len});
    $n++ if $want ne $have;
    $new .= substr($line, $cur, $sp->{start} - $cur) . $want;
    $cur = $sp->{start} + $sp->{len};
  }
  $new .= substr($line, $cur);
  printf "configurator: %d of %d std arrays differ from the canon\n", $n, scalar @ids;
  $content_changes += $n;
  $lines[$at[0]] = $new;
  save($p, join("\n", @lines), $eol, 'build-and-price/index.html');
  unless ($dry) {
    my $r = system('perl', "$build/gen_std_data.pl");
    die "gen_std_data.pl failed ($r)\n" if $r;
  } else { print "  (dry run: gen_std_data.pl not run)\n" }
}

# ---------------------------------------------------------- 2. model pages ----
for my $m (@{ $C->{lineup} }) {
  my $id = $m->{model_id}; my $slug = $m->{page_slug};
  my $p = "$repo/models/$slug/index.html";
  die "model '$id': page $p missing\n" unless -f $p;
  my ($t, $eol) = slurp_text($p);
  my $orig = $t;
  my $d = $C->{desc}{$id} || {};

  # a. standard features grid
  my $grid = render_stdgrid($C->{std}{$id} || die "model '$id': no STD FEATURES rows\n");
  if ($t =~ /^([ \t]*)<!-- STD:\Q$slug\E -->\n/m) {
    my $cnt = () = $t =~ /<!-- STD:\Q$slug\E -->/g; die "models/$slug: $cnt STD markers\n" unless $cnt == 1;
    $t =~ s/^([ \t]*)<!-- STD:\Q$slug\E -->\n(.*?)\n[ \t]*<!-- \/STD -->$/$1 . "<!-- STD:$slug -->\n$1$grid\n$1<!-- \/STD -->"/mse
      or die "models/$slug: STD markers found but the block did not match\n";
    $content_changes++ if $t ne $orig;
  } else {
    my @hits = $t =~ /^([ \t]*)<div class="stdgrid">.*<\/div>$/mg;
    die "models/$slug: stdgrid line count " . scalar(@hits) . " (need exactly 1 to add markers)\n" unless @hits == 1;
    my ($have) = $t =~ /^[ \t]*(<div class="stdgrid">.*<\/div>)$/m;
    $content_changes++ if $have ne $grid;
    $marker_adds++;
    $t =~ s/^([ \t]*)<div class="stdgrid">.*<\/div>$/$1 . "<!-- STD:$slug -->\n$1$grid\n$1<!-- \/STD -->"/me;
  }

  # b. SPECS block
  if (my $s = $C->{specs}{$id}) {
    my $blk = render_specs_block($slug, $s, $d);
    my $cnt = () = $t =~ /<!-- SPECS:\Q$slug\E -->/g; die "models/$slug: $cnt SPECS blocks (need exactly 1)\n" unless $cnt == 1;
    my ($have) = $t =~ /^([ \t]*<!-- SPECS:\Q$slug\E -->.*?<!-- \/SPECS -->)/ms;
    $content_changes++ if $have ne $blk;
    $t =~ s/^[ \t]*<!-- SPECS:\Q$slug\E -->.*?<!-- \/SPECS -->/$blk/ms;
  } else { print "  $id: no SPECS rows in canon - block left alone\n" }

  # c. tagline + intro (DESC markers)
  for my $f (['tagline', 'tagline', \&tagline_html], ['intro', 'page_intro', \&intro_html]) {
    my ($mk, $field, $fn) = @$f;
    next unless defined $d->{$field} && length $d->{$field};
    my $html = $fn->($d->{$field});
    if ($t =~ /<!-- DESC:\Q$slug\E:$mk -->/) {
      my $cnt = () = $t =~ /<!-- DESC:\Q$slug\E:$mk -->/g; die "models/$slug: $cnt DESC:$mk markers\n" unless $cnt == 1;
      my ($have) = $t =~ /<!-- DESC:\Q$slug\E:$mk -->\n?[ \t]*(.*?)\n?[ \t]*<!-- \/DESC -->/s;
      $content_changes++ if $have ne $html;
      if ($mk eq 'tagline') { $t =~ s/<!-- DESC:\Q$slug\E:tagline -->.*?<!-- \/DESC -->/<!-- DESC:$slug:tagline -->$html<!-- \/DESC -->/s }
      else { $t =~ s/^([ \t]*)<!-- DESC:\Q$slug\E:intro -->\n.*?\n[ \t]*<!-- \/DESC -->$/$1 . "<!-- DESC:$slug:intro -->\n$1$html\n$1<!-- \/DESC -->"/mse }
    } elsif ($mk eq 'tagline') {
      my @hits = $t =~ /(<div class="tag">.*?<\/div>)/g;
      die "models/$slug: tagline count " . scalar(@hits) . " (need exactly 1 to add markers)\n" unless @hits == 1;
      $content_changes++ if $hits[0] ne $html; $marker_adds++;
      $t =~ s/<div class="tag">.*?<\/div>/<!-- DESC:$slug:tagline -->$html<!-- \/DESC -->/;
    } else {
      my @hits = $t =~ /<\/figure>\n([ \t]*)(<p style="font-size:16px; line-height:1.7;">.*?<\/p>)$/mg;
      die "models/$slug: intro paragraph count " . (@hits / 2) . " (need exactly 1 to add markers)\n" unless @hits == 2;
      $content_changes++ if $hits[1] ne $html; $marker_adds++;
      $t =~ s/<\/figure>\n([ \t]*)<p style="font-size:16px; line-height:1.7;">.*?<\/p>$/"<\/figure>\n$1<!-- DESC:$slug:intro -->\n$1$html\n$1<!-- \/DESC -->"/me;
    }
  }
  save($p, $t, $eol, "models/$slug/index.html");
}

# -------------------------------------------------------- 3. SPEC_DATA.js ----
{
  my $p = "$repo/tools/SPEC_DATA.js";
  my $want = render_spec_data_js($C);
  my ($have, $eol) = -f $p ? slurp_text($p) : ('', "\n");
  if ($have ne $want) { print "tools/SPEC_DATA.js: regenerated from SPECS (differs from the file on disk)\n"; $content_changes++ } else { print "tools/SPEC_DATA.js: unchanged\n" }
  if ($dry) { $changed_files++ if $have ne $want } else { write_text($p, $want, $eol) if $have ne $want }
}

# ------------------------------------------------------ 4. stamp + verify ----
printf "\nsummary: %d file(s) %s, %d content change(s) against the canon, %d marker set(s) %s\n",
  $changed_files, ($dry ? 'would change' : 'written'), $content_changes, $marker_adds, ($dry ? 'would be added' : 'added');
unless ($dry) {
  print "\nstamp_assets.pl:\n";
  my $r = system('perl', "$build/stamp_assets.pl", $repo);
  die "stamp_assets.pl failed ($r)\n" if $r;
  print "\nverify_spec_canon.pl:\n";
  my @v = ('perl', "$build/verify_spec_canon.pl", '--repo', $repo, '--canon', $canon_dir, '--quiet');
  $r = system(@v);
  die "VERIFY FAILED - the surfaces are not in step with the canon (exit " . ($r >> 8) . ")\n" if $r;
}
print "\nNOT touched by this script (other owners):\n"
    . "  - Sales Order Creator copy of the std lists   (_build/sync_soc_rules.pl, P3 only)\n"
    . "  - branded price sheets + SALES TOOLS publish  (PRICE SHEETS/_PIPELINE, P3 only)\n"
    . "  - fleet / compare / quiz one-liners           (report only: canon SPEC DISCREPANCIES)\n"
    . "  - Tyler's SPECS-STANDARD FEATURES PDFs         (his Mac; verifier audits them)\n";
exit 0;
