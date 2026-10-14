# OUR HISTORY PAGE: HANDOFF

**Page:** dev.wooldridgeboats.com/our-history/ (repo `~/Desktop/LOCAL-WEBSITE`, file `our-history/index.html`)
**Status:** finished and checked on desktop + phone, 2026-10-14. Built 2026-10-12 to 10-14 with Tyler.
Tyler: "Wooldridge Boats is an American Legacy brand, so this page is very important to get right."

---

## PASTE THIS INTO A NEW CHAT

> We're making tweaks to the Our History page on dev.wooldridgeboats.com
> (LOCAL-WEBSITE repo, our-history/index.html). It has custom pieces no other page has.
> Read `_build/HISTORY-PAGE-HANDOFF.md` first and follow it, then wait for my changes.
> Photos come from my OneDrive folder MASTER-WEBSITE PHOTOS/ABOUT | HISTORY.

---

## 1. What's on the page (top to bottom)

1. **Hero** — Tyler's `01-HERO-TITLE IMAGE.jpg`. "Four Generations. / One River at a time." in blue
   Rockwell, centered at the top; the first about line in white, centered under it (his mockup
   `EXAMPLE-HERO-TITLE IMAGE.jpg`). Phones: title on the photo, that first line drops below it,
   bold (SemiBold, 20px). No pagemast / breadcrumb / "EST. 1915" line (removed on purpose).
2. **About copy** — Tyler's paragraphs, centered. The book title links to the store:
   https://store.wooldridgeboats.com/products/the-rogue-a-river-to-run-book (link only, no cover).
3. **Brochures & Ads / From the Archives** — 19 brochures and ads taped in like a scrapbook
   (tilted, staggered, a strip of tape on each) in ONE sideways-scrolling strip with arrows,
   counter and scroll bar. Under each piece: just its date in black Rockwell. Full caption only
   in the viewer. Oldest to newest by the date in each caption.
4. **Rope divider + "The Timeline · 1915 – Today"** (Inter Medium).
5. **The timeline** — 24 dates/eras. A vertical rope connects them and draws itself in blue as you
   scroll; each date's compass star lights up; a faint outlined "ghost" year sits behind each
   date (small blue Rockwell year on top), then the date's text, then a carousel:
   - square photo-print tiles (white border, slight tilt, light sepia), caption under each print
   - arrows, "3 / 11" counter, a pale blue scroll bar (same pale blue as the ghost years)
   - videos can sit in a carousel (play button, "WATCH" + title)
6. **Heritage Videos / From the Film Archive** — all 19 videos of the YouTube "Heritage" playlist
   as small clean thumbs (model-page video-wall look: no white frame, rounded, see-through play
   button that turns blue, run time), scrolling sideways; play in the viewer.
7. **The Rogue River, Oregon / Where It All Began** — Glen's hand-drawn map, laid on like a book
   page; a blue line traces the river upriver from Gold Beach to Grants Pass as you scroll
   (the 1947 and 1962 firsts) and Grants Pass pulses at the end.
8. **Closing photo** — `01-END CAP IMAGE.jpg` full width with "Four Generations. / One River at a
   time." on it like the hero (the page fades into its top so the blue reads). It meets the footer
   with no gap; the footer's compass star is bigger here (48px, plain blue star).

**Everywhere:**
- **The viewer** (click any photo, brochure or video): one continuous book in page order
  (brochures → 1915 … 2026 → heritage videos). Arrows / keys / swipe, page-turn animation.
  Shows ONLY the photo's caption: a date leading the caption ("1964 —", "Late 1960s —",
  "October 31, 1977 —") becomes the blue date above it and comes off the text; no date in the
  caption = that section's year. Videos play in it (youtube-nocookie).
  **Phones: nothing bounces as you flip.** history.js measures the LONGEST caption in the whole
  book at that screen width and makes the caption box that tall, so the date sits in the same spot
  on every photo; each photo sits right on top of the date (the stage aligns to the bottom, photo
  max-height = screen minus the caption box, passed as `--caph`); the ‹ › arrows and "Photo 4 of
  10" are one fixed row at the very bottom. (The page-turn's 3D perspective lives in the keyframes,
  not on `.hlb-stage`, because a perspective there traps the fixed arrow row.) Desktop: arrows on
  the sides, photo centered, as before.
- **Year rail** on the right: big on wide screens (1380px+), small and faded until hover on
  laptops (901–1379px; the timeline gets 64px side padding there so it never covers photos),
  hidden on tablets/phones. Shows only while you're in the timeline.
- **No "Not sure which boat?" pill** on this page (tool-nudge.js skips `/our-history/`).

## 2. Where things live

