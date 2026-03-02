# Vercel 100% solid — inthecircle-web

**Project:** inthecircle-web · **Production:** https://app.inthecircle.co  
**Last updated:** 2026-03-02

---

## 1. Checklist (do once, then maintain)

| Item | Status | Notes |
|------|--------|--------|
| **Domain** | ✅ | `app.inthecircle.co` only on **inthecircle-web**. Run `npm run verify-domain` to confirm. |
| **Git → production** | ⚠️ | In Vercel Dashboard → inthecircle-web → **Settings → Git**: Production branch = **main**, "Deploy on push" enabled. |
| **Env (production)** | Required | **ADMIN_BASE_PATH** (24+ char secret path), **ADMIN_EMAILS** or **ADMIN_USER_IDS**, **NEXT_PUBLIC_SUPABASE_URL**, **NEXT_PUBLIC_SUPABASE_ANON_KEY**, plus any **SUPABASE_SERVICE_ROLE_KEY** etc. |
| **Middleware** | ✅ | `src/middleware.ts` restored; adds request-id for admin API and handles obscure admin path redirect. |
| **Build config** | ✅ | `vercel.json` sets `buildCommand`, `installCommand`, `framework`, `regions`. `next.config.ts` enforces **ADMIN_BASE_PATH** in production. |
| **CI** | ✅ | `.github/workflows/ci.yml` runs lint, typecheck, build on PR/push. On **push to main** it runs `npm run verify-domain` when **VERCEL_TOKEN** is set in repo secrets. |

---

## 2. Domain rule (one domain, one project)

- **app.inthecircle.co** must be attached **only** to the Vercel project **inthecircle-web**.
- If another project (e.g. inthecircle-web-v2 or "Inthecircle") has this domain, visitors see the wrong app.
- **Verify:** `npm run verify-domain` (requires `vercel login` or `VERCEL_TOKEN`).
- **Optional:** Add **VERCEL_TOKEN** in GitHub → Settings → Secrets so CI runs domain check on every push to main.

---

## 3. Deploy flow

- **Normal:** Push (or merge) to **main** → Vercel builds and deploys production. No `vercel deploy --prod` needed.
- **Preview:** `npm run preview` or `vercel` from repo root.
- **Emergency:** If Git deploy didn't run or failed, from repo: `vercel deploy --prod`.

After any production change, hard-refresh or open app.inthecircle.co in incognito to avoid cache.

---

## 4. Projects in team

| Project | Role | Domains |
|---------|------|--------|
| **inthecircle-web** | Production | app.inthecircle.co, inthecircle-web.vercel.app, *.vercel.app |
| **inthecircle-web-v2** | Separate | inthecircle-web-v2.vercel.app only (no prod domain) |

No domain overlap. v2 does not have app.inthecircle.co.

---

## 5. If something breaks

- **Wrong admin / different app:** Domain is on another project. Run `npm run verify-domain` then `./scripts/move-domain-to-inthecircle-web.sh` if needed, or fix in Vercel Dashboard (remove domain from other project, add to inthecircle-web). Then push to main or `vercel deploy --prod`.
- **Build fails on Vercel:** Ensure **ADMIN_BASE_PATH** is set for Production env. Check build logs in Vercel → Deployments → failed deployment.
- **/admin 404:** If **ADMIN_BASE_PATH** is set, use the obscure URL or set **ADMIN_ALLOW_DIRECT_ACCESS=true** so /admin works too. See DEPLOYMENT.md.
- **Git push didn't deploy:** In Vercel → Settings → Git, confirm repo and branch; redeploy with `vercel deploy --prod` if needed.

---

## 6. Commands

```bash
npm run verify-domain   # Domain ownership (needs VERCEL_TOKEN or vercel login)
npm run preview        # Preview deploy
vercel deploy --prod   # Emergency production deploy
```

---

## 7. Files that keep Vercel solid

- **vercel.json** — Explicit build/install and region.
- **next.config.ts** — Requires ADMIN_BASE_PATH in production; rewrites and cache headers for admin.
- **src/middleware.ts** — Request-id for admin API; obscure path redirect and optional IP allowlist.
- **scripts/verify-domain-ownership.mjs** — Domain check script.
- **.github/workflows/ci.yml** — Lint, typecheck, build; verify-domain on push to main when VERCEL_TOKEN set.
- **tsconfig.json** — `compilerOptions.types` set to `["node", "react", "react-dom"]` so duplicate `@types` folders (e.g. from npm) don't break the build.
