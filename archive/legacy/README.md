# Legacy static HTML (archived)

These files are **not used in production**. The live app is **Next.js** (`src/app/**`). They were kept here only as historical reference after the pre-Next static web bundle was moved from the iOS repo.

**Do not:**

- Move these back to the repository root
- Add `vercel.json` `rewrites` that point to these files (that shadows the Next.js app and breaks `app.inthecircle.co`)

**See:** `docs/DEPLOYMENT.md`, `docs/ROUTING_HARDENING.md`, `docs/ROOT_CAUSE_ANALYSIS.md`

| File | Former role |
|------|-------------|
| `index.html` | Static “Coming Soon” landing |
| `signup.html` | Standalone signup page |
| `admin.html` / `admin-gate.html` | Pre-Next admin shell |
| `auth/reset-password/index.html` | Static password reset page |

Production routing is handled by Next.js App Router (`/`, `/signup`, `/admin`, `/update-password`, etc.).
