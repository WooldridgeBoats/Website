<?php
/* ===================================================================
   wb-smtp.php - minimal authenticated SMTP client (STARTTLS)
   ===================================================================
   Written 3 Aug 2026 for forms/submit.php. Read the comment block at
   the top of submit.php first - it explains WHY the site no longer
   uses PHP mail() at all.

   Scope on purpose: one connection, AUTH LOGIN, one or more messages,
   QUIT. No pooling, no queueing, no retries, no OAuth2. Everything it
   cannot do it throws about, loudly, with the server's own reply text -
   silence was the whole problem this replaces.

   WHY NOT PHPMailer: nothing on the box can install it (no composer,
   no PEAR, no network-fetch authority at build time), so it would have
   had to be pasted in by hand and reviewed by hand - a bigger unverified
   surface than the ~120 lines here. If PHPMailer is ever vendored
   properly, swapping it in is contained: submit.php touches this file
   through exactly three calls (new WBSmtp, ->connect, ->send).

   TLS: STARTTLS on 587, certificate verification LEFT ON (the default).
   Do not add 'verify_peer' => false to shut up a handshake error - that
   turns an authenticated channel back into a spoofable one, which is the
   exact class of problem this file exists to fix.
   =================================================================== */

class WBSmtpError extends Exception {}

class WBSmtp {

  public $host;
  public $port;
  public $user;
  public $pass;
  public $ehlo;
  public $timeout;
  public $sock;
  public $trace;    /* command/reply trace WITHOUT credentials - safe to log */

  function __construct($cfg){
    $this->host    = isset($cfg['host']) ? $cfg['host'] : 'smtp.office365.com';
    $this->port    = isset($cfg['port']) ? (int)$cfg['port'] : 587;
    $this->user    = isset($cfg['user']) ? $cfg['user'] : '';
    $this->pass    = isset($cfg['pass']) ? $cfg['pass'] : '';
    $this->ehlo    = (isset($cfg['ehlo']) && $cfg['ehlo'] !== '') ? $cfg['ehlo'] : 'wooldridgeboats.com';
    $this->timeout = isset($cfg['timeout']) ? (int)$cfg['timeout'] : 20;
    $this->sock    = null;
    $this->trace   = array();
  }

  /* ---- connection ------------------------------------------------ */

  function connect(){
    if ($this->user === '' || $this->pass === '') {
      throw new WBSmtpError('SMTP username or password is empty - credential file not loaded');
    }

    $errno = 0; $errstr = '';
    $ctx = stream_context_create(array('ssl' => array(
      'SNI_enabled' => true,
      'peer_name'   => $this->host,
    )));
    $this->sock = @stream_socket_client(
      'tcp://' . $this->host . ':' . $this->port,
      $errno, $errstr, $this->timeout, STREAM_CLIENT_CONNECT, $ctx
    );
    if (!$this->sock) {
      throw new WBSmtpError('cannot open ' . $this->host . ':' . $this->port
        . ' - ' . ($errstr !== '' ? $errstr : 'error ' . $errno)
        . ' (outbound 587 may be blocked by the host)');
    }
    stream_set_timeout($this->sock, $this->timeout);

    $this->expect(array(220), 'greeting');
    $this->cmd('EHLO ' . $this->ehlo, array(250));
    $this->cmd('STARTTLS', array(220));

    $crypto = STREAM_CRYPTO_METHOD_TLS_CLIENT;
    if (defined('STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT')) $crypto = $crypto | STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT;
    if (defined('STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT')) $crypto = $crypto | STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT;
    if (!@stream_socket_enable_crypto($this->sock, true, $crypto)) {
      throw new WBSmtpError('STARTTLS handshake failed (TLS version or certificate trust)');
    }
    $this->trace[] = '>>> [TLS established]';

    /* EHLO again - capabilities before TLS are not the real ones, and
       O365 does not advertise AUTH until the channel is encrypted */
    $this->cmd('EHLO ' . $this->ehlo, array(250));

    $this->cmd('AUTH LOGIN', array(334));
    $this->cmd(base64_encode($this->user), array(334), '[username]');
    $this->cmd(base64_encode($this->pass), array(235), '[password]');
  }

  function quit(){
    if (!$this->sock) return;
    /* best effort - a failed QUIT after a delivered message is not a failure */
    @fwrite($this->sock, "QUIT\r\n");
    @fclose($this->sock);
    $this->sock = null;
  }

  /* ---- sending --------------------------------------------------- */

