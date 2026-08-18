<?php
/* ===================================================================
   wb-graph.php - Microsoft Graph sendMail over HTTPS (client credentials)
   ===================================================================
   Written 18 Aug 2026, the day GoDaddy confirmed IN WRITING that
   outbound SMTP (ports 25, 465 AND 587) is permanently blocked on this
   shared hosting plan. wb-smtp.php is correct code this host can never
   use: every send died as a connect-timeout before one SMTP byte moved.
   Outbound 443 works (the cPanel git deploy pulls GitHub over it), so
   mail now rides HTTPS: an OAuth2 client-credentials token from
   Microsoft Entra, then Graph sendMail as the same dedicated website@
   mailbox. Read the comment block at the top of forms/submit.php first
   - it documents the transport history and the .mailsecret.php contract
   that selects between this file and wb-smtp.php.

   Scope on purpose, same philosophy as wb-smtp.php: one token, one or
   two messages, no caching, no retries, no queueing, no external deps.
   Everything it cannot do it throws about, loudly, with the server's
   own reply text - silence was the whole problem the 3 Aug rebuild
   replaced.

   THE TWO ROUND TRIPS:
     1. POST https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token
        form-encoded grant_type=client_credentials,
        scope=https://graph.microsoft.com/.default, client_id,
        client_secret
        -> { "access_token": ... } or { "error", "error_description" }
     2. POST https://graph.microsoft.com/v1.0/users/{from}/sendMail
        JSON { "message": {...}, "saveToSentItems": true }
        -> HTTP 202 with an empty body on success; anything else is a
           refusal carrying { "error": { "code", "message" } }.
   saveToSentItems is deliberate: website@'s Sent Items folder becomes
   the by-effect ledger of everything that actually left the building.

   The token is held on the instance for THIS request only (the auto-
   response reuses it, exactly as the SMTP path reused its open
   connection). It is never written to disk and never shared between
   requests - a form submission is two or three calls, not a workload
   worth a cache, and a cached token on shared hosting is one more
   secret at rest.

   ERROR TEXT IS EVIDENCE. AAD and Graph name their refusals precisely,
   so this file quotes them verbatim into the exception (and thus the
   log). The ones that matter, and who owns each:
     HTTP 401 invalid_client / AADSTS7000215  the client secret is wrong
         or expired -> Richard re-issues, Stephen re-pastes the file
     HTTP 401 AADSTS700016 (app not found)    client_id is wrong or the
         registration was deleted -> Richard
     HTTP 403 ErrorAccessDenied               Mail.Send application
         permission missing admin consent, or an application access
         policy excludes website@ -> Richard
     HTTP 404 on sendMail                     the 'from' mailbox does
         not exist as a user -> check 'from' in .mailsecret.php
     HTTP 429                                 throttled; a later retry
         BY A HUMAN is fine, this code does not retry
   Never trim these strings out of the log line - the code is the
   evidence that names the owner.

   TRANSPORT: curl when the extension exists (standard on cPanel PHP),
   else an https:// stream context. TLS certificate verification is ON
   in both paths. Do not add CURLOPT_SSL_VERIFYPEER=false or
   'verify_peer' => false to shut up a handshake error - an unverified
   channel carrying an OAuth client secret is strictly worse than the
   spoofable channel this file exists to replace. If the handshake
   fails, the host's CA bundle is the thing to fix.

   THE 4 MB CEILING: Graph rejects any single REST request over ~4 MB,
   and sendMail attachments ride base64 inside the JSON (x1.37). The
   site's 8 MB attachment budget therefore cannot always fit - roughly
   2.8 MB of raw files is the practical per-message limit. send()
   pre-checks the encoded payload and throws BEFORE burning a token
   round trip, so an oversized careers resume fails loudly into the
   page's fallback copy instead of vanishing. (The upload-session API
   that lifts the ceiling is a draft-plus-chunks state machine -
   deliberately out of scope for a form handler; the failure is honest
   and the visitor is handed the mailto path by the page.)
   =================================================================== */

class WBGraphError extends Exception {}

class WBGraph {

  public $tenant;
  public $clientId;
  public $clientSecret;
  public $timeout;
  public $trace;    /* request/reply trace WITHOUT secrets - safe to log */
  public $token;    /* this request only - see the header comment */

