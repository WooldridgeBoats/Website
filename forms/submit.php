<?php
/* ═══════════════════════════════════════════════════════════════════
   FORM-01 — Wooldridge Boats form handler
   ═══════════════════════════════════════════════════════════════════
   One endpoint for every site form. The sending form identifies itself
   with a `form` field; recipients are HARD-CODED here per form and are
   never taken from the request. Sends the shop the submission and the
   customer an auto-response (WEB-F-01 / WEB-F-06).

   Forms served (Stephen 26 Aug 2026, revising the 2 Aug scheme):
     contact  -> info@   cc data@   (auto-response Reply-To: info@)
     quote    -> sales@  cc data@   (a quote IS a sales lead; same
                 lane. Auto-response Reply-To: sales@)
     careers  -> data@   cc parts@, luke@, grant@
                 (auto-response Reply-To: data@. stephen@ is off this
                 Cc deliberately - data@ is an alias on his mailbox
                 and sits on the To, so he still gets it)
   info@ was VACATED in July - that reasoning stands as history and is
   in the governance doc's mail-routing section - but it is a real
   shared mailbox, read again as of 26 Aug 2026 (Stephen's ruling), so
   general contact goes back to it.
   The 'reply' key on each route is the Reply-To on the CUSTOMER's
   auto-response, so a reply lands in the lane that owns the form.
   Both transports read that one key, so they cannot drift.

   The customer auto-response includes a full copy of what they sent
   (Stephen 2 Aug 2026) — text only; uploaded files don't ride back.

   Change recipients in $ROUTES below — nothing else needs editing.

   ───────────────────────────────────────────────────────────────────
   DO NOT PUT mail() BACK IN THIS FILE. Here is what happened.
   ───────────────────────────────────────────────────────────────────
   Until 3 Aug 2026 this handler used PHP mail(), i.e. the GoDaddy cPanel
   web server's local MTA. Every single form email was silently thrown
   away, while the page cheerfully showed a thank-you. Proven by effect:
   test submissions never arrived, not even in Junk.

   Why: wooldridgeboats.com publishes
       SPF    v=spf1 include:spf.protection.outlook.com -all
       DMARC  p=reject
   SPF authorises Microsoft 365 and nothing else, and DMARC says reject
   anything that fails. The cPanel server is not M365, so mail it sends
   as @wooldridgeboats.com fails SPF, fails DKIM, and gets refused at
   SMTP by M365 and Gmail alike. mail() returning true only ever meant
   "the local MTA queued it" — it knows nothing about the rejection that
   happens later, which is exactly why the failure was invisible.

   Two fixes were considered and one was rejected:
     • Add the web server to SPF — REJECTED 3 Aug 2026. The server is on
       a SHARED IP (107.180.116.132). Authorising it in our SPF would
       authorise every other tenant on that IP to send as us.
     • cPanel DKIM — NOT AVAILABLE. This GoDaddy cPanel build has no
       Email Deliverability / DKIM tool at all.

   So the site now sends the way a mail client does: authenticated SMTP
   straight to Microsoft 365, as a DEDICATED send-only mailbox,
   website@wooldridgeboats.com (Stephen's final call, 3 Aug 2026 — the
   data@ alias route below was considered and abandoned as too
   convoluted: an alias can't authenticate, so it would have meant
   putting Stephen's own mailbox password on a web server). Because
   M365 is the sender, SPF and DKIM and DMARC all pass, zero DNS changes.
   It also means we get a SYNCHRONOUS answer — the handler knows whether
   the message was accepted and tells the browser the truth instead of a
   thank-you (see the ok:false paths below and the failure copy on the
   three form pages).

   Credentials live OUTSIDE the web root and OUTSIDE the repo, in
   `.mailsecret.php` in the hosting account's home directory
   (`/home/hx01pil7u5iy/.mailsecret.php` on the current host). It is
   found by walking up from the document root, so dev and production
   both work with one file. Expected shape — a PHP file that RETURNS an
   array, so that even if it were ever moved inside the web root the
   server would execute it rather than serve the secrets as text:

       <?php
       return array(
         // which way out of the building. 'smtp' when the key is absent
         // (the legacy default); 'graph' = Microsoft Graph over HTTPS,
         // the only transport THIS host can deliver (GoDaddy blocks
         // outbound 25/465/587 - confirmed in writing 18 Aug 2026, see
         // TRANSPORT VERDICT below). Any other value is a loud config
         // error, never a silent fallback onto a transport nobody chose.
         'transport' => 'graph',

         // graph transport (forms/lib/wb-graph.php) - all three required
         // when transport is 'graph':
         'tenant_id'     => '<Entra tenant GUID>',
         'client_id'     => '<app registration Application (client) ID>',
         'client_secret' => '<client secret VALUE>',

         // smtp transport (forms/lib/wb-smtp.php) - kept for a future
         // host with open ports; ignored while transport is 'graph':
         'host' => 'smtp.office365.com',
         'port' => 587,
         'user' => 'website@wooldridgeboats.com',
         'pass' => '<its password / app password>',

         // both transports send as this mailbox:
         'from' => 'website@wooldridgeboats.com',
       );

   If that file is missing or unreadable, or the selected transport's
   credentials are blank, this handler LOGS the reason and returns
   ok:false. It never claims success. The response `error` strings are
   a fixed contract (the go-live briefing's decoder table reads them):
   503 'mail config missing' / 'mail config unreadable' /
   'mail credentials not set' (smtp keys blank) / 'mail config
   incomplete' (graph keys blank, or an unknown transport value); a
   genuine refusal by the mail service itself is 502 with THE one
   transport-neutral send-failure string, 'mail send failed'
   (which replaced 'smtp send failed' when the graph transport landed,
   18 Aug 2026 - one string whichever transport is configured).

   'user' and 'from' are kept as SEPARATE config keys but are expected to be
   the SAME address now that the sender is a dedicated mailbox — it
   authenticates as itself, so there is no alias rewriting to work around
   and no From: surprise. (Earlier drafts of this file used data@, an
   alias on Stephen's own stephen@ mailbox; that route was abandoned 3 Aug
   2026 because an alias can't authenticate and putting Stephen's own
   password on a web server was too much exposure. The two keys stayed
   separate in case a future mailbox change repeats that situation.)

   TRANSPORT VERDICT, 18 Aug 2026 - why 'graph' exists and smtp stays:
   the SMTP AUTH question above went MOOT on this host before it was
   ever answered. Stephen port-tested from the cPanel Terminal: outbound
   25, 465 AND 587 are all blocked, and GoDaddy support confirmed in
   writing the same day that opening them is not possible on shared
   hosting. Every wb-smtp send died as a connect-timeout before one
   SMTP byte moved. Outbound 443 works (the cPanel git deploy pulls
   GitHub over it), so transport 'graph' sends the same mail as the
   same website@ mailbox through Microsoft Graph sendMail instead
   (forms/lib/wb-graph.php: client-credentials token, then
   POST /users/website@.../sendMail, saveToSentItems on).
   Dependencies for graph: an Entra app registration holding the
   Mail.Send APPLICATION permission with admin consent granted
   (Richard), and its Application (client) ID + client secret VALUE
   pasted into .mailsecret.php (Stephen). The tenant GUID is public and
   already baked into the go-live briefing. The smtp branch is kept
   intact and byte-equivalent for a future host with open ports.
   ═══════════════════════════════════════════════════════════════════ */

