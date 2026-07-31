# =============================================================================
# sync_sales_tools.ps1 - transpose Tyler's SALES TOOLS media library into the
#                        website's assets\photos\<slug>\ folders.
#
# THE PIPELINE (decided by Stephen 2026-07-31):
#   1. Tyler curates photos in the SALES TOOLS SharePoint library:
#         ...\Wooldridge Boats Inc_ - Documents\SALES TOOLS\PRODUCT PHOTOS\...
#      That library is CANONICAL and READ-ONLY to this script. It never
#      writes, renames, or reorganizes anything there.
#   2. THIS SCRIPT copies each mapped folder's JPEGs into the repo:
#      web-sized (1600px long edge, q82) into assets\photos\<slug>\ and
#      thumbnails (640px long edge, q80) into assets\photos\<slug>\thumbs\,
#      renamed into the site's filename grammar that build_gallery.pl parses:
#         [hull#|year]-[len]-[cfg]-[shot]-[extras]-[idx].jpg
#   3. Provenance is recorded in assets\photos\_media-manifest.json and
#      published as assets\media-provenance.js (window.WB_VETTED) - the
#      site fades any gallery photo NOT in that vetted set (media-fade.js).
#   4. Idempotent and re-runnable forever: unchanged sources are skipped,
#      removed sources are pruned (derived files only - never Tyler's),
#      and photos this script never made are NEVER deleted (untracked
#      placeholders stay on the site and render faded, not removed).
#   5. Stephen reviews, commits, pushes. An agent never pushes.
#
# PowerShell 5.1, ASCII only. Resizing is System.Drawing (EXIF orientation
# honored, then stripped by re-encode - same proven code as sync_shop_live).
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File _build\sync_sales_tools.ps1
#     -Source <label>    tag for the run log (manual / scheduled / ...)
#     -NoChain           skip the build_gallery.pl + stamp_assets.pl chain
#     -WhatIf            report what would happen, write nothing
#     -SalesTools <path> override the SALES TOOLS root (testing)
# =============================================================================
param(
  [string]$Source = 'manual',
  [switch]$NoChain,
  [switch]$WhatIf,
  [string]$SalesTools = ''
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

# =============================================================================
# THE CROSSWALK - Stephen-editable.
#
# Maps a SALES TOOLS folder (relative to the SALES TOOLS root) to a website
# model slug (assets\photos\<slug>). Fields:
#   Folder    - source folder, relative to SALES TOOLS  (required)
#   Slug      - destination assets\photos\<slug>        (required)
#   Len       - boat length; injected into the filename when the filename
#               itself carries no length token           (required)
#   Extra     - extra token appended after the shot token (e.g. 'aft' for
#               the aft-cabin XL IB, so its files do not collide)
#   InjectLen - $false means NEVER inject Len into the filename (the
#               agency-lc29 grammar carries no length - the slug does)
#   IdxTrimZeros - $true strips leading zeros from Tyler's index number
#               ("01" -> "1"). Used for the 5333 build so the transposed
#               names REPLACE the existing placeholder files (which are
#               unpadded) instead of duplicating them.
#
# Any SALES TOOLS photo folder NOT listed here is reported as UNMAPPED and
# skipped - the script never guesses a mapping.
# =============================================================================
$CROSSWALK = @(
  @{ Folder = 'PRODUCT PHOTOS\2026-16-ALASKAN LT';        Slug = 'alaskan-lt';         Len = 16 }
  @{ Folder = 'PRODUCT PHOTOS\2026-18-ALASKAN LT';        Slug = 'alaskan-lt';         Len = 18 }
  @{ Folder = 'PRODUCT PHOTOS\2026-20-ALASKAN LT';        Slug = 'alaskan-lt';         Len = 20 }
  @{ Folder = 'PRODUCT PHOTOS\2026-18-ALASKAN';           Slug = 'alaskan';            Len = 18 }
  @{ Folder = 'PRODUCT PHOTOS\2026-20-ALASKAN XL';        Slug = 'alaskanxl';          Len = 20 }
  @{ Folder = 'PRODUCT PHOTOS\2026-20-ALASKAN XLT';       Slug = 'alaskan-xlt';        Len = 20 }
  @{ Folder = 'PRODUCT PHOTOS\2026-20-ALASKAN XL IB';     Slug = 'alaskan-xl-inboard'; Len = 20 }
  @{ Folder = 'PRODUCT PHOTOS\2026-21-AFT-ALASKAN XL IB'; Slug = 'alaskan-xl-inboard'; Len = 21; Extra = 'aft' }
  @{ Folder = 'PRODUCT PHOTOS\2026-19-SCOUT';             Slug = 'scout';              Len = 19 }
  @{ Folder = 'PRODUCT PHOTOS\2025-21-SCOUT';             Slug = 'scout';              Len = 21 }
  @{ Folder = 'PRODUCT PHOTOS\2026-21-SCOUT WIDEBODY';    Slug = 'scout-widebody';     Len = 21 }
  @{ Folder = 'PRODUCT PHOTOS\2026-21-SKAGIT-X';          Slug = 'skagit-x';           Len = 21 }
  @{ Folder = 'PRODUCT PHOTOS\2026-23-SSD OBJ';           Slug = 'supersportdrifter';  Len = 23 }
  @{ Folder = 'PRODUCT PHOTOS\2025-21-LC-129';            Slug = 'landing-craft';      Len = 21 }
  @{ Folder = 'BUILD PHOTOS\2026-29-LC 12104-5333-BUILD'; Slug = 'agency-lc29';        Len = 29; InjectLen = $false; IdxTrimZeros = $true }
)

# Which top-level SALES TOOLS folders hold photo folders (scanned for UNMAPPED)
$PHOTO_PARENTS = @('PRODUCT PHOTOS', 'BUILD PHOTOS')

# Filename token vocabulary (matches what build_gallery.pl parses)
$CFG_MAP   = @{ 'CC' = 'cc'; 'WS' = 'ws'; 'TILLER' = 'tiller'; 'FIRST RESPONDER' = 'first-responder' }
$SHOT_MAP  = @{ 'PRODUCT' = 'product'; 'PHOTO' = 'photo'; 'WATER' = 'water'; 'DELIVERY' = 'delivery'; 'FINISH' = 'finish'; 'BUILD' = 'build' }
$COLORS    = @('BLUE','RED','BLACK','WHITE','GREEN','GRAY','GREY','SILVER','YELLOW','ORANGE','TAN','GOLD')
# Model-name tokens are DROPPED - the destination folder already carries the model
$DROP_TOKENS = @('AK','AK LT','AK XL','AK XLT','AK XL IB','LT','XL','XLT','IB','OBJ','SSD','LC',
                 'SKAGIT','SKAGIT X','SCOUT','SCOUT WIDEBODY','WIDEBODY','ALASKAN','ALASKAN LT',
                 'ALASKAN XL','ROGUE','SPORT','SPORTSTER','DRIFTER','LANDING CRAFT')

# ---- locate the site (script-relative; never hardcode the parent's name) ----
$Site = Split-Path $PSScriptRoot -Parent
if (-not (Test-Path (Join-Path $Site 'index.html'))) { throw "site root not found from $PSScriptRoot" }
$PhotoRoot    = Join-Path $Site 'assets\photos'
$ManifestPath = Join-Path $PhotoRoot '_media-manifest.json'
$ProvPath     = Join-Path $Site 'assets\media-provenance.js'
$LogPath      = Join-Path $Site '_build\media-sync.log'

# ---- locate SALES TOOLS (discover, never hardcode - the OneDrive root moved
#      once already; same pattern as sync_shop_live.ps1) ----
if (-not $SalesTools) {
  $candidates = @()
  foreach ($od in @($env:OneDriveCommercial, (Join-Path $env:USERPROFILE 'OneDrive - Wooldridge Boats Inc'))) {
    if ($od -and (Test-Path $od)) {
      $candidates += Get-ChildItem -LiteralPath $od -Directory -ErrorAction SilentlyContinue |
        ForEach-Object { Join-Path $_.FullName 'SALES TOOLS' }
    }
  }
  $SalesTools = $candidates | Where-Object { Test-Path (Join-Path $_ 'PRODUCT PHOTOS') } | Select-Object -First 1
  if (-not $SalesTools) { throw 'SALES TOOLS with PRODUCT PHOTOS not found under OneDrive; pass -SalesTools' }
}
Write-Output ("site        : " + $Site)
Write-Output ("sales tools : " + $SalesTools + "  (READ-ONLY canonical source)")
Write-Output ("mode        : " + $(if ($WhatIf) { 'WHAT-IF (no writes)' } else { 'live' }) + "  source=" + $Source)

# ---- helpers ----------------------------------------------------------------
# EXIF orientation (tag 0x0112) -> RotateFlip, so phone shots land upright.
# Re-encoding also strips EXIF, so no GPS or device metadata ships.
function Save-WebJpeg([string]$srcPath, [string]$dstPath, [int]$maxEdge, [int]$quality) {
  $img = [System.Drawing.Image]::FromFile($srcPath)
  try {
    if ($img.PropertyIdList -contains 0x0112) {
      $o = $img.GetPropertyItem(0x0112).Value[0]
      switch ($o) {
        3 { $img.RotateFlip([System.Drawing.RotateFlipType]::Rotate180FlipNone) }
        6 { $img.RotateFlip([System.Drawing.RotateFlipType]::Rotate90FlipNone) }
        8 { $img.RotateFlip([System.Drawing.RotateFlipType]::Rotate270FlipNone) }
      }
    }
    $w = $img.Width; $h = $img.Height
    $long = [Math]::Max($w, $h)
    if ($long -gt $maxEdge) {
      $scale = $maxEdge / $long
      $w = [int][Math]::Round($img.Width * $scale)
      $h = [int][Math]::Round($img.Height * $scale)
    }
    $bmp = New-Object System.Drawing.Bitmap $w, $h
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($img, 0, 0, $w, $h)
    $g.Dispose()
    $enc = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
    $ep = New-Object System.Drawing.Imaging.EncoderParameters 1
    $ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]$quality)
    $bmp.Save($dstPath, $enc, $ep)
    $bmp.Dispose()
  } finally { $img.Dispose() }
}

