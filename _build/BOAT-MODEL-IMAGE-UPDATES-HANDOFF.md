# BOAT MODEL IMAGE UPDATES — HANDOFF / RUNBOOK

**Point Claude at this file** when a new boat model's photo set is ready. It is the
complete, self-contained recipe for replacing one model's website photos on
**dev.wooldridgeboats.com** the same way the **Alaskan LT** was done (2026-09-16).

Repo: `~/Desktop/LOCAL-WEBSITE` (git → `github.com/WooldridgeBoats/Website`, deploy branch `main`
via cPanel; **Cloudflare caches assets 4h but NOT html**, so `stamp_assets.pl` is mandatory).
Preview locally with `python3 -m http.server 8811` in the repo root, then open
`http://127.0.0.1:8811/...` in the browser pane (the pane's own WEBrick server EPERMs on the Desktop).

---

## ⚡ ONE-COMMAND PATH (built 2026-09-16 — use this; steps 0–7 below are the reference/fallback)

Trigger convention: **Tyler says "Model Ready" + model name + master folder.** Then:

```bash
SRC="/Users/tylerlee/Library/CloudStorage/OneDrive-WooldridgeBoatsInc/Wooldridge Boats Inc_ - SQUIRREL HOLE/70 MARKETING AND BRAND/WEBSITE/MASTER-WEBSITE PHOTOS/<MODEL>-WEB"
_build/check_model_photos.sh "$SRC"                                  # 1. PRE-FLIGHT: vet naming/size/hulls (Tyler can run this himself too)
_build/apply_model_photos.sh <slug> "<Display Name>" "$SRC" --dry-run # 2. preview the filename map + gallery HTML (writes nothing)
_build/apply_model_photos.sh <slug> "<Display Name>" "$SRC"           # 3. do it (copies, thumbs, covers, hero, page rewrite, cross-refs, build_gallery + stamp)
```

Then verify in the browser pane (§7 checklist) and hand Tyler the commit line (he drives the push).

- **`check_model_photos.sh`** flags: missing/duplicate order#, missing hull#, unknown trim code, length≠folder, non-2000×1250, 0-byte cloud placeholders, missing HERO / per-length GALLERY-THUMB. Exit 0 = safe to build.
- **`apply_model_photos.sh`** re-runs the pre-flight and refuses on errors (`--force` overrides). It auto-handles the homepage fleet card + Compare thumb (matched by `url:models/<slug>/`), regens provenance, and prints any leftover `lp/` persona refs to repoint by hand.
- **Page-dir ≠ photo-dir → set `PHOTOSLUG`.** `<slug>` is the PAGE dir (`models/<slug>/`); photos default to `assets/photos/<slug>/`. When they differ, pass `PHOTOSLUG`. Known case **Alaskan XLT** (page `xlt`, photos `alaskan-xlt`): `PHOTOSLUG=alaskan-xlt _build/apply_model_photos.sh xlt "Alaskan XLT" "<SRC>"`. (gallery.js keys its `slug` off the photo path, so covers/provenance/photo-data follow PHOTOSLUG; only the page file + `url:models/<slug>/` match use the page slug — the builder handles both.)
- A **brand-new trim code** must be added to `%CFG` in `build_gallery.pl` AND to `cfg_disp`/`parse_one` in `apply_model_photos.sh` AND the validator's `KNOWN_TRIMS` before building — the pre-flight flags it. Done for **`aft-ws` → "Aft Windshield"** (Alaskan XLT). If it's a **two-token** code in the filename (`…-AFT-WS-…`, like `first-responder`), build_gallery must match it with `$cfg='aft-ws' if $joined=~/aft-ws/` BEFORE the single-token loop (else the lone `ws` token wins), and parse_one/validator detect it as "style==aft AND next==ws".

---

## 0) WHAT TYLER HANDS OVER

Source master (OneDrive): `~/Library/CloudStorage/OneDrive-WooldridgeBoatsInc/Wooldridge Boats Inc_ - SQUIRREL HOLE/70 MARKETING AND BRAND/WEBSITE/MASTER-WEBSITE PHOTOS/<MODEL>-WEB/`
containing, per length: `NN-HULL-LEN-STYLE-MODEL.jpg` (e.g. `01-5370-16-CC-AK LT.jpg`), plus one
`HERO-*.jpg` at the top and one `GALLERY-THUMB-*.jpg` per length subfolder.
(Confirm files are real bytes, not cloud-only placeholders, before copying.)

**Filename decode** = `order-hull#-lengthFt-style-model`. The **caption** = *Length · Style · Model*
(no hull). Style codes: `CC`=Center Console, `WS`=Windshield, `TILLER`=Tiller. (Add new codes in
BOTH `parse_one` below AND `%CFG` in `_build/build_gallery.pl` if a model uses one, e.g. side console.)
All source images are 2000×1250 (16:10). Parse POSITIONALLY (the order number is first, so a naive
length regex grabs it by mistake); some files legitimately omit the hull.

---

## 1) MAP TYLER'S NAMES → THE SITE'S INTERNAL SCHEME

The site's `build_gallery.pl` parses metadata from filenames but expects `HULL-LEN-cfg-IDX.jpg`
(lowercase, index LAST). So remap `NN-HULL-LEN-STYLE` → `HULL-LEN-cfg-NN.jpg`
(no-hull files → `LEN-cfg-NN.jpg`). This preserves order/hull/length/style AND makes the existing
caption engine populate automatically, without editing the shared perl (which the other ~20 models
still rely on). Do NOT keep Tyler's spaces/uppercase on disk — spaces break gallery.js matching.

Run a DRY-RUN first and confirm zero warnings (every length matches its folder, every style known):

```bash
SLUG="<slug>"                 # e.g. alaskan-lt
MODEL="<Display Name>"        # e.g. "Alaskan LT"
SRC="/Users/tylerlee/Library/CloudStorage/OneDrive-WooldridgeBoatsInc/Wooldridge Boats Inc_ - SQUIRREL HOLE/70 MARKETING AND BRAND/WEBSITE/MASTER-WEBSITE PHOTOS/<MODEL>-WEB"
LENGTHS="16 18 20"           # this model's length subfolders (match the "NN-AK LT-WEB" dirs)
```

Parser (positional) used by the copy step:
```bash
parse_one(){ # $1 srcpath $2 folderLen -> DEST hull len cfg
  local f="$1" folderL="$2" base stem; base="$(basename "$f")"; stem="${base%.jpg}"
  local -a t; IFS='-' read -r -a t <<< "$stem"
  local nn hull len style
  nn="${t[0]}"
  if [[ "${t[1]}" =~ ^[45][0-9]{3}$ ]]; then hull="${t[1]}"; len="${t[2]}"; style="${t[3]}";
  else hull=""; len="${t[1]}"; style="${t[2]}"; fi
  local cfg; case "$(printf %s "$style"|tr A-Z a-z)" in cc)cfg=cc;; ws)cfg=ws;; tiller)cfg=tiller;; *)cfg="?";; esac
  local nn2; nn2="$(printf '%02d' "$((10#$nn))")"     # base-10 so 08/09 don't break
  [ -n "$hull" ] && echo "${hull}-${len}-${cfg}-${nn2}.jpg $hull $len $cfg" || echo "${len}-${cfg}-${nn2}.jpg  $len $cfg"
}
```

---

## 2) COPY IMAGES + THUMBS + COVERS + HERO  (delete old first)

Into `assets/photos/<slug>/`:
- **Fulls**: copy each gallery image AS-IS (already 2000×1250) under its remapped name.
- **Thumbs**: `sips -s format jpeg -Z 800 <src> --out thumbs/<dest>` → 800×500 each.
- **HERO**: copy the `HERO-*.jpg` to `hero-<hull>-<len>-<cfg>.jpg` **with NO matching thumb** →
  build_gallery.pl prints one harmless `MISSING THUMB` and keeps it OUT of the fleet gallery.
- **Covers**: the three `GALLERY-THUMB-*` become `thumbs/cover-16.jpg` / `cover-18` / `cover-20`
  (also `sips -Z 800`). These are the per-length gallery cover-card images (orphan names → ignored
  by build_gallery).
- **Hero card thumb**: `sips -s format jpeg -Z 800 hero-<...>.jpg --out thumbs/hero.jpg`
  (orphan name → stays out of fleet gallery; used as the fleet/compare card, see §6).

While copying, write a manifest `len \t order \t hasHull \t dest \t cfgDisplay \t hull` per photo —
it drives the gallery HTML in §3. (cfgDisplay: cc→Center Console, ws→Windshield, tiller→Tiller.)

**18ft Alaskan-LT quirk seen once**: a hull-less `02-18-TILLER` collided with `02-...-WS`. Keep both;
order by (order#, then hasHull-first). Just watch for duplicate order numbers in any set.

---

## 3) BUILD THE MODEL-PAGE GALLERY HTML (in Tyler's order, captioned)

Each `<a>` in the flat grid, ordered 16→18→20, within a length by (order#, hasHull desc):
```html
<a href="../../assets/photos/<slug>/<dest>"><img src="../../assets/photos/<slug>/thumbs/<dest>"
  alt="<LEN>&#8242; <cfgDisplay> <MODEL>&#8212; Hull <hull>" loading="lazy"><span class="gcap"><b><LEN>&#8242;
  <cfgDisplay></b><MODEL></span></a>
```
Splice it into `models/<slug>/index.html` replacing the whole `<div class="gallery captioned">…</div>`
block (perl `s{<div class="gallery captioned">.*?</div>}{…}s`).

---

## 4) THE MODEL PAGE STRUCTURE (apply/verify these — already true on every model page)

- `<main class="mp-tight">` (tighter masthead so the hero sits high).
- Masthead has **NO** `HOME / THE FLEET / …` breadcrumb and **NO** `<div class="co">Wooldridge Boats · Seattle`
  line — deleted from all 25 model pages. Order is: prev/next bar → `<h1>` → `.kick` → `.tag` → rule → hero.
- Hero: `<figure class="modelhero"><img src="…/hero-<...>.jpg" …><figcaption>MODEL &#8212; LEN&#8242; STYLE<span class="ref">HULL #<hull></span></figcaption></figure>`
  — the `.ref` is **`HULL #<hull>`** (WITH the `#`), hull pulled from the HERO filename.
- Gallery grid is `class="gallery captioned"` (on-photo captions + 16:10 thumbs — this rides WITH the
  new 2000×1250 photos; do NOT add `captioned` to a model still on old 4:3 shots).
- Per-length cover cards use Tyler's `GALLERY-THUMB`s via an inline hook BEFORE the scripts:
  `<script>window.WB_COVERS={"<slug>":{"16":"…/thumbs/cover-16.jpg","18":"…/thumbs/cover-18.jpg","20":"…/thumbs/cover-20.jpg"}};</script>`

---

## 5) REGENERATE DATA + FLEET PAGE + VETTED MAP

```bash
perl _build/build_gallery.pl      # regenerates assets/photo-data.js + photos/index.html; expect "<slug>  N photos, N with length" and one MISSING THUMB (the hero)
```
Refresh the vetted map (INTERNAL only — fades unvetted photos under ?wbph=1, zero customer impact):
delete the model's old `<slug>/…` keys in `assets/media-provenance.js` `WB_VETTED` and add every
current `<slug>/*.jpg` (incl. the hero) = 1.

---

## 6) HERO → FLEET-GRID CARD + COMPARE THUMB  (Tyler's rule)

A model's HERO is also its thumbnail on the homepage **Boat Models** fleet grid and the **Compare** page:
- `index.html` fleet JSON: set that model's `"ph"` to `assets/photos/<slug>/thumbs/hero.jpg`.
- `compare/index.html` model map: set that model's `ph` to `/assets/photos/<slug>/thumbs/hero.jpg`.

Do NOT touch: the homepage **category tiles** (Inboard/Outboard/Offshore/Agency — Tyler supplies those
separately) or the **"Shot in the Field"** photocard (his taste; Alaskan LT's is deliberately `cover-16.jpg`).
Also repoint any other stray refs to the model's OLD filenames — grep the repo:
`grep -rn "photos/<slug>/" --include='*.html' --include='*.js' .` and fix broken ones (lp/ persona
heroes, etc.). lp/ persona heroes use the FULL hero image, not a thumb.

---

## 7) CACHE-BUST, TEST, SHIP

```bash
perl _build/stamp_assets.pl       # REQUIRED whenever any .css/.js changed (Cloudflare)
```
Verify in the browser pane (serve with python http.server; the pane can't screenshot when hidden, so
use read_page / javascript_tool geometry as the source of truth):
- model page: N photos + N gcaps, hero loads, cover cards read right, length filter counts, 0 broken imgs, no console errors;
- open the lightbox, resize tall + wide-short: the whole viewer (top bar + image + caption + thumbs) stays
  centered as ONE group and hugs the image; Zoom↔Fit + magnify cursor work;
- homepage: fleet card = hero, 0 broken images.

Commit + push (Tyler drives the push):
```bash
cd ~/Desktop/LOCAL-WEBSITE && git add -A && git commit -m "<Model>: 2026 photo set" && git push origin main
```

---

## SHARED / ALREADY DONE — do NOT redo per model (all live in gallery.js + house.css)

- **Lightbox viewer**: centered group that hugs the image at any window size; caption = one centered grey
  line `[LEN badge] Model · Build · Hull #NNNN`, centered in the image→thumbs gutter; 140×88 filmstrip;
  big/thick nav arrows; Zoom→Fit (native-size pan, magnify cursor); NO "Back to Gallery" button; the
  corner "Not sure which boat?" nudge hides while the viewer is open.
- **Cover-card trim line** (`cfgLine` in gallery.js): Title-Case list — "Console & Tiller Trims",
  "Windshield, Tiller & Console Trims".
- **Nav "Home" link** (left of "Our Boats", in header.html) and the **mega-menu hover close-delay**
  (`@media (min-width:901px)` in house.css — keeps the "Our Boats" panel up ~0.35s so quick mouse moves
  left/right/down don't lose it; scoped >900px so the mobile tap-accordion is untouched).

These are global; a new model inherits them for free.
