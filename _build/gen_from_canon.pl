#!/usr/bin/perl
# gen_from_canon.pl - THE canon command: the workbook drives the website.
#
# ONE script carries a change in the canon workbook - a standard feature, a spec,
# a description, a lineup fact OR A PRICE - to every surface it reaches, then
# proves it landed. Stephen's rulings: humans edit the workbook only and one
# script regenerates everything downstream (2026-10-10); the pricing canon gets
# the same one-command process, from either computer (2026-10-13); one command
# for both canons, prices first, the workbook owns every price - including the
# 82 overlay-added options - and "this command cant hold anything back"
# (2026-10-14).
#
# Core Perl only; runs on macOS system perl and on Git for Windows perl.
#
#   perl _build/gen_from_canon.pl --xlsx <CANON>/WB\ PRICING\ CANON.xlsx --canon <CANON>/CSV\ MIRRORS
#       --by "<who entered it>" --with "<who it was discussed with>" [--why "<reason>"] [--dry-run]
#   perl _build/gen_from_canon.pl --canon <folder of CSVs>      (legacy: spec tabs only, from the CSVs)
#
#   --dry-run  reports every change it would make and writes nothing. Run it first.
#   --by / --with  required when a price changes (the CHANGE LOG names both - Stephen, 2026-10-13);
#              --why goes into the log and names the price-sheet archive folder.
#   Rarely needed: --repo <Website folder>, --out <WB CANON DATA.json>, --soc-out <WB CANON SOC.json>,
#              --pipeline <PRICE SHEETS/_PIPELINE>, --qb-import <Desktop/QB IMPORT> (all found by themselves),
#              --sheets run|dry|skip (the branded price sheets; default run).
#
# HOW A RUN GOES (nothing outside git is written unless every check passes):
#   0. The website repo must have no uncommitted changes to tracked files (git is
#      the rollback), and the workbook is read once (all tabs).
#   1. PRICES. The pricing tabs are compared with the website (const MODELS with
#      tools/RULES_OVERLAY.js applied, and the trailer picker's const DATA).
#      Anything that is not a price - a renamed option, a new or removed row, a
#      changed restriction - is NOT WIRED YET and stops the run before anything is
#      written, with the list. So does a Center Console row that no longer equals
#      its windshield twin (Grant's rule Q-CFG-12: edit the windshield row), an
#      option whose unit does not follow its price, and a trailer whose as-stocked
#      total is not base + standard items.
#   2. Every price that differs is written where it lives: const MODELS (hulls,
#      engines, adders, options - one number at a time, count-guarded), the trailer
#      picker's const DATA, and the 82 overlay-added options' prices via
#      _build/gen_rules_overlay.pl --prices. Then the repo's 18 print price sheets
#      (gen_pricesheets.pl + inject_partials.pl) and the "from" price on the home
#      page, quiz, quote and compare pages (only that number - gen_fleet.pl also
#      rewrites the home page's photos, so it is not run).
#   3. SPECS: the configurator's std arrays, tools/STD_DATA.js, the 18 model pages'
#      STD / SPECS / DESC blocks, tools/SPEC_DATA.js (unchanged from v1.1).
#   4. stamp_assets.pl, then BOTH checks: verify_spec_canon.pl and the pricing
#      check (verify_pricing_canon.pl's code). On a FAIL every website file is put
#      back (git checkout) and nothing else is written.
#   5. Only after a PASS: the CSV mirrors (all 14 tabs), WB CANON DATA.json and
#      WB CANON SOC.json (the Sales Order Creator's prices - the Hub server reads
#      it straight from the canon folder, so it is written temp-then-rename and
#      never half-written), then the full check again with those included.
#   6. DOWNSTREAM, each only when what it reads changed: the PACKAGES tab regenerated from the
#      package recipes (written into the workbook through Excel - P3 only - by CANON/_build/
#      write_tab_from_csv.ps1, proved in a fresh Excel); the price sheets' trailer shop add-ons;
#      the branded price sheets (built, verified, placed with the old ones archived, published to
#      SALES TOOLS - needs Rockwell); the ITEM CODE LOOKUP page (P3); the used-boat appraiser;
#      the prop selector; the "Boat facts" view in CANON.html (CANON/_build/BOAT FACTS/
#      build_boat_facts.pl, every real run, a failure is loud but not fatal). Then the QuickBooks typing list (QB IMPORT/1 - NEXT IMPORT on the P3),
#      a final check of everything, and the CHANGE LOG entry in CANON/README.md.
#   7. What it cannot do from where it runs is printed as OWED, naming the machine.
#
# Line endings: text is handled as LF internally; a rewritten file keeps the line
# ending it already had on disk. Spec CSV mirrors are LF without BOM; pricing
# mirrors keep their BOM and line endings (see WBPriceCanon::mirror_bytes).
use strict;
use warnings;
use File::Basename qw(dirname basename);
use Cwd qw(abs_path);
use Getopt::Long;
use lib dirname(abs_path(__FILE__));
use WBSpecCanon qw(slurp_bytes slurp_text write_text read_xlsx_tabs tabs_to_csv_text load_canon load_canon_from_tabs
                   render_std_json models_std_spans render_stdgrid render_specs_block render_spec_data_js
                   tagline_html intro_html CANON_TABS DRIVEN_TABS);
use WBPriceCanon qw(PRICE_TABS FROM_PAGES load_site canon_from_tabs compare_prices plan_price_writes apply_splices
                    from_prices from_nodes mirror_bytes soc_blobs soc_file_bytes verify_pricing fmt_price);
use JSON::PP;
use Digest::SHA qw(sha256_hex);
use Encode qw(encode);
binmode STDOUT, ':encoding(UTF-8)';
binmode STDERR, ':encoding(UTF-8)';

