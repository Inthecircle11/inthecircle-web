# Admin Panel — Structural Technical Audit

**Purpose:** Document the current Admin Panel system as it exists in the codebase. No recommendations, no redesign, no optimization—structural analysis only.

**Date:** 2026-03-02

---

## 1. Executive Summary

The Admin Panel is a single-page application (SPA) at `/admin` (or an optional obscure path when `ADMIN_BASE_PATH` is set). Access is gated by: (1) optional gate password (`ADMIN_GATE_PASSWORD`), (2) Supabase auth session, (3) server-side allowlist (`ADMIN_USER_IDS` / `ADMIN_EMAILS`), (4) optional MFA (`ADMIN_REQUIRE_MFA`), and (5) RBAC roles stored in `admin_roles` / `admin_user_roles`. All admin API routes live under `/api/admin/*` and use `requireAdmin()` plus permission checks. The UI is one large client component (`src/app/admin/page.tsx`) with 14 tabs (Overview, Dashboard, Applications, Users, Verifications, Inbox, Reports, Data Requests, Risk, Approvals, Audit, Compliance, Settings). Data flows from frontend fetch calls to Next.js API routes, which use Supabase service role or RPCs. Database access is via Supabase (PostgreSQL); admin-specific tables include `admin_audit_log`, `admin_roles`, `admin_user_roles`, `admin_sessions`, `admin_escalations`, `admin_approval_requests`, `admin_control_health`, `admin_control_framework_mapping`, `admin_control_evidence`, `admin_governance_reviews`, `admin_audit_snapshots`, `admin_idempotency_keys`. Audit logging is implemented (tamper-evident chain, snapshots, repair RPC). There is no middleware file active in the repo (`middleware.ts` is absent; `middleware.ts.bak` exists with obscure-path and request-id logic). No in-app link to admin exists; access is by URL only. Metrics are limited to build fingerprint logging and optional cache headers; no dedicated usage/analytics or audit-UI event tracking.

---

## 2. Architecture Overview

### 2.1 High-Level Architecture (Text Diagram)

```
[Browser]
    |
    | GET /admin or /{ADMIN_BASE_PATH}
    v
[Next.js App Router]
    |
    +-- src/app/layout.tsx (reads x-admin-base-path header, passes to AppShell)
    +-- src/app/admin/layout.tsx (metadata, build fingerprint, BuildVersionLog)
    +-- src/app/admin/page.tsx (single SPA: gate → login → tabs)
    +-- src/app/admin/login/page.tsx (redirects to getAdminBase())
    |
    | API calls with credentials: 'include'
    v
[Next.js API Routes]  /api/admin/*
    |
    | requireAdmin(req) → createServerSupabaseClient(), getAdminRoles(), ensureAdminSessionAndTouch()
    | requirePermission(result, permission) or requireRole(result, roles)
    v
[Supabase]
    |
    +-- auth.users (session, MFA amr)
    +-- public.* tables (applications, profiles, user_reports, data_requests, etc.)
    +-- admin_* tables (audit, roles, sessions, escalations, approvals, control_health, etc.)
    +-- RPCs: admin_get_all_stats, admin_get_overview_counts, admin_get_overview_app_stats,
    |         admin_get_application_counts, admin_get_applications_fast, get_active_sessions,
    |         admin_application_action_v2, admin_repair_audit_chain, etc.
    v
[PostgreSQL]
```

### 2.2 Component Structure

- **Pages:**  
  - `src/app/admin/page.tsx` — single admin SPA (~6000+ lines): gate form, inline login form, sidebar, tab content (Overview, Dashboard, Applications, Users, Verifications, Inbox, Reports, Data Requests, Risk, Approvals, Audit, Compliance, Settings).  
  - `src/app/admin/login/page.tsx` — client redirect to `getAdminBase()`.  
  - `src/app/admin/layout.tsx` — server layout: metadata (noindex, nofollow), build fingerprint in footer, `<BuildVersionLog />`.

- **Admin-specific components:**  
  - `src/app/admin/BuildVersionLog.tsx` — client component; logs build version to console in production.

- **Shared:**  
  - `src/components/AppShell.tsx` — wraps all app content; receives `adminBasePath` from root layout; treats `/admin` and obscure path as admin routes (no redirect to signup, nav hidden on admin).  
  - `src/components/Logo.tsx` — used on admin page.  
  - No dedicated admin subfolder of reusable components; all tab UI lives inside `page.tsx`.

### 2.3 State Management

