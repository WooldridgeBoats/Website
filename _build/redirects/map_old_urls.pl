#!/usr/bin/perl
# map_old_urls.pl - sort the old site's 404ing URLs into: redirect (sourced), decide (Stephen),
# keep-404 (on purpose), live (already answers), other-host. Writes _build/redirects/old_urls.tsv,
# which gen_redirects.pl turns into the REDIRECTS block of .htaccess.
#
# Built 2026-10-29 after launch (2026-10-28 08:16 PDT) showed ~3.8k 404s in 37 hours.
#
# Inputs (none of them live in the repo; paths are arguments):
#   --cf   a "hits path" list exported from Cloudflare Analytics (zone wooldridgeboats.com,
#          edgeResponseStatus=404). Path prefix: none = www, "@" = apex, "host:" = another host.
#   --woo  a folder holding products.tsv / attachments.tsv / other_posts.tsv, extracted from the
#          WordPress database dump (WP BACKUP 2026-10-28) by extract_catalog.pl. Products and
#          media only - no order or customer data is read.
#   --shop a folder holding the Shopify store's PUBLIC products_1.json, collections.json and
#          coll_<handle>.json (store.wooldridgeboats.com/products.json etc.). Read-only.
#   --nolive  skip the live HTTP checks (offline dry run)
#
# usage (from Website\):
#   perl _build/redirects/map_old_urls.pl --cf <file> --woo <dir> --shop <dir>
#
# The store is Carrie's: this script only ever READS its public JSON. Every row says how its
# target was found; anything that needs a judgement call is DECIDE, never REDIRECT.
use strict; use warnings;
use JSON::PP;
use File::Basename qw(dirname);
use Cwd qw(abs_path);
use File::Glob qw(:bsd_glob);   # the repo path has spaces; plain glob() would split it
binmode STDOUT, ':raw';

my %o = (live => 1);
while (@ARGV) { my $a = shift; if ($a eq '--nolive') { $o{live} = 0 } elsif ($a =~ /^--(cf|woo|shop)$/) { $o{$1} = shift } else { die "unknown arg $a\n" } }
die "usage: --cf FILE --woo DIR --shop DIR [--nolive]\n" unless $o{cf} && $o{woo} && $o{shop};
my $here = dirname(abs_path($0)); my $repo = abs_path("$here/../..");
my $STORE = 'https://store.wooldridgeboats.com';
my $SITE  = 'https://www.wooldridgeboats.com';

