#!/usr/bin/perl
# inject_partials.pl — bake header.html / footer.html into every page that
# references them via <!--#include virtual="/header.html" --> style markers.
#
# The site is plain static HTML with no server-side include support (SSI
# isn't available on the host), so header.html and footer.html stay the
# single source of truth for editing, and this script stamps their current
# content into every page that includes them. Re-run after any edit to
# header.html or footer.html, then commit the regenerated pages.
#
# Idempotent: safe to run repeatedly, always replaces the marker (or a
# previously-injected block) with the current partial content.
use strict; use warnings;
use File::Basename qw(dirname);
use File::Find;
use Cwd qw(abs_path);

my $root = dirname(dirname(abs_path(__FILE__)));

sub slurp {
  my ($f) = @_;
  open my $fh, '<:raw', $f or die "can't read $f: $!";
  local $/;
  return <$fh>;
}

my $header = slurp("$root/header.html");
my $footer = slurp("$root/footer.html");

# markers: either the raw SSI comment, or a previously-injected block
# wrapped in BEGIN/END markers so re-runs can find and replace it cleanly.
my $header_open  = qr{<!--\s*PARTIAL:header\s*-->};
my $header_close = qr{<!--\s*/PARTIAL:header\s*-->};
my $footer_open  = qr{<!--\s*PARTIAL:footer\s*-->};
my $footer_close = qr{<!--\s*/PARTIAL:footer\s*-->};

my $n = 0;
find(sub {
  return unless -f and /\.html$/i;
  my $path = $File::Find::name;
  return if $path eq "$root/header.html" or $path eq "$root/footer.html";

  my $body = slurp($path);
  my $orig = $body;

  $body =~ s{<!--\#include\s+virtual="/header\.html"\s*-->}
            {"<!-- PARTIAL:header -->\n" . $header . "<!-- /PARTIAL:header -->"}e;
  $body =~ s{<!--\#include\s+virtual="/footer\.html"\s*-->}
            {"<!-- PARTIAL:footer -->\n" . $footer . "<!-- /PARTIAL:footer -->"}e;
  $body =~ s{$header_open .*? $header_close}
            {"<!-- PARTIAL:header -->\n" . $header . "<!-- /PARTIAL:header -->"}sxe;
  $body =~ s{$footer_open .*? $footer_close}
            {"<!-- PARTIAL:footer -->\n" . $footer . "<!-- /PARTIAL:footer -->"}sxe;

  return if $body eq $orig;
  open my $fh, '>:raw', $path or die "can't write $path: $!";
  print $fh $body;
  close $fh;
  $n++;
  print "updated: $path\n";
}, $root);

print "\n$n file(s) updated.\n";
