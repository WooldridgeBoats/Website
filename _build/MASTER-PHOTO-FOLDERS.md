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
| `ABOUT \| HISTORY/` | Year and decade folders (`1915`, `1920s` … `2026`), `HERITAGE BROCHURES-ADS`, `GENERAL HISTORICAL-UNKOWN DATES`, plus loose hero/end-cap/rope files. **Did not move.** | /our-history/: `build_history.pl` (see HISTORY-PAGE-HANDOFF.md) |
| `YOUTUBE-THUMBS/` | Tyler's own video thumbnails. **Renamed from `YT-VIDEO-THUMBS`.** Always copy byte for byte, never re-compress. | History heritage video (`01-HERITAGE VIDEO-THUMB.jpg`); also holds a 20′ Skagit USGS electroshock thumb |
| `IN THE SHOP-WEB/` | Empty on 10-20. Planned: one `<HULL>-<LEN>-<MODEL>/` folder per boat in production | /in-the-shop/ |
| `NEW INVENTORY/` | `20-WS-ALASKAN/` (empty on 10-20) | /new-inventory/ (ask Tyler how he wants it built when photos land) |
| `WEB STORE-EXPORTS/` | Flat folder of store product photos, `PRODUCT NAME-N.jpg` | store.wooldridgeboats.com (Shopify) |
| `LOGOS/` | `WB-ICON-LOGO-FAVICON.png` | favicon / brand |

## BOAT MODELS → page

Command: `[PHOTOSLUG=x] _build/apply_model_photos.sh <slug> "<Name>" "<MASTER>/BOAT MODELS/<FOLDER>"`.
Check first: `_build/check_model_photos.sh "<same folder>"`. Use `NOCFG=1` on both when the file names
carry no trim (see BOAT-MODEL-IMAGE-UPDATES-HANDOFF.md).

| Folder | Page `models/<slug>/` | Name | Lengths (phone folders on 10-20) |
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
| `SPORTSTER-WEB` | `sportster` | Sportster | 20, 21, 23, 25; also 2 `VIDEO-THUMB-21-…` files |
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
| `PYBUS-WEB` | `models/pybus-offshore/` | `apply_model_photos.sh pybus-offshore "Pybus Point Lodge" …` (33′ phone set still to come) |
| `RIVER RAT-WEB` | `models/riverrat-diy-kit/` | `_build/build_riverrat.sh`. Default path already points here |
| `SSO PILOTHOUSE-WEB` | `models/supersportoffshorepilothouse/` | `apply_model_photos.sh supersportoffshorepilothouse "Super Sport Offshore" …` (29′ phone + 31′ to come) |
| `SSOFF-ANGLER-WEB` | `models/angler/` | `apply_model_photos.sh angler "Super Sport Offshore" …` (a 24-footer, hull 4660) |

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
