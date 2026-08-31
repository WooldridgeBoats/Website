<?php
/* =====================================================================
   FORM-02 - "Sell Your Boat" intake handler  (posted by /sell-your-boat/)
   =====================================================================
   PRIORITY ONE IS NEVER LOSING A SUBMISSION. The order of operations is
   the design:

     1. the raw request body is archived to disk, byte for byte, BEFORE
        any mail work is attempted;
     2. then the submission is emailed to the shop, and only after that
        send is proven good, a copy goes back to the seller;
     3. HTTP 200 goes back ONLY if at least one of the two durable paths
        in 1 and 2 - the archive, or the email to the SHOP - genuinely
        succeeded. The seller's copy is not one of them and never votes
        here. Anything else is a 5xx, which makes the page's own
        copy-and-email fallback take over on the visitor's screen. No
        path in this file claims success it did not verify.

   There are NO fixed numeric caps in this file - no field is truncated,
   however long the seller writes. (The only bounded string is the boat
   label inside the archive FILENAME, so a pathological value cannot
   make the filesystem reject the write - the data itself is stored in
   full inside the file.)

   Recipients (Stephen, 26 Aug 2026): carrie@ (To), rachel@ (Cc). data@
   is deliberately absent - used-boat listings are not wanted in the Hub.
   Change them in $ROUTE below - nothing else needs editing.

   THE SELLER'S OWN COPY (Stephen, 31 Aug 2026: "i DO want the customer
   to receive their own copy of anything that gets submitted through the
   website, including their 'pre-owned boat' listing inquiry"). This was
   the one form still sending the submitter nothing. It is the same
   pattern forms/submit.php has run since 2 Aug 2026: a plain-text
   acknowledgment ending in a full copy of what they sent, built from the
   SAME $summary the shop notification carries, so the seller's copy and
   the shop's can never drift. Reply-To is the route owner (carrie@), so
   a seller hitting Reply reaches the lane that owns this form.
   Three rules hold it in its place, and none of them may be relaxed:
     - it goes out ONLY when the seller gave a VALID email address, and
       ONLY after the shop's own copy is proven sent;
     - A FAILED AUTO-RESPONSE IS NOT A FAILED SUBMISSION. It is logged
       and the handler still answers ok. It cannot touch the archive,
       $mail_ok, or the response code - STEP 3 reasons exactly as it did
       before this existed;
     - $meta is deliberately NOT appended to it. That footer carries the
       seller's own IP address, which reads as creepy rather than
       transparent in a confirmation (submit.php makes the same split).
   This form takes no file uploads - photos arrive as a `photo_link` URL
   - so nothing has to be stripped and submit.php's "your attached file
   isn't included in this copy" sentence has no counterpart here.

   MAIL TRANSPORT is the house convention, selected by 'transport' in
   `.mailsecret.php` in the hosting account home directory (found by
   walking up from the document root - same file forms/submit.php uses):
   'graph' = Microsoft Graph sendMail over HTTPS via
   forms/lib/wb-graph.php, the only transport THIS host can deliver
   (GoDaddy blocks outbound 25/465/587 - confirmed in writing 18 Aug
   2026); 'smtp' (the default when the key is absent) = authenticated
   SMTP via forms/lib/wb-smtp.php, kept byte-equivalent for a future
   host with open ports. Both send as the dedicated website@ mailbox.
   READ THE COMMENT BLOCK AT THE TOP OF forms/submit.php BEFORE
   CHANGING ANY OF THAT - it holds the full contract and the transport
   history: PHP mail() was tried there and every message was silently
   discarded (SPF authorises only M365, DMARC is p=reject), which is
   exactly why this handler archives BEFORE it sends. Because the send
   goes straight to Microsoft either way, the cPanel "local mail
   exchanger" trap (a cPanel box that thinks it hosts wooldridgeboats.com
   mail swallowing anything addressed to the domain) does not apply to
   this path - but the live test must still prove every recipient inbox
   receives a submission.

   THE ARCHIVE lives at <account home>/wb-used-boat-submissions/ :
     ub-<stamp>-<boat>-<random>.json   the raw request body, verbatim
     ub-<stamp>-<boat>-<random>.txt    the human-readable summary
     wb-used-boat-intake.log           one line per request - the
                                       by-effect record of arrivals
   The home directory is outside every web root (same reasoning as
   .mailsecret.php itself). Only if no out-of-webroot directory can be
   written does this fall back to forms/_submissions/ INSIDE the
   webroot, defended three ways (0700 directory, deny-all .htaccess,
   long random filename suffix) - and the log says so when it happens.

   The honeypot: the page's hidden `company_website` field is stripped
   by its own JS, so ANY request carrying it non-empty is a bot posting
   directly at this URL. Those are answered 200 and discarded.
   ===================================================================== */

