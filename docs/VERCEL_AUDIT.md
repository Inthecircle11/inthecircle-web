# Vercel full audit — inthecircle-web

**Production project:** inthecircle-web-v2  
**Production URL:** https://app.inthecircle.co  
**Audit date:** 2026-03-03

---

## 1. Executive summary

| Area | Status | Notes |
|------|--------|--------|
| **Project** | ✅ Single production project | **inthecircle-web-v2** is the only project used for production. Old **inthecircle-web** can be deleted in Vercel to avoid confusion. |
| **Domain** | ✅ | **app.inthecircle.co** is attached only to **inthecircle-web-v2**. Verified via `npm run verify-domain`. |
| **Environment variables** | ⚠️ Partial | Required Supabase + admin vars are set. Optional vars (see below) may be missing. |
| **Git** | ⚠️ Verify in Dashboard | Repo should be connected to **inthecircle-web-v2** with Production Branch = **main**. |
| **Build** | ✅ | Build succeeds with placeholder env in CI; production build no longer fails when ADMIN_BASE_PATH is unset. |
| **CI/CD** | ✅ | GitHub Actions: lint, typecheck, tests, build, domain verify (with VERCEL_PROJECT_NAME=inthecircle-web-v2). |

---

## 2. Current state (from CLI)

**Logged-in user:** `inthecircle11`  
**Linked project (local):** inthecircle-web-v2  
**Project ID:** `prj_4QLL4jhDvDIoo5ABVa94FX5omYBs`  
**Org ID:** `team_pPf6WSH38ILGLhFASbKqYYgL`

**Environment variables on inthecircle-web-v2 (names only):**

| Variable | Environments | Notes |
|----------|---------------|--------|
| ADMIN_EMAILS | Production | ✅ Required for admin access |
| ADMIN_BASE_PATH | Production | ✅ Optional; obscure admin URL |
| NEXT_PUBLIC_SUPABASE_URL | Production, Preview | ✅ Required |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Production, Preview | ✅ Required |
| SUPABASE_SERVICE_ROLE_KEY | Production, Preview | ✅ Required for admin APIs |

**Domain check:** `app.inthecircle.co` is only on **inthecircle-web-v2**. ✅

---

## 3. Environment variables — full reference

Variables the **codebase** reads (from codebase grep). Set in Vercel → inthecircle-web-v2 → Settings → Environment Variables.

### Required for production

| Variable | Used in | Purpose |
|----------|--------|---------|
| **NEXT_PUBLIC_SUPABASE_URL** | Supabase client, API routes | Supabase project URL |
| **NEXT_PUBLIC_SUPABASE_ANON_KEY** | Supabase client, API routes | Public anon key |
| **SUPABASE_SERVICE_ROLE_KEY** | Admin APIs, server scripts | Admin panel, applications, users |
| **ADMIN_EMAILS** or **ADMIN_USER_IDS** | admin-auth.ts | Who can access /admin (comma-separated) |

### Optional (admin / security)

| Variable | Used in | Purpose |
|----------|--------|---------|
| ADMIN_BASE_PATH | next.config, middleware, admin layout | Obscure admin URL; when set, /admin can 404 |
| ADMIN_GATE_PASSWORD | api/admin/gate | Password before admin login |
| ADMIN_ALLOW_DIRECT_ACCESS | middleware | Allow /admin when ADMIN_BASE_PATH set (recovery) |
| ADMIN_ALLOWED_IPS | middleware | IP allowlist for admin |
| ADMIN_REQUIRE_MFA | admin-auth.ts | Require MFA for admin |
| ADMIN_ASSIGNMENT_TTL_MINUTES | applications claim/release | Claim expiry (default 15) |
| ADMIN_AUDIT_SNAPSHOT_SECRET | audit snapshot/verify | Secret for audit snapshot API |
| ADMIN_APPROVAL_BULK_THRESHOLD | admin-approval.ts | Bulk approval threshold |
| ADMIN_DESTRUCTIVE_RATE_LIMIT_PER_HOUR | audit-server.ts | Rate limit for destructive actions |

### Optional (app / UX)

| Variable | Used in | Purpose |
|----------|--------|---------|
| NEXT_PUBLIC_APP_URL | forgot-password, auth/callback | App URL for reset links; default from VERCEL_URL |
| NEXT_PUBLIC_APP_STORE_URL | constants.ts | iOS App Store link |
| NEXT_PUBLIC_SENTRY_DSN | global-error, instrumentation | Sentry error reporting (optional) |

### Optional (scripts / local)

| Variable | Used in | Purpose |
|----------|--------|---------|
| SUPABASE_URL | Some scripts | Same as NEXT_PUBLIC_SUPABASE_URL in scripts |
| RESEND_API_KEY, RESEND_FROM_EMAIL, RESEND_ANNOUNCE_TO | (commented in .env.example) | Admin announce emails |

**Recommendation:** In Vercel Production, set **NEXT_PUBLIC_APP_URL** = `https://app.inthecircle.co` so password reset and auth redirects are explicit. Add **ADMIN_GATE_PASSWORD** if you want a gate before the admin login form.

---

## 4. Project and Git

- **Production project:** **inthecircle-web-v2**. All deploy and domain checks use this project.
- **Old project:** **inthecircle-web** is unused; you can delete it in Vercel (Dashboard → inthecircle-web → Settings → Delete Project).
- **Git connection:** In Vercel Dashboard → **inthecircle-web-v2** → Settings → Git:
  - **Repository:** Should be **Inthecircle11/inthecircle-web** (or your org/repo).
  - **Production Branch:** **main**.
  - **Root Directory:** empty (repo root is the app).
  - **Deploy on push:** enabled for main.

