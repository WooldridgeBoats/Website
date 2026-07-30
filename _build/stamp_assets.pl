#!/usr/bin/perl
# ─────────────────────────────────────────────────────────────────────────────
# stamp_assets.pl — cache-bust every local CSS and JS reference by content hash.
#
# WHY THIS EXISTS (added 2026-07-29)
#
# Cloudflare sits in front of this site and caches static assets with
# max-age=14400 — four hours. The HTML is NOT cached (Cloudflare reports it as
# DYNAMIC), so pages always arrive fresh, but the stylesheet and scripts they
# point at can be four hours stale. On 29 July that meant the new site-wide
# backdrop was deployed, live, and completely invisible: house.css on the host
# had it, the copy Cloudflare was serving did not.
#
# The convention already half-existed. The 25 model pages carried
# "?v=20260708b" on house.css, gallery.js and modelpage.js. Two problems with
# that: the other 33 pages had no version at all, and the string was typed by
# hand, so nobody bumped it on 29 July — which is precisely why a hand-typed
# version is the wrong mechanism. A version you have to remember to change is a
# version that silently stops working.
#
# So the version is a HASH OF THE FILE'S OWN CONTENT. It changes when, and only
# when, the file changes. Nobody has to remember anything, and unchanged files
# keep their URL and stay cached — which is the whole point of caching.
#
# RUN THIS after editing any .css or .js, and before committing a deploy.
# It is idempotent: running it twice in a row changes nothing.
#
#   perl _build/stamp_assets.pl [site-root]        # default: current directory
#   perl _build/stamp_assets.pl --check            # report only, change nothing
#
# The local preview server strips query strings, so stamped links work
# unchanged in development (see _build/serve.pl).
# ─────────────────────────────────────────────────────────────────────────────
use strict;
use warnings;
use File::Find;
use File::Spec;
use File::Basename qw(dirname);
use Digest::MD5 qw(md5_hex);
use Cwd qw(abs_path);

my $check_only = 0;
my @args;
for my $a (@ARGV) { if ($a eq '--check') { $check_only = 1 } else { push @args, $a } }
my $root = abs_path($args[0] // '.');
die "not a directory: $root\n" unless -d $root;

# ── collect html files, skipping git and the build folder itself ──
my @html;
find(sub {
  return unless -f;
  return unless /\.html?$/i;
  my $p = $File::Find::name;
  return if $p =~ m{/\.git/};
  return if $p =~ m{/_build/};
  push @html, $p;
}, $root);
@html = sort @html;

# ── hash cache so each asset is read once ──
my %hash;
sub asset_hash {
  my ($abs) = @_;
  return $hash{$abs} if exists $hash{$abs};
  my $h;
  if (open my $fh, '<:raw', $abs) { local $/; my $d = <$fh>; close $fh; $h = substr(md5_hex($d), 0, 8); }
  else { $h = undef }
  return $hash{$abs} = $h;
}

my ($files_changed, $refs_stamped, $refs_already, $missing) = (0, 0, 0, 0);
my %missing_seen;

for my $file (@html) {
  open my $in, '<:encoding(UTF-8)', $file or do { warn "cannot read $file\n"; next };
  local $/;
  my $txt = <$in>;
  close $in;
  my $orig = $txt;
  my $dir  = dirname($file);

  # href="...css" / src="...js", optionally already carrying a query string
  $txt =~ s{
      (\b(?:href|src)\s*=\s*")     # 1: attribute opener
      ([^"]+?\.(?:css|js))         # 2: the path, no query
      (\?[^"]*)?                   # 3: existing query, if any
      (")                          # 4: closing quote
  }{
      my ($pre, $path, $query, $post) = ($1, $2, $3, $4);
      my $out = $pre . $path . ($query // '') . $post;

      # leave anything not served from this site alone
      if ($path =~ m{^(?:https?:)?//} || $path =~ m{^data:}) {
          $out;
      } else {
          # resolve the reference to a file on disk
          my $abs = $path =~ m{^/}
                  ? File::Spec->catfile($root, substr($path, 1))
                  : File::Spec->catfile($dir, $path);
          $abs = abs_path($abs) // '';

          if ($abs && -f $abs) {
              my $h = asset_hash($abs);
              if (defined $h) {
                  # preserve any other query params, replace only v=
                  my $q = $query // '';
                  $q =~ s/^\?//;
                  my @keep = grep { length && !/^v=/ } split /&/, $q;
                  my $newq = '?' . join('&', ("v=$h", @keep));
                  if (($query // '') eq $newq) { $refs_already++ } else { $refs_stamped++ }
                  $pre . $path . $newq . $post;
              } else { $out }
          } else {
              unless ($missing_seen{$path}++) { $missing++; warn "  ? not found on disk, left alone: $path\n"; }
              $out;
          }
      }
  }gexs;

  if ($txt ne $orig) {
    $files_changed++;
    unless ($check_only) {
      open my $out, '>:encoding(UTF-8)', $file or do { warn "cannot write $file\n"; next };
      print $out $txt;
      close $out;
    }
  }
}

my $verb = $check_only ? 'would stamp' : 'stamped';
printf "%s %d reference(s) across %d file(s); %d already current; %d asset(s) not found\n",
       $verb, $refs_stamped, $files_changed, $refs_already, $missing;
printf "scanned %d html file(s), hashed %d asset(s)\n", scalar(@html), scalar(keys %hash);
if (!$check_only && $refs_stamped) {
  print "\nCommit the changed pages. Cloudflare will refetch the assets whose hash moved.\n";
}
exit 0;
