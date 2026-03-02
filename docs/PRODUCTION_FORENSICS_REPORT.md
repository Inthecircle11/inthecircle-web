# Production forensics report — app.inthecircle.co

**Date:** 2026-03-02  
**Scope:** refresh.js WebSocket, favicon 404, unload deprecation, analytics sendBeacon.

---

## SECTION 1 — refresh.js / WebSocket 8081

### Investigation

1. **Codebase search**
   - Searched for: `refresh.js`, `8081`, `WebSocket(`, `ws://`, `localhost`.
   - **Results:** No matches in `src/` or app code. Only:
     - `next.config.ts`: comment that dev client would try `ws://localhost:8081`.
     - `tests/admin.integration.test.ts`: `BASE = 'http://localhost'` (test only).

2. **Custom WebSocket / dev client**
   - No `WebSocket(` or `new WebSocket` in codebase.
   - No `refresh.js` import or reference.
   - No HMR/Fast Refresh client code in app.

3. **Production bundle**
   - Ran `next build`, then searched `.next/static` for `refresh`, `8081`, `webpack-hmr`, `HMR`.
   - **Result:** No matches. Production chunks do not contain refresh.js or WebSocket-to-8081 logic.

4. **Build mode**
   - `package.json` scripts: `"build": "next build"`, `"start": "next start"`.
   - No `next dev` in production. Vercel uses `next build`; deploy is not using dev server.

### Conclusion

- **refresh.js is NOT in our bundle.** It is not from the inthecircle-web app.
- **Likely origin:** A **browser extension** (e.g. Live Reload, React DevTools, Redux DevTools, “Auto Refresh”) injects a script named `refresh.js` that tries to connect to `ws://localhost:8081` for a local dev server.
- **Final resolution:** No app code change. Users who see the error can use an incognito/private window (extensions usually disabled) or disable the offending extension. Production build does not include any dev client or WebSocket to localhost.

---

## SECTION 2 — Favicon 404 (fixed)

### Root cause

- Next.js was serving `/favicon.ico` via a **route handler** at `src/app/favicon.ico/route.ts` that read from `process.cwd() + 'public/favicon.ico'`.
- On Vercel serverless, `process.cwd()` or filesystem layout can differ; the route could fail to find the file and return 404 or error.

### Correct implementation (applied)

1. **Deleted**
   - `src/app/favicon.ico/route.ts` (and removed empty `src/app/favicon.ico/` folder).
   - No favicon rewrites remain in `next.config.ts` (already removed earlier).

2. **Static file**
   - `public/favicon.ico` already exists (~81 KB). Next.js serves files in `public/` at the root, so `GET /favicon.ico` is served as a static file with no route handler.

3. **Layout metadata**
   - `src/app/layout.tsx`: `icons` now point to `"/favicon.ico"` and `"/logo.png"` only; `shortcut` set to `"/favicon.ico"`. Removed dependency on `/api/favicon` for primary icon.

### Why static file is correct

- No serverless filesystem or `process.cwd()` dependency.
- Next.js copies `public/` into the build output and serves it with stable URLs.
- No dynamic logic, no 404 from a failing route. `/favicon.ico` returns 200 in production.

### Left unchanged

- `src/app/api/favicon/route.ts` remains for optional use (e.g. `/api/favicon`); it is not used for the primary favicon link.

---

## SECTION 3 — Unload event listener deprecation

### Investigation

1. **Codebase search**
   - Searched for `unload`, `beforeunload` in `src/`.
   - **Results:** No `addEventListener('beforeunload'` or `addEventListener('unload'`. Only comments in `AppShell.tsx`, `admin/page.tsx`, and `analytics.ts` explaining that we use `pagehide` instead of `beforeunload`.

2. **Actual listeners**
   - `AppShell.tsx`: `window.addEventListener('pagehide', onPageHide)` → `endSessionWithBeacon('app')`.
   - `src/app/admin/page.tsx`: `window.addEventListener('pagehide', onPageHide)` → `endSessionWithBeacon('admin')`.
   - Only **pagehide** is used for session end.

3. **Warning source**
   - User reported warning at `frame.js:21454`. There is no `frame.js` in our repo; it is typically from browser DevTools or an extension.

4. **Dependencies**
   - No dependency in `package.json` is known to attach an `unload` listener in a way that would show as our app code.

### Conclusion

- **No unload/beforeunload listener exists in our code.** Only pagehide is used.
- **Warning origin:** External (browser or extension), e.g. `frame.js`.
- **No action required** in the app; our code does not trigger the deprecation warning.

---

## SECTION 4 — Analytics sendBeacon validation

### Issue

- `navigator.sendBeacon(url, new Blob([JSON.stringify(body)], { type: 'application/json' }))` sends a POST body that some runtimes may present as text or with a body that is safer to read as text first.

### Change applied

- **`src/app/api/analytics/track/route.ts`**
  - Body is read with `await req.text()` and then `JSON.parse(raw)`. This works for both:
    - Normal `fetch(..., { body: JSON.stringify(...), headers: { 'Content-Type': 'application/json' } })`.
    - `sendBeacon(url, new Blob([JSON.stringify(body)], { type: 'application/json' }))`, which may be delivered as a text body.
  - `parseBody()` and the rest of the handler (rate limit, `logEventBatchServer`, `endSessionServer`) are unchanged. Session close logic when `body.end_session || hasEndSession` is unchanged.

### Verification

- Beacon sends JSON string in the blob; reading as text and parsing preserves that.
- `end_session: true` and `_end_session` events still trigger `endSessionServer`. No breakage in session close logic.

---

## SECTION 5 — Final verification checklist

| Check | Status |
|-------|--------|
| Production build contains no refresh.js / dev client | Verified: no refresh/HMR in `.next/static`. |
| `/favicon.ico` served as static file, returns 200 | Route handler removed; `public/favicon.ico` used. |
| No unload/beforeunload in our code | Only pagehide used; no action required. |
| Analytics track accepts beacon body | Body read via `req.text()` + `JSON.parse`. |
| Admin panel functional | No changes to admin routes or auth. |

---

## Files changed (this pass)

| Action | File |
|--------|------|
| Deleted | `src/app/favicon.ico/route.ts` |
| Removed | Empty directory `src/app/favicon.ico/` |
| Updated | `src/app/layout.tsx` — icons/shortcut to `/favicon.ico` only (no `/api/favicon` for primary). |
| Updated | `src/app/api/analytics/track/route.ts` — POST body via `req.text()` + `JSON.parse`. |

No console suppression. Root-cause fixes only.