  function __construct($cfg){
    $this->tenant       = isset($cfg['tenant_id'])     ? trim((string)$cfg['tenant_id'])     : '';
    $this->clientId     = isset($cfg['client_id'])     ? trim((string)$cfg['client_id'])     : '';
    $this->clientSecret = isset($cfg['client_secret']) ? trim((string)$cfg['client_secret']) : '';
    $this->timeout      = isset($cfg['timeout']) ? (int)$cfg['timeout'] : 15;
    $this->trace        = array();
    $this->token        = null;
  }

  /* ---- the token -------------------------------------------------- */

  function fetchToken(){
    if ($this->tenant === '' || $this->clientId === '' || $this->clientSecret === ''){
      throw new WBGraphError("'tenant_id', 'client_id' or 'client_secret' is empty - credential file not loaded");
    }
    $url  = 'https://login.microsoftonline.com/' . rawurlencode($this->tenant) . '/oauth2/v2.0/token';
    $body = http_build_query(array(
      'grant_type'    => 'client_credentials',
      'scope'         => 'https://graph.microsoft.com/.default',
      'client_id'     => $this->clientId,
      'client_secret' => $this->clientSecret,
    ), '', '&');
    $this->trace[] = '>>> POST token (tenant ' . $this->tenant . ', client ' . $this->clientId . ')';
    $r = $this->httpPost($url, array('Content-Type: application/x-www-form-urlencoded'), $body);
    $j = json_decode($r['body'], true);
    if ($r['status'] === 200 && is_array($j) && !empty($j['access_token'])){
      $this->trace[] = '<<< HTTP 200 token issued'
        . (isset($j['expires_in']) ? ' (expires_in ' . (int)$j['expires_in'] . 's)' : '');
      $this->token = $j['access_token'];
      return $this->token;
    }
    /* the AAD error/error_description strings ride into the exception
       verbatim - they are the diagnosis (see the header comment) */
    throw new WBGraphError('token request refused - ' . $this->describeError($r, $j));
  }

  /* ---- sending ----------------------------------------------------- */

  /* $from     the sending mailbox (website@...) - it is the URL, and the
               token must belong to an app allowed to send as it
     $message  a Graph message array (subject, body, toRecipients,
               ccRecipients, replyTo, from, attachments, ...). Built by
               the callers; wb_graph_rcpt() below shapes recipient lists.
               This wraps it with saveToSentItems=true and posts it. */
  function send($from, $message){
    $payload = json_encode(array('message' => $message, 'saveToSentItems' => true));
    if ($payload === false){
      /* json_encode refuses malformed UTF-8 outright. One repair pass
         (strip the bad bytes), then honesty - never send mangled data
         silently without saying so in the trace. */
      $message = $this->utf8Scrub($message);
      $payload = json_encode(array('message' => $message, 'saveToSentItems' => true));
      if ($payload === false){
        throw new WBGraphError('message could not be JSON-encoded (malformed UTF-8 survived the scrub)');
      }
      $this->trace[] = '!!! malformed UTF-8 scrubbed from the message before encoding';
    }
    /* fail BEFORE the token round trip, and say the real number - see
       THE 4 MB CEILING in the header comment */
    if (strlen($payload) > 4000000){
      throw new WBGraphError('message JSON is ' . strlen($payload)
        . " bytes - over Graph's 4 MB sendMail ceiling (base64 attachments inflate x1.37; see wb-graph.php header)");
    }
    if ($this->token === null) $this->fetchToken();

    $url = 'https://graph.microsoft.com/v1.0/users/' . rawurlencode($from) . '/sendMail';
    $nTo = isset($message['toRecipients']) ? count($message['toRecipients']) : 0;
    $nCc = isset($message['ccRecipients']) ? count($message['ccRecipients']) : 0;
    $nAt = isset($message['attachments'])  ? count($message['attachments'])  : 0;
    $this->trace[] = '>>> POST sendMail as ' . $from . ' (' . $nTo . ' to, ' . $nCc . ' cc, '
      . $nAt . ' attachment' . ($nAt === 1 ? '' : 's') . ', ' . strlen($payload) . ' bytes)';
    $r = $this->httpPost($url, array(
      'Authorization: Bearer ' . $this->token,
      'Content-Type: application/json',
    ), $payload);
    if ($r['status'] === 202){
      $this->trace[] = '<<< HTTP 202 accepted';
      return true;
    }
    throw new WBGraphError('sendMail refused - ' . $this->describeError($r, json_decode($r['body'], true)));
  }

  /* ---- error shaping ----------------------------------------------- */

