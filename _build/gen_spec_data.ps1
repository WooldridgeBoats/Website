# gen_spec_data.ps1 - derive tools/SPEC_DATA.js from the shop's spec worksheets.
#
# Source of truth: the three SPEC WORKSHEET xlsx files in
#   OneDrive - Wooldridge Boats Inc\Documents\WB FILES\2 - SHOP AND TECHNICAL\SPEC WORKSHEETS\
# (moved 2026-08-02 from the retired shared-library DATA POPULATION folder)
# which carry the brochure-verified figures plus a STATUS column recording
# what is corrected, what is derived, and what is still missing.
#
# PUBLICATION RULE (Stephen, 28 Jul 2026): confirmed figures ONLY.
#   - any cell containing DERIVED / UNCONFIRMED / QUERY is dropped
#   - (CORRECTED) / (ADDED) / (FILLED) markers are review notes on values a
#     person confirmed - the marker is stripped, the value is published
#   - the Super Sport Drifter Inboard 21' weights are the old 20-footer's
#     figures pending Luke's confirmation (STATUS row note) - dropped
#   - USCG capacities are omitted entirely: no brochure publishes them
#
# Output: tools/SPEC_DATA.js -> const WB_SPECS + const WB_SPEC_GROUPS,
# consumed by the compare tool. Missing values simply don't exist in the
# object; the tool renders a dash. Never invent a number here.
#
# Run when the shop returns updated worksheets:
#   powershell -ExecutionPolicy Bypass -File _build\gen_spec_data.ps1
param()
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$src  = 'C:\Users\Stephen\OneDrive - Wooldridge Boats Inc\Documents\WB FILES\2 - SHOP AND TECHNICAL\SPEC WORKSHEETS'
# Moved 2026-08-02: the shared-library LUKE - DANNY - GRANT - DATA POPULATION folder was
# retired (spec questions now flow through crew boards); the worksheets live in WB FILES.
if (-not (Test-Path $src)) { throw "worksheet folder not found: $src" }

Add-Type -AssemblyName System.IO.Compression.FileSystem

function Read-Sheet([string]$Path) {
  $tmp = Join-Path $env:TEMP ("spec_" + [System.IO.Path]::GetRandomFileName())
  Copy-Item $Path $tmp -Force
  $zip = [System.IO.Compression.ZipFile]::OpenRead($tmp)
  try {
    $get = { param($n) $e = $zip.Entries | Where-Object { $_.FullName -eq $n }
             if(-not $e){ return $null }
             $r = New-Object System.IO.StreamReader($e.Open()); $t=$r.ReadToEnd(); $r.Close(); $t }
    $shared = @()
    $ss = & $get 'xl/sharedStrings.xml'
    if ($ss) { $x=[xml]$ss; foreach($si in $x.sst.si){
      if ($si.t -is [string]) { $shared += $si.t }
      elseif ($si.t.'#text')  { $shared += $si.t.'#text' }
      elseif ($si.r) { $shared += (($si.r | ForEach-Object { if($_.t -is [string]){$_.t}else{$_.t.'#text'} }) -join '') }
      else { $shared += '' } } }
    $sx = [xml](& $get 'xl/worksheets/sheet1.xml')
    $rows = @{}
    foreach ($row in $sx.worksheet.sheetData.row) {
      $cells = @{}
      foreach ($c in $row.c) {
        $v = $null
        if ($c.t -eq 's') { $i=[int]$c.v; if($i -lt $shared.Count){ $v=$shared[$i] } }
        elseif ($c.t -eq 'inlineStr') { $v = $c.is.t }
        elseif ($null -ne $c.v) { $v = $c.v }
        if ($null -ne $v -and "$v".Trim() -ne '') {
          $col = ($c.r -replace '\d+$','')
          $cells[$col] = "$v".Trim()
        }
      }
      $rows[[int]$row.r] = $cells
    }
    return $rows
  } finally { $zip.Dispose(); Remove-Item $tmp -Force }
}

# worksheet model name -> catalogue id (names as they appear per sheet)
$IDMAP = @{   # NB: PowerShell vars are case-insensitive - $id would clobber $ID
  'Alaskan LT'='lt'; 'Alaskan'='ak'; 'Alaskan XLT'='xlt'; 'Alaskan XL'='xl';
  'Rogue HDPE'='rogue'; 'Skagit'='skagit'; 'Sport'='sport'; 'Sportster'='sportster';
  'Super Sport Drifter'='ssd';
  'Alaskan XL Inboard'='xlib'; 'Scout'='scout'; 'Scout Widebody'='scoutwb';
  'Skagit Inboard'='skagitib'; 'Sport Inboard'='sportib';
  'Super Sport Drifter Inboard'='ssdib'; 'Skagit-X'='skagitx';
  'Sport Offshore'='so'; 'Super Sport Offshore'='sso'
}
# column -> spec key (JS-safe), plus display grouping
$COLS = [ordered]@{
  E='length'; F='loa'; G='beam'; H='floorWidth'; I='sideHeight'; J='intSideHeight';
  K='bottomWidth'; L='bottomGauge'; M='bottomGaugeCenter'; N='sideGauge'; O='deltaPadGauge';
  P='weightOpen'; Q='weightWS'; R='fuel';
  U='maxPropHP'; V='maxJetHP'; W='maxTillerHP'; X='stdMotor'; Y='stdJet';
  Z='deadrise'; AA='deadriseTransom'; AB='deadriseVee'; AC='deadriseBow'
}
# per-row value drops that the STATUS column (not the cell) flags as unconfirmed
$ROW_DROPS = @{ 'ssdib|21' = @('weightOpen','weightWS') }  # old 20 ft weights pending Luke