- **Method:** React `useState` / `useCallback` / `useRef` only. No Redux, Zustand, or global admin store.
- **Data:** Fetched on mount and on tab switch via `fetch('/api/admin/...')`; results stored in component state (e.g. `stats`, `applications`, `users`, `reports`, `overviewCounts`). Real-time: Supabase Realtime subscriptions on `applications`, `profiles`, `verification_requests`, `messages`, `message_threads` when authorized; handlers call `loadData()` or `loadInbox()`.

### 2.4 Caching

- **Server-side (API):**  
  - `overview-stats`: in-memory cache TTL 60s; response header `X-Cache: HIT|MISS`.  
  - `applications`: counts cache 60s; per-status+page list cache 30s; max 20 cache entries, oldest evicted.  
- **Client:** No explicit HTTP cache; `next.config.ts` sets `Cache-Control: no-store, no-cache, must-revalidate, max-age=0` for `/admin` and `/{ADMIN_BASE_PATH}`.

### 2.5 Dependency Mapping

- **Admin UI depends on:** `@/lib/admin` (getAdminBase), `@/lib/admin-rbac` (hasPermission, ADMIN_PERMISSIONS, Tab→permission map), `@/lib/supabase` (createClient for auth and Realtime).  
- **Admin API routes depend on:** `@/lib/admin-auth` (requireAdmin, requirePermission, requireRole), `@/lib/admin-rbac` (ADMIN_PERMISSIONS, hasPermission), `@/lib/supabase-server` (createServerSupabaseClient), `@/lib/supabase-service` (getServiceRoleClient), `@/lib/audit-server` (writeAuditLog, validateReasonForDestructive, checkDestructiveRateLimit), `@/lib/admin-sessions` (ensureAdminSessionAndTouch), `@/lib/admin-approval` (requiresApproval, createApprovalRequest, executeApprovedAction), `@/lib/admin-idempotency`, `@/lib/admin-bulk-rate-limit`, `@/lib/admin-snapshot-rate-limit`, `@/lib/control-health`, `@/lib/compliance-evidence`, `@/lib/audit-verify`, `@/lib/request-id` (where used).

---

## 3. Section 1 — Entry Points

### 3.1 Files Related to Admin Functionality

| Category | Path |
|----------|------|
| **UI** | `src/app/admin/page.tsx`, `src/app/admin/layout.tsx`, `src/app/admin/login/page.tsx`, `src/app/admin/BuildVersionLog.tsx` |
| **API routes** | `src/app/api/admin/check/route.ts`, `src/app/api/admin/gate/route.ts`, `src/app/api/admin/identity/route.ts`, `src/app/api/admin/overview-stats/route.ts`, `src/app/api/admin/applications/route.ts`, `src/app/api/admin/applications/[id]/action/route.ts`, `src/app/api/admin/applications/[id]/claim/route.ts`, `src/app/api/admin/applications/[id]/release/route.ts`, `src/app/api/admin/active-sessions/route.ts`, `src/app/api/admin/reports/route.ts`, `src/app/api/admin/reports/[id]/claim/route.ts`, `src/app/api/admin/reports/[id]/release/route.ts`, `src/app/api/admin/data-requests/route.ts`, `src/app/api/admin/config/route.ts`, `src/app/api/admin/risk/route.ts`, `src/app/api/admin/approvals/route.ts`, `src/app/api/admin/approvals/[id]/approve/route.ts`, `src/app/api/admin/approvals/[id]/reject/route.ts`, `src/app/api/admin/blocked-users/route.ts`, `src/app/api/admin/audit/route.ts`, `src/app/api/admin/audit/verify/route.ts`, `src/app/api/admin/audit/snapshot/route.ts`, `src/app/api/admin/audit/repair-chain/route.ts`, `src/app/api/admin/compliance/controls/route.ts`, `src/app/api/admin/compliance/evidence/route.ts`, `src/app/api/admin/compliance/evidence/generate/route.ts`, `src/app/api/admin/compliance/governance-reviews/route.ts`, `src/app/api/admin/compliance/health/route.ts`, `src/app/api/admin/compliance/health/run/route.ts`, `src/app/api/admin/bulk-applications/route.ts`, `src/app/api/admin/delete-user/route.ts`, `src/app/api/admin/export-user/route.ts`, `src/app/api/admin/anonymize-user/route.ts`, `src/app/api/admin/escalations/[id]/resolve/route.ts`, `src/app/api/admin/announce/route.ts`, `src/app/api/admin/admin-users/route.ts`, `src/app/api/admin/admin-users/[id]/assign-role/route.ts`, `src/app/api/admin/admin-users/[id]/remove-role/route.ts`, `src/app/api/admin/roles/route.ts`, `src/app/api/admin/sessions/route.ts`, `src/app/api/admin/sessions/[id]/revoke/route.ts` |
| **Libraries** | `src/lib/admin.ts`, `src/lib/admin-auth.ts`, `src/lib/admin-rbac.ts`, `src/lib/admin-sessions.ts`, `src/lib/admin-approval.ts`, `src/lib/admin-idempotency.ts`, `src/lib/admin-bulk-rate-limit.ts`, `src/lib/admin-snapshot-rate-limit.ts`, `src/lib/audit-server.ts`, `src/lib/audit-verify.ts`, `src/lib/control-health.ts`, `src/lib/compliance-evidence.ts`, `src/lib/supabase-service.ts` (used by admin APIs) |
| **Config** | `next.config.ts` (admin cache headers, rewrites for ADMIN_BASE_PATH), `public/robots.txt` (Disallow /admin), `.env.example` (ADMIN_* vars), `.cursor/rules/admin-panel.mdc` |
| **Middleware** | `src/middleware.ts` — **not present**. `src/middleware.ts.bak` contains logic for x-request-id, ADMIN_BASE_PATH rewrite, ADMIN_ALLOWED_IPS, ADMIN_ALLOW_DIRECT_ACCESS. |
| **Root layout** | `src/app/layout.tsx` — reads `headers().get('x-admin-base-path')`, passes to `AppShell` as `adminBasePath`. |
| **AppShell** | `src/components/AppShell.tsx` — uses `getAdminBase()`, detects admin route, hides nav on admin. |