function Json-Esc([string]$s) { return ($s -replace '\\', '\\' -replace '"', '\"') }

# Parse one of Tyler's filenames into the site grammar. Returns the new name,
# or $null (with a reason in $script:parseWarn) when the name cannot be parsed.
function Get-DestName($row, [string]$fileName) {
  $script:parseWarn = ''
  $stem = $fileName -replace '\.jpe?g$', ''
  if ($stem -eq $fileName) { $script:parseWarn = 'not a .jpg/.jpeg'; return $null }
  $tokens = @($stem -split '-')
  # trailing number = Tyler's curation index. Kept verbatim (leading zeros too)
  # unless the crosswalk row says IdxTrimZeros.
  $idx = $null
  if ($tokens.Count -gt 0 -and $tokens[$tokens.Count - 1] -match '^\d+$') {
    $idx = $tokens[$tokens.Count - 1]
    if ($tokens.Count -gt 1) { $tokens = @($tokens[0..($tokens.Count - 2)]) } else { $tokens = @() }
  }
  if ($null -eq $idx) { $script:parseWarn = 'no trailing index number'; return $null }
  if ($row.IdxTrimZeros) { $idx = [string]([int]$idx) }
  # leading 4xxx/5xxx = hull number
  $hull = $null
  if ($tokens.Count -gt 0 -and $tokens[0] -match '^[45]\d{3}$') {
    $hull = $tokens[0]
    $tokens = @($(if ($tokens.Count -gt 1) { $tokens[1..($tokens.Count - 1)] } else { @() }))
  }
  $len = $null; $cfgs = @(); $shot = $null; $extras = @()
  foreach ($t in $tokens) {
    $u = $t.Trim().ToUpper()
    if ($u -eq '') { continue }
    if ($null -eq $len -and $u -match '^(1[4-9]|2[0-9]|3[0-2])$') { $len = $u; continue }
    if ($CFG_MAP.ContainsKey($u))  { $cfgs += $CFG_MAP[$u]; continue }
    if ($SHOT_MAP.ContainsKey($u)) { if ($null -eq $shot) { $shot = $SHOT_MAP[$u] }; continue }
    if ($DROP_TOKENS -contains $u) { continue }
    if ($COLORS -contains $u)      { $extras += $u.ToLower(); continue }
    # unknown token: keep it (lowercased) so nothing is silently lost, but flag it
    $extras += $u.ToLower()
    $script:parseWarn = "unknown token '$t' kept as extra"
  }
  # identity: hull if present, else the source folder's year
  $identity = $hull
  if ($null -eq $identity) { $identity = [string]$row.Year }
  # length: from the filename, else injected from the crosswalk (unless disabled)
  $lenPart = $len
  if ($null -eq $lenPart -and $row.InjectLen -ne $false) { $lenPart = [string]$row.Len }
  $parts = @($identity)
  if ($lenPart) { $parts += $lenPart }
  $parts += $cfgs
  if ($shot) { $parts += $shot }
  $parts += $extras
  if ($row.Extra) { $parts += ([string]$row.Extra).ToLower() }
  $parts += $idx
  return ((($parts -join '-').ToLower()) + '.jpg')
}

