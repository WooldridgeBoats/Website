#!/usr/bin/perl
# gen_canonicals.pl — stamp an absolute <link rel="canonical"> into every page.
#
#   perl _build/gen_canonicals.pl            # write
#   perl _build/gen_canonicals.pl --check    # report only, change nothing
#
# RUN THIS AFTER ADDING OR MOVING A PAGE, BEFORE COMMITTING A DEPLOY.
#
# Why it exists: before 25 August 2026 not one page on this site carried a
# canonical tag, while dev.wooldridgeboats.com served a full, crawlable copy of
# the whole site with no noindex and no password. Two identical sites and no
# instruction about which is real — so Google picks, and sometimes picks dev.
#
# An ABSOLUTE canonical fixes that without the dangerous alternative. The
# tempting fix is to put <meta name="robots" content="noindex"> on dev, but dev
# and production are built from THIS SAME REPO — push that tag and it
# de-indexes the live website. Never add a repo-wide noindex. An absolute
# canonical is safe in both places: on dev it says "the real one is www", and on
# production it says "yes, this is the real one".
#
# DELIBERATE CROSS-CANONICALS ARE PRESERVED. models/xp/index.html canonicalises
# to /models/skagit/ on purpose (it is a noindex variant of that page). This
# script never redirects an existing canonical at its own page — it only makes
# the URL absolute. Only pages with NO canonical, or a self-referential one, get
# a self canonical written.
#
# Idempotent. Reports every file it touched and every one it skipped, with why.

use strict;
use warnings;
use File::Basename qw(dirname basename);
use File::Find;
use Cwd qw(abs_path);

my $BASE = 'https://www.wooldridgeboats.com';

my $check_only = 0;
my @args;
for my $a (@ARGV) { if ($a eq '--check') { $check_only = 1 } else { push @args, $a } }
my $root = abs_path($args[0] // dirname(dirname(abs_path(__FILE__))));

my @SKIP = (
  [ qr{^header\.html$},   'partial, has no <head> of its own' ],
  [ qr{^footer\.html$},   'partial, has no <head> of its own' ],
  [ qr{^404\.html$},      'error page — noindex, must not claim a canonical URL' ],
  [ qr{^forms/},          'handlers and the defended submissions dir' ],
  [ qr{^tools/},          'internal/dealer tools, not indexable content' ],
  [ qr{^_build/},         'build scripts' ],
  [ qr{^PHOTO PATHWAYS/}, 'working files' ],
  [ qr{^\.claude/},       'tooling config' ],
  [ qr{(^|/)_[^/]*\.html$}, 'underscore-prefixed template/hub, not a published page' ],
);

sub self_url {
  my ($rel) = @_;
  return "$BASE/" if $rel eq 'index.html';
  if ($rel =~ s{/index\.html$}{/}) { return "$BASE/$rel" }
  return "$BASE/$rel";
}

sub absolutise {
  my ($href) = @_;
  return $href if $href =~ m{^https?://};
  $href =~ s{^/}{};
  return "$BASE/$href";
}

sub slurp { my ($f)=@_; open my $fh,'<:raw',$f or die "can't read $f: $!"; local $/; my $d=<$fh>; close $fh; $d }

my (@changed, @already, @skipped, @nohead, @kept_cross);

find({
  no_chdir => 1,
  wanted => sub {
    my $p = $File::Find::name;
    return unless -f $p;
    return unless $p =~ /\.html$/i;
    my $rel = $p; $rel =~ s{^\Q$root\E/?}{}; $rel =~ s{\\}{/}g;
    return if $rel =~ m{(^|/)\.git/};
    for my $s (@SKIP) { if ($rel =~ $s->[0]) { push @skipped, [$rel,$s->[1]]; return } }

    my $body = slurp($p);
    my $orig = $body;

    unless ($body =~ m{</head>}i) { push @nohead, $rel; return }

    my $self = self_url($rel);
    my $want = $self;

    # An existing canonical wins on TARGET; we only normalise its form.
    if ($body =~ m{<link\b[^>]*\brel\s*=\s*["']canonical["'][^>]*>}i) {
      my ($tag) = $body =~ m{(<link\b[^>]*\brel\s*=\s*["']canonical["'][^>]*>)}i;
      my ($href) = $tag =~ m{\bhref\s*=\s*["']([^"']*)["']}i;
      if (defined $href && length $href) {
        my $abs = absolutise($href);
        $want = $abs;
        push @kept_cross, [$rel, $abs] if $abs ne $self;
      }
      my $new = qq{<link rel="canonical" href="$want">};
      $body =~ s{<link\b[^>]*\brel\s*=\s*["']canonical["'][^>]*>}{$new}i;
    } else {
      my $new = qq{<link rel="canonical" href="$want">\n};
      $body =~ s{(</head>)}{$new$1}i;
    }

    if ($body eq $orig) { push @already, $rel; return }
    push @changed, [$rel, $want];
    return if $check_only;
    open my $fh, '>:raw', $p or die "can't write $p: $!";
    print $fh $body; close $fh;
  },
}, $root);

printf "canonical %s: %d file(s)\n", ($check_only ? 'WOULD CHANGE' : 'written'), scalar @changed;
print "  $_->[0]  ->  $_->[1]\n" for @changed;
printf "already current: %d\n", scalar @already;
if (@kept_cross) {
  printf "deliberate cross-canonicals preserved: %d\n", scalar @kept_cross;
  print "  $_->[0]  ->  $_->[1]\n" for @kept_cross;
}
if (@nohead) {
  printf "NO <head>, left alone: %d\n", scalar @nohead;
  print "  $_\n" for @nohead;
}
printf "skipped: %d\n", scalar @skipped;
print "  $_->[0]  ($_->[1])\n" for @skipped;

exit(($check_only && @changed) ? 1 : 0);