our $VERSION = '2.0';
my ($canon_dir, $xlsx, $repo, $dry, $out, $soc_out, $pipeline, $qb_import, $by, $with, $why);
my $sheets = 'run';
GetOptions('canon=s' => \$canon_dir, 'xlsx=s' => \$xlsx, 'repo=s' => \$repo, 'dry-run' => \$dry, 'out=s' => \$out,
           'soc-out=s' => \$soc_out, 'pipeline=s' => \$pipeline, 'qb-import=s' => \$qb_import, 'sheets=s' => \$sheets,
           'by=s' => \$by, 'with=s' => \$with, 'why=s' => \$why) or die "see the header of $0 for usage\n";
die "--sheets must be run, dry or skip\n" unless $sheets =~ /^(run|dry|skip)$/;
die "--canon <folder> is required (the CSV mirrors live there)\n" unless defined $canon_dir;
$repo = dirname(dirname(abs_path(__FILE__))) unless defined $repo;
$repo =~ s{[\\/]+$}{}; $canon_dir =~ s{[\\/]+$}{};
die "repo not found (no build-and-price/index.html under $repo)\n" unless -f "$repo/build-and-price/index.html";
die "--canon folder not found: $canon_dir\n" unless -d $canon_dir;
$out     = dirname($canon_dir) . '/WB CANON DATA.json' unless defined $out;
$soc_out = dirname($canon_dir) . '/WB CANON SOC.json'  unless defined $soc_out;
my $build = "$repo/_build";          # the TARGET repo's own generators (each derives its root from its own location)
my $mode = defined $xlsx ? 'xlsx' : 'csv';
print "gen_from_canon.pl $VERSION  mode: $mode", ($dry ? '  (DRY RUN - nothing written)' : ''), "\nrepo : $repo\ncanon: $canon_dir\nout  : $out\n";
print "soc  : $soc_out\n" if $mode eq 'xlsx';

my @owed;                            # printed at the end: what this run could not do from here
sub run_perl {                       # run one of the repo's own generators; die on failure
  my ($what, @args) = @_;
  my $r = system('perl', @args);
  die "$what failed (exit " . ($r >> 8) . ")\n" if $r;
}
sub git_lines { my (@a) = @_; my $cmd = join(' ', 'git', '-C', qq{"$repo"}, @a); my @l = `$cmd`; die "git @a failed\n" if $?; chomp @l; return @l }

# ------------------------------------------------- 0. preflight + workbook ----
unless ($dry) {
  my @dirty = git_lines('status', '--porcelain', '--untracked-files=no');
  die "the website repo has uncommitted changes to tracked files - commit or stash them first (git is this command's rollback):\n"
    . join('', map { "  $_\n" } @dirty) if @dirty;
}
my $C; my %texts; my $tabs;
if ($mode eq 'xlsx') {
  print "xlsx : $xlsx\n";
  $tabs = read_xlsx_tabs($xlsx, { dates => 1 });
  for my $t (CANON_TABS) {
    unless ($tabs->{$t}) { die "workbook has no tab named '$t'\n" if grep { $_ eq $t } DRIVEN_TABS; next }
    $texts{$t} = tabs_to_csv_text($tabs->{$t}, $t);
  }
  for my $t (PRICE_TABS) { die "workbook has no tab named '$t'\n" unless $tabs->{$t} }
  $C = load_canon_from_tabs({ map { $_ => $texts{$_} } DRIVEN_TABS });
} else {
  $C = load_canon($canon_dir);
  print "pricing: SKIPPED - prices are read from the workbook only; run with --xlsx\n";
}
printf "canon: %d models, %d with standard features, %d with specs, %d with descriptions\n",
  scalar @{ $C->{lineup} }, scalar keys %{ $C->{std} }, scalar keys %{ $C->{specs} }, scalar keys %{ $C->{desc} };

my ($changed_files, $content_changes, $marker_adds, $price_changes) = (0, 0, 0, 0);
sub save {                           # write only when the text changed; keep the file's own line ending
  my ($p, $text, $eol, $what) = @_;
  my $old = scalar slurp_text($p);
  if ($old eq $text) { return 0 }
  $changed_files++;
  if ($dry) { print "  would write $what\n" } else { write_text($p, $text, $eol); print "  wrote $what\n" }
  return 1;
}

