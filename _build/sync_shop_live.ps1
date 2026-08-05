# =============================================================================
# sync_shop_live.ps1 - publish SiteLive builds into the home page's
#                      "In The Shop Right Now" section.
#
# THE PIPELINE (decided by Stephen 2026-07-30):
#   1. An admin flips "Show on website" on a build card in the Build Hub.
#      That sets SiteLive:true / SiteLiveAt on the build in LIVE BUILDS.json.
#      It STAGES only - nothing is public yet.
#   2. Staff drop the shots they want public into the build's WEBSITE box:
#         <build folder>\<SO>-PHOTOS\<SO>-WEBSITE\   (this script creates it)
#      THE WEBSITE BOX IS THE ONLY PUBLISH SOURCE - THERE IS NO FALLBACK, EVER.
#      Stephen's rule 2026-08-05. Not the BUILD, RIGGING-FINISH, SHIPPING, PRODUCT or DUMP
#      boxes; not the photo parent; not "whatever we can find". Those hold internal shop
#      photos (whiteboards, paperwork, faces, other customers' hulls) and must never reach a
#      public page. Missing or empty WEBSITE box = publish NOTHING for that hull and say so.
#      Photos in two WEBSITE boxes (a legacy PHOTOS\ + <SO>-PHOTOS\ twin) = refuse, never guess.
#      NOTE: a source FILENAME can contain the word BUILD and still be a legitimate website
#      pick - what matters is the folder it sits in. Each run writes
#      assets\photos\shop-<SO>\_source.json naming the box and file behind every published
#      photo, so provenance is readable from the repo instead of inferred.
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
# PLACEHOLDER FALLBACK (Stephen reversed the 2026-07-30 no-op ruling on 2026-08-05): when nothing is
# publishable the section must fall back to a neutral static placeholder, NOT leave the last row
# standing. Leaving it up meant un-toggling the final live build silently changed nothing on the
# public page - the same staleness this pipeline was rebuilt to kill, just in the other direction.
# We cannot write it here: Write-Between is defined further down. Flag it and handle it there.
$placeholderOnly = $false
if ($live.Count -eq 0) { $placeholderOnly = $true }

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

# Resolve a build folder's WEBSITE box(es) and how many photos each holds. ONE implementation, used
# both by the duplicate-folder guard and by the publish path, so the two can never diverge on what
# "has website photos" means. Enumeration errors are COUNTED, never swallowed: an inaccessible
# subfolder must not read as "empty box" (that failure mode cost real time on 2026-08-05).
function Get-WebsiteBoxes([string]$buildFolder, [string]$so) {
  $out = @()
  foreach ($pn in @("$so-PHOTOS", 'PHOTOS')) {
    $pp = Join-Path $buildFolder $pn
    if (-not (Test-Path -LiteralPath $pp)) { continue }
    foreach ($bn in @("$so-WEBSITE", 'WEBSITE')) {
      $bx = Join-Path $pp $bn
      if (-not (Test-Path -LiteralPath $bx)) { continue }
      $errs = @()
      $imgs = @(Get-ChildItem -LiteralPath $bx -File -ErrorVariable +errs -ErrorAction SilentlyContinue |
        Where-Object { $_.Extension -match '^\.(jpe?g|png)$' } | Sort-Object Name)
      $out += New-Object PSObject -Property ([ordered]@{
        Path = $bx; Parent = $pn; Leaf = $bn; Count = $imgs.Count; Files = @($imgs); Errors = $errs.Count
      })
    }
  }
  return @($out)
}