If the repo is not connected, connect it and set Production Branch to **main** so pushes to main trigger production deploys.

---

## 5. Domain and DNS

- **Production domain:** **app.inthecircle.co** → must be attached **only** to **inthecircle-web-v2**.
- **Vercel subdomain:** **inthecircle-web-v2.vercel.app** (can redirect to app.inthecircle.co).
- **Verify:** Run `npm run verify-domain` (default project is inthecircle-web-v2). Requires `vercel login` or **VERCEL_TOKEN**.
- **DNS:** Managed at your DNS provider (e.g. Cloudflare). **app** should be a CNAME to Vercel’s target (e.g. `…vercel-dns-017.com`) with proxy off / DNS only.

---

## 6. Build and deploy

**Build command:** `npm run build` (from vercel.json).  
**Install command:** `npm ci` (from vercel.json).  
**Framework:** Next.js (detected).  
**Region:** `iad1` (vercel.json).

**next.config.ts:**

- No longer throws if **ADMIN_BASE_PATH** is missing in production; logs a warning so the build succeeds.
- Rewrites and headers use **ADMIN_BASE_PATH** when set.
- Images: remote patterns for Supabase host from **NEXT_PUBLIC_SUPABASE_URL**.

**Deploy flow:**

- **Normal:** Push (or merge) to **main** → Vercel builds and deploys **inthecircle-web-v2** (if Git is connected).
- **Preview:** `npm run preview` or `vercel` from repo root.
- **Emergency:** From repo: `vercel deploy --prod` (uses linked project inthecircle-web-v2).

---

## 7. CI/CD (GitHub Actions)

**Workflow:** `.github/workflows/ci.yml`  
**Triggers:** Push and PR to **main**.

**Steps:**

1. Checkout, Node 20, `npm ci`
2. Lint (`npm run lint:ci`)
3. Typecheck (`npm run typecheck`)
4. Admin integration tests (`npm run test:admin`)
5. Architecture guards (`npm run test:guards`)
6. Migration safety (`npm run check:migrations`)
7. Build with placeholder Supabase env (**NEXT_PUBLIC_SUPABASE_URL**, **NEXT_PUBLIC_SUPABASE_ANON_KEY**)
8. **On push to main only:** `npm run verify-domain` with **VERCEL_TOKEN** and **VERCEL_PROJECT_NAME=inthecircle-web-v2**

**Secrets:** In GitHub → Settings → Secrets and variables → Actions, set **VERCEL_TOKEN** (from vercel.com/account/tokens) so the domain check runs on push to main.

---

## 8. Security and hardening

- **Admin access:** Gated by **ADMIN_EMAILS** / **ADMIN_USER_IDS** (server-side). No admin list in client bundle.
- **Obscure path:** **ADMIN_BASE_PATH** hides /admin behind a long random path when set.
- **Gate password:** **ADMIN_GATE_PASSWORD** adds a step before the admin login form.
- **IP allowlist:** **ADMIN_ALLOWED_IPS** (optional) restricts which IPs can open admin.
- **Sentry:** **NEXT_PUBLIC_SENTRY_DSN** optional; errors reported only when set and in production.
- **Service role key:** **SUPABASE_SERVICE_ROLE_KEY** is server-only; never exposed to client.

---

## 9. Recommendations checklist

**In Vercel Dashboard (inthecircle-web-v2):**

- [ ] **Settings → Git:** Confirm repo **Inthecircle11/inthecircle-web** and Production Branch **main**.
- [ ] **Settings → Domains:** Confirm **app.inthecircle.co** is present and valid; remove it from any other project.
- [ ] **Settings → Environment Variables:** Confirm **Production** has: **ADMIN_EMAILS**, **NEXT_PUBLIC_SUPABASE_URL**, **NEXT_PUBLIC_SUPABASE_ANON_KEY**, **SUPABASE_SERVICE_ROLE_KEY**. Optionally add **NEXT_PUBLIC_APP_URL** = `https://app.inthecircle.co`, **ADMIN_GATE_PASSWORD**, **ADMIN_BASE_PATH**.
- [ ] **Optional:** Delete project **inthecircle-web** if it exists and is unused.

**In GitHub:**

- [ ] **Settings → Secrets → Actions:** **VERCEL_TOKEN** set so CI can run `npm run verify-domain` on push to main.

**Local / CLI:**

- [ ] Run `vercel link --project inthecircle-web-v2 --yes` in the repo so CLI commands target the production project.
- [ ] Run `npm run verify-domain` after any domain or project change.

---

## 10. Commands reference

```bash
npm run verify-domain   # Ensure app.inthecircle.co only on inthecircle-web-v2
npm run preview         # Preview deploy (no production)
vercel env ls           # List env var names (linked project)
vercel deploy --prod    # Emergency production deploy
```

---

## 11. Files that affect Vercel

| File | Role |
|------|------|
| **vercel.json** | buildCommand, installCommand, framework, regions |
| **next.config.ts** | ADMIN_BASE_PATH warning, rewrites, headers, images |
| **src/middleware.ts** | Admin path, IP allowlist, request-id |
| **scripts/verify-domain-ownership.mjs** | Domain ownership check |
| **scripts/move-domain-to-inthecircle-web.sh** | Move domain to target project |
| **scripts/one-time-fix-domain-and-deploy.mjs** | One-time domain fix + deploy |
| **.github/workflows/ci.yml** | CI and domain verify on push to main |
| **DEPLOYMENT.md** | Deployment and single-project instructions |

---

*End of Vercel full audit.*
