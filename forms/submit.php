<?php
/* ═══════════════════════════════════════════════════════════════════
   FORM-01 — Wooldridge Boats form handler (cPanel/PHP, no dependencies)
   ═══════════════════════════════════════════════════════════════════
   One endpoint for every site form. The sending form identifies itself
   with a `form` field; recipients are HARD-CODED here per form and are
   never taken from the request. Sends the shop the submission and the
   customer an auto-response (WEB-F-01 / WEB-F-06).

   Forms served:
     contact  -> info@   (general inquiry)
     quote    -> danny@  cc stephen@, data@   (quote request, photos)
     careers  -> info@   (application, resume attachment)

   Change recipients below — nothing else needs editing.
   ═══════════════════════════════════════════════════════════════════ */

header('Content-Type: application/json; charset=utf-8');

$ROUTES = array(
  'contact' => array('to' => 'info@wooldridgeboats.com',  'cc' => 'data@wooldridgeboats.com'),
  'quote'   => array('to' => 'danny@wooldridgeboats.com', 'cc' => 'stephen@wooldridgeboats.com, data@wooldridgeboats.com'),
  'careers' => array('to' => 'info@wooldridgeboats.com',  'cc' => 'data@wooldridgeboats.com'),
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
$body .= "\n---\nSent by the wooldridgeboats.com " . $form . " form\n"
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
  $msg  = "--$bnd\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n" . $body . "\r\n";
  foreach ($parts as $p){
    $msg .= "--$bnd\r\nContent-Type: application/octet-stream; name=\"{$p['name']}\"\r\n"
          . "Content-Transfer-Encoding: base64\r\nContent-Disposition: attachment; filename=\"{$p['name']}\"\r\n\r\n"
          . chunk_split(base64_encode($p['data'])) . "\r\n";
  }
  $msg .= "--$bnd--";
} else {
  $hdr .= "Content-Type: text/plain; charset=utf-8\r\n";
  $msg  = $body;
}

if (!mail($to, $subject, $msg, $hdr)) fail(500, 'mail() failed');

/* customer auto-response (WEB-F-06 wording — business days, on purpose) */
if ($AUTO_REPLY && $email !== ''){
  $ar_h = "From: Wooldridge Boats <" . $FROM . ">\r\nReply-To: info@wooldridgeboats.com\r\nContent-Type: text/plain; charset=utf-8\r\n";
  $ar_b = "Thank you for your inquiry — this is an automatic confirmation that it reached us.\n\n"
        . "A real person will be in contact with you within 2-3 business days.\n\n"
        . "If it's time-sensitive, call the shop directly: (206) 722-8998, Mon-Thu 6:00am-4:30pm Pacific.\n\n"
        . "Wooldridge Boats - 1303 S 96th St, Seattle, WA 98108\nFamily built since 1915.\n";
  @mail($email, 'We received your ' . ($form === 'careers' ? 'application' : 'inquiry') . ' — Wooldridge Boats', $ar_b, $ar_h);
}

echo json_encode(array('ok' => true));
