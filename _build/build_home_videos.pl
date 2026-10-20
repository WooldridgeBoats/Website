#!/usr/bin/perl
# ─────────────────────────────────────────────────────────────────────────────
# build_home_videos.pl: the homepage's Featured Videos strip (2026-10-20).
#
#   perl _build/build_home_videos.pl          # rebuild the strip from _build/home_videos.txt
#   perl _build/build_home_videos.pl --sync   # first re-read Tyler's "HOME PAGE" YouTube
#                                             # playlist into home_videos.txt, then rebuild
#
# It's the Heritage Videos strip from /our-history/ (same .hcar markup, so
# assets/history.js gives it the arrows, counter, scroll bar and the viewer that plays
# the video), except every tile is a 16:9 rectangle like YouTube's own (.wide).
#
# READS   _build/home_videos.txt   one video per line: ID | title | length | thumbnail
# WRITES  index.html, between <!-- HOME:videos --> and <!-- /HOME:videos -->
#
# The page doesn't watch the playlist live (an unlisted playlist can't be read from the
# browser). When Tyler says "update homepage videos": run with --sync, check, commit.
# --sync keeps the tidied page title of every video already listed; new ones get
# YouTube's title (lightly tidied) and are flagged so the title can be checked.
# Then run perl _build/stamp_assets.pl if house.css or history.js changed.
# ─────────────────────────────────────────────────────────────────────────────
use strict;
use warnings;
use utf8;
use JSON::PP;
use File::Basename qw(dirname);
use Cwd qw(abs_path);

binmode STDOUT, ':encoding(UTF-8)'; binmode STDERR, ':encoding(UTF-8)';
my $root = abs_path(dirname(abs_path($0)) . '/..');
my $list = "$root/_build/home_videos.txt";
my $page = "$root/index.html";
my $PLAYLIST = 'PLfPDtUTX-d-I';   # "HOME PAGE" (unlisted) on youtube.com/@WooldridgeBoats
my $sync = grep { $_ eq '--sync' } @ARGV;

