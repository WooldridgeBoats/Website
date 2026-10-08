# "Agency Model Ready" — paste this into a NEW chat window

Copy everything in the box below as your first message in a new chat. Then send
the next boat folder and say "Agency Model Ready!". The full log of how this page
works is under the box; the new chat reads it from this file.

---

Continuing the **Agency & Work Boats** page (dev.wooldridgeboats.com/agency-work-boats/)
in ~/Desktop/LOCAL-WEBSITE. FIRST read `_build/AGENCY-READY-HANDOFF.md` (the full log)
and my memory notes `agency-work-boats-page`, `tyler-pushes-to-github`,
`url-matches-page-name` and `desktop-tcc-eperm`. This page is a CUSTOM layout with its
own rules; it is NOT the standard Model Ready / model-page pipeline.

Trigger: I say "Agency Model Ready!" (or "Custom Model Ready") + attach the boat's
folder(s) from OneDrive …/MASTER-WEBSITE PHOTOS/AGENCY-WORK-WEB/ (the X Drive copy
…/PHOTOS-BOAT MODEL-MASTER/AGENCY-WORK/AGENCY-WORK-WEB/ mirrors it). Then:
1. Warm the files (find "<folder>" -name '*.jpg' -exec cat {} + >/dev/null). If I
   link the X Drive, diff it against OneDrive first; build from whichever is complete
   (the builder takes the source folder as an argument).
2. `perl _build/build_agency_galleries.pl --dry-run`. It must be clean. A NEW mission
   word (purpose token) or model/config code → ASK me the wording, then add it to
   %PURPOSE / %MODEL / %CFG at the top of the script. A boat with a YouTube video →
   add its link to %VIDEO; its VIDEO-THUMB-…jpg goes in the boat's desktop folder.
   A new boat goes at the END of the card order until I say where (@ORDER).
3. Run it for real. It rebuilds every gallery, the page block and the cache stamps.
4. Check in the browser (desktop 1440 + phone 390): cover loads, the viewer count
   matches, the phone set opens. The local preview must be served from a scratchpad
   copy (see "Local preview" in the log). SEND me screenshots as files.
5. COMMIT it when it's done and checked, then tell me when to push (I push in GitHub
   Desktop). Before that, `git fetch` and `git pull --rebase` if the Instagram bot
   pushed. After I push, check the live page
   (titles + every image URL = 200; never byte-compare the HTML, because Cloudflare
   rewrites the footer email).

