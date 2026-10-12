# OUR HISTORY PAGE: HANDOFF

Rebuild of **/our-history/** (dev.wooldridgeboats.com/our-history/). Started 2026-10-12.
Tyler: "Wooldridge Boats is an American Legacy brand, so this page is very important
to get right... interactive and captivating." Expect many more rounds.

## What's built (first pass, 2026-10-12)

- **Hero** = Tyler's `01-HERO-TITLE IMAGE.jpg`, laid out like his mockup
  `EXAMPLE-HERO-TITLE IMAGE.jpg` (both in the OneDrive folder below): blue Rockwell
  "Four Generations. / One River at a time." centered on the sky, the first line of
  the about copy in white, right-aligned, on the photo. Phones: the title stays on the
  photo and that first line drops under it. The old pagemast ("Wooldridge Boats ·
  Seattle", HOME / OUR HISTORY crumb, "EST. 1915" kick) is gone, per Tyler.
- **About copy** (Tyler's 4 paragraphs) centered under the photo. The book title links
  to the store: https://store.wooldridgeboats.com/products/the-rogue-a-river-to-run-book
  (store is password-protected while in dev; the link is Tyler's). Link only, no cover
  image (Tyler's call).
- **Rope divider** (assets/brand/rope.png) + "THE TIMELINE · 1915 – TODAY" kicker.
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
- **Year rail** (screens ≥1380px): a jump list of years on the right edge, current one
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
