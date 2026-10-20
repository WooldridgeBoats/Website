# Next chat: start here (written 2026-10-20)

Repo `~/Desktop/LOCAL-WEBSITE` (dev.wooldridgeboats.com). I commit; Tyler pushes in GitHub Desktop. Never
`git push`. Stage explicit paths only, never `git add -A`: other Claude sessions share this folder.

## Read first (only what the job needs)
- Photo folders → page → command: `_build/MASTER-PHOTO-FOLDERS.md` (OneDrive MASTER-WEBSITE PHOTOS is the
  master: `BOAT MODELS/`, `CUSTOM BOAT MODELS/`, `NEW INVENTORY/`, `LOGOS-GRAPHICS/`…; X Drive = archive).
- Model Ready / main models: `_build/MODEL-READY-HANDOFF.md` + `BOAT-MODEL-IMAGE-UPDATES-HANDOFF.md`.
- Custom builds (all 7 DONE): `_build/CUSTOM-BUILD-HANDOFF.md`.
- In Stock page (`/new-inventory/`), stamp, menu switch, homepage card: `_build/IN-STOCK-PAGE-HANDOFF.md`.
- Store header / favicon: `~/wooldridge-store-build/HANDOFF.md`.

## State at hand-off
- Everything from 2026-10-20 is pushed except this note. After any push: `git fetch`, check live with
  `?nc=<time>` URLs (a deploy lands about 6 minutes after the push).
- Store header with the "In Stock" link pushed 2026-10-20. The storefront is password-protected, so
  Tyler checks it visually.

## Open items
1. **SOLD stamp:** design it with Tyler when Hull #5334 sells, then `sold:true` + re-run
   `_build/build_new_inventory.sh` (turns the In Stock menu link off on site + store).
2. **Next In Stock boat:** follow IN-STOCK-PAGE-HANDOFF "Add a boat".
3. **Any menu change:** also regenerate + push the store header (`gen_header.py`, `themeFilesUpsert`),
   Tyler's OK each time (auto mode blocks it as a production deploy). Store menu must ALWAYS match.

## Rules picked up this session (also in memory / CLAUDE.md)
- Model Ready: check first and list bad names; I may fix simple ones in the master (e.g. a missing hull).
- If Tyler links an X Drive folder, compare with OneDrive (md5) and build from OneDrive.
- Store favicon + menu must match the site. Favicon master: `LOGOS-GRAPHICS/WB-ICON-LOGO-FAVICON.png`
  (512px); site sizes 16/32/180 + .ico, bump `?v=` on the links (pages + `gen_pricesheets.pl`); store via
  `~/wooldridge-store-build/tools/set_favicon.py`.
- LOGOS-GRAPHICS holds copies of only the graphics the site uses (ALL CAPS names); trash unused ones.
- Model prev/next bar: the 18 main models in desktop menu order, custom builds a separate loop
  (`assets/pagenav.js` LOOPS). A new model goes there too.
- Screenshots: `scratchpad/snap URL out.png W VH y h` (blank below ~4000px or on homepage fade-in sections:
  use the in-app browser or jump to `#anchor`). Preview: rsync to `scratchpad/site`, `python3 -m http.server`.