Rules I set: one gallery card per boat, 2 across; the mission is a blue Rockwell
caps title ABOVE each card; FIRE = "Fire & Rescue" (FIRE ONLY = "Fire"); spell out
agencies (USCG → U.S. Coast Guard, USFWS → U.S. Fish & Wildlife Service, NW ENERGY →
NorthWestern Energy, WDFW → WA Dept. of Fish & Wildlife); a card shows ONE hull (the cover's if hulls are mixed); a boat
WITH a video = photo card left, video card right, the title centred over both
(phones: title, photos, video); fix my spelling; call me Bro; plain English.

Status: 11 galleries (see the log); 20′ Skagit USGS Electroshock has the first video.
Still to come: more 20-CC-SKAGIT/<mission> sub-folders. Ready — I'll drop the next boat.

---

## The full log (how the page works, every rule we settled)

### Page + address
- Page: `agency-work-boats/index.html` → https://dev.wooldridgeboats.com/agency-work-boats/
  (moved 2026-10-05 from `/custom-agency-builds/`; new URLs must match the page name).
- `/custom-agency-builds/index.html` is a **noindex redirect stub** to the new address.
  KEEP it: the live www.wooldridgeboats.com is still the old WordPress site and has a
  real "Custom Agency Builds" page there. It can be deleted ~3-6 months after the
  WordPress → new-site cutover. (The 5 old case-study stubs under it were deleted, and
  `.cpanel.yml` removes them from the host.)
- Masthead: title **AGENCY & WORK BOATS** → **BUILT FOR THE MISSION** (Inter Medium,
  caps) → PATROL · RESCUE · RESEARCH · SURVEY · UTILITY. The intro text is kept. No
  "Photo galleries" heading (Tyler removed it).
- Nav: "Agency & Work Boats" is FIRST in Our Boats → Custom Builds, and in the footer's
  top row. Homepage: first card in "Specialty & custom builds"; its "Explore by Power,
  Purpose & Water" tile uses `assets/photos/agency-work/thumbs/slide-01-5336-20-cc.jpg`.

### Hero slider (top of the page)
- 8 photos (since 2026-10-08), auto-advances every **4s**, loops; arrows (70% opacity), dots, swipe.
  Code: `assets/hero-slider.js` + `.hslider` CSS in house.css.
- The slides are **hand-written** in the page (`data-cap`, `data-hull`). They are NOT made
  by the builder. Files: `assets/photos/agency-work/slide-NN-HULL-LEN-cc.jpg`, copied
  from the master's top-level `0N-HERO-…jpg` byte-for-byte. Each `<img src>` ends in
  `?v=` + the first 10 of the photo's md5, so a re-exported photo gets a new URL
  (Cloudflare caches images ~4h). Update the `agency-work/slide-…` keys in
  `assets/media-provenance.js` by hand (the builder doesn't touch them), then run
  `stamp_assets.pl`. Before swapping, md5 the master heroes against the live slides:
  Tyler's "small change" on 2026-10-08 was 2 new photos + 2 re-edited ones + a re-order.
- Caption format: `MODEL — LEN′ CONFIG — MISSION` + `HULL #` on the right (caps). Phone:
  row 1 = model + hull, row 2 = the rest. The slider uses the SAME mission wording as
  the galleries (Fire & Rescue, U.S. Coast Guard, …), so a new slide needs it typed in.
- Current slides (2026-10-08): 01 BSR SW USCG #5336 · 02 Skagit 20 Work Boat #5348 ·
  03 Alaskan XL Inboard 20 First Responder #5320 · 04 Skagit 18 Fire & Rescue #4572 ·
  05 BSR SW USCG #5335 · 06 Landing Craft Super Sport Drifter 23 Water Rescue #3938 ·
  07 Skagit 20 Fire & Rescue #4552 · 08 Skagit 20 Work Boat #5348 (a second shot of 02's
  boat; its master token is WORK BOAT, 02's is WORK, both caption "Work Boat").

### Master folders + file names
- Source of truth: **OneDrive** `…/MASTER-WEBSITE PHOTOS/AGENCY-WORK-WEB/`. The X Drive
  mirrors it but has been ahead/behind for a few minutes at a time. Diff before trusting.
- File name: `NN-HULL-LEN-CFG-MODEL-PURPOSE[-MOBILE].jpg`, e.g.
  `03-5320-20-CC-AK XL-IB-FIRST RESPONDER.jpg`. A HERO token is ignored. The model may
  contain dashes (`AK XL-IB`). Everything after the model is the PURPOSE (mission).
- Cover: `GALLERY-THUMB-HULL-LEN-CFG-MODEL-PURPOSE.jpg` (or plain `GALLERY-THUMB.jpg` in a
  one-boat folder). No cover = photo 01.
- Video thumbnail (2026-10-06): `VIDEO-THUMB-HULL-LEN-CFG-MODEL-PURPOSE.jpg` (16:9, e.g.
  1920×1080) in the boat's DESKTOP folder = the video card's picture. Tyler pastes it in
  chat; save it into the master under that name (done for USGS Electroshock: OneDrive
  only, Tyler copies it to the X Drive). No VIDEO-THUMB = YouTube's own thumbnail.
- Sizes: desktop **2000×1250**, phone **1080×1350**. The builder warns on anything else.
- Two layouts, both supported:
  - FLAT: `18-CC-SKAGIT/` + `18-CC-SKAGIT-MOBILE/`. The gallery is worked out from each
    file name (len+cfg+model+purpose).
  - SUB-FOLDER (for models with many builds): `20-CC-SKAGIT/20-CC-SKAGIT-FIRE/` + phone in
    `20-CC-SKAGIT-MOBILE/20-CC-SKAGIT-FIRE-MOBILE/` (or `20-CC-SKAGIT/…-MOBILE/`). **Each
    sub-folder = its own gallery**, so two Fire boats = two cards.
- A byte-identical duplicate photo (e.g. a phone folder left in two places) is skipped
  with a WARN. A DIFFERENT photo with the same number stops the build.

### The builder: `_build/build_agency_galleries.pl [--dry-run] ["/source/folder"]`
- Checks every name/size first and writes NOTHING on an error.
- Per gallery: copies the full-size photos UNTOUCHED (byte-for-byte), makes thumbs
  (800px desktop / 400px phone, for the viewer's filmstrip) and `cover.jpg` (1400px from
  the GALLERY-THUMB) in `assets/photos/agency-work/<key>/`, rewrites the block between
  `<!-- AGENCY-GALLERIES:BEGIN/END -->` in the page (the cards) AND the bottom photo grid
  between `<!-- AGENCY-PHOTOS:BEGIN/END -->`, updates WB_VETTED in
  `assets/media-provenance.js`, and runs `stamp_assets.pl`.
- Image URLs carry a content hash `?v=` (`$VERLEN` = 10). Bump it to force fresh URLs
  if cached 404s ever need flushing.
- Re-runs are safe and identical (verified). Order of cards: Tyler's hand-picked `@ORDER`
  list at the top of the builder (2026-10-06): First Responder, U.S. Coast Guard, Work
  Boat, 18′ Fire & Rescue, USGS Electroshock, 20′ Fire & Rescue, Water Rescue (added
  2026-10-08), NorthWestern Energy, WDFW, Research, USFWS. A boat not in the list goes at the end (auto order: length →
  model → mission) and the dry run warns. Ask Tyler where it goes, then add it. Moving
  cards only changes the page: the vetted-photo list is sorted, so no page restamps.
- Lookup tables at the top (add a line for anything new):
  - `%MODEL`: SKAGIT, SKAGIT-IB, SKAGIT-X, AK, AK LT, AK XL, AK XL-IB, AK XLT, BSR SW
    (stays "BSR SW"), SCOUT, SCOUT WB, ROGUE, SPORT, SPORT-IB, SPORTSTER, SSD, SSD IB,
    SO, SSO, LC, LC-OBJ-SSD → "Landing Craft Super Sport Drifter" (Tyler 2026-10-08:
    LC = Landing Craft, his word order, outboard jet not spelled out; it wraps to 2
    lines on a phone card, which he accepted).
  - `%CFG`: CC Center Console, WS Windshield, TILLER, CABIN, AFT-WS, PYBUS, OPEN, PH
    Pilothouse.
  - `%PURPOSE` (gallery wording): FIRE → Fire & Rescue · FIRE ONLY → Fire · USCG →
    U.S. Coast Guard · USFWS → U.S. Fish & Wildlife Service · NW ENERGY → NorthWestern
    Energy · WDFW → WA Dept. of Fish & Wildlife (2026-10-06: Tyler first picked the full
    name, then shortened it so it fits on ONE line). Titles over ~27 characters wrap on a
    desktop card (~586px at 30px), and Tyler wants one line, so when asking him to word a
    new mission, say whether it fits. Anything else = the token title-cased, keeping acronyms in `%ACRONYM`
    (USCG USN USACE USGS NOAA DNR WDFW ODFW USFWS FWS CBP DHS SAR EMS EMT FD PD LE).
    USGS ELECTROSHOCK reads "USGS Electroshock": Tyler gave that exact title, so USGS
    stays an acronym here (not spelled out like USCG).
  - `%VIDEO` (2026-10-06): gallery key → `{ yt => YouTube id, title => the YouTube title,
    len => 'M:SS' }`. Get the title + length from YouTube (oEmbed / the watch page's
    approxDurationMs). The dry run marks such boats "+ video", and refuses to build if
    the page stops loading `assets/modelpage.js` (that's what plays the videos), if a
    VIDEO-THUMB has no `%VIDEO` line, or if an id isn't 11 characters.

### How a gallery looks
- `.agcards`: BIG cover cards, **2 across** (1 on phones); an odd last card is centred.
- Above each card: the mission as a **blue Rockwell caps `h2.agtitle`** ("FIRE & RESCUE").
- On the card: "LEN′ Model" big white; "Config · Hull #NNNN" under it; photo count top-right
  (desktop count on desktop, phone count on phones).
- Hull on the card: the only hull, or for a mixed-hull gallery the COVER photo's hull.
- Tap → gallery.js's shared full-screen viewer (`window.WBGallery.open`, via
  `assets/agency-gallery.js`). Phones (≤700px) get the -MOBILE portrait set. Viewer
  caption: "LEN′ Model · Config · Mission · Hull #…" (per-photo hull).
- **A boat with a video** (Tyler, 2026-10-06): ONE full-width row instead of a card. The
  mission title is centred over the pair: photo card LEFT, video card RIGHT, in the same
  columns as the cards above. Both are 16:9 (the video's shape) so they sit level and
  the thumbnail's lettering isn't cropped. Video card: "Video · 3:23" pill, play button
  bottom-left + "Watch the video" ("Wooldridge Boats on YouTube" under it above 900px
  only; it wrapped on narrower cards). Tap → the site's YouTube lightbox from
  `assets/modelpage.js` (the page loads it since 2026-10-06), autoplay, Close/Esc stops
  it. Phones (≤640px): title, photos, video, stacked. CSS: `.agvid` / `.agpair` /
  `.agvidcard` in house.css.
- `.agcards` is a wrapping FLEX row (was a grid until 2026-10-06), so any card alone on
  its row centres itself: the odd last one, or one just before a video row.
- **Bottom "Photo gallery"** (Tyler, 2026-10-06; same look as the model pages' bottom grid),
  after the "Start an Agency Spec" button:
  - **Grid:** every boat's desktop thumbs in one captioned `.gallery.captioned.agrid` ("20′ Skagit / Work Boat"), written in ROUND-ROBIN order (each boat's 1st photo, then each 2nd…) so the opening rows show every boat.
  - **agency-gallery.js:** one filter chip per boat, labelled with its mission (a repeated title gets the length, e.g. "18′ Fire & Rescue"). "All" opens at 20 photos with a "Show all N photos" link, and tapping a photo opens THAT boat's set at that photo.
  - **Phones (≤700px):** the same section is built from each boat's PORTRAIT set (`.mgrid`, 2 across, round-robin). It opens at 12 photos with a "Show all", the chips show the phone counts, and tapping opens that boat's portrait set.
  - **Hrefs keep `?v=`:** that also keeps gallery.js's model-page grid code (length chips, page-wide viewer) off this grid.

### Galleries (7 live 2026-10-05; USGS Electroshock + Work Boat 2026-10-06; Water Rescue 2026-10-08)
| Card title | Boat | Desktop / phone | Hull(s) |
|---|---|---|---|
| FIRE & RESCUE | 18′ Skagit | 13 / 14 | 4572 |
| FIRST RESPONDER | 20′ Alaskan XL Inboard | 27 / 24 | 5320 |
| U.S. COAST GUARD | 20′ BSR SW | 27 / 27 | 5335 + 5336 (card shows 5335) |
| FIRE & RESCUE | 20′ Skagit | 14 / 14 | 4552 |
| NORTHWESTERN ENERGY | 20′ Skagit | 9 / 11 | 4669 + 5063 (card shows 4669) |
| RESEARCH | 20′ Skagit | 7 / 7 | 5046 (desktop numbers skip 07-08; harmless) |
| U.S. FISH & WILDLIFE SERVICE | 20′ Skagit | 7 / 8 | 4656 |
| USGS ELECTROSHOCK (+ video) | 20′ Skagit | 18 / 20 | 5082 · video `LZEBC-i06WM` "Wooldridge 20' Skagit Electroshock \| Features, Layout & On-Water Look", 3:23, UNLISTED on YouTube (embeds fine) |
| WORK BOAT | 20′ Skagit | 28 / 16 | 5348 (same boat as hero slide 02, whose caption now says Work Boat too) |
| WA DEPT. OF FISH & WILDLIFE | 23′ Skagit | 9 / 9 | 5059 (FLAT folders 23-CC-SKAGIT/ + -MOBILE/; the phone files have no -MOBILE suffix, which is fine because the folder says it) |
| WATER RESCUE | 23′ Landing Craft Super Sport Drifter | 16 / 16 | 3938 (2026-10-08, FLAT folders 23-CC-LC-OBJ-SSD/ + -MOBILE/. Tyler's files came without the `CC` (`NN-3938-23-LC-OBJ-SSD-…`); I added it in the OneDrive master, all 34 incl. GALLERY-THUMB + hero 06. The X Drive copy may still have the old names) |

To do: more 20-CC-SKAGIT missions as Tyler adds them. Once the galleries are done, ask Tyler whether to delete the unused
14 MB `assets/agency/` (the old case-study photos).

### Deploy + checking (gotchas that bit us)
- Since 2026-10-08 I commit finished, checked work and tell Tyler when to push; he pushes
  in GitHub Desktop. Never `git push`. (Before that he committed too and wanted work left
  uncommitted.)
- Push → cPanel deploy (`.cpanel.yml`). It copies `assets house.css favicon.ico` FIRST,
  then everything, so a page never goes live before its photos. (Before that fix a
  mid-deploy view cached 404s for 4h in Cloudflare + the browser.)
- `cp -R` never deletes: anything removed from the repo needs a `/bin/rm` line in
  `.cpanel.yml`.
- Checking live: compare a distinctive string (gallery titles) and request every image
  URL the page uses (390 on 2026-10-05, all 200). Don't byte-compare the HTML, because
  Cloudflare rewrites the footer `mailto:`. "Not found" + `cf-cache-status: HIT` = a
  cached 404, so change the URL (bump `$VERLEN`).
- Deploys take a couple of minutes. A stale look in Tyler's browser = Cmd+Shift+R.

### Local preview (macOS blocks the preview server from ~/Desktop)
The in-app preview server can't read ~/Desktop (TCC), so it 404s on everything. Instead:
```
rsync -a --delete --include='/agency-work-boats/***' --include='/custom-agency-builds/***' \
  --include='/house.css' --include='/favicon.ico' --include='/assets/' --include='/assets/*.js' \
  --include='/assets/brand/***' --include='/assets/fonts/***' --include='/assets/photos/' \
  --include='/assets/photos/agency-work/***' --exclude='*' ./ <scratchpad>/site/
cd <scratchpad>/site && python3 -m http.server 8813 --bind 127.0.0.1   # Bash run_in_background
```
Then `preview_start({url:'http://127.0.0.1:8813'})` and open /agency-work-boats/. Re-run
the rsync after each build. The background server times out after ~30 min; just restart it.

Screenshots for Tyler: use the in-app browser's screenshots (each is saved as a file
under the session's tool-results/ folder; copy it, then send it). Do NOT run headless
Google Chrome from the terminal: on 2026-10-06 it tripped macOS "App Management" (Chrome
tried to touch its own app files and macOS blamed Claude Code). Tyler keeps that OFF.
