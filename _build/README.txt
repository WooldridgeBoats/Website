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

As of 1 Sep 2026 it exits 1: Alaskan XL and Rogue HDPE both lose on their own
ideal profile (to Skagit and Alaskan LT respectively), and Skagit takes 26.5% of
all paths — 2.5x the next model. Rebalancing the weights is a Stephen + Danny
call, not a code fix; this script only measures. Re-run it after any weight
change and after gen_fleet.pl rewrites the FACTS block.
