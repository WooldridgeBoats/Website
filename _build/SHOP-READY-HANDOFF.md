# In The Shop: monthly update (`/shop-ready`)

Built 2026-11-03 (Tyler). Replaces Stephen's retired Windows sync (`sync_shop_live.ps1`, RETIRED,
do not run). Feeds the homepage "In The Shop Right Now" strip and the `/in-the-shop/` page.

## Tyler's side
1. Drop this month's photos in OneDrive `…/MASTER-WEBSITE PHOTOS/IN THE SHOP-WEB/` (loose is fine,
   or one folder per boat). Name: `HULL-LEN-[CFG-]MODEL-ANYTHING-001.jpg`,
   e.g. `5398-18-CC-AK LT-MONTEITH JOEL-001.JPG`. The ANYTHING part (usually the customer) is never
   shown: captions = boat model, configuration and hull # only (Tyler 2026-11-03).
2. Remove last month's boats from that folder when they leave the floor. **The folder IS the page:**
   every boat in it gets a row; a boat taken out loses its row and its photos.
3. Type `/shop-ready`.

Archive: Tyler keeps a dated copy on the X Drive, `PHOTOS/IN THE SHOP/YY-MM-DD-IN THE SHOP/`
(first one `26-11-03-IN THE SHOP`). It's his archive; build only from OneDrive. Don't sync or edit it.

## My side
1. Warm the OneDrive files, `perl _build/build_shop_live.pl --dry-run`: it lists each boat
   ("Hull #5398 - 18' Alaskan LT Center Console"), flags bad names, unknown model codes (add to
   `%MODEL`), duplicate numbers.
2. **Vet every photo by eye for the GENERAL PUBLIC** (memory note `in-the-shop-photos`): the NO-SHOW
   list (jet tunnel / pressing the tunnel, Skil saw, unguarded table saw, band saw without a close
   guard, pulling a bow, come-along / pull straps, the keel, turning a boat over) plus paperwork,
   handwritten notes, whiteboards, faces, other customers' names. Doubtful = put `"HULL-NNN"` in
   `hold` in `_build/shop-live-settings.json` and tell Tyler; or crop it out with a `crop` entry.
3. Crops: 16:10 with the BOAT centred. Default = full width, centre 0.5 / 0.52. Tweak per photo in
   `crop` (`w` = width share, `cx`/`cy` = centre 0-1), e.g. `5389-001` cropped tighter to drop a band saw.
4. Run it for real. Each photo -> `assets/photos/shop-<hull>/<hull>-shop-N.jpg` 2000x1250,
   mozjpeg to <= 600 KB (never over 700), thumbs 480x300, EXIF/GPS stripped (exiftool). A photo
   already 2000x1250 and small enough goes in as-is. `shop-*` folders not in the master are removed.
   No `_source.json` any more (the old one held customer names in public files).
5. Homepage strip (Tyler, 2026-11-03): ONE photo per build, each build's **-001** photo (the lowest
   number if 001 is held), newest hull first, "On the floor right now · N builds". So Tyler picks each
   boat's homepage shot by making it -001. Automatic every run; no setting.
6. Preview in the in-app browser (copy to the scratchpad + serve if ~/Desktop is blocked), send
   Tyler screenshots + any flagged photo, **wait for his OK**, test desktop + 390 / 360 / 320,
   commit with explicit paths, Tyler pushes.

The Build Hub `LIVE BUILDS.json` only says "IN PROCESS", so rows carry no stage line ("in Rigging").

## Log
- **2026-11-03 (first run):** 9 builds, 16 photos. Held #5400 (handwritten note on the transom)
  until Tyler removed the note and re-exported; cropped the band saw out of #5389 photo 1.
  Homepage first showed one build (#5333); same day Tyler switched it to every build's -001 photo.