# ---- per-build: locate picks, resize, build the row ----
# NOTE the search space: category dirs under IN PROCESS BUILDS *only*. This sync never reads
# COMPLETED BUILDS, and it matches on the build's folder NAME (DiskFolder/FolderName), not on the SO.
$catDirs = Get-ChildItem -LiteralPath (Join-Path $MastersRoot 'IN PROCESS BUILDS') -Directory
$completedRoot = Join-Path $MastersRoot 'COMPLETED BUILDS'
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
  # ---- SAME-BUILD-IN-TWO-PLACES GUARD (2026-08-05) ----
  # Collect EVERY match instead of taking the first and breaking. Taking the first silently is how a
  # duplicate build folder publishes the wrong hull's photos with nothing in the log to show it.
  # Narrow by design (Stephen's call): a duplicate that resolves cleanly must NOT block publishing -
  # only a genuinely ambiguous one does. So: always WARN on a multi-match; refuse ONLY when more than
  # one candidate actually holds WEBSITE-box photos.
  $cands = @()
  foreach ($nm in $names) {
    foreach ($cd in $catDirs) {
      $p = Join-Path $cd.FullName $nm
      if ((Test-Path -LiteralPath $p) -and ($cands -notcontains $p)) { $cands += $p }
    }
  }
  if ($cands.Count -eq 0) { $report += "SKIP  $label - folder '$($names -join "' / '")' not found under IN PROCESS BUILDS"; continue }
  $bf = $cands[0]
  if ($cands.Count -gt 1) {
    $report += "WARN  $label - this build resolves in MORE THAN ONE place under IN PROCESS BUILDS:"
    foreach ($c in $cands) { $report += "        candidate: $c" }
    $withPhotos = @()
    foreach ($c in $cands) {
      $tot = 0
      foreach ($x in (Get-WebsiteBoxes $c $so)) { $tot += $x.Count }
      if ($tot -gt 0) { $withPhotos += $c }
    }
    if ($withPhotos.Count -gt 1) {
      $report += "SKIP  $label - AMBIGUOUS: more than one of those holds WEBSITE-box photos. Refusing to guess."
      foreach ($c in $withPhotos) { $report += "        has website photos: $c" }
      $report += "        Consolidate to ONE build folder, then re-run. Nothing was published for this hull."
      continue
    }
    if ($withPhotos.Count -eq 1) {
      $bf = $withPhotos[0]
      $report += "        resolved -> the only candidate with WEBSITE photos: $bf"
    } else {
      $report += "        resolved -> none hold WEBSITE photos; using the first: $bf"
    }
  }
  # Cross-tree duplicate: the same SO also sitting under COMPLETED BUILDS is a real data problem
  # (a live build cannot also be delivered), but it can never affect what publishes because this
  # sync only ever searches IN PROCESS BUILDS, by folder name. So: shout, never block, never read it.
  if ($so -and (Test-Path -LiteralPath $completedRoot)) {
    $cerr = @()
    $dupes = @(Get-ChildItem -LiteralPath $completedRoot -Recurse -Depth 2 -Directory -ErrorVariable +cerr -ErrorAction SilentlyContinue |
      Where-Object { $_.Name -like ('*-' + $so) })
    if ($cerr.Count -gt 0) { $report += "WARN  $label - $($cerr.Count) folder(s) under COMPLETED BUILDS could not be read while checking for duplicates" }
    foreach ($d in $dupes) {
      $report += "WARN  $label - the same SO also exists under COMPLETED BUILDS: $($d.Name)"
      $report += "        not read and not published from (this sync only reads IN PROCESS BUILDS), but a live build should not also be delivered."
    }
  }
  # ================== THE PUBLISH SOURCE: THE WEBSITE BOX, AND NOTHING ELSE ==================
  # Stephen's rule, stated 2026-08-05: "I want the photos linked to the live toggle to be the
  # photos within the website folder only."
  #
  # WHY THIS IS A HAZARD, NOT A PREFERENCE: every other box in a build holds INTERNAL shop
  # photos - whiteboards, paperwork, faces, other customers' hulls, work-in-progress nobody
  # cleared for publication. BUILD / RIGGING-FINISH / SHIPPING / PRODUCT / DUMP are all
  # internal. The WEBSITE box is the one place a human deliberately chose what the public may
  # see, so it is the ONLY thing this script may ever read. A fallback that quietly widens the
  # search - up to the photo parent, or across to another box - would publish internal photos
  # while every small test still passed. That class of defect is assumed guilty here.
  #
  # THEREFORE:
  #   * the only folders ever read are <photo parent>\<SO>-WEBSITE and, on a legacy build, a
  #     plain <photo parent>\WEBSITE. Those two names are the SAME box under the two
  #     photo-parent conventions (settled 2026-08-03) - that is parent naming, NOT source
  #     widening.
  #   * missing or empty WEBSITE box  => publish NOTHING for this hull, and say so loudly.
  #   * photos in more than one WEBSITE box => AMBIGUOUS, refused outright, never guessed.
  #   * a hard assertion below makes it impossible for a future edit to point $picks at
  #     anything whose folder name is not a WEBSITE box.
  # ONE resolver (Get-WebsiteBoxes) for both this and the duplicate guard above.
  $boxes = @(Get-WebsiteBoxes $bf $so)
  foreach ($x in $boxes) {
    if ($x.Errors -gt 0) { $report += "WARN  $label - $($x.Errors) read error(s) inside $($x.Path) - photo count may be understated" }
  }
  $filled = @($boxes | Where-Object { $_.Count -gt 0 })
  if ($filled.Count -gt 1) {
    $report += "SKIP  $label - AMBIGUOUS: photos sit in more than one WEBSITE box. Refusing to guess."
    foreach ($x in $filled) { $report += "        candidate: $($x.Path)  ($($x.Count) photos)" }
    $report += "        Consolidate into ONE box and re-run. Nothing was published for this hull."
    continue
  }
  if ($filled.Count -eq 0) {
    $picks = ''
    if ($boxes.Count -gt 0) { $picks = $boxes[0].Path }
    if (-not $picks) {
      # no WEBSITE box at all: give staff a target under whichever parent exists, else the convention
      $par = Join-Path $bf "$so-PHOTOS"
      if ((-not (Test-Path -LiteralPath $par)) -and (Test-Path -LiteralPath (Join-Path $bf 'PHOTOS'))) { $par = Join-Path $bf 'PHOTOS' }
      $picks = Join-Path $par "$so-WEBSITE"
      if (-not $Check) { New-Item -ItemType Directory -Path $picks -Force | Out-Null }
      $report += "NOTE  $label - created the WEBSITE box: $picks"
    }
    $report += "SKIP  $label - the WEBSITE box is EMPTY, so NOTHING was published for this hull."
    $report += "        Only $picks publishes - build, rigging, shipping and product photos never do."
    continue
  }
  $picks = $filled[0].Path
  # belt-and-braces: no future edit may widen the source to a non-WEBSITE folder
  $picksLeaf = Split-Path $picks -Leaf
  if ($picksLeaf -notmatch '(?i)^([0-9A-Za-z_-]+-)?WEBSITE$') {
    throw "refusing to publish: the resolved source folder is not a WEBSITE box -> $picks"
  }
  $shots = @(Get-ChildItem -LiteralPath $picks -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Extension -match '^\.(jpe?g|png)$' } | Sort-Object Name)
  if ($shots.Count -eq 0) { $report += "SKIP  $label - the WEBSITE box is EMPTY ($picks) - nothing published"; continue }

  $activeSOs += $so
  $outDir = Join-Path $Site "assets\photos\shop-$so"
  $thDir = Join-Path $outDir 'thumbs'
  if (-not $Check) {
    New-Item -ItemType Directory -Path $thDir -Force | Out-Null
    # rebuild from scratch each run: picks may have been removed as well as added
    Get-ChildItem -LiteralPath $outDir -File -ErrorAction SilentlyContinue | Remove-Item -Force -Confirm:$false
    Get-ChildItem -LiteralPath $thDir -File -ErrorAction SilentlyContinue | Remove-Item -Force -Confirm:$false
  }
  $i = 0; $anchors = @(); $prov = @()
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
    # provenance, recorded in the repo (2026-08-05): "which box did this published photo come
    # from" must be answerable from the working tree, not re-derived by re-encoding candidates.
    # The published files are renamed and re-encoded, so nothing about them carries their origin
    # - and a source filename can say BUILD while sitting in the WEBSITE box, which is exactly
    # what made this look wrong on 2026-08-05.
    # PRIVACY: this manifest ships in assets\photos\ and is therefore PUBLIC. It carries the box
    # NAME and the source FILENAME only - never the source path, which contains the customer's
    # name (build folders are "<year>-<len>-<model>-<CUSTOMER>-<SO>"). Writing the full path here
    # would have published "RICK HYCE" on 2026-08-05; caught before it left the working tree.
    # The full-path audit copy goes outside the repo, below.
    $prov += New-Object PSObject -Property ([ordered]@{
      published    = $fn
      sourceBox    = $picksLeaf
      sourceFile   = $s.Name
      sourceSha256 = (Get-FileHash -LiteralPath $s.FullName -Algorithm SHA256).Hash
    })
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
  if (-not $Check) {
    $manifest = New-Object PSObject -Property ([ordered]@{
      note    = 'Generated by _build/sync_shop_live.ps1. The WEBSITE box is the ONLY publish source - never the BUILD, RIGGING-FINISH, SHIPPING, PRODUCT or DUMP boxes. A source filename may contain the word BUILD and still be a website pick; sourceBox below is the authority.'
      hull    = $so
      syncedAt = (Get-Date).ToString('s')
      photos  = @($prov)
    })
    [IO.File]::WriteAllText((Join-Path $outDir '_source.json'), (ConvertTo-Json $manifest -Depth 5), (New-Object System.Text.UTF8Encoding($false)))
    # internal audit copy WITH the full source path - kept OUTSIDE the repo so the customer name
    # in the folder name can never be published or pushed.
    try {
      $auditDir = Join-Path $env:ProgramData 'WooldridgeBuildHub'
      if (-not (Test-Path -LiteralPath $auditDir)) { New-Item -ItemType Directory -Path $auditDir -Force | Out-Null }
      $line = (Get-Date).ToString('s') + " hull=$so box=$picksLeaf source=$picks files=" + (@($shots | ForEach-Object { $_.Name }) -join ';')
      Add-Content -LiteralPath (Join-Path $auditDir 'shop-live-provenance.log') -Value $line -Encoding UTF8
    } catch { }
  }
  # name the box AND every source file - "it looks like it came from the build folder" has to be
  # answerable from the sync's own output, not by inspecting photos (2026-08-05)
  $report += "OK    $label - $($shots.Count) photos, ALL from the WEBSITE box '$picksLeaf'"
  $report += "        source: $picks"
  foreach ($s in $shots) { $report += "        <- $($s.Name)" }
}

