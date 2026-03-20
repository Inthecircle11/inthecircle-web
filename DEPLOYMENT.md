# Deployment – Inthecircle Web

## Prevent deployment failures

Recent Vercel failures were caused by: (1) type errors (e.g. prop passed but not in interface), (2) smart/curly quotes in source, (3) `package-lock.json` out of sync with `package.json`. To avoid this:

- **Run before pushing to `main`:** `npm run ci:local` (typecheck + build with placeholder env). Fix any errors before pushing.
- **Require CI before merge:** In GitHub, enable branch protection for `main` and require the **CI** status check to pass. See [docs/BRANCH_PROTECTION.md](docs/BRANCH_PROTECTION.md) and [docs/DEPLOYMENT_FAILURE_ROOT_CAUSES.md](docs/DEPLOYMENT_FAILURE_ROOT_CAUSES.md).
- **Lockfile:** After changing `package.json`, run `npm install` and commit the updated `package-lock.json`.

## Production URL

- **App:** https://app.inthecircle.co  
- **Admin (only):** https://app.inthecircle.co/admin  

There is **one admin panel** in this repo: `src/app/admin/page.tsx`. It is served at `/admin`.

## Rule: one domain, one project

**app.inthecircle.co must be attached only to one Vercel project** — production for this repo is **inthecircle-web-v2** (see `.vercel/project.json`). If another project has this domain, visitors see that deployment instead of this Next.js app.

## Vercel setup

1. **Domain:** Ensure the Vercel project that serves the app has the domain **app.inthecircle.co** (Vercel Dashboard → Project → Settings → Domains). No other project in the team should have this domain. The project can be **inthecircle-web** or **inthecircle web v2** (see below).
2. **Git:** Production Branch = **`main`**. Root Directory = empty (repo root is the app).
3. **Env (production):** Set `ADMIN_GATE_PASSWORD`, `ADMIN_USER_IDS`, and `ADMIN_EMAILS` in that project’s Environment Variables.

### Connecting “inthecircle web v2” to the web app

If your production project in Vercel is named **inthecircle web v2** (or **inthecircle-web-v2**):

1. **From Vercel Dashboard**
   - Open [Vercel](https://vercel.com) → your team → project **inthecircle web v2**.
   - **Settings → Domains:** Add **app.inthecircle.co** to this project.
   - Remove **app.inthecircle.co** from any other project (e.g. inthecircle, inthecircle-web): go to each project → Settings → Domains → remove the domain.
   - **Settings → Git:** Ensure this project is connected to the **inthecircle-web** repo and Production Branch is **main** (so pushes to `main` deploy here).

2. **From CLI (after `vercel login`)**
   - Use the project name exactly as Vercel shows it (often the slug is lowercase with hyphens, e.g. `inthecircle-web-v2`). Then run:
   ```bash
   export VERCEL_PROJECT_NAME=inthecircle-web-v2
   ./scripts/move-domain-to-inthecircle-web.sh
   ```
   - Verify: `VERCEL_PROJECT_NAME=inthecircle-web-v2 npm run verify-domain`
   - Deploy from this repo: `cd` into the repo linked to that project and run `vercel deploy --prod`, or push to **main** if Git is connected.

## Prevent domain mix-up

Run `npm run verify-domain` (uses token from `vercel login` or `VERCEL_TOKEN`). It checks that **app.inthecircle.co** is only on the expected project (default **inthecircle-web-v2**; override with `VERCEL_PROJECT_NAME` if needed). If another project has the domain, it exits with an error and tells you how to fix it.

### Legacy `vercel.json` rewrites (do not restore)

Do **not** add `rewrites` in `vercel.json` that map `/`, `/signup`, or `/admin` to root `*.html` files. Those rules override **Next.js App Router** and make production look like the old static “Coming Soon” / legacy signup HTML even when the domain is on the correct project.

### Multi-layer prevention (hardened)

**7 layers of protection** prevent routing regressions:

| Layer | When it runs | What it blocks |
|-------|--------------|----------------|
| **1. Pre-commit hook** | Before `git commit` | Blocks commit if `vercel.json` has forbidden rewrites. Changes stay in working directory. |
| **2. `check:vercel-routing` script** | `npm run ci:local`, CI, pre-commit | Validates `vercel.json` structure (no `*.html` rewrites, no legacy keys). |
| **3. Build-time check** | `next.config.ts` during `npm run build` | **Build FAILS** if `vercel.json` contains legacy rewrites. Cannot deploy broken config. |
| **4. CI check** | Every PR/push to `main` | Runs `check:vercel-routing` after typecheck (fails fast). |
| **5. Runtime health endpoint** | `GET /api/health/routing` | Returns 500 if routing config violates rules. Can be monitored/alerted. |
| **6. Production smoke test** | `npm run test:production-routing` | Validates production isn't serving static HTML (optional, requires `PRODUCTION_URL`). |
| **7. Cursor AI rule** | Always (`.cursor/rules/vercel-next-routing.mdc`) | Warns if you try to add static rewrites in editor. |

**Before pushing:** Run **`npm run ci:local`** (includes routing check + typecheck + build).

**Branch protection:** Keep **required status check “CI / build”** on `main` so regressions cannot merge without a green build. The build step itself will **fail** if `vercel.json` is bad (layer 3).

**Emergency bypass:** Only if absolutely necessary:
- Pre-commit: `git commit --no-verify` (bypasses hook)
- CI: Bypass branch protection (admin only)
- ⚠️ **Still blocked by build-time check** — `next.config.ts` validates at build time, so bad config cannot deploy even if CI is bypassed.

### Move domain without CLI (Dashboard only)

If `npx vercel login` fails (e.g. `vc: command not found`) or the script gets 403:

1. Go to [vercel.com](https://vercel.com) and sign in.
2. For **every project that is not inthecircle-web-v2** (e.g. inthecircle, inthecircle-web): **Settings → Domains** → remove **app.inthecircle.co** if listed.
3. Open project **inthecircle-web-v2** → **Settings → Domains** → add **app.inthecircle.co** if missing.
4. Open **https://app.inthecircle.co/admin** in an incognito window to confirm the new admin.

**Using a token instead of login:** Create a token at [vercel.com/account/tokens](https://vercel.com/account/tokens), then run (use straight quotes, no smart quotes):

```bash
cd "/Users/ahmedkhalifa/Documents/macbook pro m4 VIPP/Inthecircle/inthecircle-web"
VERCEL_TOKEN=your_token_here VERCEL_PROJECT_NAME=inthecircle-web-v2 ./scripts/move-domain-to-inthecircle-web.sh
```

Replace `your_token_here` with the token value.

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
