#!/usr/bin/perl
# gen_redirects.pl - write the REDIRECTS block of /.htaccess from _build/redirects/old_urls.tsv.
#
# Only rows whose status is REDIRECT (sourced) or APPROVED (Stephen said yes) become rules.
# Everything between the two marker lines is regenerated; the rest of .htaccess is never touched.
# Idempotent. --check reports what would change and exits 1 if the block is out of date.
#
#   perl _build/redirects/gen_redirects.pl            write the block
#   perl _build/redirects/gen_redirects.pl --check    dry run
#
# Rule shape (Apache mod_rewrite, per-directory context, so patterns have no leading slash):
#   - a page address matches with or without its trailing slash (a /product/ one also with its "/feed/" tail);
#   - a file address (.pdf, .xml ...) matches exactly;
#   - every rule is a 301; the query string is carried over (Apache's default).
# A guard in front of the rules stops them for any path that exists on disk, so a page added later
# at an old address always wins over its redirect.
use strict; use warnings;
use File::Basename qw(dirname);
use Cwd qw(abs_path);

my $check = grep { $_ eq '--check' } @ARGV;
my $here = dirname(abs_path($0)); my $repo = abs_path("$here/../..");
my $tsv = "$here/old_urls.tsv"; my $ht = "$repo/.htaccess";
my $BEGIN = '# BEGIN REDIRECTS'; my $END = '# END REDIRECTS';