### 3.2 How a User Becomes an Admin

1. **Allowlist:** User's Supabase `auth.users` id or email must be in env: `ADMIN_USER_IDS` or `ADMIN_EMAILS` (comma-separated, server-side only).  
2. **Optional MFA:** If `ADMIN_REQUIRE_MFA === 'true'`, session must include `amr` containing `mfa` or `otp` (from JWT).  
3. **Roles:** Roles are loaded from `admin_user_roles` joined to `admin_roles`. If the user has no rows, `admin-auth` backfills a `super_admin` role for that user (idempotent) and re-reads roles; if still none, roles default to `['super_admin']` for that request.  
4. **Gate (optional):** If `ADMIN_GATE_PASSWORD` is set, user must POST correct password to `/api/admin/gate`; cookie `admin_gate=1` (24h) marks gate as passed.

### 3.3 Where Admin Access Is Checked

- **API (every route):** `requireAdmin(req)` in `src/lib/admin-auth.ts`. It: creates server Supabase client, gets user from `supabase.auth.getUser()`, checks allowlist, optionally MFA, loads roles (with backfill), and if `req` is passed calls `ensureAdminSessionAndTouch(req, supabase, user)` (session governance, revocation check). Returns 401 if not authenticated, 403 if not allowlisted or MFA missing, or 401 if session revoked.  
- **Permission/role:** After `requireAdmin`, routes call `requirePermission(result, permission)` or `requireRole(result, roles)` from `admin-auth` (uses `admin-rbac` `hasPermission`).  
- **UI:** Client calls `GET /api/admin/check`; if `authorized` and `roles` returned, tabs are shown/hidden via `TAB_PERMISSION` and `hasPermission(adminRoles, TAB_PERMISSION[tab])`. No route-level guard in Next.js for `/admin` (page renders for anyone; content and API calls enforce access).

### 3.4 Admin Routes / Screens

| Route | Description |
|-------|-------------|
| `/admin` | Single entry: gate (if configured) → inline login (if not signed in) → main panel with sidebar and tabs. |
| `/admin/login` | Redirects to `getAdminBase()` (i.e. `/admin` or obscure path). |

There are no separate Next.js routes for each tab; all are the same `/admin` page with `activeTab` state.

### 3.5 How Admin Panel Is Accessed

- **URL:** Direct navigation to `https://<domain>/admin` or, when `ADMIN_BASE_PATH` is set, to `https://<domain>/{ADMIN_BASE_PATH}`. Build-time rewrites in `next.config.ts` map the obscure path to `/admin`.  
- **No in-app link:** The main app (AppShell/Navigation) does not render a link to admin; docs state the main app does not link to the admin panel.  
- **Discovery:** Only by knowing the URL (or obscure path); `robots.txt` disallows `/admin` and `/admin/`.  
- **Middleware:** With current repo state, `middleware.ts` is missing. The `.bak` file would, when active, add x-request-id for `/api/admin/*`, rewrite obscure path to `/admin`, enforce ADMIN_ALLOWED_IPS for that path, and return 404 for direct `/admin` when ADMIN_BASE_PATH is set (unless ADMIN_ALLOW_DIRECT_ACCESS=true).

