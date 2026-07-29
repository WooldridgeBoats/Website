#!/usr/bin/perl
# mkdocx.pl — build a .docx directly from a simple text markup.
#
# Word COM proved pathologically slow for table-heavy documents (150s+ of CPU
# without finishing), so this writes the OOXML package itself. Deterministic
# and instant.
#
# Input markup, one directive per line:
#   T|title            H|heading          P|paragraph
#   B|bullet           R|cell|cell|cell   (table row; first R of a run = header)
#   X|                 (blank line / end table)
use strict; use warnings;
use IO::Compress::Zip qw(zip ZIP_CM_DEFLATE);

my ($src, $out) = @ARGV;
die "usage: mkdocx.pl <markup> <out.docx>\n" unless $out;

open my $in, '<:encoding(UTF-8)', $src or die $!;
my @lines = <$in>;
close $in;

sub esc {
  my $s = shift // '';
  $s =~ s/&/&amp;/g; $s =~ s/</&lt;/g; $s =~ s/>/&gt;/g;
  return $s;
}
# bold **like this**
sub runs {
  my $s = shift // '';
  my @out;
  for my $part (split /(\*\*[^*]+\*\*)/, $s) {
    next unless length $part;
    if ($part =~ /^\*\*(.+)\*\*$/s) {
      push @out, '<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">' . esc($1) . '</w:t></w:r>';
    } else {
      push @out, '<w:r><w:t xml:space="preserve">' . esc($part) . '</w:t></w:r>';
    }
  }
  return join('', @out) || '<w:r><w:t/></w:r>';
}
sub para { my ($style, $text) = @_;
  my $pPr = $style ? qq{<w:pPr><w:pStyle w:val="$style"/></w:pPr>} : '';
  return "<w:p>$pPr" . runs($text) . "</w:p>";
}

my $body = '';
my @tbl;            # buffered table rows
sub flush_table {
  return unless @tbl;
  my $cols = scalar @{$tbl[0]};
  my $w = int(9360 / $cols);
  my $t = '<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="5000" w:type="pct"/>'
        . '<w:tblBorders>'
        . join('', map { qq{<w:$_ w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/>} }
                   qw(top left bottom right insideH insideV))
        . '</w:tblBorders></w:tblPr>';
  $t .= '<w:tblGrid>' . ('<w:gridCol w:w="' . $w . '"/>' x $cols) . '</w:tblGrid>';
  for my $i (0 .. $#tbl) {
    my $hdr = ($i == 0);
    $t .= '<w:tr>';
    $t .= '<w:trPr><w:tblHeader/></w:trPr>' if $hdr;
    for my $c (@{$tbl[$i]}) {
      my $shd = $hdr ? '<w:shd w:val="clear" w:fill="EFEFEF"/>' : '';
      my $txt = $hdr ? "**$c**" : $c;
      $t .= qq{<w:tc><w:tcPr><w:tcW w:w="$w" w:type="dxa"/>$shd</w:tcPr>}
          . '<w:p><w:pPr><w:spacing w:before="30" w:after="30"/></w:pPr>' . runs($txt) . '</w:p></w:tc>';
    }
    $t .= '</w:tr>';
  }
  $t .= '</w:tbl><w:p/>';
  $body .= $t;
  @tbl = ();
}

for my $line (@lines) {
  chomp $line;
  next if $line =~ /^\s*#/;
  my ($kind, $rest) = split /\|/, $line, 2;
  $kind //= ''; $rest //= '';
  if    ($kind eq 'R') { push @tbl, [ split /\|/, $rest, -1 ] }
  else {
    flush_table();
    if    ($kind eq 'T') { $body .= para('Title',   $rest) }
    elsif ($kind eq 'H') { $body .= para('Heading1',$rest) }
    elsif ($kind eq 'H2'){ $body .= para('Heading2',$rest) }
    elsif ($kind eq 'B') { $body .= para('ListParagraph', "\x{2022}  $rest") }
    elsif ($kind eq 'P') { $body .= para('', $rest) }
    elsif ($kind eq 'X') { $body .= '<w:p/>' }
  }
}
flush_table();

my $doc = <<"XML";
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>$body
<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1120" w:right="1180" w:bottom="1120" w:left="1180"/></w:sectPr>
</w:body></w:document>
XML

my $styles = <<'XML';
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="21"/></w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:spacing w:after="140" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/>
  <w:pPr><w:spacing w:after="200"/></w:pPr><w:rPr><w:b/><w:sz w:val="52"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/>
  <w:pPr><w:keepNext/><w:spacing w:before="320" w:after="120"/><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="2" w:color="2F5496"/></w:pBdr></w:pPr>
  <w:rPr><w:b/><w:color w:val="2F5496"/><w:sz w:val="30"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/>
  <w:pPr><w:keepNext/><w:spacing w:before="240" w:after="100"/></w:pPr><w:rPr><w:b/><w:sz w:val="25"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/>
  <w:pPr><w:ind w:left="360"/><w:spacing w:after="80"/></w:pPr></w:style>
<w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/>
  <w:tblPr><w:tblCellMar><w:top w:w="70" w:type="dxa"/><w:left w:w="90" w:type="dxa"/><w:bottom w:w="70" w:type="dxa"/><w:right w:w="90" w:type="dxa"/></w:tblCellMar></w:tblPr>
  <w:rPr><w:sz w:val="19"/></w:rPr></w:style>
</w:styles>
XML

my $ct = <<'XML';
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>
XML

my $rels = <<'XML';
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>
XML

my $drels = <<'XML';
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>
XML

my %parts = (
  '[Content_Types].xml'   => $ct,
  '_rels/.rels'           => $rels,
  'word/document.xml'     => $doc,
  'word/styles.xml'       => $styles,
  'word/_rels/document.xml.rels' => $drels,
);
my @names = ('[Content_Types].xml','_rels/.rels','word/document.xml','word/styles.xml','word/_rels/document.xml.rels');
unlink $out;
my $z;
for my $i (0 .. $#names) {
  my $n = $names[$i];
  my $b = $parts{$n};
  utf8::encode($b) if utf8::is_utf8($b);
  if ($i == 0) {
    $z = IO::Compress::Zip->new($out, Name => $n, Method => ZIP_CM_DEFLATE)
      or die "zip init failed: $IO::Compress::Zip::ZipError\n";
  } else {
    $z->newStream(Name => $n, Method => ZIP_CM_DEFLATE)
      or die "newStream failed: $IO::Compress::Zip::ZipError\n";
  }
  $z->print($b);
}
$z->close or die "zip close failed\n";
printf "wrote %s (%d bytes)\n", $out, -s $out;
