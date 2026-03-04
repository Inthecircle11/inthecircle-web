# Deployment – Inthecircle Web

## Production URL

- **App:** https://app.inthecircle.co  
- **Admin (only):** https://app.inthecircle.co/admin  

There is **one admin panel** in this repo: `src/app/admin/page.tsx`. It is served at `/admin`.

## Rule: one domain, one project

**app.inthecircle.co must be attached only to one Vercel project.** Production uses **inthecircle-web-v2**. If you see two projects (inthecircle-web and inthecircle-web-v2), use only **inthecircle-web-v2** and optionally delete the old **inthecircle-web** in Vercel (Dashboard → inthecircle-web → Settings → scroll down → Delete Project) to avoid confusion.

## Vercel setup

1. **Domain:** Ensure **inthecircle-web-v2** has the domain **app.inthecircle.co** (Vercel Dashboard → Project → Settings → Domains). No other project should have this domain.
2. **Git:** In **inthecircle-web-v2**, Settings → Git: connect the **Inthecircle11/inthecircle-web** repo; Production Branch = **`main`**. Root Directory = empty.
3. **Env (production):** In **inthecircle-web-v2**, set `ADMIN_EMAILS`, `ADMIN_GATE_PASSWORD` (optional), `ADMIN_BASE_PATH` (optional), and Supabase vars.

## Prevent domain mix-up

Run `VERCEL_PROJECT_NAME=inthecircle-web-v2 npm run verify-domain` (uses token from `vercel login` or `VERCEL_TOKEN`). It checks that **app.inthecircle.co** is only on **inthecircle-web-v2**.

## All from CLI (no dashboard)

Use the Vercel CLI for login; scripts use that token so you don’t need to set `VERCEL_TOKEN` manually.

**Run each command separately** (do not paste all at once).

**Step 1 — One-time login** (opens browser; wait until it finishes):
```bash
vercel login
```
Visit the URL it prints, enter the code, then press Enter in the terminal.

**Step 2 — Check domain** (optional):
```bash
npm run verify-domain
```

**Step 3 — Deploy:** Production deploys via Git (push to `main`). For preview only: `npm run preview`. For emergency: `vercel deploy --prod`.

## Fix production (wrong admin showing)

**One-time fix (recommended):** Run this once from the inthecircle-web repo. It removes **app.inthecircle.co** from every other Vercel project, assigns it only to the target project (default **inthecircle-web**; set `VERCEL_PROJECT_NAME=inthecircle-web-v2` for v2), then deploys.

```bash
vercel login
```
Then (after you’re signed in):
```bash
npm run one-time-fix
```

If you prefer to fix manually or only redeploy: run `npm run verify-domain`, then push to `main` (or `vercel deploy --prod` in an emergency).

This ensures the domain is only on inthecircle-web and deploys the correct code to production. After deploy, open app.inthecircle.co in an **incognito** window and hard refresh.

### "I can't access our app / admin anymore" or "There's duplication"

1. **Only one project should own the domain**
   - In Vercel, only the **inthecircle-web** project should have **app.inthecircle.co**.
   - If you had another project (e.g. "inthecircle") using the same domain, remove **app.inthecircle.co** from that project: Vercel Dashboard → that project → Settings → Domains → remove app.inthecircle.co.
   - Then push to `main` to redeploy (or run `vercel deploy --prod` in an emergency).

2. **Admin panel returns 404**
   - If **ADMIN_BASE_PATH** is set, you can use either the secret URL or **/admin**; direct **/admin** is allowed by default. To hide **/admin** again, set **ADMIN_DISABLE_DIRECT_ACCESS=true** in Vercel.
   - **Wrong URL (404):** Using a **slash** in the path (e.g. `.../K7x2mN9pQ4/T1vW6yB0cD3eF8gH2jL5n`) often causes 404. Use the **exact** path with **no slash** and with the letter **r** (e.g. `.../K7x2mN9pQ4rT1vW6yB0cD3eF8gH2jL5n`). The app now redirects the common “slash instead of r” typo to the correct URL.
   - **To use /admin again:** In Vercel → inthecircle-web → Settings → Environment Variables, **delete** `ADMIN_BASE_PATH` (or leave it empty), then redeploy. After that, https://app.inthecircle.co/admin will work again.
   - Optional: set **ADMIN_ALLOW_DIRECT_ACCESS=true** in Vercel (legacy; direct /admin is now allowed by default when ADMIN_BASE_PATH is set).

3. **Seeing a different admin panel (e.g. "Connect project" / Supabase URL screen instead of the real one)**
   - The **real** admin (inthecircle-web) shows: gate password (if set) → **"Inthecircle Admin"** sign-in (email + password) → full panel (Dashboard, Applications, Users, etc.). It never asks for "Supabase project URL" or "anon key".
   - If you see a "Connect project" or "Enter your Supabase project URL and anon key" screen, the domain **app.inthecircle.co** is currently pointing at a **different Vercel project** (e.g. another app named "inthecircle"). That project serves a different admin UI.
   - **Fix:** In Vercel Dashboard, remove **app.inthecircle.co** from every project except **inthecircle-web-v2**. Then add **app.inthecircle.co** to **inthecircle-web-v2** if it’s missing. Redeploy by pushing to **`main`** Then https://app.inthecircle.co/admin and the obscure URL will serve the correct admin panel.

## DNS (Cloudflare) and auth — is it safe?

**Yes.** Changing only how **app.inthecircle.co** resolves (e.g. A record to `76.76.21.21` or CNAME to Vercel) is safe. It does **not**:

- **Reset or affect passwords** — Passwords are stored in Supabase; DNS does not touch them.
- **Break reset password** — The app uses `window.location.origin` for the reset link, so users are sent back to `https://app.inthecircle.co/auth/callback?next=/update-password`. The domain name stays the same; only the server it points to is set (to Vercel).
- **Invalidate sessions or log anyone out** — Sessions are in cookies and Supabase; DNS changes do not clear them.
- **Change redirect URLs** — Auth callback uses the request `origin` (the domain the user is on). As long as the domain is still app.inthecircle.co and points to this app, email confirmation and password-reset links work.

Keep **app** in Cloudflare as **DNS only** (grey cloud) and point it to Vercel (A `76.76.21.21` or CNAME as Vercel shows). Do not proxy **app** through Cloudflare (orange cloud) to avoid caching/auth quirks. Root and **www** can stay proxied if they serve a different site.
