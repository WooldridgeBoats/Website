Build scripts for the fleet gallery (run with Git Bash perl):
  perl _build/regen_manifest.pl   — rescan assets/photos into photo_manifest.json
  perl _build/build_gallery.pl    — regenerate assets/photo-data.js + photos/index.html
                                    (reads section intro copy from the existing photos/index.html)
  perl _build/serve.pl <site-root> [port] — tiny local preview server
Run these after adding/removing photos in assets/photos/<model>/ (+ thumbs/).

  perl _build/inject_partials.pl  — bake header.html / footer.html into every page
                                    that carries a <!-- PARTIAL:header/footer --> block.
Run this after editing header.html or footer.html, then commit the regenerated
pages. The site has no server-side include support (no SSI on the host), so
header.html/footer.html are the single source of truth for editing, but the
deployed pages must contain the real, static content — this script keeps
them in sync. It's idempotent, safe to re-run any time.

  perl _build/gen_preowned.pl     - the pre-owned listings: one page per boat under
                                    pre-owned/<slug>/ plus the cards on /pre-owned/, from
                                    _build/preowned.json (THE data - edit that, never the pages).
  perl _build/gen_preowned.pl --check   - report only
Run it after adding, changing or selling a pre-owned boat in preowned.json. It chains
stamp_assets, gen_canonicals and gen_sitemap itself. A boat marked sold:true (or
removed) has its page folder deleted; photos stay in assets/preowned/<slug>/.

  perl _build/build_home_videos.pl [--sync] — the homepage's Featured Videos strip
                                    from _build/home_videos.txt; --sync first re-reads
                                    Tyler's "HOME PAGE" YouTube playlist into that list.
Run it when Tyler says "update homepage videos". The strip + viewer are the
Heritage Videos code from /our-history/ (assets/history.js, .hvidcar in house.css).

  perl _build/stamp_assets.pl      — cache-bust every local .css/.js reference
  perl _build/stamp_assets.pl --check   — report only, change nothing

RUN THIS AFTER EDITING ANY .css OR .js, BEFORE COMMITTING A DEPLOY.

Why it matters: Cloudflare caches static assets for four hours (max-age=14400)
but does NOT cache the HTML (it reports pages as DYNAMIC). So a deploy can put a
new house.css on the host while Cloudflare keeps serving the old one to everybody
— which is exactly what happened on 29 July 2026, when the new site-wide backdrop
went live and was invisible for hours.

The version string is an MD5 of the asset's own contents, so it changes when and
only when the file changes. Unchanged files keep their URL and stay cached, which
is the point of caching. Do not hand-type a version: the 25 model pages carried a
hand-typed "?v=20260708b" that nobody remembered to bump, which is why the
mechanism silently stopped working.

Idempotent. Query strings are stripped by serve.pl, so stamped links work
unchanged in local preview.

  node _build/audit_quiz_reach.js  — reachability audit for the Which Wooldridge quiz
  node _build/audit_quiz_reach.js --full          whole table
  node _build/audit_quiz_reach.js --model ssd     one boat

Brute-forces all 680,400 reachable answer paths against the quiz's own scoring
matrix (lifted live out of which-wooldridge/index.html, so it can never drift
from what ships) and asks the only question that matters: can a customer who
honestly describes boat X ever be told X?

Exit 0 = PASS, 1 = a model failed, 2 = the script could not read the page.

It flags three failure modes:
  - a model that can NEVER be the top recommendation
  - a model that loses on its OWN ideal-customer profile — the answer set that
    maximises that model's own score. This is the one that bites: the boat is
    technically reachable, but not by the buyer it was designed for.
  - a model that only ever wins on a tie-break. Ties resolve by key order in T,
    which is arbitrary and invisible, so those "wins" are one edit from vanishing.

As of 1 Sep 2026 it exits 0 - every model is reachable and wins on its own
ideal-customer profile. It got there via four weight changes Stephen ruled on
that day (commit 356432c): Alaskan XL and Rogue HDPE had both been losing on
their own ideal profiles, to Skagit and Alaskan LT respectively. Rebalancing
the weights is a Stephen + Danny call, not a code fix; this script only
measures. Re-run it after any weight change and after gen_fleet.pl rewrites
the FACTS block, and treat a non-zero exit as a release blocker.

Since 14 Oct 2026 it also checks the SECOND recommender, Request a Quote, which
scores the same matrix with its own smaller scorer (no shallow / rough / helm /
tow questions). Its copy of the matrix must equal the quiz's cell for cell, or
the audit FAILS. Its own reachability is printed as NOTE lines and never fails
the audit - closing those gaps needs new questions or new weights, a business
call.

  perl _build/sync_quiz_matrix.pl          — copy the quiz's matrix into Request a Quote
  perl _build/sync_quiz_matrix.pl --check  report only; exit 1 if they differ

The quiz owns the matrix (between /* MATRIX:BEGIN */ and /* MATRIX:END */ in
which-wooldridge/index.html). Edit it there, run the sync, then the audit.

  _build/sync_shop_live.ps1        -- RETIRED 2026-10-20 (Stephen's ruling). Do not run it.
In The Shop Right Now (the home-page strip and in-the-shop/) is Tyler's now: his folder
SQUIRREL HOLE\70 MARKETING AND BRAND\WEBSITE\MASTER-WEBSITE PHOTOS\IN THE SHOP-WEB\ and his
own Mac-side process feed it. The Build Hub's "Show on website" toggle, its stage-change
auto-refresh and the /shop-live command were retired the same day. The SHOP-LIVE markers on
index.html and in-the-shop/index.html and the rows between them were left exactly as they
were for Tyler's process to own. The script stays in the repo (header says RETIRED) so
pieces of it can be reused. Dossier and restore steps:
WB FILES\5 - IT AND SYSTEMS\RETIRED TOOLS\RETIRED 2026-10-20 - IN THE SHOP SYNC\README.md
