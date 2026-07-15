AD CAMPAIGN — BUYER-TYPE LANDING PAGES
=======================================
Built July 2026 from the "Targeted Launch Campaign for the Boat Quiz and
Online Configurator" proposal (Ad Campaign Proposal.docx) + the 2026 website
build data. Campaign line: "Go Farther. Go Skinny. Go Wooldridge."

WHAT'S IN THIS FOLDER
  index.html                  ← INTERNAL hub: review all 8 pages, budget map.
                                Do not publish this one.
  alaska-lodge-guide.html     ← the 8 customer-facing landing pages
  pnw-river-hunter.html
  michigan-rivers.html
  government-agency.html
  shallow-river.html
  offshore-aluminum.html
  family-adventure.html
  cargo-remote-property.html
  _template.html              ← master template (all 8 pages' content in one
                                data block). Edit content HERE, then regenerate.

EVERY PAGE IS FULLY SELF-CONTAINED
  No dependency on house.css, shop.js, or any image files. Only outside
  request is Google Fonts (falls back to system fonts offline). Double-click
  any page to review it.

HOW THE PAGES ARE STRUCTURED (per the proposal's funnel)
  • Hero with buyer-specific headline + TWO CTAs. Cold-audience pages lead
    with the QUIZ; high-intent pages (lodge/guide, shallow-river, cargo) lead
    with the CONFIGURATOR; the agency page leads with "start an agency spec."
  • "Your Water" — regional pain points in the buyer's language.
  • "Why Wooldridge" — advantages relevant to that buyer (tunnel, structure,
    warranty, HDPE, salt setup, payload…), grounded in site copy and FAQ.
  • "The Short List" — 3 recommended models with real 2026 from-prices,
    model-page links, and PREFILLED configurator deep links.
  • Proof row + heritage line (1915, four generations, lifetime warranty,
    Glen's first-evers, real agency builds).
  • "Common Configurations" — spec recipes using real build-sheet options.
  • Regional dealer strip + final CTA + phone.

INTEGRATION (for the website chat)
  1. Each page has ONE constant to set, near the top of its <script>:
         const SITE_ROOT = 'https://www.wooldridgeboats.com';
     Point it at the site these pages join (or '' for site-root-relative if
     the pages live inside the site, e.g. at /lp/<page>.html).
  2. All CTAs carry tracking parameters already, matching the proposal's
     measurement plan:
         utm_source=paidads & utm_medium=cpc
         & utm_campaign=wb-<page-id> & utm_content=<which button>
     Wire your analytics to quiz starts / configurator starts split by
     utm_campaign and you have the region-by-region report the proposal
     asks for.
  3. "Build this boat" links use the configurator's own #b= prefill hash —
     they open Build & Price with that model preselected.
  4. Suggested placement: /lp/ folder, one page per ad group. The proposal's
     Week-1 task ("finalize landing pages, tracking links, conversion
     events") is what this folder delivers.

AD-GROUP TARGETING DATA (from the proposal, embedded in each page's
`meta` field in the data block):
  Page                    Region / budget           First-wave targets
  alaska-lodge-guide      Alaska — 30%, highest     25 AK ZIPs (Anchorage, Mat-Su,
                                                    Kenai, Fairbanks, SE AK, Kodiak)
  pnw-river-hunter        WA/OR — 25%, high         24 WA + 14 OR ZIPs
  shallow-river           ID/Inland NW — 15%        14 ID ZIPs + MT/WY selective
  cargo-remote-property   AK + Canada buckets       AK ZIPs + 16 Canada cities (FSA)
  offshore-aluminum       Coastal WA/OR + BC        Coastal ZIP cells + BC cities
  family-adventure        All regions + retargeting Regional lists; retargeting pool
  michigan-rivers         EXPANSION — not in the    TBD (suggest Grand Rapids /
                          first-wave proposal        Muskegon / Traverse City DMAs)
  government-agency       National, procurement     Not ZIP-targeted; direct/LinkedIn

EDITING CONTENT
  All copy lives in the PAGES object in _template.html (identical in every
  page file). To change copy once for all pages: edit _template.html, then
  re-copy it to each page filename, replacing __PAGEID__ with the page's id.
  PowerShell one-liner:
    $t=[IO.File]::ReadAllText('_template.html');
    'alaska-lodge-guide','pnw-river-hunter','michigan-rivers','government-agency','shallow-river','offshore-aluminum','family-adventure','cargo-remote-property' |
      ForEach-Object { [IO.File]::WriteAllText("$_.html", $t.Replace('__PAGEID__', $_)) }

FACTS & PRICES
  Model from-prices, options, dealer contacts, FAQ claims (9° deadrise,
  anode guidance, two-piece windshield), and agency build examples are all
  from the 2026 "website final" build data. Prices subject to change —
  confirm with the factory before ad copy locks.

RE-SKIN NOTE (2026-07-07, website chat)
---------------------------------------
All pages re-skinned to the website's V3 design language (F2F2F2 ground,
Wooldridge blue #1b75bb, Georgia serif headings, Inter 200 body, compass-star
dividers, wing-logo brand bar) with a per-persona THEME block in _template.html:
each page gets its own accent color, a real hero photo from /assets/photos/,
and a mood-tuned overlay. SITE_ROOT is preset to '..' because these pages now
live inside the site at /lp/ — set it to the public URL only if a page is
hosted off-site. The internal hub was renamed index.html -> _campaign-hub.html
so /lp/ has no public directory page. Regeneration one-liner unchanged.