$report | ForEach-Object { Write-Output $_ }
# Builds are toggled live but not one of them has a publishable photo, so there is nothing to show.
# Same user-visible situation as nothing being toggled at all, so it takes the same placeholder
# rather than leaving a stale row up. (2026-08-05 - extends Stephen's placeholder decision by one
# case; flagged for him in the TO DO item because it is public-facing behaviour.)
if ($rows.Count -eq 0) { $placeholderOnly = $true }

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

# --- nothing publishable: write the neutral static placeholder into BOTH pages and stop ---
# The visible copy is deliberately boat-agnostic and safe to be public as-is (no hull number, no
# customer, no model), because it ships the moment Stephen pushes. The wording itself is NOT his yet
# - that ask is filed as a decision item, and the HTML comment below marks it in the diff so it
# cannot pass for approved marketing copy.
if ($placeholderOnly) {
  $phMark = '<!-- SHOP-LIVE placeholder: shown because no build is toggled live with publishable
       photos. Wording is provisional and awaiting Stephen approval - see the TO DO decision item
       "Approve the In The Shop placeholder copy". Toggling any build live with photos in its
       WEBSITE box replaces this whole block automatically. -->'
  $phHome = @"

    $phMark
    <div class="sechead tight">
      <div class="eyebrow">In The Shop Right Now</div>
      <h2 style="font-size:clamp(20px,2.6vw,28px);">A look at the floor in Seattle</h2>
      <p class="lede">Every Wooldridge is built to order in Seattle, one hull at a time. Fresh photos from the shop floor go up here as boats come together &mdash; check back soon.</p>
    </div>
"@
  $phAll = @"

  $phMark
  <div class="sechead tight">
    <div class="eyebrow">In The Shop Right Now</div>
    <h2 style="font-size:clamp(20px,2.6vw,28px);">Every Wooldridge is built to order in Seattle</h2>
    <p class="lede">There is always aluminium on the floor. We post photos of builds in progress here as they happen &mdash; check back soon.</p>
  </div>
"@
  Write-Output 'PLACEHOLDER - nothing publishable; writing the static placeholder into both pages.'
  Write-Between (Join-Path $Site 'index.html') $phHome '    ' 'index.html - static placeholder'
  Write-Between (Join-Path $Site 'in-the-shop\index.html') $phAll '  ' 'in-the-shop/index.html - static placeholder'
  if (-not $Check) {
    Write-Output 'NEXT: review the placeholder wording, then git add/commit. Stephen pushes.'
  }
  exit 0
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