  /* AAD errors are { error, error_description }; Graph errors are
     { error: { code, message } }. Quote whichever shape came back,
     verbatim - the code text is the evidence that names the owner. */
  function describeError($r, $j){
    $bits = 'HTTP ' . $r['status'];
    if (is_array($j) && isset($j['error']) && is_string($j['error'])){
      $bits .= ' ' . $j['error'];
      if (isset($j['error_description'])) $bits .= ': "' . $j['error_description'] . '"';
    } else if (is_array($j) && isset($j['error']) && is_array($j['error'])){
      $code = isset($j['error']['code']) ? $j['error']['code'] : '?';
      $msg  = isset($j['error']['message']) ? $j['error']['message'] : '';
      $bits .= ' ' . $code . ': "' . $msg . '"';
    } else {
      $raw = trim((string)$r['body']);
      if (strlen($raw) > 300) $raw = substr($raw, 0, 300) . '...';
      $bits .= ($raw !== '' ? ' non-JSON reply: "' . $raw . '"' : ' (empty reply)');
    }
    return $bits;
  }

  /* strip malformed UTF-8 from every string leaf; arrays recurse */
  function utf8Scrub($v){
    if (is_array($v)){
      $out = array();
      foreach ($v as $k => $item) $out[$k] = $this->utf8Scrub($item);
      return $out;
    }
    if (is_string($v) && function_exists('iconv')){
      $s = @iconv('UTF-8', 'UTF-8//IGNORE', $v);
      if (is_string($s)) return $s;
    }
    return $v;
  }

  /* ---- HTTPS plumbing ---------------------------------------------- */

  /* Returns array('status' => int, 'body' => string). Throws only when
     no reply came back at all (DNS, connect, TLS, timeout) - an HTTP
     error status is a REPLY, and the callers want its JSON. */
  function httpPost($url, $headers, $body){
    if (function_exists('curl_init')) return $this->httpPostCurl($url, $headers, $body);
    return $this->httpPostStream($url, $headers, $body);
  }

  function httpPostCurl($url, $headers, $body){
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, $this->timeout);
    curl_setopt($ch, CURLOPT_TIMEOUT, $this->timeout);
    /* explicit so nobody has to wonder - see TRANSPORT in the header */
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
    $out = curl_exec($ch);
    if ($out === false){
      $err = curl_error($ch); $no = curl_errno($ch);
      curl_close($ch);
      throw new WBGraphError('curl could not reach ' . $url . ' - '
        . ($err !== '' ? $err : 'errno ' . $no)
        . ' (outbound 443 was proven open 18 Aug 2026; if this persists something changed host-side)');
    }
    $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return array('status' => $status, 'body' => (string)$out);
  }

  function httpPostStream($url, $headers, $body){
    $hdr = implode("\r\n", $headers) . "\r\n"
         . 'Content-Length: ' . strlen($body) . "\r\n"
         . "Connection: close\r\n";
    /* protocol_version stays at PHP's 1.0 default on purpose: old PHP
       stream wrappers hand back chunked 1.1 bodies un-dechunked, and
       both endpoints answer 1.0 cleanly. */
    $ctx = stream_context_create(array(
      'http' => array(
        'method'        => 'POST',
        'header'        => $hdr,
        'content'       => $body,
        'timeout'       => $this->timeout,
        'ignore_errors' => true,   /* a 401 body is an answer, not a PHP warning */
      ),
      'ssl' => array(
        'verify_peer'      => true,
        'verify_peer_name' => true,
        'SNI_enabled'      => true,
      ),
    ));
    $out = @file_get_contents($url, false, $ctx);
    if ($out === false){
      throw new WBGraphError('stream could not reach ' . $url
        . ' - no reply within ' . $this->timeout . 's (DNS, TLS trust, or outbound 443 newly blocked)');
    }
    $status = 0;
    if (isset($http_response_header) && is_array($http_response_header)){
      /* redirect hops append extra blocks; the LAST status line wins */
      foreach ($http_response_header as $line){
        if (preg_match('#^HTTP/\S+\s+(\d{3})#', $line, $m)) $status = (int)$m[1];
      }
    }
    return array('status' => $status, 'body' => (string)$out);
  }
}

/* ---- helpers used by the handlers ---------------------------------- */

/* bare addresses (wb_addr_list output) -> Graph recipient objects */
function wb_graph_rcpt($addrs){
  $out = array();
  foreach ((array)$addrs as $a){
    $out[] = array('emailAddress' => array('address' => $a));
  }
  return $out;
}