require_once dirname(__FILE__) . '/lib/wb-smtp.php';
require_once dirname(__FILE__) . '/lib/wb-graph.php';

header('Content-Type: application/json; charset=utf-8');

/* An 8 MB resume plus an SMTP round trip to Microsoft can outrun the default
   30-second execution limit, and a timeout mid-DATA is the one failure mode
   that could still be ambiguous. Buy headroom. */
@set_time_limit(90);

$ROUTES = array(
  'contact' => array('to' => 'info@wooldridgeboats.com', 'cc' => 'data@wooldridgeboats.com', 'reply' => 'info@wooldridgeboats.com'),
  'quote'   => array('to' => 'sales@wooldridgeboats.com', 'cc' => 'data@wooldridgeboats.com', 'reply' => 'sales@wooldridgeboats.com'),
  'careers' => array('to' => 'data@wooldridgeboats.com', 'cc' => 'parts@wooldridgeboats.com, luke@wooldridgeboats.com, grant@wooldridgeboats.com', 'reply' => 'data@wooldridgeboats.com'),
);
$FROM_NAME   = 'Wooldridge Website';
$AUTO_REPLY  = true;
$MAX_UPLOAD  = 8 * 1024 * 1024;                  /* total attachment budget, bytes */
$ALLOWED_EXT = array('pdf','doc','docx','jpg','jpeg','png','heic','webp');

