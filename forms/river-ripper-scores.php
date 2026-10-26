<?php
/* ═══════════════════════════════════════════════════════════════════
   River Ripper — shared top-ten board (Tyler, 2026-10-26)
   ═══════════════════════════════════════════════════════════════════
   The game at /river-ripper/ used to keep its high scores in each
   browser's localStorage, so every computer had its own board. Tyler
   wants customers to see each other's names, so the board lives here.

     GET   -> {"ok":true,"list":[ ...top 10... ]}
     POST  JSON {first,last,score,distance,boat,river,difficulty,run}
           -> {"ok":true,"list":[ ...top 10 after the insert... ]}

   One continuous run (the `run` tag the game makes when a player signs
   at the finish line and keeps going) UPDATES its row rather than adding
   another, same as the game's local board.

   STORAGE lives OUTSIDE every web root, at
       <account home>/wb-river-ripper/scores.json
   (same reasoning and same home-directory derivation as
   forms/sell-your-boat.php), so it cannot be downloaded and a cPanel
   deploy (cp -R, never deletes) can never overwrite it. dev
   (public_html/dev) and production (public_html) share the one board.
   Only if home can't be written does it fall back to
   forms/_river-ripper/ inside the web root, behind a deny-all .htaccess.

   NOT CHEAT-PROOF. Anyone can post a made-up score at this URL; it is a
   game leaderboard, not money. Defences: field validation, a score cap,
   a per-IP rate limit, and a name filter for the obvious bad words
   (offending names become "RIPPER"). If the board ever gets vandalised,
   delete the bad rows from scores.json by hand.
   ═══════════════════════════════════════════════════════════════════ */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

define('RR_KEEP', 50);          /* rows kept on disk (the game shows 10) */
define('RR_SHOW', 10);
define('RR_MAX_SCORE', 5000000);
define('RR_RATE_PER_HOUR', 30); /* posts per IP per hour */

function rr_out($code, $arr) { http_response_code($code); echo json_encode($arr); exit; }

function rr_home_dir() {
  if (empty($_SERVER['DOCUMENT_ROOT'])) return null;
  $doc = rtrim(str_replace('\\', '/', $_SERVER['DOCUMENT_ROOT']), '/');
  $pos = strpos($doc, '/public_html');
  if ($pos === false || $pos === 0) return null;
  return substr($doc, 0, $pos);
}

function rr_data_dir() {
  $home = rr_home_dir();
  if ($home) {
    $d = $home . '/wb-river-ripper';
    if (is_dir($d) || @mkdir($d, 0700, true)) {
      if (is_writable($d)) return $d;
    }
  }
  $d = dirname(__FILE__) . '/_river-ripper';
  if (!is_dir($d)) @mkdir($d, 0700, true);
  if (!file_exists($d . '/.htaccess')) @file_put_contents($d . '/.htaccess',
    "<IfModule mod_authz_core.c>\n  Require all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\n  Order allow,deny\n  Deny from all\n</IfModule>\n");
  return is_writable($d) ? $d : null;
}

function rr_clean_name($s, $max, $allowPunct) {
  $s = strtoupper((string)$s);
  $s = preg_replace($allowPunct ? "/[^A-Z' -]/" : '/[^A-Z ]/', '', $s);
  $s = preg_replace('/\s+/', ' ', $s);
  return trim(substr(trim($s), 0, $max));
}

function rr_clean_text($s, $max) {
  $s = preg_replace("/[^A-Za-z0-9 '\\-·\\.]/u", '', (string)$s);
  return trim(function_exists('mb_substr') ? mb_substr($s, 0, $max) : substr($s, 0, $max));
}

/* The obvious ones only. Checked against the name with spaces and
   punctuation squeezed out, so S H I T and SH-IT are caught too. */
function rr_is_rude($s) {
  $flat = preg_replace('/[^A-Z]/', '', strtoupper($s));
  $bad = array('FUCK','SHIT','CUNT','BITCH','DICK','COCK','PUSSY','ASSHOLE','FAG',
               'NIGG','NIGER','WHORE','SLUT','RAPE','PENIS','VAGINA','TWAT','WANK',
               'KIKE','SPIC','CHINK','RETARD','NAZI','HITLER','BASTARD','DILDO');
  foreach ($bad as $w) { if (strpos($flat, $w) !== false) return true; }
  return false;
}

function rr_sort(&$list) {
  usort($list, function ($a, $b) { return $b['score'] - $a['score']; });
}

