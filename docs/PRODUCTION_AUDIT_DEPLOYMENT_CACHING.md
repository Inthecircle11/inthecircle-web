# Production-Grade Deployment, Caching & Build Audit

**Project:** inthecircle-web (Next.js 16 on Vercel)  
**Date:** 2026-02-26  
**Context:** Admin panel sometimes reverted to an older version; no-cache headers added for `/admin`, `/admin/*`, and obscure `ADMIN_BASE_PATH` route. Audit requested to confirm deployment integrity, env config, headers, cache behavior, build output, service worker, and route behavior.

---

## 1. DEPLOYMENT STATE

### What commit is currently deployed to production?

**Finding:** There is **no commit SHA** associated with production deployments.

**Evidence:**
- `vercel ls` shows deployments with no git ref (e.g. `inthecircle-b0cln6kyw-...`, status Ready, Environment Production).
- `vercel inspect https://inthecircle-b0cln6kyw-ahmed-khalifas-projects-9cca8f38.vercel.app` returns: `id`, `target: production`, `url`, `created`, `Aliases` (app.inthecircle.co, inthecircle-web.vercel.app, etc.). No `commit`, `gitSource`, or `meta` with commit SHA in the inspected output.

**Conclusion:** Production is deployed via **Vercel CLI** (`vercel deploy --prod`). The CLI uploads the local build; Vercel does not report which Git commit (if any) that build came from. So “currently deployed commit” is **undefined** in this setup.

---

### Does it match the local working commit?

**Finding:** Not verifiable.

**Evidence:**
- From inside `inthecircle-web`, `git rev-parse HEAD` runs in the **parent** repo (workspace root is the parent). Parent repo reported “No commits yet on main” / exit 128 for `git log -1`.
- So there is no reliable “local commit” to compare. Deployments are from whatever source was used when `vercel deploy --prod` was run (e.g. local filesystem or CI).

**Conclusion:** Commit match cannot be confirmed. To make it verifiable, link the Vercel project to Git and deploy from a branch (e.g. `main`) so each deployment has a commit SHA.

---

### Is production deployed via CLI or Git integration?

**Finding:** **CLI.**

**Evidence:**
- `package.json` scripts: `"deploy": "node scripts/verify-domain-ownership.mjs && vercel deploy --prod"`, `"fix-production": "..." && vercel deploy --prod`.
- `.vercel/project.json` exists with `projectId`, `orgId`, `projectName`; no indication of Git provider in the file.
- `vercel ls` shows many Production deployments (e.g. 8m, 12h, 13h ago) with no branch or commit info.

**Conclusion:** Production is driven by **manual/CLI** `vercel deploy --prod`, not by Git push → Vercel auto-deploy.

---

### Is there only one Production environment in Vercel?

**Finding:** **Yes.** Only **Production** appears in the deployment list.

**Evidence:** `vercel ls` output: every row has `Environment: Production`. No Preview or Development in the listed deployments. Latest deployment (8m ago) is Production and has alias `https://app.inthecircle.co`.

**Conclusion:** Single Production environment; no second production target.

---

### Are there multiple deployments active?

**Finding:** **One production deployment is “active”** (serving the production alias). Older deployments still exist by URL but are not the live alias.

**Evidence:**
- `vercel inspect` on the latest deployment shows Aliases: `https://app.inthecircle.co`, `https://inthecircle-web.vercel.app`, etc. So the **latest** deployment (e.g. `inthecircle-b0cln6kyw-...`) is the one serving production.
- `vercel ls` shows many past deployments (Ready or Error). Each has a unique URL; only the latest is attached to the production alias.

**Conclusion:** Only the most recent production deployment serves `app.inthecircle.co`. Multiple deployment URLs exist for history, but there is no “multiple active production” in the sense of two builds serving the same alias.

---

### Is there any branch-based deployment logic?

**Finding:** **No.** No branch logic in this repo for Vercel.

