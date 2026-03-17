# Blog & single post UI – how to turn it on

The theme you see on **inthecircle.co** is the default one because the **custom blog/single-post CSS is not active** on the live server yet. You can fix it in either of these ways.

---

## Option A: Paste CSS in WPCode (fastest)

You already use **WPCode** (it’s in your admin bar).

1. In WordPress admin go to **WPCode → Code Snippets** (or **Add Snippet**).
2. Click **Add Snippet** → **Add Your Custom Code**.
3. **Code type:** CSS.
4. **Paste** the full contents of **`blog-single-ui.css`** (in this folder).
5. **Display:** “Run everywhere” (the CSS only affects pages where WordPress adds `body.home` or `body.single`, so blog and posts only).
6. **Activate** the snippet.

Result: blog index gets cards, spacing, and typography; single posts get readable width and typography.

---

## Option B: Use the SEO plugin (same CSS, no WPCode)

The same styles are inside **`inthecircle-seo-enhancements.php`** (v1.9.0). They run only on the blog index and single posts.

1. Upload the **updated** `inthecircle-seo-enhancements.php` from this repo to your live site:
   - Path: `wp-content/plugins/inthecircle-seo-enhancements/inthecircle-seo-enhancements.php`  
   (or wherever that plugin lives)
2. Overwrite the existing file.

No need to paste anything in WPCode if you use this.

---

## Why it looked like “zero UI”

- The **blog/single CSS** exists only in your **repo** (this folder).
- The **live site** is still using an **older plugin** (or a theme with no blog styling).
- So the server never sent the new styles. As soon as the CSS is active (Option A or B), the blog and posts will use the new layout and typography.