require_once dirname(__FILE__) . '/lib/wb-smtp.php';
require_once dirname(__FILE__) . '/lib/wb-graph.php';

header('Content-Type: application/json; charset=utf-8');
@set_time_limit(90);

$ROUTE = array(
  'to' => 'carrie@wooldridgeboats.com',
  'cc' => 'rachel@wooldridgeboats.com',
);
$FROM_NAME = 'Wooldridge Website';
$AUTO_REPLY = true;   /* the seller's own copy - one switch, both transports */

/* ---- logging (same two destinations as submit.php) ------------------ */
$WB_LOGFILE = null;
function wb_log($msg){
  global $WB_LOGFILE;
  $line = '[WB-USEDBOAT ' . date('Y-m-d H:i:s T') . '] ' . $msg;
  @error_log($line);
  if ($WB_LOGFILE !== null) @error_log($line . "\n", 3, $WB_LOGFILE);
}
function respond($code, $arr){ http_response_code($code); echo json_encode($arr); exit; }
function clean_header($s){ return trim(preg_replace('/[\r\n]+/', ' ', (string)$s)); }  /* header-injection guard */
function wb_rand(){
  if (function_exists('random_bytes')) { try { return bin2hex(random_bytes(8)); } catch (Exception $e) {} }
  return substr(md5(uniqid(mt_rand(), true)), 0, 16);
}
function fv($data, $k){
  return (isset($data[$k]) && is_scalar($data[$k])) ? trim((string)$data[$k]) : '';
}

/* ---- locate .mailsecret.php - identical walk-up to submit.php ------- */
function wb_find_config(){
  $env = getenv('WB_MAIL_CONFIG');
  if ($env !== false && $env !== '' && @is_readable($env)) return $env;

  $bases = array();
  if (!empty($_SERVER['DOCUMENT_ROOT'])) $bases[] = $_SERVER['DOCUMENT_ROOT'];
  $bases[] = dirname(dirname(__FILE__));            /* the site root as deployed */

  $tried = array();
  foreach ($bases as $base){
    $dir = rtrim(str_replace('\\', '/', $base), '/');
    for ($i = 0; $i < 5 && $dir !== '' && $dir !== '/'; $i++){
      $cand = $dir . '/.mailsecret.php';
      if (!isset($tried[$cand])){
        $tried[$cand] = true;
        if (@is_readable($cand)) return $cand;
      }
      $up = dirname($dir);
      if ($up === $dir) break;
      $dir = $up;
    }
  }
  return null;
}

/* the hosting account home = everything left of /public_html in the document
   root. Derived, never hardcoded: dev (public_html/dev) and production
   (public_html) sit at different depths under the same home. */
function wb_home_dir(){
  if (empty($_SERVER['DOCUMENT_ROOT'])) return null;
  $doc = rtrim(str_replace('\\', '/', $_SERVER['DOCUMENT_ROOT']), '/');
  $pos = strpos($doc, '/public_html');
  if ($pos === false || $pos === 0) return null;
  return substr($doc, 0, $pos);
}

/* ---- accept the request --------------------------------------------- */
if ($_SERVER['REQUEST_METHOD'] !== 'POST') respond(405, array('ok' => false, 'error' => 'POST only'));

$raw  = (string)@file_get_contents('php://input');
$data = array();
$ct   = isset($_SERVER['CONTENT_TYPE']) ? $_SERVER['CONTENT_TYPE']
      : (isset($_SERVER['HTTP_CONTENT_TYPE']) ? $_SERVER['HTTP_CONTENT_TYPE'] : '');
