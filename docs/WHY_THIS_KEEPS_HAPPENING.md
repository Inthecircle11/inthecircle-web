# Why This Keeps Happening: Root Cause Summary

## The Core Problem

**You have TWO deployment models in the same repo:**

1. **Legacy static site** (files: `index.html`, `signup.html`, `admin.html`)
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

1. **The files are there** - `index.html`, `signup.html` exist in root, so it "makes sense" to use them
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

## What You Should Consider

### Option 1: Archive Legacy Files (Recommended)

Move static HTML files to `archive/legacy/` so they're not in root:

```bash
mkdir -p archive/legacy
mv index.html signup.html admin.html admin-gate.html archive/legacy/
```

**Why:** If files aren't in root, less temptation to use them in `vercel.json`.

### Option 2: Remove Legacy Files Entirely

If you're 100% sure you'll never need them:

```bash
rm index.html signup.html admin.html admin-gate.html
```

**Why:** Eliminates the source of confusion entirely.

### Option 3: Keep But Document Clearly

Add a `LEGACY_FILES.md` in root explaining:
- These are old static site files
- They are NOT used in production
- Do NOT add rewrites to serve them
- Next.js App Router owns all routes

## The Real Fix

**The 7-layer hardening is the real fix** - it prevents the mistake from reaching production. But **archiving or removing the legacy files** removes the source of confusion and makes it less likely someone will try in the first place.

## Next Steps

1. **Review:** Read `docs/ROOT_CAUSE_ANALYSIS.md` for full technical details
2. **Decide:** Archive, remove, or keep legacy files (with clear docs)
3. **Trust the hardening:** The build-time check will catch it even if someone tries
