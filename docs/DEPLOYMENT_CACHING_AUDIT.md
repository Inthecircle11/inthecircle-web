# Deep Deployment and Caching Audit

**Date:** 2026-02-26  
**Context:** Admin panel sometimes reverted to an old version; no-cache headers were added for `/admin` and `/admin/*`; old admin still appears occasionally.

---

## 1. Deployment Integrity

### 1.1 Latest deployed commit on Vercel

- **Finding:** The project is deployed via **Vercel CLI** (`vercel deploy --prod`), not from a Git provider.
- **Evidence:** `vercel ls` shows deployments with no commit SHA in the listing. `vercel inspect <url>` shows deployment id, target (production), aliases (app.inthecircle.co), but no git ref.
- **Implication:** There is no “deployed commit” to compare. Production is whatever was last uploaded and built from the local (or CI) filesystem.

### 1.2 Local vs production commit

- **Finding:** The `inthecircle-web` directory has **no `.git`** in it (or is part of a parent repo). `git rev-parse HEAD` and `git status` from inside the project do not show a normal repo.
- **Implication:** “Local commit” is undefined for this folder. Deployments are not tied to a specific Git commit unless the team runs `vercel deploy --prod` from a repo that contains this app and Vercel is linked to Git (which would then deploy on push). Current evidence points to **CLI-driven deploys**.

### 1.3 Production branch and environments

- **Finding:** All listed deployments have **Environment: Production**. No Preview deployments appear in the recent list. Single production target.
- **Branch:** With CLI deploys, there is no “branch” for production; it’s the source that was used for the last `vercel deploy --prod`.

### 1.4 Branch / source mismatch

- **Finding:** No Git integration visible at the project level. No branch mismatch in the traditional sense; risk is **deploying from different machines or folders** (e.g. one person’s local vs another, or an old clone) so “old admin” could be a deploy from an older copy of the code.

---

## 2. Build Output Verification

### 2.1 Admin in build output

- **Finding:** After a fresh `npm run build`, the route table shows:
  - `ƒ /admin`
  - `ƒ /admin/login`
  - All `/api/admin/*` routes as `ƒ` (dynamic).
- **Conclusion:** Admin app and API routes are present in the build and are **dynamic** (server-rendered on demand), not static.

### 2.2 Old admin files in build

- **Finding:** No duplicate or legacy admin entrypoints found. Single `src/app/admin/page.tsx`, single `src/app/admin/layout.tsx`, single `src/app/admin/login/page.tsx`. Build chunks under `.next/server` reference current admin routes (e.g. `_next-internal_server_app_api_admin_*`).
- **Conclusion:** Build does not contain a second, “old” admin app; no mixing of old and new admin at the file level.

### 2.3 Build artifacts mixing versions

- **Finding:** Next.js uses content-hashed chunk names. A new build produces new hashes; there are no leftover “old” admin chunks by name. The only way to serve old admin is (a) cached HTML/document for admin, (b) cached JS/CSS from a previous deployment (e.g. browser or CDN), or (c) an old deployment still being served.
- **Conclusion:** No evidence of mixed versions inside a single build; the risk is **caching or serving an old deployment**, not mixed artifacts in one build.

---

## 3. Cache Analysis

### 3.1 Cache-Control for `/admin` and `/admin/*`

- **Config:** `next.config.ts` defines:
  - `source: '/admin'` → `Cache-Control: no-store, no-cache, must-revalidate, max-age=0`
  - `source: '/admin/:path*'` → same.
