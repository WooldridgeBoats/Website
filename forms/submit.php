<?php
/* ═══════════════════════════════════════════════════════════════════
   FORM-01 — Wooldridge Boats form handler (cPanel/PHP, no dependencies)
   ═══════════════════════════════════════════════════════════════════
   One endpoint for every site form. The sending form identifies itself
   with a `form` field; recipients are HARD-CODED here per form and are
   never taken from the request. Sends the shop the submission and the
   customer an auto-response (WEB-F-01 / WEB-F-06).

   Forms served (Stephen 2 Aug 2026, superseding the 28 Jul info@ scheme
   — info@ is dead, see the governance doc's mail-routing section):
     contact  -> sales@  cc data@
     quote    -> sales@  cc data@   (a quote IS a sales lead; same lane)
     careers  -> data@   cc stephen@, parts@

   The customer auto-response includes a full copy of what they sent
   (Stephen 2 Aug 2026) — text only; uploaded files don't ride back.

   Change recipients below — nothing else needs editing.

   DELIVERY DEPENDS ON DNS, NOT ON THIS FILE (found 3 Aug 2026): the
   domain publishes SPF `include:spf.protection.outlook.com -all` and
   DMARC `p=reject`, so mail this web server sends as
   @wooldridgeboats.com is REJECTED by M365 and Gmail (never even Junk)
   until (a) cPanel DKIM for the domain is enabled and its TXT record
   published in Cloudflare, and/or (b) this server's IP is added to SPF.
   mail() returning true only means the LOCAL MTA accepted it. Josh owns
   the cPanel side, Richard owns Cloudflare DNS / M365.
   ═══════════════════════════════════════════════════════════════════ */

header('Content-Type: application/json; charset=utf-8');

$ROUTES = array(
  'contact' => array('to' => 'sales@wooldridgeboats.com', 'cc' => 'data@wooldridgeboats.com'),
  'quote'   => array('to' => 'sales@wooldridgeboats.com', 'cc' => 'data@wooldridgeboats.com'),
  'careers' => array('to' => 'data@wooldridgeboats.com', 'cc' => 'stephen@wooldridgeboats.com, parts@wooldridgeboats.com'),
);
$FROM        = 'website@wooldridgeboats.com';   /* envelope/from for both mails */
$AUTO_REPLY  = true;
$MAX_UPLOAD  = 8 * 1024 * 1024;                  /* total attachment budget, bytes */
$ALLOWED_EXT = array('pdf','doc','docx','jpg','jpeg','png','heic','webp');

function fail($code, $msg){ http_response_code($code); echo json_encode(array('ok' => false, 'error' => $msg)); exit; }
function clean_header($s){ return trim(preg_replace('/[\r\n]+/', ' ', (string)$s)); }  /* header-injection guard */

if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail(405, 'POST only');

/* honeypot: real users never fill this; bots do. Pretend success. */
if (!empty($_POST['website'])) { echo json_encode(array('ok' => true)); exit; }

$form = isset($_POST['form']) ? $_POST['form'] : 'contact';
if (!isset($ROUTES[$form])) $form = 'contact';
$route = $ROUTES[$form];

$name  = clean_header(isset($_POST['name'])  ? $_POST['name']  : '');
$email = clean_header(isset($_POST['email']) ? $_POST['email'] : '');
$phone = clean_header(isset($_POST['phone']) ? $_POST['phone'] : '');
if ($name === '')  fail(400, 'name required');
if ($email === '' && $phone === '') fail(400, 'phone or email required');
if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) fail(400, 'bad email');

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
    if ($total > $MAX_UPLOAD) fail(413, 'attachments too large (8 MB total)');
    $ext = strtolower(pathinfo($f['name'], PATHINFO_EXTENSION));
    if (!in_array($ext, $ALLOWED_EXT, true)) fail(415, 'file type not allowed: ' . $ext);
    $parts[] = array(
      'name' => preg_replace('/[^A-Za-z0-9. _-]/', '_', $f['name']),
      'data' => file_get_contents($f['tmp_name']),
    );
  }
}

/* assemble the shop mail (multipart when attachments exist) */
$to  = $route['to'];
$hdr = "From: Wooldridge Website <" . $FROM . ">\r\n";
if ($route['cc'] !== '') $hdr .= "Cc: " . $route['cc'] . "\r\n";
if ($email !== '') $hdr .= "Reply-To: " . ($name !== '' ? '"' . addslashes($name) . '" ' : '') . "<" . $email . ">\r\n";
$hdr .= "X-WB-Form: " . $form . "\r\n";

if ($parts){
  $bnd  = 'wb' . md5(uniqid('', true));
  $hdr .= "MIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary=\"$bnd\"\r\n";
  $msg  = "--$bnd\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n" . $body . $meta . "\r\n";
  foreach ($parts as $p){
    $msg .= "--$bnd\r\nContent-Type: application/octet-stream; name=\"{$p['name']}\"\r\n"
          . "Content-Transfer-Encoding: base64\r\nContent-Disposition: attachment; filename=\"{$p['name']}\"\r\n\r\n"
          . chunk_split(base64_encode($p['data'])) . "\r\n";
  }
  $msg .= "--$bnd--";
} else {
  $hdr .= "Content-Type: text/plain; charset=utf-8\r\n";
  $msg  = $body . $meta;
}

/* '-f' sets the ENVELOPE sender (Return-Path). Without it exim stamps the raw
   cPanel account as envelope-from: bounces route nowhere and SPF can never
   align with the From: domain even once DNS is fixed. */
if (!mail($to, $subject, $msg, $hdr, '-f' . $FROM)) fail(500, 'mail() failed');

/* customer auto-response (WEB-F-06 wording — business days, on purpose),
   with a full copy of their own message (Stephen 2 Aug 2026) */
if ($AUTO_REPLY && $email !== ''){
  $ar_h = "From: Wooldridge Boats <" . $FROM . ">\r\nReply-To: sales@wooldridgeboats.com\r\nContent-Type: text/plain; charset=utf-8\r\n";
  $ar_b = "Thank you for your inquiry — this is an automatic confirmation that it reached us.\n\n"
        . "A real person will be in contact with you within 2-3 business days.\n\n"
        . "If it's time-sensitive, call the shop directly: (206) 722-8998, Mon-Thu 6:00am-4:30pm Pacific.\n\n"
        . "Wooldridge Boats - 1303 S 96th St, Seattle, WA 98108\nFamily built since 1915.\n\n"
        . "----------------------------------------\n"
        . "A copy of what you sent us:\n\n"
        . $body;
  if ($parts) $ar_b .= "\n(Your attached file" . (count($parts) > 1 ? "s" : "") . " reached us too, but "
        . (count($parts) > 1 ? "they aren't" : "it isn't") . " included in this copy.)\n";
  @mail($email, 'We received your ' . ($form === 'careers' ? 'application' : 'inquiry') . ' — Wooldridge Boats', $ar_b, $ar_h, '-f' . $FROM);
}

echo json_encode(array('ok' => true));