/* the one sentence a visitor sees when the send genuinely fails. Plain,
   non-technical, and it hands them a working way through. */
$USER_FAIL_MSG = 'We couldn\'t send that. Please email info@wooldridgeboats.com or call (206) 722-8998.';

/* ─── logging ─────────────────────────────────────────────────────────
   Two destinations on purpose: the PHP error log (always exists, hard to
   find on this host) and a plain file in the home directory beside the
   credential file (easy to find, and the way to verify by effect that a
   submission actually left the building). Never log the password. */
$WB_LOGFILE = null;
function wb_log($msg){
  global $WB_LOGFILE;
  $line = '[WB-FORM ' . date('Y-m-d H:i:s T') . '] ' . $msg;
  @error_log($line);
  if ($WB_LOGFILE !== null) @error_log($line . "\n", 3, $WB_LOGFILE);
}

/* $detail is for the log, $userMsg is for the visitor's screen */
function fail($code, $detail, $userMsg = null){
  global $USER_FAIL_MSG;
  http_response_code($code);
  echo json_encode(array(
    'ok'      => false,
    'error'   => $detail,
    'message' => ($userMsg !== null ? $userMsg : $USER_FAIL_MSG),
  ));
  exit;
}
function clean_header($s){ return trim(preg_replace('/[\r\n]+/', ' ', (string)$s)); }  /* header-injection guard */

/* ─── locate the credential file ──────────────────────────────────────
   Walk up from the document root (and from this file) until `.mailsecret.php`
   turns up. Derived, not hardcoded: /public_html/dev and /public_html are
   different depths, and the governance rule here is that absolute paths
   break silently. WB_MAIL_CONFIG in the environment wins if set. */
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

if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail(405, 'POST only', 'That page expects a form submission.');

/* honeypot: real users never fill this; bots do. Pretend success. */
if (!empty($_POST['website'])) { echo json_encode(array('ok' => true)); exit; }

$form = isset($_POST['form']) ? $_POST['form'] : 'contact';
if (!isset($ROUTES[$form])) $form = 'contact';
$route = $ROUTES[$form];

$name  = clean_header(isset($_POST['name'])  ? $_POST['name']  : '');
$email = clean_header(isset($_POST['email']) ? $_POST['email'] : '');
$phone = clean_header(isset($_POST['phone']) ? $_POST['phone'] : '');
$badFields = 'Please check the form — a name plus a phone number or email address is needed.';
if ($name === '')  fail(400, 'name required', $badFields);
if ($email === '' && $phone === '') fail(400, 'phone or email required', $badFields);
if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) fail(400, 'bad email', 'That email address doesn\'t look right — please check it.');

$subject = clean_header(isset($_POST['subject']) ? $_POST['subject'] : '');
if ($subject === '') $subject = ucfirst($form) . ' — ' . $name;

/* body: prefer a prebuilt summary (quote tool), else assemble every field */
$body = '';
if (!empty($_POST['summary'])) {
  $body = (string)$_POST['summary'];
} else {
  $skip = array('form','subject','summary','website');
  foreach ($_POST as $k => $v){
    if (in_array($k, $skip, true)) continue;
    $body .= ucfirst($k) . ": " . trim((string)$v) . "\n";
  }
}
/* keep the customer-visible content separate from the shop-only meta footer:
   the auto-response echoes $body back to the customer, and their own IP in a
   confirmation email reads as creepy rather than transparent */
$meta = "\n---\nSent by the wooldridgeboats.com " . $form . " form\n"
      . "Time: " . date('Y-m-d H:i:s T') . "\n"
      . "IP: " . (isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '?') . "\n";

