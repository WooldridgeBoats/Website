#!/usr/bin/perl
# Pull the old WordPress/WooCommerce URL-bearing objects out of a mysqldump stream on STDIN:
# products (+ SKU, categories), product categories, PDF attachments, and every other
# published post type with its slug. No order or customer data is read.
# usage: zcat dump.sql.gz | perl extract_catalog.pl OUTDIR
use strict; use warnings;
binmode STDIN;
my ($out) = @ARGV; die "usage: OUTDIR\n" unless $out;

my %want = map { $_ => 1 } qw(wp_posts wp_postmeta wp_terms wp_term_taxonomy wp_term_relationships);
my (%post, %meta, %term, %tax, %rel);
my %metakey = map { $_ => 1 } qw(_sku _wp_attached_file _wp_old_slug _regular_price _stock_status);

sub tuples {   # parse "(...),(...);" into arrayrefs; handles MySQL escapes (same parser as extract_orders.pl)
  my ($s) = @_; my @rows; my $i = 0; my $n = length $s;
  while ($i < $n) {
    my $c = substr($s, $i, 1);
    if ($c eq '(') {
      my @f; my $i2 = $i + 1;
      while (1) {
        my $ch = substr($s, $i2, 1);
        if ($ch eq "'") {
          my $v = ''; $i2++;
          while (1) {
            my $d = substr($s, $i2, 1);
            if ($d eq '\\') { my $e = substr($s, $i2 + 1, 1);
              $v .= $e eq 'n' ? "\n" : $e eq 'r' ? "\r" : $e eq 't' ? "\t" : $e eq '0' ? "\0" : $e eq 'Z' ? "\x1a" : $e; $i2 += 2; next }
            if ($d eq "'") { if (substr($s, $i2 + 1, 1) eq "'") { $v .= "'"; $i2 += 2; next } $i2++; last }
            $v .= $d; $i2++;
          }
          push @f, $v;
        } else {
          my $j = $i2; $j++ while substr($s, $j, 1) ne ',' && substr($s, $j, 1) ne ')';
          my $v = substr($s, $i2, $j - $i2); push @f, ($v eq 'NULL' ? undef : $v); $i2 = $j;
        }
        my $sep = substr($s, $i2, 1); $i2++;
        last if $sep eq ')';
      }
      push @rows, \@f; $i = $i2;
    } else { $i++ }
  }
  return @rows;
}

my %cols; my $cur; my $ins;
while (my $line = <STDIN>) {
  if ($line =~ /^CREATE TABLE `([^`]+)`/) { $cur = $1; $cols{$cur} = [] if $want{$cur}; next }
  if ($cur && $want{$cur} && $line =~ /^\s+`([^`]+)` \w/) { push @{ $cols{$cur} }, $1; next }
  if ($line =~ /^INSERT INTO `([^`]+)` \(([^)]*)\) VALUES/) { $ins = $1; $cols{$ins} = [ $2 =~ /`([^`]+)`/g ] if $want{$ins}; next }
  next unless defined $ins && $want{$ins} && $line =~ /^\(/;
  my $t = $ins; my $body = $line; undef $ins if $line =~ /\);\s*$/;
  my @c = @{ $cols{$t} }; my %ix; @ix{@c} = 0 .. $#c;
  for my $r (tuples($body)) {
    if ($t eq 'wp_posts') {
      my $ty = $r->[$ix{post_type}];
      next if $ty =~ /^shop_order/ || $ty eq 'revision' || $ty eq 'nav_menu_item' || $ty eq 'customize_changeset';
      $post{ $r->[$ix{ID}] } = { type => $ty, status => $r->[$ix{post_status}], name => $r->[$ix{post_name}],
        title => $r->[$ix{post_title}], parent => $r->[$ix{post_parent}], mime => $r->[$ix{post_mime_type}],
        guid => $r->[$ix{guid}], date => $r->[$ix{post_date}], modified => $r->[$ix{post_modified}] };
    } elsif ($t eq 'wp_postmeta') {
      next unless $metakey{ $r->[$ix{meta_key}] };
      push @{ $meta{ $r->[$ix{post_id}] }{ $r->[$ix{meta_key}] } }, $r->[$ix{meta_value}];
    } elsif ($t eq 'wp_terms') {
      $term{ $r->[$ix{term_id}] } = { name => $r->[$ix{name}], slug => $r->[$ix{slug}] };
    } elsif ($t eq 'wp_term_taxonomy') {
      $tax{ $r->[$ix{term_taxonomy_id}] } = { term => $r->[$ix{term_id}], taxonomy => $r->[$ix{taxonomy}], parent => $r->[$ix{parent}], count => $r->[$ix{count}] };
    } else {
      push @{ $rel{ $r->[$ix{object_id}] } }, $r->[$ix{term_taxonomy_id}];
    }
  }
}
printf STDERR "posts kept: %d, meta'd: %d, terms: %d, taxonomies: %d\n", scalar(keys %post), scalar(keys %meta), scalar(keys %term), scalar(keys %tax);