# ---- read the manifest -------------------------------------------------------
$oldEntries = @{}
if (Test-Path -LiteralPath $ManifestPath) {
  $doc = Get-Content -LiteralPath $ManifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
  if ($doc.entries) {
    foreach ($prop in $doc.entries.PSObject.Properties) {
      $oldEntries[$prop.Name] = @{
        src      = [string]$prop.Value.src
        bytes    = [long]$prop.Value.bytes
        mtimeUtc = [string]$prop.Value.mtimeUtc
      }
    }
  }
  Write-Output ("manifest    : " + $oldEntries.Count + " tracked entries")
} else {
  Write-Output "manifest    : none yet (first run)"
}

# ---- scan for UNMAPPED photo folders -----------------------------------------
$mappedFolders = @($CROSSWALK | ForEach-Object { $_.Folder })
$unmapped = @()
foreach ($parent in $PHOTO_PARENTS) {
  $pp = Join-Path $SalesTools $parent
  if (-not (Test-Path -LiteralPath $pp)) { continue }
  Get-ChildItem -LiteralPath $pp -Directory | ForEach-Object {
    $rel = $parent + '\' + $_.Name
    if ($mappedFolders -notcontains $rel) { $unmapped += $rel }
  }
}

# ---- pass 1: enumerate + name every source file, detect collisions ----------
$plans = @()      # one record per source file
$destSeen = @{}   # destKey -> source rel path (collision detection)
$collisions = @()
$parseSkips = @()
foreach ($row in $CROSSWALK) {
  $srcDir = Join-Path $SalesTools $row.Folder
  if (-not (Test-Path -LiteralPath $srcDir)) {
    Write-Output ("MISSING  crosswalk folder not on disk, skipped: " + $row.Folder)
    continue
  }
  # the folder's year = leading 4 digits of its name (used when no hull number)
  $row.Year = 0
  $leaf = Split-Path $row.Folder -Leaf
  if ($leaf -match '^(20\d\d)\b') { $row.Year = [int]$Matches[1] }
  $files = @(Get-ChildItem -LiteralPath $srcDir -File | Where-Object { $_.Extension -match '^\.(jpe?g)$' } | Sort-Object Name)
  foreach ($f in $files) {
    $dest = Get-DestName $row $f.Name
    $srcRel = $row.Folder + '\' + $f.Name
    if ($null -eq $dest) {
      $parseSkips += ($srcRel + '  (' + $script:parseWarn + ')')
      continue
    }
    if ($script:parseWarn) { Write-Output ("WARN  " + $srcRel + ': ' + $script:parseWarn) }
    $destKey = $row.Slug + '/' + $dest
    if ($destSeen.ContainsKey($destKey)) {
      $collisions += ($destKey + "`n        <- " + $destSeen[$destKey] + "`n        <- " + $srcRel)
      continue
    }
    $destSeen[$destKey] = $srcRel
    $plans += @{
      Row = $row; File = $f; SrcRel = $srcRel; DestKey = $destKey; DestName = $dest
    }
  }
}
if ($collisions.Count -gt 0) {
  Write-Output ''
  Write-Output 'HARD ERROR - two different source files map to the same destination name.'
  Write-Output 'Nothing was written. Fix the names (or the crosswalk) and re-run.'
  $collisions | ForEach-Object { Write-Output ('  ' + $_) }
  throw ('destination name collision(s): ' + $collisions.Count)
}

