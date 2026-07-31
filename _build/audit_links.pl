#!/usr/bin/perl
# audit_links.pl — every internal href/src on every page must resolve to a
# real file. This host returns a broken 500 for anything that falls through
# to a 404 (documented in .htaccess), so a dead internal link is a hard
# failure, not a cosmetic one. External links are listed, not fetched.
use strict; use warnings;
use File::Find;
use File::Basename qw(dirname);
use Cwd qw(abs_path);

my $root = dirname(dirname(abs_path(__FILE__)));
# Git-for-Windows Perl resolves abs_path() against its POSIX cwd, so invoking this
# script by ABSOLUTE Windows path yields a garbage root ("/c/Users/x/C:/Users/x/...")
# that find() silently walks as nothing -- and a zero-page scan used to still print
# "no broken internal links", a false pass. Run it from the repo root
# (perl _build/audit_links.pl); the guard at the bottom now makes a no-op scan fatal.
die "audit_links: derived root does not exist: $root\n" unless -d $root;
my (@bad, %ext, $pages, $links);

find(sub {
  return unless -f and /\.html$/i;
  my $path = $File::Find::name;
  return if $path =~ m{/PHOTO PATHWAYS/};        # generated photo browser, not site pages
  $pages++;
  open my $fh, '<:raw', $path or return;
  local $/; my $c = <$fh>; close $fh;
  my $dir = dirname($path);
  while ($c =~ /(?:href|src)\s*=\s*["']([^"'#]+?)(?:[#?][^"']*)?["']/g){
    my $u = $1;
    next if $u =~ /^(?:javascript:|mailto:|tel:|data:)/i;
    next if $u =~ /[\$\{\}']/;      # JS template literal / concatenation inside a script, not a real link
    next if $u =~ m{/$} && $u =~ m{assets/};   # JS base-path constant (e.g. '../assets/preowned/' + file)
    if ($u =~ m{^(?:https?:)?//}){ $ext{$u} = ($ext{$u}||0) + 1; next }
    $links++;
    my $t = $u =~ m{^/} ? "$root$u" : "$dir/$u";
    $t =~ s/%20/ /g;
    $t .= 'index.html' if $t =~ m{/$};
    unless (-e $t or -e "$t/index.html"){
      (my $rel = $path) =~ s/^\Q$root\E.//;
      push @bad, "$rel -> $u";
    }
  }
}, $root);

$pages ||= 0; $links ||= 0;
die "audit_links: scanned 0 pages under $root -- refusing to report a clean audit.\n"
  . "Run it from the repo root: perl _build/audit_links.pl\n" unless $pages;
print "pages scanned: $pages, internal links checked: $links\n";
if (@bad){ print "BROKEN INTERNAL LINKS (" . @bad . "):\n"; print "  $_\n" for @bad }
else { print "no broken internal links.\n" }
print "\nexternal domains referenced:\n";
my %dom;
for (keys %ext){ m{//([^/]+)} and $dom{$1} += $ext{$_} }
printf "  %-45s %d\n", $_, $dom{$_} for sort { $dom{$b} <=> $dom{$a} } keys %dom;
