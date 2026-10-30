<#
verify_redirects.ps1 - prove the old-URL redirects after a deploy. READ-ONLY: it changes nothing.
PowerShell 5.1, ASCII only. Built 2026-10-29 with _build/redirects/old_urls.tsv.

Run after the push that carries .htaccess has deployed (about 4 minutes):
  powershell -NoProfile -ExecutionPolicy Bypass -File "<Website folder>\_build\redirects\verify_redirects.ps1"

  -OriginIp  the GoDaddy server behind Cloudflare. Left out, it is looked up the way the launch
             check does it (the cPanel host name in Desktop\TASK LISTS\_launch\verify-www.ps1).
             Never write the address into this file: everything under _build/ is served publicly,
             and the address is what lets anyone go around Cloudflare.
  -SkipCloudflare  origin pass only

What it proves, in order (it stops after step 1 if the site is down):
  1. The site still works with .htaccess in place: home page 200, a model page 200, the form handler
     still runs PHP (405 JSON to a GET), a missing page now gets the site's own 404 page (ErrorDocument),
     /contact/index.html now 301s to /contact/ (the old rule finally firing), both apple-touch icons 200,
     and Tyler's sales site still answers 200 (it lives in a folder under ours).
  2. Every REDIRECT / APPROVED row of old_urls.tsv answers 301 with the target in its Location,
     fetched STRAIGHT FROM THE ORIGIN (curl --resolve), so Cloudflare's cache cannot fake a pass.
     Every target is then fetched and must answer 200.
  3. A sample of KEEP-404 and DECIDE rows still answers 404 (nothing redirects that should not).
  4. The same redirects through Cloudflare. An origin 301 that Cloudflare still serves as 404 is a
     cached 404 (the host sends max-age=14400): purge the cache (Caching > Purge Everything) or wait
     4 hours, then run again. Reported as WARN, not FAIL.

IF STEP 1 FAILS WITH 500s EVERYWHERE: the host rejected something in .htaccess. Delete
public_html/.htaccess in cPanel File Manager - the site is back the moment it is gone. A git revert
alone does NOT remove it (the deploy never deletes files).
Exit code = number of FAIL lines.
#>
[CmdletBinding()]
param(
  [string]$OriginIp = '',
  [switch]$SkipCloudflare
)
$ErrorActionPreference = 'Continue'
$script:nFail = 0; $script:nPass = 0; $script:nWarn = 0
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$tsv = Join-Path $here 'old_urls.tsv'
$www = 'https://www.wooldridgeboats.com'
if (-not $OriginIp) {
  $launch = Join-Path ([Environment]::GetFolderPath('Desktop')) 'TASK LISTS\_launch\verify-www.ps1'
  $hostLine = ''
  if (Test-Path -LiteralPath $launch) { $hostLine = (Select-String -LiteralPath $launch -Pattern "Resolve-DnsName '([^']+)'" | Select-Object -First 1) }
  if ($hostLine) {
    $cp = $hostLine.Matches[0].Groups[1].Value
    try { $OriginIp = (Resolve-DnsName $cp -Type A -ErrorAction Stop | Where-Object { $_.Type -eq 'A' } | Select-Object -First 1).IPAddress } catch { $OriginIp = '' }
  }
}
if (-not $OriginIp) { Write-Host '[FAIL] no origin address: pass -OriginIp (the GoDaddy server behind Cloudflare)' -ForegroundColor Red; exit 1 }
Write-Host ('origin found; checking it directly, then through Cloudflare')
$resolve = 'www.wooldridgeboats.com:443:' + $OriginIp