---

## 4. Section 2 — Admin Features Inventory

| Feature | File Location | What It Does | Data Read | Data Written | External APIs | DB Tables Affected | Permissions |
|--------|----------------|--------------|-----------|--------------|---------------|-------------------|-------------|
| **Gate** | `api/admin/gate` | GET: returns whether gate cookie set. POST: validate password, set cookie. | — | Cookie `admin_gate` | — | — | None (no auth) |
| **Check** | `api/admin/check` | Returns authorized, roles, sessionId. | auth.users, admin_user_roles, admin_roles, admin_sessions | admin_sessions (touch last_seen, insert if new) | — | admin_user_roles, admin_roles, admin_sessions | Allowlist + MFA |
| **Identity** | `api/admin/identity` | Returns app name (inthecircle-web). | — | — | — | — | None |
| **Overview stats** | `api/admin/overview-stats` | GET: stats, activeToday, activeSessions, overviewCounts (cached 60s). | RPC admin_get_all_stats, get_active_sessions, profiles | — | — | (RPCs read applications, auth.users, profiles, message_threads, messages, verification_requests) | read_applications; active_sessions for activeSessions |
| **Applications list** | `api/admin/applications` | GET: paginated list, counts (cached). | admin_get_application_counts, admin_get_applications_fast | — | — | applications, profiles (via RPC) | read_applications |
| **Application action** | `api/admin/applications/[id]/action` | POST: approve/reject/waitlist/suspend. | applications (updated_at) | applications (status, updated_at) | — | applications | mutate_applications |
| **Application claim** | `api/admin/applications/[id]/claim` | POST: assign to current admin with expiry. | applications | applications (assigned_to, assigned_at, assignment_expires_at) | — | applications | mutate_applications |
| **Application release** | `api/admin/applications/[id]/release` | POST: clear assignment. | applications | applications (assigned_to, etc.) | — | applications | mutate_applications |
| **Bulk applications** | `api/admin/bulk-applications` | POST: bulk reject/suspend; idempotency; optional approval flow. | admin_approval_requests, applications | applications, admin_audit_log, admin_approval_requests, admin_idempotency_keys | — | applications, admin_audit_log, admin_approval_requests, admin_idempotency_keys | bulk_applications |
| **Active sessions** | `api/admin/active-sessions` | GET: users with session in last N minutes. | get_active_sessions RPC, profiles | — | — | auth.sessions, auth.users, profiles | active_sessions |
| **Reports** | `api/admin/reports` | GET: list user_reports; POST: resolve/dismiss (body). | user_reports, profiles | user_reports (status, reviewed_by, reviewed_at, notes, assigned_*) | — | user_reports | read_reports; resolve_reports for mutate |
| **Report claim/release** | `api/admin/reports/[id]/claim`, `release` | POST: assign report to current admin / release. | user_reports | user_reports (assigned_*) | — | user_reports | resolve_reports |
| **Data requests** | `api/admin/data-requests` | GET: list; PATCH: update status (with updated_at conflict check). | data_requests | data_requests (status, updated_at) | — | data_requests | read_data_requests; update_data_requests |
| **Config** | `api/admin/config` | GET: app_config key-value; PATCH: update keys. | app_config | app_config | — | app_config | read_config; manage_config |
| **Risk** | `api/admin/risk` | GET: open escalations, KPIs. | admin_escalations | — | — | admin_escalations | read_risk |
| **Escalation resolve** | `api/admin/escalations/[id]/resolve` | POST: mark escalation resolved. | admin_escalations | admin_escalations (status, resolved_at, assigned_to, notes) | — | admin_escalations | resolve_escalations |
| **Approvals** | `api/admin/approvals` | GET: list approval requests (filter by status). | admin_approval_requests | — | — | admin_approval_requests | approve_approval (and request_approval for creation elsewhere) |
| **Approve/Reject approval** | `api/admin/approvals/[id]/approve`, `reject` | POST: set status approved/rejected, execute action if approve. | admin_approval_requests | admin_approval_requests, applications/profiles (via executeApprovedAction) | — | admin_approval_requests, applications, profiles | approve_approval |
| **Blocked users** | `api/admin/blocked-users` | GET: list blocked_users with profile names. | blocked_users, profiles | — | — | blocked_users, profiles | read_blocked_users |
| **Audit log** | `api/admin/audit` | GET: list/export CSV; POST: append entry (with reason/rate limit for destructive). | admin_audit_log | admin_audit_log | — | admin_audit_log | read_audit; export_audit for CSV |
| **Audit verify** | `api/admin/audit/verify` | GET: verify tamper-evident chain. | admin_audit_log | — | — | admin_audit_log | read_audit |
| **Audit snapshot** | `api/admin/audit/snapshot` | POST: create daily snapshot (rate-limited). | admin_audit_log, admin_audit_snapshots | admin_audit_snapshots | — | admin_audit_snapshots | read_audit (and snapshot rate limit) |
| **Audit repair chain** | `api/admin/audit/repair-chain` | POST: recompute hash chain. | admin_audit_log | admin_audit_log (previous_hash, row_hash) | — | admin_audit_log | read_audit |
| **Compliance controls** | `api/admin/compliance/controls` | GET: framework mapping. | admin_control_framework_mapping | — | — | admin_control_framework_mapping | read_audit |
| **Compliance evidence** | `api/admin/compliance/evidence` | GET: list; POST generate: create evidence record. | admin_control_evidence, admin_audit_log, etc. | admin_control_evidence | — | admin_control_evidence | read_audit |
| **Compliance governance reviews** | `api/admin/compliance/governance-reviews` | GET: list; POST: create review. | admin_governance_reviews | admin_governance_reviews | — | admin_governance_reviews | read_audit |
| **Compliance health** | `api/admin/compliance/health` | GET: control health status; POST run: run checks, upsert admin_control_health. | admin_control_health, admin_user_roles, admin_audit_log, admin_escalations, admin_sessions, data_requests, admin_governance_reviews | admin_control_health, admin_escalations | — | admin_control_health, admin_escalations, admin_governance_reviews | read_audit |
| **Delete user** | `api/admin/delete-user` | POST: delete user (RPC/admin logic); approval flow when enabled. | admin_approval_requests, applications | auth/users (via RPC), profiles, admin_audit_log, admin_approval_requests | — | applications, profiles, admin_audit_log, admin_approval_requests | delete_users |
| **Export user** | `api/admin/export-user` | GET: export user data (GDPR). | profiles, auth.users, applications, etc. | — | — | profiles, auth.users, applications (read) | export_user |
| **Anonymize user** | `api/admin/anonymize-user` | POST: anonymize profile; approval when enabled. | profiles, admin_approval_requests | profiles, admin_audit_log, admin_approval_requests | — | profiles, admin_audit_log, admin_approval_requests | anonymize_users |
| **Announce** | `api/admin/announce` | POST: queue announce (payload); no provider wired in code. | — | — | — | — | announce |
| **Admin users** | `api/admin/admin-users` | GET: list admin users with roles. | admin_user_roles, admin_roles, auth.users | — | — | admin_user_roles, admin_roles, auth.users | manage_roles |
| **Assign role** | `api/admin/admin-users/[id]/assign-role` | POST: add role to admin. | admin_roles, admin_user_roles | admin_user_roles | — | admin_user_roles | manage_roles |
| **Remove role** | `api/admin/admin-users/[id]/remove-role` | DELETE: remove role. | admin_user_roles | admin_user_roles | — | admin_user_roles | manage_roles |
| **Roles** | `api/admin/roles` | GET: list roles. | admin_roles | — | — | admin_roles | manage_roles |
| **Sessions** | `api/admin/sessions` | GET: list admin sessions. | admin_sessions | — | — | admin_sessions | active_sessions |
| **Revoke session** | `api/admin/sessions/[id]/revoke` | POST: revoke admin session. | admin_sessions | admin_sessions (revoked_at, is_active) | — | admin_sessions | active_sessions |

