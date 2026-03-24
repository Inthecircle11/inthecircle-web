# InTheCircle SEO Enhancements – WordPress Plugin

Implements all recommended SEO changes for [inthecircle.co](https://inthecircle.co), aligned with the Next.js app (app.inthecircle.co) for consistent ranking on creator- and app-related searches.

**If your WordPress is on a different URL** (e.g. another domain or staging), set **`WORDPRESS_URL`** in `wordpress-seo/.env` and **`WP_SFTP_HOST`** / **`WP_SFTP_REMOTE_PATH`** in `wordpress-seo/.env.sftp` to that site. Docs that mention inthecircle.co then apply to your actual site.

**Repo-root WordPress REST scripts** (run from the project root, e.g. `node scripts/audit-seo-scores.js`) can use **`scripts/.env.wp`** (do not commit) with `WP_SITE_URL`, `WP_USERNAME`, and `WP_APP_PASSWORD`, or the same values as `WORDPRESS_URL` / `WORDPRESS_USER` / `WORDPRESS_APP_PASSWORD`. Many scripts under `wordpress-seo/scripts/` try this file after `wordpress-seo/.env`. See [docs/plans/seo-ranking-roadmap.md](../docs/plans/seo-ranking-roadmap.md) Appendix A for the audit command.

## What This Plugin Does

- **Meta tags:** Per-page title (50–60 chars) and description (150–160 chars)
- **Keywords meta:** Target keywords for ranking (inthecircle, creator networking app, networking app for creators, etc.)
- **Open Graph:** Facebook, LinkedIn sharing
- **Twitter Cards:** Twitter sharing
- **Canonical URLs:** Per-page canonicals
- **Schema.org JSON-LD:** Organization, WebSite, SoftwareApplication, WebApplication (site-wide); App Store URL in schema
- **FAQ Schema:** On FAQ page for rich results in Google
- **Internal links:** "Learn more about our mission" and "See our FAQ" on homepage
- **Image alt text:** Auto-adds alt text to logo/header images
- **Security headers:** X-Content-Type-Options, X-Frame-Options, Referrer-Policy, HSTS
- **Custom 404:** Branded "Page Not Found" with Back to Home / See FAQ links
- **Title override:** Stronger `document_title_parts` filter (priority 999) to beat theme/other plugins
- **All in One SEO override:** `aioseo_title`, `aioseo_description`, `aioseo_facebook_tags`, `aioseo_twitter_tags` – our values override AIOSEO
- **App Store URL (page builders):** JS fallback replaces placeholder in all links, including page builder blocks
- **GA4 conversion events:** Fires `sign_up` and `download_app` on click (mark as conversion in GA4)
- ~~Sticky header CTA~~ (removed): Bar that appeared on scroll is no longer used

## Blog Posts for Keyword Ranking

The **blog-posts** folder contains **9 SEO articles plus 3 pillar hubs** (networking/collaboration hub, collaboration playbook, MENA/GCC hub) you can add to inthecircle.co as WordPress Posts. They target: creator networking app, connect with creators, YouTuber network, streamer community, find collaborators, creator community, GCC/Egypt/Jordan/Lebanon, waitlist, pillar clusters, and related terms.

- **Publish from repo:** Copy `.env.example` → `.env`, set `WORDPRESS_URL`, `WORDPRESS_USER`, `WORDPRESS_APP_PASSWORD`, then from the **project root** run `npm run wp:publish` (or `node wordpress-seo/scripts/publish-posts-to-wordpress.js`) to create/update all **12** posts via the WordPress REST API.
- **From project root (npm):** `npm run wp:check-posts` (verify Markdown files), `npm run wp:upload-plugin` (FTP plugin file), `npm run wp:audit-seo` (needs `scripts/.env.wp` or credentials).
- **Or one-click import:** Run `node scripts/generate-wxr.js` to generate **inthecircle-blog-import.xml**, then in WordPress go to **Tools → Import → WordPress** and upload that file.
- **Notify search engines:** After publishing, run `node scripts/ping-sitemaps.js` to ping sitemap URLs. Then submit sitemaps in Google Search Console and (optional) Bing — see **INDEXING_CHECKLIST.md**.

## Installation

### Option 1: Upload as ZIP

1. Zip the `inthecircle-seo` folder (the folder containing `inthecircle-seo-enhancements.php` and `README.md`)
2. WordPress → Plugins → Add New → Upload Plugin → Choose the zip
3. Activate **InTheCircle SEO Enhancements**

### Option 2: FTP / File Manager

1. Upload the `wordpress-seo` folder to `wp-content/plugins/`
2. Rename it to `inthecircle-seo` (or keep as `wordpress-seo`)
3. WordPress → Plugins → Activate **InTheCircle SEO Enhancements**

### Updating the plugin file (so changes reflect on the live site)

Code changes (e.g. removing the sticky bar) are only in your repo until you upload the file to the server.

**Option A – cPanel File Manager (easiest)**  
1. Log in to cPanel → File Manager.  
2. Go to `public_html/wp-content/plugins/` and open the folder that contains the SEO plugin (e.g. `inthecircle-seo` or `wordpress-seo`).  
3. Find `inthecircle-seo-enhancements.php` and delete or rename the old one (backup).  
4. Upload the **local** file from your repo:  
   `wordpress-seo/inthecircle-seo-enhancements.php`  
   into that same plugin folder (overwrite if you didn’t rename).  
5. Purge LiteSpeed/cache and hard refresh the site.

**Option B – Script (if FTP path works)**  
From the project root:  
`cd wordpress-seo && node scripts/upload-seo-plugin.mjs`  
If your plugin folder is not `inthecircle-seo`, add to `.env.sftp`:  
`WP_PLUGIN_FOLDER=wordpress-seo`  
Or set the full path:  
`WP_PLUGIN_REMOTE_PATH=public_html/wp-content/plugins/your-plugin-folder`

## Page Slugs

The plugin maps these slugs to optimized titles/descriptions:

| Slug           | Title / Description |
|----------------|--------------------|
| (home)         | inthecircle – #1 Networking App for Creators \| Connect & Collaborate |
| about          | About InTheCircle – Creator Networking Platform |
| faq            | FAQ – InTheCircle Help Center |
| privacy-policy | Privacy Policy – InTheCircle |
| terms          | Terms of Service – InTheCircle |

If your page slugs differ, edit `itc_seo_get_page_data()` in the plugin file.

## Configuration

### App Store ID (no code editing)

1. Go to **Settings → InTheCircle SEO**
2. Enter your App Store ID (e.g. `6738291`)
3. Click Save

The plugin will replace the placeholder URL in all content. Leave as `123456789` until the app is published.

### OG Image (optional)

For best social sharing, use a 1200×630px image. Upload to Media Library and update `ITC_SEO_OG_IMAGE` in the plugin file if needed.

## Compatibility

- Works alongside Yoast SEO or Rank Math (this plugin runs first; you can disable their meta output if desired)
- No database changes
- Lightweight, no admin UI