# ── the list: comment header + one line per video ──
open my $lf, '<:encoding(UTF-8)', $list or die "can't read $list: $!\n";
my (@head, @vids);
while (my $l = <$lf>) {
  if ($l =~ /^\s*(#|$)/) { push @head, $l unless @vids; next; }
  chomp $l;
  my ($id, $title, $len, $q) = map { s/^\s+|\s+$//gr } split /\|/, $l;
  next unless $id && $title;
  push @vids, { id => $id, title => $title, len => $len // '', q => lc($q || 'maxres') };
}
close $lf;

sync_playlist() if $sync;
die "no videos in $list\n" unless @vids;

# ── the strip ──
sub esc { my $s = shift; $s =~ s/&/&amp;/g; $s =~ s/</&lt;/g; $s =~ s/>/&gt;/g; $s =~ s/"/&quot;/g; $s }
sub yt_thumb {   # the sharpest thumbnail YouTube has for this upload (listed in home_videos.txt)
  my ($id, $q) = @_;
  return "https://i.ytimg.com/vi/$id/" . ($q eq 'sd' ? 'sddefault' : $q eq 'hq' ? 'hqdefault' : 'maxresdefault') . '.jpg';
}
my @t = map {
  my $title = esc($_->{title});
  qq{        <button type="button" class="htile vid hv wide" data-yt="$_->{id}" data-vtitle="$title">}
  . qq{<span class="hpic"><img src="} . yt_thumb($_->{id}, $_->{q}) . qq{" alt="" loading="lazy" decoding="async"><span class="hplay" aria-hidden="true"></span>}
  . ($_->{len} ne '' ? qq{<span class="hdur">$_->{len}</span>} : '') . qq{</span><span class="hpc">$title</span></button>}
} @vids;
my $html = qq{\n    <div class="hcar hvidcar" data-label="Featured Videos">\n      <div class="htrack">\n}
  . join("\n", @t) . qq{\n      </div>\n}
  . qq{      <div class="hcarui"><button type="button" class="hprev" aria-label="Previous video"></button><span class="hcount"></span><button type="button" class="hnext" aria-label="Next video"></button></div>\n}
  . qq{    </div>\n    };

open my $pf, '<:encoding(UTF-8)', $page or die "can't read $page: $!\n";
my $src = do { local $/; <$pf> }; close $pf;
$src =~ s{(<!-- HOME:videos -->).*?(<!-- /HOME:videos -->)}{$1$html$2}s or die "HOME:videos markers missing in $page\n";
open my $po, '>:encoding(UTF-8)', $page or die "can't write $page: $!\n"; print $po $src; close $po;
printf "videos    %2d featured video(s) on the homepage\n", scalar @vids;

# ── --sync: read the playlist page's own data (YouTube's RSS stops at 15 videos) ──
sub sync_playlist {
  my $ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';
  my $raw = `curl -sL --max-time 30 -A '$ua' -H 'Accept-Language: en-US' 'https://www.youtube.com/playlist?list=$PLAYLIST'`;
  my ($json) = $raw =~ /var ytInitialData = (\{.*?\});<\/script>/s
    or die "couldn't read the playlist page (offline, or YouTube changed it). home_videos.txt left as is.\n";
  my $d = JSON::PP->new->utf8->decode($json);
  # the video list is the longest array of video entries on the page
  my @best;
  my $walk; $walk = sub {
    my $o = shift;
    if (ref $o eq 'ARRAY') {
      my @v = grep { ref $_ eq 'HASH' && ($_->{lockupViewModel} || $_->{playlistVideoRenderer}) } @$o;
      @best = @v if @v > @best;
      $walk->($_) for @$o;
    } elsif (ref $o eq 'HASH') { $walk->($_) for values %$o; }
  };
  $walk->($d);
  die "no videos found on the playlist page. home_videos.txt left as is.\n" unless @best;
  my %had = map { $_->{id} => $_ } @vids;
  my (@new, @added);
  for my $e (@best) {
    my ($id, $yt_title, $len);
    if (my $v = $e->{playlistVideoRenderer}) {
      $id = $v->{videoId}; $len = $v->{lengthText}{simpleText} // '';
      $yt_title = $v->{title}{simpleText} // join '', map { $_->{text} } @{ $v->{title}{runs} // [] };
    } else {
      my $v = $e->{lockupViewModel};
      $id = $v->{contentId}; $yt_title = $v->{metadata}{lockupMetadataViewModel}{title}{content} // '';
      ($len) = JSON::PP->new->canonical->encode($v) =~ /"text":"(\d{1,2}:\d\d(?::\d\d)?)"/;
    }
    next unless $id;
    if (my $old = $had{$id}) { push @new, { %$old, len => $len || $old->{len} }; next; }
    my $t = $yt_title;   # tidy YouTube's title for the page; flagged below so it gets a look
    $t =~ s/\s*\|\s*/: /g; $t =~ s/(\d)'/$1′/g; $t =~ s/'/’/g; $t =~ s/\s+/ /g;
    my $q = 'maxres';
    for my $try (qw(maxres sd hq)) {
      my $code = `curl -s -o /dev/null -w '%{http_code}' --max-time 15 'https://i.ytimg.com/vi/$id/${try}default.jpg'`;
      if ($code eq '200') { $q = $try; last; }
    }
    push @new, { id => $id, title => $t, len => $len // '', q => $q };
    push @added, "$id  $t";
  }
  my %now = map { $_->{id} => 1 } @new;
  my @gone = map { "$_->{id}  $_->{title}" } grep { !$now{$_->{id}} } @vids;
  @vids = @new;
  open my $wf, '>:encoding(UTF-8)', $list or die "can't write $list: $!\n";
  print $wf @head;
  printf $wf "%s | %s | %s | %s\n", @$_{qw(id title len q)} for @vids;
  close $wf;
  print "playlist  ", scalar(@vids), " video(s) in \"HOME PAGE\"\n";
  print "  NEW (check the title in _build/home_videos.txt): $_\n" for @added;
  print "  removed: $_\n" for @gone;
}
