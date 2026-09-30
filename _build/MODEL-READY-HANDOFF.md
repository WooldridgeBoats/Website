# "Model Ready" — paste this into a NEW chat window

Copy everything in the box below as your first message in a new chat, then attach
the next model's master photo folder and say which model it is.

---

Continuing the dev.wooldridgeboats.com boat-model photo/gallery work in
~/Desktop/LOCAL-WEBSITE. FIRST read my memory note
`website-photo-replacement-workflow` — it has every gotcha + the full pipeline.

Serve: python3 -m http.server 8811. Verify in the browser pane — FRONT it
(tabs_select) so I can see it and SEND screenshots as files; set
resize_window {1440x900} desktop / {390x844} phone (never preset:"desktop");
screenshots go blank when the pane's hidden, so use DOM/javascript_tool
geometry as the source of truth.

Trigger: I say "Model Ready! <Model>" + attach the master folder
(OneDrive …/MASTER-WEBSITE PHOTOS/<MODEL>-WEB/). Then:
1. Confirm slug (models/<slug>/ == assets/photos/<slug>/; set PHOTOSLUG if they
   differ, NOCFG=1 if the model has no trim token).
2. Warm the source (find "<folder>" -name '*.jpg' -exec cat {} + >/dev/null),
   then pre-flight: [NOCFG=1] _build/check_model_photos.sh "<folder>" (exit 0 =
   safe). Fix obvious source-name typos in the master yourself; ASK me if a
   length/config is ambiguous.
3. Build (desktop+mobile in one): --dry-run, then
   [NOCFG=1][PHOTOSLUG=x] _build/apply_model_photos.sh <slug> "<Name>" "<folder>".
   Confirm "mobile photos: N (skipped: 0)" + WB_MOBILE lists every length.
4. Cross-refs (not auto-fixed): broken-image sweep; repoint lp/* persona hero →
   full hero-*.jpg; homepage photocard / borrowed category tile → thumbs/hero.jpg
   or cover-<len>.jpg.
5. Verify in browser (desktop cover cards + mobile portraits, captions, 0 broken);
   CONFIRM any data-yt with me (inboard ≠ outboard); check legacy tags render.
6. Give me the commit line — I push. Commit each model before the next.

State: the 18 MAIN models (the ones tied to the build configurator) all have
new desktop galleries; 8 also have mobile. The 10 pre-Scout models (Alaskan LT,
Alaskan, Alaskan XL, XLT, Rogue, Skagit, Sport, SSD, Sportster, Alaskan XL IB)
still need *-MOBILE exports from me, then a re-run. The 7 CUSTOM builds (Angler,
Canyon, Deepwater, Landing Craft, Pybus Offshore, RiverRat DIY Kit, SSO
Pilothouse) aren't part of the main lineup — their photos will come over time.
Legacy tagging is live (gold #c37d0f): a gallery length the model no longer
offers gets tagged automatically. Per-photo LM tags are RARE and only come on
files I supply — never add one yourself. Known trims: cc, ws, tiller, aft-ws,
cabin, pybus, first-responder + NOCFG. Hero captions are 13px. Hull regex
^[03-9]\d{3}$ in all 4 scripts.

Ready — I'll drop the next model or edit.

---