if ($raw !== '' && stripos($ct, 'application/json') !== false){
  $j = json_decode($raw, true);
  if (is_array($j)) $data = $j;
}
if (!$data && !empty($_POST)) $data = $_POST;   /* nothing sends form-encoded today; take it rather than lose it */
if (!$data && $raw !== ''){
  $j = json_decode($raw, true);                 /* JSON sent without its content-type */
  if (is_array($j)) $data = $j;
}
if (!$data && $raw === '') respond(400, array('ok' => false, 'error' => 'empty request'));

/* honeypot: the real page never sends this field at all (its serializer
   skips it), so any non-empty value is a direct-posting bot. Pretend
   success, keep nothing. */
$hp = fv($data, 'company_website');
if ($hp === '' && isset($_POST['company_website'])) $hp = trim((string)$_POST['company_website']);
if ($hp !== ''){
  wb_log('honeypot hit from ' . (isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '?') . ' - discarded');
  respond(200, array('ok' => true));
}

$year   = fv($data, 'year');
$make   = fv($data, 'manufacturer');
$model  = fv($data, 'model');
$sname  = fv($data, 'seller_name');
$semail = fv($data, 'seller_email');

/* the page sends a prebuilt plain-text summary; a direct post might not */
$summary = (isset($data['__summary']) && is_string($data['__summary'])) ? $data['__summary'] : '';
if ($summary === ''){
  foreach ($data as $k => $v){
    if ($k === 'company_website' || $k === '__summary') continue;
    if (is_array($v)){
      $flat = array();
      foreach ($v as $item){ if (is_scalar($item)) $flat[] = (string)$item; }
      $v = implode(', ', $flat);
    }
    if (!is_scalar($v)) continue;
    $summary .= $k . ': ' . (string)$v . "\n";
  }
}

/* ---- STEP 1: archive to disk, before any mail work ------------------- */
$slug = preg_replace('/[^A-Za-z0-9]+/', '-', trim($year . ' ' . $make . ' ' . $model));
$slug = trim($slug, '-');
if ($slug === '') $slug = 'boat';
if (strlen($slug) > 60) $slug = substr($slug, 0, 60);   /* filename LABEL only - the data is stored in full */
$base = 'ub-' . date('Ymd-His') . '-' . $slug . '-' . wb_rand();

$store = ($raw !== '') ? $raw : json_encode($data);
if (!is_string($store) || $store === '') $store = "(unencodable submission)\n" . print_r($data, true);

$cfgPath     = wb_find_config();
$fallbackDir = dirname(__FILE__) . '/_submissions';
$candidates  = array();
$home = wb_home_dir();
if ($home !== null) $candidates[] = $home . '/wb-used-boat-submissions';
if ($cfgPath !== null){
  $d = dirname($cfgPath) . '/wb-used-boat-submissions';
  if (!in_array($d, $candidates, true)) $candidates[] = $d;
}
$candidates[] = $fallbackDir;

$archived = false; $archiveDir = ''; $archiveFile = '';
foreach ($candidates as $dir){
  if (!@is_dir($dir)) @mkdir($dir, 0700, true);
  if (!@is_dir($dir)) continue;
  if ($dir === $fallbackDir){
    /* inside the webroot - lay the defenses down before any data lands.
       (The deploy also ships these two files; this is the self-heal.) */
    if (!@file_exists($dir . '/.htaccess'))  @file_put_contents($dir . '/.htaccess', "Require all denied\n");
    if (!@file_exists($dir . '/index.html')) @file_put_contents($dir . '/index.html', '');
  }
  $p = $dir . '/' . $base . '.json';
  $n = @file_put_contents($p, $store, LOCK_EX);
  if ($n === false || $n !== strlen($store)){ @unlink($p); continue; }   /* verify the write by effect */
  @file_put_contents($dir . '/' . $base . '.txt',
      "Received: " . date('Y-m-d H:i:s T') . "\n"
    . "IP: " . (isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '?') . "\n"
    . "Raw copy: " . $base . ".json\n\n"
    . $summary . "\n", LOCK_EX);
  $archived = true; $archiveDir = $dir; $archiveFile = $base . '.json';
  break;
}
if ($archiveDir !== '') $WB_LOGFILE = $archiveDir . '/wb-used-boat-intake.log';
if ($archived){
  wb_log('ARCHIVED ' . $archiveFile . ' (' . strlen($store) . ' bytes)'
    . ($archiveDir === $fallbackDir ? ' [WARN: in-webroot fallback dir - home directory was not writable]' : ''));
} else {
  wb_log('ARCHIVE FAILED - no candidate directory writable: ' . implode(' | ', $candidates));
}