sub clean { my $v = shift // ''; $v =~ s/[\t\r\n]+/ /g; $v }
sub m1 { my ($id, $k) = @_; my $a = $meta{$id}{$k} or return ''; clean($a->[0]) }

# products and variations
open my $P, '>:raw', "$out/products.tsv" or die $!;
print $P join("\t", qw(id type status slug title sku parent_id parent_slug old_slugs product_cats stock regular_price modified)), "\n";
for my $id (sort { $a <=> $b } grep { $post{$_}{type} =~ /^product/ } keys %post) {
  my $p = $post{$id};
  my @cats = map { $term{ $tax{$_}{term} }{slug} // "?$_" } grep { $tax{$_} && $tax{$_}{taxonomy} eq 'product_cat' } @{ $rel{$id} // [] };
  my $par = $p->{parent} && $post{ $p->{parent} } ? $post{ $p->{parent} }{name} : '';
  print $P join("\t", $id, $p->{type}, $p->{status}, clean($p->{name}), clean($p->{title}), m1($id, '_sku'), $p->{parent} // '', clean($par),
    join('|', map { clean($_) } @{ $meta{$id}{_wp_old_slug} // [] }), join('|', @cats), m1($id, '_stock_status'), m1($id, '_regular_price'), $p->{modified}), "\n";
}
# taxonomy terms (product_cat, category, product_tag ...)
open my $T, '>:raw', "$out/terms.tsv" or die $!;
print $T join("\t", qw(taxonomy term_id slug name parent_slug count)), "\n";
for my $tt (sort { $tax{$a}{taxonomy} cmp $tax{$b}{taxonomy} } keys %tax) {
  my $x = $tax{$tt}; my $t = $term{ $x->{term} } or next;
  my $ps = ''; if ($x->{parent}) { for my $o (values %tax) { if ($o->{term} == $x->{parent}) { $ps = $term{ $o->{term} }{slug} // ''; last } } }
  print $T join("\t", $x->{taxonomy}, $x->{term}, clean($t->{slug}), clean($t->{name}), $ps, $x->{count}), "\n";
}
# attachments (file path relative to uploads)
open my $A, '>:raw', "$out/attachments.tsv" or die $!;
print $A join("\t", qw(id mime file title parent_id parent_type parent_slug date)), "\n";
for my $id (sort { $a <=> $b } grep { $post{$_}{type} eq 'attachment' } keys %post) {
  my $p = $post{$id}; my $pp = $p->{parent} && $post{ $p->{parent} } ? $post{ $p->{parent} } : undef;
  print $A join("\t", $id, $p->{mime} // '', m1($id, '_wp_attached_file'), clean($p->{title}), $p->{parent} // '', ($pp ? $pp->{type} : ''), ($pp ? clean($pp->{name}) : ''), $p->{date}), "\n";
}
# everything else with a slug (pages, posts, custom post types)
open my $O, '>:raw', "$out/other_posts.tsv" or die $!;
print $O join("\t", qw(id type status slug title parent_slug old_slugs modified)), "\n";
for my $id (sort { $post{$a}{type} cmp $post{$b}{type} || $a <=> $b } grep { $post{$_}{type} !~ /^(product|product_variation|attachment)$/ } keys %post) {
  my $p = $post{$id}; my $par = $p->{parent} && $post{ $p->{parent} } ? $post{ $p->{parent} }{name} : '';
  print $O join("\t", $id, $p->{type}, $p->{status}, clean($p->{name}), clean($p->{title}), clean($par), join('|', map { clean($_) } @{ $meta{$id}{_wp_old_slug} // [] }), $p->{modified}), "\n";
}
print STDERR "wrote products.tsv terms.tsv attachments.tsv other_posts.tsv to $out\n";
