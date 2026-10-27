#!/usr/bin/perl
# add_ga4.pl - put the Google Analytics 4 tag on every public page.
#
#   perl _build/add_ga4.pl G-XXXXXXXXXX
#
# Two places, one marker:
#   1. header.html gets the tag at its very top. inject_partials.pl then stamps it
#      into every page that carries <!-- PARTIAL:header --> (129 pages on 2026-10-27).
#      The tag sits at the top of <body> there; GA4's gtag loads async, so that is fine.
#   2. Request a Quote, the one public page that has no header partial (it stays a
#      self-contained single file by design, see the project CLAUDE.md), gets the same
#      tag before </head>.
# The block is wrapped in <!-- GA4 --> ... <!-- /GA4 --> so re-running replaces it
# (change the ID, run again) instead of stacking a second copy. Idempotent.
#
# Not touched on purpose: the tools/*.html redirect stubs (they forward old #b= links and
# must stay as they are), the other redirect stubs (custom-agency-builds, models/xp,
# store), login/, forms/_submissions/ (not public pages), the Sales Assist internal tool,
# footer.html, _build/, .claude/.
use strict; use warnings;
use File::Basename qw(dirname);
use Cwd qw(abs_path);

my $id = shift // die "usage: add_ga4.pl G-XXXXXXXXXX\n";
$id =~ /^G-[A-Z0-9]{6,14}$/ or die "that does not look like a GA4 measurement ID: $id\n";
my $root = dirname(dirname(abs_path(__FILE__)));

my $block = <<"GA";
<!-- GA4 -->
<script async src="https://www.googletagmanager.com/gtag/js?id=$id"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '$id');
</script>
<!-- /GA4 -->
GA

sub slurp { my ($f) = @_; open my $h, '<:raw', $f or die "$f: $!"; local $/; my $t = <$h>; close $h; $t }
sub spit  { my ($f, $t) = @_; open my $h, '>:raw', $f or die "$f: $!"; print $h $t; close $h }

# 1. header partial: the block goes first.
{
  my $f = "$root/header.html"; my $t = slurp($f);
  if ($t =~ s{<!-- GA4 -->.*?<!-- /GA4 -->\n?}{$block}s) { print "header.html: tag replaced\n" }
  else { $t = $block . $t; print "header.html: tag added at the top\n" }
  spit($f, $t);
}

# 2. standalone pages: before </head>.
my @standalone = (
  'request-a-quote/index.html',
);
for my $rel (@standalone) {
  my $f = "$root/$rel";
  unless (-f $f) { print "$rel: not found, skipped\n"; next }
  my $t = slurp($f);
  if ($t =~ /PARTIAL:header/) { print "$rel: carries the header partial, skipped\n"; next }
  if ($t =~ s{<!-- GA4 -->.*?<!-- /GA4 -->\n?}{$block}s) { print "$rel: tag replaced\n"; spit($f, $t); next }
  if ($t =~ s{(</head>)}{$block$1}i) { print "$rel: tag added before </head>\n"; spit($f, $t) }
  else { print "$rel: NO </head> FOUND - not touched\n" }
}
print "\nNow run: perl _build/inject_partials.pl   (stamps header.html into every page)\n";
