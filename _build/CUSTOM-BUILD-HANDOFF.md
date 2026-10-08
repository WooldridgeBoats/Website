# Custom Build pages — paste this into a NEW chat window

Copy everything in the box below as your first message in a new chat. Everything else in this
file is the log the new chat reads: status, Tyler's rules, the toolbox, and how each page was built.

---

Continuing the Wooldridge dev site (dev.wooldridgeboats.com) in ~/Desktop/LOCAL-WEBSITE: the
CUSTOM BUILD pages. Canyon, Deepwater, River Rat and Landing Craft are done. Still to do: SSO Angler
(models/angler/), SSO Pilothouse (models/supersportoffshorepilothouse/) and Pybus Point Lodge
(models/pybus-offshore/; renamed from Pybus Offshore, the URL stays). FIRST read
`_build/CUSTOM-BUILD-HANDOFF.md` and my memory notes `wooldridge-model-lineup`,
`website-photo-replacement-workflow`, `model-ready-check-first`, `no-image-recompression`,
`tyler-pushes-to-github`, `desktop-tcc-eperm` and `no-headless-chrome-app-management`.

I'll send a model's photo folder (OneDrive …/MASTER-WEBSITE PHOTOS/<MODEL>-WEB/) with "Model Ready"
and tell you how that page should look. Custom pages are a mix of the Agency page and Canyon, and
each one is a bit different, so don't force the main-model layout on them. Check my folder first and
tell me which files aren't named right. Ask me before guessing. Check desktop 1440 + phone 390.
When it's done and checked, COMMIT it and tell me when to push (I push in GitHub Desktop).
Fix my spelling; call me Bro; plain English.

---

## Status (2026-10-08)

| Page | Status | Notes |
|---|---|---|
| Canyon `models/canyon/` | DONE, live | Specs fold + standard features, Legacy label, 3 galleries (23/24/26, all LM), hull # on cards |
| Deepwater `models/deepwater/` | DONE, live | Hero slider, one card per boat (33′ Angler + 33′ Explorer), mixed bottom grid, 2 videos. **No spec table and no standard features (Tyler, 2026-10-08)** |
| River Rat DIY Kit `models/riverrat-diy-kit/` | DONE, live | Minimal: one gallery, no length / hull / config, no video |
| SSO Angler `models/angler/` | TO DO | Bare page (no photos), "video coming soon" block, a Build & Price button into the SSO configurator |
| SSO Pilothouse `models/supersportoffshorepilothouse/` | TO DO | Bare page, REAL video `h6p-gE16A9s` "30' Wooldridge Super Sport Offshore Pilothouse", Build & Price button into the SSO configurator |
| Pybus Point Lodge `models/pybus-offshore/` | TO DO | Bare page, "video coming soon" block. Renamed from Pybus Offshore 2026-10-08: ONLY the h1, `<title>` and menu label changed; the URL and homepage card were left as-is on purpose. **It's a FLEET page** (Tyler): the boats Wooldridge built for Pybus Point Lodge (Admiralty Island, SE Alaska) = five 33′ Deepwaters, two 21′ Sport Offshores, three 20′ Sport center consoles. Intro rewritten to say so. Kick line "LODGE FLEET · ADMIRALTY ISLAND, ALASKA" (tag line under it not changed yet). Two videos side by side (`.vid2`, 2026-10-08), both on the LODGE's YouTube channel, so the caption ref says "PYBUS POINT LODGE ON YOUTUBE": `RvhoaaWAktg` "33′ Deepwater Charter Walkthrough" (11:19) + `Sx_vdR7VTmI` "Pybus Point Lodge Skiffs" (2:49) |
| Landing Craft `models/landing-craft/` | DONE 2026-10-08 | Hero slider (24′ Cabin, 21′ CC), one card per length, per-length model names (LC-1292 / LC-1892) via `WB_LEN_NAME`. No video, no specs, no standard features |

No master folders exist yet for the 3 to-do pages (MASTER-WEBSITE PHOTOS has CANYON-WEB,
DEEPWATER-WEB, RIVER RAT-WEB, LANDING CRAFT-WEB plus the main models).

