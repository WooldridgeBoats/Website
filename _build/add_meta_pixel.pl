#!/usr/bin/perl
# add_meta_pixel.pl - put the Meta (Facebook / Instagram) pixel on every public page.
# STAGED 2026-11-12 for the paid video campaign. NOT RUN: there is no pixel ID yet.
#
#   perl _build/add_meta_pixel.pl 123456789012345     # install, or change the ID
#   perl _build/add_meta_pixel.pl --remove            # take it off again
#   perl _build/inject_partials.pl                    # then stamp header.html into every page
#
# Same shape as add_ga4.pl. header.html gets the pixel directly under the GA4 block, wrapped in
# <!-- META PIXEL --> ... <!-- /META PIXEL -->, so re-running replaces it instead of stacking a
# second copy (idempotent). inject_partials.pl carries header.html into every page that has the
# header partial - Request a Quote included, it carries the partial since its 31 Aug absorption.
#
# What it sends: the standard PageView on every page load. The Lead event is NOT in this block:
# it is already wired, guarded with typeof fbq==='function', beside the GA4 conversions -
#   build-and-price  emailBuildSheet()      gtag build_sheet_sent  + fbq Lead (content_category build_sheet)
#   request-a-quote  fetch success branch   gtag quote_submitted   + fbq Lead (content_category quote_request)
# so those calls do nothing until this script has run, and start counting the moment it has.
#
# Before running it (Stephen's calls, not this script's): the pixel ID comes from Meta Events
# Manager; the privacy policy page should say the site uses the Meta pixel; and there is no
# consent banner on the site (Alberta and BC visitors are in the campaign's regions).
use strict; use warnings;
use File::Basename qw(dirname);
use Cwd qw(abs_path);

my $arg = shift // die "usage: add_meta_pixel.pl <PIXEL_ID> | --remove\n";
my $root = dirname(dirname(abs_path(__FILE__)));
my $f = "$root/header.html";

sub slurp { my ($f) = @_; open my $h, '<:raw', $f or die "$f: $!"; local $/; my $t = <$h>; close $h; $t }
sub spit  { my ($f, $t) = @_; open my $h, '>:raw', $f or die "$f: $!"; print $h $t; close $h }

my $t = slurp($f);

if ($arg eq '--remove') {
  if ($t =~ s{<!-- META PIXEL -->.*?<!-- /META PIXEL -->\n?}{}s) { spit($f, $t); print "header.html: pixel removed\n" }
  else { print "header.html: no pixel block found, nothing to remove\n" }
  print "\nNow run: perl _build/inject_partials.pl\n";
  exit 0;
}

my $id = $arg;
$id =~ /^\d{10,20}$/ or die "that does not look like a Meta pixel ID (digits only): $id\n";

my $block = <<"PX";
<!-- META PIXEL -->
<script>
  !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
  n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
  document,'script','https://connect.facebook.net/en_US/fbevents.js');
  fbq('init', '$id');
  fbq('track', 'PageView');
</script>
<noscript><img height="1" width="1" style="display:none" alt="" src="https://www.facebook.com/tr?id=$id&amp;ev=PageView&amp;noscript=1"></noscript>
<!-- /META PIXEL -->
PX

if ($t =~ s{<!-- META PIXEL -->.*?<!-- /META PIXEL -->\n?}{$block}s) { print "header.html: pixel replaced\n" }
elsif ($t =~ s{(<!-- /GA4 -->\n)}{$1$block}) { print "header.html: pixel added under the GA4 block\n" }
else { $t = $block . $t; print "header.html: no GA4 block found - pixel added at the top\n" }
spit($f, $t);
print "\nNow run: perl _build/inject_partials.pl   (stamps header.html into every page)\n";
