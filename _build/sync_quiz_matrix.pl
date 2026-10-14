#!/usr/bin/perl
# sync_quiz_matrix.pl - copy the recommendation matrix (const T) from the quiz
# into the Request a Quote page, so the two public recommenders score from ONE
# matrix.
#
#   perl _build/sync_quiz_matrix.pl          copy it (idempotent)
#   perl _build/sync_quiz_matrix.pl --check  report only; exit 1 if they differ
#
# SOURCE : which-wooldridge/index.html  - between /* MATRIX:BEGIN ... */ and /* MATRIX:END */
# TARGET : request-a-quote/index.html   - same markers
#
# The quiz owns the matrix (the weights Stephen ruled on 2026-09-01 live there).
# Only the text between the markers moves; each page keeps its own BEGIN comment
# and its own scorer. Request a Quote's scoreFit() reads only water/use/crew/load,
# so the quiz-only dimensions ride along harmlessly. Weights are a Stephen + Danny
# call - this script never changes a number, it only carries one.
#
# Then run: node _build/audit_quiz_reach.js  (it fails if the copies differ).
use strict;
use warnings;
use File::Basename qw(dirname);
use File::Spec;

my $check = grep { $_ eq '--check' } @ARGV;
my $root  = File::Spec->rel2abs(File::Spec->catdir(dirname(__FILE__), '..'));
my $src   = "$root/which-wooldridge/index.html";
my $dst   = "$root/request-a-quote/index.html";

sub slurp { my ($f) = @_; open my $fh, '<:raw', $f or die "read $f: $!"; local $/; <$fh> }
sub spew  { my ($f, $c) = @_; open my $fh, '>:raw', $f or die "write $f: $!"; print $fh $c; close $fh or die "close $f: $!" }

my $re = qr{(/\* MATRIX:BEGIN.*?\*/\r?\n)(.*?)(/\* MATRIX:END \*/)}s;

my $s = slurp($src);
my @m = $s =~ /$re/g;
die "FAIL: expected exactly one MATRIX block in $src, found " . (@m / 3) . "\n" unless @m == 3;
my $body = $m[1];
die "FAIL: the MATRIX block in $src does not hold const T\n" unless $body =~ /^const T = \{/;

my $d = slurp($dst);
my $n = () = $d =~ /$re/g;
die "FAIL: expected exactly one MATRIX block in $dst, found " . ($n / 3) . "\n" unless $n == 3;
my ($old) = $d =~ /$re/ ? ($2) : ();

if ($old eq $body) { print "matrix: request-a-quote already matches the quiz - unchanged\n"; exit 0 }
if ($check)        { print "matrix: request-a-quote DIFFERS from the quiz - run perl _build/sync_quiz_matrix.pl\n"; exit 1 }

$d =~ s/$re/$1$body$3/;
spew($dst, $d);
print "matrix: request-a-quote updated from the quiz\n";
