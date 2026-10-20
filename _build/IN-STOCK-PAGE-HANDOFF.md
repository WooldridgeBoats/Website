# In Stock page (/new-inventory/): handoff

Built 2026-10-20 with Tyler. READ THIS before adding, changing or selling a shop boat.

**What it is:** the page of finished boats from the shop that people can buy right now. Menu label, page
title, h1 and tab all say **In Stock** (Tyler); the URL stays `/new-inventory/` (never move it unasked).
It uses the boat-model page pieces so it matches them: model-page header (h1, kick, tag, compass rule; no
"Wooldridge Boats · Seattle" line, no crumb), hero with caption strip + HULL #, intro text, gallery card,
fact row, buttons. The only extras: the **price** and the **AVAILABLE NOW rope stamp** on the hero.

First boat (2026-10-20): **Hull #5334**, 2027 18′ Alaskan Windshield, Yamaha 175 outboard jet, **$67,114**
(Tyler: official price). Vinyl is already on it: don't mention choosing a vinyl color (Tyler).

## Add a boat (or change one)
1. Tyler drops `MASTER-WEBSITE PHOTOS/NEW INVENTORY/<HULL>-<LEN>-<CFG>-<MODEL>/` (HULL first, so it's the
   exact boat from the shop): `HERO-…`, `GALLERY-THUMB-…`, `NN-<HULL>-<LEN>-<CFG>-<MDL>.jpg`, plus the phone
   folder `…-MOBILE/` (`NN-…-MOBILE.jpg`, 1080×1350). The phone folder is matched by HULL-LEN, so
   `5334-18-WS-AK-MOBILE` next to `5334-18-WS-ALASKAN` works (the builder notes the name difference).
2. Add the boat to `NEWINV` in `new-inventory/index.html` (hull, yr, len, name, cfg, price, drive, eng,
   mpage, desc). Ask Tyler for price / words / model year: never guess.
3. Run `_build/build_new_inventory.sh` (`--dry-run` first). It checks every file name and stops on a bad
   one, copies photos to `assets/newinv/<HULL>/` (fulls as-is, 800px thumbs, phone set + 400px thumbs),
   writes the page's `WB_NEWINV_PHOTOS` line (counts + cache stamp), flips the **In Stock switch**
   (`assets/instock.js`) and re-stamps.
4. Homepage: update the New Boats card in `index.html` by hand (name, `thumbs/hero.jpg?v=<stamp>`, blurb,
   price). It's the same card as the Pre-Owned ones and lines up with them (see "Homepage" below).
5. Check 1440 + 390, commit with explicit paths, tell Tyler to push.

One boat = a plain hero. Two or more = the hero becomes a slider (one slide per boat, available first)
and each boat gets its own section, automatically.

## Sell a boat
Set `sold:true` in NEWINV and re-run the builder (it turns the In Stock menu link off when no boat is left
for sale). **The SOLD stamp isn't designed yet**: ask Tyler how it should look first ("a nice sold stamp
across the hero, top left probably"), then add it to `assets/inv-stamp.js`.

## The stamp (`assets/inv-stamp.js`, `WBStamp()`)
Inline SVG so it uses the site's Rockwell. Tyler's picks, in order: clean (no distress, "stamped" wear was
too much), golden-brown rope "a tad thinner", drop shadow (CSS `.invstamp`), wider letter spacing, NOW
nudged right (the W made it look off-centre), the site's compass stars (house.css `.secrule` star) on the
**top red half only**. Size 15% of the hero (23% on phones), top left. Exported for Tyler to
`MASTER-WEBSITE PHOTOS/LOGOS-GRAPHICS/AVAILABLE-NOW-STAMP.png / -SHADOW.png / .svg` (SVG has Rockwell
embedded). A see-through PNG needs WKWebView with `drawsBackground=false` (snap.swift variant), and the
export page must NOT load house.css (its map background bleeds in).

## In Stock menu link
`header.html` has `<a class="nav-instock" href="/new-inventory/">In Stock</a>` after Pre-Owned, plus
`<script src="/assets/instock.js">` above the nav. instock.js sets `html.wb-instock` while
`WB_INSTOCK > 0`; without it house.css hides the link (`!important`, because the open phone menu forces
links to `display:block`). While it shows, 901–1100px wide gets slightly tighter gaps/tracking so the bar
stays one row (1101px+ unchanged). Measured: one row from 1000 to 1440.

**The store header must always match the main header (Tyler).** `~/wooldridge-store-build`:
`gen_header.py` swaps the script for `{{ wb_base }}/assets/instock.js?h=<hour>` (same switch file, hourly
URL so Cloudflare's 4h cache can't hold it), `theme/wb-header.scoped.css` has the same hide + 901–1100px
rules. **Status 2026-10-20: generated, NOT pushed**: the push (`themeFilesUpsert` of
`sections/wb-main-header.liquid`) was blocked by auto mode as a production deploy. Push only with Tyler's
OK, and after he has pushed the main site (so instock.js is live). See that folder's HANDOFF.md.

## Homepage, Pre-Owned | New Boats (2026-10-20)
- Each `.listing` card is a 4-row CSS subgrid (name, photo, blurb, price): photos start on one line, prices
  end on one line. 2-line name / 4-line blurb minimums keep the New Boats card level with Pre-Owned.
- New Boats: the card in the first third (same size as a Pre-Owned card, name level with theirs), the
  "Skip the build queue" paragraph beside it (`.newinv-row .newinv-note`).
- Both pills (`.duo-cta`) sit on one line: each `.duo` column is a flex column, pill `margin-top:auto`.
- Phones (≤760px): cards full width; names 17px, blurbs 15px, prices 18px; paragraph centred.
- Explore by Power labels (Inboard / Outboard / Offshore / Agency & Work Boats): desktop unchanged; tablet
  (≤1080px) 18px and phone (≤760px) 21px Inter Medium in normal case (Tyler: tiny caps looked bad under the
  big photos).

## Session log 2026-10-20 (all pushed by Tyler that afternoon)
SSO Pilothouse 26′ phone set + 29′ gallery + 2-slide hero · SSO Angler is a 24′ · master photo folder
reorg (BOAT MODELS / CUSTOM BOAT MODELS; 3 scripts re-pointed; _build/MASTER-PHOTO-FOLDERS.md) · this
In Stock page + stamp + menu link · homepage Pre-Owned | New Boats alignment · Explore labels · model
prev/next = 18 main models in menu order (custom builds loop separately) · LOGOS-GRAPHICS = only what the
site uses · unused brand files deleted · new favicon (site + store). Still open: store header push (In
Stock link), SOLD stamp design, Pilothouse 29′ phone + 31′.

