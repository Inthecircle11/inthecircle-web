# Web App Audit — Backend Sync & Reliability

**Date:** 2026-03-06  
**Scope:** Next.js app in `inthecircle-web` (app.inthecircle.co). Config, auth, admin API, and backend RPC alignment.

## Summary

- **Config & env:** Correct. Supabase client (browser/server/service-role) and env vars (`NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_*`) are used consistently.
- **Auth:** Auth callback and Airtable callback work with `NEXT_PUBLIC_APP_URL`; middleware and admin gate are aligned.
- **Admin API:** All admin routes use `requireAdmin` and `requirePermission`; service role is used only after auth. Fallbacks added so the app works with **existing** backend RPCs when newer ones are missing.
- **Deploy:** Production must be deployed from **`inthecircle-web`** (Next.js), not repo root (static site). README updated.

## Changes Made

### 1. Overview stats (`/api/admin/overview-stats`)

- **Issue:** Relied on `admin_get_overview_app_stats` and `admin_get_overview_counts`, which are not in current migrations.
- **Fix:** If those RPCs fail, fall back to:
  - `admin_get_application_stats()` for application counts (stats).
  - Direct `profiles` count for total users and verified count.
- **Result:** Overview tab works with current backend even without the overview-specific RPCs.

### 2. Applications list (`/api/admin/applications`)

- **Issue:** Used only `admin_get_application_counts` and `admin_get_applications_page`; when missing, returned 503 and migration SQL.
- **Fix:**
  - **Counts:** If `admin_get_application_counts` fails, use `admin_get_application_stats()` and map to the same shape.
  - **List:** If `admin_get_applications_page` fails, try in order:
    1. `admin_get_applications_filtered` (with status/filter when `filter === 'all'`).
    2. `admin_get_applications(p_limit, p_offset)` with optional client-side status filter.
    3. Existing direct `applications` table select (for assignment filters and when RPCs are unavailable).
- **Result:** Applications tab works with existing migrations; no 503 unless the backend is truly unavailable.

### 3. README

- **Fix:** Emergency deploy instructions now say to run deploy from **`inthecircle-web`** (e.g. `cd inthecircle-web && npx vercel deploy --prod` or `npm run deploy` there), not from repo root, so the Next.js app is deployed to production.

## What Was Verified (No Code Change)

- **Supabase clients:** `src/lib/supabase.ts` (browser), `src/lib/supabase-server.ts` (server), `src/lib/supabase-service.ts` (service role). All use correct env and non-null checks where needed.
- **Admin auth:** `requireAdmin()` uses `ADMIN_USER_IDS` / `ADMIN_EMAILS`, optional MFA, and role backfill; admin API routes call it and use `getServiceRoleClient()` only after auth.
- **Auth callback:** Exchanges code for session and redirects to `next` or `/feed`; error redirects to `/signup?error=auth_callback`.
- **Airtable callback:** Passes through to iOS app deep link; no Supabase dependency.
- **next.config:** `ADMIN_BASE_PATH` required in production; rewrites and cache headers for admin are correct. Image remotePatterns use Supabase host from env.
- **Middleware:** Request ID for admin routes; obscure admin path rewrite; optional IP allowlist and direct `/admin` blocking via `ADMIN_DISABLE_DIRECT_ACCESS`.

## Env Vars (Reference)

| Variable | Required | Used by |
|----------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | All Supabase clients |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Browser + server client |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes (admin) | Admin API routes |
| `ADMIN_BASE_PATH` | Yes (prod) | next.config, middleware |
| `ADMIN_USER_IDS` / `ADMIN_EMAILS` | Yes (admin) | requireAdmin |
| `NEXT_PUBLIC_APP_URL` | Yes (auth) | Auth callback redirect |

## Recommendations

1. **Vercel:** Ensure project **Root Directory** is `inthecircle-web` (or deploy only from that folder) so production always serves the Next.js app.
2. **Optional RPCs:** If you add migrations for `admin_get_overview_app_stats`, `admin_get_overview_counts`, `admin_get_application_counts`, or `admin_get_applications_page`, the app will use them automatically; fallbacks remain for compatibility.
3. **Health check:** `GET /api/health` is suitable for load balancers and monitoring; no auth.