---

## 5. Section 3 — Data Flow

### 5.1 Frontend → Backend → Database

1. **Auth:** Browser has Supabase session (cookie). Requests to `/api/admin/*` use `credentials: 'include'`.  
2. **API:** Each route calls `requireAdmin(req)` which uses `createServerSupabaseClient()` (server-side Supabase client with user context), then `getUser()` / `getSession()`, allowlist check, MFA check, `getAdminRoles(supabase, user.id)` from `admin_user_roles` + `admin_roles`, and `ensureAdminSessionAndTouch(req, ...)` which uses **service role** to read/update `admin_sessions`.  
3. **Data reads:** Most reads use `getServiceRoleClient()` (bypasses RLS) or RPCs (SECURITY DEFINER).  
4. **Data writes:** Service role client or RPCs; `writeAuditLog` inserts into `admin_audit_log` (and is used by many mutation routes).

### 5.2 API Endpoints Used by Admin Panel

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | /api/admin/identity | Deployment identity |
| GET/POST | /api/admin/gate | Gate unlock check / submit |
| GET | /api/admin/check | Auth + roles + sessionId |
| GET | /api/admin/overview-stats | Dashboard stats + overview + active sessions |
| GET | /api/admin/applications | List applications (paginated) + counts |
| POST | /api/admin/applications/[id]/action | approve | reject | waitlist | suspend |
| POST | /api/admin/applications/[id]/claim | Assign to me |
| POST | /api/admin/applications/[id]/release | Release assignment |
| POST | /api/admin/bulk-applications | Bulk reject/suspend |
| GET | /api/admin/active-sessions | Active user sessions (15 min) |
| GET | /api/admin/reports | List reports |
| POST | /api/admin/reports (body) | Resolve/dismiss |
| POST | /api/admin/reports/[id]/claim | Claim report |
| POST | /api/admin/reports/[id]/release | Release report |
| GET | /api/admin/data-requests | List data requests |
| PATCH | /api/admin/data-requests | Update status |
| GET | /api/admin/config | Get app_config |
| PATCH | /api/admin/config | Update app_config |
| GET | /api/admin/risk | Escalations + KPIs |
| POST | /api/admin/escalations/[id]/resolve | Resolve escalation |
| GET | /api/admin/approvals | List approval requests |
| POST | /api/admin/approvals/[id]/approve | Approve and execute |
| POST | /api/admin/approvals/[id]/reject | Reject |
| GET | /api/admin/blocked-users | List blocked_users |
| GET | /api/admin/audit | List audit log (JSON or CSV) |
| POST | /api/admin/audit | Append audit entry |
| GET | /api/admin/audit/verify | Verify chain |
| POST | /api/admin/audit/snapshot | Create snapshot |
| POST | /api/admin/audit/repair-chain | Repair hash chain |
| GET | /api/admin/compliance/controls | Framework mapping |
| GET/POST | /api/admin/compliance/evidence | List / generate |
| GET/POST | /api/admin/compliance/governance-reviews | List / create |
| GET | /api/admin/compliance/health | Control health |
| POST | /api/admin/compliance/health/run | Run health checks |
| POST | /api/admin/delete-user | Delete user |
| GET | /api/admin/export-user | Export user data |
| POST | /api/admin/anonymize-user | Anonymize user |
| POST | /api/admin/announce | Announce (stub) |
| GET | /api/admin/admin-users | List admin users + roles |
| POST | /api/admin/admin-users/[id]/assign-role | Assign role |
| DELETE | /api/admin/admin-users/[id]/remove-role | Remove role |
| GET | /api/admin/roles | List roles |
| GET | /api/admin/sessions | List admin sessions |
| POST | /api/admin/sessions/[id]/revoke | Revoke session |

