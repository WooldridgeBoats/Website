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
