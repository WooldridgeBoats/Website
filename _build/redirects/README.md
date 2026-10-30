# Old-site redirects (built 2026-10-29)

After the 2026-10-28 launch, Cloudflare showed about 3.8k 404s in 37 hours: old WordPress/WooCommerce
product pages, categories, PDFs, listings. This folder turns those old addresses into 301 redirects.

| File | What it is |
|---|---|
| `old_urls.tsv` | THE TABLE. Every old address that 404'd, its status, its target, and how the target was found. |
| `gen_redirects.pl` | Writes the `# BEGIN REDIRECTS` block of `/.htaccess` from the table. Self-tests before writing. |
| `verify_redirects.ps1` | Run after the deploy. Proves each redirect at the origin and through Cloudflare. Read-only. |
| `map_old_urls.pl` | Built the table (Cloudflare list + WooCommerce extract + the store's public JSON). Re-run for new 404s. |
| `extract_catalog.pl` | Pulls products, SKUs, categories and media out of the WordPress database dump. No order or customer data. |

## Status column

- `REDIRECT` - sourced: same SKU, same handle or title on the store, a listing's recorded old address, the model named in a price-sheet file name. Goes into `.htaccess`.
- `DECIDE` - needs Stephen. `target` is only a suggestion. Not in `.htaccess`.
- `APPROVED` - Stephen said yes to a DECIDE row. Goes into `.htaccess`.
- `KEEP-404` - deliberately no redirect (Stephen's 2026-08-25 ruling for /cart/ /checkout/ /account/ /feed/ /comments/feed/ /category/equipment/; spam PDFs; bot probes).
- `LIVE` - answered 200 at the audit. `OTHER-HOST` - not this site.

## To approve a row, or add one

1. Edit `old_urls.tsv`: set `status` to `APPROVED` and put the target in `target` (a `/path` on this site or a full `https://` address).
2. `perl _build/redirects/gen_redirects.pl` (it refuses to write if any rule would catch the wrong address).
3. Commit. After Stephen or Tyler pushes and the deploy finishes, run `verify_redirects.ps1`.

## The one thing to know about `.htaccess` here

Until 2026-10-29 the root `.htaccess` had never reached the server: `.cpanel.yml` copied the site with
`cp -R *`, and `*` skips dot-files at the top level. The old notes saying "this host ignores .htaccess"
were about a file that was not there. The host does read `.htaccess` (the deployed
`forms/_submissions/.htaccess` turns a real file into a 403). `.cpanel.yml` now copies it by name.

**If the site ever answers 500 everywhere right after a deploy:** delete `public_html/.htaccess` in cPanel
File Manager. A git revert alone does not remove it, because the deploy only adds and overwrites files.
