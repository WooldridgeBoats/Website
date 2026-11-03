# Boat Measurements sheets: how they go on the site

Started 2026-11-03 (Tyler). Tyler makes a measurements diagram (JPG, 2000x1250) for some boats.
They go on the site two ways: model pages get a fold, the Agency page gets a pill.

**Master folder:** OneDrive `…/WEBSITE/MASTER-WEBSITE PHOTOS/BOAT MODEL MEASUREMENTS/`
**File name:** `HULL-LEN-[CFG-]MODEL-MEASUREMENTS.jpg`, e.g. `5175-23-WS-SSD-MEASUREMENTS.jpg`,
`5119-21-SCOUT WIDEBODY-MEASUREMENTS.jpg`. Sheets go in byte-for-byte (never re-compress).

## 1. Main + custom model pages (the standard way)

One command per sheet, from `~/Desktop/LOCAL-WEBSITE`:

```
perl _build/add_measurements.pl <slug> "<Display Name>" "<path to the sheet>" [--dry-run]
```

- Copies the sheet to `assets/photos/<slug>/measurements-<hull>-<len>[-<cfg>].jpg`.
- Adds a **"Measurements · NN′ Layout Diagram"** fold right under the "Full Specs" fold, in
  its own `<!-- MEASUREMENTS:slug -->` markers. Re-running replaces it (new sheet = just re-run).
- It's OUTSIDE the canon `<!-- SPECS -->` block, so /canon-sync never wipes it.
- The diagram and the "Open full size" button open the **measurements lightbox** (modelpage.js,
  `a[data-meas]`): Close × / Esc / the phone's Back button close it; Zoom (or tap) shows the full
  sheet to pan around. Never a bare browser tab (no way back on a phone, Tyler 2026-11-03).
- A custom page with no specs block: the script stops; ask Tyler where the fold goes.
- Then: check desktop + phone (390 / 360 / 320) in the in-app browser, commit, Tyler pushes.

**Done 2026-11-03:**

| Page | Sheet | Fold title |
|---|---|---|
| `models/supersportdrifter/` | 5175-23-WS-SSD | 23′ Layout Diagram |
| `models/alaskan-xl-inboard/` | 5159-21-WS-AK XL-IB | 21′ Layout Diagram |
| `models/scout-widebody/` | 5119-21-SCOUT WIDEBODY | 21′ Layout Diagram |

Notes: SSD page covers 21/23/25′, the sheet is the 23′ (title says so). The AK XL IB sheet says
"Aft Helm" while the file says WS; the caption leaves the config out.

CSS: `.measfold / .measimg / .measbar / .measopen` and the lightbox `.wbmeas*` in house.css.

## 2. Agency & Work Boats page (the outlier)

Many boats on one page, built by `_build/build_agency_galleries.pl`, so measurements there are a
**"See Measurements" pill ON the boat's card** (Option C), not a fold. Tyler picked C over a
photo + measurements card pair because a boat with photos + video + measurements would need 3 cards.

Look (Tyler, 2026-11-03): white pill, blue text + ruler/pencil icon, ON the cover card.
**Desktop: bigger pill (the model-page "Open full size" size), BOTTOM-RIGHT of the card** (the boat
name + hull sit bottom-left). **Phones (<=700px): small pill, TOP-LEFT**, same height and text size
as the "NN photos" badge (top-right), because bottom-right covers the hull line on a phone.
Tap opens the same measurements lightbox. Cards stay the same size, so the grid stays lined up;
on a video boat the pill sits on the photo card of the pair.

First sheet: `5320-20-CC-AK XL-IB-FIRST RESPONDER-MEASUREMENTS.jpg` → First Responder card
(gallery `20-cc-ak-xl-ib-first-responder`).

**Status:** NOT BUILT yet; waiting on Tyler's OK of the mockup. To build: teach
build_agency_galleries.pl to look for a measurements sheet per boat (match by hull + length) and
emit the pill inside the card cell (needs `.agcell` position:relative + an `.agmeas` pill class),
then check 320 wide (pill + badge must not touch).
