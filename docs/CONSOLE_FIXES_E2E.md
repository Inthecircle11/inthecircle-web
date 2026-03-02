# Console errors – production hardening (root-cause fixes)

This doc describes the **root-cause fixes** applied so that the following no longer appear (or are not caused by our app) on **https://app.inthecircle.co**.

---

## 1. WebSocket connection to `ws://localhost:8081` failed (refresh.js)

**Root cause:**  
- **Not from our app:** There is no `refresh.js`, `8081`, or HMR/WebSocket code in the repo. Production builds do not include Fast Refresh.  
- The error is typically from a **browser extension** (e.g. Live Reload, React DevTools) that injects a script trying to connect to a local dev server.  
- If `next dev` were ever run in production, the Next.js dev client would try to connect to `ws://localhost:8081` and cause this error.

**Fixes applied (no suppression):**
- Removed the `SuppressExtensionConsoleError` component that patched `console.error` (no suppressing).
- Documented in `next.config.ts` that production must use `next build` + `next start` (never `next dev`).
- Production (Vercel) uses `next build` + `next start`; no dev client is loaded.

**If the error still appears:** Use an incognito/private window (extensions disabled) or disable the offending extension. The app does not load any WebSocket to localhost.

---

## 2. GET /favicon.ico 404

**Root cause:**  
- Browsers request `/favicon.ico` by default. If the app didn’t serve it, the request returned 404.

**Fixes applied:**
- **Static file:** `public/favicon.ico` is served at `/favicon.ico` when present.
- **Route fallback:** `src/app/favicon.ico/route.ts` handles GET `/favicon.ico`: tries `public/favicon.ico`, then `public/logo.png`; if both fail, returns a 1×1 PNG so the route **never returns 404**.
- **No rewrite:** Removed the rewrite from `/favicon.ico` to `/logo.png`; the route and static file are the single source of truth.
- **Metadata:** Root layout already sets `icons` including `/favicon.ico`.

**Validation:** After deploy, open https://app.inthecircle.co/favicon.ico — expect 200.

---

## 3. “Unload event listeners are deprecated and will be removed”

**Root cause:**  
- Our app used `window.addEventListener('beforeunload', ...)` for analytics session end in `AppShell.tsx` and `src/app/admin/page.tsx`.  
- Browsers are deprecating **unload** (and related) listeners; the warning can appear when such listeners are used.

**Fixes applied (no suppression):**
- Replaced **beforeunload** with **pagehide** in:
  - `src/components/AppShell.tsx` (app session end)
  - `src/app/admin/page.tsx` (admin session end)
- **pagehide** is the recommended way to run logic when the page is being hidden or terminated; it is not deprecated.
- Session end is sent via **navigator.sendBeacon** in `endSessionWithBeacon()` so the request is delivered reliably when the tab is closed (fetch with keepalive can be dropped at unload).
- **New API:** `src/lib/analytics.ts` now exports `endSessionWithBeacon(userType)` and uses an internal `flushWithBeacon()` that builds the end-session payload and sends it with `navigator.sendBeacon()`.

**Why this is correct:**
- **pagehide** fires when the tab is closed, navigated away, or hidden; it replaces unload/beforeunload for “page is going away” without triggering deprecation.
- **sendBeacon** is designed for analytics and logging on page unload; the browser queues it and sends it even as the page is torn down.
- Session end and `_end_session` still run; server-side session closure and analytics behavior are preserved.

---

## Validation checklist (Section 4)

After deploying to production:

| Check | How |
|-------|-----|
| No WebSocket localhost errors from our app | Production uses `next build` + `next start`; no dev client. If you still see it, use incognito (extension). |
| No favicon 404 | Open https://app.inthecircle.co/favicon.ico — expect 200. |
| No unload deprecation from our code | We use **pagehide** + **sendBeacon** only; no beforeunload/unload for session end. |
| Admin panel still works | Smoke-test login, tabs, and key actions. |
| Analytics/session tracking | Session end still sent via sendBeacon on pagehide; server closes session when it receives `end_session: true`. |

---

## Summary

| Issue | Root cause | Fix (strict, no hacks) |
|-------|------------|-------------------------|
| WebSocket 8081 | Extension or (if ever) `next dev` in prod | Removed console suppressor; doc that prod = next build + next start. |
| Favicon 404 | Missing or failing /favicon.ico | Route that never 404s (fallback 1×1 PNG); static file when present. |
| Unload deprecated | beforeunload in our code | Replaced with pagehide + endSessionWithBeacon (sendBeacon). |
