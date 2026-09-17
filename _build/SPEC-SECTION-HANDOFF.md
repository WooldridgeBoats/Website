# SPEC SECTION (per boat model page) — HANDOFF / RUNBOOK

**Point Claude at this file in a fresh chat** to build the new **Specifications** section on the
Wooldridge boat-model pages, without re-explaining the repo. Companion to
`_build/BOAT-MODEL-IMAGE-UPDATES-HANDOFF.md` (the photo project) — same repo, same 25 pages,
same build/preview/deploy workflow.

Repo: `~/Desktop/LOCAL-WEBSITE` (git → `github.com/WooldridgeBoats/Website`, deploy branch `main`
via cPanel; **Cloudflare caches assets 4h but NOT html**, so `perl _build/stamp_assets.pl` is
mandatory whenever any `.css`/`.js` changes). Preview: `python3 -m http.server 8811` in the repo
root, open `http://127.0.0.1:8811/...` in the browser pane (its own WEBrick EPERMs on the Desktop).
Tyler drives every `git push`.

---

## THE GOAL

Add a **Specifications** section to each boat-model page (`models/<slug>/index.html`):
- **Placement:** directly **below the "Standard features" section**, above Pricing.
- **Interaction:** a **click-to-expand fold**, exactly like the Pricing section
  (`<details class="pfold">` — summary you click, body pops open).
- **Layout:** match the **PNG mockup Tyler supplies** (his finished layout example — this is the
  visual reference the same way the Alaskan LT page was the gallery reference).
- **Fields:** length (LOA), beam, bottom width, depth/side height, transom height, hull gauge
  (side + bottom), weight, capacity, fuel, deadrise (+ deadrise in bow). Final field list/labels
  come from Tyler's PNG.
- **Roll it out consistently across every model page**, with **per-model data** (values differ per
  model, and often per length/config).

---

## ✅ PRIOR ART ALREADY IN THE REPO — START FROM THIS, DON'T REINVENT

Two pages already have a built Specifications section using an existing house style:
- **`models/canyon/index.html`** and **`models/landing-craft/index.html`**.

Canyon's markup uses `.specwrap` / `.spectbl`, **BUT those classes have NO CSS anywhere yet** —
canyon/landing-craft currently render as plain unstyled default tables. So you inherit a **markup
skeleton + field vocabulary**, and **writing the spec CSS (in `house.css`) to match Tyler's PNG is
part of the job.** (Reuse these class names or introduce your own — your call once you see the PNG.)
```html
<div class="sechead tight"><div class="eyebrow">Specifications</div>
  <h2 style="font-size:clamp(20px,2.6vw,28px);">…</h2></div>
<div class="specwrap">
  <table class="spectbl"><thead><tr><th colspan="2">21' Model</th></tr></thead>
    <tbody>
      <tr><td>Beam</td><td>102"</td></tr>
      <tr><td>Length Overall</td><td>21'6"</td></tr>
      <tr><td>Bottom Width</td><td>84"</td></tr>
      <tr><td>Side Height</td><td>38"</td></tr>
      <tr><td>Fuel Tank</td><td>77 gal</td></tr>
      <tr><td>Side Gauge</td><td>.125</td></tr>
      <tr><td>Bottom Gauge</td><td>.190</td></tr>
      <tr><td>Deadrise</td><td>12°</td></tr>
      <tr><td>Deadrise in Bow</td><td>18°</td></tr>
      <tr><td>Standard Motor</td><td>V8</td></tr>
    </tbody></table>
  … one <table class="spectbl"> per length (21'/23'/25'/27') …
</div>
```
So the field vocabulary + the per-length two-column table skeleton already exist. **The new work
is: (a) write the spec CSS to match Tyler's PNG (the tables are unstyled today), (b) wrap the spec
tables in a click-to-expand `pfold`, (c) add the section to every model page with each model's real
numbers.** Note: **canyon & landing-craft are 2 of the 8 pages that have NO "Standard features"
section** (see Placement) — they placed Specs on their own; fold them into the final standard.

---

## THE FOLD PATTERN TO REUSE (Pricing → Specs)

