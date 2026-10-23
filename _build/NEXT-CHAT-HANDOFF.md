# Next chat: start here (written 2026-10-23)

Repo `~/Desktop/LOCAL-WEBSITE` (dev.wooldridgeboats.com). I commit; Tyler pushes in GitHub Desktop. Never
`git push`. Stage explicit paths only, never `git add -A`: other Claude sessions share this folder. In zsh,
stage a list with `git add --pathspec-from-file=<file>` (a `$(git diff --name-only)` list won't word-split).

## Read first (only what the job needs)
- Photo folders → page → command: `_build/MASTER-PHOTO-FOLDERS.md`. **OneDrive MASTER-WEBSITE PHOTOS is the
  only source** (`BOAT MODELS/`, `CUSTOM BOAT MODELS/`, `NEW INVENTORY/`, `LOGOS-GRAPHICS/`…). X Drive = archive.
  GRIZZLY = Tyler's travel drive: don't sync or compare it unless he asks.
- Model Ready / main models: `_build/MODEL-READY-HANDOFF.md` + `BOAT-MODEL-IMAGE-UPDATES-HANDOFF.md`.
- Custom builds: `_build/CUSTOM-BUILD-HANDOFF.md`. Agency page: `_build/AGENCY-READY-HANDOFF.md`.
- Our History: `_build/HISTORY-PAGE-HANDOFF.md`. In Stock: `_build/IN-STOCK-PAGE-HANDOFF.md`.
- Store header / favicon: `~/wooldridge-store-build/HANDOFF.md`.

## State at hand-off (2026-10-23)
- **Everything is pushed** apart from this note. After any push: `git fetch`, then check live with `?nc=<time>`
  URLs (a deploy lands about 6 min after the push).
- **Every boat page is done and audited (2026-10-23):** all 18 main models + 7 custom builds have desktop AND
  phone galleries that match the master length by length; heroes match the master byte-for-byte; 0 broken images
  sitewide (4,477 refs); no console errors or sideways scroll at 1440 / 390; click test passed (cards open the
  viewer, step, close; phones get the phone set). Sport, Sportster, Rogue got full rebuilds this week;
  Sportster has no 20′ (gallery removed). Master folders have no skipped numbers.
- **Photo count since Tyler started (9/16 → 10/23):** 2,479 on the site from his masters (main 1,248, custom 698,
  agency 361, history 172); 2,688 uploaded in all; 1,224 of the 1,285 old placeholders replaced.
- **Videos:** 3+ videos on a page = the homepage's scrolling `.hvidcar` strip (needs `history.js` on the page).
  Rogue, Alaskan XL, SSO Pilothouse use it; 1–2 videos keep the plain layout. Counter is 14px, centred;
  video titles centred under the thumb (shared house.css, so homepage + Our History match).
- **Our History phone hero** is full width now (`.hhero-media{width:100%}`): short screens no longer leave a strip.
- **Vetted-photo list** (`assets/media-provenance.js`, invisible tags, changes no image): 188 dead keys pruned;
  all three builders now drop keys whose file is gone.

## Decisions to keep (don't re-ask)
- **Legacy galleries stay:** SSD Inboard 24′ and Sport Offshore 21′ keep the gold "LEGACY MODEL" tag.
- **Sport 20′ keeps all 44 desktop photos**, including the Tiller and Cabin builds that aren't on the price sheet.
- **XP:** not a boat on the new site and not visible anywhere. `/models/xp/` stays only as a redirect to Skagit
  until www moves off WordPress (old links/Google).
- **No Stephen script may change main or custom model page photos.** His `sync_sales_tools.ps1` is retired; only
  `sync_shop_live.ps1` (In The Shop `shop-` folders) remains. Flag anything else to Tyler.
- **SSD OB brochure** stays off the website (stays in SALES TOOLS).

## Open items
1. **SOLD stamp:** design it with Tyler when Hull #5334 sells, then `sold:true` + re-run
   `_build/build_new_inventory.sh` (turns the In Stock menu link off on site + store).
2. **Next In Stock boat:** follow IN-STOCK-PAGE-HANDOFF "Add a boat".
3. **Any menu change:** also regenerate + push the store header (`gen_header.py`, `themeFilesUpsert`),
   Tyler's OK each time (auto mode blocks it as a production deploy). Store menu must ALWAYS match.
4. **Stephen (Tingis Pingis):** Tyler is answering the Build Hub "25 THINGS THAT NEED YOU" form himself.

## Rules picked up (also in memory / CLAUDE.md)
- Model Ready: check first. A wrong size = stop and tell Tyler (desktop 2000×1250, phone 1080×1350). Name typos
  and numbering gaps I fix in the master myself, then say so. Build only from OneDrive.
- Report photo counts per length (desktop / phone), not lumped totals.
- Store favicon + menu must match the site. Favicon master: `LOGOS-GRAPHICS/WB-ICON-LOGO-FAVICON.png`
  (512px); site sizes 16/32/180 + .ico, bump `?v=` on the links (pages + `gen_pricesheets.pl`); store via
  `~/wooldridge-store-build/tools/set_favicon.py`.
- LOGOS-GRAPHICS holds copies of only the graphics the site uses (ALL CAPS names); trash unused ones.
- Model prev/next bar: the 18 main models in desktop menu order, custom builds a separate loop
  (`assets/pagenav.js` LOOPS). A new model goes there too.
- Preview: `python3 -m http.server 8811 --directory ~/Desktop/LOCAL-WEBSITE`, then the in-app browser
  (`preview_start` with the URL if `navigate` is refused). Big multi-page checks: load pages in hidden iframes
  in the background and poll, since one JS call times out at 45 s.
