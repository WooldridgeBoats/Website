# =============================================================================
# sync_shop_live.ps1 - publish SiteLive builds into the home page's
#                      "In The Shop Right Now" section.
#
# THE PIPELINE (decided by Stephen 2026-07-30):
#   1. An admin flips "Show on website" on a build card in the Build Hub.
#      That sets SiteLive:true / SiteLiveAt on the build in LIVE BUILDS.json.
#      It STAGES only - nothing is public yet.
#   2. Staff drop the shots they want public into the build's picks folder:
#         <build folder>\PHOTOS\<SO>-WEBSITE\      (this script creates it)
#      Only photos in that folder ever publish. Never the BUILD/DUMP folders.
#   3. THIS SCRIPT (run it from the repo root, or via the /shop-live command):
#      finds every SiteLive build, web-sizes its picks into
#      assets\photos\shop-<SO>\ (+thumbs\), and regenerates the section
#      between the SHOP-LIVE markers in index.html: one compact carousel row
#      per build, newest toggle first. Clicking a photo opens the shared
#      full-screen gallery (gallery.js wblb) - that is the "pop out".
#   4. Stephen reviews, commits, pushes. cPanel deploys.
#
# PRIVACY: customer names NEVER reach the page. Rows are titled
# "HULL #<SO> - <LEN>' <MODEL>". FolderName (which contains the customer)
# is used only to locate the folder on disk. Re-encoding via System.Drawing
# also strips EXIF, so no GPS or device metadata ships either.
#
# ZERO LIVE BUILDS = NO-OP by design: the section keeps whatever it has
# (today, the static Hull #5333 gallery) rather than silently emptying the
# home page. Turning the section off is a decision, not a side effect.
#
# PowerShell 5.1, ASCII only. No Node, no ImageMagick - resizing is
# System.Drawing (verified on this machine 2026-07-30, incl. EXIF rotation).
#
#   powershell -ExecutionPolicy Bypass -File _build\sync_shop_live.ps1
#   ... -Check                 report only, change nothing
#   ... -LiveJson <path>       override LIVE BUILDS.json (testing)
#   ... -MastersRoot <path>    override BUILD MASTERS    (testing)
# =============================================================================
param(
  [switch]$Check,
  [string]$LiveJson = '',
  [string]$MastersRoot = ''
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

# ---- locate the site (script-relative; never hardcode the parent's name) ----
$Site = Split-Path $PSScriptRoot -Parent
if (-not (Test-Path (Join-Path $Site 'index.html'))) { throw "site root not found from $PSScriptRoot" }

# ---- locate BUILD MASTERS (discover, never hardcode - the OneDrive root
#      moved once already and the SharePoint library name carries a mangled
#      underscore that invites typos) ----
if (-not $MastersRoot) {
  $candidates = @()
  foreach ($od in @($env:OneDriveCommercial, (Join-Path $env:USERPROFILE 'OneDrive - Wooldridge Boats Inc'))) {
    if ($od -and (Test-Path $od)) {
      $candidates += Get-ChildItem -LiteralPath $od -Directory -ErrorAction SilentlyContinue |
        ForEach-Object { Join-Path $_.FullName 'BUILD HUB\BUILD MASTERS' }
    }
  }
  $MastersRoot = $candidates | Where-Object { Test-Path (Join-Path $_ 'LIVE BUILDS.json') } | Select-Object -First 1
  if (-not $MastersRoot) { throw 'BUILD MASTERS with LIVE BUILDS.json not found under OneDrive; pass -MastersRoot' }
}
if (-not $LiveJson) { $LiveJson = Join-Path $MastersRoot 'LIVE BUILDS.json' }
Write-Output ("masters : " + $MastersRoot)
Write-Output ("live    : " + $LiveJson)

# ---- read the board ----
$doc = Get-Content -LiteralPath $LiveJson -Raw -Encoding UTF8 | ConvertFrom-Json
$live = @($doc.builds | Where-Object { $_.SiteLive -eq $true -and $_.Status -eq 'IN PROCESS' })
$live = @($live | Sort-Object -Property @{Expression={ if ($_.SiteLiveAt) { [double]$_.SiteLiveAt } else { 0 } }} -Descending)
Write-Output ("SiteLive builds: " + $live.Count)
if ($live.Count -eq 0) {
  Write-Output 'Nothing is toggled live - leaving index.html untouched (no-op by design).'
  exit 0
}

# ---- helpers ----
function TitleCase([string]$s) {
  $t = ($s -replace '\s+',' ').Trim().ToLower()
  if ($t -eq '') { return '' }
  return ($t.Split(' ') | ForEach-Object { if ($_.Length -gt 0) { $_.Substring(0,1).ToUpper() + $_.Substring(1) } }) -join ' '
}
function HtmlEsc([string]$s) {
  return $s -replace '&','&amp;' -replace '<','&lt;' -replace '>','&gt;' -replace '"','&quot;'
}
# EXIF orientation (tag 0x0112) -> RotateFlip, so phone shots land upright
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

# ---- per-build: locate picks, resize, build the row ----
$catDirs = Get-ChildItem -LiteralPath (Join-Path $MastersRoot 'IN PROCESS BUILDS') -Directory
$rows = @()
$activeSOs = @()
$report = @()
foreach ($b in $live) {
  $so = [string]$b.SO
  $label = "SO $so"
  # find the build folder by NAME across every category - discover, never map.
  # DiskFolder is the build's ACTUAL on-disk name and the source of truth for folder
  # operations since the Build Hub delivery-seam fix (2026-08-04); FolderName is the
  # card's display name. They are identical except in the window after a failed rename,
  # where FolderName alone would make this sync skip a live build. Try both. (2026-08-05)
  $names = @()
  foreach ($n in @([string]$b.DiskFolder, [string]$b.FolderName)) {
    if ($n -and ($names -notcontains $n)) { $names += $n }
  }
  $bf = $null
  foreach ($nm in $names) {
    foreach ($cd in $catDirs) {
      $p = Join-Path $cd.FullName $nm
      if (Test-Path -LiteralPath $p) { $bf = $p; break }
    }
    if ($bf) { break }
  }
  if (-not $bf) { $report += "SKIP  $label - folder '$($names -join "' / '")' not found under IN PROCESS BUILDS"; continue }
  # photo parent: PHOTOS or <SO>-PHOTOS, whichever the build has
  $photoParent = $null
  foreach ($n in @("$so-PHOTOS", 'PHOTOS')) {
    $p = Join-Path $bf $n
    if (Test-Path -LiteralPath $p) { $photoParent = $p; break }
  }
  if (-not $photoParent) {
    $photoParent = Join-Path $bf 'PHOTOS'
    if (-not $Check) { New-Item -ItemType Directory -Path $photoParent -Force | Out-Null }
  }
  # the picks folder - create it so staff always have a target
  $picks = $null
  foreach ($n in @("$so-WEBSITE", 'WEBSITE')) {
    $p = Join-Path $photoParent $n
    if (Test-Path -LiteralPath $p) { $picks = $p; break }
  }
  if (-not $picks) {
    $picks = Join-Path $photoParent "$so-WEBSITE"
    if (-not $Check) { New-Item -ItemType Directory -Path $picks -Force | Out-Null }
    $report += "NOTE  $label - created picks folder: $picks"
  }
  $shots = @(Get-ChildItem -LiteralPath $picks -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Extension -match '^\.(jpe?g|png)$' } | Sort-Object Name)
  if ($shots.Count -eq 0) { $report += "SKIP  $label - picks folder is empty ($picks)"; continue }

  $activeSOs += $so
  $outDir = Join-Path $Site "assets\photos\shop-$so"
  $thDir = Join-Path $outDir 'thumbs'
  if (-not $Check) {
    New-Item -ItemType Directory -Path $thDir -Force | Out-Null
    # rebuild from scratch each run: picks may have been removed as well as added
    Get-ChildItem -LiteralPath $outDir -File -ErrorAction SilentlyContinue | Remove-Item -Force -Confirm:$false
    Get-ChildItem -LiteralPath $thDir -File -ErrorAction SilentlyContinue | Remove-Item -Force -Confirm:$false
  }
  $i = 0; $anchors = @()
  $model = ([string]$b.SiteModel).Trim(); if (-not $model) { $model = ([string]$b.Model).Trim() }
  $len = ([string]$b.Length).Trim()
  $title = "Hull #$so"
  if ($len) { $title += " - $len' " + (TitleCase $model) } elseif ($model) { $title += ' - ' + (TitleCase $model) }
  $alt = HtmlEsc ($title -replace '- ','')
  foreach ($s in $shots) {
    $i++
    $fn = "$so-shop-$i.jpg"
    if (-not $Check) {
      Save-WebJpeg $s.FullName (Join-Path $outDir $fn) 1600 82
      Save-WebJpeg $s.FullName (Join-Path $thDir $fn) 480 80
    }
    $anchors += ('          <a href="assets/photos/shop-' + $so + '/' + $fn + '" data-m="' + (HtmlEsc ("$len' " + (TitleCase $model))) + '" data-hull="' + (HtmlEsc $so) + '"' + $(if ($len) { ' data-len="' + (HtmlEsc $len) + '"' } else { '' }) + ' data-shot="In the shop"><img src="assets/photos/shop-' + $so + '/thumbs/' + $fn + '" alt="' + $alt + ' - photo ' + $i + '" loading="lazy"></a>')
  }
  $phase = TitleCase ([string]$b.Phase)
  $sub = ''
  if ($phase) { $sub = ' <span class="prowsub">&#8212; in ' + (HtmlEsc $phase) + '</span>' }
  # data-shop-live scopes the lightbox to THIS row's photos (see gallery.js)
  $rows += @"
        <div class="prow" data-shop-live="1">
          <div class="prowhead"><span class="prowtitle"><b>$(HtmlEsc $title)</b>$sub</span>
            <span class="prowcount">$($shots.Count) photo$(if ($shots.Count -ne 1) { 's' })</span></div>
          <div class="pcar"><button class="pcarbtn pcarprev" type="button" aria-label="Scroll back">&#8592;</button>
            <div class="pcartrack">
$($anchors -join "`n")
            </div>
            <button class="pcarbtn pcarnext" type="button" aria-label="Scroll forward">&#8594;</button></div>
        </div>
"@
  $report += "OK    $label - $($shots.Count) photos from $picks"
}

