# Custom Build pages — paste this into a NEW chat window

Copy everything in the box below as your first message in a new chat. The recipe under the box
is how the CANYON page was built (2026-10-06); the next one is DEEPWATER.

---

Continuing the Wooldridge dev site (dev.wooldridgeboats.com) in ~/Desktop/LOCAL-WEBSITE.
Next job: build the DEEPWATER custom model page (models/deepwater/) just like the CANYON page
(models/canyon/). FIRST read `_build/CUSTOM-BUILD-HANDOFF.md` (the Canyon recipe + gotchas)
and my memory notes `website-photo-replacement-workflow`, `spec-section-project`,
`wooldridge-model-lineup`, `tyler-pushes-to-github`, `desktop-tcc-eperm` and
`no-headless-chrome-app-management`.

I'll send: the Deepwater specs + standard features (a SALES TOOLS spec PDF or a brochure),
then the photo folder (OneDrive …/MASTER-WEBSITE PHOTOS/DEEPWATER-WEB/) with "Model Ready".
Build it like Canyon: Boat Specifications fold + Standard features (NO pricing / Build &
Price, custom builds aren't in the configurator), hero + gallery cards + bottom photo grid.
Ask me before guessing: any spec number the sources disagree on, the Legacy Model label,
whether to keep the page's video, the display name (page says "Deepwater Series").
Check desktop 1440 + phone 390. LEAVE IT UNCOMMITTED: I commit + push in GitHub Desktop.
Summary + Description only for new things or a wrap-up. Fix my spelling; call me Bro;
plain English.

---

## DEEPWATER status (started 2026-10-06, uncommitted)

**Tyler's calls (2026-10-06):**
- Build it around the **33′ Deepwater Charter** (outboard).
- The features heading is **"Charter Features"**, not "Standard features".
- Name stays **"Deepwater Series"** (menu + homepage card unchanged).
- Kick line: `OFFSHORE · CUSTOM QUOTED · <span class="klgcy">LEGACY MODEL</span>` (Legacy goes AFTER Custom Quoted).
- Two videos side by side like Sportster (`.vid2`): Charter `riE_upVU_ak` (left) + Explorer `m4ehkABeqEg`
  (right). The Explorer has no full-size YouTube thumbnail (maxres 404s), so on 2026-10-07 Tyler
  supplied one: `assets/video-thumbs/deepwater-explorer.jpg`, used EXACTLY as he sent it (1920×1080,
  no re-compression; the link carries `?v=3` to beat Cloudflare's cache). The Charter still uses YouTube's
  own maxres thumbnail.
- Feature sub-headings follow the MAIN models (Alaskan XL IB), all 5: Hull & Structure, Fuel System,
  Interior & Exterior Features, Power & Performance, Helm & Electrical. (Not the 4-heading outboard pages.)

**Done:** kick label; Brochure + Start a Quote plates (`assets/docs/DEEPWATER-CHARTER_Brochure_2024.pdf`, a copy
of SALES TOOLS `BROCHURES/DEEPWATER CHARTER OB-BROCHURE-DIGITAL.pdf`, chmod 644); the two videos; empty
`<!-- SPECS:deepwater -->` markers after the videos. Checked at 1440 + 390: no sideways scroll, 0 broken
images, 0 console errors. Tyler committed this as `e43d7cbb`.

**Charter Features REMOVED (Tyler, 2026-10-07):** "take the Charter Standard features off the Deepwater page
for now." Don't add a features section back until he asks. The 66-line list (5 headings, 13/4/24/2/23) is
saved in commit `e43d7cbb` (`git show e43d7cbb:models/deepwater/index.html`) if he wants it again. Open
questions 2–4 below only matter if it comes back.

**Sources:** the SALES TOOLS Charter brochure (above) and the live www page `/models/deepwater/`, which is a
3-version series (Charter / Explorer / Angler, each with its own feature list, plus test results for twin
Yamaha 300 and twin Suzuki 350). There's no Deepwater spec PDF in `SPECS-STANDARD FEATURES/` yet. The old site
also has spec sheets: `wp-content/uploads/2020/01/2020-33-DEEPWATER-CENTER-PILOT-YAMAHA.pdf`,
`…/2021-33-DEEPWATER-EXPLORER-TWIN-SUZUKI-350-2.pdf`, `…/2024/01/2024-Deepwater-Charter-white-1.pdf` (not downloaded).

**OPEN: ask Tyler before building these:**
1. **Spec conflicts** (brochure vs live page): length 33′ vs 33′ 6″; beam 98″ vs 10′ (120″); bottom width 84″
   vs 114″; bottom gauge .250 vs .250 plus .375 in the center of the hull; weight 7,460 lbs (brochure only).
   They AGREE on: side height 55″ bow / 44″ transom, side gauge .190, deadrise 20°, bow deadrise 50°, fuel
   200 gal. No motor rating in either source, so ask if he wants a Power Ratings row at all. If the brochure
   numbers turn out wrong, the linked brochure PDF needs fixing too.
   Single length, so the specs-data entry is `"lengths":["33 ft."]` with `"summary"` set to fit
   (no weight → "Dimensions &amp; Power", or "Dimensions" if no power row).
2. **Power & Performance** has only the motor bracket + "Full reverse chine with delta pad bottom" (the Charter
   has no standard engine). OK, or move the chine back to Hull & Structure?
3. **Two live-page Charter lines** not in the brochure: "Wooldridge Full Support Structure System" and "Dual side
   rub channels". Add them?
4. **Spelling fixes made to the brochure text:** "panograph" → "pantograph", "VisonX" → "Vision-X", and the cut-off
   "One SHOXS 6300 upholstered suspension" finished as "…suspension seat for captain" (from the live page).
5. **Intro text** is still the generic series blurb ("sportfishing, expedition cruising, or working duty").
   Offer a Charter-specific intro from the brochure text.
6. ~~Photos~~ DONE 2026-10-07, see below.

**PHOTOS DONE (2026-10-07, "Model Ready", `DEEPWATER-WEB`):** two 33′ boats built for different purposes:
**Angler** (hull 3981: 48 desktop / 48 phone) and **Explorer** (hull 3832: 37 desktop / 38 phone).
- **Captions** (Tyler): "33′ Deepwater · Explorer · Hull #3832". Caption name is **"Deepwater"** (`@MODELS`
  `['deepwater','Deepwater','Offshore',[33],33]`); the page title stays "Deepwater Series".
- **New trims** `explorer` / `angler` in all 4 scripts. Tyler's files put the trim AFTER the model name
  (`NN-3981-33-DEEPWATER-ANGLER.jpg`), so the parsers now fall back to the first known trim further along.
- **Lengths up to 39′** in all 4 scripts (they stopped at 32).
- **One gallery card PER BOAT** (Tyler: "same length but built for very different purposes"), Agency-style
  with a blue Rockwell title (ANGLER / EXPLORER) above each: page switch `<script>window.WB_CARDS_BY='cfg';</script>`
  + build with **`BYCFG=1`** (covers `cover-33-angler.jpg` / `cover-33-explorer.jpg`, WB_COVERS keyed by
  "Angler"/"Explorer"). Card text "33′ Deepwater Angler / Hull #3981". The bottom grid's chips are All /
  Angler / Explorer, and taps (phone grid too) stay inside one boat.
- **Hero slider** like the Agency page (`assets/hero-slider.js`), hand-written in the page: 01 Angler
  `hero-3981-33-angler.jpg`, 02 Explorer `hero-3832-33-explorer.jpg`. Tyler's numbered heroes
  `01-HERO-…`/`02-HERO-…` are all copied by the builder; the first is `thumbs/hero.jpg`. The builder's
  single-hero rewrite leaves the slider alone.
- **Layout:** slider → intro (2nd paragraph centred) → gallery cards → Brochure/Quote buttons (Tyler: buttons
  BELOW the galleries, like Canyon) → videos → specs slot → Photo gallery → fine print.
- **Rebuild:** `BYCFG=1 _build/apply_model_photos.sh deepwater "Deepwater" "<…/DEEPWATER-WEB>"`.
- **Checker now covers the phone folders** (2026-10-07): a double #19 in the Angler phone folder had slipped
  past. Duplicates that would overwrite each other and leftover `-1` copies are errors. Tell Tyler which
  files aren't right; he or I fix them (never a "b" suffix).
- No LM tokens on the files, so no gold Legacy tags on the cards, captions or hero (only the kick line).
- **Still open:** the spec table (item 1); the intro text (item 5); Tyler's message had a cut-off "Use the ." (ask).
- **Deploy collision (2026-10-07, 13:38):** the Instagram bot pushed 17 s before Tyler's Deepwater push,
  so two cPanel deploys overlapped. The live site ended up with the NEW pages but the OLD `assets/` (old
  gallery.js + photo-data.js, no Deepwater photos), so it showed one 33′ card and broken images. The fix is
  a clean re-push, or cPanel → Git Version Control → Manage → Pull or Deploy → "Deploy HEAD Commit". Then
  Cloudflare → Purge Everything, because the host sends max-age=14400 even on 404s and Cloudflare kept the
  "not found" answers. When checking a live deploy, request photo URLs WITH a unique `?nc=` query so the
  check itself doesn't cache 404s on the real URLs.

---

## The Canyon recipe (what we did, in order)

### 1. Boat Specifications (the fold-out table)
- **Source of numbers:** Tyler's SALES TOOLS PDFs, OneDrive
  `…/Wooldridge Boats Inc_ - SALES TOOLS/SPECS-STANDARD FEATURES/<MODEL> IB|OB-SPECS-STANDARD FEATURES.pdf`
  (page 1 = spec table, page 2 = standard features). Cross-check against the live WordPress page
  `www.wooldridgeboats.com/models/<slug>/` and the brochure in `assets/docs/`.
  **Deepwater has NO PDF there yet (2026-10-06)**, so ask Tyler for one.
- **Never guess:** when sources disagree, ASK. For Canyon, Tyler picked bottom gauge .190, bow
  deadrise 18/17/17/17, fuel 77 gal, and NO jet row (the sources said 212/214/241).
- **Data file:** add an entry to `_build/specs-data.json`. Lengths are labels like `"21 ft."`.
  Rows go in house order: Length Overall, Beam, Bottom Width, Side Height, Bottom Gauge, Side
  Gauge, Deadrise, Deadrise At Bow, Fuel Tank; then "Power Ratings": Standard Motor.
  Value formats: `102 in.`, `21 ft. 6 in.`, `.190 in.`, `12°`, `77 gal.`. With no weights, add
  `"summary": "Dimensions &amp; Power"` (the default says "Weight").
- **Page:** replace any old spec markup with `<!-- SPECS:<slug> -->` + `<!-- /SPECS -->`, then run
  `python3 _build/build_specs.py <slug>`.

### 2. Standard features
- **Placement:** hand-written, right after the SPECS block, same markup as the main models:
  `<div class="sechead tight"><div class="eyebrow">Included On Every Boat</div><h2 …>Standard features</h2></div>`
  then `<div class="stdgrid"><div class="stdsec"><h3>Hull & Structure</h3><ul><li>…`.
- **Categories:** 5, in this order: Hull & Structure, Fuel System, Interior & Exterior Features,
  Power & Performance, Helm & Electrical. One feature per `<li>`.
- **PDF gotcha:** these PDFs merge brochure + dev-site text with "(WEB)"/"(brochure)" tags and
  two values in one line. Strip the tags, make those lines agree with the spec table, and TELL
  Tyler which lines you changed.

### 3. Page layout + labels
- **Section order** (like the main models): hero → intro → gallery cards → buttons → (video) → Boat
  Specifications → Standard features → Photo gallery → fine print → back bar. No Pricing, no
  Build & Price button.
- **Legacy label:** Canyon's kick line ends in gold LEGACY MODEL (#c37d0f):
  `INBOARD JET · 21 / 23 / 25 / 27 FT · <span class="klgcy">LEGACY MODEL</span>`. That replaced
  "CUSTOM DIMENSIONS ON REQUEST"; the CSS `.pagemast .kick .klgcy` already exists. Ask Tyler if
  Deepwater gets it ("OFFSHORE · CUSTOM QUOTED" now).
- **Video:** Canyon's "VIDEO COMING SOON" block was removed (Tyler). Deepwater carries a REAL
  video, `data-yt="m4ehkABeqEg"` "33' Wooldridge Deepwater Explorer". Ask keep or remove.
- **Intro text:** if it's several paragraphs, centre the 2nd and later ones too, because
  `.modelhero + p` only centres the first.

### 4. Photos ("Model Ready", standard pipeline; see memory `website-photo-replacement-workflow`)
- **The page is BARE (no hero/gallery), so insert the photo sections BEFORE building** (the
  builder only replaces):
  - after `<section class="pagebody"><div class="wrap">\n` →
    `  <figure class="modelhero"><img src="" alt=""><figcaption>DEEPWATER<span class="ref"></span></figcaption></figure>\n`
  - before `  <div class="modelctas">` → `  <div class="modelcards-slot"></div>\n`
  - before `  <p class="fineprint"` → the "In The Field / Photo gallery" sechead + lede +
    `<div class="gallery captioned"></div>`
  - before `<script src="../../assets/shop.js` →
    `<script src="../../assets/photo-data.js"></script><script src="../../assets/gallery.js"></script>`
- **Gallery model list:** add the model to `_build/build_gallery.pl` `@MODELS`, e.g.
  `['deepwater','<Name>','Offshore',[<offered lengths>],undef]`. Without it the photos never reach
  photo-data.js.
- **Warm + pre-flight:** warm the folder first
  (`find "<SRC>" -name '*.jpg' -exec cat {} + >/dev/null`), then run
  `[NOCFG=1] _build/check_model_photos.sh "<SRC>"`. Watch for files whose length token doesn't
  match their folder (Canyon's 25-folder held 26′ files; Tyler renamed the folders).
- **Build:** `[NOCFG=1] _build/apply_model_photos.sh <slug> "<Name>" "<SRC>" --dry-run`, then the
  same without `--dry-run`. It does desktop + phone sets, covers, hero, photo-data,
  provenance and stamps in one go.
- **Legacy tags:** an `LM` token on the files gives the gold hero tag, the "Legacy Model"
  captions, and a gold pill on any card whose photos are ALL LM (gallery.js rule, 2026-10-06).
- **Card sub-line:** no-config galleries say "<Model> builds". Canyon shows "Hull #NNNN" instead
  via `<script>window.WB_CARD_HULL=true;</script>` before the photo-data.js tag (Canyon ONLY,
  Tyler's call). Ask Tyler before turning it on for Deepwater.
- **Bottom photo grid:** automatic. Desktop shows the landscape grid with length chips. Phones
  (≤700px) show the PORTRAIT phone set 2 across, opening at 12 with "Show all". A page without
  phone photos caps its landscape grid at 12 on phones.

### 5. Check + hand over
- **Local preview:** macOS blocks the preview server from ~/Desktop, so serve a scratchpad copy:
  rsync the page + `house.css` + `assets/*.js` + `assets/brand,fonts` +
  `assets/photos/<slug>` into `<scratchpad>/site/`, run `python3 -m http.server 8813` there, then
  `preview_start({url:'http://127.0.0.1:8813/models/<slug>/'})`.
- **What to check:** desktop 1440 + phone 390 (cards, viewer captions, chips, phone grid), 0
  broken images, 0 console errors.
- **Screenshots:** use the in-app browser or the WebKit `snap` tool (memory
  `no-headless-chrome-app-management`). NEVER headless Chrome: it trips macOS App Management.
- **Hand-off:** leave it uncommitted. After Tyler pushes, live-check: curl the page and request
  every photo URL (all 200). Don't byte-compare HTML, because Cloudflare rewrites the footer email.

## Other open threads (2026-10-06)
- **Phone sets coming:** Tyler is making phone (-MOBILE) sets for the 11 models without them:
  alaskan-lt, alaskan-xl-inboard, alaskan, alaskanxl, landing-craft, rogue, skagit, sport,
  sportster, supersportdrifter, xlt. Re-run their Model Ready (or
  `apply_mobile_gallery.sh <slug> "<SRC>"`), and the phone grid turns on by itself.
- **Agency & Work Boats:** its own handoff is `_build/AGENCY-READY-HANDOFF.md`.
