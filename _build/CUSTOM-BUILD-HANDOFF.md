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