$report | ForEach-Object { Write-Output $_ }
if ($rows.Count -eq 0) {
  Write-Output 'Every live build was skipped (no photos yet) - index.html untouched.'
  exit 0
}

# ---- prune shop-<SO> asset folders whose build is no longer live ----
Get-ChildItem -LiteralPath (Join-Path $Site 'assets\photos') -Directory -Filter 'shop-*' -ErrorAction SilentlyContinue | ForEach-Object {
  $soName = $_.Name -replace '^shop-',''
  if ($activeSOs -notcontains $soName) {
    Write-Output ("PRUNE " + $_.Name + ' - build no longer live')
    if (-not $Check) { Remove-Item -LiteralPath $_.FullName -Recurse -Force -Confirm:$false }
  }
}

# ---- write the two pages ----
# HOME PAGE gets exactly ONE row (Stephen, 2026-07-30: the 32-photo grid ate the
# whole screen - the home page should be "a quick glimpse into the shop"), and the
# featured build is picked at RANDOM from the live ones so nobody has to choose.
# The overflow page carries every live build, one row each.
#
# Random is re-rolled on each sync run, not per page view. Per-view rotation would
# mean shipping every live build's thumbnails to the home page and hiding all but
# one, which spends the bandwidth the single row was meant to save.
$n = $rows.Count
$plural = ''; if ($n -ne 1) { $plural = 's' }
$begin = '<!-- SHOP-LIVE:BEGIN (generated by _build/sync_shop_live.ps1 - do not hand-edit; re-run instead) -->'
$end = '<!-- SHOP-LIVE:END -->'

