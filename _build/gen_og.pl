#!/usr/bin/perl
# gen_og.pl - stamp Open Graph + Twitter card tags into the pages people share.
#
#   perl _build/gen_og.pl            # write
#   perl _build/gen_og.pl --check    # report only, change nothing (exit 1 if anything would change)
#
# Added 2026-11-12 for the paid video campaign: a link pasted into Facebook, Messenger, iMessage
# or a text shows a card built from these tags. Before this, no page carried any, so the card was
# whatever the scraper guessed.
#
# NO COPY IS WRITTEN HERE. Every value comes from the page itself:
#   og:title        = the page's <title>
#   og:description  = the page's <meta name="description">
#   og:url          = the page's canonical (gen_canonicals.pl owns that; run it first)
#   og:image        = models/<slug>/ : the page's own first assets/photos/.../hero-*.jpg
#                     every other page in @PAGES : the home page's hero poster
#   og:type website, og:site_name Wooldridge Boats, twitter:card summary_large_image
# A page with no title, no description, a cross-canonical (a variant pointing elsewhere), a
# noindex, or (model pages) no hero photo is SKIPPED and named in the report - never guessed.
#
# The block lives between <!-- OG --> and <!-- /OG --> just before </head>; re-running replaces it,
# so it is idempotent. RE-RUN after a model page's hero photo changes name (Tyler's Model Ready
# pipeline) or a title/description changes; --check reports the drift. Cloudflare keeps photos for
# 7 days and Facebook caches cards on its side: a changed og:image may need the Sharing Debugger's
# "Scrape Again".
use strict;
use warnings;
use File::Basename qw(dirname);
use Cwd qw(abs_path);

my $BASE = 'https://www.wooldridgeboats.com';
my $DEFAULT_IMG = 'assets/homepage/hero-poster.jpg';
my $check_only = grep { $_ eq '--check' } @ARGV;
my $root = dirname(dirname(abs_path(__FILE__)));

# Pages outside models/ that get a card (campaign landing and lead pages). Add here, never per page.
my @PAGES = qw(
  index.html
  build-and-price/index.html
  request-a-quote/index.html
  which-wooldridge/index.html
  compare/index.html
  contact/index.html
);
opendir(my $dh, "$root/models") or die "models/: $!";
my @models = sort grep { !/^\./ && -f "$root/models/$_/index.html" } readdir $dh;
closedir $dh;
push @PAGES, map { "models/$_/index.html" } @models;

sub slurp { my ($f) = @_; open my $h, '<:raw', $f or die "$f: $!"; local $/; my $t = <$h>; close $h; $t }
sub spit  { my ($f, $t) = @_; open my $h, '>:raw', $f or die "$f: $!"; print $h $t; close $h }
sub attr  { my ($s) = @_; $s =~ s/^\s+|\s+$//g; $s =~ s/\s+/ /g; $s =~ s/"/&quot;/g; $s =~ s/</&lt;/g; $s =~ s/>/&gt;/g; $s }
sub self_url { my ($rel) = @_; return "$BASE/" if $rel eq 'index.html'; (my $u = $rel) =~ s{index\.html$}{}; "$BASE/$u" }

my (@changed, @same, @skipped);
for my $rel (@PAGES) {
  my $f = "$root/$rel";
  my $t = slurp($f);
  my $orig = $t;
  (my $head) = $t =~ m{<head\b[^>]*>(.*?)</head>}si;
  unless (defined $head) { push @skipped, [$rel, 'no <head>']; next }
  if ($head =~ m{<meta\b[^>]*name\s*=\s*["']robots["'][^>]*noindex}i) { push @skipped, [$rel, 'noindex variant']; next }
  my ($title) = $head =~ m{<title>(.*?)</title>}si;
  my ($desc)  = $head =~ m{<meta\b[^>]*\bname\s*=\s*["']description["'][^>]*\bcontent\s*=\s*"([^"]*)"}si;
  my ($canon) = $head =~ m{<link\b[^>]*\brel\s*=\s*["']canonical["'][^>]*\bhref\s*=\s*["']([^"']+)["']}si;
  unless (defined $title && length $title) { push @skipped, [$rel, 'no <title>']; next }
  unless (defined $desc  && length $desc)  { push @skipped, [$rel, 'no meta description']; next }
  unless (defined $canon) { push @skipped, [$rel, 'no canonical - run gen_canonicals.pl first']; next }
  if ($canon ne self_url($rel)) { push @skipped, [$rel, "cross-canonical to $canon"]; next }

  my $img;
  if ($rel =~ m{^models/}) {
    # first hero photo the page itself shows (the .modelhero figure, or the custom pages' hero slider)
    ($img) = $t =~ m{<img\b[^>]*\bsrc\s*=\s*["'](?:\.\./)*/?(assets/photos/[^"'?#]*/hero-[^"'?#/]+\.jpe?g)["']}i;
    unless ($img) { push @skipped, [$rel, 'no hero-*.jpg on the page']; next }
  } else {
    $img = $DEFAULT_IMG;
  }
  unless (-f "$root/$img") { push @skipped, [$rel, "image not on disk: $img"]; next }

  my $block = "<!-- OG -->\n"
    . qq{<meta property="og:type" content="website">\n}
    . qq{<meta property="og:site_name" content="Wooldridge Boats">\n}
    . qq{<meta property="og:title" content="} . attr($title) . qq{">\n}
    . qq{<meta property="og:description" content="} . attr($desc) . qq{">\n}
    . qq{<meta property="og:url" content="$canon">\n}
    . qq{<meta property="og:image" content="$BASE/$img">\n}
    . qq{<meta name="twitter:card" content="summary_large_image">\n}
    . "<!-- /OG -->\n";

  if ($t =~ m{<!-- OG -->.*?<!-- /OG -->\n?}s) { $t =~ s{<!-- OG -->.*?<!-- /OG -->\n?}{$block}s }
  else { $t =~ s{(</head>)}{$block$1}i }

  if ($t eq $orig) { push @same, $rel; next }
  push @changed, [$rel, "$BASE/$img"];
  spit($f, $t) unless $check_only;
}

printf "Open Graph %s: %d page(s)\n", ($check_only ? 'WOULD CHANGE' : 'written'), scalar @changed;
print "  $_->[0]  image $_->[1]\n" for @changed;
printf "already current: %d\n", scalar @same;
printf "skipped: %d\n", scalar @skipped;
print "  $_->[0]  ($_->[1])\n" for @skipped;
exit(($check_only && @changed) ? 1 : 0);