**Evidence:** No `vercel.json` with branch-specific config. Deploys are CLI; no Git integration, so no branch-based deployment logic.

**Conclusion:** No branch-based deployment; production is “whatever was last deployed via CLI”.

---

### Could multiple deploy sources cause inconsistent versions?

**Finding:** **Yes.** Risk is real.

**Evidence:** If one person runs `vercel deploy --prod` from an old clone or an older branch, production will serve that build. There is no single source of truth (e.g. “production = main”) enforced by Vercel.

**Conclusion:** **Yes.** Multiple machines or clones can deploy different code; the only way to get consistency is to use one canonical source (e.g. Git-linked project, deploy only from `main`) or strict process (e.g. single machine/pipeline for prod deploys).

---

## 2. ENVIRONMENT VARIABLES

### Is ADMIN_BASE_PATH defined?

**Finding:** **Yes**, in Vercel Production.

**Evidence:** `vercel env ls` shows:
- `ADMIN_BASE_PATH` — **Encrypted** — **Production** — 6d ago.

**Conclusion:** `ADMIN_BASE_PATH` is set for the **Production** environment in Vercel.

---

### Is it defined in Vercel Production / Preview / Local .env?

**Finding:**
- **Vercel Production:** Yes (see above).
- **Vercel Preview:** Not listed for `ADMIN_BASE_PATH` in `vercel env ls` (only Production).
- **Local:** `.env.example` documents `ADMIN_BASE_PATH=` (empty). `.env.local` exists; contents not read (secrets). So locally it *can* be set but is not verified here.

**Conclusion:** Production: yes. Preview: no (not in env list). Local: possible via `.env.local`; not confirmed.

---

### Was ADMIN_BASE_PATH present during last production build?

**Finding:** **Yes.** Vercel injects Production env vars (including `ADMIN_BASE_PATH`) into the build for Production. The latest production deployment (8m ago) serves the obscure path with correct behavior (see §4), so the build that is live had access to `ADMIN_BASE_PATH`.

**Evidence:**
- `next.config.ts` reads `process.env.ADMIN_BASE_PATH` in `headers()`. That runs at **build time** when Next.js builds the app.
- Vercel builds for Production use Production env vars. So when building for Production, `ADMIN_BASE_PATH` is present.
- Curl to the obscure URL returns `Cache-Control: private, no-store, ...` and `x-matched-path: /admin`, which only happens if the header rules for the obscure path were included in the config (i.e. `ADMIN_BASE_PATH` was set at build time).

**Conclusion:** **Yes.** It was present during the last production build.

---

### Would missing ADMIN_BASE_PATH at build time prevent header rules from being generated?

**Finding:** **Yes.**

**Evidence:** In `next.config.ts`:
```ts
if (adminBase) {
  const base = adminBase.startsWith('/') ? adminBase.slice(1) : adminBase
  rules.push(
    { source: `/${base}`, headers: [...] },
    { source: `/${base}/:path*`, headers: [...] }
  )
}
```
If `ADMIN_BASE_PATH` is missing or empty, `adminBase` is falsy and the two rules for the obscure path are **not** pushed. Then only `/admin` and `/admin/:path*` get the no-store header. Requests to the **obscure path** would not match any of these and would get default caching (or no Cache-Control), so the document could be cached.

**Conclusion:** **Yes.** If `ADMIN_BASE_PATH` is not set at build time, the obscure admin URL does **not** get the no-store header and can be cached (browser/CDN). That was the root cause of “old admin” when using the secret URL.

---

## 3. NEXT.CONFIG HEADERS ANALYSIS

### Inspect next.config.ts

**Finding:** Header rules are correctly defined.

**Evidence (from `next.config.ts`):**
- **Always:**
  - `source: '/admin'` → `Cache-Control: no-store, no-cache, must-revalidate, max-age=0`
  - `source: '/admin/:path*'` → same.