### 5.3 Request/Response (Representative)

- **GET /api/admin/check:** No body. Response: `{ authorized: true, roles: string[], sessionId?: string }` or 401/403.  
- **GET /api/admin/overview-stats:** No body. Response: `{ stats: { total, pending, approved, rejected, waitlisted, suspended }, activeToday, activeSessions: { count, users, minutes } | null, overviewCounts: { totalUsers, verifiedCount, newUsersLast24h, newUsersLast30d, totalThreadCount, totalMessageCount, applicationsSubmittedLast7d, applicationsApprovedLast7d } }`.  
- **POST /api/admin/applications/[id]/action:** Body: `{ action: 'approve'|'reject'|'waitlist'|'suspend', updated_at?: string }`. Response: `{ ok: true }` or 409 (CONFLICT) or 4xx/5xx.  
- **GET /api/admin/audit:** Query: `format=json|csv`, `admin_user_id`, `action`, `target_type`, `target_id`, `date_from`, `date_to`, `limit`, `offset`. Response: JSON `{ entries }` or CSV attachment.

### 5.4 Authentication Method

- **Session:** Supabase Auth (cookie-based). Server uses `createServerSupabaseClient()` to read session and user.  
- **Gate:** Optional; cookie `admin_gate=1` (httpOnly, 24h) set by POST /api/admin/gate.

### 5.5 Role Validation Logic

- **admin-rbac.ts:** Roles: viewer, moderator, supervisor, compliance, super_admin. Each role has a fixed set of permissions (e.g. viewer: read_* only; super_admin: all). `hasPermission(roleNames, permission)` returns true if any role has that permission.  
- **API:** After `requireAdmin()`, routes call `requirePermission(result, ADMIN_PERMISSIONS.<x>)` or `requireRole(result, [...])`; 403 if missing.

---

## 6. Section 4 — Database Structure

### 6.1 Tables Admin Panel Interacts With

**Admin-specific tables (created in migrations):**