# ------------------------------------------------------------- 1-2. PRICES ----
my $price_list = [];
if ($mode eq 'xlsx') {
  print "\nPRICES\n";
  my $S = load_site($repo);
  my $PC = canon_from_tabs($tabs);
  my $R = compare_prices($S, $PC);
  my @stop;
  push @stop, map { "NOT WIRED YET  $_->{tab} $_->{key}: $_->{msg}" } @{ $R->{other} };
  push @stop, map { "CENTER CONSOLE $_" } @{ $R->{link} };
  push @stop, map { "ARITHMETIC     $_" } @{ $R->{math} };
  my $P = plan_price_writes($S, $R);
  push @stop, map { "NOT WIRED YET  $_" } @{ $P->{refuse} };
  if (@stop) {
    print "STOPPED before writing anything - the workbook holds changes this command cannot carry yet,\n"
        . "or cells that disagree with each other. Fix these in the workbook (or ask for the change to be wired):\n";
    print "  $_\n" for @stop;
    exit 1;
  }
  $price_list = $R->{price};
  $price_changes = @$price_list;
  die "STOPPED before writing anything: this run changes $price_changes price(s). Every canon change is logged with who entered it\n"
    . "and who it was discussed with (Stephen, 2026-10-13). Run it again with --by \"<your name>\" --with \"<names>\" [--why \"<reason>\"].\n"
    if $price_changes && !$dry && !(defined $by && length $by && defined $with && length $with);
  my $twins = grep { $_->{loc}{copy_of} } @$price_list;
  printf "  %d price(s) differ from the website%s\n", $price_changes, $twins ? " ($twins of them Center Console twins that follow their windshield row)" : '';
  for my $d (@$price_list) {
    printf "    %-8s %-70s %10s -> %s%s\n", $d->{tab}, ($d->{key} =~ s/^[A-Z]+\|//r), ($d->{site} eq '' ? 'on request' : $d->{site}),
      ($d->{canon} eq '' ? 'on request' : $d->{canon}), ($d->{loc}{copy_of} ? '  (twin)' : '');
  }
  if ($price_changes) {
    # a. const MODELS + const DATA, one number at a time
    my $t = $S->{cfg_text};
    my @sp = ((map { [$S->{models_off} + $_->[0], $_->[1], $_->[2]] } @{ $P->{models} }),
              (map { [$S->{data_off} + $_->[0], $_->[1], $_->[2]] } @{ $P->{data} }));
    if (@sp) {
      $t = apply_splices($t, \@sp);
      printf "  configurator: %d number(s) in const MODELS, %d in the trailer picker\n", scalar @{ $P->{models} }, scalar @{ $P->{data} };
      save($S->{cfg_path}, $t, $S->{cfg_eol}, 'build-and-price/index.html');
    }
    # b. the overlay-added options (the workbook owns their prices)
    if (%{ $P->{overlay} }) {
      printf "  rules overlay: %d overlay-added option price(s) from the workbook\n", scalar keys %{ $P->{overlay} };
      if ($dry) { print "  would run gen_rules_overlay.pl --prices\n"; $changed_files++ }
      else {
        my $all = {};                # every added option's workbook price, so the overlay is regenerated from canon in full
        for my $k (keys %{ $S->{rows}{OPTIONS} }) {
          my $r = $S->{rows}{OPTIONS}{$k}; next unless $r->{loc}{kind} eq 'added';
          my $c = $PC->{OPTIONS}{$k}; $all->{ $r->{loc}{id} } = ($c->{price_usd} eq '' ? undef : 0 + $c->{price_usd});
        }
        my $pf = "$build/.canon-prices-$$.json";
        write_text($pf, JSON::PP->new->canonical(1)->encode($all), "\n");
        my $ok = eval { run_perl('gen_rules_overlay.pl', "$build/gen_rules_overlay.pl", '--prices', $pf, "$repo/build-and-price/index.html", "$repo/tools/RULES_OVERLAY.js"); 1 };
        unlink $pf;
        die $@ unless $ok;
        $changed_files++;
      }
    }
    # c. the repo's print price sheets + the "from" prices
    if ($dry) { print "  would regenerate pricesheets/ (gen_pricesheets.pl + inject_partials.pl) and re-derive the from-prices\n" }
    else {
      run_perl('gen_pricesheets.pl', "$build/gen_pricesheets.pl");
      run_perl('inject_partials.pl', "$build/inject_partials.pl");
      my $F = from_prices(load_site($repo));
      for my $pg (FROM_PAGES) {
        my ($f, $var) = @$pg;
        my ($pt, $peol) = slurp_text("$repo/$f");
        my $n = from_nodes($pt, $var);
        my @fs;
        for my $id (sort keys %$F) {
          my $node = $n->{$id} or die "$f: const $var has no entry for model '$id'\n";
          push @fs, [$node->{s}, $node->{e} - $node->{s} + 1, fmt_price($F->{$id})] unless $node->{v} == $F->{$id};
        }
        if (@fs) { printf "  %s: %d from-price(s)\n", $f, scalar @fs; save("$repo/$f", apply_splices($pt, \@fs), $peol, $f) }
      }
    }
  }
}

# ------------------------------------------------- 3. SPECS: configurator std ----
print "\nSPECS\n";
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
  unless ($dry) { run_perl('gen_std_data.pl', "$build/gen_std_data.pl") } else { print "  (dry run: gen_std_data.pl not run)\n" }
}

# ---------------------------------------------------------- SPECS: model pages ----
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

# ------------------------------------------------------------ SPECS: SPEC_DATA.js ----
{
  my $p = "$repo/tools/SPEC_DATA.js";
  my $want = render_spec_data_js($C);
  my ($have, $eol) = -f $p ? slurp_text($p) : ('', "\n");
  if ($have ne $want) { print "tools/SPEC_DATA.js: regenerated from SPECS (differs from the file on disk)\n"; $content_changes++ } else { print "tools/SPEC_DATA.js: unchanged\n" }
  if ($dry) { $changed_files++ if $have ne $want } else { write_text($p, $want, $eol) if $have ne $want }
}

printf "\nsummary: %d price change(s), %d spec content change(s), %d marker set(s) %s, %d website file(s) %s\n",
  $price_changes, $content_changes, $marker_adds, ($dry ? 'would be added' : 'added'), $changed_files, ($dry ? 'would change' : 'written');

# ------------------------------------------------- 4. stamp + BOTH checks ----
my $vrows = [];
unless ($dry) {
  print "\nstamp_assets.pl:\n";
  run_perl('stamp_assets.pl', "$build/stamp_assets.pl", $repo);
  print "\nCHECKS (before anything outside the website is written):\n";
  my @v = ('perl', "$build/verify_spec_canon.pl", '--repo', $repo, '--quiet', ($mode eq 'xlsx' ? ('--xlsx', $xlsx) : ('--canon', $canon_dir)));
  my $spec_fail = system(@v) ? 1 : 0;
  my $price_fail = 0;
  if ($mode eq 'xlsx') {
    ($vrows) = verify_pricing(repo => $repo, tabs => $tabs);
    printf "  %-40s %-4s %s\n", @$_ for @$vrows;
    $price_fail = grep { $_->[1] eq 'FAIL' } @$vrows;
  }
  if ($spec_fail || $price_fail) {
    my @changed = git_lines('diff', '--name-only');
    git_lines('checkout', '--', '.') if @changed;
    die "\nVERIFY FAILED - " . ($spec_fail ? 'specs' : '') . ($spec_fail && $price_fail ? ' and ' : '') . ($price_fail ? 'prices' : '')
      . " not in step after writing. Every website file was put back (" . scalar(@changed) . " restored); nothing else was written.\n";
  }
}