/* attachments (photos / resume) */
$parts = array();
$total = 0;
if (!empty($_FILES)){
  foreach ($_FILES as $f){
    if (!is_array($f) || $f['error'] !== UPLOAD_ERR_OK) continue;
    $total += $f['size'];
    if ($total > $MAX_UPLOAD) fail(413, 'attachments too large (8 MB total)', 'Those files add up to more than 8 MB — please send fewer or smaller ones.');
    $ext = strtolower(pathinfo($f['name'], PATHINFO_EXTENSION));
    if (!in_array($ext, $ALLOWED_EXT, true)) fail(415, 'file type not allowed: ' . $ext, 'That file type isn\'t accepted. PDF, Word, or a photo works.');
    $parts[] = array(
      'name' => preg_replace('/[^A-Za-z0-9. _-]/', '_', $f['name']),
      'data' => file_get_contents($f['tmp_name']),
    );
  }
}

/* ─── credentials ─────────────────────────────────────────────────── */
$cfgPath = wb_find_config();
if ($cfgPath === null){
  wb_log('ABORT ' . $form . ': no .mailsecret.php found walking up from '
    . (isset($_SERVER['DOCUMENT_ROOT']) ? $_SERVER['DOCUMENT_ROOT'] : '?')
    . ' — create it in the hosting account home directory (see the comment block in forms/submit.php)');
  fail(503, 'mail config missing');
}
$WB_LOGFILE = dirname($cfgPath) . '/wb-form-mail.log';

$MAIL = @include $cfgPath;
if (!is_array($MAIL)){
  wb_log('ABORT ' . $form . ': ' . $cfgPath . ' did not return an array');
  fail(503, 'mail config unreadable');
}
/* No default for 'user' on purpose: guessing a mailbox name here would
   produce a 535 that looks like a wrong password. Make the config say it. */
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

/* Which way out of the building. Absent/'smtp' = the legacy SMTP leg,
   kept byte-equivalent to the 3 Aug behavior; 'graph' = Microsoft Graph
   over HTTPS, the only transport THIS host can deliver (see the header).
   Anything else is a typo and gets a loud config error - never a silent
   fallback onto a transport nobody chose. */
$TRANSPORT = strtolower(trim((string)$MAIL['transport']));
if ($TRANSPORT === '') $TRANSPORT = 'smtp';
if ($TRANSPORT !== 'smtp' && $TRANSPORT !== 'graph'){
  wb_log('ABORT ' . $form . ": unknown 'transport' value '" . $MAIL['transport'] . "' in " . $cfgPath
    . " - use 'smtp' or 'graph'");
  fail(503, 'mail config incomplete');
}
if ($TRANSPORT === 'graph'){
  foreach (array('tenant_id', 'client_id', 'client_secret') as $gk){
    if (trim((string)$MAIL[$gk]) === ''){
      wb_log('ABORT ' . $form . ": transport is 'graph' but '" . $gk . "' is missing or blank in " . $cfgPath
        . ' - the app registration values come from Richard; see FORM MAIL - GO LIVE BRIEFING');
      fail(503, 'mail config incomplete');
    }
  }
} else if (trim((string)$MAIL['user']) === '' || trim((string)$MAIL['pass']) === ''){
  wb_log('ABORT ' . $form . ": 'user' or 'pass' is empty in " . $cfgPath
    . ' — pending SMTP AUTH being enabled on the data@ mailbox (Richard) and the password being put in the file (Stephen)');
  fail(503, 'mail credentials not set');
}
/* What we ASK to send as — the dedicated mailbox itself, so no alias
   rewriting applies. See the header comment. */
$FROM = ($MAIL['from'] !== '') ? $MAIL['from'] : $MAIL['user'];
$fromDomain = (strpos($FROM, '@') !== false) ? substr($FROM, strpos($FROM, '@') + 1) : 'wooldridgeboats.com';

/* shared by both transports: who this goes to, and the auto-response
   text - built once so the two transports can never drift on wording */
$to      = $route['to'];
$envRcpt = array_merge(wb_addr_list($to), wb_addr_list($route['cc']));