**Tyler's side (OneDrive):** `…/70 MARKETING AND BRAND/WEBSITE/MASTER-WEBSITE PHOTOS/ABOUT | HISTORY/`
| What | Where |
|---|---|
| Hero photo | `01-HERO-TITLE IMAGE.jpg` (root) |
| Closing photo | `01-END CAP IMAGE.jpg` (root) |
| Timeline photos | one folder per date or era: `1915`, `1920s`, `1947`, `1982` … (4-digit numbers are YEARS, never hull numbers; a folder may add words: `1947-RUNNING THE ROGUE`) |
| Brochures & ads | `HERITAGE BROCHURES-ADS/` (named by date: `1984-BROCHURE.JPG`, `EARLY 1980s-BROCHURE.JPG`) |
| Map scan | `GENERAL HISTORICAL-UNKOWN DATES/ROGUE RIVER BASIN.JPG` |

**Repo side (`~/Desktop/LOCAL-WEBSITE`):**
| What | Where |
|---|---|
| Page | `our-history/index.html`. Generated between markers, DON'T hand-edit inside: `<!-- HIST:archives -->`, `<!-- HIST:timeline -->`, `<!-- HIST:videos -->`. The map section is hand-placed (outside markers). |
| Dates, date text, timeline videos, links | `_build/history_timeline.txt` |
| Heritage Videos list | `_build/history_videos.txt` (ID \| page title \| length \| thumbnail size \| crop) |
| Video thumb crop tool | `_build/history_vidcrop.js`: paste into the browser pane on /our-history/; prints each video's crop (`wide` or `x,y,w,h`) |
| Builder | `_build/build_history.pl` |
| Face-aware thumbnail cropper | `_build/history_focus.swift` (macOS Vision; the builder compiles it once to `$TMPDIR/wb-history-focus`) |
| Map cleaner + river tracer | `_build/history_map.swift` (only re-run if the map scan changes; paste its new path into the `.hmap` SVG) |
| Behaviour | `assets/history.js` |
| Styles | `house.css`, the "OUR HISTORY" blocks near the end (every class starts with `h`: `.hhero .hera .htile .hcar .hclip .hvids .hend …`, plus `main.hist + footer`) |
| Web images | `assets/history/<date>/NN.jpg` (viewer) + `thumbs/NN.jpg` (square tiles); `archives/` + `archives/clip/`; `hero.jpg`, `endcap.jpg`, `rogue-map.jpg`, `rope-v.png` |

## 3. How Tyler updates things (his side)

- **Photos:** drop them in the date/era folder. **Order = filename order** (`1947-001`, `1947-002` …).
- **Captions:** type them in each photo's **Description** metadata (Finder Get Info comments also
  work as a fallback, but they're lost on export/re-save, so Description is the main one).
  Start with the date: "1964 — Glen…", "Early 1980s — …". In a single-year folder the repeat of
  that year is dropped automatically; in an era folder the photo's own date stays.
- **New date/era:** make the folder, then tell Claude the year and its line of text (or "no text",
  like 1982). Eras automatically **open** their decade (1970s comes before 1973 … 1979).
- **Video in a date's carousel:** send the YouTube link + where ("after the 2nd photo").
- **Heritage Videos:** the page doesn't watch the playlist live. Say "update heritage videos".
  Old 4:3 videos show as squarer 4:3 tiles with YouTube's black bars cut off; true 16:9 ones stay
  wide. New videos need their crop measured (`_build/history_vidcrop.js`) or they warn on rebuild.
- **Brochures:** drop/rename in `HERITAGE BROCHURES-ADS`; the date in the caption sets the order
  (in a decade: Early first, then plain "1980s", the years, Mid, Late). Same date = filename order,
  so number them to force it: `EARLY 1980s-1-WORK BOATS BROCHURE.JPG`, `EARLY 1980s-2-ALASKAN…`.
- Then say "rebuild" (or "update 1970s"), check the browser pane, and **Push origin** in GitHub Desktop.

## 4. How Claude updates things

```
cd ~/Desktop/LOCAL-WEBSITE
perl _build/build_history.pl              # photos, captions, timeline, brochures, videos, hero, end cap
perl _build/build_history.pl --captions   # same, and lists every caption (check for typos)
perl _build/stamp_assets.pl               # REQUIRED after any house.css / history.js change (cache-bust)
```
- **Timeline file** (`_build/history_timeline.txt`): `== YEAR` starts an entry, text lines under it,
  optional `video: URL | Title` (first tile) or `video: URL | Title | after 1970s-005` (right after
  that photo; stays attached if photos are reordered; warns + goes first if the photo is gone),
  optional `link: URL | Label` (button). Page order is sorted automatically.