- **When `process.env.ADMIN_BASE_PATH` is set at build time:**
  - `source: \`/${base}\`` (no leading slash in `base`) → same Cache-Control.
  - `source: \`/${base}/:path*\`` → same.

So we have:
- `/admin`
- `/admin/:path*`
- `/${ADMIN_BASE_PATH}` (e.g. `/K7x2mN9pQ4rT1vW6yB0cD3eF8gH2jL5n`)
- `/${ADMIN_BASE_PATH}/:path*`

**Conclusion:** Rules exist for `/admin`, `/admin/*`, and for the value of `ADMIN_BASE_PATH` (and its children).

---

### Confirm they resolve correctly at build time

**Finding:** **Yes.** They resolve at build time.

**Evidence:** `headers()` is an async function that runs when Next.js loads the config (build time). `process.env.ADMIN_BASE_PATH` is read once; the returned `rules` array is fixed for that build. No runtime env read for the config itself. So for a Production build on Vercel, Production env is injected and the obscure-path rules are included.

**Conclusion:** Header rules resolve at build time; with `ADMIN_BASE_PATH` set in Vercel Production, the obscure path rules are included.

---

### Confirm headers are applied to the actual deployed route

**Finding:** **Yes.** Verified with curl.

**Evidence:**
- Request to **obscure path**:  
  `curl -sI "https://app.inthecircle.co/K7x2mN9pQ4rT1vW6yB0cD3eF8gH2jL5n"`  
  Response includes:
  - `cache-control: private, no-cache, no-store, max-age=0, must-revalidate`
  - `x-matched-path: /admin`
  - `x-vercel-cache: MISS`
- Request to **/admin** (direct):  
  `curl -sI "https://app.inthecircle.co/admin"`  
  Response: 404 with `cache-control: no-store, no-cache, must-revalidate, max-age=0`.

So both the obscure path and `/admin` get no-store. Next.js/Vercel may add `private`; semantics remain non-cacheable.

**Conclusion:** Headers are applied to both the obscure URL and `/admin` on the deployed site.

---

### Confirm no rewrite is bypassing header rules

**Finding:** Rewrite does **not** bypass header rules.

**Evidence:** Next.js applies `headers()` from `next.config.js` to the **incoming request path** (see Next.js docs and prior audit). The request path is the **original** URL path (e.g. `/K7x2mN9pQ4rT1vW6yB0cD3eF8gH2jL5n`). The proxy (`src/proxy.ts`) then rewrites that path to `/admin` internally. So:
1. Incoming path: e.g. `/K7x2mN9pQ4rT1vW6yB0cD3eF8gH2jL5n` → header rule `/${base}` matches → Cache-Control set on the **response**.
2. Then proxy rewrites to `/admin` and the app renders the admin page.
3. The response sent to the client is for the **original** URL and already has the no-store header from step 1.

So the rewrite does not remove or override the header; the header is matched on the original path before the rewrite is applied.

**Conclusion:** No bypass; headers apply to the original path; rewrite happens afterward and does not strip them.

---

## 4. CACHE BEHAVIOR VERIFICATION

### Simulate what curl returns for the obscure admin URL

**Command:**
```bash
curl -sI "https://app.inthecircle.co/K7x2mN9pQ4rT1vW6yB0cD3eF8gH2jL5n"
```

**Actual response (2026-02-26):**
```
HTTP/2 200
age: 0
cache-control: private, no-cache, no-store, max-age=0, must-revalidate
content-type: text/html; charset=utf-8
date: Thu, 26 Feb 2026 10:41:57 GMT
...
x-matched-path: /admin
x-vercel-cache: MISS
```

**Conclusion:** The response **does** include the intended no-store semantics (`no-cache, no-store, max-age=0, must-revalidate`). Next.js/Vercel adds `private`, which is consistent with not caching in shared caches.

---

### Should return Cache-Control: no-store, no-cache, must-revalidate, max-age=0