- **Important:** In Next.js, `headers()` in `next.config.js` are matched against the **original request path**, not the path after middleware rewrite (see [Next.js headers and rewrites](https://github.com/vercel/next.js/discussions/70365)).
- **Impact:** When users open the admin via the **obscure path** (e.g. `/K7x2mN9pQ4rT1vW6yB0cD3eF8gH2jL5n`), the original path is that string, not `/admin`. So the above rules **do not match**, and **no** `Cache-Control: no-store` was sent for the obscure URL. The document for the secret URL could therefore be cached by the browser or CDN.
- **Fix applied:** `next.config.ts` was updated to also add the same `Cache-Control` for the obscure path using `ADMIN_BASE_PATH` (build-time env):
  - `source: \`/${base}\`` and `source: \`/${base}/:path*\`` with the same no-store header.
  So both `/admin` and the obscure path now get no-store when `ADMIN_BASE_PATH` is set at build time (e.g. on Vercel).

### 3.2 Static files and aggressive caching

- **Finding:** No custom long-lived `Cache-Control` or `immutable` for HTML/document routes in config. Admin routes are dynamic (`ƒ`), so they are not pre-rendered at build time.
- **Static assets:** `_next/static` is served with Next.js defaults (typically immutable, hashed filenames). That is correct for JS/CSS; the problem is the **document** (HTML) for the admin URL being cached, which we address with no-store on the document path.

### 3.3 Service worker

- **Finding:** No service worker file in the project (`sw.js`, `service-worker.js`, workbox, etc.). No registration of a service worker in the codebase. `public/manifest.json` does not reference a service worker.
- **Conclusion:** No service worker is caching the admin or old bundles.

### 3.4 Revalidation and ISR

- **Finding:** No `revalidate`, `generateStaticParams`, or `export const dynamic` in `src/app/admin` (page or layout). Admin is therefore dynamic by default. All admin API routes use `export const dynamic = 'force-dynamic'`.
- **Conclusion:** No ISR or static revalidation on admin; no revalidation-related caching of the admin UI.

---

## 4. CDN / Edge Behavior

### 4.1 Vercel serving an old deployment

- **Finding:** Production alias `https://app.inthecircle.co` points to the latest production deployment (e.g. inthecircle-b0cln6kyw-...). Each new `vercel deploy --prod` creates a new deployment and updates the alias. Old deployments remain available at their unique URLs until removed.
- **Risk:** If the **document** for the admin URL (or obscure URL) was cached at the edge or in the browser with a long TTL before no-store was applied, that cached document could still be served until it expires or is invalidated. With the fix for the obscure path (no-store on that path too), new requests should no longer be cached.

### 4.2 Immutable static assets

- **Finding:** Next.js emits hashed filenames under `_next/static` and serves them with long-lived cache (e.g. immutable). That is expected and desired for stability and performance. The HTML document references these hashes; if the document is not cached (no-store), the browser will fetch fresh HTML and thus the correct, current script chunks.
- **Conclusion:** Immutable static assets are not the cause of “old admin”; the cause is the **document** for the admin (or obscure) URL being cached.

### 4.3 Admin route: static vs server-rendered

- **Finding:** Build output shows `/admin` and `/admin/login` as `ƒ` (dynamic). They are **server-rendered on demand**, not statically generated.
- **Conclusion:** Admin is dynamic; no static HTML snapshot of the admin is stored at build time.

---

## 5. Service Worker Investigation

- **Finding:** No `sw.js`, `service-worker.js`, or workbox config. No `navigator.serviceWorker.register` or similar in the codebase. `manifest.json` has no `service_worker` or similar field.
- **Conclusion:** **There is no service worker.** Old admin is not being served by a service worker.

---

## 6. Final Conclusion

### 6.1 Is this purely a browser cache issue?

- **Partially.** The **obscure path** was not covered by the original no-store rules. So:
  - Requests to **`/admin`** (if ever used) got no-store.
  - Requests to the **obscure URL** did **not** get no-store, so the browser (and possibly the CDN) could cache the document and show an old version.
- With the new rules that add no-store for the obscure path (via `ADMIN_BASE_PATH`), both entry points should now send no-store and reduce browser (and edge) caching of the admin document.

### 6.2 Is Vercel caching incorrectly?

- **Not by configuration.** There is no Vercel config that explicitly caches the admin document. The issue was that the **obscure path** was not included in the Next.js `headers()` rules, so the response for that path did not include `Cache-Control: no-store` and was cacheable by standard HTTP semantics. That is fixed by adding header rules for the obscure path in `next.config.ts`.

### 6.3 Is there a service worker?

- **No.** No service worker exists in the project; it is not a factor.

### 6.4 Is there a build mismatch?

- **No.** A single build contains one admin app and one set of admin API routes. There is no evidence of old and new admin code mixed in the same build. “Old admin” is from a **cached or previously deployed** response, not from a mixed build.

### 6.5 Is there branch misalignment?

- **N/A for Git.** The project appears to be deployed via CLI from a folder that may not be a Git repo (or is part of a parent repo). So “branch” is not the mechanism; the risk is **deploying from different sources** (e.g. another clone or machine with older code). Ensuring a single source of truth (e.g. Git-linked Vercel project and “deploy from main”) would avoid that.

---

## 7. Recommendations

1. **Done:** Add `Cache-Control: no-store` for the obscure admin path in `next.config.ts` using `ADMIN_BASE_PATH` so both `/admin` and the secret URL get no-store. Ensure `ADMIN_BASE_PATH` is set in Vercel’s build env so the rules are applied.
2. **Optional:** In the proxy, when rewriting the obscure path to `/admin`, set a response header (e.g. `Cache-Control: no-store`) on the response. In Next.js middleware/proxy, the response is produced by the app after the rewrite; the app’s headers are applied to the rewritten path. With the new next.config rules keyed by the **original** path (obscure URL), the response for that path should now include no-store. If any edge still keys cache by original URL, the new config should address it.
3. **Optional:** Link the Vercel project to Git (e.g. GitHub) and deploy production from a single branch (e.g. `main`). That gives a clear “deployed commit” and avoids deploying from stale local copies.
4. **User mitigation:** After each deploy, do a hard refresh (Cmd+Shift+R / Ctrl+Shift+R) or use an incognito window when opening the admin (especially via the obscure URL) until caches have refreshed.

---

## 8. Summary Table

| Question | Finding |
|----------|--------|
| Latest deployed commit | CLI deploys; no commit SHA in Vercel listing. |
| Local vs production commit | No .git in app folder; comparison N/A. |
| Production from main? | Deploys are CLI-based; no Git branch tied to production. |
| Multiple Vercel environments? | Only Production seen; no Preview in recent list. |
| New admin in build? | Yes; `/admin` and `/admin/login` are dynamic in build. |
| Old admin files in build? | No duplicate admin entrypoints or mixed versions. |
| Cache-Control on /admin? | Yes (no-store) in next.config. |
| Cache-Control on obscure path? | **Was missing; now added** via ADMIN_BASE_PATH in next.config. |
| Static files cached aggressively? | Only default _next/static (hashed); no extra rules for admin. |
| Service worker? | **None.** |
| Revalidate/ISR on admin? | None; admin is fully dynamic. |
| Admin route type | Dynamic (ƒ), server-rendered on demand. |
| Cause of “old admin” | Cached document for admin (especially obscure URL) before no-store was applied to that path. |
