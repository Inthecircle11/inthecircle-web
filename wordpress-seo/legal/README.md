# Legal pages for WordPress (inthecircle.co)

Use this content for the **Privacy Policy** and **Terms of Service** pages on your live WordPress site so they match the app and satisfy **App Store Guideline 3.1.2(c)**.

## Required URLs

- **Privacy Policy:** https://inthecircle.co/privacy-policy/
- **Terms of Service (EULA):** https://inthecircle.co/terms/

The plugin **InTheCircle SEO Enhancements** already sets SEO title/description for these slugs. You only need to add the page content in WordPress.

## How to add or update the pages in WordPress

1. Log in to WordPress at inthecircle.co/wp-admin (or your custom login URL if you’ve hidden wp-admin; see [HIDE-WP-ADMIN-LOGIN.md](../docs/HIDE-WP-ADMIN-LOGIN.md)).
2. Go to **Pages** and find (or create):
   - A page with slug **privacy-policy** (URL will be /privacy-policy/).
   - A page with slug **terms** (URL will be /terms/).
3. For each page:
   - Open the corresponding file below (`privacy-policy-content.html` or `terms-content.html`).
   - Copy **all** the content (from the first `<p>` to the last `</p>`).
   - In the WordPress editor, add a **Custom HTML** block (Block → Widgets → Custom HTML) and paste the content.
   - Or use the **Classic** block and paste; WordPress will preserve the headings and lists.
4. Publish or Update the page.
5. Open the live URL in a browser to confirm it loads (required for App Store review).

## Files

| File | WordPress page slug | Live URL |
|------|--------------------|----------|
| `privacy-policy-content.html` | privacy-policy | https://inthecircle.co/privacy-policy/ |
| `terms-content.html` | terms | https://inthecircle.co/terms/ |
| `delete-account-content.html` | delete-account | https://inthecircle.co/delete-account/ (optional; see below) |

Content is aligned with the text shown in the Inthecircle iOS app (Settings → Terms of Service / Privacy Policy) and with the paywall legal links.

### Delete account URL (Google Play)

Google Play requires a URL that explains how users can request account and data deletion. You have two options:

- **Option A (recommended):** Use the Next.js app page: **https://app.inthecircle.co/delete-account** — deploy inthecircle-web and this URL will work.
- **Option B:** Create a WordPress page with slug `delete-account` and paste the content from `delete-account-content.html`; then use **https://inthecircle.co/delete-account/** in Play Console.