sub slurp { my $f = shift; open my $h, '<:raw', $f or die "$f: $!"; local $/; my $t = <$h>; close $h; $t }
sub tsv { my $f = shift; my @l = split /\r?\n/, slurp($f); my @h = split /\t/, shift @l; map { my @v = split /\t/, $_, -1; my %r; @r{@h} = @v; \%r } grep { length } @l }
sub norm_title {   # drop only the store's "(OBJ nnnn)" suffix: a size in brackets is part of the product
  my $t = lc(shift // ''); $t =~ s/\(obj[^)]*\)//g; $t =~ s/[^a-z0-9]+/ /g; $t =~ s/^\s+|\s+$//g; $t }
sub norm_sku {   # OBJ part numbers are the one SKU family both stores share; everything else compared as bare alnum
  my $s = uc(shift // ''); return '' unless length $s;
  return 'OBJ-' . $1 . (defined $2 ? "-$2" : '') if $s =~ /\bOBJ[\s-]*(\d+)(?:[.\-](\d+))?/;
  $s =~ s/[^A-Z0-9]//g; $s }
sub tokens { my %t = map { $_ => 1 } grep { length > 1 } split / /, norm_title(shift); \%t }
sub jacc { my ($a, $b) = @_; my $i = grep { $b->{$_} } keys %$a; my $u = keys(%{ { %$a, %$b } }); $u ? $i / $u : 0 }

# ---- the old WooCommerce catalogue -------------------------------------------------------------
my (%woo_by_slug, %woo_by_id);
for my $r (tsv("$o{woo}/products.tsv")) {
  $woo_by_id{ $r->{id} } = $r if $r->{type} eq 'product';
}
for my $r (tsv("$o{woo}/products.tsv")) {
  if ($r->{type} eq 'product') { $woo_by_slug{ $r->{slug} } = $r; $woo_by_slug{$_} = $r for grep { length } split /\|/, $r->{old_slugs} }
  elsif ($r->{type} eq 'product_variation' && $woo_by_id{ $r->{parent_id} }) { push @{ $woo_by_id{ $r->{parent_id} }{varskus} }, $r->{sku} if length $r->{sku} }
}
my %attach; for my $r (tsv("$o{woo}/attachments.tsv")) { $attach{ $r->{file} } = $r if length $r->{file} }

# ---- the Shopify store (public JSON) -----------------------------------------------------------
my (%shop_by_handle, %shop_by_sku, %shop_by_title);
for my $p (@{ decode_json(slurp("$o{shop}/products_1.json"))->{products} }) {
  $shop_by_handle{ $p->{handle} } = $p;
  $shop_by_title{ norm_title($p->{title}) }{ $p->{handle} } = 1;
  for my $v (@{ $p->{variants} }) { my $k = norm_sku($v->{sku}); $shop_by_sku{$k}{ $p->{handle} } = $v->{sku} if length $k }
}
my %coll; my %in_coll;
for my $c (@{ decode_json(slurp("$o{shop}/collections.json"))->{collections} }) {
  next if $c->{handle} eq 'frontpage';
  $coll{ $c->{handle} } = $c->{title};
  my $f = "$o{shop}/coll_$c->{handle}.json"; next unless -f $f;
  $in_coll{ $c->{handle} }{ $_->{handle} } = 1 for @{ decode_json(slurp($f))->{products} };
}
$coll{all} //= 'All products (Shopify built-in)';
# Suggestions only (DECIDE rows): old product tags -> the collection holding that kind of part.
my %TAG = ('jet-liner' => 'jet-parts', 'stainless-steel-four-blade-impeller' => 'impellers', 'tee-key' => 'jet-parts',
           'jet-foot-intake' => 'jet-feet', 'shaft-sleeve' => 'jet-parts', 'please-include-size' => 'shop-all');

# ---- the new site --------------------------------------------------------------------------------
my %preowned = map { (($_->{url} // '') =~ m{/preowned/([^/]+)/?$}) ? ($1 => $_->{slug}) : () } grep { ref eq 'HASH' && !$_->{sold} } @{ decode_json(slurp("$repo/_build/preowned.json"))->{listings} // [] };
my %model_dir = map { m{/models/([^/]+)/index\.html$} ? ($1 => 1) : () } glob("$repo/models/*/index.html");
my %sheet = map { m{/pricesheets/([^/]+)/index\.html$} ? ($1 => 1) : () } glob("$repo/pricesheets/*/index.html");
my $newinv = slurp("$repo/new-inventory/index.html");
my %docs = map { m{/assets/docs/([^/]+)$} ? ($1 => 1) : () } glob("$repo/assets/docs/*.pdf");

# Old price-sheet PDF file names -> the model's canon print sheet (/pricesheets/<id>/, regenerated by
# _build/gen_from_canon.pl). Only names that say the model AND, where the model has two drives, the drive.
my @SHEET = (
  [ qr/rogue/i,                                   'rogue' ],
  [ qr/alaskan[-_ ]?xlt/i,                        'xlt' ],
  [ qr/alaskan[-_ ]?xl[-_ ]?ib|alaskan[-_ ]?xl[-_ ]?inboard/i, 'xlib' ],
  [ qr/alaskan[-_ ]?xl[-_ ]?ob/i,                 'xl' ],
  [ qr/alaskan[-_ ]?lt/i,                         'lt' ],
  [ qr/(?:^|[-_ ])alaskan[-_ ]?ob/i,              'ak' ],
  [ qr/scout[-_ ]?widebody/i,                     'scoutwb' ],
  [ qr/scout/i,                                   'scout' ],
  [ qr/skagit[-_ ]?x\b/i,                         'skagitx' ],
  [ qr/skagit[-_ ]?(?:ib|inboard)/i,              'skagitib' ],
  [ qr/skagit[-_ ]?ob/i,                          'skagit' ],
  [ qr/super[-_ ]?sport[-_ ]?offshore|\bsso\b/i,  'sso' ],
  [ qr/ssd[-_ ]?(?:ib|inboard)|super[-_ ]?sport[-_ ]?drifter[-_ ]?(?:ib|inboard)/i, 'ssdib' ],
  [ qr/sportster/i,                               '' ],            # one sheet now, but the old file was an inboard copy: decide
  [ qr/(?:^|[-_ ])sport[-_ ]?(?:ib|inboard)/i,    'sportib' ],
  [ qr/(?:^|[-_ ])sport[-_ ]?ob/i,                'sport' ],
);
# File name -> model page, for brochure / performance suggestions (DECIDE rows only).
my @MODEL = (
  [ qr/super[-_ ]?sport[-_ ]?offshore[-_ ]?angler|ss[-_ ]?off.*angler/i, 'super-sport-offshore-angler' ],
  [ qr/deepwater/i, 'deepwater' ], [ qr/canyon/i, 'canyon' ], [ qr/pybus/i, 'pybus-offshore' ], [ qr/landing[-_ ]?craft/i, 'landing-craft' ],
  [ qr/rogue/i, 'rogue' ], [ qr/alaskan[-_ ]?xlt/i, 'xlt' ], [ qr/alaskan[-_ ]?xl[-_ ]?(?:ib|inboard)/i, 'alaskan-xl-inboard' ],
  [ qr/alaskan[-_ ]?xl|ak[-_ ]?xl/i, 'alaskanxl' ], [ qr/alaskan[-_ ]?lt/i, 'alaskan-lt' ], [ qr/alaskan|(?:^|[-_ ])ak[-_ ]/i, 'alaskan' ],
  [ qr/scout[-_ ]?widebody/i, 'scout-widebody' ], [ qr/scout/i, 'scout' ], [ qr/skagit[-_ ]?x\b/i, 'skagit-x' ],
  [ qr/skagit[-_ ]?(?:ib|inboard)/i, 'skagit-inboard' ], [ qr/skagit/i, 'skagit' ],
  [ qr/super[-_ ]?sport[-_ ]?offshore|ss[-_ ]?off/i, 'super-sport-offshore' ],
  [ qr/(?:ssd|super[-_ ]?sport[-_ ]?drifter|ss[-_ ]?drifter)[-_ ]?(?:ib|inboard)|ssdib/i, 'supersportdrifterinboard' ],
  [ qr/ssd|super[-_ ]?sport[-_ ]?drifter|ss[-_ ]?drifter/i, 'supersportdrifter' ],
  [ qr/sportster/i, 'sportster' ], [ qr/sport[-_ ]?off/i, 'sportoffshore' ], [ qr/sport[-_ ]?(?:ib|inboard)/i, 'sportinboard' ], [ qr/sport/i, 'sport' ],
);
sub first_match { my ($s, $tab) = @_; for (@$tab) { return $_->[1] if $s =~ $_->[0] } undef }

# ---- read the Cloudflare list --------------------------------------------------------------------
my @rows; my %seen;
for my $line (split /\r?\n/, slurp($o{cf})) {
  next if $line =~ /^\s*(#|$)/;
  my ($hits, $raw) = $line =~ /^(\d+)\s+(\S.*)$/ or next;
  my ($host, $path) = ('www', $raw);
  if ($raw =~ /^@(.*)$/) { ($host, $path) = ('apex', $1) } elsif ($raw =~ /^([a-z0-9.-]+):(\/.*)$/) { ($host, $path) = ($1, $2) }
  push @rows, { hits => $hits, host => $host, path => $path };
}

my @out;
sub row { my ($r, %f) = @_; push @out, { %$r, %f } }

for my $r (@rows) {
  my $p = $r->{path};
  if ($r->{host} ne 'www' && $r->{host} ne 'apex') { row($r, class => 'other-host', status => 'OTHER-HOST', group => '', target => '', source => "$r->{host} is not this site (sales = Tyler's dealer site)"); next }
  my $lp = lc $p;
  my ($base, $feed) = ($p, '');
  if ($base =~ s{/feed/?$}{/}i) { $feed = ' (feed URL of it)' }

  # --- WooCommerce products
  if ($base =~ m{^/product/([^/]+)/?$}i) {
    my $slug = lc $1; my $w = $woo_by_slug{$slug};
    unless ($w) { row($r, class => 'product', status => 'DECIDE', group => 'products-unmatched', target => "$STORE/", source => "slug '$slug' not in the WooCommerce database"); next }
    my (%cand, @why);
    for my $s ($w->{sku}, @{ $w->{varskus} // [] }) {
      my $k = norm_sku($s); next unless length $k && $k =~ /^OBJ-/;
      for my $h (keys %{ $shop_by_sku{$k} // {} }) { $cand{$h}{sku} = "WooCommerce #$w->{id} SKU '$s' = store SKU '$shop_by_sku{$k}{$h}'" }
    }
    if ($shop_by_handle{$slug}) { $cand{$slug}{handle} = "WooCommerce slug = store handle '$slug'" }
    for my $h (keys %{ $shop_by_title{ norm_title($w->{title}) } // {} }) { $cand{$h}{title} = "same title '$w->{title}'" }
    my @c = sort keys %cand;
    if (@c == 1) {
      my $h = $c[0]; my $how = join('; ', map { $cand{$h}{$_} } grep { $cand{$h}{$_} } qw(sku handle title));
      row($r, class => 'product', status => 'REDIRECT', group => 'products', target => "$STORE/products/$h", source => $how . $feed);
    } elsif (@c > 1) {
      row($r, class => 'product', status => 'DECIDE', group => 'products-conflict', target => "$STORE/products/$c[0]", source => 'evidence points at ' . scalar(@c) . ' store products: ' . join(' | ', map { my $h = $_; "$h <- " . join('; ', grep { defined } @{ $cand{$h} }{qw(sku handle title)}) } @c));
    } else {
      my $t = tokens($w->{title}); my ($best, $bs) = ('', 0);
      for my $h (keys %shop_by_handle) { my $j = jacc($t, tokens($shop_by_handle{$h}{title})); ($best, $bs) = ($h, $j) if $j > $bs }
      row($r, class => 'product', status => 'DECIDE', group => 'products-unmatched',
          target => ($bs >= 0.34 ? "$STORE/products/$best" : "$STORE/"),
          source => sprintf("WooCommerce #%s '%s' (SKU '%s', %s): no SKU, handle or title match on the store%s", $w->{id}, $w->{title}, $w->{sku}, $w->{status},
                            $bs >= 0.34 ? sprintf("; closest by words: '%s' (%.0f%% overlap)", $shop_by_handle{$best}{title}, 100 * $bs) : ''));
    }
    next;
  }
  # --- Shopify-shaped paths that landed on www
  if ($base =~ m{^/products/([^/]+)/?$}i) { my $h = lc $1;
    if ($shop_by_handle{$h}) { row($r, class => 'store-path', status => 'REDIRECT', group => 'store-paths', target => "$STORE/products/$h", source => "the store has this exact product address") }
    else { row($r, class => 'store-path', status => 'DECIDE', group => 'products-unmatched', target => "$STORE/", source => "no store product with handle '$h'") }
    next }
  if ($base =~ m{^/collections/([^/]+)/?$}i) { my $h = lc $1;
    if ($coll{$h}) { row($r, class => 'store-path', status => 'REDIRECT', group => 'store-paths', target => "$STORE/collections/$h", source => "the store has this exact collection address ('$coll{$h}')") }
    else { row($r, class => 'store-path', status => 'DECIDE', group => 'categories', target => "$STORE/collections/all", source => "no store collection '$h'") }
    next }
  if ($lp eq '/products.json') { row($r, class => 'probe', status => 'KEEP-404', group => '', target => '', source => 'Shopify-catalogue probe by bots; never an address of this site'); next }

  # --- WooCommerce categories and tags
  if ($base =~ m{^/category/([^/]+)(?:/page/\d+)?/?$}i) { my $c = lc $1;
    if ($c eq 'equipment') { row($r, class => 'category', status => 'KEEP-404', group => 'ruled-404', target => '', source => "Stephen's ruling 2026-08-25: /category/equipment/ 404s cleanly, no redirect (page-N/feed/case variants of the same listing follow it)$feed"); next }
    my %score; my $n = 0;
    for my $w (values %woo_by_id) {
      next unless grep { $_ eq $c } split /\|/, ($w->{product_cats} // '');
      my $hit; for my $o (@out) { if ($o->{class} eq 'product' && $o->{status} eq 'REDIRECT' && $o->{path} =~ m{^/product/\Q$w->{slug}\E/?$}i) { $hit = $o->{target}; last } }
      $hit //= $shop_by_handle{ $w->{slug} } ? "$STORE/products/$w->{slug}" : undef; next unless $hit; $n++;
      my ($h) = $hit =~ m{/products/(.+)$}; for my $k (keys %in_coll) { next if $k eq 'shop-all'; $score{$k}++ if $in_coll{$k}{$h} }
    }
    my ($bk) = sort { $score{$b} <=> $score{$a} || $a cmp $b } keys %score;
    if ($c eq 'uncategorized') { $bk = 'shop-all'; $score{$bk} = 'all' }   # WooCommerce put every product here
    row($r, class => 'category', status => 'DECIDE', group => 'categories', target => ($bk ? "$STORE/collections/$bk" : "$STORE/collections/all"),
        source => "old WooCommerce category '$c'" . ($bk ? "; $score{$bk} of its $n matched products sit in '$coll{$bk}'" : '; none of its products matched a collection') . $feed);
    next }
  if ($base =~ m{^/product-tag/([^/]+)/?$}i) { row($r, class => 'product-tag', status => 'DECIDE', group => 'categories', target => "$STORE/collections/" . ($TAG{ lc $1 } // 'all'), source => "old WooCommerce product tag '$1'$feed"); next }

  # --- retired WooCommerce pages (ruled) and feeds
  if ($lp =~ m{^/(cart|checkout|account)(/.*)?$} || $lp =~ m{^/(comments/)?feed/?$}) { row($r, class => 'woo-page', status => 'KEEP-404', group => 'ruled-404', target => '', source => "Stephen's ruling 2026-08-25: /cart/ /checkout/ /account/ /feed/ /comments/feed/ 404 cleanly, no redirect"); next }
  if ($feed) { row($r, class => 'feed', status => 'DECIDE', group => 'leftovers', target => '', source => 'old WordPress RSS feed; suggest leave 404'); next }

  # --- old WordPress uploads (PDFs)
  if ($p =~ m{^/wp-content/uploads/(\d{4}/\d{2}/[^/]+\.pdf)$}i) { my $f = $1; my $a = $attach{$f};
    unless ($a) { row($r, class => 'wp-pdf', status => 'KEEP-404', group => 'spam-pdfs', target => '', source => 'not in the old site\'s media library: a spam upload from the WordPress compromise (name says so)'); next }
    my $name = $f; $name =~ s{^.*/}{};
    if ($name =~ /price[-_ ]?sheet|hull[-_ ]?options|trailer[-_ ]?prices|^(?:scout|skagit|alaskan|rogue)[-_a-z]*[-_](?:ib|ob)(?:-\d)?\.pdf$/i) {
      my $id = first_match($name, \@SHEET);
      if ($id && $sheet{$id}) { row($r, class => 'price-pdf', status => 'REDIRECT', group => 'price-sheets', target => "/pricesheets/$id/", source => "old price sheet '$a->{title}' (WordPress media #$a->{id}); the name says the model, and /pricesheets/$id/ is that model's canon-driven sheet (gen_from_canon.pl regenerates it)") }
      else { my $m = first_match($name, \@MODEL); row($r, class => 'price-pdf', status => 'DECIDE', group => 'price-sheets-unclear', target => ($m ? "/models/$m/" : ''), source => "old price sheet '$a->{title}' (media #$a->{id}): the name does not pin one current canon sheet") }
      next }
    my $m = first_match($name, \@MODEL);
    if ($name =~ /perform|preform|test/i) {
      my $doc; if ($m && $name =~ /2026/) { my $u = uc($m); $u =~ s/-/_/g; for my $d (sort keys %docs) { (my $dn = uc $d) =~ s/-/_/g; if ($dn =~ /^\Q$u\E_PERFORMANCE_TEST_2026\.PDF$/) { $doc = $d; last } } }
      row($r, class => 'perf-pdf', status => 'DECIDE', group => 'performance-pdfs', target => ($doc ? "/assets/docs/$doc" : $m ? "/models/$m/" : ''), source => "old performance PDF '$a->{title}' (media #$a->{id})" . ($doc ? '; the same model\'s 2026 test is on the site' : ''));
      next }
    row($r, class => 'brochure-pdf', status => 'DECIDE', group => ($m ? 'brochure-pdfs' : 'leftovers'), target => ($m ? "/models/$m/" : ''), source => "old PDF '$a->{title}' (media #$a->{id})" . ($m ? '' : '; names no model; suggest leave 404'));
    next }

  # --- listings
  if ($lp =~ m{^/newinventory/?$}) { row($r, class => 'listing', status => 'REDIRECT', group => 'listings', target => '/new-inventory/', source => 'old new-inventory archive -> the new-inventory page'); next }
  if ($base =~ m{^/newinventory/([^/]+)/?$}i) { my $s = $1;
    if ($s =~ /2027-wooldridge-18-alaskan-windshield/ && $newinv =~ /yr:2027, len:18, name:'Alaskan', cfg:'Windshield', sold:false/) { row($r, class => 'listing', status => 'REDIRECT', group => 'listings', target => '/new-inventory/', source => "the same boat (2027 18' Alaskan Windshield) is listed, unsold, on /new-inventory/") }
    else { row($r, class => 'listing', status => 'DECIDE', group => 'sold-listings', target => '/new-inventory/', source => 'old new-inventory listing no longer on the site (the old title said SOLD)') }
    next }
  if ($lp =~ m{^/preowned/?$}) { row($r, class => 'listing', status => 'REDIRECT', group => 'listings', target => '/pre-owned/', source => 'old pre-owned archive -> the pre-owned page'); next }
  if ($base =~ m{^/preowned/([^/]+)/?$}i) { my $s = lc $1;
    if ($preowned{$s}) { row($r, class => 'listing', status => 'REDIRECT', group => 'listings', target => "/pre-owned/$preowned{$s}/", source => "_build/preowned.json records this exact old address as the listing's url") }
    else { row($r, class => 'listing', status => 'DECIDE', group => 'sold-listings', target => '/pre-owned/', source => 'old pre-owned listing not on the site any more (sold or withdrawn)') }
    next }
  if ($lp =~ m{^/used-vehicles}) { row($r, class => 'old-site', status => 'DECIDE', group => 'sold-listings', target => '/pre-owned/', source => 'pre-2019 site listing'); next }

  # --- model pages
  if ($base =~ m{^/models/([^/]+)/?(.*)$}i) { my ($m, $tail) = (lc $1, $2);
    if ($model_dir{$m} && length $tail) { row($r, class => 'junk', status => 'KEEP-404', group => '', target => '', source => 'a real model page with junk appended (a scraped JS string or text); nothing to send it to'); next }
    if ($model_dir{$m}) { row($r, class => 'model', status => 'LIVE', group => '', target => '', source => 'the page exists in the repo'); next }
    my %known = ('introducing-the-alaskan-lt' => ['alaskan-lt', "WordPress model post 'Introducing the Alaskan LT' -> the Alaskan LT page"],
                 'skagit-inboard-2'          => ['skagit-inboard', "WordPress's duplicate-slug '-2' copy of skagit-inboard"],
                 'agency'                    => ['', '']);
    if ($known{$m} && $known{$m}[0]) { row($r, class => 'model', status => 'REDIRECT', group => 'models', target => "/models/$known{$m}[0]/", source => $known{$m}[1]); next }
    if ($m eq 'agency') { row($r, class => 'model', status => 'REDIRECT', group => 'models', target => '/agency-work-boats/', source => "WordPress model page 'Agency' -> the Agency & Work Boats page"); next }
    (my $g = $m) =~ s/classic$//; my $sug = $model_dir{$g} ? "/models/$g/" : $m =~ /^xp/ ? '/models/skagit/' : $m =~ /pilothouse/ ? '/models/supersportoffshorepilothouse/' : '';
    row($r, class => 'model', status => 'DECIDE', group => 'models-unclear', target => $sug, source => "old model address '/models/$m/' has no page and no exact match");
    next }
  if ($base =~ m{^/catalog/(?:[^/]+/)*([^/]+)/?$}i) { my $seg = $1; (my $m = lc $seg) =~ s/-//g; my %alias = (alaskanxlinboard => 'alaskan-xl-inboard');
    my $t = $alias{$m} // $m;
    if ($model_dir{$t}) { row($r, class => 'old-site', status => 'REDIRECT', group => 'models', target => "/models/$t/", source => "pre-2019 catalogue page for the same model name") }
    else { row($r, class => 'old-site', status => 'DECIDE', group => 'models-unclear', target => ($m =~ /pilothouse/ ? '/models/supersportoffshorepilothouse/' : $m =~ /^xp/ ? '/models/skagit/' : ''), source => "pre-2019 catalogue page '$seg'") }
    next }
  if ($base =~ m{^/agency-builds/}i) { row($r, class => 'agency', status => 'DECIDE', group => 'agency-case-studies', target => '/agency-work-boats/', source => 'old WordPress agency case study (no per-build page on the new site)'); next }

  # --- sitemaps
  if ($lp =~ m{^/(sitemap_index|wp-sitemap(-[a-z0-9_-]+)?)\.xml$}) { row($r, class => 'sitemap', status => 'REDIRECT', group => 'sitemaps', target => '/sitemap.xml', source => 'the old site\'s sitemap -> the new /sitemap.xml'); next }
  if ($lp =~ m{sitemap|^/llms\.txt}) { row($r, class => 'probe', status => 'KEEP-404', group => '', target => '', source => 'sitemap guess by a crawler; the old site never had it'); next }

  # --- the old store pages, older site, leftovers
  if ($lp =~ m{^/store/.+}) { row($r, class => 'old-store', status => 'DECIDE', group => 'old-store-pages', target => "$STORE/", source => 'old store listing page (WooCommerce pages or the pre-2019 store)'); next }
  if ($lp =~ m{^/about/?$}) { row($r, class => 'old-site', status => 'DECIDE', group => 'leftovers', target => '/about-history/', source => 'old About address'); next }
  if ($lp =~ m{^/(static|testimonials?|blog|photos/(?!$)|forms|gallerypro|ecom_|uploads/|graphics/|images/)}) { row($r, class => 'old-site', status => 'DECIDE', group => 'pre-2019-site', target => '', source => 'pre-2019 site page; suggest leave 404'); next }
  if ($lp =~ m{^/(registration|test|hello-world)/?$}) { row($r, class => 'wp-page', status => 'DECIDE', group => 'leftovers', target => '', source => 'old WordPress page (account/test/sample); suggest leave 404'); next }
  if ($lp =~ m{^/(contacto|search/|dealers/.+|which-wooldridge/\$|main\.|res/|icons/|static$|aaabbbccc|fb$|fwc$|fzh$|1$)|%7b|\$%7b}) { row($r, class => 'junk', status => 'KEEP-404', group => '', target => '', source => 'bot probe or a scraped fragment, never a page'); next }
  if ($lp =~ m{^/about-history/?$}) { row($r, class => 'page', status => 'LIVE', group => '', target => '', source => 'moved here 2026-10-28 (Tyler)'); next }
  row($r, class => 'other', status => 'DECIDE', group => 'leftovers', target => '', source => 'no rule matched');
}

# ---- Stephen's approvals live in the table: a re-run carries them over, never resets them ----------
# (they are checked live below like everything else: a page that now exists wins, a dead target is caught)
my %kept;
if (-f "$here/old_urls.tsv") {
  my @h; for my $l (split /\r?\n/, slurp("$here/old_urls.tsv")) {
    next if $l =~ /^#/ || !length $l; my @f = split /\t/, $l, -1;
    if (!@h) { @h = @f; next } my %r; @r{@h} = @f;
    $kept{"$r{host} $r{old_path}"} = \%r if $r{status} eq 'APPROVED' }
}
for my $x (@out) { my $k = $kept{"$x->{host} $x->{path}"} or next;
  @$x{qw(status group target source)} = ('APPROVED', $k->{group}, $k->{target}, $k->{how_it_was_found}) }

# ---- live checks: what does each old path answer today, and does each target answer 200? --------
sub http_codes {
  my @u = @_; my %c; return %c unless @u;
  my $cfg = "$here/.curl_urls.tmp"; open my $h, '>:raw', $cfg or die $!;
  for (@u) { (my $q = $_) =~ s/"/\\"/g; print $h "url = \"$q\"\noutput = \"NUL\"\n" } close $h;
  # -g: no URL globbing ([ ] { } in junk paths). Native curl writes CRLF to a pipe, so strip both.
  for (`curl -s -g --parallel --parallel-max 4 -A "Mozilla/5.0 (WB redirect audit)" --max-time 30 -w "%{http_code}\t%{url_effective}\n" -K "$cfg"`) {
    s/[\r\n]+\z//; my ($code, $u) = split /\t/, $_, 2; $c{$u} = $code if defined $u }
  unlink $cfg; printf STDERR "  http checks: %d asked, %d answered\n", scalar(@u), scalar(keys %c); %c }
if ($o{live}) {
  my %now = http_codes(map { ($_->{host} eq 'apex' ? 'https://wooldridgeboats.com' : $SITE) . $_->{path} } grep { $_->{status} ne 'OTHER-HOST' && $_->{group} ne 'spam-pdfs' && $_->{class} ne 'junk' } @out);
  for my $x (@out) { my $u = ($x->{host} eq 'apex' ? 'https://wooldridgeboats.com' : $SITE) . $x->{path}; $x->{now} = $now{$u} // ''; if (($x->{now} // '') eq '200' && $x->{status} =~ /^(REDIRECT|APPROVED|DECIDE)$/) { $x->{source} = "answers 200 today, no redirect needed (was: $x->{status} - $x->{source})"; $x->{status} = 'LIVE'; $x->{target} = '' } }
  my %t = map { my $u = $_->{target} =~ m{^/} ? "$SITE$_->{target}" : $_->{target}; ($u => 1) } grep { $_->{target} } @out;
  my %tc = http_codes(keys %t);
  for my $x (grep { $_->{target} } @out) { my $u = $x->{target} =~ m{^/} ? "$SITE$x->{target}" : $x->{target}; $x->{target_now} = $tc{$u} // '';
    if ($x->{status} =~ /^(REDIRECT|APPROVED)$/ && $x->{target_now} ne '200') { $x->{source} .= " [TARGET ANSWERED $x->{target_now}: demoted to DECIDE]"; $x->{status} = 'DECIDE'; $x->{group} = 'target-broken' } }
}

# ---- write ---------------------------------------------------------------------------------------
my %rank = (REDIRECT => 0, APPROVED => 1, DECIDE => 2, 'KEEP-404' => 3, LIVE => 4, 'OTHER-HOST' => 5);
open my $T, '>:raw', "$here/old_urls.tsv" or die $!;
print $T "# old_urls.tsv - every old URL that answered 404 on the new site, 2026-10-28 08:16 PDT to 2026-10-29 21:09 PDT (Cloudflare, sampled hits).\n";
print $T "# status: REDIRECT = sourced, goes into .htaccess | DECIDE = Stephen's call (target = suggestion) | APPROVED = Stephen said yes, goes into .htaccess\n";
print $T "#         KEEP-404 = deliberately no redirect | LIVE = answers 200 today | OTHER-HOST = not this site\n";
print $T "# To approve a DECIDE row: set status to APPROVED and the target you want, then run perl _build/redirects/gen_redirects.pl\n";
print $T join("\t", qw(status group hits host old_path target how_it_was_found answered_at_audit target_answered)), "\n";
for my $x (sort { $rank{ $a->{status} } <=> $rank{ $b->{status} } || ($a->{group} cmp $b->{group}) || $b->{hits} <=> $a->{hits} || $a->{path} cmp $b->{path} } @out) {
  print $T join("\t", $x->{status}, $x->{group}, $x->{hits}, $x->{host}, $x->{path}, $x->{target} // '', $x->{source}, $x->{now} // '', $x->{target_now} // ''), "\n";
}
close $T;
my %n; my %h; for (@out) { $n{ $_->{status} }++; $h{ $_->{status} } += $_->{hits} }
printf "%-10s %4d rows %5d hits\n", $_, $n{$_} // 0, $h{$_} // 0 for sort { $rank{$a} <=> $rank{$b} } keys %rank;
print "wrote $here/old_urls.tsv\n";