  /* $envFrom      bare address, must be the authenticated mailbox (or a SendAs of it)
     $recipients   array of bare addresses - MUST include every Cc/Bcc, the
                   envelope is what actually routes; header Cc is only display
     $message      full RFC 5322 message, headers + blank line + body */
  function send($envFrom, $recipients, $message){
    if (!$this->sock) throw new WBSmtpError('send() called before connect()');
    if (!is_array($recipients) || count($recipients) === 0) {
      throw new WBSmtpError('no envelope recipients');
    }

    $this->cmd('MAIL FROM:<' . $envFrom . '>', array(250));
    $accepted = 0;
    foreach ($recipients as $rcpt) {
      /* one bad Cc must not lose the whole submission - record and carry on,
         as long as at least one recipient takes it */
      try {
        $this->cmd('RCPT TO:<' . $rcpt . '>', array(250, 251));
        $accepted++;
      } catch (WBSmtpError $e) {
        $this->trace[] = '!!! RCPT rejected: ' . $rcpt . ' - ' . $e->getMessage();
      }
    }
    if ($accepted === 0) throw new WBSmtpError('every recipient was rejected');

    $this->cmd('DATA', array(354));

    /* Both rewrites are guarded by a cheap test first. A resume plus photos
       can be ~11 MB of base64 here and an unconditional preg_replace would
       copy the whole thing twice for nothing. */
    $data = $message;
    if (preg_match('/(?<!\r)\n/', $data)) {
      $data = preg_replace('/(?<!\r)\n/', "\r\n", $data);     /* bare LF -> CRLF */
    }
    if (strpos($data, "\n.") !== false || substr($data, 0, 1) === '.') {
      $data = preg_replace('/^\./m', '..', $data);            /* dot-stuffing (RFC 5321 4.5.2) */
    }
    @fwrite($this->sock, $data . "\r\n.\r\n");
    $this->expect(array(250), 'end of DATA');
    return true;
  }

  /* ---- protocol plumbing ----------------------------------------- */

  function cmd($line, $okCodes, $traceAs = null){
    if (!$this->sock) throw new WBSmtpError('not connected');
    $this->trace[] = '>>> ' . ($traceAs !== null ? $traceAs : $line);
    if (@fwrite($this->sock, $line . "\r\n") === false) {
      throw new WBSmtpError('write failed sending ' . ($traceAs !== null ? $traceAs : $line));
    }
    return $this->expect($okCodes, ($traceAs !== null ? $traceAs : $line));
  }

  function expect($okCodes, $what){
    $reply = $this->readReply();
    $code  = (int)substr($reply, 0, 3);
    $this->trace[] = '<<< ' . trim($reply);
    if (!in_array($code, $okCodes, true)) {
      throw new WBSmtpError('server said "' . trim($reply) . '" after ' . $what);
    }
    return $reply;
  }

  function readReply(){
    $out = '';
    while (true) {
      $line = @fgets($this->sock, 8192);
      if ($line === false || $line === '') {
        $meta = stream_get_meta_data($this->sock);
        throw new WBSmtpError(!empty($meta['timed_out'])
          ? 'timed out waiting for the server'
          : 'server closed the connection');
      }
      $out .= $line;
      /* A continuation line is "250-text". ANYTHING else ends the reply —
         test for the hyphen, not for a space, or a terse "250\r\n" from a
         server that omits the text spins this loop forever. */
      if (strlen($line) < 4) break;
      if (substr($line, 3, 1) !== '-') break;
    }
    return $out;
  }
}

/* ---- helpers used by submit.php ---------------------------------- */

/* RFC 2047 for header values that may hold non-ASCII. Our subjects carry
   real em dashes; unencoded they arrive as mojibake or trip spam filters. */
function wb_hdr($value){
  $value = preg_replace('/[\r\n]+/', ' ', (string)$value);
  if (preg_match('/[^\x20-\x7E]/', $value)) {
    return '=?UTF-8?B?' . base64_encode($value) . '?=';
  }
  return $value;
}

/* "Display Name <addr@host>" with the name encoded and the address left bare.
   A plain ASCII name still has to be QUOTED if it carries an RFC 5322 special
   — "Smith, John" unquoted reads as two addresses and breaks Reply-To. */
function wb_addr($addr, $name = ''){
  $addr = preg_replace('/[\r\n]+/', '', (string)$addr);
  if ($name === '' || $name === null) return $addr;
  $enc = wb_hdr($name);
  if ($enc === $name && preg_match('/[()<>@,;:\\\\".\[\]]/', $name)) {
    $enc = '"' . str_replace(array('\\', '"'), array('\\\\', '\\"'), $name) . '"';
  }
  return $enc . ' <' . $addr . '>';
}

/* split a header-style list ("a@x, b@y") into bare envelope addresses */
function wb_addr_list($s){
  $out = array();
  foreach (preg_split('/[,;]+/', (string)$s) as $part) {
    $part = trim($part);
    if ($part === '') continue;
    if (preg_match('/<([^>]+)>/', $part, $m)) $part = trim($m[1]);
    if (filter_var($part, FILTER_VALIDATE_EMAIL)) $out[] = $part;
  }
  return $out;
}