Tyler wants Specs to "click then pop out just like Pricing." Copy the Pricing `pfold` shell
(from any model page, e.g. `models/alaskan/index.html`) and drop the spec tables in the body:
```html
<details class="pfold">
  <summary>
    <span class="pfoldeyebrow">Specifications</span>
    <span class="pfoldtitle">Dimensions &amp; hull specs</span>
    <span class="pfoldchev" aria-hidden="true"></span>   <!-- pfoldfrom (the "from $…") is optional; omit for specs -->
  </summary>
  <div class="pfoldbody">
    <div class="specwrap"> …spectbl(s)… </div>
  </div>
</details>
```
`.pfold` / `.pfoldbody` / `.pfoldchev` are already styled in `house.css` and already work on every
model page — no new fold CSS needed. Match the PNG for what's INSIDE the body.

---

## PLACEMENT — and a wrinkle

On a typical page the section order is: … → **Standard features** (`<div class="stdgrid">…</div>`)
→ **Pricing** → **Photo gallery**. Insert the Specs fold **right after the `stdgrid` block and
before the Pricing `sechead`**.

⚠️ **Only 18 of 26 model pages have a "Standard features" section.** The **8 without** it are:
`angler`, `canyon`, `deepwater`, `landing-craft`, `pybus-offshore`, `riverrat-diy-kit`,
`supersportoffshorepilothouse`, `xp` (— `xp` is a redirect stub, skip it). For these, decide a
consistent fallback placement (likely right after the fact row / CTAs, or after the video) with
Tyler. Note **canyon & landing-craft already have a Specs section** but no Standard-features anchor —
reconcile them into the final standard rather than duplicating.

---

## DATA SOURCING (Tyler supplies)

- Per-model spec numbers come from **the current LIVE site** (`wooldridgeboats.com` model pages /
  spec tables) **+ screenshots Tyler supplies** of the specific finished models.
- Values are **per model, and usually per length** (see canyon's one-table-per-length layout).
- In-repo leads (partial only, not a full dataset): `tools/WOOLDRIDGE_SALES_ASSIST.html`,
  `option-guide/index.html` mention some spec fields — useful for label wording, not authoritative.
- **Do NOT invent/guess numbers.** Every value must come from the live site or Tyler's screenshot.
  If a value is missing, flag it and leave a clear placeholder for Tyler rather than fabricating.

---

## SUGGESTED CADENCE (mirrors the photo project)

1. Tyler drops the **PNG mockup** + the first model's **data/screenshots** and names a **reference
   model** to build first.
2. Build the Specs fold on that ONE page to match the PNG; preview + verify in the browser pane
   (fold opens/closes, values correct, responsive, dark mode, 0 console errors).
3. Tyler approves the look on the reference model.
4. **Roll to all model pages** (per-model data), consistent markup — same "build one, approve, roll
   the fleet" pattern used for the masthead + galleries.
5. `perl _build/stamp_assets.pl` (if house.css changed), verify a couple pages, hand Tyler the
   commit line. He pushes.

---

## OPEN QUESTIONS TO SETTLE FIRST (in the new chat)

1. **The PNG** — get it; it drives the layout (table vs stat-grid, columns, styling, section title).
2. **Field list + labels** — Tyler's list vs canyon's existing labels; final set from the PNG.
3. **Per-length or single** — one spec table, or one per length/config (like canyon)?
4. **Section title** — "Specifications" / "Specs &amp; Dimensions" / other (PNG decides).
5. **Placement on the ~7–8 pages without "Standard features,"** and reconcile canyon/landing-craft's
   existing spec sections into the standard.
6. **Which model is the reference build?**

---

## SHARED WORKFLOW (same as the photo project — see the image-update handoff + Claude's memory)

- `house.css` is the single stylesheet; theme tokens on `:root`; keep new CSS scoped.
- After editing any `.css`/`.js`: `perl _build/stamp_assets.pl` (Cloudflare cache-bust).
- After editing `header.html`/`footer.html` partials: `perl _build/inject_partials.pl`.
- Preview with `python3 -m http.server 8811`; verify with the browser pane (read_page / geometry /
  screenshots — geometry is source of truth when the pane is hidden).
- Roll changes across ALL model pages consistently (the masthead `mp-tight` rollout is the template).
- Commit + push is Tyler's to run.