**Finding:** **Yes.** The response includes those directives (plus `private`). So the requirement is satisfied.

---

### Is the HTML document cacheable?

**Finding:** **No.** The Cache-Control above instructs clients and shared caches not to store the response. So the HTML document for the admin (obscure path) is not cacheable.

---

### Are static JS assets immutable?

**Finding:** **Yes.** Next.js serves `_next/static` with hashed filenames and typically `immutable` cache. The audit did not override that. So JS/CSS under `_next/static` are immutable and cacheable by design; the **document** (HTML) is not, which is what matters for always loading the latest admin UI.

---

### Stale edge nodes?

**Finding:** **No evidence** of stale edge serving for this request.

**Evidence:** `x-vercel-cache: MISS` and `age: 0` indicate the response was not served from a cache (or is fresh). So for this request, no stale edge node was used.

---

### Is Vercel Edge caching documents incorrectly?

**Finding:** **No.** For the obscure path and `/admin`, the configured Cache-Control is sent and the sampled response had cache MISS and age 0. So Vercel is not incorrectly caching the admin document for these paths with the current config.

---

## 5. BUILD OUTPUT INTEGRITY

### Confirm the new admin code exists in the build output

**Finding:** **Yes.**

**Evidence:** After `npm run build`:
- Route table shows `ƒ /admin` and `ƒ /admin/login` (dynamic).
- `.next/server/app/admin/` contains `page.js`, `login/`, and related chunks. No duplicate or legacy admin entrypoints.

**Conclusion:** Current admin app and login route are present in the build.

---

### Confirm no old admin bundle remains

**Finding:** **Yes.** No old bundle found.

**Evidence:** Single `src/app/admin/page.tsx`, single `src/app/admin/layout.tsx`, single `src/app/admin/login/page.tsx`. Build output has one `admin` app tree under `.next/server/app/admin`. Chunks are content-hashed; a new build replaces hashes. No second admin route or legacy path found in the repo or build.

**Conclusion:** No old admin bundle in the build; no mixing of old and new admin in one build.

---

### Confirm there are no duplicate admin routes

**Finding:** **No duplicates.**

**Evidence:** Build route list shows exactly one `/admin` and one `/admin/login`. No other `/admin*` page routes. Proxy rewrites the obscure path to `/admin`; it does not create a second route.

**Conclusion:** No duplicate admin routes.

---

### Confirm admin is server-rendered (not statically generated)

**Finding:** **Yes.**

**Evidence:** Build output: `/admin` and `/admin/login` are listed as `ƒ` (Dynamic), i.e. server-rendered on demand. No `○` (Static) for these routes. No `generateStaticParams` or `revalidate` in `src/app/admin`.

**Conclusion:** Admin is server-rendered, not statically generated.

---

### Confirm no ISR or revalidate is interfering

**Finding:** **None.**

**Evidence:** No `revalidate`, `generateStaticParams`, or `export const dynamic` in `src/app/admin` (page or layout). All admin API routes under `src/app/api/admin` use `export const dynamic = 'force-dynamic'`. So no ISR or revalidate on admin.

**Conclusion:** No ISR or revalidate affecting admin.

---

## 6. SERVICE WORKER CHECK

### Confirm no service worker exists

**Finding:** **No service worker.**

**Evidence:** Grep for `service-worker`, `sw.js`, `workbox`, `serviceWorker.register` across the repo: only mentions in `docs/DEPLOYMENT_CACHING_AUDIT.md`. No `sw.js`, `service-worker.js`, or registration in app code. `public/manifest.json` has no `service_worker` or similar; `start_url` is `/`.

**Conclusion:** No service worker in the project.

---

### Confirm no PWA plugin (next-pwa)

**Finding:** **No next-pwa.**

**Evidence:** `package.json` has no `next-pwa` (or workbox) dependency. No PWA plugin in `next.config.ts`.

**Conclusion:** No next-pwa or PWA plugin.

---

### Confirm no sw.js or service-worker.js

