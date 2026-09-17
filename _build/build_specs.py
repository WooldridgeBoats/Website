#!/usr/bin/env python3
"""
build_specs.py — stamp the "Boat Specifications" fold onto boat-model pages.

Data-driven: reads _build/specs-data.json (one entry per model slug) and writes
the <!-- SPECS:<slug> -->…<!-- /SPECS --> block into models/<slug>/index.html,
matching the approved Alaskan LT reference build. Re-runnable: if the markers
already exist it replaces the block in place; otherwise it inserts the section
right before the "2026 Pricing" sechead (i.e. just after Standard Features).

The component markup + CSS (.bspec*) + JS (initSpecTabs in modelpage.js) already
live in the repo — this only emits per-model markup. After running, cache-bust
with `perl _build/stamp_assets.pl` (nothing here touches css/js, but re-run it if
you also edited house.css/modelpage.js).

Usage:
  python3 _build/build_specs.py            # all models in specs-data.json
  python3 _build/build_specs.py rogue scout   # only these slugs

Row value formats in the JSON (each length gets one entry per row):
  "80 in."                                  -> plain centered value
  {"v": "90 hp", "badge": "Center Console"} -> value + inline blue badge
  a "badges" row (no "values"): badges[i] = [["Tiller","690 lbs."], ...]
                                            -> the per-config weight badge list
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "_build", "specs-data.json")


def esc(s):
    """Escape a data string for HTML text content (quotes/°/′ are fine as-is)."""
    return str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def value_cell(val, n):
    cls = "bspec-v bspec-v%d" % n
    if isinstance(val, dict):                       # value + inline badge
        inner = ('<span class="bspec-cell">%s <span class="bspec-dot" aria-hidden="true">'
                 '&middot;</span> <span class="bspec-badge">%s</span></span>'
                 % (esc(val["v"]), esc(val["badge"])))
        return '<td class="%s">%s</td>' % (cls, inner)
    return '<td class="%s">%s</td>' % (cls, esc(val))


def weight_cell(items, n):
    cls = "bspec-v bspec-v%d" % n
    lis = "".join('<li><span class="bspec-badge">%s</span><span class="v">%s</span></li>'
                  % (esc(lbl), esc(v)) for lbl, v in items)
    return '<td class="%s"><ul class="bspec-wt">%s</ul></td>' % (cls, lis)


def build_block(slug, m):
    lengths = m["lengths"]
    nlen = len(lengths)
    colspan = nlen + 1
    summary = m.get("summary", "Dimensions, Weight &amp; Power")
    intro = m.get("intro", "Configuration-specific differences are labeled below.")
    footnote = m.get("footnote")

    tabs = ['      <div class="bspec-lentabs" role="tablist" aria-label="Choose a length">']
    for i, L in enumerate(lengths, 1):
        act = " is-active" if i == 1 else ""
        sel = "true" if i == 1 else "false"
        tabs.append('        <button type="button" class="bspec-lentab%s" data-idx="%d" '
                    'role="tab" aria-selected="%s">%s</button>' % (act, i, sel, esc(L)))
    tabs.append('      </div>')
    tabs = "\n".join(tabs)

    cols = '<col class="bspec-c0">' + "".join("<col>" for _ in lengths)
    thcells = '<th scope="col" class="bspec-spec">Specification</th>' + "".join(
        '<th scope="col" class="bspec-v bspec-v%d">%s</th>' % (i, esc(L))
        for i, L in enumerate(lengths, 1))

    rows = []
    for cat in m["categories"]:
        rows.append('            <tr class="bspec-cat"><th colspan="%d" scope="colgroup">'
                    '<span>%s</span></th></tr>' % (colspan, esc(cat["name"])))
        for row in cat["rows"]:
            if "badges" in row:
                cells = "".join(weight_cell(row["badges"][i], i + 1) for i in range(nlen))
            else:
                cells = "".join(value_cell(row["values"][i], i + 1) for i in range(nlen))
            rows.append('            <tr><th scope="row">%s</th>%s</tr>' % (esc(row["label"]), cells))
    tbody = "\n".join(rows)

    foot = '      <p class="bspec-foot">%s</p>\n' % esc(footnote) if footnote else ""

    return (
'''  <!-- SPECS:%(slug)s -->
  <div class="sechead tight"><div class="eyebrow">Model Details</div>
        <h2 style="font-size:clamp(20px,2.6vw,28px);">Boat Specifications</h2>
        <p class="lede">%(intro)s</p></div>
  <details class="pfold bspecfold">
    <summary><span class="pfoldeyebrow">Full Specs</span><span class="pfoldtitle">%(summary)s</span><span class="pfoldchev" aria-hidden="true"></span></summary>
    <div class="pfoldbody">
%(tabs)s
      <div class="bspec-scroll">
        <table class="bspec">
          <caption>%(name)s specifications by length</caption>
          <colgroup>%(cols)s</colgroup>
          <thead>
            <tr>%(thcells)s</tr>
          </thead>
          <tbody>
%(tbody)s
          </tbody>
        </table>
      </div>
%(foot)s    </div>
  </details>
  <!-- /SPECS -->'''
        % dict(slug=slug, intro=esc(intro), summary=summary, tabs=tabs,
               name=esc(m["name"]), cols=cols, thcells=thcells, tbody=tbody, foot=foot))


MARKER = re.compile(r'[ \t]*<!-- SPECS:.*?-->.*?<!-- /SPECS -->', re.S)
ANCHOR = '  <div class="sechead tight"><div class="eyebrow">2026 Pricing</div>'


def insert(slug, block):
    path = os.path.join(ROOT, "models", slug, "index.html")
    with open(path, encoding="utf-8") as f:
        s = f.read()
    if MARKER.search(s):
        s = MARKER.sub(lambda _m: block, s, count=1)
        action = "replaced"
    else:
        i = s.find(ANCHOR)
        if i == -1:
            raise SystemExit("  !! %s: no SPECS marker and no '2026 Pricing' anchor" % slug)
        s = s[:i] + block + "\n" + s[i:]
        action = "inserted"
    with open(path, "w", encoding="utf-8") as f:
        f.write(s)
    return action


def main():
    with open(DATA, encoding="utf-8") as f:
        data = json.load(f)
    slugs = sys.argv[1:] or list(data.keys())
    for slug in slugs:
        if slug not in data:
            print("  !! %s: not in specs-data.json" % slug); continue
        m = data[slug]
        action = insert(slug, build_block(slug, m))
        nrows = sum(len(c["rows"]) for c in m["categories"])
        print("  %-9s %-26s %d length(s), %d rows" % (action, slug, len(m["lengths"]), nrows))
    print("Done. If you also changed css/js, run: perl _build/stamp_assets.pl")


if __name__ == "__main__":
    main()
