# Root Cause Analysis: Why Routing Regressions Keep Happening

## The Problem Pattern

**Symptom:** Production serves static "Coming Soon" HTML instead of Next.js app, making the webapp look broken.

**Frequency:** This has happened multiple times (not the first occurrence).

## Root Causes

### 1. **Legacy Static Site Files Still in Repo** ⚠️ PRIMARY CAUSE

**Evidence:**
- `index.html` (static "Coming Soon" page) exists in repo root
- `signup.html` (static signup form) exists in repo root  
- `admin.html`, `admin-gate.html` exist in repo root
- `auth/reset-password/index.html` exists

**Why this causes regressions:**
- When someone sees these files, they assume they should be served
- Vercel documentation examples show `rewrites` for static sites
- It's natural to add `vercel.json` rewrites to serve these files
- **The files are there, so it "makes sense" to use them**

**Git history shows:**
- Commit `5a9b9be`: "feat: move static web files from iOS project to web project root"
- Static HTML files were moved from another project into this Next.js repo
- They were kept "for reference" or "as backup" but never removed

### 2. **Confusion About Deployment Architecture**

**Two deployment models exist side-by-side:**

| Model | Files | Routing | vercel.json |
|-------|-------|---------|-------------|
| **Static Site (Legacy)** | `index.html`, `signup.html` | `rewrites` in `vercel.json` | Has `rewrites` array |
| **Next.js App Router (Current)** | `src/app/page.tsx`, `src/app/signup/page.tsx` | Next.js handles routing | No `rewrites` needed |

**When someone:**
- Needs to "fix routing"
- Looks at Vercel docs
- Sees static HTML files in repo
- **They add rewrites to vercel.json** thinking it's needed

### 3. **vercel.json Pattern Confusion**

**What happens:**
1. Developer needs to configure routing
2. Searches Vercel docs → finds examples with `rewrites`
3. Sees static HTML files in repo
4. Adds `{ "source": "/", "destination": "/index.html" }` to `vercel.json`
5. **This shadows Next.js routes** → production breaks

**Why it's tempting:**
- Vercel's own docs show `rewrites` for routing
- The static files are right there in the repo
- It "works" locally (if you test wrong URL)
- No immediate error (build succeeds, deploy succeeds, but wrong content serves)

### 4. **Lack of Clear "Don't Do This" Signals**

**Before hardening:**
- No pre-commit hook
- No build-time validation
- No clear documentation saying "DO NOT add rewrites"
- `vercel.json` had no warnings
- CI didn't check for this

**Result:** Easy to accidentally reintroduce the pattern.

### 5. **Copy-Paste from Other Projects**

**Risk scenarios:**
- Copying `vercel.json` from another static site project
- Merging configs from multiple sources
- Using Vercel dashboard to "fix" routing (which might add rewrites)
- Following tutorials for static sites (not Next.js)

## Why It Keeps Happening

### Pattern Recognition Failure

**The pattern that keeps repeating:**

```
Developer needs to fix routing
  ↓
Looks at vercel.json (sees it's "simple" or "empty")
  ↓
Searches for "vercel routing" or "vercel rewrites"
  ↓
Finds examples with rewrites to HTML files
  ↓
Sees static HTML files in repo (index.html, signup.html)
  ↓
Adds rewrites to vercel.json
  ↓
Commits and pushes
  ↓
Production breaks (serves static HTML instead of Next.js)
```

### Why Each Layer Failed (Before Hardening)

| Layer | Why It Failed |
|-------|---------------|
| **Developer awareness** | No clear docs saying "don't add rewrites" |
| **Pre-commit** | Didn't exist |
| **CI** | Didn't check vercel.json structure |
| **Build** | Didn't validate vercel.json |
| **Runtime** | No health check to detect issue |
| **Monitoring** | No alerting for routing violations |

## The Fix (7-Layer Hardening)

We've now added **7 layers** that prevent this:

1. **Pre-commit hook** - Blocks bad commits
2. **Check script** - Validates structure
3. **Build-time validation** - **Build FAILS** if bad (cannot bypass)
4. **CI check** - Automated enforcement
5. **Runtime health endpoint** - Monitoring/alerting
6. **Production smoke test** - Validates production
7. **Cursor AI rule** - AI guidance

**Most critical:** Layer 3 (build-time check) - even if someone bypasses everything else, **the build will fail** and they cannot deploy.

## Recommendations to Prevent Future Occurrences

### Immediate Actions

1. **✅ DONE:** Remove rewrites from `vercel.json` (only headers now)
2. **✅ DONE:** Add 7-layer hardening
3. **✅ DONE:** Add build-time validation (cannot be bypassed)
4. **✅ DONE:** Move legacy static HTML to `archive/legacy/` (see `archive/legacy/README.md`)

### Should Consider

5. **Add clear README in root** explaining:
   - "This is a Next.js app"
   - "Static HTML files in root are legacy/archive only"
   - "Do not add rewrites to vercel.json"

6. **Document the migration history:**
   - When did we migrate from static to Next.js?
   - Why are static files still here?
   - What's the deployment model?

### Long-Term

7. **Consider removing static HTML files entirely** if they're truly not needed
8. **Add to onboarding docs:** "This project uses Next.js App Router, not static HTML"
9. **Monitor `/api/health/routing`** endpoint for violations

## Lessons Learned

1. **Legacy files create confusion** - If you migrate from static to Next.js, remove or clearly archive old files
2. **vercel.json is a footgun** - It's easy to add rewrites that break Next.js routing
3. **Build-time validation is critical** - CI can be bypassed, but build failures cannot
4. **Multiple layers are necessary** - One check isn't enough; defense in depth works
5. **Clear documentation matters** - If the rule isn't obvious, people will break it

## Related Files

- `vercel.json` - Now has `_comment` warning
- `index.html`, `signup.html`, `admin.html` - Legacy static files (consider archiving)
- `docs/ROUTING_HARDENING.md` - Technical details of 7-layer protection
- `DEPLOYMENT.md` - User-facing prevention guide