**Finding:** **None.**

**Evidence:** No such files under `src/` or `public/`.

**Conclusion:** No sw.js or service-worker.js.

---

### Confirm no caching strategy inside app code

**Finding:** No custom caching of admin or HTML in app code.

**Evidence:** No fetch cache overrides or cache storage for admin routes in the codebase. Cache-Control is set only via `next.config.ts` headers.

**Conclusion:** No app-level caching strategy that would serve old admin.

---

## 7. ROUTE BEHAVIOR

### Is ADMIN_BASE_PATH treated as a dynamic route?

**Finding:** **Yes.** The path is not a static file or a predefined Next.js route; it is handled by the **proxy** (Next.js 16 `src/proxy.ts`). The proxy matches the path and rewrites to `/admin`. So the effective route is dynamic (server-rendered `/admin`).

**Evidence:** Next.js 16 uses `proxy.ts` instead of `middleware.ts`. Build shows “ƒ Proxy (Middleware)”. The matcher in `proxy.ts` runs for paths that are not `_next/`, `api/`, etc., so the obscure path is handled by the proxy and then by the dynamic `/admin` route.

**Conclusion:** The obscure path is handled dynamically (via proxy + `/admin`).

---

### Is it rewritten internally to /admin?

**Finding:** **Yes.**

**Evidence:** In `src/proxy.ts`, when the path matches the obscure base (e.g. `/${baseLower}` or `/${baseLower}/login`), it does `NextResponse.rewrite(url)` with `url.pathname = '/admin'` or `'/admin/login'`. Response headers show `x-matched-path: /admin` for the obscure URL.

**Conclusion:** The obscure path is rewritten to `/admin` (or `/admin/login`).

---

### Do header rules apply before or after rewrite?

**Finding:** **Before** (in terms of path matching). Headers are matched on the **incoming** path; then the proxy runs and rewrites.

**Evidence:** Next.js docs state that `headers()` in `next.config.js` match the **incoming request path**. So for a request to `/K7x2mN9pQ4rT1vW6yB0cD3eF8gH2jL5n`, the header rule `/${base}` matches that path and the response gets the Cache-Control. The proxy then runs (middleware/proxy layer) and rewrites the request to `/admin` for rendering. The response sent back is still for the original URL and already has the header.

**Conclusion:** Header rules apply based on the **original** URL; the rewrite does not change which header rule applies; the response for the original URL gets the correct Cache-Control.

---

### Could original URL vs rewritten URL affect header matching?

**Finding:** **No.** Matching uses the **original** URL. So:
- Request to obscure path → matched by `/${base}` and `/${base}/:path*` → no-store applied.
- Request to `/admin` → matched by `/admin` and `/admin/:path*` → no-store applied.  
The rewritten path (`/admin`) is only used internally for rendering; the outgoing response is keyed to the original request URL and already has the correct headers.

**Conclusion:** Original URL is what matters for header matching; rewrite does not break it.

---

## 8. FINAL DIAGNOSIS

### Is this purely a header misconfiguration?

**Partially.** The **original** issue was: the obscure path did not have a header rule when `ADMIN_BASE_PATH` was only used at runtime (e.g. in proxy) and not at build time in `next.config.ts`. So the **document** for the secret URL was cacheable. That was a header misconfiguration (missing rule for the incoming path). **Now fixed:** `next.config.ts` adds rules for `ADMIN_BASE_PATH` at build time, and production responds with no-store for the obscure path. So the **current** production state is correct; any remaining “old admin” is likely **residual cache** (browser or previously cached response before the fix).

---

### Is this an environment variable build-time issue?

**It was.** If `ADMIN_BASE_PATH` was not set in Vercel at build time in the past, the obscure path would not get no-store. **Currently:** `ADMIN_BASE_PATH` is set in Vercel Production and the last production build includes the obscure-path header rules (confirmed by curl). So the build-time env issue is **resolved** for current production.

