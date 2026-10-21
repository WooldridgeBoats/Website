package WBPriceCanon;
# WBPriceCanon.pm - shared code for the PRICING canon tools:
#   _build/gen_from_canon.pl        canon -> website surfaces (writes; pricing since v2.0)
#   _build/verify_pricing_canon.pl  canon vs website surfaces (read-only)
#
# CORE PERL ONLY (JSON::PP, Encode, Digest::SHA). Runs on macOS system perl and on
# the perl that rides Git for Windows. Every path is passed in by the caller.
#
# What "the site" means here: the configurator's const MODELS with
# tools/RULES_OVERLAY.js applied (the exact enumeration the canon was built from -
# a verbatim port of QB IMPORT\_build\extract_catalog.pl, itself a port of
# gen_pricesheets.pl), plus the trailer picker's const DATA. Canon rows are keyed
# the way the 2026-10-13 Phase 0 reconciliation keyed them:
#   BOATS    BASE HULL  model_id | configuration | length_ft     ADD  model_id
#   ENGINES  model_id | configuration | length_ft | engine
#   OPTIONS  model_id | item_id | length_ft (blank unless the price is per length)
#   TRAILERS trailer (TRAILER rows), trailer | item (STD ITEM / OPT ITEM rows)
#
# Stage one ("prices first", Stephen 2026-10-14): the workbook drives every PRICE.
# Any other difference (a name, a category, a restriction, a missing or extra row)
# is reported as NOT WIRED YET and stops the command - it is never skipped.
use strict;
use warnings;
use JSON::PP;
use Digest::SHA ();
use Encode qw(decode encode);
use Exporter 'import';
use File::Basename qw(dirname);
use Cwd qw(abs_path);
use POSIX ();
use IO::Uncompress::Unzip ();
use lib dirname(abs_path(__FILE__));
use WBSpecCanon qw(slurp_bytes slurp_text);

our @EXPORT_OK = qw(PRICE_TABS FROM_PAGES jparse jget load_site canon_from_tabs compare_prices plan_price_writes
                    apply_splices fmt_price numeq rows_of from_prices from_nodes mirror_bytes soc_blobs soc_file_bytes
                    verify_pricing OPTION_GUIDE OPTION_GUIDE_MAP option_guide_plan
                    SHEET_FAMILIES sheet_stamp sheet_unchanged keep_unchanged_sheets);

use constant PRICE_TABS => ('BOATS', 'ENGINES', 'OPTIONS', 'TRAILERS', 'PACKAGES', 'CARRY OUT', 'DISCREPANCIES', 'PROVENANCE');

# ------------------------------------------------------------ numbers ----
sub is_num { my ($v) = @_; return defined $v && $v =~ /^\s*-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?\s*$/ }
sub numeq {                          # '' == '' ; numbers by value ; anything else by string
  my ($a, $b) = @_;
  $a = '' unless defined $a; $b = '' unless defined $b;
  return 1 if $a eq $b;
  return 0 unless is_num($a) && is_num($b);
  return abs((0 + $a) - (0 + $b)) <= 1e-9 * (abs(0 + $a) + abs(0 + $b) + 1);
}
sub fmt_price {                      # canon cell -> the configurator's JSON literal (integer when whole)
  my ($v) = @_;
  return 'null' if !defined $v || $v eq '';
  die "price '$v' is not a number\n" unless is_num($v);
  my $n = 0 + $v;
  return sprintf('%d', $n) if $n == int($n);
  my $s = sprintf('%.10f', $n); $s =~ s/0+$//; $s =~ s/\.$//;
  return $s;
}

# ------------------------------------------------- JSON with byte spans ----
# jparse($text, $i) -> ($node, $index after the value). A node remembers where its
# value sits in $text: { t => o|a|s|n|l, s => start, e => end (inclusive) },
# objects also kv => [[key, node]...] and h => { key => node }, arrays a => [nodes],
# numbers and literals v => raw text. Strings are not decoded (keys are).
sub _unesc {
  my ($r) = @_;
  return $r unless $r =~ /\\/;
  return JSON::PP->new->allow_nonref->decode(qq{"$r"});
}
sub jparse {
  my ($s, $i) = @_;
  pos($s) = $i;
  $s =~ /\G[ \t\r\n]*/gc; $i = pos($s);
  my $c = substr($s, $i, 1);
  if ($c eq '{' || $c eq '[') {
    my $obj = $c eq '{';
    my %n = (t => ($obj ? 'o' : 'a'), s => $i);
    if ($obj) { $n{kv} = []; $n{h} = {} } else { $n{a} = [] }
    $i++;
    pos($s) = $i; $s =~ /\G[ \t\r\n]*/gc; $i = pos($s);
    if (substr($s, $i, 1) eq ($obj ? '}' : ']')) { $n{e} = $i; return (\%n, $i + 1) }
    while (1) {
      my $key;
      if ($obj) {
        pos($s) = $i; $s =~ /\G[ \t\r\n]*"((?:[^"\\]|\\.)*)"[ \t\r\n]*:/gcs or die "JSON: expected a key at $i\n";
        $key = _unesc($1); $i = pos($s);
      }
      my ($v, $j) = jparse($s, $i);
      if ($obj) { push @{ $n{kv} }, [$key, $v]; die "JSON: duplicate key '$key' at $i\n" if $n{h}{$key}; $n{h}{$key} = $v }
      else { push @{ $n{a} }, $v }
      pos($s) = $j; $s =~ /\G[ \t\r\n]*([,}\]])/gc or die "JSON: expected , or close at $j\n";
      if ($1 eq ',') { $i = pos($s); next }
      $n{e} = pos($s) - 1;
      return (\%n, pos($s));
    }
  }
  if ($c eq '"') {
    pos($s) = $i; $s =~ /\G"((?:[^"\\]|\\.)*)"/gcs or die "JSON: bad string at $i\n";
    return ({ t => 's', s => $i, e => pos($s) - 1 }, pos($s));
  }
  pos($s) = $i;
  if ($s =~ /\G(-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?)/gc) { return ({ t => 'n', s => $i, e => pos($s) - 1, v => $1 }, pos($s)) }
  if ($s =~ /\G(true|false|null)/gc) { return ({ t => 'l', s => $i, e => pos($s) - 1, v => $1 }, pos($s)) }
  die "JSON: unexpected '" . substr($s, $i, 10) . "' at $i\n";
}
sub jget {                           # (node, path...) -> node or undef ; path = keys / array indexes
  my ($n, @p) = @_;
  for my $k (@p) {
    return undef unless $n;
    if ($n->{t} eq 'o') { $n = $n->{h}{$k} }
    elsif ($n->{t} eq 'a') { $n = $n->{a}[$k] }
    else { return undef }
  }
  return $n;
}

# --------------------------------------------------------------- site ----
sub _one_line {                      # (text, regex with 2 groups: prefix, json) -> (json, absolute start)
  my ($t, $re, $what) = @_;
  my @hits;
  while ($t =~ /$re/g) { push @hits, [$2, $-[2]] }
  die "$what: expected exactly 1 line, found " . scalar(@hits) . "\n" unless @hits == 1;
  return @{ $hits[0] };
}
sub load_site {                      # repo -> everything the pricing tools read from the website
  my ($repo) = @_;
  my %S = (repo => $repo);
  my $cfgp = "$repo/build-and-price/index.html";
  my ($t, $eol) = slurp_text($cfgp);
  @S{qw(cfg_path cfg_text cfg_eol)} = ($cfgp, $t, $eol);
  my ($mj, $moff) = _one_line($t, qr/^(const MODELS = )(\[.*?\]);[ \t]*$/m, 'const MODELS');
  my ($dj, $doff) = _one_line($t, qr/^(const DATA = )(\{"Single Axle":.*\});[ \t]*$/m, 'const DATA (trailer picker)');
  my ($mk) = $t =~ /^const DEFAULT_MARKUP = ([0-9.]+);/m;
  die "const DEFAULT_MARKUP not found\n" unless defined $mk;
  @S{qw(models_json models_off data_json data_off markup)} = ($mj, $moff, $dj, $doff, 0 + $mk);
  $S{models_raw} = JSON::PP->new->decode($mj);
  ($S{models_tree}) = jparse($mj, 0);
  $S{data} = JSON::PP->new->decode($dj);
  ($S{data_tree}) = jparse($dj, 0);

  my $ovp = "$repo/tools/RULES_OVERLAY.js";
  my $ovl = slurp_text($ovp);
  $S{overlay_path} = $ovp;
  my %OV;
  for my $k (qw(catalogPatches addStyles addItems hideItems renameItems)) {
    $OV{$k} = $ovl =~ /^\s*\Q$k\E:\s*([\[\{].*?[\]\}]),\r?$/m ? JSON::PP->new->decode($1) : undef;
  }
  $S{OV} = \%OV;
  _enumerate(\%S);
  _enumerate_trailers(\%S);
  return \%S;
}

