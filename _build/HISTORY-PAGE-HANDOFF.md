# OUR HISTORY PAGE: HANDOFF

Rebuild of **/our-history/** (dev.wooldridgeboats.com/our-history/). Started 2026-10-12.
Tyler: "Wooldridge Boats is an American Legacy brand, so this page is very important
to get right... interactive and captivating." Expect many more rounds.

## What's built (first pass, 2026-10-12)

- **Hero** = Tyler's `01-HERO-TITLE IMAGE.jpg`, laid out like his mockup
  `EXAMPLE-HERO-TITLE IMAGE.jpg` (both in the OneDrive folder below): blue Rockwell
  "Four Generations. / One River at a time." centered on the sky, the first line of
  the about copy in white, right-aligned, on the photo. Phones: the title stays on the
  photo and that first line drops under it. The old pagemast ("Wooldridge Boats Â·
  Seattle", HOME / OUR HISTORY crumb, "EST. 1915" kick) is gone, per Tyler.
- **About copy** (Tyler's 4 paragraphs) centered under the photo. The book title links
  to the store: https://store.wooldridgeboats.com/products/the-rogue-a-river-to-run-book
  (store is password-protected while in dev; the link is Tyler's). Link only, no cover
  image (Tyler's call).
- **Rope divider** (assets/brand/rope.png) + "THE TIMELINE Â· 1915 â TODAY" kicker.
- **Timeline**: every date centered. A vertical **rope** (cut from the WEB ROPE GRAPHIC.ai
  vector into `assets/history/rope-v.png`, used as a CSS mask) connects each date and
  **draws itself in blue as you scroll**; each date's **compass star** lights blue when
  the rope reaches it; a faint outlined **ghost year** drifts behind each date. Years
  are blue Rockwell, kept small (Tyler: "much smaller"), with the caption under them.
- **Carousels**: square photo-print tiles (white border, slight tilt, light sepia),
  next one peeking, arrows, "3 / 10" counter, and a **scroll bar** under each one
  (click or drag it). One photo = one centered print, no controls.
- **Flip-through viewer**: click any print or video and flip with arrows, keys or swipe,
  with a page-turn animation. It's one continuous book: "next" at the end of 1947 turns
  into 1948. Shows the year, caption, "Photo 3 of 10". Videos play in it (youtube-nocookie).
- **Year rail**: a jump list of years on the right edge (big on wide screens, small on laptops, hidden on tablets/phones), current one
  highlighted, shown only while you're in the timeline.
- The **"The 2026 Fleet / Build & Price Yours" button is removed** (Tyler).

## Files

| What | Where |
|---|---|
| Page | `our-history/index.html` (timeline is generated between `<!-- HIST:timeline -->` markers; don't hand-edit inside them) |
| Dates, captions, videos, links | `_build/history_timeline.txt` |
| Builder | `_build/build_history.pl` |
| Behaviour | `assets/history.js` |
| Styles | `house.css`, the "OUR HISTORY" block at the end (all `.h*` classes) |
| Built images | `assets/history/<date>/NN.jpg` + `thumbs/NN.jpg`, `assets/history/hero.jpg`, `assets/history/rope-v.png` |

## Photo sources (dates, NOT hull numbers)

Four-digit numbers in history folders and filenames are **years**. The builder tries,
in order, and the first source with photos for a date wins:

1. **Tyler's master:** `OneDrive .../70 MARKETING AND BRAND/WEBSITE/MASTER-WEBSITE PHOTOS/ABOUT | HISTORY/`
   One folder per date or era, named by it: `1915`, `1920s`, `1947`, or with a
   description, `1947-RUNNING THE ROGUE`. Photos show in filename order.
   The hero is the file starting `01-HERO`.
2. **The archive (seed set for now):** `/Volumes/X Drive/HERITAGE MEDIA/HERITAGE PHOTOS/<year>/`
   (19 photos in total: 1920s 1, 1947 10, 1948 1, 1950s 1, 1970s-LATE 2, 1977 3, 1979 1).

So as Tyler fills a date folder in the master, it replaces the archive photos for that date.

## Photo captions (2026-10-13)

Captions come from, in order: the photo's **Finder Comments** (Get Info; Tyler's
preferred spot, quick to edit), else its **Description** metadata (EXIF ImageDescription /
IPTC Caption / XMP Description, read with `sips -g description`).
Finder Comments are NOT inside the JPEG; macOS keeps them in an extended attribute
(`com.apple.metadata:kMDItemFinderComment`, read straight from the xattr). They survive
Finder copies between Mac drives and work on the OneDrive files on this Mac (checked
2026-10-13), but an export/re-save, email or download drops them. So: export first,
then type the comments on the files in the date folders. It shows in the white margin under each print (2 lines
max, album-style). In the viewer it is the ONLY text (Tyler, 2026-10-14): a date leading the
caption ("1964 —", "Late 1960s —", "October 31, 1977 —") becomes the blue date and comes off the
text; no date in the caption = the section’s year. The section’s own description is not shown there. It's also
the photo's alt text. `perl _build/build_history.pl --captions` lists what each photo got.

The builder cleans captions for the web and never touches Tyler's files:
- a leading date that repeats the entry's date comes off ("1947-Rogue No. 2" in 1947 â "Rogue No. 2");
  a more specific one stays ("1964" in 1960s, "Late 1970s")
- a caption that's only the date ("1977", "1980s") shows nothing
- separator dashes become " Â· " ("Rogue No. 2-Gold Beach" â "Rogue No. 2 Â· Gold Beach");
  real hyphens followed by lowercase ("first-ever") stay
- mostly-caps captions get title case; known slips are fixed (Slamon, 1sr, Auxilary, "len,")
- photo **order = filename order** inside each folder (natural sort, so 2 comes before 10)

Tyler was re-exporting all the photos with descriptions on 2026-10-13, and some need
their order swapped.

## Round 2 (2026-10-13 afternoon)

- **Photos:** Tyler's master `ABOUT | HISTORY/<date>` folders are the ONLY source now (the
  X Drive seed set is retired; `--src` can still point elsewhere). 155 photos, 23 dates.
- **Order is automatic:** dates in order, an era ("1970s") OPENS its decade, ahead of 1973 ... 1979 (Tyler, 2026-10-14; it was the end of the decade for a day).
  Photos inside a folder run in filename order (1947-001, 1947-002 ...).
- **Captions:** Description metadata first (Tyler's call), Finder Comments as fallback.
  In an era, each photo keeps its own date ("1984 â ..." or "1980s â ..."); on a single-year
  date the repeated year comes off. Fixes: Dam (was "Damn"), "ly 1980s" â Early 1980s,
  C-130 stays intact, "2023â" spacing, a leading date always reads "1984 â ".
- **Photo-only dates** (no text under the year yet): 1930s, 1951, 1960s, 1980s, 1990s, 2020s, 1982 (Tyler split it out of the busy 1980s folder 2026-10-14; photo captions carry it, no text wanted).
- **Face-aware thumbs:** `_build/history_focus.swift` (macOS Vision) finds faces / upper
  bodies and the builder sets each square thumb's object-position so heads aren't cut off.
  Compiled once into `$TMPDIR/wb-history-focus` by the builder.
- **Map finale:** after the last date the rope runs into "Where It All Began / The Rogue
  River, Oregon": Glen's hand-drawn Rogue River Basin map laid on like a book page, with the
  route upriver from Gold Beach to Grants Pass (1947 + 1962 firsts) drawing itself in blue on
  scroll, Grants Pass pulsing at the end, then "Four Generations. One River at a time."
  - Source: `ABOUT | HISTORY/GENERAL HISTORICAL-UNKOWN DATES/ROGUE RIVER BASIN.JPG`
  - `_build/history_map.swift` cleans the scan (crop off the book edge + page number,
    flatten the lighting, white paper) into `assets/history/rogue-map.jpg` AND traces the
    river (cheapest path over thick ink) â the SVG path pasted into the page's `.hmap`
    section. That section is hand-placed OUTSIDE the HIST markers, so the builder never
    touches it. Re-run the map tool only if the scan changes, then paste the new path.
- **Not placed yet:** the other 8 photos in `GENERAL HISTORICAL-UNKOWN DATES` (1914 Grants
  Pass, bar blasting, Glen on the Rogue x2, TV star Truman Bradley, hauling wood, Grants Pass).
  Ask Tyler where they go (a "From the Archives" gallery before the map?).
- **Caption flags for Tyler:** 2026-008 "...in his 20-foot Alaskan XLT" (whose?);
  2026-009 is a 2022 photo in the 2026 folder; 2026-011's description is cut off ("wate",
  page shows "water").

## Image weight (2026-10-14)

Tyler: fast loads, but NO softening, and keep the pixel sizes. What the builder does:
- **Tiles** are cut to the exact square shown (720px, or the original's short side if
  smaller), aimed at faces by `history_focus.swift --crop` (sips can't do it: it ignores a
  `--cropOffset 0 0` and centre-crops). Resized losslessly to PNG first, compressed once.
  33 MB â 23 MB total; median 154 KB, max ~250 KB.
- **Full-size viewer photos** stay 2000px on the long side. A file-size budget (tiles 200 KB,
  fulls 800 KB) steps quality 82 â 78 â 75 only when over budget, never lower. Grainy film
  scans still land up to ~1.2 MB at 75; checked at 100% against a lossless copy: no visible
  change. Fulls only load when someone opens the viewer.
- Opening the page downloads about 2 MB (hero + the first rows of tiles); the rest lazy-loads.
- The builder prints a **low-res originals** list (short side under 600px): those tiles get
  stretched a little and can look soft. Only a bigger scan fixes that.

## From the Archives + pill (2026-10-14)

- **Brochures & Ads** stop AFTER the map (Tyler moved it below the map 2026-10-14; the closing "Four Generations. One River at a time." line now sits in its own `.hend` block, last on the page), from the master's
  `HERITAGE BROCHURES-ADS` folder (built by the builder between `<!-- HIST:archives -->`
  markers). Pieces are taped in like a scrapbook: five rotating tilts/offsets
  (`.hclip:nth-child(5n+k)` in house.css) so any number of pieces still looks hand-placed;
  they drift in one after another; hover straightens + lifts; click opens the viewer, where
  they follow the last timeline photo. Phones: 2-column scrapbook. Web copies:
  `assets/history/archives/NN.jpg` (viewer) + `clip/NN.jpg` (760px wide).
  These 4 pieces ALSO sit in their date galleries (1951, 1960s x2, 1970s); ask Tyler if he
  wants them only in the scrapbook.
- **"Not sure which boat?" pill** is off this page (and so off its photo viewer):
  `/our-history/` is in tool-nudge.js's SKIP list.

## Layout + labels (2026-10-14, later)

- Page order now: hero → about copy → **From the Archives: Brochures & Ads** (scrapbook, no rope
  above it) → rope divider + "The Timeline · 1915 – Today" (moved into the top of `.htl`) →
  the dates → the Rogue River map → "Four Generations. One River at a time." (`.hend`).
- Under each **brochure**: just the date, black Rockwell (`.hclip-cap`); the caption rides in
  `data-cap` and shows only in the viewer. Under each **timeline print**: the caption (Tyler
  tried dates-only there too, then went back to captions the same day). Viewer for both:
  the caption's own date in blue, the rest of the caption under it.
- **Brochures are one sideways strip** (19 pieces would bury the timeline as a wall). It's a
  real `.hcar`, so it gets the arrows / counter / scroll bar. Pieces share a HEIGHT (wide
  spreads sit beside tall pages); clip images are 760px tall (pieces show up to 360px; bumped 2026-10-14). Order = by the date in each
  caption, oldest first (generic decade, Early, the years, Mid, Late), not alphabetical.
  A garbled caption date borrows the filename's (a fallback; the one case, "!908s", Tyler fixed
  by renaming it 1980s-DEEP WATER PLUS BROCHURE).
- The viewer runs in page order: brochures first, then 1915 onward.

## How to update

```
perl _build/build_history.pl      # photos + timeline markup + hero
perl _build/stamp_assets.pl       # only if house.css or history.js changed
```
- **New date or era:** add a `== YEAR` block to `history_timeline.txt` (order on the page
  = order in the file), then rebuild.
- **YouTube video:** `video: https://youtu.be/ID | Title` under the date. It becomes the
  first tile in that date's carousel.
- The builder lists archive/master folders that have **no timeline entry** so nothing is
  silently dropped. Right now: 1930s, 1951, 1960s, 1980s, 1990s.

## Preview (Desktop TCC block)

The preview server can't read ~/Desktop. Mirror to the scratchpad and serve from there:
an rsync of `our-history/`, `house.css`, `assets/*.js`, `assets/brand/`, `assets/fonts/`,
`assets/history/` to `<scratchpad>/site/`, then `python3 -m http.server 8813 --bind 127.0.0.1`
and `preview_start({url:'http://127.0.0.1:8813/our-history/'})`. Re-sync after each change.

## Wording changes to the approved timeline (check with Tyler / Glen Jr.)

Typos fixed and a few sentences smoothed. Meaning unchanged:
- 1947: "...from Gold Beach to Grants Pass, with a 22-horsepower Evinrude."
- 1950s: "Glen Wooldridge Sr. develops the first Jackass lift for an outboard motor. The lift lets the boat run in shallower water." (was "developed the 1st ... This lift allows")
- 1970s: "Bob Wooldridge brings drift boats to Seattle and sells them. Bruce Wooldridge is building them in Grants Pass with Mike and Mark."
- 1975: "...is the first to run up Hells Gate..."
- 1977: "Glen Wooldridge develops the outboard jet tunnel." (was "...developed the outboard jet tunnel developed.")
- 1978: "Glen Wooldridge and Dave Devore develop the first stainless steel outboard impeller."
- I swapped the em dashes in the captions for commas and colons.

## Next up (from 2026-10-12)

- Tyler is building the **date folders** (starting with 1915 and 1920s). Rebuild when they land.
- More **YouTube videos** for dates and eras are coming.
- **Eras vs dates:** some galleries will be eras (1940s, 1970s...). Maybe give eras their own look (a chapter-style header).
- **Sharper hero:** `01-HERO-TITLE IMAGE.jpg` is only 1200px wide. The same photo is on the
  X Drive at 2980px (`HERITAGE PHOTOS/1948/1948-001.JPG`). Ask Tyler to re-export the hero at 2400px+.
- The **1948 carousel photo duplicates the hero** (same scan). Drop it when real 1948 photos come in.
- The **1975 video thumbnail** has black side bars (YouTube's own frame). Could crop it tighter.
- Ideas not built yet: a sticky current-year chip on phones, captions per photo.
- Year rail (right edge; Tyler likes it): bigger on wide screens (1380px+), small and faded until hover on 901-1379px (timeline gets 64px side padding there so it never covers the photo rows), hidden at 900px and under. Set 2026-10-13. With ~25+ dates it will get taller than a short laptop screen; tighten its spacing or let it scroll then.
