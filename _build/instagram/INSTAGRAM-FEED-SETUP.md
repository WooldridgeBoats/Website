# Live Instagram feed — how it works and how to turn it on

The homepage "Instagram" strip can show your real, latest @wooldridgeboats posts,
updated automatically, for **$0/month** — no Smash Balloon, no plugin, no monthly
service. This explains the setup. The website half is already built and live-safe;
what's left is a one-time connection to your Instagram account.

---

## The big picture (three simple parts)

```
   Instagram  ──►  a free robot on GitHub  ──►  a tiny file: feed.json  ──►  the website
  (your posts)      (runs every hour)          (8 latest posts)          (shows them)
```

1. **The robot** is a scheduled job that runs on GitHub for free (a "GitHub Action").
   Once an hour it asks Instagram for your 8 newest posts, saves the photos, and
   writes a small file called `feed.json`.
2. **feed.json** is served by jsDelivr, a free public delivery network, so the
   website can read it instantly from anywhere.
3. **The website** reads that file and drops your latest posts into the strip.

**Safety net:** if the robot hasn't been set up yet, or ever hiccups, the site
just shows the 8 photos already baked into the page (`assets/homepage/ig-1..8.jpg`).
It can never look broken or empty. So the site is safe to ship *right now*, before
any of the Instagram setup is done.

---

## What's already done (in the website code)

- `assets/instagram.js` — reads `feed.json` and fills the strip; falls back to the
  baked-in photos if anything's missing.
- `index.html` — loads that script, and carries the feed location on the section:
  `<section id="instagram" data-feed="…feed.json">`. That attribute is the only
  knob; change it there if the feed ever moves.
- `.github/workflows/instagram-feed.yml` — the robot. It's dormant until you add
  the token below, then it turns itself on.
- `_build/instagram/fetch_feed.mjs` — the small program the robot runs.
- `_build/instagram/feed.example.json` — an example of what the feed looks like.

---

## What only you can do (the one-time connection)

I can't log into your Instagram or Meta for you — that authorization has to be
you. It's about 15 minutes and best done together on a screen share, because
Meta moves their buttons around. Here's the shape of it so there are no surprises:

### Step 1 — Make @wooldridgeboats a Professional account (if it isn't already)
It needs to be a **Business or Creator** account (free). You almost certainly
already have this since you run Meta ads. In the Instagram app:
Settings → *Account type and tools* → confirm it's Professional.

### Step 2 — Get a long-lived Instagram access token
A "token" is just a long password that lets the robot read *only* your public
posts. At **developers.facebook.com** you create a free app, add **"Instagram"**,
choose **"Instagram API with Instagram Login,"** connect @wooldridgeboats, and
click to generate a **long-lived token**. (This is the fiddly, click-heavy part —
let's do it together and I'll point at each button.)

### Step 3 — Paste the token into GitHub (this is what flips it on)
In the repo **github.com/WooldridgeBoats/Website**:
Settings → *Secrets and variables* → *Actions* → **New repository secret**
- **Name:** `IG_TOKEN`
- **Value:** the token from Step 2

That's it. Within the hour the robot runs, `feed.json` appears, and the strip goes
live. (You can also hit **Run workflow** on the Actions tab to fire it immediately.)

### Step 4 — (Optional) Make it truly set-and-forget
Instagram tokens expire every ~60 days. The robot renews yours automatically **if**
you also give it permission to save the renewed token. To enable that, create a
GitHub "personal access token" with permission to edit this repo's secrets, and
add it as a second secret named `GH_PAT`.
- If you do this: the feed runs forever, untouched.
- If you skip it: everything still works, but every ~55 days you'll re-paste a
  fresh `IG_TOKEN` (I can set a calendar reminder). Your call — Step 4 is the
  "never think about it again" option.

---

## Cost & upkeep
- **$0/month.** GitHub Actions and jsDelivr are free at this scale.
- With Step 4 done, **zero** upkeep. Without it, a 2-minute token paste every ~2 months.
- Posts appear on the site within about an hour of going up on Instagram.

## About Smash Balloon
Smash Balloon is a **WordPress plugin**, and this new site is plain HTML (no
WordPress), so it can't run here — nothing to move it to. Keep that subscription
only as long as your *current* WordPress site still needs it; it plays no part in
this setup.

## If you'd rather not deal with tokens at all
A paid service (e.g. Behold.so, ~$0–10/mo) keeps the Instagram connection alive
for you and hands us the same kind of `feed.json`. If you ever want that instead,
we only change the one `data-feed="…"` link in `index.html` — the website side
doesn't change. This free version is the default; the door stays open.