---

### Is this a Vercel deployment issue?

**No.** Deployment is CLI-based; there is no wrong branch or wrong project. The latest deployment serves the correct code and headers. No evidence of Vercel serving an old deployment on the production alias or of edge caching the admin document against the new headers.

---

### Is this CDN edge cache persistence?

**Possibly in the past.** Before the obscure path had a no-store rule, the document could have been cached at the edge or in the browser. **Now:** With no-store on both `/admin` and the obscure path, new requests should not be cached. So **current** behavior is correct; any “old admin” could be **stale cache** from before the fix (browser or edge), not ongoing CDN misconfiguration.

---

### Is this a race between deployments?

**Unlikely as root cause.** Only one deployment is attached to the production alias. There is no evidence of a race where two deployments were switching. Possible only if someone had an old deployment URL bookmarked; then they would see that build, not “production”. Not a structural race.

---

### Is this a structural project issue?

**No.** One admin app, one build, no service worker, no ISR on admin, no duplicate routes. The only structural nuance was that header rules must match the **original** path; that is now handled by adding rules for `ADMIN_BASE_PATH` at build time.

---

## 9. EXACT FIX PLAN

1. **Already done (verified in production)**  
   - `next.config.ts` adds Cache-Control no-store for `/admin`, `/admin/:path*`, and for `ADMIN_BASE_PATH` (and `/${ADMIN_BASE_PATH}/:path*`) when set at build time.  
   - `ADMIN_BASE_PATH` is set in Vercel Production.  
   - Production responds with no-store for both the obscure URL and `/admin`.

2. **Ensure it stays correct**  
   - Keep `ADMIN_BASE_PATH` in Vercel **Production** (and any other environment that builds the app with the obscure path).  
   - Do **not** remove or rename the header rules in `next.config.ts`.  
   - When adding new env-specific paths in the future, add matching header rules in `headers()` using the **incoming** path pattern.

3. **If “old admin” still appears for some users**  
   - Have them hard-refresh (Cmd+Shift+R / Ctrl+Shift+R) or use a private/incognito window.  
   - Ensure they use the **exact** obscure URL (no extra slash; value matches `ADMIN_BASE_PATH`).  
   - If it persists, check for corporate proxies or caching that might ignore Cache-Control.

4. **Optional: deployment traceability**  
   - Link the Vercel project to Git (e.g. GitHub) and deploy Production from a single branch (e.g. `main`).  
   - Then “current production commit” is known and you can avoid deploying from stale local clones.

5. **No further code changes required** for caching or headers for the admin panel; the current setup is correct and verified in production.

---

**Summary table**

| Topic | Finding |
|-------|--------|
| Deployed commit | None (CLI deploys) |
| Local vs prod commit | Not comparable (no Git in app dir / no commits) |
| Deploy method | CLI (`vercel deploy --prod`) |
| Production environments | Single Production |
| Multiple active deployments | No; one deployment serves alias |
| Branch logic | None |
| Multiple deploy sources | Possible; use single source (e.g. Git) to avoid |
| ADMIN_BASE_PATH defined | Yes, in Vercel Production |
| Present at build time | Yes (confirmed by production response) |
| Missing at build → no header for obscure path | Yes |
| Header rules in next.config | Yes for /admin, /admin/*, and ADMIN_BASE_PATH |
| Headers on deployed route | Yes (curl verified) |
| Rewrite bypassing headers | No |
| Curl obscure path | 200, cache-control no-store, x-vercel-cache MISS |
| HTML cacheable | No |
| Static assets | Immutable (expected) |
| Stale edge / Vercel caching docs | No evidence |
| Admin in build | Yes; dynamic |
| Old admin bundle | None |
| Duplicate admin routes | None |
| ISR/revalidate | None |
| Service worker / next-pwa | None |
| Obscure path → dynamic + rewrite to /admin | Yes |
| Header matching | Original URL; rewrite does not bypass |