$ar_b = "Thank you for your inquiry — this is an automatic confirmation that it reached us.\n\n"
      . "A real person will be in contact with you within 2-3 business days.\n\n"
      . "If it's time-sensitive, call the shop directly: (206) 722-8998, Mon-Thu 6:00am-4:30pm Pacific.\n\n"
      . "Wooldridge Boats - 1303 S 96th St, Seattle, WA 98108\nFamily built since 1915.\n\n"
      . "----------------------------------------\n"
      . "A copy of what you sent us:\n\n"
      . $body;
if ($parts) $ar_b .= "\n(Your attached file" . (count($parts) > 1 ? "s" : "") . " reached us too, but "
      . (count($parts) > 1 ? "they aren't" : "it isn't") . " included in this copy.)\n";
$ar_subject = 'We received your ' . ($form === 'careers' ? 'application' : 'inquiry') . ' — Wooldridge Boats';

/* ─── transport 'graph': two HTTPS round trips, then the truth ────── */
if ($TRANSPORT === 'graph'){
  $graph = new WBGraph(array(
    'tenant_id'     => $MAIL['tenant_id'],
    'client_id'     => $MAIL['client_id'],
    'client_secret' => $MAIL['client_secret'],
    'timeout'       => 15,
  ));

  $gm = array(
    'subject'      => $subject,
    'body'         => array('contentType' => 'Text', 'content' => $body . $meta),
    'from'         => array('emailAddress' => array('address' => $FROM, 'name' => $FROM_NAME)),
    'toRecipients' => wb_graph_rcpt(wb_addr_list($to)),
    /* Graph only carries custom x- headers; X-WB-Form matches the smtp leg */
    'internetMessageHeaders' => array(array('name' => 'X-WB-Form', 'value' => $form)),
  );
  $ccList = wb_addr_list($route['cc']);
  if ($ccList) $gm['ccRecipients'] = wb_graph_rcpt($ccList);
  /* Reply-To is what makes hitting Reply reach the CUSTOMER even though
     the message legitimately comes from our own authenticated mailbox */
  if ($email !== '') $gm['replyTo'] = array(array('emailAddress' => array('address' => $email, 'name' => $name)));
  if ($parts){
    $gm['attachments'] = array();
    foreach ($parts as $p){
      $gm['attachments'][] = array(
        '@odata.type'  => '#microsoft.graph.fileAttachment',
        'name'         => $p['name'],
        'contentType'  => 'application/octet-stream',
        'contentBytes' => base64_encode($p['data']),
      );
    }
  }

  try {
    $graph->send($FROM, $gm);
  } catch (WBGraphError $e){
    wb_log('FAILED ' . $form . ' -> ' . implode(', ', $envRcpt) . ' via graph : ' . $e->getMessage()
      . ' | trace: ' . implode(' / ', $graph->trace));
    fail(502, 'mail send failed');
  }
  wb_log('SENT ' . $form . ' -> ' . implode(', ', $envRcpt) . ' via graph'
    . ($parts ? ' (' . count($parts) . ' attachment' . (count($parts) > 1 ? 's' : '') . ')' : ''));

  /* customer auto-response — same rule as the smtp leg: a failed
     auto-response is NOT a failed submission; log it and still say yes */
  if ($AUTO_REPLY && $email !== ''){
    try {
      $graph->send($FROM, array(
        'subject'      => $ar_subject,
        'body'         => array('contentType' => 'Text', 'content' => $ar_b),
        'from'         => array('emailAddress' => array('address' => $FROM, 'name' => 'Wooldridge Boats')),
        'toRecipients' => array(array('emailAddress' => array('address' => $email, 'name' => $name))),
        'replyTo'      => array(array('emailAddress' => array('address' => $route['reply']))),
        /* Auto-Submitted cannot ride Graph (custom headers must be x-);
           X-Auto-Response-Suppress is the one Exchange honors anyway */
        'internetMessageHeaders' => array(array('name' => 'X-Auto-Response-Suppress', 'value' => 'All')),
      ));
    } catch (WBGraphError $e){
      wb_log('auto-response to the submitter failed (submission itself DID send): ' . $e->getMessage());
    }
  }
  echo json_encode(array('ok' => true));
  exit;
}

