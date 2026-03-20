# Why This Keeps Happening: Root Cause Summary

## The Core Problem

**You have TWO deployment models in the same repo:**

1. **Legacy static site** (files: `index.html`, `signup.html`, `admin.html` — now under **`archive/legacy/`** only)
2. **Current Next.js app** (files: `src/app/page.tsx`, `src/app/signup/page.tsx`)

When someone sees the static HTML files and needs to "fix routing," they naturally add `vercel.json` rewrites to serve those files. **This shadows Next.js and breaks production.**

## The Pattern That Repeats

```
Developer needs to fix routing
  ↓
Sees static HTML files in repo (index.html, signup.html, admin.html)
  ↓
Looks up Vercel docs → finds examples with "rewrites"
  ↓
Adds to vercel.json: { "source": "/", "destination": "/index.html" }
  ↓
Commits and pushes
  ↓
Production breaks (serves static HTML instead of Next.js)
```

## Why It's So Easy to Make This Mistake

1. **The files were in repo root** — that invited `vercel.json` rewrites; they now live only in **`archive/legacy/`**
2. **Vercel docs show rewrites** - Examples use `rewrites` for routing
3. **No immediate error** - Build succeeds, deploy succeeds, but wrong content serves
4. **Confusion about architecture** - Two models exist side-by-side

## What We've Done (Hardening)

✅ **7 layers of protection** now prevent this:
- Pre-commit hook blocks bad commits
- Build-time check **fails build** if rewrites exist (cannot bypass)
- CI validates automatically
- Runtime health endpoint for monitoring
- Production smoke tests
- Cursor AI rule warns you

**Most critical:** The **build will fail** if `vercel.json` has rewrites, so even if someone bypasses everything else, they cannot deploy.

## What We Did (recommended)

**Legacy static HTML was moved to `archive/legacy/`** (not in repo root). See `archive/legacy/README.md`.

This removes the main source of confusion: files sitting next to `package.json` that looked like “the” web app.

### Option: Remove Legacy Files Entirely (stronger)

If you later want zero legacy files in the repo, delete `archive/legacy/` after confirming nothing references it.

## The Real Fix

**The 7-layer hardening is the real fix** - it prevents the mistake from reaching production. But **archiving or removing the legacy files** removes the source of confusion and makes it less likely someone will try in the first place.

## Next Steps

1. **Review:** Read `docs/ROOT_CAUSE_ANALYSIS.md` for full technical details
2. **Optional:** Delete `archive/legacy/` later if you want zero legacy HTML in the repo
3. **Trust the hardening:** The build-time check will catch it even if someone tries
