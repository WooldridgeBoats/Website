#!/usr/bin/perl
# Minimal static file server (core modules only) for previewing the site.
use strict; use warnings;
use IO::Socket::INET;

my $root = $ARGV[0] or die "usage: serve.pl <root> [port]\n";
my $port = $ARGV[1] || 8410;
my %MIME = (html=>'text/html; charset=utf-8', css=>'text/css', js=>'application/javascript',
            jpg=>'image/jpeg', jpeg=>'image/jpeg', png=>'image/png', gif=>'image/gif',
            svg=>'image/svg+xml', json=>'application/json', ico=>'image/x-icon',
            woff=>'font/woff', woff2=>'font/woff2', pdf=>'application/pdf');

sub handle {
  my ($c) = @_;
  binmode $c;
  my $req = <$c> // '';
  while (defined(my $l = <$c>)) { last if $l =~ /^\r?\n$/; }   # drain headers
  my ($path) = $req =~ m{^GET\s+([^\s\?#]+)};
  unless ($path) { close $c; return }
  $path =~ s/%([0-9A-Fa-f]{2})/chr hex $1/ge;
  if ($path =~ /\.\./) {
    print $c "HTTP/1.0 404 Not Found\r\nContent-Type: text/plain\r\n\r\nnot found: $path";
    close $c; return;
  }
  # mirror the .htaccess redirects against the RAW requested path, before any
  # "/" -> "index.html" completion below (otherwise our own completion looks
  # like an explicit ".html" request and gets redirected right back)
  if ($path =~ m{^(.*/)index\.html$}) {
    print $c "HTTP/1.0 301 Moved Permanently\r\nLocation: $1\r\nContent-Length: 0\r\n\r\n";
    close $c; return;
  }
  if ($path =~ m{^(.*)\.html$}) {
    print $c "HTTP/1.0 301 Moved Permanently\r\nLocation: $1\r\nContent-Length: 0\r\n\r\n";
    close $c; return;
  }
  my $lookup = $path;
  $lookup .= 'index.html' if $lookup =~ m{/$};
  my $file = "$root$lookup";
  # mirror the .htaccess "page" -> "page.html" internal rewrite (clean URL serving)
  if (!-f $file and !-d $file and -f "$file.html") {
    $file .= '.html';
  }
  unless (-f $file) {
    print $c "HTTP/1.0 404 Not Found\r\nContent-Type: text/plain\r\n\r\nnot found: $path";
    close $c; return;
  }
  my ($ext) = $file =~ /\.(\w+)$/;
  my $mime = $MIME{lc($ext // '')} || 'application/octet-stream';
  open my $f, '<:raw', $file or do { print $c "HTTP/1.0 500 Err\r\n\r\n"; close $c; return };
  my $body = do { local $/; <$f> }; close $f;
  print $c "HTTP/1.0 200 OK\r\nContent-Type: $mime\r\nContent-Length: " .
           length($body) . "\r\nCache-Control: no-store\r\n\r\n" . $body;
  close $c;
}

my $srv = IO::Socket::INET->new(LocalAddr=>'127.0.0.1', LocalPort=>$port,
                                Listen=>64, Reuse=>1) or die "bind: $!";
$| = 1;
print "serving $root on http://127.0.0.1:$port\n";

while (my $c = $srv->accept) {
  my $pid = fork;
  if (!defined $pid) { handle($c); }           # fork failed: serve inline
  elsif ($pid == 0) { handle($c); exit 0; }    # child
  else { close $c; }                           # parent keeps accepting
}
