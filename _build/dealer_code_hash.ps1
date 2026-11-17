<#
  dealer_code_hash.ps1 - makes the server file that holds the Build & Price DEALER code.
  forms/dealer-check.php reads it. Stephen's rulings, 2026-11-17.

  MAKE A NEW CODE (or change it):
      powershell -ExecutionPolicy Bypass -File "<repo>\_build\dealer_code_hash.ps1"
    It asks for the code twice. Type it into THIS window only - never paste it into a chat,
    an email or a file. It writes  %USERPROFILE%\.wb-secrets\.dealercode.php  (outside OneDrive)
    and prints the same lines on screen. That file holds a random salt and the SHA-256 of
    salt + code. The code itself is not in it and cannot be read back out of it.
    Then put that file in the hosting account's HOME directory - the folder that already holds
    .mailsecret.php, NOT inside public_html - named exactly  .dealercode.php

  CHECK A CODE AGAINST A FILE (no PHP needed):
      powershell -ExecutionPolicy Bypass -File "<repo>\_build\dealer_code_hash.ps1" -Check "<path to .dealercode.php>"

  Rules the server applies, so this script applies them too: capital letters do not matter and
  spaces at both ends are ignored. Use plain letters, numbers and ordinary punctuation, at least
  6 characters. The file must have no byte-order mark (this script writes plain ASCII).
#>
param([string]$Check = '')

$ErrorActionPreference = 'Stop'

function Read-DealerCode([string]$prompt){
  $sec = Read-Host -Prompt $prompt -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}
function Get-Sha256Hex([string]$text){
  $hasher = [System.Security.Cryptography.SHA256]::Create()
  try { $bytes = $hasher.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($text)) }
  finally { $hasher.Dispose() }
  return (-join ($bytes | ForEach-Object { $_.ToString('x2') }))
}
function Format-DealerCode([string]$raw){ return $raw.Trim().ToLowerInvariant() }

if ($Check -ne ''){
  if (-not (Test-Path -LiteralPath $Check)) { Write-Host ('No file at ' + $Check) -ForegroundColor Red; exit 1 }
  $txt = [System.IO.File]::ReadAllText($Check)
  $mSalt = [regex]::Match($txt, "'salt'\s*=>\s*'([0-9a-fA-F]+)'")
  $mHash = [regex]::Match($txt, "'sha256'\s*=>\s*'([0-9a-fA-F]{64})'")
  if (-not $mSalt.Success -or -not $mHash.Success) { Write-Host 'That file does not hold a salt and a sha256 line.' -ForegroundColor Red; exit 1 }
  $typed = Format-DealerCode (Read-DealerCode 'Type the dealer code to check')
  $match = (Get-Sha256Hex ($mSalt.Groups[1].Value + $typed)) -eq $mHash.Groups[1].Value.ToLowerInvariant()
  $typed = $null
  if ($match) { Write-Host 'MATCH - that code opens the dealer version with this file.' -ForegroundColor Green; exit 0 }
  Write-Host 'NO MATCH - that code does not fit this file.' -ForegroundColor Red; exit 1
}

$first  = Format-DealerCode (Read-DealerCode 'Type the new dealer code')
$second = Format-DealerCode (Read-DealerCode 'Type it again')
if ($first -ne $second) { $first = $null; $second = $null; Write-Host 'The two did not match. Nothing was written.' -ForegroundColor Red; exit 1 }
$second = $null
if ($first.Length -lt 6) { $first = $null; Write-Host 'Use at least 6 characters. Nothing was written.' -ForegroundColor Red; exit 1 }
if ($first -notmatch '^[\x20-\x7E]+$') { $first = $null; Write-Host 'Use plain letters, numbers and ordinary punctuation only (no accented letters). Nothing was written.' -ForegroundColor Red; exit 1 }

$saltBytes = New-Object byte[] 16
$rng = New-Object System.Security.Cryptography.RNGCryptoServiceProvider
try { $rng.GetBytes($saltBytes) } finally { $rng.Dispose() }
$salt = -join ($saltBytes | ForEach-Object { $_.ToString('x2') })
$digest = Get-Sha256Hex ($salt + $first)
$first = $null

$lines = @(
  '<?php',
  ('/* Build & Price dealer code - made ' + (Get-Date -Format 'yyyy-MM-dd HH:mm') + ' by _build/dealer_code_hash.ps1.'),
  '   Only a salted SHA-256 of the code is here; the code itself is not. Read by forms/dealer-check.php. */',
  'return array(',
  ("  'salt'   => '" + $salt + "',"),
  ("  'sha256' => '" + $digest + "',"),
  ');',
  ''
)
$body = $lines -join "`n"

$dir = Join-Path $env:USERPROFILE '.wb-secrets'
if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
$out = Join-Path $dir '.dealercode.php'
[System.IO.File]::WriteAllText($out, $body, (New-Object System.Text.ASCIIEncoding))

Write-Host ''
Write-Host 'Written (no byte-order mark):' -ForegroundColor Green
Write-Host ('  ' + $out)
Write-Host ''
Write-Host $body
Write-Host 'Next: put this file in the hosting account HOME directory (beside .mailsecret.php,'
Write-Host 'NOT inside public_html), named exactly .dealercode.php - replacing any older one.'
Write-Host 'Do not paste these lines into a chat or an email.'
