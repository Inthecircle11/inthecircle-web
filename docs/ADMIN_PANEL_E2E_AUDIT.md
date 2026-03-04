# Admin Panel — End-to-End Audit

**Date:** 2026-03-04  
**Scope:** Entry points, routing, auth, gate, all tabs and their APIs, and “likely broken or risky” items.  
**Goal:** Single reference for E2E behavior and fixes applied.

---

## 1. Entry points and routing

| Item | Location | Notes |
|------|----------|------|
| **Admin UI** | `/admin` | `src/app/admin/page.tsx` — single-page tabbed UI. |
| **Layout** | `src/app/admin/layout.tsx` | Wraps admin routes; shows build version in footer. |
| **Login** | `/admin/login` | `src/app/admin/login/page.tsx` — Supabase `signInWithPassword()`, then redirect to `/admin`. |
| **Middleware** | `src/middleware.ts` | Protects `/admin` (and `/admin/login`); redirects unauthenticated to login. |
| **Next config** | `next.config.ts` | Rewrites for API if needed; no rewrite that bypasses admin. |
| **Gate API** | `GET/POST /api/admin/gate` | Optional gate when `ADMIN_GATE_PASSWORD` is set. |

---

## 2. Auth and gate flow

1. **Gate (optional)**  
   - On load, `GET /api/admin/gate`. If env has no `ADMIN_GATE_PASSWORD`, API returns `{ unlocked: true }` and user proceeds.  
   - If gate is configured, user must pass the gate form (POST password).  
   - **Fix applied:** On gate **timeout** (10s) or **fetch error**, the panel no longer unlocks. It shows the gate form with an error: “Gate check timed out…” or “Could not reach gate…”. User can retry by submitting the password when the API is back.

2. **Admin check**  
   - After gate (or when no gate), `checkAdminAccess()` runs: Supabase `getUser()` then `GET /api/admin/check`.  
   - `check` uses `ensureAdminSessionAndTouch()` (admin role + allowlist).  
   - 401 → “Session expired. Please log in again.”; not allowlisted → error message (prefer generic copy to avoid disclosing `ADMIN_EMAILS` / `ADMIN_USER_IDS`).

3. **Session governance**  
   - Admin API routes use `requireAdmin()` or `ensureAdminSessionAndTouch()` from `src/lib/admin-auth.ts`.

---

## 3. Tabs and APIs

| Tab | Main data source | Notes |
|-----|------------------|--------|
| **Overview** | `/api/admin/overview-stats`, `/api/admin/active-today`, `/api/admin/active-sessions` | Dashboard stats. |
| **Dashboard** | Same as Overview + analytics/overview | Charts and counts. |
| **Applications** | `/api/admin/applications`, bulk, claim/release, action | Pagination, filters, actions. |
| **Users** | `/api/admin/users` | Capped at 500; no pagination. |
| **Verifications** | `/api/admin/verification-requests`, verification-activity | Verification queue. |
| **Inbox** | **Direct Supabase** (`message_threads`, `messages`, `profiles`) | No `/api/admin/inbox`; relies on RLS; no server-side audit/pagination. |
| **Reports** | `/api/admin/reports`, claim/release | Moderation reports. |
| **Data requests** | `/api/admin/data-requests` | Status updates; on success, `loadDataRequests()` clears error. |
| **Risk** | `/api/admin/risk` | Risk signals. |
| **Approvals** | `/api/admin/approvals` | Approve/reject. |
| **Audit log** | `/api/admin/audit` | `actionParam` in ILIKE (e.g. `_` not escaped; admin-only, low impact). |
| **Compliance** | `/api/admin/compliance/*` | Controls, evidence, health, governance. |
| **Settings** | `/api/admin/config` | PATCH for config. |
| **Product analytics** | Analytics APIs | Feature usage, tab usage, etc. |

---

## 4. Issues identified and status

| Issue | Severity | Status |
|-------|----------|--------|
| **Gate bypass on timeout/error** | High | **Fixed.** Timeout or fetch error now shows gate form + error instead of unlocking. |
| **Duplicate gate/auth logic** | Medium | **Open.** Page implements gate and auth inline; `useGate` and `useAdminAuth` are unused. Either refactor page to use these hooks or remove/deprecate them. |
| **Inbox: no admin API** | Medium | **Open.** Direct Supabase from client. Consider `/api/admin/inbox` for auditability and pagination, or document RLS and limits. |
| **Identity endpoint unauthenticated** | Low | **Fixed.** GET /api/admin/identity now requires admin auth; identity check runs only when `authorized` so UI still shows wrong-deployment banner after login. |
| **Users list: 500 cap, no pagination** | Medium | **Fixed.** GET /api/admin/users supports `?page=1&limit=50` (max 500); frontend has usersPage, loadUsers(usersPage), and UsersTab pagination (Previous/Next). |
| **Audit route: `_` in ILIKE** | Low | **Fixed.** `actionParam` now escapes both `%` and `_` for Postgres ILIKE. |
| **Duplicate/backup files** | Low | **Fixed.** Removed duplicate admin files (`* 2.tsx`, `* 2.ts`, etc.) under `src/app/admin`. |
| **Login error discloses env vars** | Medium | **Open.** Message mentions `ADMIN_EMAILS`/`ADMIN_USER_IDS`; use generic “not authorized” copy. |
| **Bulk actions use confirm/prompt** | Medium | **Open.** Replace with in-app modal and reason field for accessibility and UX. |

---

## 5. API routes (reference)

All under `src/app/api/admin/`:

- **Auth / gate:** `gate`, `check`, `config`
- **Stats / overview:** `overview-stats`, `active-today`, `active-sessions`, `analytics/overview`
- **Entities:** `users`, `users/[id]`, `applications`, `applications/[id]/action`, `claim`, `release`, `bulk-applications`
- **Moderation:** `reports`, `reports/[id]/claim`, `reports/[id]/release`, `approvals`, `approvals/[id]/approve`, `approvals/[id]/reject`
- **Verification:** `verification-requests`, `verification-requests/[id]/reject`, `verification-activity`
- **Data / compliance:** `data-requests`, `compliance/*`, `audit`, `audit/snapshot`, `audit/verify`, `audit/repair-chain`
- **Risk / config:** `risk`, `blocked-users`, `escalations/[id]/resolve`, `sessions`, `sessions/[id]/revoke`
- **Admin users:** `admin-users`, `admin-users/[id]/assign-role`, `admin-users/[id]/remove-role`, `roles`
- **Other:** `announce`, `identity`, `delete-user`, `anonymize-user`, `export-user`, `users/[id]/ban`, `users/[id]/verification`, etc.

---

## 6. Related docs

- **Comprehensive audit (UI, UX, frontend, backend, security):** `docs/ADMIN_PANEL_COMPREHENSIVE_AUDIT.md`
- **Forensic audit:** `docs/ADMIN_PANEL_FORENSIC_AUDIT.md`
- **Behavior / analytics:** `docs/BEHAVIOR_INTELLIGENCE_AUDIT.md`
