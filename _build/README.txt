Build scripts for the fleet gallery (run with Git Bash perl):
  perl _build/regen_manifest.pl   — rescan assets/photos into photo_manifest.json
  perl _build/build_gallery.pl    — regenerate assets/photo-data.js + photos/index.html
                                    (reads section intro copy from the existing photos/index.html)
  perl _build/serve.pl <site-root> [port] — tiny local preview server
Run these after adding/removing photos in assets/photos/<model>/ (+ thumbs/).