function rr_public($list) {
  $out = array();
  foreach (array_slice($list, 0, RR_SHOW) as $e) {
    $out[] = array(
      'name' => $e['name'], 'initial' => $e['initial'], 'score' => $e['score'],
      'distance' => $e['distance'], 'boat' => $e['boat'], 'river' => $e['river'],
      'difficulty' => $e['difficulty'], 'date' => $e['date'], 'run' => $e['run']
    );
  }
  return $out;
}

$dir = rr_data_dir();
if (!$dir) rr_out(500, array('ok' => false, 'error' => 'storage'));
$file = $dir . '/scores.json';

/* ---- read ------------------------------------------------------------ */
$fh = @fopen($file, 'c+');
if (!$fh) rr_out(500, array('ok' => false, 'error' => 'storage'));

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
  flock($fh, LOCK_SH);
  $raw = stream_get_contents($fh);
  flock($fh, LOCK_UN); fclose($fh);
  $list = json_decode($raw ? $raw : '[]', true);
  if (!is_array($list)) $list = array();
  rr_out(200, array('ok' => true, 'list' => rr_public($list)));
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') { fclose($fh); rr_out(405, array('ok' => false, 'error' => 'GET or POST')); }

/* ---- validate -------------------------------------------------------- */
$in = json_decode((string)@file_get_contents('php://input'), true);
if (!is_array($in)) { fclose($fh); rr_out(400, array('ok' => false, 'error' => 'json')); }

$first = rr_clean_name(isset($in['first']) ? $in['first'] : '', 12, false);
$last  = rr_clean_name(isset($in['last'])  ? $in['last']  : '', 14, true);
$score = isset($in['score']) ? (int)$in['score'] : 0;
$dist  = isset($in['distance']) ? max(0, (int)$in['distance']) : 0;
$run   = preg_replace('/[^a-z0-9]/', '', strtolower(isset($in['run']) ? (string)$in['run'] : ''));
$run   = substr($run, 0, 24);
if ($first === '' || $score < 500 || $score > RR_MAX_SCORE || $run === '') {
  fclose($fh); rr_out(400, array('ok' => false, 'error' => 'invalid'));
}
if (rr_is_rude($first . ' ' . $last)) { $first = 'RIPPER'; $last = ''; }

/* ---- rate limit ------------------------------------------------------ */
$ip = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '0';
$rateFile = $dir . '/rate.json';
$rate = json_decode((string)@file_get_contents($rateFile), true);
if (!is_array($rate)) $rate = array();
$now = time(); $key = md5($ip);
$hits = isset($rate[$key]) ? array_filter($rate[$key], function ($t) use ($now) { return $t > $now - 3600; }) : array();
if (count($hits) >= RR_RATE_PER_HOUR) { fclose($fh); rr_out(429, array('ok' => false, 'error' => 'slow down')); }
$hits[] = $now; $rate[$key] = array_values($hits);
foreach ($rate as $k => $v) { if (max($v) < $now - 3600) unset($rate[$k]); }
@file_put_contents($rateFile, json_encode($rate), LOCK_EX);

/* ---- write ----------------------------------------------------------- */
flock($fh, LOCK_EX);
$raw = stream_get_contents($fh);
$list = json_decode($raw ? $raw : '[]', true);
if (!is_array($list)) $list = array();

$found = false;
foreach ($list as $i => $e) {
  if (isset($e['run']) && $e['run'] === $run) {
    $found = true;
    if ($score > $e['score']) {
      $list[$i]['score'] = $score;
      $list[$i]['distance'] = $dist;
      $list[$i]['river'] = rr_clean_text(isset($in['river']) ? $in['river'] : '', 40);
    }
    break;
  }
}
if (!$found) {
  $list[] = array(
    'name' => $first, 'initial' => $last, 'score' => $score, 'distance' => $dist,
    'boat' => rr_clean_text(isset($in['boat']) ? $in['boat'] : '', 40),
    'river' => rr_clean_text(isset($in['river']) ? $in['river'] : '', 40),
    'difficulty' => rr_clean_text(isset($in['difficulty']) ? $in['difficulty'] : '', 12),
    'date' => date('n/j/y'), 'run' => $run
  );
}
rr_sort($list);
$list = array_slice($list, 0, RR_KEEP);

ftruncate($fh, 0); rewind($fh);
fwrite($fh, json_encode($list));
fflush($fh);
flock($fh, LOCK_UN); fclose($fh);

rr_out(200, array('ok' => true, 'list' => rr_public($list)));