- **Preview:** the in-app preview server can't read ~/Desktop (macOS privacy block). Mirror and serve:
  `rsync` `our-history/`, `house.css`, `favicon.ico`, `assets/*.js`, `assets/brand/`, `assets/fonts/`,
  `assets/history/` into `<scratchpad>/site/`, run `python3 -m http.server 8813 --bind 127.0.0.1`
  there (background), open `http://127.0.0.1:8813/our-history/` with preview_start. Re-sync after
  every change. The site uses smooth scrolling, so in scripted checks use `behavior:'instant'`.
- **Git:** Claude commits finished, checked work. **Tyler pushes** (GitHub Desktop). `git push`
  from the shell fails (no credentials); don't go looking for them. `git fetch` first; if the
  Instagram bot pushed, `git pull --rebase` so Tyler's push is clean.
- Check at 1440 desktop and 375 phone before committing.

## 5. Decisions Tyler made (don't undo)

- Hero + closing title: blue Rockwell, centered; hero white line centered and clear of Glen's head.
- Hero photo is NEVER cropped on desktop (`aspect-ratio`, no screen-height cap): Glen's hand on the
  tiller is in the bottom 7% and is part of the shot. If the hero image is replaced, update the ratio.
- Viewer on phones must stay steady: same date spot for every photo (sized to the longest caption).
- Date titles small (28–36px); ghost years behind them; rope skinny (9px).
- Section headings: blue title first, the small black line (`.hmap-kick`, 13–15px) UNDER it.
- Timeline prints show captions under them (dates-only was tried and reverted). Brochures show
  dates only. The viewer shows only the photo's caption, date pulled into the blue title.
- Brochures above the timeline, as one sideways strip that runs nearly side to side (44px in from each edge, 24px on phones; `.hclipcar` breaks out of `.wrap`). Heritage Videos (`.hvidcar`) is wide too but stops short of the year rail (96px in on laptops,
  124px on 1380+). The rail hides while the brochure strip passes its spot (history.js `wideStrips`). Heritage Videos right after the timeline, ABOVE the map; the map leads into the closing photo (Tyler swapped them 2026-10-14).
- No Build & Price button, no book cover, no pill, no pagemast.
- Scroll bars pale ghost-year blue. Drop shadows must fade out fully (tracks have extra bottom room).
- Images: fast but NEVER visibly softer, and keep pixel sizes. Tiles 720px square (cut to what's
  shown, aimed at faces), viewer photos 2000px; a size budget only steps JPEG quality 82→78→75.
- Footer star bigger + plain on this page only; other pages keep the small star.

## 6. Gotchas (learned the hard way)

- `sips --cropOffset 0 0` is ignored (center-crops) → squares are cut by `history_focus.swift --crop`.
- Site-wide `section{padding:36px 0}` only shows on wider screens; `.hend` and `.hmap` override it.
- The footer has a 40px top margin site-wide; `main.hist + footer` zeroes it here.
- YouTube's playlist RSS only returns 15 videos; read the playlist page's data for all of them.
  Thumbnail sizes vary by upload: `history_videos.txt` records the sharpest (maxres > sd > hq).
- `sips -g description` prints `<nil>` when empty; the builder treats that as no caption.
- Photo numbers in history folders are years: never run these through build_gallery.pl or Model Ready.
- Editing files with `perl -pi` and non-ASCII text can scramble characters; use Python with UTF-8.

## 7. Open items / ideas

- Fix typos on YouTube itself: "Slamon Trip Rapids", "Ranie Falls", "Glen Seniors" (page shows them fixed).
- 2026-008 caption: "…in **his** 20-foot Alaskan XLT" (whose?). 2026-009 is a 2022 photo in the 2026 folder.
- ~27 originals are small scans (short side under 600px); their tiles can look a little soft. Only bigger
  scans fix that (`--captions` run lists them as "low-res originals").
- Hero file is 1200px wide; a re-export at 2400px+ would be sharper on big screens.
- The other photos in `GENERAL HISTORICAL-UNKOWN DATES` (1914 Grants Pass, bar blasting, Truman Bradley…)
  aren't on the page yet.
- Year rail: with ~30+ dates it'll be taller than a short laptop screen; tighten spacing then.
- Carousel counter shows the tile nearest the middle, so it can go 1 → 3 on the first click.

## 8. Wording changes to Glen Jr.'s approved timeline

Typos fixed, meaning unchanged: 1947 "…with a 22-horsepower Evinrude"; 1950s "develops the first
Jackass lift… The lift lets the boat run in shallower water"; 1975 "is the first to run up Hells
Gate"; 1977 "develops the outboard jet tunnel"; 1978 "Glen Wooldridge and Dave Devore develop the
first stainless steel outboard impeller". Tyler later supplied new text for 1970s, 1973, 2004 and
2024 (and removed 2010), which is used as written.