| Table | Columns | Data Types | Indexes | Relationships | Triggers | RLS |
|-------|---------|------------|---------|---------------|----------|-----|
| **admin_audit_log** | id, admin_user_id, admin_email, action, target_type, target_id, details, created_at, reason, client_ip, session_id, previous_hash, row_hash | uuid, text, text, timestamptz, jsonb | created_at DESC, action, (target_type, target_id), (admin_user_id, created_at), session_id, created_at ASC | admin_user_id → auth.users | BEFORE INSERT set previous_hash; AFTER INSERT set row_hash | SELECT/INSERT for authenticated |
| **admin_roles** | id, name, description, created_at | uuid, text, timestamptz | name UNIQUE | — | — | SELECT authenticated; ALL service_role |
| **admin_user_roles** | admin_user_id, role_id, assigned_at | uuid, uuid, timestamptz, PK(admin_user_id, role_id) | admin_user_id, role_id | admin_user_id → auth.users, role_id → admin_roles | — | SELECT own; ALL service_role |
| **admin_sessions** | id, admin_user_id, session_id, ip_address, user_agent, country, city, created_at, last_seen_at, revoked_at, is_active | uuid, uuid, text, text, timestamptz, boolean | (admin_user_id, created_at DESC), is_active partial, session_id UNIQUE | admin_user_id → auth.users | BEFORE DELETE forbid | service_role only |
| **admin_escalations** | id, metric_name, metric_value, threshold_level, status, created_at, resolved_at, assigned_to, notes | uuid, text, numeric, text, text, timestamptz | (status, created_at), (metric_name, created_at) | assigned_to → auth.users | — | service_role only |
| **admin_approval_requests** | id, action, target_type, target_id, payload, requested_by, requested_at, status, approved_by, approved_at, rejected_by, rejected_at, reason, expires_at | uuid, text, jsonb, uuid, timestamptz, text | (status, requested_at), requested_by, expires_at | requested_by, approved_by, rejected_by → auth.users | — | service_role only |
| **admin_control_health** | id, control_code, status, last_checked_at, notes, score | uuid, text, text, timestamptz, integer | control_code UNIQUE | — | — | service_role only |
| **admin_control_framework_mapping** | id, framework, control_code, control_description, system_component, evidence_source, created_at | uuid, text, timestamptz | framework, control_code, system_component | — | — | service_role only |
| **admin_control_evidence** | id, control_code, evidence_type, reference, generated_at, generated_by | uuid, text, text, timestamptz, uuid | control_code, generated_at | generated_by → auth.users | — | service_role only |
| **admin_governance_reviews** | id, review_period, reviewer, summary, created_at | uuid, text, uuid, text, timestamptz | review_period, created_at | reviewer → auth.users | — | service_role only |
| **admin_audit_snapshots** | id, snapshot_date, last_row_hash, signature, created_at | uuid, date, text, text, timestamptz | snapshot_date UNIQUE | — | — | service_role only |
| **admin_idempotency_keys** | idempotency_key, admin_user_id, action, created_at, response_status, response_body, response_hash | text PK, uuid, text, timestamptz, int, text, text | (admin_user_id, created_at) | admin_user_id → auth.users | — | service_role only |

**Other tables (existing app + admin):**

- **applications** — read/write (status, assignment, updated_at).  
- **profiles** — read (admin UI, export, blocked_users join); write (anonymize, delete user flow).  
- **user_reports** — read/write (status, assignment, reviewed_*).  
- **data_requests** — read; write (status, updated_at).  
- **app_config** — read/write.  
- **blocked_users** — read.  
- **auth.users** — read (sessions, export); delete via RPC when delete user.  
- **auth.sessions** — read via get_active_sessions RPC.  
- **message_threads**, **messages** — read (overview counts, inbox).  
- **verification_requests** — read (overview, verifications tab).

### 6.2 RPCs Used by Admin

- `admin_get_all_stats` — **Referenced in overview-stats route; no definition found in repo migrations.** Expected to return { stats, overview, activeToday }.  
- `admin_get_overview_counts` — Returns total_users, verified_count, new_users_24h/7d/30d, total_threads, total_messages, applications_7d, applications_approved_7d (from profiles + auth.users + applications + message_threads + messages + verification_requests).  
- `admin_get_overview_app_stats` — Returns application counts (total, approved, rejected, waitlisted, suspended).  
- `admin_get_application_counts` — Returns counts by status.  
- `admin_get_applications_fast` — Returns application rows with profile join (p_status, p_limit, p_offset).  
- `get_active_sessions(active_minutes)` — Returns user_id, email, last_active_at from auth.sessions.  
- `admin_get_active_today_count` — Count users active in last 24h.  
- `admin_application_action_v2(p_application_id, p_updated_at, p_action)` — Optimistic status update; returns id or NULL on conflict.  
- `admin_repair_audit_chain()` — Recomputes previous_hash/row_hash for admin_audit_log.  
- `admin_delete_user` (referenced in admin-approval executeApprovedAction) — Assumed to delete user.