$models = @{}
foreach ($f in 'SPEC WORKSHEET - OUTBOARD.xlsx','SPEC WORKSHEET - INBOARD.xlsx','SPEC WORKSHEET - OFFSHORE.xlsx') {
  $rows = Read-Sheet (Join-Path $src $f)
  foreach ($r in ($rows.Keys | Sort-Object)) {
    if ($r -lt 5) { continue }                       # header block
    $cells = $rows[$r]
    if (-not $cells['A'] -or -not $cells['B']) { continue }
    $id = $IDMAP[$cells['A']]
    if (-not $id) { throw "unmapped model name '$($cells['A'])' in $f row $r" }
    $len = $cells['B']
    if (-not $models[$id]) { $models[$id] = [ordered]@{} }
    $spec = [ordered]@{}
    foreach ($col in $COLS.Keys) {
      $v = $cells[$col]
      if (-not $v) { continue }
      if ($v -match 'DERIVED|UNCONFIRMED|QUERY') { continue }          # not confirmed
      $v = ($v -replace '\s*\((CORRECTED|corrected|ADDED|FILLED)\)','' -replace '\s*\(was [^)]*\)','').Trim()
      $key = $COLS[$col]
      $drop = $ROW_DROPS["$id|$len"]
      if ($drop -and $drop -contains $key) { continue }
      if ($v -ne '') { $spec[$key] = $v }
    }
    if ($spec.Count) { $models[$id][$len] = $spec }
  }
}

# serialize (ASCII, ordered, stable)
function JsStr([string]$s) { '"' + ($s -replace '\\','\\\\' -replace '"','\"') + '"' }
$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine('/* SPEC_DATA.js - GENERATED by _build/gen_spec_data.ps1 from the shop spec')
[void]$sb.AppendLine('   worksheets (WB FILES\2 - SHOP AND TECHNICAL\SPEC WORKSHEETS). CONFIRMED figures')
[void]$sb.AppendLine('   only: DERIVED / UNCONFIRMED / QUERY values are excluded at generation.')
[void]$sb.AppendLine('   Do not hand-edit - correct the worksheet and re-run. SPEC-01 / TOOL-04. */')
[void]$sb.AppendLine('const WB_SPEC_GROUPS = [')
[void]$sb.AppendLine('  ["Dimensions", [["length","Length"],["loa","Length overall"],["beam","Beam"],["floorWidth","Interior floor width"],["sideHeight","Side height"],["intSideHeight","Interior side height"],["bottomWidth","Bottom width"]]],')
[void]$sb.AppendLine('  ["Construction", [["bottomGauge","Bottom gauge"],["bottomGaugeCenter","Bottom gauge, center"],["sideGauge","Side gauge"],["deltaPadGauge","Delta pad gauge"]]],')
[void]$sb.AppendLine('  ["Weight & fuel", [["weightOpen","Weight (open)"],["weightWS","Weight (w/ windshield)"],["fuel","Fuel tank"]]],')
[void]$sb.AppendLine('  ["Power", [["maxPropHP","Max prop HP"],["maxJetHP","Max jet HP"],["maxTillerHP","Max tiller HP"],["stdMotor","Standard motor"],["stdJet","Standard jet"]]],')
[void]$sb.AppendLine('  ["Deadrise", [["deadrise","Constant deadrise"],["deadriseTransom","At transom"],["deadriseVee","At vee transition"],["deadriseBow","At bow"]]]')
[void]$sb.AppendLine('];')
[void]$sb.AppendLine('const WB_SPECS = {')
$mkeys = @($models.Keys | Sort-Object)
for ($i=0; $i -lt $mkeys.Count; $i++) {
  $id = $mkeys[$i]
  $lines = @()
  foreach ($len in ($models[$id].Keys | Sort-Object {[int]$_})) {
    $kv = @()
    foreach ($k in $models[$id][$len].Keys) { $kv += ((JsStr $k) + ':' + (JsStr $models[$id][$len][$k])) }
    $lines += ('    "' + $len + '": {' + ($kv -join ',') + '}')
  }
  $comma = if ($i -lt $mkeys.Count - 1) { ',' } else { '' }
  [void]$sb.AppendLine('  "' + $id + '": {')
  [void]$sb.AppendLine(($lines -join ",`n"))
  [void]$sb.AppendLine('  }' + $comma)
}
[void]$sb.AppendLine('};')
$out = Join-Path $repo 'tools\SPEC_DATA.js'
# ASCII-encode: non-ASCII chars (feet/inch marks in the data) become \uXXXX
$js = $sb.ToString()
$esc = New-Object System.Text.StringBuilder
foreach ($ch in $js.ToCharArray()) {
  $cp = [int]$ch
  if ($cp -gt 126) { [void]$esc.Append('\u{0:x4}' -f $cp) } else { [void]$esc.Append($ch) }
}
[System.IO.File]::WriteAllText($out, $esc.ToString(), [System.Text.Encoding]::ASCII)
$total = 0; foreach ($id in $mkeys) { $total += $models[$id].Count }
Write-Host "wrote $out : $($mkeys.Count) models, $total model-length rows"