# ------------------------------------------------- 5. outside the website ----
sub put_atomic {                     # bytes -> path, via a temp name in the same folder; returns 1 when written
  my ($path, $bytes, $what) = @_;
  if (-f $path && slurp_bytes($path) eq $bytes) { printf "  %-28s unchanged\n", $what; return 0 }
  if ($dry) { printf "  %-28s would write\n", $what; return 1 }
  my $tmp = "$path.tmp-$$";
  open my $fh, '>:raw', $tmp or die "cannot write $tmp: $!\n"; print $fh $bytes; close $fh or die "cannot close $tmp: $!\n";
  unless (rename $tmp, $path) { my $e = $!; unlink $tmp; die "cannot replace $path: $e\n" }
  printf "  %-28s written\n", $what;
  return 1;
}
print "\nOUTSIDE THE WEBSITE\n";
my %old_mirror;                      # the mirrors as they were before this run: the QuickBooks list and the downstream triggers diff against them
for my $t ((CANON_TABS), (PRICE_TABS)) { my $p = "$canon_dir/$t.csv"; $old_mirror{$t} = -f $p ? slurp_bytes($p) : '' }
if ($mode eq 'xlsx') {
  for my $t (CANON_TABS) { next unless defined $texts{$t}; put_atomic("$canon_dir/$t.csv", encode('UTF-8', $texts{$t}), "CSV MIRRORS/$t.csv") }
  for my $t (PRICE_TABS) { my $p = "$canon_dir/$t.csv"; put_atomic($p, mirror_bytes($tabs->{$t}, $t, (-f $p ? slurp_bytes($p) : undef)), "CSV MIRRORS/$t.csv") }
}
my @t = gmtime(time);
my $now = sprintf('%04d-%02d-%02dT%02d:%02d:%02dZ', $t[5] + 1900, $t[4] + 1, $t[3], $t[2], $t[1], $t[0]);
my $commit = 'unknown';
{ my $c = `git -C "$repo" rev-parse HEAD 2>&1`; $commit = $1 if defined $c && $c =~ /^([0-9a-f]{40})/ }
my $pricing;                         # the pointer WB CANON DATA.json carries to the SOC file
if ($mode eq 'xlsx') {
  my $b = soc_blobs($repo);
  my %cnt = (boats => 0, engines => 0, options => 0, trailers => 0);
  my $PC = canon_from_tabs($tabs);
  $cnt{boats} = keys %{ $PC->{BOATS} }; $cnt{engines} = keys %{ $PC->{ENGINES} }; $cnt{options} = keys %{ $PC->{OPTIONS} };
  $cnt{trailers} = grep { /^T\|/ } keys %{ $PC->{TRAILERS} };
  my $verified = { against_canon_rows => JSON::PP::true, %cnt, verifier => "WBPriceCanon::verify_pricing via gen_from_canon.pl $VERSION" };
  my %sha = map { $_ => sha256_hex($b->{$_}) } keys %$b;
  my $prev = -f $soc_out ? eval { JSON::PP->new->utf8->decode(slurp_bytes($soc_out)) } : undef;
  my $same = $prev && !grep { ($prev->{soc_sha256}{$_} // '') ne $sha{$_} } keys %sha;
  my $when = ($same && $prev->{generated_utc}) ? $prev->{generated_utc} : $now;   # "prices as of" = when they last changed
  my $meta = { generated_utc => $when, generator => "gen_from_canon.pl $VERSION", workbook_sha256 => sha256_hex(slurp_bytes($xlsx)),
               repo_commit => $commit, verified => $verified };
  if ($same) { $meta->{$_} = $prev->{$_} for grep { defined $prev->{$_} } qw(workbook_sha256 repo_commit generator) }   # nothing to tell the sales floor: keep the file byte-for-byte
  put_atomic($soc_out, soc_file_bytes($b, $meta), 'WB CANON SOC.json');
  $pricing = { soc_file => 'WB CANON SOC.json', soc_sha256 => \%sha, verified => $verified, prices_as_of => $when };
}
{
  my %sha;
  for my $t (CANON_TABS) {
    if ($mode eq 'xlsx' && defined $texts{$t}) { $sha{"$t.csv"} = sha256_hex(encode('UTF-8', $texts{$t})) }
    elsif (-f "$canon_dir/$t.csv")             { $sha{"$t.csv"} = sha256_hex(slurp_bytes("$canon_dir/$t.csv")) }
  }
  my %std; my %specs; my %desc;
  for my $m (@{ $C->{lineup} }) {
    my $id = $m->{model_id};
    $std{$id} = [ map { { h => $_->{h}, items => [ map { my %e = (t => $_->{t}); $e{tag} = $_->{tag} if defined $_->{tag} && length $_->{tag}; \%e } @{ $_->{items} } ] } } @{ $C->{std}{$id} || [] } ];
    if (my $s = $C->{specs}{$id}) {
      for my $cat (@{ $s->{categories} }) { for my $row (@{ $cat->{rows} }) { for my $i (0 .. $#{ $s->{lengths} }) {
        my $c = $row->{cells}[$i]; my %e = (category => $cat->{name}, layout => $row->{layout});
        if ($row->{layout} eq 'list') { $e{values} = [ map { { note => $_->[0], value => $_->[1] } } @$c ] }
        elsif (ref $c)                { $e{value} = $c->{v}; $e{note} = $c->{badge} }
        else                          { $e{value} = $c; $e{note} = '' }
        $specs{$id}{ $s->{lengths}[$i] }{ $row->{label} } = \%e;
      } } }
    }
    my $d = $C->{desc}{$id} || {};
    $desc{$id} = { tagline => ($d->{tagline} // ''), intro => ($d->{page_intro} // ''),
                   map { $_ => $d->{$_} } grep { $_ ne 'tagline' && $_ ne 'page_intro' } sort keys %$d };
  }
  my $J = JSON::PP->new->canonical(1)->indent(1)->indent_length(2)->space_after(1);
  my $data = {
    generator     => "gen_from_canon.pl $VERSION",
    source        => { mode => $mode, workbook_or_folder => ($mode eq 'xlsx' ? $xlsx : $canon_dir), repo_commit => $commit, sha256 => \%sha },
    lineup        => [ map { my %r = %$_; \%r } @{ $C->{lineup} } ],
    std_features  => \%std,
    specs         => \%specs,
    descriptions  => \%desc,
    pricing       => $pricing,
  };
  # rewritten only when something other than the timestamp and commit changed
  my $prev = -f $out ? eval { JSON::PP->new->utf8->decode(slurp_bytes($out)) } : undef;
  if ($prev) { delete $prev->{generated_utc}; $prev->{source}{repo_commit} = $commit }
  my $same = $prev && $J->encode($prev) eq $J->encode($data);
  $data->{generated_utc} = $now;
  my $json = $J->encode($data); $json .= "\n" unless $json =~ /\n$/;
  if ($same) { printf "  %-28s unchanged\n", 'WB CANON DATA.json' } else { put_atomic($out, encode('UTF-8', $json), 'WB CANON DATA.json') }
}

# ------------------------------------------------- the full check, again ----
unless ($dry) {
  if ($mode eq 'xlsx') {
    print "\nFULL PRICE CHECK (mirrors and the Sales Order Creator file included):\n";
    my ($rows) = verify_pricing(repo => $repo, tabs => $tabs, mirrors => $canon_dir, soc_file => $soc_out);
    printf "  %-40s %-4s %s\n", @$_ for @$rows;
    my $f = grep { $_->[1] eq 'FAIL' } @$rows;
    die "\nFULL CHECK FAILED after writing - the website files are in place and proven, but a file outside it is not. Read the table above.\n" if $f;
  }
  my @changed = git_lines('diff', '--name-only');
  print "\nwebsite files changed (commit them; Stephen or Tyler pushes):\n", (@changed ? map { "  $_\n" } @changed : "  none\n");
}

# ------------------------------------------------------------ 6. downstream ----
# Everything else canon reaches outside the website. Each step runs when what it reads changed,
# from wherever this run can reach it; what it cannot reach is OWED, naming the machine.
my $canon_root = dirname($canon_dir);            # CANON
my $sqh        = dirname($canon_root);           # SQUIRREL HOLE
my $odroot     = dirname(dirname($sqh));         # OneDrive - Wooldridge Boats Inc (the library sits one level in)
$pipeline  = "$sqh/60 SALES AND DEALERS/PRICE SHEETS/_PIPELINE" unless defined $pipeline;
$qb_import = "$odroot/Desktop/QB IMPORT" unless defined $qb_import;
my $is_win = ($^O =~ /^(MSWin32|cygwin|msys)$/);
my @done;
my ($packages_changed, $addons_changed) = (0, 0);
my $mirror_changed = sub { my ($t) = @_; my $p = "$canon_dir/$t.csv"; return (-f $p ? slurp_bytes($p) : '') ne ($old_mirror{$t} // '') };
sub winpath { my ($p) = @_; return $p unless $^O eq 'cygwin' || $^O eq 'msys'; my $w = `cygpath -w "$p"`; chomp $w; return $w }
sub same_but_stamps {                # generated pages carry a build time; compare without it
  my ($a, $b) = @_;
  for ($a, $b) { s/\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2})?//g; s/^.*"canon_engines_file".*$//mg }
  return $a eq $b;
}
sub in_dir { my ($d, $code) = @_; my $here = Cwd::getcwd(); chdir $d or die "cannot enter $d: $!\n"; my @r = eval { $code->() }; my $e = $@; chdir $here; die $e if $e; return @r }
require File::Temp;
my $tmpd = File::Temp::tempdir('canon-XXXXXX', TMPDIR => 1, CLEANUP => 1);

if ($mode eq 'xlsx' && !$dry) {
  print "\nDOWNSTREAM\n";
  # a. PACKAGES - regenerated from the package recipes against the live catalogue (CANON\_build\gen_packages_csv.pl)
  my $gp = "$canon_root/_build/gen_packages_csv.pl";
  if (-f $gp && -f "$pipeline/package-recipes.json") {
    my $csv = "$tmpd/PACKAGES.csv";
    run_perl('gen_packages_csv.pl', $gp, $repo, "$pipeline/package-recipes.json", $pipeline, $csv);
    my $want = slurp_bytes($csv);
    if ($want eq slurp_bytes("$canon_dir/PACKAGES.csv")) { printf "  %-28s in step with the recipes\n", 'PACKAGES tab' }
    elsif ($is_win && -f "$canon_root/_build/write_tab_from_csv.ps1") {
      my $r = system('powershell.exe', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', winpath("$canon_root/_build/write_tab_from_csv.ps1"),
        '-Workbook', winpath($xlsx), '-Tab', 'PACKAGES', '-NewCsv', winpath($csv), '-Mirror', winpath("$canon_dir/PACKAGES.csv"),
        '-NumericCols', 'tier1_ready_to_run_usd,tier2_outfitted_usd,tier3_fully_loaded_usd',
        '-KeyCols', 'model_id,row_type,configuration_length,power_option_or_add', '-Apply');
      if ($r) { push @owed, 'PACKAGES tab: the workbook write stopped (its message is above) - close the workbook in Excel and run the command again on the P3' }
      else {
        $tabs = read_xlsx_tabs($xlsx, { dates => 1 });
        my $b = mirror_bytes($tabs->{PACKAGES}, 'PACKAGES', slurp_bytes("$canon_dir/PACKAGES.csv"));
        die "PACKAGES: the workbook tab does not re-read as the regenerated CSV after the write\n" unless $b eq $want;
        put_atomic("$canon_dir/PACKAGES.csv", $b, 'CSV MIRRORS/PACKAGES.csv');
        $packages_changed = 1; push @done, 'PACKAGES tab and its mirror regenerated from the recipes (Excel write proved)';
      }
    } else { push @owed, 'PACKAGES tab: package prices moved - run the command on the P3 (the workbook tab is written through Excel)' }
  } else { push @owed, 'PACKAGES tab: PRICE SHEETS/_PIPELINE or CANON/_build not reachable from here' }

  # b. the trailer shop add-ons the price sheets print (_PIPELINE/trailer-addons-blessed.json <- SHOP ADD-ON rows)
  my $bj = "$pipeline/trailer-addons-blessed.json";
  if (-f $bj) {
    my $raw = slurp_bytes($bj); my $txt = Encode::decode('UTF-8', $raw);
    my ($root) = WBPriceCanon::jparse($txt, 0);
    my %c = map { $_->{item} => $_ } @{ canon_from_tabs($tabs)->{ADDONS} };
    my (@sp, %seen, @odd);
    for my $it (@{ $root->{h}{items}{a} }) {
      my $dn = $it->{h}{d}; my $d = JSON::PP->new->allow_nonref->decode(substr($txt, $dn->{s}, $dn->{e} - $dn->{s} + 1)); $seen{$d} = 1;
      my $cr = $c{$d} or do { push @odd, "$d is in the price-sheet add-ons but not in the TRAILERS tab"; next };
      my $pn = $it->{h}{p};
      push @sp, [$pn->{s}, $pn->{e} - $pn->{s} + 1, fmt_price($cr->{item_retail_usd_markup_baked})] unless WBPriceCanon::numeq($pn->{v}, $cr->{item_retail_usd_markup_baked});
    }
    push @odd, map { "$_ is a SHOP ADD-ON row but not in the price-sheet add-ons" } grep { !$seen{$_} } sort keys %c;
    push @owed, map { "trailer add-ons (not wired yet): $_" } @odd;
    if (@sp) { put_atomic($bj, Encode::encode('UTF-8', apply_splices($txt, \@sp)), 'trailer-addons-blessed.json'); $addons_changed = 1; push @done, scalar(@sp) . ' trailer shop add-on price(s) into the price sheets\' add-ons' }
    else { printf "  %-28s in step with SHOP ADD-ON rows\n", 'trailer add-ons' }
  } else { push @owed, 'trailer shop add-ons: PRICE SHEETS/_PIPELINE not reachable from here' }

  # c. the branded price sheets (library PRICE SHEETS tree, every format) + Tyler's SALES TOOLS PDFs
  my $need = $price_changes || $content_changes || $packages_changed || $addons_changed;
  if (!$need) { printf "  %-28s no price, package or standard feature moved - not regenerated\n", 'branded price sheets' }
  elsif ($sheets eq 'skip') { push @owed, 'branded price sheets + SALES TOOLS publish (skipped by --sheets skip)' }
  elsif (!-d $pipeline) { push @owed, 'branded price sheets + SALES TOOLS publish: PRICE SHEETS/_PIPELINE not reachable (P3, or a Mac that syncs it)' }
  elsif ((in_dir($pipeline, sub { system('perl', 'WBFonts.pm') }))[0]) { push @owed, 'branded price sheets + SALES TOOLS publish: Rockwell is not installed here (P3, or a Mac with Rockwell in Font Book)' }
  else {
    my $o = "$tmpd/sheets"; mkdir $o or die "cannot make $o\n";
    my $reason = defined $why && length $why ? $why : 'canon update';
    my @steps = (
      [{ WB_OFFICIAL => 1 }, 'gen_pricesheets_wb.pl', $repo, 'template.html', $o],
      [{ WB_OFFICIAL => 1 }, 'gen_docx_wb.pl', $repo, $o],
      [{ WB_OFFICIAL => 1 }, 'gen_idml_wb.pl', $repo, $o],
      [{}, 'gen_trailersheet_wb.pl', $repo, "$o/trailer-content.json"],
      [{}, 'gen_single_wb.pl', $repo, 'template.html', "$o/trailer-content.json", "$o/TRAILER-PRICE SHEET.html", 'EZ Loader Trailers - 2026 Price Sheet - Wooldridge Boats'],
      [{ WB_ONLY => 'trailer' }, 'gen_docx_wb.pl', $repo, $o, "$o/trailer-content.json"],
      [{ WB_ONLY => 'trailer' }, 'gen_idml_wb.pl', $repo, $o, 'trailer', "$o/trailer-content.json"],
      [{}, 'print_all.pl', $o],
      [{}, 'verify_official.pl', $repo, "$o/OUTBOARDS"], [{}, 'verify_official.pl', $repo, "$o/INBOARDS"], [{}, 'verify_official.pl', $repo, "$o/OFFSHORES"],
      [{}, 'verify_trailersheet.pl', $repo, "$o/TRAILER-PRICE SHEET.html"],
      [{}, 'distribute.pl', '--src', $o, '--reason', $reason, ($sheets eq 'dry' ? '--dry-run' : ())],
      [{}, 'publish_sales_tools.pl', $repo, ($sheets eq 'dry' ? '--dry-run' : ())],
    );
    print "  branded price sheets: building in $o, then placing them (" . ($sheets eq 'dry' ? 'DRY RUN - nothing placed' : "archive reason \"$reason\"") . ")\n";
    in_dir($pipeline, sub {
      for my $s (@steps) {
        my ($env, $script, @args) = @$s;
        local @ENV{ keys %$env } = values %$env;
        print "    perl $script\n";
        my $r = system('perl', $script, @args);
        die "branded price sheets: $script failed (exit " . ($r >> 8) . ") - nothing after it ran; the website and canon are already written and proved\n" if $r;
      }
    });
    push @done, $sheets eq 'dry' ? 'branded price sheets built and verified (DRY RUN: not placed, SALES TOOLS not published)' : 'branded price sheets rebuilt, verified, placed (old ones archived) and SALES TOOLS published';
  }

  # d. the sales desk's ITEM CODE LOOKUP page (Desktop, built by QB IMPORT/_build/gen_lookup_canon.pl - P3 only)
  my @lk = grep { $mirror_changed->($_) } qw(BOATS ENGINES OPTIONS TRAILERS);
  push @lk, 'CARRY OUT' if $mirror_changed->('CARRY OUT');
  if (!@lk) { printf "  %-28s its canon files did not change\n", 'ITEM CODE LOOKUP' }
  elsif (-f "$qb_import/_build/gen_lookup_canon.pl") {
    my $page = dirname($qb_import) . '/ITEM CODE LOOKUP.html';
    my $new = "$tmpd/lookup.html";
    in_dir("$qb_import/_build", sub { run_perl('gen_lookup_canon.pl', 'gen_lookup_canon.pl', '--canon', $canon_root, '--out', $new) });
    if (-f $page && same_but_stamps(slurp_bytes($new), slurp_bytes($page))) { printf "  %-28s unchanged\n", 'ITEM CODE LOOKUP' }
    else { put_atomic($page, slurp_bytes($new), 'ITEM CODE LOOKUP.html'); push @done, 'ITEM CODE LOOKUP rebuilt from canon' }
  } else { push @owed, 'ITEM CODE LOOKUP page: rebuild on the P3 (Desktop/QB IMPORT/_build/gen_lookup_canon.pl) - ' . join(', ', @lk) . ' changed' }

  # e. the used-boat appraiser (reads BOATS + TRAILERS)
  my $ap = "$sqh/60 SALES AND DEALERS/TRADE INS AND PREOWNED/APPRAISAL TOOL";
  if (!$mirror_changed->('BOATS') && !$mirror_changed->('TRAILERS')) { printf "  %-28s its canon files did not change\n", 'used-boat appraiser' }
  elsif (-f "$ap/gencanon.pl" && -f "$ap/WB USED BOAT APPRAISER.html") {
    my $copy = "$tmpd/appraiser.html"; { open my $fh, '>:raw', $copy or die "cannot write $copy\n"; print $fh slurp_bytes("$ap/WB USED BOAT APPRAISER.html"); close $fh }
    run_perl('gencanon.pl', "$ap/gencanon.pl", $canon_dir, $copy);
    if (same_but_stamps(slurp_bytes($copy), slurp_bytes("$ap/WB USED BOAT APPRAISER.html"))) { printf "  %-28s unchanged\n", 'used-boat appraiser' }
    else { put_atomic("$ap/WB USED BOAT APPRAISER.html", slurp_bytes($copy), 'WB USED BOAT APPRAISER.html'); push @done, 'used-boat appraiser price block regenerated' }
  } else { push @owed, 'used-boat appraiser: not reachable from here (SQUIRREL HOLE/60.../APPRAISAL TOOL)' }

  # f. the prop selector (reads the ENGINES tab's motor list)
  my $pr = "$sqh/80 ENGINEERING AND DESIGN/PROPULSION REFERENCE/PROP SELECTOR";
  if (!$mirror_changed->('ENGINES')) { printf "  %-28s its canon file did not change\n", 'prop selector' }
  elsif (-f "$pr/_PIPELINE/build_reference.pl") {
    my $w = "$tmpd/prop"; mkdir $w;
    system('cp', '-r', "$pr/_PIPELINE", "$pr/PROP TEST DATA.js", $w) == 0 or die "prop selector: cannot stage a scratch copy\n";
    in_dir($w, sub { run_perl('build_reference.pl', "$w/_PIPELINE/build_reference.pl", $w, "$repo/_build/specs-data.json", "$canon_dir/ENGINES.csv") });
    if (same_but_stamps(slurp_bytes("$w/PROP REFERENCE DATA.js"), slurp_bytes("$pr/PROP REFERENCE DATA.js"))) { printf "  %-28s unchanged\n", 'prop selector' }
    else { put_atomic("$pr/PROP REFERENCE DATA.js", slurp_bytes("$w/PROP REFERENCE DATA.js"), 'PROP REFERENCE DATA.js'); push @done, 'prop selector data rebuilt' }
  } else { push @owed, 'prop selector: not reachable from here' }

  # g. the "Boat facts" view in CANON.html (owned by the "CANON - one viewer" session; agreed 2026-10-14).
  #    Every real run; a failure is loud but does not fail the canon run - the canon is already written and proved.
  my $bf = "$canon_root/_build/BOAT FACTS/build_boat_facts.pl";
  if (-f $bf) {
    my $r = system('perl', $bf, '--canon', $canon_root, '--repo', $repo);
    if ($r) { print "  !! build_boat_facts.pl failed (exit " . ($r >> 8) . ") - the Boat facts view in CANON.html is stale\n";
              push @owed, 'Boat facts view (CANON.html): build_boat_facts.pl failed - read its message above and re-run it' }
    else { push @done, 'Boat facts view (CANON.html) rebuilt' }
  } else { printf "  %-28s not installed yet (CANON/_build/BOAT FACTS/build_boat_facts.pl)\n", 'Boat facts view' }
}

# ------------------------------------------------- 7. the QuickBooks typing list ----
# One line per ^ item whose canon price moved in this run (old mirror -> the workbook now). QuickBooks is
# typed by hand (Stephen, 2026-09-22); this is the decision-free list for whoever types it.
my @qb;
if ($mode eq 'xlsx' && !$dry) {
  my %spec = (BOATS => ['qb_item_full_path', 'price_usd'], ENGINES => ['qb_item_full_path', 'price_usd'], OPTIONS => ['qb_item_full_path', 'price_usd'],
              TRAILERS => ['qb_item_full_path', 'as_stocked_retail'], 'CARRY OUT' => ['qb_caret_item_full_path', 'price_usd']);
  for my $t (sort keys %spec) {
    next unless $mirror_changed->($t) || $old_mirror{$t} ne mirror_bytes($tabs->{$t}, $t, $old_mirror{$t});
    my ($pc, $vc) = @{ $spec{$t} };
    my (%was, %now);
    my ($h0, $r0) = WBSpecCanon::parse_csv_text(Encode::decode('UTF-8', $old_mirror{$t}), $t);
    my %i0; @i0{@$h0} = 0 .. $#$h0;
    for my $r (@$r0) { my $p = $r->[ $i0{$pc} ] // ''; next unless $p =~ /^\^/; $was{$p}{ $r->[ $i0{$vc} ] // '' }++ }
    for my $r (@{ WBPriceCanon::rows_of($tabs->{$t}, $t) }) { my $p = $r->{$pc} // ''; next unless $p =~ /^\^/; $now{$p}{ $r->{$vc} // '' }++ }
    for my $p (sort keys %now) {
      my @n = sort keys %{ $now{$p} }; my @w = sort keys %{ $was{$p} || {} };
      next if @n == 1 && @w == 1 && WBPriceCanon::numeq($n[0], $w[0]);
      my $show = sub { join(' / ', map { $_ eq '' ? 'on request' : $_ } @_) };
      push @qb, [$t, $p, (@w ? $show->(@w) : '(new item)'), $show->(@n), (@n > 1 ? 'ROWS DISAGREE - one QuickBooks item carries one price; settle it in the workbook' : '')];
    }
  }
  if (@qb) {
    my $csv = "tab,qb_item,canon_price_before,canon_price_now,note\n" . join('', map { join(',', map { my $v = $_; $v =~ /[",]/ ? do { $v =~ s/"/""/g; qq{"$v"} } : $v } @$_) . "\n" } @qb);
    my $next; if (opendir my $dh, $qb_import) { ($next) = map { "$qb_import/$_" } grep { /^1 - NEXT IMPORT/ && -d "$qb_import/$_" } readdir $dh; closedir $dh }
    my @lt = localtime; my $stamp = sprintf('%04d-%02d-%02d %02d%02d', $lt[5] + 1900, $lt[4] + 1, $lt[3], $lt[2], $lt[1]);
    print "\nQUICKBOOKS - type these prices (" . scalar(@qb) . " item(s)):\n";
    printf "  %-48s %12s -> %s %s\n", $_->[1], $_->[2], $_->[3], $_->[4] for @qb;
    if ($next) { my $f = "$next/QB PRICES TO TYPE - $stamp.csv"; put_atomic($f, "\xEF\xBB\xBF" . Encode::encode('UTF-8', $csv), "QB IMPORT/" . basename($next) . "/QB PRICES TO TYPE - $stamp.csv"); push @owed, "QuickBooks: type the " . scalar(@qb) . " price(s) in \"QB PRICES TO TYPE - $stamp.csv\" (QB IMPORT, 1 - NEXT IMPORT)" }
    else { push @owed, 'QuickBooks: type the ' . scalar(@qb) . ' price(s) listed above (the QB IMPORT folder is on the P3; this run could not save the list there)' }
  }
}

# ------------------------------------------------------------ the final check ----
if ($mode eq 'xlsx' && !$dry) {
  print "\nFINAL CHECK (everything this run reached, the price-sheet add-ons included):\n";
  my ($rows) = verify_pricing(repo => $repo, tabs => $tabs, mirrors => $canon_dir, soc_file => $soc_out, (-d $pipeline ? (pipeline => $pipeline) : ()));
  printf "  %-40s %-4s %s\n", @$_ for @$rows;
  my $f = grep { $_->[1] eq 'FAIL' } @$rows;
  die "\nFINAL CHECK FAILED - read the table above; the CHANGE LOG was not written.\n" if $f;
}

# ------------------------------------------------------------ 8. the CHANGE LOG ----
my $anything = $price_changes || $content_changes || $marker_adds || $packages_changed || $addons_changed;
if ($mode eq 'xlsx' && !$dry && $anything) {
  my $readme = dirname($canon_dir) . '/README.md';
  my @lt = localtime; my $date = sprintf('%04d-%02d-%02d', $lt[5] + 1900, $lt[4] + 1, $lt[3]);
  my @what; push @what, "$price_changes price(s)" if $price_changes; push @what, "$content_changes spec change(s)" if $content_changes;
  push @what, 'package prices regenerated' if $packages_changed && !$price_changes;
  my $who = (defined $by && length $by) ? "entered by $by" : 'entered by NOT GIVEN - fill in';
  my $disc = (defined $with && length $with) ? "discussed with $with" : 'discussed with NOT GIVEN - fill in';
  my $e = "\n### $date - " . join(', ', @what) . " via the canon command ($who, $disc)\n\n";
  $e .= "- **Why**: $why\n" if defined $why && length $why;
  if ($price_changes) {
    my %bytab; push @{ $bytab{ $_->{tab} } }, $_ for @$price_list;
    for my $t (sort keys %bytab) {
      $e .= "- **$t tab**: " . scalar(@{ $bytab{$t} }) . " price(s): " . join('; ', map { ($_->{key} =~ s/^[A-Z]+\|//r) . ' ' . ($_->{site} eq '' ? 'on request' : $_->{site}) . ' -> ' . ($_->{canon} eq '' ? 'on request' : $_->{canon}) } @{ $bytab{$t} }) . ".\n";
    }
  }
  $e .= "- **Specs**: $content_changes content change(s) carried to the configurator and model pages.\n" if $content_changes;
  $e .= "- **Generator run**: `gen_from_canon.pl $VERSION --xlsx` $date, both checks PASS; website files written, NOT pushed (Stephen or Tyler pushes).\n";
  $e .= "- **Done downstream**: " . join('; ', @done) . ".\n" if @done;
  $e .= "- **Owed**: " . join('; ', @owed) . ".\n" if @owed;
  my $rb = slurp_bytes($readme);
  my $eol = ($rb =~ /\r\n/) ? "\r\n" : "\n";
  (my $eb = $e) =~ s/\n/$eol/g;
  $rb .= $eol unless $rb =~ /\n\z/;
  put_atomic($readme, $rb . Encode::encode('UTF-8', $eb), 'README.md CHANGE LOG');
  print "  !! the CHANGE LOG entry has no name - fill in who entered it and who it was discussed with\n" unless defined $by && length $by;
}

print "\nDONE DOWNSTREAM:\n", (@done ? map { "  - $_\n" } @done : "  nothing needed\n") if $mode eq 'xlsx' && !$dry;
push @owed, "Tyler's SPECS-STANDARD FEATURES PDFs (his Mac; verify_spec_canon.pl audits them)" if $content_changes;
print "\nOWED - not done by this run:\n", (@owed ? map { "  - $_\n" } @owed : "  nothing\n");
exit 0;