**Ask Tyler when each to-do page comes up:** Legacy Model label on the kick line? Keep, remove or
"coming soon" the video (Pilothouse has a real one)? Keep the Build & Price button on Angler /
Pilothouse (Canyon has none, since customs aren't in the configurator)? Display name for captions?
Specs / standard features (Deepwater and River Rat have none; Canyon has both)? One card per
length, per boat, or one gallery? Hero or hero slider?

## Tyler's rules (all custom pages)

- **Each custom page is its own thing:** a mix of the Agency page and Canyon, and each one differs.
- **Check first:** on "Model Ready", run `_build/check_model_photos.sh` on that folder (it covers the
  `*-MOBILE` phone folders too) and tell Tyler which files aren't named right. He or I fix them.
  Duplicates get renumbered properly, never a "b" suffix. Only check the folder being built.
- **Never guess** at specs, labels, names or videos: ask.
- **Video thumbnails he supplies go in byte-for-byte** (no resizing or re-compressing). If one
  replaces a file already live, add `?v=N` to its `<img src>`.
- **Commit, then tell him to push** (since 2026-10-08). Commit each finished, checked page on its own;
  he pushes in GitHub Desktop. Never `git push`.
- **Buttons sit BELOW the gallery cards** (`modelcards-slot` before `modelctas`), like Canyon.
- **Center the 2nd+ intro paragraphs** (`.modelhero + p` only centers the first).
- **Screenshots:** send them for new builds. Use the in-app browser or `_build/snap.swift`. NEVER headless Chrome.

## Deploys (learned 2026-10-07)

- **Instagram bot collision:** `instagram-feed.yml` pushes to main on its own. Since 2026-10-08 it runs
  ONCE A DAY at 10:23 UTC (about 3 AM Pacific), so it shouldn't collide anymore; before that it ran hourly. If it pushes seconds before Tyler, GitHub Desktop errors with "newer commits on remote",
  he merges, and two cPanel deploys overlap. That left new pages with OLD `assets/`. Fix: a clean
  re-push, or cPanel → Git Version Control → Manage → Pull or Deploy → "Deploy HEAD Commit".
  Before telling him to push: `git fetch`, and if the bot pushed, `git pull --rebase` so our commits
  sit on top (no merge commit, no overlapping deploys).
- **Cloudflare keeps 404s for 4 hours** (the host sends max-age=14400 even on 404). Check live
  photo URLs with a unique `?nc=<time>` query, never the plain URL, while a deploy is running.
  Tell Tyler to wait for "it's live" before opening a new page. If stale files stick:
  Cloudflare → Caching → Configuration → Purge Everything (his buddy has access). His own browser
  may also need a hard refresh (Chrome Cmd+Shift+R, Safari Cmd+Option+R).
- **Live check after a push:** the page loads with `?nc=`; every image/script URL on it returns 200;
  the versioned gallery.js / photo-data.js through Cloudflare contain the new code; then load it in
  the browser at 1440 + 390. Don't byte-compare HTML (Cloudflare rewrites the footer email).

## Toolbox

**Builds**
- `_build/apply_model_photos.sh <slug> "<Name>" "<SRC>" [--dry-run]`, the standard Model Ready
  (desktop + phone + covers + hero + photo-data + provenance + stamps). Env flags:
  `NOCFG=1` (no trim, e.g. Canyon), `BYCFG=1` (same-length boats keyed by trim, e.g. Deepwater),
  `PHOTOSLUG=` (photo dir ≠ page dir). Lengths 14–39. Trims: cc ws tiller aft-ws cabin pybus
  first-responder explorer angler (a trim may also come AFTER the model name). Numbered heroes
  `NN-HERO-…` are all copied for a slider.
- `_build/build_riverrat.sh`: a one-gallery page with NO length (River Rat). Copy its pattern for
  another no-length page.
- New model: add it to `_build/build_gallery.pl` `@MODELS` or its photos never reach photo-data.js.
- A bare page needs the photo sections INSERTED first (the builder only replaces): hero figure after
  `<section class="pagebody"><div class="wrap">`, `<div class="modelcards-slot"></div>` before
  `modelctas`, the "In The Field / Photo gallery" sechead + `<div class="gallery captioned"></div>`
  before the fineprint, and `photo-data.js` + `gallery.js` script tags before shop.js.

**gallery.js page switches** (inline `<script>` before the photo-data.js tag; pages without them are unchanged)
- `window.WB_CARD_HULL=true`: a no-trim card says "Hull #NNNN" (Canyon).
- `window.WB_CARDS_BY='cfg'`: one card per trim, Agency-style with a blue `.agtitle` above each
  (`.agcards` layout); chips + taps split by trim; bottom grid mixed by trim (Deepwater).
- `window.WB_GRID_PREVIEW=16`: with WB_CARDS_BY, the desktop grid opens at 16 + "View all N photos".
- `window.WB_GRID_LEAD={d:{Angler:[1,2…]},m:{…}}`: those order #s lead the bottom grid (d = desktop,
  m = phone set) (Deepwater: on-water shots first; on phones, the ones without black bands).