# A verbatim port of extract_catalog.pl's overlay application, run on a deep copy,
# recording where every resulting row lives in the RAW blob.
sub _enumerate {
  my ($S) = @_;
  my $raw = $S->{models_raw};
  my $models = JSON::PP->new->decode(JSON::PP->new->encode($raw));   # deep copy
  my $OV = $S->{OV};
  my %by_id = map { $_->{id} => $_ } @$models;
  my (%rawlen, %copy_of, %added);
  for my $p (@{ $OV->{catalogPatches} || [] }) {
    my $mo = $by_id{ $p->{m} } or next;
    if ($p->{lenRename}) {
      my ($from, $to) = @{ $p->{lenRename} }{qw(from to)};
      $rawlen{"$mo->{id}|$to"} = $from;
      $mo->{lengths} = [ map { $_ == $from ? $to : $_ } @{ $mo->{lengths} } ];
      for my $s (@{ $mo->{styles} }) { for my $k (qw(hulls hullNotes)) { next unless $s->{$k} && exists $s->{$k}{$from}; $s->{$k}{$to} = delete $s->{$k}{$from} } }
      my %ne; $ne{ ($_ =~ /^(.*?)\Q$from\E$/) ? "$1$to" : $_ } = $mo->{engines}{$_} for keys %{ $mo->{engines} };
      $mo->{engines} = \%ne;
      $mo->{tag} =~ s/\b\Q$from\E\b/$to/ if $mo->{tag};
      for my $c (@{ $mo->{cats} }) { for my $it (@{ $c->{items} }) {
        $it->{lens} = [ map { $_ == $from ? $to : $_ } @{ $it->{lens} } ] if $it->{lens};
        if (ref $it->{price} eq 'HASH' && exists $it->{price}{$from}) { $it->{price}{$to} = delete $it->{price}{$from} }
      } }
      $mo->{adder}{lens} = [ map { $_ == $from ? $to : $_ } @{ $mo->{adder}{lens} } ] if $mo->{adder} && $mo->{adder}{lens};
      next;
    }
    if ($p->{styleId}) { my ($s) = grep { $_->{id} eq $p->{styleId} } @{ $mo->{styles} }; $s->{ $p->{prop} } = $p->{v} if $s }
    else { $mo->{ $p->{prop} } = $p->{v} }
  }
  for my $s (@{ $OV->{addStyles} || [] }) {
    my $mo = $by_id{ $s->{m} } or next;
    next if grep { $_->{id} eq $s->{id} } @{ $mo->{styles} };
    my ($src) = grep { $_->{id} eq $s->{copyHullsFrom} } @{ $mo->{styles} };
    next unless $src;
    push @{ $mo->{styles} }, { id => $s->{id}, nm => $s->{nm}, hulls => { %{ $src->{hulls} } }, hullNotes => { %{ $src->{hullNotes} || {} } } };
    $copy_of{"$mo->{id}|$s->{id}"} = $s->{copyHullsFrom};
    for my $len (@{ $mo->{lengths} }) {
      my ($f, $t) = ($s->{copyHullsFrom} . $len, $s->{id} . $len);
      $mo->{engines}{$t} = $mo->{engines}{$f} if $mo->{engines}{$f} && !$mo->{engines}{$t};
    }
  }
  for my $a (@{ $OV->{addItems} || [] }) {
    my $mo = $by_id{ $a->{m} } or next;
    my ($cat) = grep { $_->{name} eq $a->{cat} } @{ $mo->{cats} };
    next if !$cat || grep { $_->{id} eq $a->{id} } @{ $cat->{items} };
    my $row = { id => $a->{id}, nm => $a->{nm}, price => $a->{price} };
    $added{ $a->{id} } = 1;
    my ($at) = grep { $cat->{items}[$_]{id} eq ($a->{after} // '') } 0 .. $#{ $cat->{items} };
    if (defined $at) { splice @{ $cat->{items} }, $at + 1, 0, $row } else { push @{ $cat->{items} }, $row }
  }
  my %hide = map { $_ => 1 } @{ $OV->{hideItems} || [] };
  my %ren  = %{ $OV->{renameItems} || {} };
  for my $mo (@$models) { for my $c (@{ $mo->{cats} }) {
    $c->{items} = [ grep { !$hide{ $_->{id} } } @{ $c->{items} } ];
    $_->{nm} = $ren{ $_->{id} } for grep { $ren{ $_->{id} } } @{ $c->{items} };
  } }

  # where things live in the RAW blob
  my (%mi, %si, %item);
  for my $i (0 .. $#$raw) {
    my $m = $raw->[$i]; $mi{ $m->{id} } = $i;
    $si{"$m->{id}|$m->{styles}[$_]{id}"} = $_ for 0 .. $#{ $m->{styles} };
    for my $c (0 .. $#{ $m->{cats} }) { for my $k (0 .. $#{ $m->{cats}[$c]{items} }) { $item{"$m->{id}|$m->{cats}[$c]{items}[$k]{id}"} = [$c, $k] } }
  }
  my %rows;                          # tab => { key => row }
  my $put = sub { my ($tab, $k, $r) = @_; die "site enumeration: duplicate $tab key $k\n" if $rows{$tab}{$k}; $rows{$tab}{$k} = $r };
  for my $mo (@$models) {
    my $mid = $mo->{id};
    my $rl = sub { my ($len) = @_; return exists $rawlen{"$mid|$len"} ? $rawlen{"$mid|$len"} : $len };
    for my $s (@{ $mo->{styles} }) {
      my $src = $copy_of{"$mid|$s->{id}"};
      for my $len (sort { $a <=> $b } @{ $mo->{lengths} }) {
        my $v = $s->{hulls}{$len};
        next unless defined $v || ($s->{hullNotes} && $s->{hullNotes}{$len});
        $put->('BOATS', "H|$mid|$s->{nm}|$len", { price => (defined $v ? $v : ''), note => ($s->{hullNotes} ? ($s->{hullNotes}{$len} // '') : ''),
          model => $mo->{nm}, config => $s->{nm},
          loc => { kind => 'hull', model => $mid, style => $s->{id}, rawlen => $rl->($len), copy_of => $src } });
      }
      for my $len (sort { $a <=> $b } @{ $mo->{lengths} }) {
        my $eng = $mo->{engines}{ $s->{id} . $len } or next;
        for my $ix (0 .. $#$eng) {
          my $e = $eng->[$ix];
          my @extra = sort grep { $_ ne 'nm' && $_ ne 'price' } keys %$e;
          $put->('ENGINES', "E|$mid|$s->{nm}|$len|$e->{nm}", { price => (defined $e->{price} ? $e->{price} : ''), flags => join('|', @extra),
            loc => { kind => 'engine', model => $mid, style => ($src // $s->{id}), rawlen => $rl->($len), idx => $ix, copy_of => $src } });
        }
      }
    }
    if (my $ad = $mo->{adder}) {
      $put->('BOATS', "ADD|$mid", { price => (defined $ad->{price} ? $ad->{price} : ''), config => ($ad->{nm} // ''), note => ($ad->{desc} // ''),
        lens => ($ad->{lens} ? join('|', @{ $ad->{lens} }) : ''), loc => { kind => 'adder', model => $mid } });
    }
    for my $c (@{ $mo->{cats} }) {
      for my $it (@{ $c->{items} }) {
        my $p = $it->{price};
        my $st = $it->{style}; my $str = defined $st ? (ref $st ? join('|', @$st) : $st) : '';
        my @extra = sort grep { my $k = $_; !grep { $k eq $_ } qw(id nm price lens style) } keys %$it;
        my $flags = join('|', @extra);
        my $qty = ($flags =~ /\bqty\b/) ? ' x QTY (quantity-selectable)' : '';
        my $perfoot = ($it->{nm} =~ /per\s+(?:linear\s+)?f(?:oo|ee)?t\b|\bper ft\b|\/ft\b/i) ? 1 : 0;
        my %common = (name => $it->{nm}, cat => $c->{name}, styr => $str, lenr => ($it->{lens} ? join('|', @{ $it->{lens} }) : ''), flags => $flags,
                      qty => $qty, perfoot => $perfoot);
        my $where = $added{ $it->{id} } ? { kind => 'added', model => $mid, id => $it->{id} }
                  : do { my $x = $item{"$mid|$it->{id}"} or die "site enumeration: $mid item $it->{id} not in the raw blob\n";
                         { kind => 'option', model => $mid, id => $it->{id}, cat => $x->[0], item => $x->[1] } };
        if (ref $p eq 'HASH') {
          for my $len (sort { $a <=> $b } keys %$p) {
            my $v = $p->{$len};
            $put->('OPTIONS', "O|$mid|$it->{id}|$len", { %common, price => (defined $v ? $v : ''), perlen => 1,
              unit => (defined $v ? ($perfoot ? 'PER FOOT' : 'FLAT') : 'PRICED ON REQUEST') . $qty,
              loc => { %$where, len => $len, rawlen => $rl->($len) } });
          }
        } else {
          $put->('OPTIONS', "O|$mid|$it->{id}|", { %common, price => (defined $p ? $p : ''), perlen => 0,
            unit => (defined $p ? ($perfoot ? 'PER FOOT' : 'FLAT') : 'PRICED ON REQUEST') . $qty, loc => $where });
        }
      }
    }
  }
  $S->{rows} = \%rows;
  $S->{model_index} = \%mi;
  $S->{style_index} = \%si;
  $S->{copy_of} = \%copy_of;
  $S->{added} = \%added;
  $S->{models_applied} = $models;
}

sub _enumerate_trailers {
  my ($S) = @_;
  my $D = $S->{data}; my $MK = $S->{markup};
  my $rp = sub { my ($v) = @_; return '' unless defined $v; return int($v * $MK + 0.5) };
  my %T;
  for my $axle (sort keys %$D) {
    my $series = $D->{$axle};
    for my $si (0 .. $#$series) {
      my $s = $series->[$si];
      for my $mi (0 .. $#{ $s->{models} }) {
        my $m = $s->{models}[$mi];
        die "trailer picker: trailer '$m->{name}' appears twice\n" if $T{"T|$m->{name}"};
        my $std = 0; $std += $_->{cost} for @{ $m->{std} || [] };
        $T{"T|$m->{name}"} = { axle => $axle, series => $s->{series}, base => $rp->($m->{base}), std_total => $rp->($std),
          as_stocked => (defined $m->{base} ? $rp->($m->{base} + $std) : ''), fits => ($m->{boats} // ''), desc => ($m->{desc} // ''),
          loc => { kind => 'trailer', path => [$axle, $si, 'models', $mi] } };
        for my $kind (qw(std opt)) {
          my $list = $m->{$kind} || [];
          for my $ix (0 .. $#$list) {
            my $it = $list->[$ix];
            my $k = ($kind eq 'std' ? 'S' : 'P') . "|$m->{name}|$it->{item}";
            die "trailer picker: $m->{name} lists '$it->{item}' twice under $kind\n" if $T{$k};
            $T{$k} = { price => $rp->($it->{cost} // 0), caution => (defined $it->{caution} ? "Caution: $it->{caution}" : ''),
              loc => { kind => "trailer_$kind", path => [$axle, $si, 'models', $mi, $kind, $ix] } };
          }
        }
      }
    }
  }
  $S->{rows}{TRAILERS} = \%T;
}

# -------------------------------------------------------------- canon ----
sub rows_of {                        # tab grid (array of arrays, header first) -> arrayref of hashes
  my ($grid, $name) = @_;
  die "canon tab '$name' is missing or empty\n" unless $grid && @$grid;
  my @g = @$grid; my $h = $g[0];
  my @hdr = @$h; pop @hdr while @hdr && $hdr[-1] eq '';
  my @out;
  for my $r (@g[1 .. $#g]) { my %x; @x{@hdr} = map { defined $_ ? $_ : '' } @$r[0 .. $#hdr]; push @out, \%x }
  return \@out;
}
sub canon_from_tabs {                # { tab => grid } -> { BOATS => {key=>row}, ENGINES..., OPTIONS..., TRAILERS... }
  my ($tabs) = @_;
  my %C;
  my $put = sub { my ($tab, $k, $r) = @_; die "canon $tab: two rows share the key $k - fix the workbook\n" if $C{$tab}{$k}; $C{$tab}{$k} = $r };
  for my $r (@{ rows_of($tabs->{BOATS}, 'BOATS') }) {
    if ($r->{row_type} eq 'BASE HULL') { $put->('BOATS', "H|$r->{model_id}|$r->{configuration}|$r->{length_ft}", $r) }
    elsif ($r->{row_type} =~ /^CONFIG UPCHARGE/) { $put->('BOATS', "ADD|$r->{model_id}", $r) }
    else { die "canon BOATS: unknown row_type '$r->{row_type}'\n" }
  }
  $put->('ENGINES', "E|$_->{model_id}|$_->{configuration}|$_->{length_ft}|$_->{engine}", $_) for @{ rows_of($tabs->{ENGINES}, 'ENGINES') };
  $put->('OPTIONS', "O|$_->{model_id}|$_->{item_id}|$_->{length_ft}", $_) for @{ rows_of($tabs->{OPTIONS}, 'OPTIONS') };
  my @addons;
  for my $r (@{ rows_of($tabs->{TRAILERS}, 'TRAILERS') }) {
    my $t = $r->{row_type};
    if    ($t eq 'TRAILER')      { $put->('TRAILERS', "T|$r->{trailer}", $r) }
    elsif ($t =~ /^STD ITEM/)    { $put->('TRAILERS', "S|$r->{trailer}|$r->{item}", $r) }
    elsif ($t eq 'OPT ITEM')     { $put->('TRAILERS', "P|$r->{trailer}|$r->{item}", $r) }
    elsif ($t =~ /^SHOP ADD-ON/) { push @addons, $r }
  }
  $C{ADDONS} = \@addons;
  return \%C;
}

# ------------------------------------------------------------ compare ----
# compare_prices(site, canon) -> { counts => {tab => {canon, site, match}}, price => [diffs], other => [diffs], link => [msgs], math => [msgs] }
# price diffs carry {tab, key, canon, site, loc, row}. "other" = NOT WIRED YET (stops the command).
sub compare_prices {
  my ($S, $C) = @_;
  my %R = (price => [], other => [], link => [], math => [], counts => {});
  my $other = sub { my ($tab, $key, $msg) = @_; push @{ $R{other} }, { tab => $tab, key => $key, msg => $msg } };
  for my $tab (qw(BOATS ENGINES OPTIONS)) {
    my $c = $C->{$tab} || {}; my $s = $S->{rows}{$tab} || {};
    my ($n, $ok) = (0, 0);
    for my $k (sort keys %$c) {
      $n++;
      my $cr = $c->{$k}; my $sr = $s->{$k};
      if (!$sr) { $other->($tab, $k, "row is in the workbook but not on the site (adding rows is not wired yet)"); next }
      my @d;
      if ($tab eq 'BOATS') {
        if ($k =~ /^ADD\|/) {
          push @d, "lengths workbook=[$cr->{length_ft}] site=[$sr->{lens}]" unless $cr->{length_ft} eq $sr->{lens};
          push @d, "configuration workbook=[$cr->{configuration}] site=[$sr->{config}]" unless $cr->{configuration} eq $sr->{config};
          push @d, "note does not contain the site's description [$sr->{note}]" unless index($cr->{note}, $sr->{note}) >= 0;
        } else {
          push @d, "model workbook=[$cr->{model}] site=[$sr->{model}]" unless $cr->{model} eq $sr->{model};
          push @d, "note workbook=[$cr->{note}] site=[$sr->{note}]" unless $cr->{note} eq $sr->{note};
        }
      } elsif ($tab eq 'ENGINES') {
        push @d, "flags workbook=[$cr->{data_flags}] site=[$sr->{flags}]" unless $cr->{data_flags} eq $sr->{flags};
      } else {
        push @d, "name workbook=[$cr->{option}] site=[$sr->{name}]" unless $cr->{option} eq $sr->{name};
        push @d, "category workbook=[$cr->{category}] site=[$sr->{cat}]" unless $cr->{category} eq $sr->{cat};
        push @d, "config_restriction workbook=[$cr->{config_restriction}] site=[$sr->{styr}]" unless $cr->{config_restriction} eq $sr->{styr};
        push @d, "length_restriction workbook=[$cr->{length_restriction}] site=[$sr->{lenr}]" unless $cr->{length_restriction} eq $sr->{lenr};
        push @d, "flags workbook=[$cr->{data_flags}] site=[$sr->{flags}]" unless $cr->{data_flags} eq $sr->{flags};
        # the unit follows from the WORKBOOK price: blank = PRICED ON REQUEST
        my $want = ($cr->{price_usd} eq '' ? 'PRICED ON REQUEST' : ($sr->{perfoot} ? 'PER FOOT' : 'FLAT')) . $sr->{qty};
        push @{ $R{math} }, "OPTIONS $k ($cr->{option}): unit says [$cr->{unit}] but a " . ($cr->{price_usd} eq '' ? 'blank' : 'filled-in')
          . " price means [$want] - change the unit cell to $want" unless $cr->{unit} eq $want;
      }
      $other->($tab, $k, join('; ', @d)) if @d;
      die "canon $tab $k: price '$cr->{price_usd}' is not a number\n" if $cr->{price_usd} ne '' && !is_num($cr->{price_usd});
      if (numeq($cr->{price_usd}, $sr->{price})) { $ok++ unless @d }
      else { push @{ $R{price} }, { tab => $tab, key => $k, canon => $cr->{price_usd}, site => $sr->{price}, loc => $sr->{loc}, row => $cr } }
    }
    for my $k (sort keys %$s) { next if $c->{$k}; $other->($tab, $k, "row is on the site but not in the workbook (removing rows is not wired yet)") }
    $R{counts}{$tab} = { canon => $n, site => scalar keys %$s, match => $ok };
  }

  # One QuickBooks ^ item carries ONE price (Stephen 2026-09-22: the ^ item is the price bridge). Rows that share
  # a ^ path - an option sold on 18 models, a motor rigged on many hulls - must all carry the same price, or
  # QuickBooks, the lookup page and the census disagree about which number is right. Held on every row today
  # (measured 2026-10-14: 284 shared items, 0 with two prices).
  for my $tab (qw(BOATS ENGINES OPTIONS)) {
    my %by;
    for my $cr (values %{ $C->{$tab} || {} }) { my $p = $cr->{qb_item_full_path} // ''; next unless $p =~ /^\^/; push @{ $by{$p}{ $cr->{price_usd} } }, $cr->{model_id} }
    for my $p (sort keys %by) {
      my @v = sort keys %{ $by{$p} }; next if @v < 2;
      push @{ $R{math} }, "$tab $p: one QuickBooks item, but its rows carry " . scalar(@v) . " prices ("
        . join('; ', map { my %m = map { $_ => 1 } @{ $by{$p}{$_} }; ($_ eq '' ? 'blank' : $_) . ' on ' . join(',', sort keys %m) } @v)
        . ") - QuickBooks holds one price per item: give every row the same price";
    }
  }

  # Center Console (Q-CFG-12) twins: a copied style carries no price of its own.
  # In the WORKBOOK every copy row must equal its source row - that is the link.
  my %cfgname;                       # model|style id -> configuration name on the site
  for my $mo (@{ $S->{models_applied} }) { $cfgname{"$mo->{id}|$_->{id}"} = $_->{nm} for @{ $mo->{styles} } }
  my ($links, $linked) = (0, 0);
  for my $tab (qw(BOATS ENGINES)) {
    for my $k (sort keys %{ $S->{rows}{$tab} }) {
      my $sr = $S->{rows}{$tab}{$k}; my $src = $sr->{loc}{copy_of} or next;
      my $mid = $sr->{loc}{model};
      my $copy_nm = $cfgname{"$mid|" . ($tab eq 'BOATS' ? $sr->{loc}{style} : _style_of_key($S, $tab, $k))};
      my $src_nm = $cfgname{"$mid|$src"};
      (my $sk = $k) =~ s/^([HE])\|\Q$mid\E\|\Q$copy_nm\E\|/$1|$mid|$src_nm|/ or die "link key rewrite failed for $k\n";
      $links++;
      my $cr = $C->{$tab}{$k}; my $cs = $C->{$tab}{$sk};
      if (!$cr || !$cs) { push @{ $R{link} }, "$tab $k: twin row missing in the workbook (" . (!$cr ? 'the copy' : "its source $sk") . ")"; next }
      if (numeq($cr->{price_usd}, $cs->{price_usd})) { $linked++ }
      else { push @{ $R{link} }, "$tab $k is $copy_nm, priced as a copy of $src_nm (Grant's rule Q-CFG-12): workbook says $cr->{price_usd} but its $src_nm twin says $cs->{price_usd}. Edit the $src_nm row; the $copy_nm row must carry the same number." }
    }
  }
  $R{counts}{LINKS} = { pairs => $links, linked => $linked };

  # trailers
  my $c = $C->{TRAILERS} || {}; my $s = $S->{rows}{TRAILERS} || {};
  my ($n, $ok) = (0, 0); my %stdsum;
  for my $k (sort keys %$c) {
    my $cr = $c->{$k}; my $sr = $s->{$k};
    $n++;
    if (!$sr) { $other->('TRAILERS', $k, "row is in the workbook but not in the trailer picker (adding trailers or items is not wired yet)"); next }
    if ($k =~ /^T\|/) {
      my @d;
      push @d, "axle workbook=[$cr->{axle_group}] site=[$sr->{axle}]" unless $cr->{axle_group} eq $sr->{axle};
      push @d, "series workbook=[$cr->{series}] site=[$sr->{series}]" unless $cr->{series} eq $sr->{series};
      push @d, "fits workbook=[$cr->{fits_hulls}] site=[$sr->{fits}]" unless $cr->{fits_hulls} eq $sr->{fits};
      push @d, "description workbook=[$cr->{description_or_note}] site=[$sr->{desc}]" unless $cr->{description_or_note} eq $sr->{desc};
      $other->('TRAILERS', $k, join('; ', @d)) if @d;
      if (numeq($cr->{trailer_base_retail}, $sr->{base})) { $ok++ unless @d }
      else { push @{ $R{price} }, { tab => 'TRAILERS', key => $k, canon => $cr->{trailer_base_retail}, site => $sr->{base}, loc => $sr->{loc}, row => $cr } }
    } else {
      $stdsum{ $cr->{trailer} } += ($cr->{item_retail_usd_markup_baked} || 0) if $k =~ /^S\|/;
      if ($k =~ /^P\|/ && ($cr->{description_or_note} // '') ne $sr->{caution}) {
        $other->('TRAILERS', $k, "note workbook=[$cr->{description_or_note}] site caution=[$sr->{caution}]");
      }
      if (numeq($cr->{item_retail_usd_markup_baked}, $sr->{price})) { $ok++ }
      else { push @{ $R{price} }, { tab => 'TRAILERS', key => $k, canon => $cr->{item_retail_usd_markup_baked}, site => $sr->{price}, loc => $sr->{loc}, row => $cr } }
    }
  }
  for my $k (sort keys %$s) { next if $c->{$k}; $other->('TRAILERS', $k, "is in the trailer picker but not in the workbook (removing is not wired yet)") }
  # the workbook's own arithmetic: as-stocked = base + standard items (the QuickBooks ^ trailer price)
  for my $k (sort grep { /^T\|/ } keys %$c) {
    my $cr = $c->{$k}; my $t = $cr->{trailer}; my $std = $stdsum{$t} || 0;
    push @{ $R{math} }, "TRAILERS $t: std_items_retail_total says $cr->{std_items_retail_total} but its STD ITEM rows add up to $std" unless numeq($cr->{std_items_retail_total}, $std);
    my $as = ($cr->{trailer_base_retail} || 0) + $std;
    push @{ $R{math} }, "TRAILERS $t: as_stocked_retail says $cr->{as_stocked_retail} but base $cr->{trailer_base_retail} + standard items $std = $as" unless numeq($cr->{as_stocked_retail}, $as);
  }
  $R{counts}{TRAILERS} = { canon => $n, site => scalar keys %$s, match => $ok };
  return \%R;
}
sub _style_of_key {                  # ENGINES site key -> the style id it was enumerated under
  my ($S, $tab, $k) = @_;
  my ($mid, $cfg) = $k =~ /^E\|([^|]*)\|([^|]*)\|/;
  for my $mo (@{ $S->{models_applied} }) { next unless $mo->{id} eq $mid; for (@{ $mo->{styles} }) { return $_->{id} if $_->{nm} eq $cfg } }
  die "no style named $cfg on $mid\n";
}

# ---------------------------------------------------------- the writer ----
# plan_price_writes(site, compare result) -> { models => [splices], data => [splices], overlay => {item id => price or undef}, refuse => [msgs] }
# A splice is [start, length, replacement] against the JSON text of const MODELS / const DATA.
sub plan_price_writes {
  my ($S, $R) = @_;
  my %P = (models => [], data => [], overlay => {}, refuse => []);
  my $MT = $S->{models_tree}; my $DT = $S->{data_tree};
  my $mi = $S->{model_index}; my $si = $S->{style_index};
  my %seen;
  for my $d (@{ $R->{price} }) {
    my $l = $d->{loc}; my $lit = fmt_price($d->{canon});
    my $node;
    if ($l->{copy_of}) { next }      # a twin follows its source; compare_prices() proved the link
    if ($l->{kind} eq 'hull') {
      $node = jget($MT, $mi->{ $l->{model} }, 'styles', $si->{"$l->{model}|$l->{style}"}, 'hulls', $l->{rawlen});
    } elsif ($l->{kind} eq 'engine') {
      $node = jget($MT, $mi->{ $l->{model} }, 'engines', $l->{style} . $l->{rawlen}, $l->{idx}, 'price');
    } elsif ($l->{kind} eq 'adder') {
      $node = jget($MT, $mi->{ $l->{model} }, 'adder', 'price');
    } elsif ($l->{kind} eq 'option') {
      my $base = jget($MT, $mi->{ $l->{model} }, 'cats', $l->{cat}, 'items', $l->{item});
      $node = exists $l->{rawlen} ? jget($base, 'price', $l->{rawlen}) : jget($base, 'price');
    } elsif ($l->{kind} eq 'added') {
      if (exists $l->{rawlen}) { push @{ $P{refuse} }, "$d->{tab} $d->{key}: a per-length price on an overlay-added option is not wired"; next }
      $P{overlay}{ $l->{id} } = ($d->{canon} eq '' ? undef : 0 + $d->{canon});
      next;
    } elsif ($l->{kind} =~ /^trailer/) {
      die "trailer picker DEFAULT_MARKUP is $S->{markup}, not 1 - the writer cannot turn a retail price back into the picker's number\n" unless $S->{markup} == 1;
      my @p = @{ $l->{path} };
      $node = $l->{kind} eq 'trailer' ? jget($DT, @p, 'base') : jget($DT, @p, 'cost');
      if (!$node) { push @{ $P{refuse} }, "$d->{tab} $d->{key}: no price field to write in the trailer picker"; next }
      die "trailer price must be a number ($d->{key})\n" if $lit eq 'null';
      push @{ $P{data} }, [$node->{s}, $node->{e} - $node->{s} + 1, $lit] unless $seen{"D$node->{s}"}++;
      next;
    } else { die "unknown location kind $l->{kind}\n" }
    if (!$node || ($node->{t} ne 'n' && $node->{t} ne 'l')) {
      push @{ $P{refuse} }, "$d->{tab} $d->{key}: the site has no single price field here (" . ($node ? "found a $node->{t}" : 'nothing') . ") - a price that changes shape (one price <-> per-length, or a new length) is not wired yet";
      next;
    }
    push @{ $P{models} }, [$node->{s}, $node->{e} - $node->{s} + 1, $lit] unless $seen{"M$node->{s}"}++;
  }
  return \%P;
}
sub apply_splices {                  # (text, [splices]) -> new text ; applied from the end backwards
  my ($t, $sp) = @_;
  for my $x (sort { $b->[0] <=> $a->[0] } @$sp) { substr($t, $x->[0], $x->[1]) = $x->[2] }
  return $t;
}

# ------------------------------------------------- the "from" prices ----
# gen_fleet.pl's derivation, unchanged: from = min over style+length of
# (hull + cheapest engine); offshore = cheapest hull alone. The four pages that
# show it get ONLY that number replaced - gen_fleet.pl itself is not run because
# it also rewrites the home page's photos (found 2026-10-14).
use constant FROM_PAGES => (['index.html', 'FLEET'], ['which-wooldridge/index.html', 'FACTS'],
                            ['request-a-quote/index.html', 'FACTS'], ['compare/index.html', 'FACTS']);
sub from_prices {
  my ($S) = @_;
  my %f;
  for my $mo (@{ $S->{models_applied} }) {
    my $drive = $mo->{drive} // 'ob'; my $from;
    for my $s (@{ $mo->{styles} }) { for my $len (keys %{ $s->{hulls} }) {
      my $hull = $s->{hulls}{$len}; next unless defined $hull;
      my $cost = $hull;
      if ($drive ne 'offshore') { my ($c) = sort { $a <=> $b } grep { defined } map { $_->{price} } @{ $mo->{engines}{ $s->{id} . $len } || [] }; $cost += ($c // 0) }
      $from = $cost if !defined $from || $cost < $from;
    } }
    die "no from-price derivable for $mo->{id}\n" unless defined $from;
    $f{ $mo->{id} } = $from;
  }
  return \%f;
}
sub from_nodes {                     # (page text, FLEET|FACTS) -> { model id => node of its "from" number }
  my ($t, $var) = @_;
  my @at; while ($t =~ /^[ \t]*const \Q$var\E = /mg) { push @at, $+[0] }
  die "const $var: expected 1, found " . scalar(@at) . "\n" unless @at == 1;
  my ($root) = jparse($t, $at[0]);
  my %n;
  if ($root->{t} eq 'a') { for my $o (@{ $root->{a} }) { my $id = $o->{h}{id} or next; $n{ substr($t, $id->{s} + 1, $id->{e} - $id->{s} - 1) } = $o->{h}{from} } }
  else { $n{ $_->[0] } = $_->[1]{h}{from} for @{ $root->{kv} } }
  return \%n;
}

# ------------------------------------------------- the options guide ----
# option-guide/index.html types a price on each priced line of its cards' sheet:[['line','price'],...]
# lists. Stephen 2026-10-15: "Canon fills them" - those prices come from the workbook. The map
# _build/option_guide_prices.tsv names, for each priced line, the canon OPTIONS item(s) it shows and
# how the price reads: {price} (the one canon price), {min} / {max} (the range across every model and
# length), {both} (the "both sides = $X" figure in the canon item's own name). Problems that STOP the
# canon command: a priced line with no map row, a map row whose line left the page, a canon name that
# no longer exists, {price} where canon holds several prices, a sheet list this parser cannot read.
use constant OPTION_GUIDE     => 'option-guide/index.html';
use constant OPTION_GUIDE_MAP => '_build/option_guide_prices.tsv';
sub _money { my ($v) = @_; my $s = ($v == int $v) ? sprintf('%d', $v) : sprintf('%.2f', $v); 1 while $s =~ s/^(\d+)(\d{3})/$1,$2/; return '$' . $s }
sub option_guide_plan {              # (repo, tabs) -> { text, eol, lines, changes => [{line, have, want}], problems => [msgs] }
  my ($repo, $tabs) = @_;
  my (%P, %map, @problems);
  for my $r (@{ rows_of($tabs->{OPTIONS}, 'OPTIONS') }) { push @{ $P{ $r->{option} } }, $r->{price_usd} }
  my $mt = slurp_text("$repo/" . OPTION_GUIDE_MAP);
  my $ln = 0;
  for my $l (split /\n/, $mt) {
    $ln++;
    next if $l =~ /^\s*(?:#|$)/ || $l =~ /^guide_line\t/;
    my ($g, $names, $shows) = split /\t/, $l, -1;
    unless (defined $shows && length $g && length $names && length $shows) { push @problems, OPTION_GUIDE_MAP . " line $ln: needs three tab-separated columns"; next }
    push @problems, OPTION_GUIDE_MAP . ": '$g' is listed twice" if $map{$g};
    $map{$g} = { names => [ split / \|\| /, $names ], shows => $shows, used => 0 };
  }
  my ($t, $eol) = slurp_text("$repo/" . OPTION_GUIDE);
  my (@sp, @changes); my $lines = 0;
  my $str = qr/'((?:[^'\\]|\\.)*)'/;
  while ($t =~ /sheet:\[/g) {
    my $at = pos($t);
    while ($t =~ /\G\s*\[$str,$str\]\s*,?/gc) {
      my ($g, $have, $vs, $ve) = ($1, $2, $-[2], $+[2]);
      my $m = $map{$g};
      unless ($m) {
        push @problems, "'$g' shows the typed price '$have' but no canon row backs it - add the line to " . OPTION_GUIDE_MAP . ' or drop the price' if $have =~ /\$\s?\d/;
        next;
      }
      $m->{used}++; $lines++;
      my ($err, @p) = ('');
      for my $n (@{ $m->{names} }) { if ($P{$n}) { push @p, grep { defined && /\d/ } @{ $P{$n} } } else { $err .= "canon has no option named '$n'; " } }
      my %u; @p = sort { $a <=> $b } grep { !$u{$_}++ } map { 0 + $_ } @p;
      $err .= 'every mapped canon row is priced on request; ' if !$err && !@p;
      my %v = (@p ? (min => _money($p[0]), max => _money($p[-1])) : ());
      $v{price} = _money($p[0]) if @p == 1;
      if ($m->{shows} =~ /\{both\}/) { my ($b) = map { /both sides = \$([\d,]+)/ ? $1 : () } @{ $m->{names} }; if (defined $b) { $b =~ s/,//g; $v{both} = _money($b) } }
      # a range whose ends meet reads as one price, never "$1,099–$1,099" (2026-10-21: the audit moved both windshields to one price)
      my $shows = $m->{shows}; $shows =~ s/\{min\}\s*\S{1,3}\s*\{max\}/{price}/g if @p == 1;
      (my $want = $shows) =~ s/\{(\w+)\}/defined $v{$1} ? $v{$1} : do { $err .= ($1 eq 'price' && @p > 1) ? 'canon holds ' . scalar(@p) . ' prices for it - show {min}-{max} instead of {price}; ' : "{$1} has no value; "; '' }/ge;
      if ($err) { push @problems, "'$g': $err"; next }
      next if $want eq $have;
      (my $js = $want) =~ s/([\\'])/\\$1/g;
      push @sp, [$vs, $ve - $vs, $js];
      push @changes, { line => $g, have => $have, want => $want };
    }
    push @problems, OPTION_GUIDE . ': a sheet list at character ' . $at . ' is not a plain list of [\'line\',\'price\'] pairs' unless $t =~ /\G\s*\]/gc;
  }
  push @problems, map { OPTION_GUIDE_MAP . ": '$_' is not on the page any more" } grep { !$map{$_}{used} } sort keys %map;
  return { text => apply_splices($t, \@sp), eol => $eol, lines => $lines, changes => \@changes, problems => \@problems };
}

# ---------------------------------------------------------- the mirrors ----
# A tab -> its CSV mirror. Same writer as the spec tabs (tabs_to_csv_text), plus
# the two conventions the pricing mirrors already carry: a BOM when the file has
# one, and CARRY OUT prices written with two decimals (make_carryout.pl's format).
use constant MIRROR_FORMAT => { 'CARRY OUT' => { price_usd => '%.2f' } };
sub mirror_bytes {
  my ($grid, $tab, $old_bytes) = @_;
  my @g = map { [@$_] } @$grid;
  if (my $fmt = MIRROR_FORMAT->{$tab}) {
    my $h = $g[0];
    for my $c (0 .. $#$h) { my $f = $fmt->{ $h->[$c] } or next; for my $r (@g[1 .. $#g]) { $r->[$c] = sprintf($f, $r->[$c]) if defined $r->[$c] && is_num($r->[$c]) } }
  }
  my $text = WBSpecCanon::tabs_to_csv_text(\@g, $tab);
  # line endings: CRLF only when the file is CRLF on every line (CARRY OUT is,
  # as make_carryout.pl writes it); otherwise LF, which also heals a mixed file
  if (defined $old_bytes) { my $lf = ($old_bytes =~ tr/\n//); my $crlf = () = $old_bytes =~ /\r\n/g; $text =~ s/\n/\r\n/g if $lf && $crlf == $lf }
  my $bom = (defined $old_bytes && $old_bytes =~ /^\xEF\xBB\xBF/) ? "\xEF\xBB\xBF" : '';
  return $bom . encode('UTF-8', $text);
}

# ---------------------------------------------- the SOC delivery file ----
# WB CANON SOC.json beside the workbook (agreed with the "CANON - Sales Order
# Creator reads canon" session 2026-10-14; Stephen ruled the Hub server reads it
# there directly). Each blob is the website's own text copied VERBATIM as bytes,
# never re-serialised: const MODELS, the live overlay object exactly as
# sync_soc_rules.pl builds it, and the trailer picker's const DATA.
sub soc_blobs {
  my ($repo) = @_;
  my $cfg = slurp_bytes("$repo/build-and-price/index.html");
  my @m = $cfg =~ /^const MODELS = (\[.*?\]);[ \t]*\r?$/mg; die "SOC blobs: const MODELS found " . scalar(@m) . " times\n" unless @m == 1;
  my @d = $cfg =~ /^const DATA = (\{"Single Axle":.*\});[ \t]*\r?$/mg; die "SOC blobs: const DATA found " . scalar(@d) . " times\n" unless @d == 1;
  my $ov = slurp_bytes("$repo/tools/RULES_OVERLAY.js");
  my (%live, @order);
  while ($ov =~ /^  ([A-Za-z][A-Za-z0-9_]*): (.*),\r?$/mg) { next if $1 eq 'PROPOSED'; push @order, $1 unless exists $live{$1}; $live{$1} = $2 }
  die "SOC blobs: no live keys in the overlay\n" unless @order;
  my $o = '{' . join(',', map { "\"$_\":$live{$_}" } @order) . '}';
  return { models => $m[0], rules_overlay => $o, trailer_data => $d[0] };
}
sub soc_file_bytes {                 # (blobs, meta hash) -> the file's bytes (UTF-8, LF)
  my ($b, $meta) = @_;
  my $J = JSON::PP->new->canonical(1)->ascii(1);
  my @k = qw(models rules_overlay trailer_data);
  my %sha = map { $_ => Digest::SHA::sha256_hex($b->{$_}) } @k;
  my $out = "{\n";
  $out .= "  " . $J->encode($_) . ": " . $J->encode($meta->{$_}) . ",\n" for sort keys %$meta;
  $out .= '  "soc_sha256": ' . $J->encode(\%sha) . ",\n";
  $out .= '  "soc_sha256_basis": ' . $J->encode("sha256 of the blob's UTF-8 bytes exactly as written, copied verbatim from source, not re-serialized") . ",\n";
  $out .= "  \"soc\": {\n" . join(",\n", map { "    \"$_\": $b->{$_}" } @k) . "\n  }\n}\n";
  JSON::PP->new->utf8->decode($out);   # must parse, or nothing is written
  return $out;
}

# -------------------------------------------------- the whole check ----
# verify_pricing(%args) -> list of [surface, PASS|FAIL|WARN|SKIP, detail], plus the compare result.
#   repo, tabs (read_xlsx_tabs with dates), mirrors (folder, optional), soc_file (optional), pipeline (optional)
sub verify_pricing {
  my (%a) = @_;
  my @out; my $row = sub { push @out, [@_] };
  my $S = load_site($a{repo});
  my $C = canon_from_tabs($a{tabs});
  my $R = compare_prices($S, $C);
  for my $tab (qw(BOATS ENGINES OPTIONS TRAILERS)) {
    my $c = $R->{counts}{$tab};
    my @p = grep { $_->{tab} eq $tab } @{ $R->{price} };
    my @o = grep { $_->{tab} eq $tab } @{ $R->{other} };
    $row->("site prices: $tab", (@p || @o) ? 'FAIL' : 'PASS',
      sprintf('%d workbook rows, %d on the site, %d match%s%s', $c->{canon}, $c->{site}, $c->{match},
        (@p ? sprintf(', %d price(s) differ', scalar @p) : ''), (@o ? sprintf(', %d not-wired difference(s)', scalar @o) : '')));
  }
  my $L = $R->{counts}{LINKS};
  $row->('Center Console = windshield twin', @{ $R->{link} } ? 'FAIL' : 'PASS', sprintf('%d of %d twin rows equal their source in the workbook', $L->{linked}, $L->{pairs}));
  $row->('workbook arithmetic', @{ $R->{math} } ? 'FAIL' : 'PASS', @{ $R->{math} } ? scalar(@{ $R->{math} }) . ' cell(s) disagree with their own rows' : 'option units follow their prices; trailer as-stocked = base + standard items; one price per shared QuickBooks item');
  my $F = from_prices($S);
  for my $pg (FROM_PAGES) {
    my ($f, $var) = @$pg;
    my $t = slurp_text("$a{repo}/$f");
    my $n = from_nodes($t, $var);
    my @bad = grep { !$n->{$_} || !numeq($n->{$_}{v}, $F->{$_}) } sort keys %$F;
    $row->("from-prices: $f", @bad ? 'FAIL' : 'PASS', @bad ? 'differ for ' . join(', ', map { "$_ (page " . ($n->{$_} ? $n->{$_}{v} : 'missing') . ", derived $F->{$_})" } @bad) : scalar(keys %$F) . ' models');
  }
  if (-f "$a{repo}/" . OPTION_GUIDE_MAP) {
    my $G = option_guide_plan($a{repo}, $a{tabs});
    my @c = @{ $G->{changes} }; my @p = @{ $G->{problems} };
    $R->{guide} = [ @p, map { "'$_->{line}': page $_->{have}, workbook $_->{want}" } @c ];
    $row->('options guide: ' . OPTION_GUIDE, (@c || @p) ? 'FAIL' : 'PASS',
      @p ? scalar(@p) . ' problem(s) - see OPTIONS GUIDE below' : @c ? scalar(@c) . ' typed price(s) differ from the workbook - see OPTIONS GUIDE below' : "$G->{lines} priced lines match the workbook");
  } else { $row->('options guide: ' . OPTION_GUIDE, 'FAIL', OPTION_GUIDE_MAP . ' is missing') }
  if (defined $a{mirrors}) {
    my @bad;
    for my $t (PRICE_TABS) {
      my $p = "$a{mirrors}/$t.csv";
      my $old = -f $p ? slurp_bytes($p) : undef;
      push @bad, $t unless defined $old && $old eq mirror_bytes($a{tabs}{$t}, $t, $old);
    }
    $row->('CSV mirrors (8 pricing tabs)', @bad ? 'FAIL' : 'PASS', @bad ? 'not in step with the workbook: ' . join(', ', @bad) : 'byte-identical to the workbook');
  }
  if (defined $a{soc_file}) {
    if (!-f $a{soc_file}) { $row->('Sales Order Creator file', 'WARN', 'WB CANON SOC.json not written yet') }
    else {
      my $have = JSON::PP->new->utf8->decode(slurp_bytes($a{soc_file}));
      my $b = soc_blobs($a{repo});
      my @bad = grep { ($have->{soc_sha256}{$_} // '') ne Digest::SHA::sha256_hex($b->{$_}) } qw(models rules_overlay trailer_data);
      $row->('Sales Order Creator file', @bad ? 'FAIL' : 'PASS', @bad ? 'stale: ' . join(', ', @bad) . ' differ from the website' : "matches the website (prices as of $have->{generated_utc})");
    }
  }
  if (defined $a{pipeline} && -f "$a{pipeline}/trailer-addons-blessed.json") {
    my $B = JSON::PP->new->utf8->decode(slurp_bytes("$a{pipeline}/trailer-addons-blessed.json"))->{items};
    my %c = map { $_->{item} => $_ } @{ $C->{ADDONS} };
    my @bad = grep { !$c{ $_->{d} } || !numeq($c{ $_->{d} }{item_retail_usd_markup_baked}, $_->{p}) } @$B;
    push @bad, map { { d => $_ } } grep { my $k = $_; !grep { $_->{d} eq $k } @$B } sort keys %c;
    $row->('trailer shop add-ons (price sheets)', @bad ? 'FAIL' : 'PASS', @bad ? 'differ: ' . join(', ', map { $_->{d} } @bad) : scalar(@$B) . ' add-ons match the SHOP ADD-ON rows');
  }
  return (\@out, $R, $S, $C);
}

# ------------------------------------------------ branded price sheets ----
# A canon change replaces only the price sheets it changed: Tyler's rule after the
# 2026-10-15 Sportster run, adopted by Stephen 2026-10-19 for gen_from_canon.pl step c.
# Every rebuild prints the day's date on all 19 sets (18 boats + the trailer), and each
# html carries the Rockwell font files of the computer that built it (the P3's and
# Tyler's Mac's bytes differ). So a rebuilt set is UNCHANGED when its .html, .docx and
# .idml each equal the library's copy once two things are set aside:
#   - a printed date ("19 October 2026") where the rebuilt file prints this run's date,
#     whatever date the library's copy shows in that place;
#   - the base64 font data inside the html (font/...;base64, data).
# Anything else - a word, a number, an image, any other date, a missing file or zip
# part - is a change. Word and InDesign files are compared part by part, so a zip's own
# timestamps never count, and without the package bookkeeping SharePoint rewrites once a
# Word file syncs: it adds customXml/, [trash]/ and docProps/custom.xml and rewrites
# [Content_Types].xml, the .rels files and docProps/core.xml. Seen on all 19 library Word
# files on 2026-10-19 - the document, headers, footer, styles, logo and docProps/app.xml
# were byte-identical to a fresh build; only those parts differed. The PDF is printed
# from the html and is never compared.
use constant SHEET_FAMILIES => ('OUTBOARDS', 'INBOARDS', 'OFFSHORES');
my $SHEET_DATE = qr/\b(\d{1,2} (?:January|February|March|April|May|June|July|August|September|October|November|December) \d{4})\b/;
my $PACKAGE_PART = qr{^(?:customXml/|\[trash\]/|docProps/custom\.xml$|docProps/core\.xml$|\[Content_Types\]\.xml$|(?:.*/)?_rels/[^/]*\.rels$)};
sub sheet_stamp {                    # (epoch, default now) -> the date as the sheet generators print it ("9 October 2026")
  my $d = POSIX::strftime('%e %B %Y', localtime(defined $_[0] ? $_[0] : time));
  $d =~ s/^\s+//;
  return $d;
}
sub _sheet_mask {                    # bytes -> (bytes with the font data and the dates masked, [the dates in order])
  my ($b) = @_;
  my @d;
  $b =~ s{(font/[A-Za-z0-9.+-]+;base64,)[A-Za-z0-9+/=\\\r\n]+}{$1\x00FONT\x00}g;
  $b =~ s{$SHEET_DATE}{push @d, $1; "\x00DATE\x00"}ge;
  return ($b, \@d);
}
sub _same_but_stamp {                # (library bytes, rebuilt bytes, {stamp => 1}) -> '' when only the stamp differs, else what does
  my ($old, $new, $stamps) = @_;
  return '' if $old eq $new;
  my ($mo, $do) = _sheet_mask($old);
  my ($mn, $dn) = _sheet_mask($new);
  return 'content differs' unless $mo eq $mn;      # equal masks also mean the same number of dates
  for my $i (0 .. $#$dn) {
    next if $dn->[$i] eq $do->[$i] || $stamps->{ $dn->[$i] };
    return "a printed date changed ($do->[$i] -> $dn->[$i])";
  }
  return '';
}
sub _zip_parts {                     # zip bytes -> { part name => bytes }, or undef when it cannot be read part by part
  my ($b) = @_;
  my $z = IO::Uncompress::Unzip->new(\$b, Transparent => 0) or return undef;
  my (%parts, $st);
  for ($st = 1; $st > 0; $st = $z->nextStream) {
    my $name = $z->getHeaderInfo->{Name};
    my ($data, $buf) = ('', '');
    while (($st = $z->read($buf)) > 0) { $data .= $buf }
    last if $st < 0;
    return undef if exists $parts{$name};          # a part name twice: not comparable
    $parts{$name} = $data;
  }
  return $st < 0 ? undef : \%parts;
}
sub sheet_unchanged {                # (library copy, rebuilt copy, {stamp => 1}) -> '' when only the stamp and fonts differ, else why
  my ($old_p, $new_p, $stamps) = @_;
  return 'not in the library' unless -f $old_p;
  return 'not rebuilt' unless -f $new_p;
  my ($old, $new) = (slurp_bytes($old_p), slurp_bytes($new_p));
  return '' if $old eq $new;
  my $is_zip = sub { substr($_[0], 0, 4) eq "PK\x03\x04" };
  return _same_but_stamp($old, $new, $stamps) unless $is_zip->($old) || $is_zip->($new);
  my ($po, $pn) = (_zip_parts($old), _zip_parts($new));
  return 'cannot be read part by part' unless $po && $pn;
  my @o = sort grep { !/$PACKAGE_PART/ } keys %$po;
  my @n = sort grep { !/$PACKAGE_PART/ } keys %$pn;
  return 'its parts differ (' . join(', ', (map { "only in the library: $_" } grep { !exists $pn->{$_} } @o),
                                           (map { "only in the rebuild: $_" } grep { !exists $po->{$_} } @n)) . ')'
    unless join("\0", @o) eq join("\0", @n);
  for my $p (@n) { my $why = _same_but_stamp($po->{$p}, $pn->{$p}, $stamps); return "$p: $why" if length $why }
  return '';
}
# keep_unchanged_sheets(built folder, library PRICE SHEETS tree, [stamps]) -> { changed => [[name, why]], kept => [names] }
# The built folder is gen_from_canon.pl's (<FAMILY>/<NAME>-PRICE SHEET.* plus TRAILER-PRICE SHEET.* at its top); each
# set's library copy sits in <tree>/<FAMILY>/<model folder>/ or <tree>/TRAILERS/. For every unchanged set the library's
# html, pdf, docx and idml are copied over the rebuilt ones, so distribute.pl finds the same bytes already in place and
# moves nothing, and publish_sales_tools.pl finds nothing new for SALES TOOLS. Nothing outside the built folder is written.
sub keep_unchanged_sheets {
  my ($o, $lib, $stamps) = @_;
  my %st = map { $_ => 1 } @$stamps;
  my $dir_list = sub { my ($d) = @_; opendir(my $dh, $d) or return (); my @k = sort grep { !/^\./ } readdir $dh; closedir $dh; return @k };
  my @sets;                          # [name, built folder, library folder or undef, why not found]
  for my $fam (SHEET_FAMILIES) {
    die "rebuilt price sheets: no $fam folder in $o\n" unless -d "$o/$fam";
    my @models = grep { -d "$lib/$fam/$_" } $dir_list->("$lib/$fam");
    for my $h (grep { /-PRICE SHEET\.html$/ } $dir_list->("$o/$fam")) {
      (my $name = $h) =~ s/-PRICE SHEET\.html$//;
      my @at = grep { -f "$lib/$fam/$_/$h" } @models;
      push @sets, [$name, "$o/$fam", (@at == 1 ? ("$lib/$fam/$at[0]", '') : (undef, @at ? 'in ' . scalar(@at) . " $fam folders" : 'not in the library'))];
    }
  }
  die "rebuilt price sheets: no TRAILER-PRICE SHEET.html in $o\n" unless -f "$o/TRAILER-PRICE SHEET.html";
  push @sets, ['TRAILER', $o, (-f "$lib/TRAILERS/TRAILER-PRICE SHEET.html" ? ("$lib/TRAILERS", '') : (undef, 'not in the library'))];
  my (@changed, @kept);
  for my $s (@sets) {
    my ($name, $bdir, $ldir, $why) = @$s;
    my $base = "$name-PRICE SHEET";
    unless (defined $ldir) { push @changed, [$name, $why]; next }
    if (my @gone = grep { !-f "$ldir/$base.$_" } qw(html pdf docx idml)) { push @changed, [$name, 'the library copy has no .' . join(', .', @gone)]; next }
    if (my @gone = grep { !-f "$bdir/$base.$_" } qw(html pdf docx idml)) { die "rebuilt price sheets: $name has no .$gone[0] in $bdir\n" }
    for my $ext (qw(html docx idml)) {
      my $w = sheet_unchanged("$ldir/$base.$ext", "$bdir/$base.$ext", \%st);
      if (length $w) { $why = ".$ext: $w"; last }
    }
    if (length $why) { push @changed, [$name, $why]; next }
    for my $ext (qw(html pdf docx idml)) {
      my $bytes = slurp_bytes("$ldir/$base.$ext");
      open my $fh, '>:raw', "$bdir/$base.$ext" or die "cannot write $bdir/$base.$ext: $!\n";
      print $fh $bytes; close $fh or die "cannot close $bdir/$base.$ext: $!\n";
      die "rebuilt price sheets: $bdir/$base.$ext did not take the library's bytes\n" unless slurp_bytes("$bdir/$base.$ext") eq $bytes;
    }
    push @kept, $name;
  }
  return { changed => \@changed, kept => \@kept };
}

1;
