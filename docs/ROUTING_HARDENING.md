# Routing Hardening — Multi-Layer Protection

This document explains the **7 layers of protection** that prevent routing regressions where legacy `vercel.json` rewrites shadow Next.js App Router.

## The Problem (What We Prevent)

If `vercel.json` contains rewrites like:
```json
{
  "rewrites": [
    { "source": "/", "destination": "/index.html" },
    { "source": "/signup", "destination": "/signup.html" }
  ]
}
```

Then production serves **static HTML files** instead of Next.js pages, making the app look "broken" or like an old deployment.

## The 7 Layers

### Layer 1: Pre-commit Hook
**File:** `.git/hooks/pre-commit`  
**When:** Before `git commit`  
**What:** Runs `npm run check:vercel-routing`. If it fails, **commit is blocked**.  
**Bypass:** `git commit --no-verify` (emergency only)

### Layer 2: Check Script
**File:** `scripts/check-vercel-routing.mjs`  
**When:** `npm run ci:local`, CI, pre-commit hook  
**What:** Validates `vercel.json` structure:
- No `rewrites` to `*.html` files
- No legacy `outputDirectory` or empty `buildCommand`
- No rewrites that shadow core Next.js routes (`/`, `/signup`, `/admin`, etc.)

### Layer 3: Build-Time Validation ⚠️ **CRITICAL**
**File:** `next.config.ts` (lines 3-30)  
**When:** During `npm run build`  
**What:** **Build FAILS** if `vercel.json` contains forbidden rewrites.  
**Impact:** Even if someone bypasses CI, **they cannot deploy** because the build step itself validates and throws an error.

```typescript
// This runs at build time and throws if vercel.json is bad
if (fs.existsSync(vercelPath)) {
  // ... validation logic ...
  throw new Error('BUILD FAILED: vercel.json rewrites must not point to *.html')
}
```

### Layer 4: CI Check
**File:** `.github/workflows/ci.yml`  
**When:** Every PR and push to `main`  
**What:** Runs `npm run check:vercel-routing` after typecheck (fails fast).  
**Bypass:** Requires admin override in GitHub (still blocked by Layer 3)

### Layer 5: Runtime Health Endpoint
**File:** `src/app/api/health/routing/route.ts`  
**When:** `GET /api/health/routing` (can be monitored)  
**What:** Returns 500 if routing config violates rules.  
**Use case:** Set up monitoring/alerting to ping this endpoint and alert if it returns 500.

### Layer 6: Production Smoke Test
**File:** `tests/guards/production-routing.test.ts`  
**When:** `npm run test:production-routing` (optional, requires `PRODUCTION_URL`)  
**What:** Validates production isn't serving static HTML by checking:
- Home page doesn't contain "Coming Soon" markers
- `/forgot-password` is a Next.js page, not 404
- Health endpoint reports clean config

### Layer 7: Cursor AI Rule
**File:** `.cursor/rules/vercel-next-routing.mdc`  
**When:** Always (when AI edits code)  
**What:** Warns if you try to add static rewrites in editor.

## Why Multiple Layers?

**Defense in depth:**
- **Layer 1-2:** Catch issues before commit/CI
- **Layer 3:** **Cannot be bypassed** — build fails even if CI is skipped
- **Layer 4:** Automated enforcement in CI
- **Layer 5-6:** Runtime/production validation (catches edge cases)
- **Layer 7:** AI guidance to prevent mistakes

Even if someone:
- Bypasses pre-commit hook (`--no-verify`)
- Bypasses CI branch protection
- Skips running `ci:local`

**Layer 3 (build-time check) will still fail the build**, preventing deployment.

## Testing the Protection

### Test Layer 1 (Pre-commit):
```bash
# Temporarily break vercel.json
echo '{"rewrites":[{"source":"/","destination":"/index.html"}]}' > vercel.json
git add vercel.json
git commit -m "test"  # Should be BLOCKED
# Restore: git checkout vercel.json
```

### Test Layer 2 (Script):
```bash
# Break vercel.json, then:
npm run check:vercel-routing  # Should fail
```

### Test Layer 3 (Build):
```bash
# Break vercel.json, then:
npm run build  # Should FAIL with error about vercel.json
```

### Test Layer 5 (Health Endpoint):
```bash
# After deploying, check:
curl https://app.inthecircle.co/api/health/routing
# Should return: {"status":"ok","message":"Routing config is clean"}
```

## Maintenance

- **Pre-commit hook:** Already installed. If missing, run `chmod +x .git/hooks/pre-commit`
- **Check script:** Runs automatically in CI and `ci:local`
- **Build-time check:** Always runs during `npm run build` (no maintenance needed)
- **CI:** Configured in `.github/workflows/ci.yml`
- **Health endpoint:** Deployed automatically with app
- **Smoke tests:** Optional, run manually or in separate CI job
- **Cursor rule:** Always active (no maintenance)

## Related Files

- `vercel.json` — Headers only; see `docs/VERCEL_JSON.md` (no undocumented keys — Vercel schema rejects them)
- `src/middleware.ts` — WEB_LOCKDOWN guard (separate but related)
- `DEPLOYMENT.md` — User-facing documentation
- `.git/hooks/README.md` — Git hooks documentation
