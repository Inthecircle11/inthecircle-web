# Console errors – end-to-end fix

This doc covers the errors you see in the browser console on **app.inthecircle.co** and how to fix or ignore them.

---

## 1. `GET https://app.inthecircle.co/favicon.ico 404 (Not Found)`

**Cause:** The site had no file at `/favicon.ico`, so the browser’s default request returned 404.

**Fix (done in the repo):**
- **Static file:** `public/favicon.ico` (copy of logo) is served by Next.js at `/favicon.ico`.
- **Metadata:** Root layout sets `icons.icon` and `icons.shortcut` to `/favicon.ico` so the correct `<link>` tags are emitted.
- **Route fallback:** `src/app/favicon.ico/route.ts` serves `public/logo.png` if the static file were missing.
- **Rewrite:** `next.config.ts` rewrites `/favicon.ico` → `/logo.png` as another fallback.

**What you do after deploy:**
1. Push to `main` and wait for Vercel to finish deploying (2–5 min).
2. Hard refresh: **Cmd+Shift+R** (Mac) or **Ctrl+Shift+R** (Windows), or open the site in an **incognito/private** window.
3. If you still see 404, wait 1–2 minutes (CDN cache) and try again.

---

## 2. `WebSocket connection to 'ws://localhost:8081/' failed` (refresh.js)

**Cause:** This is **not from the inthecircle-web app**. There is no reference to `refresh.js`, `8081`, `initClient`, or `addRefresh` in the repo or in `node_modules`. The script is injected by a **browser extension** (e.g. “Live Reload”, “Auto Refresh”, React/Redux DevTools, or similar) that tries to connect to a local dev server.

**Fix (what you do):**
- **Option A (recommended):** Open **app.inthecircle.co** in an **incognito/private window** (extensions are usually disabled). The WebSocket error will disappear.
- **Option B:** Disable extensions one by one, reload, and see which one removes the error; leave that extension off when using the admin panel.
- **Option C:** Ignore it. It does not affect app behavior or security; it’s just console noise from the extension.

We cannot remove or “fix” this in app code because the app does not load that script.

---

## 3. `Unload event listeners are deprecated` (frame.js)

**Cause:** Browser deprecation warning. Some script (often from the browser or an extension) uses the `unload` event, which is being phased out. It is not from the inthecircle-web codebase.

**Fix:** None required. Safe to ignore. It will go away when the underlying script is updated by the vendor.

---

## Checklist after each deploy

| Step | Action |
|------|--------|
| 1 | Push to `main` and wait for Vercel deploy to complete. |
| 2 | Open **https://app.inthecircle.co** in **incognito** (or hard refresh). |
| 3 | Check console: favicon should be **200**; WebSocket error should be **gone** in incognito. |
| 4 | If favicon still 404, wait 1–2 min and try again (cache). |

---

## Summary

| Error | Source | Fix |
|-------|--------|-----|
| Favicon 404 | App (missing file) | Fixed in repo: static file + metadata + route + rewrite. After deploy + hard refresh, it’s resolved. |
| WebSocket localhost:8081 | Browser extension | Use incognito or disable the extension; cannot be fixed in app code. |
| Unload deprecated | Browser/extension | Ignore; not from our app. |
