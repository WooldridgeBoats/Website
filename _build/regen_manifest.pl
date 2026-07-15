#!/usr/bin/perl
use strict; use warnings; use JSON::PP;
my $root = 'C:/Users/steph/Desktop/ALMOST DONE (1)/ALMOST DONE';
my %m;
for my $d (glob "'$root/assets/photos/'*/") {
  next if $d =~ /thumbs/;
  (my $slug = $d) =~ s{^.*/photos/|/$}{}g;
  opendir my $dh, $d or next;
  my @f = sort grep { /\.jpe?g$/i } readdir $dh;
  closedir $dh;
  $m{$slug} = \@f if @f;
}
open my $o, '>', "$root/assets/photos/photo_manifest.json" or die $!;
print $o JSON::PP->new->canonical->pretty->encode(\%m);
close $o;
my $n = 0; $n += @$_ for values %m;
print "manifest regenerated: ", scalar(keys %m), " models, $n photos\n";