function Write-Between([string]$path, [string]$body, [string]$indent, [string]$label) {
  if (-not (Test-Path -LiteralPath $path)) { Write-Output ("SKIP  $label - not found: $path"); return }
  $html = [IO.File]::ReadAllText($path)
  $bi = $html.IndexOf($script:begin); $ei = $html.IndexOf($script:end)
  if ($bi -lt 0 -or $ei -lt 0 -or $ei -le $bi) { throw "SHOP-LIVE markers not found in $path" }
  $new = $html.Substring(0, $bi + $script:begin.Length) + "`n" + $body + $indent + $html.Substring($ei)
  if ($script:Check) {
    Write-Output ("CHECK - would rewrite $label")
  } else {
    [IO.File]::WriteAllText($path, $new, (New-Object System.Text.UTF8Encoding($false)))
    Write-Output ("wrote $label")
  }
}

# --- home page: one random build, plus the link through to the rest ---
$pick = Get-Random -Minimum 0 -Maximum $rows.Count
$featured = $rows[$pick]
$featuredSO = $activeSOs[$pick]
$more = ''
if ($n -gt 1) {
  $more = "    <p class=""askline"" style=""margin-top:22px;""><a href=""in-the-shop/"">See all $n boats on the floor right now &#8594;</a></p>`n"
} else {
  $more = "    <p class=""askline"" style=""margin-top:22px;""><a href=""in-the-shop/"">More from the shop floor &#8594;</a></p>`n"
}
$homeBody = @"

    <div class="sechead tight">
      <div class="eyebrow">In The Shop Right Now</div>
      <h2 style="font-size:clamp(20px,2.6vw,28px);">A look at the floor in Seattle</h2>
      <p class="lede">One build from the shop floor, updated as the crew works. Scroll the row, or tap any photo to open the full gallery.</p>
    </div>
$featured$more
"@
Write-Between (Join-Path $Site 'index.html') $homeBody '    ' ("index.html - featured hull #" + $featuredSO + " (random of $n)")

# --- overflow page: every live build ---
$allBody = @"

  <div class="sechead tight">
    <div class="eyebrow">$n build$plural on the floor</div>
    <h2 style="font-size:clamp(20px,2.6vw,28px);">Everything we&rsquo;re building right now</h2>
  </div>
$($rows -join "`n")
"@
$allBody = $allBody -replace "(?m)^        ", "      "
# the overflow page is one directory down, so its asset paths need ../
$allBody = $allBody -replace '(href="|src=")assets/', '$1../assets/'
Write-Between (Join-Path $Site 'in-the-shop\index.html') $allBody '  ' "in-the-shop/index.html - all $n row(s)"

if (-not $Check) {
  Write-Output 'NEXT: perl _build/stamp_assets.pl (if css/js changed), git add/commit, Stephen pushes.'
}