---

## 7. Section 5 — User Journey Inside Admin

1. **First screen:** User opens `/admin` (or obscure path). If gate is enabled, gate password form is shown first. After gate (or if no gate), either inline login form (email + password) or the main panel.  
2. **After login:** Main panel with sidebar (tabs) and content area. Default tab is **Overview**: stats cards (applications by status, active today, new users, threads/messages, applications 7d), optional active sessions list, and quick actions.  
3. **Navigation:** Sidebar shows only tabs for which the user has the required permission (TAB_PERMISSION). Tabs: Overview, Dashboard, Applications, Users, Verifications, Inbox, Reports, Data Requests, Risk, Approvals, Audit Log, Compliance, Settings.  
4. **Actions:** Per-tab actions (e.g. approve/reject/claim/release on applications; resolve reports; update data request status; resolve escalations; approve/reject approval requests; export/verify/snapshot/repair audit; run compliance health; update config; announce; manage admin users/roles; list/revoke sessions). Buttons/forms call the corresponding API; success/error toasts; some flows open modals (e.g. bulk actions, delete user, anonymize).  
5. **Hidden/conditional:** Tabs are hidden when user lacks the mapped permission. Settings shows “Admin users & roles” and “Sessions” only when user has manage_roles / active_sessions. Announce is described as stub (no provider wired).  
6. **Analytics visible:** Overview/Dashboard show aggregate counts (stats, overviewCounts, activeToday, activeSessions). Risk tab shows escalations. Compliance shows control health and scores. No per-user or per-event analytics dashboard.  
7. **Logging:** All destructive and many other actions write to `admin_audit_log` via `writeAuditLog`. Build version is logged to console in production via BuildVersionLog. No separate admin “action log” UI beyond the Audit tab (which shows admin_audit_log).

---

## 8. Section 6 — Current Metrics (If Any)

- **Usage metrics:** None. No event tracking or analytics SDK for admin actions.  
- **Event tracking:** Not implemented for admin UI.  
- **Logs stored:** Admin actions are stored in `admin_audit_log` (action, target_type, target_id, details, reason, client_ip, session_id, timestamps). Tamper-evident chain (previous_hash, row_hash) and optional daily snapshots in `admin_audit_snapshots`.  
- **Monitoring:** No dedicated APM or error-tracking integration identified in admin code.  
- **Audit logging:** Yes. Server-side only; `writeAuditLog` used by mutation routes; destructive actions require reason and are rate-limited; optional 4-eyes approval flow for delete/anonymize/bulk above threshold.  
- **User actions recorded:** Yes, in `admin_audit_log`. Not in a separate “metrics” store.

**Summary:** Audit log is the only persistent record of admin actions. Build version is logged to console. No usage/analytics or monitoring stack documented in admin code.

---

## 9. Section 7 — Code Quality & Architecture Map

- **Architecture diagram:** See Section 2.1.  
- **Component structure:** Single large page component; no admin-specific component library.  
- **Dependency mapping:** See Section 2.5.  
- **State management:** Local React state only.  
- **Caching:** Server-side in-memory (overview-stats 60s, applications counts 60s / list 30s); client no explicit cache; Next.js no-store for /admin.

---

## 10. Gaps (Factual Only)

1. **Middleware:** `src/middleware.ts` is absent. Logic in `middleware.ts.bak` (obscure path rewrite, request-id, IP allowlist, 404 for /admin when ADMIN_BASE_PATH set) is not active.  
2. **RPC admin_get_all_stats:** Called by `overview-stats` route; no migration in the repo defines this RPC. If missing in DB, overview-stats will return 500.  
3. **admin_get_application_counts / admin_get_applications_fast:** Used by the applications route; no migration in the repo defines these RPCs. If missing in DB, applications list/counts will fail.  
4. **Announce:** POST /api/admin/announce is implemented but “wire your provider” noted in UI; no external provider wired in code.  
5. **x-admin-base-path:** Set only by middleware when rewriting obscure path. With middleware inactive, layout receives null; AppShell falls back to `getAdminBase()` (client: document.getElementById('admin-base')?.getAttribute('data-value') || '/admin').  
6. **Main app link:** No link to admin in the main app; access is URL-only.  
7. **Admin panel link from main app:** Documented as intentionally not present.

---

*End of structural audit. No recommendations or redesign; only current-state documentation.*