- `window.WB_CARD_SUB='Customer builds'`: the card's 2nd line for a no-trim, no-hull gallery (River Rat).
- `window.WB_LEN_NAME={"21":"LC-1292",…}`: each length gets its own model name in the cover card title
  and viewer caption, and the grid captions (desktop + phone) flip to "24′ LC-1892" over "Cabin" (Landing Craft).
- WB_MOBILE keyed `"all"` = a no-length model's phone set (River Rat).

**Hero slider:** `figure.modelhero.hslider` with `.hs-slide[data-cap][data-hull]` + `assets/hero-slider.js`
(defer), hand-written in the page (copy Deepwater's or the Agency page's). The builder leaves it alone.

**Local preview:** macOS blocks the preview server from ~/Desktop, so serve a scratchpad copy: rsync
the page + `house.css` + `assets/*.js` + `assets/brand,fonts` + `assets/photos/<slug>` into
`<scratchpad>/site/`, run `python3 -m http.server <port> --bind 127.0.0.1` there (Bash, background), then
`preview_start({url:'http://127.0.0.1:<port>/models/<slug>/'})`. If the pane is hidden, lazy images
don't load and screenshots come out blank; check the DOM, or use `_build/snap.swift`.

---

## How each page was built

### Canyon (2026-10-06): the full recipe
1. **Specs fold:** numbers from Tyler's SALES TOOLS PDF
   `…/Wooldridge Boats Inc_ - SALES TOOLS/SPECS-STANDARD FEATURES/<MODEL> IB|OB-SPECS-STANDARD FEATURES.pdf`
   (page 1 = specs, page 2 = features), cross-checked against the live www page and brochure. When
   sources disagree, ASK (Tyler picked bottom .190, bow deadrise 18/17/17/17, fuel 77, no jet row).
   Add an entry to `_build/specs-data.json` (lengths `"21 ft."`, house row order, formats `102 in.`,
   `21 ft. 6 in.`, `.190 in.`, `12°`, `77 gal.`, `"summary": "Dimensions &amp; Power"` with no
   weights), put `<!-- SPECS:<slug> -->` + `<!-- /SPECS -->` in the page, run
   `python3 _build/build_specs.py <slug>`.
2. **Standard features:** hand-written `stdgrid` after the specs, the 5 main-model headings (Hull &
   Structure, Fuel System, Interior & Exterior Features, Power & Performance, Helm & Electrical).
   The PDFs carry "(WEB)"/"(brochure)" tags and double values: clean them and tell Tyler what changed.
3. **Labels:** kick line ends in gold `<span class="klgcy">LEGACY MODEL</span>`; "video coming soon" removed.
4. **Photos:** `NOCFG=1 _build/apply_model_photos.sh canyon "Canyon" "<…/CANYON-WEB>"`. Every file has an
   `LM` token, so the hero, captions and cards carry gold Legacy tags. `WB_CARD_HULL=true`.

