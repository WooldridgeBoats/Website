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
