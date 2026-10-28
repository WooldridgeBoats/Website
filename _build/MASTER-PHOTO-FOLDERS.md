# Master photo folders (Tyler reorganized them 2026-10-20)

READ THIS before any "Model Ready", "Agency Model Ready", History or store-photo job.
Every website photo comes from ONE master folder on OneDrive:

```
/Users/tylerlee/Library/CloudStorage/OneDrive-WooldridgeBoatsInc/Wooldridge Boats Inc_ - SQUIRREL HOLE/70 MARKETING AND BRAND/WEBSITE/MASTER-WEBSITE PHOTOS/
```

**Why the reorg (Tyler, 2026-10-20):** boat-model folders used to sit loose at the top level next to
everything else. Now boats live in two group folders, so non-boat photos (store, logos, shop, inventory,
history, video thumbs) each have their own home as he adds more.

## Top level

| Folder | What's in it | Used by |
|---|---|---|
| `BOAT MODELS/` | The 18 configurator models, one `<MODEL>-WEB` folder each (table below) | Model Ready: `apply_model_photos.sh` |
| `CUSTOM BOAT MODELS/` | The custom-build pages + the Agency page (table below) | Model Ready / Agency Model Ready |
| `ABOUT \| HISTORY/` | Year and decade folders (`1915`, `1920s` … `2026`), `HERITAGE BROCHURES-ADS`, `GENERAL HISTORICAL-UNKOWN DATES`, plus loose hero/end-cap/rope files. **Did not move.** | /about-history/: `build_history.pl` (see HISTORY-PAGE-HANDOFF.md) |
| `YOUTUBE-THUMBS/` | Tyler's own video thumbnails. **Renamed from `YT-VIDEO-THUMBS`.** Always copy byte for byte, never re-compress. | History heritage video (`01-HERITAGE VIDEO-THUMB.jpg`); also holds a 20′ Skagit USGS electroshock thumb |
| `IN THE SHOP-WEB/` | Empty on 10-20. Planned: one `<HULL>-<LEN>-<MODEL>/` folder per boat in production | /in-the-shop/ |
| `NEW INVENTORY/` | One folder per boat for sale, named by HULL so it's the exact boat from the shop: `5334-18-WS-ALASKAN/` (HERO + GALLERY-THUMB + NN photos, all `…-5334-18-WS-AK.jpg`) and its phone folder `…-MOBILE/` | /new-inventory/: `_build/build_new_inventory.sh` (checks names, fills `assets/newinv/<HULL>/`). Price, words, SOLD: the NEWINV list in new-inventory/index.html. Homepage New Boats thumb is hand-edited in index.html. Full how-to: `_build/IN-STOCK-PAGE-HANDOFF.md` |
| `WEB STORE-EXPORTS/` | Flat folder of store product photos, `PRODUCT NAME-N.jpg` | store.wooldridgeboats.com (Shopify) |
| `LOGOS-GRAPHICS/` (was `LOGOS/`) | Copies of every logo and graphic the website uses, ALL CAPS names: WB-LOGO-WING-DARK, ICON-INSTAGRAM/FACEBOOK/YOUTUBE, ROPE-DIVIDER(-TRIMMED), ROPE-VERTICAL-HISTORY, ROGUE-RIVER-MAP-BACKGROUND, ARROW-DOWN, COMPASS-STAR.svg, AVAILABLE-NOW-STAMP (.png, -SHADOW.png, .svg), plus **WB-ICON-LOGO-FAVICON.png = the 512×512 favicon MASTER** (Tyler's new one, 2026-10-20; the old barred favicon copies were trashed) (Tyler, 2026-10-20). Only what the site uses: unused copies (LIGHT logo, 512 favicon) were trashed 2026-10-20 | Reference copies for Tyler. The site uses its own copies in `assets/brand/` (and `assets/history/rope-v.png`, `assets/inv-stamp.js`). New site graphic = add a copy here too |

## BOAT MODELS → page

Command: `[PHOTOSLUG=x] _build/apply_model_photos.sh <slug> "<Name>" "<MASTER>/BOAT MODELS/<FOLDER>"`.
Check first: `_build/check_model_photos.sh "<same folder>"`. Use `NOCFG=1` on both when the file names
carry no trim (see BOAT-MODEL-IMAGE-UPDATES-HANDOFF.md).

| Folder | Page `models/<slug>/` | Name | Lengths (every length has a `-MOBILE` phone folder since 2026-10-23) |
|---|---|---|---|
| `ALASKAN-LT-WEB` | `alaskan-lt` | Alaskan LT | 16, 18, 20 (subfolders are named `16-AK LT-WEB` etc., the only ones with `-WEB` on the length folder) |
| `ALASKAN-WEB` | `alaskan` | Alaskan | 18, 20 |
| `ALASKAN XL-WEB` | `alaskanxl` | Alaskan XL | 20 |
| `ALASKAN XL IB-WEB` | `alaskan-xl-inboard` | Alaskan XL Inboard | 21 |
| `ALASKAN XLT-WEB` | `xlt` + **`PHOTOSLUG=alaskan-xlt`** | Alaskan XLT | 18, 20 (both have phone sets) |
| `ROGUE HDPE-WEB` | `rogue` | Rogue HDPE | 18, 20 |
| `SCOUT-WEB` | `scout` | Scout | 19, 21 (phone sets); also `VIDEO THUMB-19-WS-SCOUT.jpg` |
| `SCOUT WIDEBODY-WEB` | `scout-widebody` | Scout Widebody | 21 (phone set) |
| `SKAGIT-WEB` | `skagit` | Skagit | 18, 20 (20′ has 1 photo, same as live) |
| `SKAGIT IB-WEB` | `skagit-inboard` | Skagit Inboard | 20 (phone set) |
| `SKAGIT-X-WEB` | `skagit-x` | Skagit-X | 21 (phone set) |
| `SPORT-WEB` | `sport` | Sport | 18, 20 |
| `SPORT IB-WEB` | `sportinboard` | Sport Inboard | 20 (phone set) |
| `SPORT OFF-WEB` | `sportoffshore` | Sport Offshore | 20, 21 (phone sets) |
| `SPORTSTER-WEB` | `sportster` | Sportster | 21, 23, 25 (no 20′ model; gallery removed 2026-10-23) |
| `SSD-WEB` | `supersportdrifter` | Super Sport Drifter | 23 |
| `SSD IB-WEB` | `supersportdrifterinboard` | Super Sport Drifter Inboard | 21, 23, 24, 25 (phone sets) |
| `SSOFF-WEB` | `super-sport-offshore` | Super Sport Offshore | 20, 21 (phone sets) |

## CUSTOM BOAT MODELS → page

| Folder | Page | How it's built |
|---|---|---|
| `AGENCY-WORK-WEB` | /agency-work-boats/ | `perl _build/build_agency_galleries.pl [--dry-run]`. Default path already points here. One sub-folder per boat; the `20-CC-SKAGIT/` folder holds a sub-folder per mission (FIRE, NW ENERGY, RESEARCH, USFWS, USGS ELECTROSHOCK, WORK BOAT). See AGENCY-READY-HANDOFF.md |
| `CANYON-WEB` | `models/canyon/` | `NOCFG=1 apply_model_photos.sh canyon "Canyon" …` |
| `DEEPWATER-WEB` | `models/deepwater/` | `BYCFG=1 apply_model_photos.sh deepwater "Deepwater" …` |
| `LANDING CRAFT-WEB` | `models/landing-craft/` | `apply_model_photos.sh landing-craft "Landing Craft" …` (hand-written hero slider) |
| `PYBUS-WEB` | `models/pybus-lodge-fleet/` | `apply_model_photos.sh pybus-lodge-fleet "Pybus Point Lodge" …` |
| `RIVER RAT-WEB` | `models/river-rat-diy-kit/` | `_build/build_riverrat.sh`. Default path already points here |
| `SSO PILOTHOUSE-WEB` | `models/super-sport-offshore-pilothouse/` | `apply_model_photos.sh super-sport-offshore-pilothouse "Super Sport Offshore" …` |
| `SSOFF-ANGLER-WEB` | `models/super-sport-offshore-angler/` | `apply_model_photos.sh super-sport-offshore-angler "Super Sport Offshore" …` (a 24-footer, hull 4660) |

## Rules

- **OneDrive is the master.** The X Drive (`/Volumes/X Drive/PHOTOS-BOAT MODEL-MASTER/<MODEL>/<MODEL>-WEB`)
  is Tyler's photo archive (RAW, Lightroom, full-res, PSD templates). On 2026-10-19 he linked an X Drive
  folder, then said the OneDrive copy is "the correct folder". If he links the X Drive, compare it with
  OneDrive before building.
- **Scripts that had the old paths built in (fixed 2026-10-20):** `build_agency_galleries.pl` (default
  `$SRC`), `build_riverrat.sh` (default `SRC`), `build_history.pl` (`YOUTUBE-THUMBS`). The Model Ready
  scripts take the folder as an argument, so nothing is built in there. If Tyler moves folders again,
  grep `_build/` for `MASTER-WEBSITE PHOTOS` and fix those lines.
- **OneDrive "0 bytes" files** are cloud-only placeholders. Opening the folder in Finder makes OneDrive
  download them. The Agency builder warns about them.
- **Comments in the model pages** (Landing Craft, Deepwater, Pybus, Pilothouse, Agency) name their
  master folder. They were updated to the new paths on 2026-10-20.

## Favicon (Tyler's new icon, 2026-10-20)
Master: `LOGOS-GRAPHICS/WB-ICON-LOGO-FAVICON.png`, 512×512 (WB logo on a white-to-grey fade, no bars). The site
needs exactly four files made from it: `assets/brand/favicon-16.png`, `favicon-32.png`, `favicon-180.png`
(iPhone home screen) and `/favicon.ico` (16+32+48 inside). Remake with `sips -s format png -z N N` and a
small Python ICO packer (PNG entries), copy in, then bump the `?v=` on the four favicon links in every page
AND in `_build/gen_pricesheets.pl` (browsers and Cloudflare hold favicons hard). If Tyler sends a new
master smaller than 512, ask for 512+ (180px from 100px looks soft). The store favicon must match (Tyler): re-run `~/wooldridge-store-build/tools/set_favicon.py` (live store change, Tyler's OK). Set 2026-10-20.