function Report([string]$state, [string]$msg) {
  $color = 'Gray'
  if ($state -eq 'PASS') { $color = 'Green';  $script:nPass++ }
  if ($state -eq 'FAIL') { $color = 'Red';    $script:nFail++ }
  if ($state -eq 'WARN') { $color = 'Yellow'; $script:nWarn++ }
  Write-Host ('[{0}] {1}' -f $state, $msg) -ForegroundColor $color
}
# One request, no redirect following. Returns code, location, content type and the body text.
function Hit([string]$url, [switch]$Origin) {
  $tmp = [System.IO.Path]::GetTempFileName()
  $cargs = @('-sk', '-g', '--max-time', '40', '-A', 'Mozilla/5.0 (WB redirect check)', '-o', $tmp, '-w', '%{http_code}|%{redirect_url}|%{content_type}')
  if ($Origin) { $cargs += @('--resolve', $resolve) }
  $cargs += $url
  $raw = ''
  try { $raw = ((& curl.exe @cargs) | Out-String).Trim() } catch { $raw = '' }
  $parts = $raw.Split('|')
  $text = ''
  if (Test-Path -LiteralPath $tmp) {
    try { $text = [System.IO.File]::ReadAllText($tmp) } catch { $text = '' }
    Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
  }
  $loc = ''; if ($parts.Count -ge 2) { $loc = $parts[1] }
  $ct = ''; if ($parts.Count -ge 3) { $ct = $parts[2] }
  return @{ code = $parts[0]; loc = $loc; ctype = $ct; text = $text }
}
# The Location a target should produce: a /path target comes back absolute on the same host.
function SameTarget([string]$loc, [string]$target) {
  if ($target.StartsWith('/')) { return ($loc -eq ($www + $target)) -or ($loc -eq ('http://www.wooldridgeboats.com' + $target)) -or ($loc -eq $target) }
  return ($loc -eq $target)
}

if (-not (Test-Path -LiteralPath $tsv)) { Report 'FAIL' ('table not found: ' + $tsv); exit 1 }
$rows = @()
$hdr = $null
foreach ($line in [System.IO.File]::ReadAllLines($tsv)) {
  if ($line.StartsWith('#') -or $line.Length -eq 0) { continue }
  $f = $line.Split("`t")
  if ($null -eq $hdr) { $hdr = $f; continue }
  $o = @{}
  for ($i = 0; $i -lt $hdr.Count; $i++) { $v = ''; if ($i -lt $f.Count) { $v = $f[$i] }; $o[$hdr[$i]] = $v }
  $rows += $o
}

Write-Host '--- 1. the site still works with .htaccess in place (origin) ---'
$r = Hit ($www + '/') -Origin
if ($r.code -eq '200') { Report 'PASS' 'home page 200' } else { Report 'FAIL' ('home page answered ' + $r.code + ' - if 500: delete public_html/.htaccess in cPanel NOW'); exit $script:nFail }
$r = Hit ($www + '/models/alaskan/') -Origin
if ($r.code -eq '200') { Report 'PASS' '/models/alaskan/ 200' } else { Report 'FAIL' ('/models/alaskan/ answered ' + $r.code) }
$r = Hit ($www + '/forms/submit.php') -Origin
if ($r.code -eq '405' -and $r.ctype -like 'application/json*') { Report 'PASS' 'form handler still runs PHP (405 JSON to a GET)' } else { Report 'FAIL' ('form handler answered ' + $r.code + ' ' + $r.ctype) }
$r = Hit ($www + '/zzz-redirect-check-missing-page/') -Origin
if ($r.code -eq '404' -and $r.text -match 'Page Not Found') { Report 'PASS' 'a missing page gets the site''s own 404 page (ErrorDocument works)' }
elseif ($r.code -eq '404') { Report 'WARN' 'missing page is 404 but not the site''s 404 page: ErrorDocument not applied' }
else { Report 'FAIL' ('missing page answered ' + $r.code) }
$r = Hit ($www + '/contact/index.html') -Origin
if ($r.code -eq '301' -and (SameTarget $r.loc '/contact/')) { Report 'PASS' '/contact/index.html 301 -> /contact/ (proves the deployed .htaccess is read)' }
else { Report 'FAIL' ('/contact/index.html answered ' + $r.code + ' ' + $r.loc + ' - .htaccess not deployed or not read') }
# Tyler's dealer site lives in a folder under ours, so our .htaccess reaches it too; its rules are held
# to www by a host condition. Before the change (2026-10-29) both of these answered 200.
foreach ($su in @('https://sales.wooldridgeboats.com/', 'https://sales.wooldridgeboats.com/index.html')) {
  $r = Hit $su
  if ($r.code -eq '200') { Report 'PASS' ($su + ' still 200 (sales site untouched)') } else { Report 'FAIL' ($su + ' answered ' + $r.code + ' ' + $r.loc + ' - our .htaccess is reaching the sales site') }
}
foreach ($icon in @('/apple-touch-icon.png', '/apple-touch-icon-precomposed.png')) {
  $r = Hit ($www + $icon) -Origin
  if ($r.code -eq '200' -and $r.ctype -like 'image/png*') { Report 'PASS' ($icon + ' 200 image/png') } else { Report 'FAIL' ($icon + ' answered ' + $r.code + ' ' + $r.ctype) }
}