### Deepwater (2026-10-07)
- Tyler's calls: name "Deepwater Series"; kick `OFFSHORE · CUSTOM QUOTED · LEGACY MODEL`; Brochure
  button (`assets/docs/DEEPWATER-CHARTER_Brochure_2024.pdf`) + Start a Quote; Charter + Explorer
  videos side by side (`.vid2`; Explorer thumb `assets/video-thumbs/deepwater-explorer.jpg?v=3`,
  Tyler's file as-is). **No spec table, no standard features** (the Charter list was built then
  removed; it's in commit `e43d7cbb` if ever wanted).
- Photos: `BYCFG=1 _build/apply_model_photos.sh deepwater "Deepwater" "<…/DEEPWATER-WEB>"`. Two 33′ boats,
  Angler (hull 3981: 48 desktop / 48 phone) and Explorer (hull 3832: 37 / 38). Captions
  "33′ Deepwater · Explorer · Hull #3832". Hero slider 01 Angler / 02 Explorer. Page switches:
  WB_CARDS_BY='cfg', WB_GRID_PREVIEW=16, WB_GRID_LEAD (on-water shots; on phones, no black bands).
- Tyler's export put black bands in the phone photos Angler 19–48 and Explorer 08–26 (landscape
  letterboxed into 4:5). If he re-exports them, run `apply_mobile_gallery.sh deepwater "<SRC>"` and
  update the `m` list in WB_GRID_LEAD.

### River Rat DIY Kit (2026-10-07)
- One gallery, no length, hull or config, no specs/features, video removed. "Just a few photos to
  show kits customers have built."
- Master `RIVER RAT-WEB/`: `HERO-RIVER RAT.jpg`, `RIVER RAT/NN-RIVER RAT.jpg` + GALLERY-THUMB,
  `RIVER RAT-MOBILE/NN-RIVER RAT-MOBILE.jpg`. Build: `_build/build_riverrat.sh` (re-run when photos are added).
- Hero strip "RIVER RAT — DIY KIT" / "CUSTOMER BUILD"; card "River Rat DIY Kit / Customer builds".

### Landing Craft (2026-10-08)
- Tyler's calls: 2 lengths, a 21′ Center Console (hull 5081) and a 24′ Cabin (hull 4632); hero slider
  like the Agency page (01 = 24′ Cabin, 02 = 21′ CC); video section removed; NO specs or standard
  features ("super custom boats"). h1 stays "Landing Crafts", kick "WORKBOAT · CUSTOM QUOTED", no
  Legacy label (not asked for). `@MODELS` lens is `[]`, so nothing auto-tags as legacy.
- **Model names (Tyler, 2026-10-08):** each landing craft's MODEL NAME is `LC-NNNN` (the number is NOT the
  hull): `NN-HULL-LEN-CFG-LC-1292.jpg` = LC-1292 (21′), `…-CABIN-LC-1892` = LC-1892 (24′). Hero caption:
  "Landing Craft LC-1892 — 24′ Cabin". Photo captions: "24′ LC-1892 · Cabin · Hull #4632" (viewer),
  "24′ LC-1892" over "Cabin" (cards + grid). The builder ignores tokens after the config, so the page
  sets `WB_LEN_NAME` (see the switches).
  The number sits after LC, so it can't be misread as a hull (hulls come right after NN, and 1xxx
  isn't a hull pattern anyway).
- Build: `_build/apply_model_photos.sh landing-craft "Landing Craft" "<…/LANDING CRAFT-WEB>"`. 30 + 26
  desktop, 31 + 25 phone. The slider is hand-written; a re-run leaves it and `WB_LEN_NAME` alone.

## Menu (Tyler, 2026-10-08)
- Our Boats → Custom Builds order: Agency & Work Boats, Landing Craft, SSO Angler, Pybus Point Lodge,
  Deepwater Series, Canyon, SSO Pilothouse, River Rat DIY Kit (`header.html`, then
  `perl _build/inject_partials.pl`). The model-page prev/next arrows follow it (`assets/pagenav.js` ORDER).
- Column headings read INBOARD JET / OUTBOARD JET.

## Other open threads
- **Phone sets:** Tyler is making phone (-MOBILE) sets for the main models without them (alaskan-lt,
  alaskan-xl-inboard, alaskan, alaskanxl, landing-craft, rogue, skagit, sport, sportster,
  supersportdrifter, xlt). Re-run their Model Ready (or `apply_mobile_gallery.sh <slug> "<SRC>"`).
- **Agency & Work Boats** has its own handoff: `_build/AGENCY-READY-HANDOFF.md`.
- Also done this session (in git): the phone menu scrolls on its own and hides the corner pills;
  the desktop mega menu order is Offshore, Inboard, Outboard, Custom Builds, Tools; the "Not sure
  which boat?" pill is softer and shrinks to a "?" (10s on phones, 30s on desktop); Scout's 21′ cover.
