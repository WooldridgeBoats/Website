#!/usr/bin/perl
# gen_sitemap.pl — regenerate sitemap.xml from the pages actually in the repo.
#
#   perl _build/gen_sitemap.pl              # write sitemap.xml
#   perl _build/gen_sitemap.pl --check      # report only, change nothing
#
# RUN THIS AFTER ADDING OR REMOVING A PAGE, BEFORE COMMITTING A DEPLOY.
#
# Why it exists: a hand-written sitemap goes stale the first time someone adds a
# model page, and a stale sitemap is worse than no sitemap — it tells Google
# about URLs that no longer exist and stays quiet about the ones that do. This
# script derives the list from the filesystem so it cannot drift.
#
# NO <lastmod>. Deliberate. File mtimes on this machine are churned by OneDrive
# and by every bulk regeneration (inject_partials, stamp_assets), so an mtime
# would claim a page changed when only its cache-busting hash moved. Google
# discounts lastmod it can't trust anyway. Omitting it is honest; a wrong one is
# actively misleading.
#
# Idempotent. Prints exactly what it included and what it skipped, and why —
# there is no silent truncation anywhere in here.

use strict;
use warnings;
use File::Basename qw(dirname);
use File::Find;
use Cwd qw(abs_path);

my $BASE = 'https://www.wooldridgeboats.com';

my $check_only = 0;
my @args;
for my $a (@ARGV) { if ($a eq '--check') { $check_only = 1 } else { push @args, $a } }
my $root = abs_path($args[0] // dirname(dirname(abs_path(__FILE__))));

# ---------------------------------------------------------------------------
# Exclusions. Every one carries its reason, because the next person to read this
# will want to know whether a missing page is a bug or a decision.
# ---------------------------------------------------------------------------
my @SKIP = (
  [ qr{^header\.html$},            'partial, not a page' ],
  [ qr{^footer\.html$},            'partial, not a page' ],
  [ qr{^404\.html$},               'error page — must never be indexed' ],
  [ qr{^lp/},                      'campaign landing pages carry deliberately stale pricing (standing governance ruling: leave lp/ alone)' ],
  [ qr{^forms/},                   'handlers and the defended submissions dir' ],
  [ qr{^tools/},                   'internal/dealer tools and JS data files, not public content' ],
  [ qr{^store/},                   '301s to store.wooldridgeboats.com' ],
  [ qr{^models/xp/},               'carries noindex and canonicalises to /models/skagit/' ],
  [ qr{^login/},                   'redirect stub for the retired WordPress /login/ URL — noindex, forwards to /dealer-resources/' ],
  [ qr{^_build/},                  'build scripts' ],
  [ qr{^PHOTO PATHWAYS/},          'working files' ],
  [ qr{^\.claude/},                'tooling config' ],
);

sub url_for {
  my ($rel) = @_;
  return "$BASE/" if $rel eq 'index.html';
  if ($rel =~ s{/index\.html$}{/}) { return "$BASE/$rel" }
  return "$BASE/$rel";
}

sub xml_escape {
  my ($s) = @_;
  $s =~ s/&/&amp;/g; $s =~ s/</&lt;/g; $s =~ s/>/&gt;/g;
  $s =~ s/"/&quot;/g; $s =~ s/'/&apos;/g;
  return $s;
}

my (@pages, @skipped);
find({
  no_chdir => 1,
  wanted => sub {
    my $p = $File::Find::name;
    return unless -f $p;
    return unless $p =~ /\.html$/i;
    my $rel = $p;
    $rel =~ s{^\Q$root\E/?}{};
    $rel =~ s{\\}{/}g;
    return if $rel =~ m{(^|/)\.git/};
    for my $s (@SKIP) {
      if ($rel =~ $s->[0]) { push @skipped, [$rel, $s->[1]]; return }
    }
    push @pages, $rel;
  },
}, $root);

@pages = sort @pages;
@skipped = sort { $a->[0] cmp $b->[0] } @skipped;

my $xml = qq{<?xml version="1.0" encoding="UTF-8"?>\n}
        . qq{<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n};
$xml .= "  <url><loc>" . xml_escape(url_for($_)) . "</loc></url>\n" for @pages;
$xml .= "</urlset>\n";

my $out = "$root/sitemap.xml";
my $existing = '';
if (open my $fh, '<:raw', $out) { local $/; $existing = <$fh>; close $fh; }

printf "pages included: %d\n", scalar @pages;
printf "pages skipped:  %d\n", scalar @skipped;
print "  - $_->[0]  ($_->[1])\n" for @skipped;

if ($existing eq $xml) {
  print "sitemap.xml already current — no change.\n";
  exit 0;
}

if ($check_only) {
  print "sitemap.xml WOULD CHANGE (run without --check to write it).\n";
  exit 1;
}

open my $fh, '>:raw', $out or die "can't write $out: $!";
print $fh $xml;
close $fh;
print "sitemap.xml written: $out\n";
exit 0;