# ---- pass 2: transpose -------------------------------------------------------
$added = @(); $updated = @(); $replaced = @(); $current = 0; $errors = @()
$newEntries = @{}
foreach ($plan in $plans) {
  $slugDir  = Join-Path $PhotoRoot $plan.Row.Slug
  $thumbDir = Join-Path $slugDir 'thumbs'
  $webPath  = Join-Path $slugDir $plan.DestName
  $thPath   = Join-Path $thumbDir $plan.DestName
  $srcBytes = [long]$plan.File.Length
  $srcMtime = $plan.File.LastWriteTimeUtc.ToString('o')
  $prev = $null
  if ($oldEntries.ContainsKey($plan.DestKey)) { $prev = $oldEntries[$plan.DestKey] }
  $entry = @{ src = $plan.SrcRel; bytes = $srcBytes; mtimeUtc = $srcMtime }
  # idempotency: unchanged source + both derived files on disk = skip
  if ($null -ne $prev -and $prev.bytes -eq $srcBytes -and $prev.mtimeUtc -eq $srcMtime -and
      (Test-Path -LiteralPath $webPath) -and (Test-Path -LiteralPath $thPath)) {
    $current++
    $newEntries[$plan.DestKey] = $entry
    continue
  }
  $kind = 'ADDED'
  if ($null -ne $prev) { $kind = 'UPDATED' }
  elseif ((Test-Path -LiteralPath $webPath) -or (Test-Path -LiteralPath $thPath)) { $kind = 'REPLACED' }
  if ($WhatIf) {
    Write-Output ("WOULD " + $kind.PadRight(8) + ' ' + $plan.DestKey + '  <- ' + $plan.SrcRel)
    $newEntries[$plan.DestKey] = $entry
    switch ($kind) {
      'ADDED'    { $added += $plan.DestKey }
      'UPDATED'  { $updated += $plan.DestKey }
      'REPLACED' { $replaced += $plan.DestKey }
    }
    continue
  }
  try {
    New-Item -ItemType Directory -Path $thumbDir -Force | Out-Null
    Save-WebJpeg $plan.File.FullName $webPath 1600 82
    Save-WebJpeg $plan.File.FullName $thPath 640 80
    $newEntries[$plan.DestKey] = $entry
    switch ($kind) {
      'ADDED'    { $added += $plan.DestKey }
      'UPDATED'  { $updated += $plan.DestKey }
      'REPLACED' { $replaced += ($plan.DestKey + '  <- ' + $plan.SrcRel) }
    }
  } catch {
    $errors += ($plan.SrcRel + '  (' + $_.Exception.Message + ')')
    # stay atomic per photo: no manifest entry, no half pair
    foreach ($p in @($webPath, $thPath)) {
      if ((Test-Path -LiteralPath $p) -and $null -eq $prev) { Remove-Item -LiteralPath $p -Force -Confirm:$false -ErrorAction SilentlyContinue }
    }
  }
}