/* ---- STEP 2: email the shop ------------------------------------------ */
$mail_ok = false; $mail_err = ''; $TRANSPORT = 'smtp';   /* the contract default until the config says otherwise */
if ($cfgPath === null){
  $mail_err = 'no .mailsecret.php found walking up from '
    . (isset($_SERVER['DOCUMENT_ROOT']) ? $_SERVER['DOCUMENT_ROOT'] : '?');
} else {
  $MAIL = @include $cfgPath;
  if (!is_array($MAIL)){
    $mail_err = $cfgPath . ' did not return an array';
  } else {
    $MAIL = array_merge(array(
      'host' => 'smtp.office365.com',
      'port' => 587,
      'user' => '',
      'pass' => '',
      'from' => 'website@wooldridgeboats.com',
      'transport'     => 'smtp',
      'tenant_id'     => '',
      'client_id'     => '',
      'client_secret' => '',
    ), $MAIL);
    /* transport dispatch - same contract as submit.php ('smtp' when the
       key is absent; 'graph' = Graph over HTTPS; anything else is a loud
       config error). A config gap here never changes the HTTP answer by
       itself: the archive already ran, and STEP 3 below tells the truth
       from archive-or-mail exactly as before. */
    $TRANSPORT = strtolower(trim((string)$MAIL['transport']));
    if ($TRANSPORT === '') $TRANSPORT = 'smtp';
    $cfgGap = '';
    if ($TRANSPORT !== 'smtp' && $TRANSPORT !== 'graph'){
      $cfgGap = "unknown 'transport' value '" . $MAIL['transport'] . "' (mail config incomplete - use 'smtp' or 'graph')";
    } else if ($TRANSPORT === 'graph'){
      foreach (array('tenant_id', 'client_id', 'client_secret') as $gk){
        if (trim((string)$MAIL[$gk]) === ''){
          $cfgGap = "transport is 'graph' but '" . $gk . "' is missing or blank (mail config incomplete)";
          break;
        }
      }
    } else if (trim((string)$MAIL['user']) === '' || trim((string)$MAIL['pass']) === ''){
      $cfgGap = "'user' or 'pass' is empty";
    }
    if ($cfgGap !== ''){
      $mail_err = $cfgGap . ' in ' . $cfgPath;
    } else {
      $FROM = ($MAIL['from'] !== '') ? $MAIL['from'] : $MAIL['user'];
      $fromDomain = (strpos($FROM, '@') !== false) ? substr($FROM, strpos($FROM, '@') + 1) : 'wooldridgeboats.com';

      $boatBits = array();
      foreach (array($year, $make, $model) as $b){ $b = clean_header($b); if ($b !== '') $boatBits[] = $b; }
      $subject = 'Used boat listing' . ($boatBits ? ' - ' . implode(' ', $boatBits)
                : ($sname !== '' ? ' - ' . clean_header($sname) : ''));

      $meta = "\n---\nSent by the wooldridgeboats.com Sell Your Boat form\n"
            . "Time: " . date('Y-m-d H:i:s T') . "\n"
            . "IP: " . (isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '?') . "\n"
            . ($archived ? "Disk copy: " . $archiveFile . "\n"
                         : "Disk copy: NONE - archiving failed, this email is the only copy\n");

      $envRcpt = array_merge(wb_addr_list($ROUTE['to']), wb_addr_list($ROUTE['cc']));

      /* Reply-To makes hitting Reply reach the SELLER even though the
         message legitimately comes from our own authenticated mailbox.
         Validated and header-cleaned - never trusted into a header (or
         into transport JSON) raw. Shared by both transports. */
      $replyTo   = clean_header($semail);
      $replyToOk = ($replyTo !== '' && filter_var($replyTo, FILTER_VALIDATE_EMAIL));

      /* The seller's acknowledgment - built ONCE, here, above the
         transport dispatch, exactly as submit.php does it, so the graph
         and smtp legs cannot drift on wording. $summary is the single
         source of truth: it is the very text the shop notification
         carries, so the seller's copy cannot disagree with what was
         filed. $meta stays off it (their own IP - see the header).
         $replyToOk is the guard: submit.php can test `$email !== ''`
         because it rejects a malformed address earlier with a 400, but
         this handler never rejects a submission, so "non-empty" here
         has to mean "valid" as well before it reaches a transport. */
      $ar_subject = 'We received your boat listing — Wooldridge Boats';
      $ar_b = "Thank you for sending us your boat listing — this is an automatic confirmation that it reached us.\n\n"
            . "A real person will be in contact with you within 1-2 business days.\n\n"
            . "If it's time-sensitive, call the shop directly: (206) 722-8998, Mon-Thu 6:00am-4:30pm Pacific.\n\n"
            . "Wooldridge Boats - 1303 S 96th St, Seattle, WA 98108\nFamily built since 1915.\n\n"
            . "----------------------------------------\n"
            . "A copy of what you sent us:\n\n"
            . $summary;

      if ($TRANSPORT === 'graph'){
        /* HTTPS transport - token + sendMail via forms/lib/wb-graph.php */
        $gm = array(
          'subject'      => $subject,
          'body'         => array('contentType' => 'Text', 'content' => $summary . $meta),
          'from'         => array('emailAddress' => array('address' => $FROM, 'name' => $FROM_NAME)),
          'toRecipients' => wb_graph_rcpt(wb_addr_list($ROUTE['to'])),
          /* Graph only carries custom x- headers; matches the smtp leg */
          'internetMessageHeaders' => array(array('name' => 'X-WB-Form', 'value' => 'used-boat')),
        );
        $ccList = wb_addr_list($ROUTE['cc']);
        if ($ccList) $gm['ccRecipients'] = wb_graph_rcpt($ccList);
        if ($replyToOk) $gm['replyTo'] = array(array('emailAddress' => array('address' => $replyTo, 'name' => clean_header($sname))));

        $graph = new WBGraph(array(
          'tenant_id'     => $MAIL['tenant_id'],
          'client_id'     => $MAIL['client_id'],
          'client_secret' => $MAIL['client_secret'],
          'timeout'       => 15,
        ));
        try {
          $graph->send($FROM, $gm);
          $mail_ok = true;
          wb_log('SENT used-boat -> ' . implode(', ', $envRcpt) . ' via graph');
        } catch (WBGraphError $e){
          $mail_err = $e->getMessage() . ' | trace: ' . implode(' / ', $graph->trace);
        }

        /* the seller's copy. Its own try/catch on purpose: a throw in
           here must never land in the catch above and make a shop send
           that DID succeed look failed. Note what is NOT touched -
           $mail_ok and $mail_err both keep the shop send's verdict, so
           STEP 3 answers exactly as it would have without this block.
           Gated on $mail_ok because a transport that just refused the
           shop copy would only refuse this one identically. */
        if ($AUTO_REPLY && $mail_ok && $replyToOk){
          try {
            $graph->send($FROM, array(
              'subject'      => $ar_subject,
              'body'         => array('contentType' => 'Text', 'content' => $ar_b),
              'from'         => array('emailAddress' => array('address' => $FROM, 'name' => 'Wooldridge Boats')),
              'toRecipients' => array(array('emailAddress' => array('address' => $replyTo, 'name' => clean_header($sname)))),
              'replyTo'      => array(array('emailAddress' => array('address' => $ROUTE['to']))),
              /* Auto-Submitted cannot ride Graph (custom headers must be
                 x- prefixed); X-Auto-Response-Suppress is the one
                 Exchange honors anyway - same as submit.php */
              'internetMessageHeaders' => array(array('name' => 'X-Auto-Response-Suppress', 'value' => 'All')),
            ));
            wb_log('SELLER COPY -> ' . $replyTo . ' via graph');
          } catch (WBGraphError $e){
            wb_log('auto-response to the seller failed (the listing itself DID send): ' . $e->getMessage());
          }
        }
      } else {
        $hdrs = array();
        $hdrs[] = 'Date: ' . date('r');
        $hdrs[] = 'Message-ID: <' . md5(uniqid('wb', true)) . '@' . $fromDomain . '>';
        $hdrs[] = 'From: ' . wb_addr($FROM, $FROM_NAME);
        $hdrs[] = 'To: ' . $ROUTE['to'];
        if ($ROUTE['cc'] !== '') $hdrs[] = 'Cc: ' . $ROUTE['cc'];
        if ($replyToOk){
          $hdrs[] = 'Reply-To: ' . wb_addr($replyTo, clean_header($sname));
        }
        $hdrs[] = 'Subject: ' . wb_hdr($subject);
        $hdrs[] = 'X-WB-Form: used-boat';
        $hdrs[] = 'MIME-Version: 1.0';
        $hdrs[] = 'Content-Type: text/plain; charset=utf-8';
        $message = implode("\r\n", $hdrs) . "\r\n\r\n" . $summary . $meta;

        $smtp = new WBSmtp(array(
          'host'    => $MAIL['host'],
          'port'    => $MAIL['port'],
          'user'    => $MAIL['user'],
          'pass'    => $MAIL['pass'],
          'ehlo'    => $fromDomain,
          'timeout' => 20,
        ));
        try {
          $smtp->connect();
          $smtp->send($FROM, $envRcpt, $message);
          $mail_ok = true;
          wb_log('SENT used-boat -> ' . implode(', ', $envRcpt) . ' via smtp');
        } catch (WBSmtpError $e){
          $mail_err = $e->getMessage() . ' | trace: ' . implode(' / ', $smtp->trace);
        }

        /* the seller's copy, reusing the connection that just proved
           good - which is why the $mail_ok gate is load-bearing here and
           not merely tidy: sending down a session that just errored is
           unsound. It must also stay ABOVE the quit() below. Same rule
           as the graph leg: logged on failure, never fatal. */
        if ($AUTO_REPLY && $mail_ok && $replyToOk){
          $ar_h = array();
          $ar_h[] = 'Date: ' . date('r');
          $ar_h[] = 'Message-ID: <' . md5(uniqid('ar', true)) . '@' . $fromDomain . '>';
          $ar_h[] = 'From: ' . wb_addr($FROM, 'Wooldridge Boats');
          $ar_h[] = 'To: ' . wb_addr($replyTo, clean_header($sname));
          $ar_h[] = 'Reply-To: ' . $ROUTE['to'];
          $ar_h[] = 'Subject: ' . wb_hdr($ar_subject);
          $ar_h[] = 'Auto-Submitted: auto-replied';
          $ar_h[] = 'X-Auto-Response-Suppress: All';
          $ar_h[] = 'MIME-Version: 1.0';
          $ar_h[] = 'Content-Type: text/plain; charset=utf-8';
          try {
            $smtp->send($FROM, array($replyTo), implode("\r\n", $ar_h) . "\r\n\r\n" . $ar_b);
            wb_log('SELLER COPY -> ' . $replyTo . ' via smtp');
          } catch (WBSmtpError $e){
            wb_log('auto-response to the seller failed (the listing itself DID send): ' . $e->getMessage());
          }
        }
        $smtp->quit();
      }
    }
  }
}
if (!$mail_ok){
  wb_log('EMAIL LEG FAILED via ' . $TRANSPORT . ': ' . $mail_err
    . ($archived ? ' (submission IS safe on disk: ' . $archiveFile . ')' : ' (AND NO DISK COPY - submission not captured)'));
}

/* ---- STEP 3: tell the truth ------------------------------------------ */
if ($archived || $mail_ok) respond(200, array('ok' => true));
respond(500, array('ok' => false, 'error' => 'could not store or send the submission'));