/* ─── transport 'smtp': assemble the shop mail ────────────────────── */
$hdrs = array();
$hdrs[] = 'Date: ' . date('r');
$hdrs[] = 'Message-ID: <' . md5(uniqid('wb', true)) . '@' . $fromDomain . '>';
$hdrs[] = 'From: ' . wb_addr($FROM, $FROM_NAME);
$hdrs[] = 'To: ' . $to;
if ($route['cc'] !== '') $hdrs[] = 'Cc: ' . $route['cc'];
/* Reply-To is what makes hitting Reply reach the CUSTOMER even though the
   message legitimately comes from our own authenticated mailbox */
if ($email !== '') $hdrs[] = 'Reply-To: ' . wb_addr($email, $name);
$hdrs[] = 'Subject: ' . wb_hdr($subject);
$hdrs[] = 'X-WB-Form: ' . $form;
$hdrs[] = 'MIME-Version: 1.0';

if ($parts){
  $bnd = 'wb' . md5(uniqid('', true));
  $hdrs[] = 'Content-Type: multipart/mixed; boundary="' . $bnd . '"';
  $msg  = "--$bnd\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n" . $body . $meta . "\r\n";
  foreach ($parts as $p){
    $msg .= "--$bnd\r\nContent-Type: application/octet-stream; name=\"{$p['name']}\"\r\n"
          . "Content-Transfer-Encoding: base64\r\nContent-Disposition: attachment; filename=\"{$p['name']}\"\r\n\r\n"
          . chunk_split(base64_encode($p['data'])) . "\r\n";
  }
  $msg .= "--$bnd--\r\n";
} else {
  $hdrs[] = 'Content-Type: text/plain; charset=utf-8';
  $msg  = $body . $meta;
}
$shopMessage = implode("\r\n", $hdrs) . "\r\n\r\n" . $msg;

/* ─── send it, and report the truth ───────────────────────────────── */
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
  $smtp->send($FROM, $envRcpt, $shopMessage);
} catch (WBSmtpError $e){
  wb_log('FAILED ' . $form . ' -> ' . implode(', ', $envRcpt) . ' via smtp : ' . $e->getMessage()
    . ' | trace: ' . implode(' / ', $smtp->trace));
  $smtp->quit();
  fail(502, 'mail send failed');
}
wb_log('SENT ' . $form . ' -> ' . implode(', ', $envRcpt) . ' via smtp'
  . ($parts ? ' (' . count($parts) . ' attachment' . (count($parts) > 1 ? 's' : '') . ')' : ''));

/* customer auto-response (WEB-F-06 wording — business days, on purpose),
   with a full copy of their own message (Stephen 2 Aug 2026).
   A failed auto-response is NOT a failed submission: the shop already has
   it, so log it and still tell the visitor yes. */
if ($AUTO_REPLY && $email !== ''){
  $ar_h = array();
  $ar_h[] = 'Date: ' . date('r');
  $ar_h[] = 'Message-ID: <' . md5(uniqid('ar', true)) . '@' . $fromDomain . '>';
  $ar_h[] = 'From: ' . wb_addr($FROM, 'Wooldridge Boats');
  $ar_h[] = 'To: ' . wb_addr($email, $name);
  $ar_h[] = 'Reply-To: ' . $route['reply'];
  $ar_h[] = 'Subject: ' . wb_hdr($ar_subject);
  $ar_h[] = 'Auto-Submitted: auto-replied';
  $ar_h[] = 'X-Auto-Response-Suppress: All';
  $ar_h[] = 'MIME-Version: 1.0';
  $ar_h[] = 'Content-Type: text/plain; charset=utf-8';

  try {
    $smtp->send($FROM, array($email), implode("\r\n", $ar_h) . "\r\n\r\n" . $ar_b);
  } catch (WBSmtpError $e){
    wb_log('auto-response to the submitter failed (submission itself DID send): ' . $e->getMessage());
  }
}

$smtp->quit();
echo json_encode(array('ok' => true));