# ---- prune: manifest entries whose SOURCE vanished from SALES TOOLS ----------
# Only files this script created (= in the manifest) are ever deleted.
$pruned = @()
foreach ($key in @($oldEntries.Keys)) {
  if ($newEntries.ContainsKey($key)) { continue }
  # a stale key means the source vanished from SALES TOOLS - or it still exists
  # but maps to a different name now (crosswalk/grammar change). Either way the
  # old derived files are orphans: prune them. Tyler's originals are untouched.
  $slugPart, $filePart = $key -split '/', 2
  $webPath = Join-Path (Join-Path $PhotoRoot $slugPart) $filePart
  $thPath  = Join-Path (Join-Path (Join-Path $PhotoRoot $slugPart) 'thumbs') $filePart
  if ($WhatIf) {
    Write-Output ("WOULD PRUNE   " + $key + '  (source gone: ' + $oldEntries[$key].src + ')')
  } else {
    foreach ($p in @($webPath, $thPath)) {
      if (Test-Path -LiteralPath $p) { Remove-Item -LiteralPath $p -Force -Confirm:$false }
    }
  }
  $pruned += ($key + '  (source was: ' + $oldEntries[$key].src + ')')
}

# ---- write manifest + provenance ---------------------------------------------
$changeCount = $added.Count + $updated.Count + $replaced.Count + $pruned.Count
$sortedKeys = @($newEntries.Keys | Sort-Object { $_ } )
if (-not $WhatIf) {
  $nowIso = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
  $sb = New-Object System.Text.StringBuilder
  [void]$sb.Append('{' + "`n")
  [void]$sb.Append('  "version": 1,' + "`n")
  [void]$sb.Append('  "generated": "' + $nowIso + '",' + "`n")
  [void]$sb.Append('  "entries": {' + "`n")
  $i = 0
  foreach ($key in $sortedKeys) {
    $i++
    $e = $newEntries[$key]
    $comma = ','
    if ($i -eq $sortedKeys.Count) { $comma = '' }
    [void]$sb.Append('    "' + (Json-Esc $key) + '": { "src": "' + (Json-Esc $e.src) + '", "bytes": ' + $e.bytes + ', "mtimeUtc": "' + $e.mtimeUtc + '" }' + $comma + "`n")
  }
  [void]$sb.Append('  }' + "`n" + '}' + "`n")
  [IO.File]::WriteAllText($ManifestPath, $sb.ToString(), (New-Object System.Text.UTF8Encoding($false)))

  $pairs = @($sortedKeys | ForEach-Object { '"' + (Json-Esc $_) + '":1' })
  $prov = '// Generated by _build/sync_sales_tools.ps1 - do not hand-edit; re-run instead.' + "`n" +
          'window.WB_VETTED = {' + ($pairs -join ',') + '};' + "`n"
  [IO.File]::WriteAllText($ProvPath, $prov, (New-Object System.Text.UTF8Encoding($false)))
}