open my $T, '<:raw', $tsv or die "$tsv: $!";
my (@hdr, %rule, @order, @problems, $nrows);
while (my $l = <$T>) {
  $l =~ s/[\r\n]+\z//; next if $l =~ /^#/ || !length $l;
  my @f = split /\t/, $l, -1;
  if (!@hdr) { @hdr = @f; next }
  my %r; @r{@hdr} = @f;
  next unless $r{status} eq 'REDIRECT' || $r{status} eq 'APPROVED';
  $nrows++;
  my $p = $r{old_path}; my $t = $r{target};
  push @problems, "$p: no target" and next unless length $t;
  push @problems, "$p: target '$t' is neither /path nor https://" and next unless $t =~ m{^(/|https://)};
  push @problems, "$p: target has a space or quote" and next if $t =~ /[\s"']/;
  (my $k = $p) =~ s{^/}{};
  $k =~ s/%([0-9A-Fa-f]{2})/chr(hex $1)/ge;      # Apache matches the DECODED path (%20 arrives as a space)
  my $pat;
  if ($k =~ m{\.[A-Za-z0-9]{2,4}$}) { $pat = '^' . quotemeta($k) . '$' }
  else { my $prod = $k =~ m{^product/}i;          # a product's /feed/ tail rides along with the product;
         $k =~ s{/feed/?$}{}i if $prod;            # any other feed is an address of its own
         $k =~ s{/$}{};
         $pat = '^' . quotemeta($k) . ($prod ? '(?:/feed)?' : '') . '/?$' }
  $pat =~ s/\\-/-/g; $pat =~ s{\\/}{/}g;     # quotemeta over-escapes; keep the rules readable
  $pat =~ s/\\ /\\x20/g;                      # never a bare space: Apache would split the rule there
  if (exists $rule{$pat}) { push @problems, "$p: two targets for one address ($rule{$pat}{t} / $t)" if $rule{$pat}{t} ne $t; $rule{$pat}{hits} += $r{hits}; next }
  $rule{$pat} = { t => $t, hits => $r{hits}, how => $r{status} };
  push @order, $pat;
}
close $T;
die "STOP - nothing written:\n  " . join("\n  ", @problems) . "\n" if @problems;

# Self-test before writing: replay every row of the table through the rules the way Apache would
# (first match wins; Perl regex = PCRE for these patterns). A REDIRECT/APPROVED row must land on its
# own target; any other row (DECIDE, KEEP-404, LIVE) must match nothing; no page in the repo may match.
my @compiled = map { my $re = eval { qr/$_/ } or push @problems, "pattern does not compile: $_"; [$re, $rule{$_}{t}] } @order;
die "STOP - nothing written:\n  " . join("\n  ", @problems) . "\n" if @problems;
sub first_hit { my $k = shift; for (@compiled) { return $_->[1] if $k =~ $_->[0] } undef }
open $T, '<:raw', $tsv or die $!; my @h2; my $tested = 0;
while (my $l = <$T>) {
  $l =~ s/[\r\n]+\z//; next if $l =~ /^#/ || !length $l; my @f = split /\t/, $l, -1;
  if (!@h2) { @h2 = @f; next } my %r; @r{@h2} = @f; next if $r{status} eq 'OTHER-HOST';
  (my $k = $r{old_path}) =~ s{^/}{}; $k =~ s/%([0-9A-Fa-f]{2})/chr(hex $1)/ge; my $hit = first_hit($k); $tested++;
  if ($r{status} eq 'REDIRECT' || $r{status} eq 'APPROVED') { push @problems, "$r{old_path}: rules send it to " . ($hit // 'nothing') . ", table says $r{target}" unless defined $hit && $hit eq $r{target} }
  elsif (defined $hit) { push @problems, "$r{old_path} is $r{status} but a rule sends it to $hit" }
}
close $T;
for my $f (bsd_glob_all($repo)) { (my $k = $f) =~ s{^\Q$repo\E/}{}; $k =~ s{(^|/)index\.html$}{$1}; my $hit = first_hit($k); push @problems, "live page /$k matches a rule (-> $hit); the guard saves it on the server, but fix the table" if defined $hit }
sub bsd_glob_all { my $root = shift; my @out; my @dirs = ($root);
  while (my $d = shift @dirs) { opendir my $D, $d or next; for my $e (readdir $D) { next if $e =~ /^\./ || $e eq '_build' || $e eq 'assets' || $e eq 'PHOTO PATHWAYS';
    my $p = "$d/$e"; if (-d $p) { push @dirs, $p } elsif ($e =~ /\.(html|pdf|xml)$/i) { push @out, $p } } closedir $D }
  @out }
die "STOP - nothing written (self-test):\n  " . join("\n  ", @problems) . "\n" if @problems;
print "self-test: $tested table rows replayed through " . scalar(@order) . " rules, all land where the table says\n";

my @block = (
  "$BEGIN - generated by _build/redirects/gen_redirects.pl from _build/redirects/old_urls.tsv. Do not hand-edit:",
  "# change a row in old_urls.tsv and re-run the script. Old WordPress/WooCommerce addresses -> their new homes.",
  '# Guard: nothing below fires for another host (sales./shop. live in folders under this one) or for a',
  '# path that exists on disk (a real page or folder always wins over its old address).',
  'RewriteCond %{HTTP_HOST} !^(www\.)?wooldridgeboats\.com$ [NC,OR]',
  'RewriteCond %{REQUEST_FILENAME} -f [OR]',
  'RewriteCond %{REQUEST_FILENAME} -d',
  'RewriteRule ^ - [L]',
  map({ "RewriteRule $_ $rule{$_}{t} [R=301,L]" } sort { $a cmp $b } @order),
  $END,
);
my $new_block = join("\n", @block) . "\n";

open my $H, '<:raw', $ht or die "$ht: $!"; local $/; my $cur = <$H>; close $H;
my $nl = $cur =~ /\r\n/ ? "\r\n" : "\n";
(my $nb = $new_block) =~ s/\n/$nl/g;
my $out;
if ($cur =~ /^\Q$BEGIN\E.*?^\Q$END\E[^\n]*\n?/ms) { ($out = $cur) =~ s/^\Q$BEGIN\E.*?^\Q$END\E[^\n]*\n?/$nb/ms }
else { $out = $cur; $out .= $nl unless $out =~ /\n\z/; $out .= $nl . $nb }

printf "%d rows -> %d rules (%d sourced, %d approved by Stephen)\n", $nrows // 0, scalar(@order),
  scalar(grep { $rule{$_}{how} eq 'REDIRECT' } @order), scalar(grep { $rule{$_}{how} eq 'APPROVED' } @order);
if ($out eq $cur) { print ".htaccess REDIRECTS block already current\n"; exit 0 }
if ($check) { print ".htaccess REDIRECTS block is OUT OF DATE (run without --check)\n"; exit 1 }
open $H, '>:raw', $ht or die "$ht: $!"; print $H $out; close $H;
print "wrote the REDIRECTS block into $ht\n";
