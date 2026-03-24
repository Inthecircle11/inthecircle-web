# Indexing Checklist – Do This From Your End

Use this checklist so Google and Bing index **inthecircle.co** (WordPress). **Current focus:** the marketing site only; app indexing is optional.

---

## 1. WordPress (inthecircle.co) – Publish the 12 blog posts

**Option A: Publish from this repo (automated)**

1. In WordPress: **Users → Your user → Application Passwords** → create a new application password, copy it (shown once).
2. Either:
   - **Local:** In **wordpress-seo**, copy `.env.example` to `.env` and set `WORDPRESS_URL`, `WORDPRESS_USER`, `WORDPRESS_APP_PASSWORD`. Do not commit `.env`. From the repo root: `npm run wp:publish`.
   - **GitHub:** In the repo **Settings → Secrets and variables → Actions**, add `WORDPRESS_URL`, `WORDPRESS_USER`, `WORDPRESS_APP_PASSWORD`. Then **Actions → Publish WordPress posts → Run workflow** (workflow: `.github/workflows/publish-wordpress-posts.yml`).
3. Confirm SEO meta per post in **All in One SEO** (or your SEO plugin) if anything looks off.

**Option B: One-click import (no credentials in repo)**

1. From **wordpress-seo**: `node scripts/generate-wxr.js`, then in WordPress **Tools → Import → WordPress** upload **`inthecircle-blog-import.xml`**. Assign author, then set SEO per post. Regenerate WXR after editing any `blog-posts/*.md`.

**Option C: Manual**

- Create posts and paste content from each `blog-posts/0X-....md` (see [blog-posts/README.md](blog-posts/README.md)).

---

## 1b. Ping search engines (run from repo)

After posts are live and your WordPress sitemap includes them, from **wordpress-seo**:

```bash
node scripts/ping-sitemaps.js
```

**Google prefers** sitemap submission in Search Console (step 3); the ping still helps some crawlers discover updates.

---

## 2. WordPress Sitemap – Include Posts

- **Yoast SEO:** SEO → General → Features → XML sitemaps = ON. Sitemap URL: `https://inthecircle.co/sitemap_index.xml`
- **Rank Math:** Sitemap Settings → enable Sitemaps. Usually: `https://inthecircle.co/sitemap_index.xml` or `/sitemap.xml`
- **All in One SEO:** Sitemaps → enable. Check that **Posts** are included.

Ensure your sitemap URL includes **posts** (not only pages). Note the exact URL for step 4.

---

## 3. Google Search Console – inthecircle.co

1. Go to [Google Search Console](https://search.google.com/search-console).
2. Use the **Domain** or **URL-prefix** property for `https://inthecircle.co`.
3. **Sitemaps** → add what your SEO plugin exposes, typically:
   - `sitemap_index.xml`
   - or `sitemap.xml` / `post-sitemap.xml` if that lists posts
4. Submit.

**After publishing new posts (especially pillar hubs):** **URL Inspection** → paste each important URL → **Request indexing**. Example pillar slugs:

- `creator-networking-collaboration-hub`
- `how-creators-work-together-playbook`
- `mena-gcc-creators-hub`

---

## 4. Google Search Console – app.inthecircle.co (optional)

Skip this if you are **WordPress-only** for SEO work. Otherwise:

1. Add property: `https://app.inthecircle.co`.
2. Verify.
3. **Sitemaps** → `https://app.inthecircle.co/sitemap.xml`.

---

## 5. Bing Webmaster Tools (optional)

1. [Bing Webmaster Tools](https://www.bing.com/webmasters).
2. Add `https://inthecircle.co` and verify.
3. Submit the same WordPress sitemap URL as in Google (e.g. `https://inthecircle.co/sitemap_index.xml`).

---

## 6. Regenerate WXR After Editing Blog Content

If you change any `blog-posts/*.md` file:

```bash
cd wordpress-seo
node scripts/generate-wxr.js
```

Then re-import in WordPress or update posts manually. After publishing, request indexing for changed URLs in GSC (step 3).

---

## Summary – What’s Done in the Repo vs What You Do

| Done in repo | You do |
|--------------|--------|
| WordPress SEO plugin + publish script + **12** Markdown posts | Create `wordpress-seo/.env` → `npm run wp:publish` (or import WXR / paste manually) |
| `npm run wp:check-posts` (verify files), `npm run wp:upload-plugin` (FTP PHP) | Keep plugin active; purge cache after plugin upload |
| Next.js sitemap + robots (app) | Optional: app GSC property if you care about app URLs |
| This checklist | Sitemap includes posts, GSC submit, URL inspection for new URLs |

Nothing gets indexed until posts are **published** on the live site and crawlers discover them via **sitemap** and/or **URL inspection**.
