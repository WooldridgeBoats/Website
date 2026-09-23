# "Model Ready" — paste this into a new chat window

Copy everything in the box below as your first message in the new window, then attach
the next model's master photo folder and say which model it is.

---

We're continuing the **dev.wooldridgeboats.com boat-model photo replacement + gallery rebuild** in the repo `~/Desktop/LOCAL-WEBSITE`. Before doing anything, read my memory note **website-photo-replacement-workflow** and the runbook **`_build/BOAT-MODEL-IMAGE-UPDATES-HANDOFF.md`** — they have the full pipeline. Serve locally with `python3 -m http.server 8811` and verify in the browser pane (screenshots come back blank when the pane is hidden — use DOM/`javascript_tool` geometry as the source of truth; set a desktop viewport with `resize_window` since the pane can read as 0-width).

**When I say "Model Ready! <Model>" and attach its master folder (in OneDrive `…/MASTER-WEBSITE PHOTOS/<MODEL>-WEB/`), do this:**

1. **Confirm the slug** (`models/<slug>/` AND `assets/photos/<slug>/`). If the photo dir differs from the page dir, set `PHOTOSLUG` (known case: page `xlt` / photos `alaskan-xlt`). Also check whether the page is "bare" (no `modelhero`/`gallery`/`photo-data.js` — 8 such pages; Skagit was one) — bare pages need the photo section INSERTED, not just replaced (see the memory's bare-page recipe).
2. **Pre-flight validator:** `_build/check_model_photos.sh "<folder>"`. It flags source typos, missing hulls, unknown trims, length≠folder, non-2000×1250, 0-byte placeholders, missing HERO/GALLERY-THUMB. **Fix obvious source typos IN THE MASTER FOLDER myself** (Tyler likes typos auto-fixed) — e.g. double-dash `28--4588`, `GALLER THUMB` (missing Y). For an **unknown trim code**, ASK Tyler the caption wording, then add it to `%CFG` (build_gallery.pl) + `cfg_disp`/`parse_one` (apply_model_photos.sh) + `KNOWN_TRIMS` (validator).
3. **Build:** `_build/apply_model_photos.sh <slug> "<Display Name>" "<folder>"` (prefix `PHOTOSLUG=<photodir>` if needed; dry-run first with `--dry-run`). Use the model's REAL site name as the display name (e.g. "Rogue HDPE", "Super Sport Drifter" written out — Tyler's call).
4. **Fix cross-page refs the builder does NOT auto-handle:** run a broken-image sweep for `assets/photos/<slug>/`; repoint any `lp/*` persona hero → the model's full `hero-*.jpg`, and the homepage "Shot in the Field" `a.photocard` → the model's `thumbs/cover-<firstlen>.jpg`. (The builder DOES auto-fix the fleet-card `ph`, compare `ph`, provenance, build_gallery, and cache-stamp.)
5. **Verify in browser:** N cover cards (one per length), hero loads with `HULL #`, gcaps count, lightbox caption switches config+hull, 0 broken images, no console errors. Confirm the model's Boat Specs `<!-- SPECS -->` block is untouched.
6. **Give Tyler the commit command — HE pushes** (this env can't auth to GitHub). First `git fetch` and note if behind (IG-bot auto-commits touch only `assets/homepage/instagram/feed.json`); rebase cleanly if so.

**Current state (done, don't redo):** Alaskan LT, Alaskan, Alaskan XL, Alaskan XLT, Rogue HDPE, Skagit, Sport, Super Sport Drifter, Sportster, Alaskan XL Inboard, Scout. **Mobile galleries are automatic:** if the master has per-length `<L>-<MODEL>-MOBILE/` folders (portrait **4:5 @ 1080×1350**, gallery images only — HERO/GALLERY-THUMB stay shared), `apply_model_photos.sh` ingests them and the shared lightbox swaps to the portrait shots on phones (≤700px). Backfill for the pre-Scout models is pending their `*-MOBILE` exports. **Known trims:** cc, ws, tiller, aft-ws (Aft Windshield), cabin, first-responder. **Hull regex is `^[3-9]\d{3}$`** (older hulls like 3967 start with 3). There's a reusable **2-video layout** (`.vid2` in house.css — two 16:9 facades at cover-card width; video thumbnails live in `assets/video-thumbs/`, NOT the photo dir) and the **video-wall** recipe for multi-video pages.

Ready — I'll drop the next model.

---
