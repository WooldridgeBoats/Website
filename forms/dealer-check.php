<?php
/* ═══════════════════════════════════════════════════════════════════
   forms/dealer-check.php - the dealer code check for the DEALER version of
   Build & Price (/build-and-price/?dealer=1). Stephen's rulings, 2026-11-17:
   one shared dealer code, checked by the website's SERVER, asked once per page
   load (nothing is remembered between visits), never in the page or the repo.

   The page POSTs the code a dealer typed, as the field 'code'. Answers:
     200 {"ok":true}                               right code
     403 {"ok":false,"error":"wrong code"}         wrong code (answered after a 2-second wait)
     429 {"ok":false,"error":"too many tries"}     more than 20 wrong codes from one address in an hour
     503 {"ok":false,"error":"dealer code not set"} the file below is missing, unreadable or incomplete
     405 {"ok":false,"error":"POST only"}          anything but a POST
   It never echoes the code and never logs it.

   WHERE THE CODE LIVES: nowhere. Only a salted SHA-256 of it is kept, in
   `.dealercode.php` in the hosting account's HOME directory, beside
   `.mailsecret.php` (`/home/hx01pil7u5iy/.dealercode.php` on the current host),
   outside every web root. It is found the way forms/submit.php finds its
   credential file: by walking up from the document root
   (WB_DEALER_CONFIG in the environment wins if set). It is a SEPARATE file from
   .mailsecret.php on purpose: a typo made while changing the dealer code must
   never be able to take the website's form mail (and the Build Hub's inquiries)
   down with it. Expected shape - a PHP file that RETURNS an array, so that even
   if it were ever moved inside the web root the server would run it rather
   than serve it as text:

       <?php
       return array(
         'salt'   => '<32 hex characters>',
         'sha256' => '<64 hex characters>',
       );

   sha256 = SHA-256, in hex, of (salt + the code), where the code is in lower
   case with spaces at both ends removed. Make the file with
   _build/dealer_code_hash.ps1 on a Windows PC (PowerShell 5.1, no PHP needed):
   the code is typed into that window and nowhere else. Changing the code =
   run it again and replace the file on the host; nothing in the repo changes.

   Capital letters do not matter and spaces at the ends are ignored, so a
   phone's automatic capital letter cannot lock a dealer out.

   What this protects, plainly: the dealer version shows full prices on screen
   once the code is accepted. Like the customer price lock it is a screen-level
   gate - the prices are in the page's code and on the public price sheets, by
   Stephen's 2026-11-12 ruling. The code keeps the dealer view out of casual
   reach; it is not a vault.
   ═══════════════════════════════════════════════════════════════════ */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, max-age=0');
header('X-Robots-Tag: noindex, nofollow');

$DEALER_FAIL_WAIT = 2;    /* seconds a wrong code waits before it is answered - slows guessing */
$DEALER_FAIL_MAX  = 20;   /* wrong codes allowed from one address in an hour; past that, 429 */

function dealer_out($code, $ok, $error){
  http_response_code($code);
  $o = array('ok' => $ok);
  if ($error !== '') $o['error'] = $error;
  echo json_encode($o);
  exit;
}

/* hash_equals arrived in PHP 5.6; keep a constant-time stand-in for an older host */
if (!function_exists('hash_equals')){
  function hash_equals($a, $b){
    if (!is_string($a) || !is_string($b) || strlen($a) !== strlen($b)) return false;
    $r = 0;
    for ($i = 0; $i < strlen($a); $i++) $r |= ord($a[$i]) ^ ord($b[$i]);
    return $r === 0;
  }
}