Write-Host '--- 2. every redirect, straight from the origin, and every target answers 200 ---'
$redir = @($rows | Where-Object { $_['status'] -eq 'REDIRECT' -or $_['status'] -eq 'APPROVED' })
$seen = @{}; $targets = @{}
foreach ($x in $redir) {
  $p = $x['old_path']
  if ($seen.ContainsKey($p)) { continue }; $seen[$p] = 1
  $r = Hit ($www + $p) -Origin
  if ($r.code -eq '301' -and (SameTarget $r.loc $x['target'])) { Report 'PASS' ('301 ' + $p + ' -> ' + $x['target']) }
  else { Report 'FAIL' ($p + ' answered ' + $r.code + ' ' + $r.loc + ' (table says 301 -> ' + $x['target'] + ')') }
  $targets[$x['target']] = 1
}
foreach ($t in $targets.Keys) {
  $u = $t; $orig = $false
  if ($t.StartsWith('/')) { $u = $www + $t; $orig = $true }
  if ($orig) { $r = Hit $u -Origin } else { $r = Hit $u }
  if ($r.code -eq '200') { Report 'PASS' ('target 200 ' + $t) } else { Report 'FAIL' ('target ' + $t + ' answered ' + $r.code + ' ' + $r.loc) }
}

Write-Host '--- 3. rows that must NOT redirect still answer 404 (sample) ---'
$keep = @($rows | Where-Object { ($_['status'] -eq 'KEEP-404' -or $_['status'] -eq 'DECIDE') -and $_['host'] -ne 'apex' } | Select-Object -First 25)
foreach ($x in $keep) {
  $r = Hit ($www + $x['old_path']) -Origin
  if ($r.code -eq '404' -or $r.code -eq '403') { Report 'PASS' ($r.code + ' ' + $x['old_path'] + ' (' + $x['status'] + ')') }
  else { Report 'FAIL' ($x['old_path'] + ' is ' + $x['status'] + ' but answered ' + $r.code + ' ' + $r.loc) }
}

if (-not $SkipCloudflare) {
  Write-Host '--- 4. the same redirects through Cloudflare ---'
  $cached = 0
  foreach ($p in $seen.Keys) {
    $x = $redir | Where-Object { $_['old_path'] -eq $p } | Select-Object -First 1
    $r = Hit ($www + $p)
    if ($r.code -eq '301' -and (SameTarget $r.loc $x['target'])) { $script:nPass++ }
    elseif ($r.code -eq '404') { $cached++; Report 'WARN' ('Cloudflare still serves 404 for ' + $p + ' (cached; origin is right)') }
    else { Report 'FAIL' ('through Cloudflare ' + $p + ' answered ' + $r.code + ' ' + $r.loc) }
  }
  if ($cached -gt 0) { Report 'WARN' ([string]$cached + ' cached 404s: Cloudflare > Caching > Configuration > Purge Everything, then run again') }
  else { Report 'PASS' ('all ' + $seen.Count + ' redirects also answer 301 through Cloudflare') }
}

Write-Host ''
Write-Host ('{0} PASS, {1} WARN, {2} FAIL' -f $script:nPass, $script:nWarn, $script:nFail)
exit $script:nFail
