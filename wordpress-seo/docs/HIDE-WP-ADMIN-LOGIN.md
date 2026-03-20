# Hide WordPress Admin / Login URL

Use this on **your actual WordPress site** (the one you log into). This repo’s examples use **inthecircle.co** — if your WordPress is on a different URL (e.g. another domain or staging), replace it with your site’s URL everywhere below.

The default login at **https://yoursite.com/wp-admin/** is easy for bots and attackers to find. Moving it to a custom, unguessable URL reduces automated attacks and brute-force attempts.

---

## Recommended: WPS Hide Login (plugin)

**WPS Hide Login** changes `wp-login.php` to a URL you choose and returns **404** for the default `/wp-admin/` and `/wp-login.php` when the user is not logged in.

### Steps

1. **Install the plugin**
   - In WordPress: **Plugins → Add New** → search for **“WPS Hide Login”** (by WPServeur) → Install → Activate.
   - Or upload the plugin ZIP to `wp-content/plugins/` and activate.

2. **Set your new login URL**
   - Go to **Settings → WPS Hide Login**.
   - Set **Login URL** to something unique and hard to guess, e.g.:
     - `itc-manage`
     - `itc-secure-login`
     - Or a random slug like `x7k2-login` (avoid common words like `admin`, `login`, `dashboard`).
   - Save. Your login will be: **https://yoursite.com/&lt;your-slug&gt;/** (use your real WordPress URL).

3. **Bookmark the new URL**
   - You (and your team) must use the new URL to log in. The old `/wp-admin/` and `/wp-login.php` will return 404 for visitors.

4. **Optional: restrict by IP**
   - Use your host’s firewall or a security plugin to allow the new path only from your office/VPN IP if you want extra protection.

### Important

- **Do not lose the new URL.** If you forget it, you can rename the plugin folder via FTP/File Manager to disable it, then log in at `/wp-login.php` again, fix the setting, and re-enable the plugin.
- After changing the URL, update any bookmarks, scripts, or docs (e.g. `FAST-FIX.md`) so they use the new login URL (or say “use your custom login URL”).

---

## Alternative: Manual .htaccess (Apache)

If you cannot use a plugin and your host uses **Apache**, you can:

1. **Choose a secret path** (e.g. `itc-secure-entry`).
2. **In the site root** (where `wp-login.php` lives), edit or create `.htaccess` and add **before** other WordPress rules:

```apache
# Redirect custom login path to wp-login.php
RewriteEngine On
RewriteBase /
RewriteRule ^itc-secure-entry/?$ wp-login.php [L,QSA]

# Optional: block direct access to wp-login.php for non-logged-in users (advanced)
# This is trickier; the plugin approach is simpler.
```

3. **Log in at** `https://yoursite.com/itc-secure-entry/` (use your real WordPress URL).
4. **Hide wp-login.php** completely (return 404 unless coming from your secret path) only with extra rules or a plugin; otherwise bots can still hit `wp-login.php`. So the **plugin method is still recommended**.

---

## After you change the URL

- Update **FAST-FIX.md** and any internal docs: use the new URL or a note like “WordPress admin (custom URL)”.
- If you use **Application Passwords** or scripts (e.g. `publish-posts-to-wordpress.js`) that only call the REST API, they are unaffected; only the **browser login** URL changes.
