# Fast fix: show ITC landing on homepage

`front-page.html` is already on the server. WordPress is using an **empty** template from the database instead. Do one of these:

---

## Fastest (one action in WP admin)

1. **Log in:** https://inthecircle.co/wp-admin/ (or your [custom login URL](docs/HIDE-WP-ADMIN-LOGIN.md) if you’ve hidden wp-admin)
2. **Open Site Editor:** **Appearance → Editor**
3. **Templates** (left) → click **Front Page**
4. **Top-right:** click the **⋮** (three dots) → **Clear customizations** (or **Revert**)
5. **Save** if asked.

The DB override is removed; the site will use `themes/extendable/templates/front-page.html`. Hard refresh the homepage.

---

## Or: run fix script (then delete it)

**Upload + run once (same browser where you’re logged in):**

```bash
cd wordpress-seo && bash scripts/fix-itc-landing.sh
```

Then open (while logged in to WP):

**https://inthecircle.co/itc-fix-template.php?token=itc2026fix**

That deletes the custom Front Page template from the DB. After you see “Done”, remove the file from the server (File Manager or FTP: `public_html/itc-fix-template.php`).
