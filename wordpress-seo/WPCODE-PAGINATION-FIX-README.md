# Fix: Pagination at bottom of blog (1 2 3 4, Next Page)

You already have **WPCode** on the site. Use it so the fix runs without enabling the full SEO plugin or editing the template.

## Steps (do this once)

1. In WordPress admin go to **WPCode → Code Snippets → Add Snippet**.
2. Choose **Add Your Custom Code**.
3. **Title:** e.g. `Blog pagination at bottom`.
4. **Code Type:** PHP Snippet.
5. **Paste the full content** of `WPCODE-SNIPPET-PAGINATION-AT-BOTTOM.php` (from `<?php` to the closing `}, 20);`).
6. **Location:** set to **“Only run on specific pages”** → **“Include”** → add your blog URL (e.g. `https://inthecircle.co/blog/`) or choose “Posts page” if your blog is the posts page.
7. Click **Activate**.

Reload the blog page; the pagination should appear below the posts.