# ---- report -------------------------------------------------------------------
Write-Output ''
Write-Output ("ADDED    : " + $added.Count)
Write-Output ("UPDATED  : " + $updated.Count)
Write-Output ("REPLACED : " + $replaced.Count)
if ($replaced.Count -gt 0) { $replaced | ForEach-Object { Write-Output ('  REPLACED ' + $_) } }
Write-Output ("current  : " + $current + ' (unchanged, skipped)')
Write-Output ("PRUNED   : " + $pruned.Count)
if ($pruned.Count -gt 0) { $pruned | ForEach-Object { Write-Output ('  PRUNED ' + $_) } }
Write-Output ("UNMAPPED : " + $unmapped.Count)
if ($unmapped.Count -gt 0) { $unmapped | ForEach-Object { Write-Output ('  UNMAPPED ' + $_ + '  (not in the crosswalk - skipped, never guessed)') } }
if ($parseSkips.Count -gt 0) {
  Write-Output ("UNPARSED : " + $parseSkips.Count)
  $parseSkips | ForEach-Object { Write-Output ('  UNPARSED ' + $_) }
}
if ($errors.Count -gt 0) {
  Write-Output ("ERRORS   : " + $errors.Count)
  $errors | ForEach-Object { Write-Output ('  ERROR ' + $_) }
}
Write-Output ("tracked  : " + $sortedKeys.Count + ' vetted photos in the manifest')

if ($changeCount -eq 0 -and $errors.Count -eq 0) {
  Write-Output ''
  Write-Output 'nothing new from SALES TOOLS'
}

# ---- run log -------------------------------------------------------------------
if (-not $WhatIf) {
  $stamp = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
  $line = ($stamp + ' source=' + $Source + ' added=' + $added.Count + ' updated=' + $updated.Count +
           ' replaced=' + $replaced.Count + ' current=' + $current + ' pruned=' + $pruned.Count +
           ' unmapped=' + $unmapped.Count + ' unparsed=' + $parseSkips.Count + ' errors=' + $errors.Count +
           ' tracked=' + $sortedKeys.Count)
  Add-Content -LiteralPath $LogPath -Value $line -Encoding ASCII
}

# ---- chain: regenerate the gallery + restamp asset hashes ----------------------
if ($changeCount -gt 0 -and -not $NoChain -and -not $WhatIf) {
  $perl = 'C:\Program Files\Git\usr\bin\perl.exe'
  if (-not (Test-Path -LiteralPath $perl)) {
    $pc = Get-Command perl -ErrorAction SilentlyContinue
    if ($pc) { $perl = $pc.Source } else { Write-Output 'CHAIN SKIPPED: perl not found'; $perl = $null }
  }
  if ($perl) {
    Write-Output ''
    Write-Output '--- chain: build_gallery.pl ---'
    & $perl (Join-Path $Site '_build\build_gallery.pl')
    Write-Output '--- chain: stamp_assets.pl ---'
    & $perl (Join-Path $Site '_build\stamp_assets.pl') $Site
    Write-Output '--- chain done. Review with git status; Stephen commits and pushes. ---'
  }
}
