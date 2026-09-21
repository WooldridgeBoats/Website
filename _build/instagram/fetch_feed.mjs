// ─────────────────────────────────────────────────────────────────────────────
// fetch_feed.mjs — pull the latest @wooldridgeboats posts and write feed.json.
//
// Run by the GitHub Action in .github/workflows/instagram-feed.yml a few times a
// day. Needs Node 20+ (built-in fetch) and one environment variable, IG_TOKEN,
// a long-lived Instagram access token. No npm install, no dependencies.
//
// What it does:
//   1. Asks Instagram for the newest 8 posts.
//   2. Downloads each post's photo into assets/homepage/instagram/ (Instagram's
//      own image links expire after a while, so we keep our own copies).
//   3. Writes assets/homepage/instagram/feed.json, which the website reads.
//
// See _build/instagram/INSTAGRAM-FEED-SETUP.md for the whole picture.
// ─────────────────────────────────────────────────────────────────────────────
import { writeFile, mkdir } from 'node:fs/promises';

const TOKEN   = process.env.IG_TOKEN;
const REPO    = process.env.GITHUB_REPOSITORY || 'WooldridgeBoats/Website';
const BRANCH  = process.env.FEED_BRANCH || 'main';
const LIMIT   = Number(process.env.IG_LIMIT || 6);
const OUT_DIR = 'assets/homepage/instagram';
const PROFILE = 'https://www.instagram.com/wooldridgeboats/';
const GRAPH   = 'https://graph.instagram.com';

if (!TOKEN) {
  console.error('IG_TOKEN is not set — nothing to do. (Add it as a repo secret.)');
  process.exit(1);
}

// 1) newest posts ------------------------------------------------------------
const fields = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp';
const listUrl = `${GRAPH}/me/media?fields=${fields}&limit=${LIMIT}&access_token=${TOKEN}`;

const listRes = await fetch(listUrl);
if (!listRes.ok) {
  console.error(`Instagram returned ${listRes.status}: ${await listRes.text()}`);
  process.exit(1);
}
const { data = [] } = await listRes.json();
if (!data.length) {
  console.error('Instagram returned zero posts — leaving the existing feed alone.');
  process.exit(1);
}

// 2) download each image + 3) build the post list ---------------------------
await mkdir(OUT_DIR, { recursive: true });
const posts = [];
let n = 0;

for (const m of data.slice(0, LIMIT)) {
  // Videos/reels have no still image of their own — use their thumbnail.
  const srcUrl = m.media_type === 'VIDEO' ? (m.thumbnail_url || m.media_url) : m.media_url;
  if (!srcUrl) continue;

  n += 1;
  const name = `img-${n}.jpg`;
  const imgRes = await fetch(srcUrl);
  if (!imgRes.ok) { console.warn(`skipped ${name}: image ${imgRes.status}`); n -= 1; continue; }
  await writeFile(`${OUT_DIR}/${name}`, Buffer.from(await imgRes.arrayBuffer()));

  posts.push({
    permalink: m.permalink || PROFILE,
    image: `https://cdn.jsdelivr.net/gh/${REPO}@${BRANCH}/${OUT_DIR}/${name}`,
    caption: firstLine(m.caption)
  });
}

if (!posts.length) {
  console.error('Could not download any images — leaving the existing feed alone.');
  process.exit(1);
}

// 4) write the feed the site reads ------------------------------------------
const feed = { updated: new Date().toISOString(), profile: PROFILE, posts };
await writeFile(`${OUT_DIR}/feed.json`, JSON.stringify(feed, null, 2) + '\n');
console.log(`Wrote ${posts.length} posts to ${OUT_DIR}/feed.json`);

function firstLine(caption) {
  if (!caption) return '';
  const line = String(caption).split('\n')[0].trim();
  return line.length > 200 ? line.slice(0, 199) + '…' : line;
}
