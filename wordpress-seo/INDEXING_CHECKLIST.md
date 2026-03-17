# Indexing Checklist – Do This From Your End

Everything that could be done in the repo is done. Use this checklist so Google and Bing index your sites and blog posts.

---

## 1. WordPress (inthecircle.co) – Publish the 9 Blog Posts

**Option A: Publish from this repo (automated)**

1. In WordPress: **Users → Your user → Application Passwords** → create a new application password, copy it (shown once).
2. In **wordpress-seo**, copy `.env.example` to `.env` and set `WORDPRESS_URL`, `WORDPRESS_USER`, `WORDPRESS_APP_PASSWORD`.
3. Run: `node scripts/publish-posts-to-wordpress.js` — all 9 posts are created or updated. Then set SEO meta per post in Yoast/Rank Math.

**Option B: One-click import (no credentials in repo)**

1. Run `node scripts/generate-wxr.js`, then in WordPress **Tools → Import → WordPress** upload **`inthecircle-blog-import.xml`**. Assign author, then set SEO per post.

**Option C: Manual**

- Create 9 posts and paste content from each `blog-posts/0X-....md` (see `blog-posts/README.md`).

---

## 1b. Ping search engines (run from repo)

After posts are live and your WordPress sitemap includes them, run (from **wordpress-seo**):

```bash
node scripts/ping-sitemaps.js
```

This notifies Bing (and optionally Google) of your sitemap URLs. **Google prefers sitemap submission in Search Console** (step 3); the ping still helps some crawlers discover updates.

---

## 2. WordPress Sitemap – Include Posts

- **Yoast SEO:** SEO → General → Features → XML sitemaps = ON. Sitemap URL: `https://inthecircle.co/sitemap_index.xml`
- **Rank Math:** Sitemap Settings → enable Sitemaps. Usually: `https://inthecircle.co/sitemap_index.xml` or `/sitemap.xml`
- **All in One SEO:** Sitemaps → enable. Check that **Posts** are included.

Ensure your sitemap URL includes **posts** (not only pages). Note the exact URL for step 4.

---

## 3. Google Search Console – inthecircle.co

1. Go to [Google Search Console](https://search.google.com/search-console).
2. **Add property** (if needed): URL prefix `https://inthecircle.co`.
3. **Verify** (HTML file, DNS, or meta tag – use what your host supports).
4. Open **Sitemaps** in the left menu.
5. Under “Add a new sitemap” enter one of (use what your WordPress SEO plugin uses):
   - `sitemap_index.xml`
   - `sitemap.xml`
   - `post-sitemap.xml` (if that’s the one that lists posts)
6. Click **Submit**.

Optional after publishing new posts: **URL Inspection** → paste a new post URL → **Request indexing** for a few key posts.

---

## 4. Google Search Console – app.inthecircle.co

1. In Search Console, **Add property**: `https://app.inthecircle.co`.
2. Verify (e.g. DNS or HTML file; Vercel supports both).
3. **Sitemaps** → Add: `sitemap.xml` (full URL: `https://app.inthecircle.co/sitemap.xml`).
4. Submit.

---

## 5. Bing Webmaster Tools (optional)

1. Go to [Bing Webmaster Tools](https://www.bing.com/webmasters).
2. Add site: `https://inthecircle.co` (and optionally `https://app.inthecircle.co`).
3. Verify (Bing gives you meta tag or XML file options).
4. **Sitemaps** → Submit the same sitemap URL you used in Google (e.g. `https://inthecircle.co/sitemap_index.xml`, `https://app.inthecircle.co/sitemap.xml`).

---

## 6. Regenerate WXR After Editing Blog Content

If you change any `blog-posts/*.md` file, regenerate the import file:

```bash
cd Inthecircle/wordpress-seo
node scripts/generate-wxr.js
```

Then re-import in WordPress (or update the existing posts manually). After publishing new/changed content, request indexing for a few URLs in GSC (step 3).

---

## Summary – What’s Done in the Repo vs What You Do

| Done in repo | You do |
|--------------|--------|
| Next.js sitemap + robots (app.inthecircle.co) | Deploy app; add GSC property and submit sitemap |
| WordPress SEO plugin (meta, schema, keywords) | Keep plugin active on inthecircle.co |
| 9 blog posts as .md + WXR import file | Import WXR in WordPress (or paste manually); set SEO fields |
| This checklist | Follow steps 2–5 (sitemap, GSC, Bing) |

Nothing gets indexed until the posts are **published** on the live site and the **sitemaps are submitted** in Search Console (and Bing if you use it).
