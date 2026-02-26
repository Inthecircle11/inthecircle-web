# Admin Panel – How It Works & How to Prevent 404s

## URLs

| URL | Purpose |
|-----|--------|
| **/admin** | Main admin entry when `ADMIN_BASE_PATH` is not set. Gate → inline login → dashboard. |
| **/{ADMIN_BASE_PATH}** | When `ADMIN_BASE_PATH` is set, this is the only URL that serves the panel; `/admin` returns 404. |
| **/admin/login** | Redirects to admin base. Kept so old links and bookmarks still work. |

## Why the 404 Happened

The admin login page at `/admin/login` returned 404 in production because:

- The live deployment was from a build that didn’t include that route, or
- An older deployment was still being served.

So the app code had the route, but production didn’t.

## How We Prevent It Now

1. **Single entry point**  
   All admin access goes through **/admin**. When you’re not signed in, the login form is shown on the same page (inline). You never *need* `/admin/login` to sign in.

2. **Redirect**  
   `/admin/login` just redirects to `/admin`. If that route ever 404s again, users can still open **/admin** and sign in there.

3. **Deploy after admin changes**  
   After any change under `src/app/admin/`, run a production deploy so Vercel serves the latest admin routes:

   ```bash
   vercel deploy --prod
   ```

4. **Don’t remove admin routes**  
   Keep `src/app/admin/page.tsx` and the inline login block. Don’t remove or exclude `/admin` or `/admin/login` in proxy or config. See `.cursor/rules/admin-panel.mdc` for the rule.

## Optional: Verify After Deploy

To confirm admin is reachable after a deploy:

```bash
curl -sI https://app.inthecircle.co/admin | head -1
# Expect: HTTP/2 200 (or 200)
```

## Env (Vercel)

Admin access is allowed only when the signed-in user is in:

- **ADMIN_EMAILS** (comma-separated emails), or  
- **ADMIN_USER_IDS** (comma-separated Supabase user UUIDs).

Set these in Vercel → Project → Settings → Environment Variables, then redeploy.

### Production admin URL (obscure path)

For the admin panel to load at **https://app.inthecircle.co/K7x2mN9pQ4rT1vW6yB0cD3eF8gH2jL5n**, set in Vercel:

- **ADMIN_BASE_PATH** = `K7x2mN9pQ4rT1vW6yB0cD3eF8gH2jL5n` (no leading slash)

Then **redeploy**. After that:

- `https://app.inthecircle.co/K7x2mN9pQ4rT1vW6yB0cD3eF8gH2jL5n` → serves the admin panel  
- `https://app.inthecircle.co/admin` → 404 (by design)

---

## Making It Harder for Hackers to Find Admin

1. **Obscure URL (recommended)**  
   Set **ADMIN_BASE_PATH** in Vercel to a **long** random string (e.g. 24–32 characters). Then:
   - Only `https://yourapp.com/YOUR_LONG_SECRET` serves the admin panel.
   - Direct requests to `/admin` return **404**, so scanners and wordlists won’t find it.
   - Bookmark and share only the obscure URL; never commit it.

2. **Gate password**  
   Set **ADMIN_GATE_PASSWORD** so users must enter a shared secret before seeing the login form. Use with obscure path for two layers.

3. **robots.txt**  
   `public/robots.txt` disallows `/admin` so search engines don’t index the default path. The obscure path is not listed so it stays unguessable from this file.

4. **No public links**  
   The main app does not link to the admin panel. Only people who know the URL (or obscure path) can open it.

5. **IP allowlist (max security)**  
   Set **ADMIN_ALLOWED_IPS** to a comma-separated list of IPs (e.g. your office, home). Only those IPs can open the admin path; everyone else gets **403**. Use a static IP or VPN so you don’t lock yourself out.

---

## Maximum security (as close to “impossible” as practical)

Nothing is 100% un-hackable, but you can make it so hard that real-world attacks are not worth it. Use **all** of these together:

| Layer | What to do |
|-------|------------|
| **1. Obscure URL** | Set **ADMIN_BASE_PATH** to a **long** random string (24–32 chars). Never share it publicly. |
| **2. Gate password** | Set **ADMIN_GATE_PASSWORD**. One more secret before the login form. |
| **3. IP allowlist** | Set **ADMIN_ALLOWED_IPS** to your office/home/VPN IPs. Only those IPs can even reach the admin page. |
| **4. Admin-only accounts** | Only put 1–2 trusted emails in **ADMIN_EMAILS**. No shared or weak accounts. |
| **5. Strong passwords** | Admins use long, unique passwords (e.g. 16+ chars, password manager). |
| **6. MFA for admins** | Turn on MFA (Supabase supports TOTP). Require it for every admin account. |
| **7. No NEXT_PUBLIC admin vars** | Remove **NEXT_PUBLIC_ADMIN_EMAILS** / **NEXT_PUBLIC_ADMIN_USER_IDS** so admin list isn’t in the client bundle. |
| **8. Treat URL as secret** | Bookmark the admin URL; don’t email it, don’t put it in docs that are shared. |

With 1–6 in place, an attacker would need to: guess the obscure path, be on an allowed IP, know the gate password, have valid admin credentials, and pass MFA. That’s effectively impractical for almost everyone.