/* Same walk as forms/submit.php wb_find_config(), for a different file name. */
function dealer_find_config(){
  $env = getenv('WB_DEALER_CONFIG');
  if ($env !== false && $env !== '' && @is_readable($env)) return $env;

  $bases = array();
  if (!empty($_SERVER['DOCUMENT_ROOT'])) $bases[] = $_SERVER['DOCUMENT_ROOT'];
  $bases[] = dirname(dirname(__FILE__));            /* the site root as deployed */

  $tried = array();
  foreach ($bases as $base){
    $dir = rtrim(str_replace('\\', '/', $base), '/');
    for ($i = 0; $i < 5 && $dir !== '' && $dir !== '/'; $i++){
      $cand = $dir . '/.dealercode.php';
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

function dealer_log($dir, $msg){
  $line = '[WB-DEALER ' . date('Y-m-d H:i:s T') . '] ' . $msg;
  @error_log($line);
  if ($dir !== null) @error_log($line . "\n", 3, $dir . '/wb-dealer-check.log');
}

if (!isset($_SERVER['REQUEST_METHOD']) || $_SERVER['REQUEST_METHOD'] !== 'POST') dealer_out(405, false, 'POST only');

$cfgPath = dealer_find_config();
if ($cfgPath === null){
  dealer_log(null, 'no .dealercode.php found walking up from '
    . (isset($_SERVER['DOCUMENT_ROOT']) ? $_SERVER['DOCUMENT_ROOT'] : '?')
    . ' - make it with _build/dealer_code_hash.ps1 and put it in the hosting account home directory');
  dealer_out(503, false, 'dealer code not set');
}
$cfgDir = dirname($cfgPath);

/* A broken file (a typo while editing it) must give a clear 503, not a blank 500. PHP 7+ throws a
   ParseError, which the Throwable catch takes; PHP 5 has no Throwable and simply never matches it. */
$CFG = null;
try { $CFG = @include $cfgPath; }
catch (Exception $e) { $CFG = null; }
catch (Throwable $e) { $CFG = null; }
if (!is_array($CFG)
    || !isset($CFG['salt']) || !preg_match('/^[0-9a-fA-F]{16,128}$/', (string)$CFG['salt'])
    || !isset($CFG['sha256']) || !preg_match('/^[0-9a-fA-F]{64}$/', (string)$CFG['sha256'])){
  dealer_log($cfgDir, $cfgPath . " did not return array('salt' => <hex>, 'sha256' => <64 hex>) - remake it with _build/dealer_code_hash.ps1");
  dealer_out(503, false, 'dealer code not set');
}

/* wrong-code tally per address, beside the config file, outside every web root. Cloudflare sits in
   front of the site, so its CF-Connecting-IP header names the visitor when it is there. If the tally
   file cannot be read or written the limit simply does not apply (the wait still does). */
$ip = '';
if (!empty($_SERVER['HTTP_CF_CONNECTING_IP'])) $ip = (string)$_SERVER['HTTP_CF_CONNECTING_IP'];
else if (!empty($_SERVER['REMOTE_ADDR']))      $ip = (string)$_SERVER['REMOTE_ADDR'];
$key   = md5($ip);
$now   = time();
$tally = $cfgDir . '/wb-dealer-fails.json';
$fails = json_decode((string)@file_get_contents($tally), true);
if (!is_array($fails)) $fails = array();
$mine = array();
if (isset($fails[$key]) && is_array($fails[$key])){
  foreach ($fails[$key] as $t){ if ((int)$t > $now - 3600) $mine[] = (int)$t; }
}
if (count($mine) >= $DEALER_FAIL_MAX){
  dealer_log($cfgDir, 'too many wrong dealer codes from ' . $ip . ' (' . count($mine) . ' in the last hour)');
  sleep($DEALER_FAIL_WAIT);
  dealer_out(429, false, 'too many tries');
}

$code = isset($_POST['code']) ? strtolower(trim((string)$_POST['code'])) : '';
$good = ($code !== '' && strlen($code) <= 200)
     && hash_equals(strtolower((string)$CFG['sha256']), hash('sha256', (string)$CFG['salt'] . $code));

if ($good){
  if (isset($fails[$key])){
    unset($fails[$key]);
    @file_put_contents($tally, json_encode($fails), LOCK_EX);
  }
  dealer_out(200, true, '');
}

$mine[] = $now;
$fails[$key] = $mine;
foreach ($fails as $k => $v){
  if (!is_array($v) || count($v) === 0 || max($v) < $now - 3600) unset($fails[$k]);
}
@file_put_contents($tally, json_encode($fails), LOCK_EX);
sleep($DEALER_FAIL_WAIT);
dealer_out(403, false, 'wrong code');
