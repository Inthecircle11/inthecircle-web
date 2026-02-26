# Admin Panel Audit – Frontend, Backend, Wiring

**Last audit:** 2025-02-24

## Summary

- **Auth:** Gate → Check → requireAdmin() is consistent. Gate and Check do not use requireAdmin (intended).
- **APIs:** All 12 admin API routes exist and are protected. Reports, Data Requests, and Blocked Users now use **service role** so admins see all rows (RLS was restricting to own rows).
- **Frontend:** Single page at `src/app/admin/page.tsx`; tabs load data via fetch or Supabase client. Audit log, config, reports, data-requests, blocked-users, and settings save are wired to the correct APIs.
- **RPCs:** Several features depend on Supabase RPCs that may live in another repo or migrations. If Users / Verifications / Applications actions fail, ensure these exist in your project.

---

## 1. Auth Flow

| Step | Where | Purpose |
|------|--------|--------|
| **Gate** | `GET/POST /api/admin/gate` | Optional `ADMIN_GATE_PASSWORD`; sets cookie so user can proceed to login. |
| **Check** | `GET /api/admin/check` | Returns `{ authorized }` using `ADMIN_USER_IDS` / `ADMIN_EMAILS`. Session from cookies. |
| **requireAdmin()** | All other admin API routes | Ensures user is logged in and in admin list; returns 401/403 or `{ user, supabase }`. |

- **Gate** and **Check** do not use `requireAdmin()` by design (gate has no session yet; check is the one that determines admin).
- **Frontend:** After gate (if any), calls `/api/admin/check` and then either shows inline login or loads data.

---

## 2. API Routes (Backend)

| Route | Method | Auth | Data source | Notes |
|-------|--------|------|-------------|--------|
| `/api/admin/gate` | GET, POST | None | Env only | Cookie for gate password. |
| `/api/admin/check` | GET | Session | Env (ADMIN_* ) | Returns `{ authorized }`. |
| `/api/admin/applications` | GET | requireAdmin | **Service role** (direct tables) | Paginated; no RPC required. |
| `/api/admin/reports` | GET, PATCH | requireAdmin | **Service role** | Was RLS-limited; now admin sees all. |
| `/api/admin/data-requests` | GET, PATCH | requireAdmin | **Service role** | Was RLS-limited; now admin sees all. |
| `/api/admin/blocked-users` | GET | requireAdmin | **Service role** | Admin sees all blocks. |
| `/api/admin/audit` | GET, POST | requireAdmin | Session client | RLS allows authenticated read/insert. |
| `/api/admin/config` | GET, PATCH | requireAdmin | Session client | RLS allows authenticated full access. |
| `/api/admin/export-user` | GET | requireAdmin | **Service role** | Full user export. |
| `/api/admin/anonymize-user` | POST | requireAdmin | **Service role** | Anonymizes profile. |
| `/api/admin/bulk-applications` | POST | requireAdmin | Session client → RPC | Calls `admin_*_application` RPCs. |
| `/api/admin/announce` | POST | requireAdmin | None | Placeholder; wire to push/email later. |

- **Service role** is used where the admin must see or change data for any user (reports, data_requests, blocked_users, export, anonymize, applications). Implemented via `getServiceRoleClient()` from `@/lib/supabase-service`.
- **Session client** is used for audit log and config (RLS allows authenticated access) and for RPCs (e.g. bulk-applications).

---

## 3. Frontend → Backend Wiring

| Feature | Frontend (page.tsx) | Backend | Response shape |
|---------|---------------------|---------|----------------|
| Gate | `fetch('/api/admin/gate')` GET/POST | gate/route.ts | `{ unlocked }` / `{ ok, error }` |
| Admin check | `fetch('/api/admin/check')` | check/route.ts | `{ authorized }` |
| Applications | `fetch('/api/admin/applications')` then fallback `supabase.rpc('admin_get_applications')` | applications/route.ts | Array of application objects |
| Stats | Computed from applications | — | — |
| Users | `supabase.rpc('admin_get_all_users')` | — | RPC only |
| Active today | `supabase.rpc('admin_get_active_today_count')` | — | RPC only |
| Recent activity | `supabase.rpc('admin_get_recent_verification_activity')` | — | RPC only |
| Verifications | `supabase.from('verification_requests')` + profiles | — | Client direct |
| Reports | `fetch('/api/admin/reports')` GET/PATCH | reports/route.ts | `{ reports }` / 200 |
| Data requests | `fetch('/api/admin/data-requests')` GET/PATCH | data-requests/route.ts | `{ requests }` / 200 |
| Audit log | `fetch('/api/admin/audit?limit=100')` GET, `fetch('/api/admin/audit', { method: 'POST', body })` | audit/route.ts | `{ entries }` / `{ ok }` |
| Config | `fetch('/api/admin/config')` GET/PATCH | config/route.ts | Key-value object / 200 |
| Blocked users | `fetch('/api/admin/blocked-users')` | blocked-users/route.ts | `{ blocked }` |
| Export user | `fetch(\`/api/admin/export-user?user_id=...\`)` | export-user/route.ts | JSON attachment |
| Anonymize user | `fetch('/api/admin/anonymize-user', { method: 'POST', body })` | anonymize-user/route.ts | `{ ok, message }` |
| Bulk applications | `fetch('/api/admin/bulk-applications', { method: 'POST', body })` | bulk-applications/route.ts | `{ ok, count }` or `{ errors }` |
| Announce | `fetch('/api/admin/announce', { method: 'POST', body })` | announce/route.ts | `{ ok, message }` |

- All fetch calls use `credentials: 'include'` and the correct method/body where applicable.
- Config PATCH sends the full config object; API allows only `signups_open`, `verification_requests_open`, `maintenance_mode`, `maintenance_banner`.
- Reports PATCH sends `report_id`, `status` (`resolved`|`dismissed`), optional `notes`.
- Data requests PATCH sends `request_id`, `status` (`pending`|`completed`|`failed`).

---

## 4. Supabase RPCs Used by the Frontend

These are called with the **session client** (admin’s JWT). They must exist in your Supabase project and must allow the admin to perform the action (e.g. via RLS or `SECURITY DEFINER`).

| RPC | Used for |
|-----|----------|
| `admin_get_applications` | Fallback when `/api/admin/applications` fails (e.g. no service key). |
| `admin_get_all_users` | Users tab list. |
| `admin_get_active_today_count` | Dashboard “active today” count. |
| `admin_get_recent_verification_activity` | Dashboard recent activity. |
| `admin_approve_application` | Single approve. |
| `admin_reject_application` | Single reject. |
| `admin_waitlist_application` | Single waitlist. |
| `admin_suspend_application` | Single suspend. |
| `admin_set_verification` | Set user verification status. |
| `admin_set_banned` | Ban user. |
| `admin_delete_user` | Delete user. |

- There are **no** RPC definitions in this repo’s `supabase/migrations` for these; they may live in another repo or be created manually.
- **Applications list** does not depend on RPC when `SUPABASE_SERVICE_ROLE_KEY` is set; the `/api/admin/applications` route uses the service role and direct table access.

---

## 5. Tables and Migrations in This Repo

- `admin_audit_log` – audit trail (migration: `20260220000001_admin_audit_log.sql`; RLS fix in `20260221000001_fix_rls_linter.sql`).
- `app_config` – feature flags and maintenance (migration: `20260220000003_app_config.sql`; RLS fix in same linter migration).
- `user_reports` – user reports (migration: `20260220000002_user_reports.sql`; RLS fix in linter migration). API uses **service role** so admin sees all.
- `data_requests` – GDPR-style requests (migration: `20260220000004_data_requests_add_id.sql`). API uses **service role** so admin sees all.
- `blocked_users` – no migration in this repo; table may exist elsewhere. API uses **service role** so admin sees all regardless of RLS.

---

## 6. Inbox (Admin View)

- **Frontend:** `loadInbox()` uses `createClient()` (session) and reads `message_threads`, `messages`, `profiles`.
- **RLS:** If your RLS only allows users to see their own threads/messages, the admin will only see their own. To show all threads in the admin panel, either:
  - Add RLS policies that allow admins to read all (e.g. based on `auth.jwt() ->> 'email'` in `ADMIN_EMAILS`), or
  - Add an `/api/admin/inbox` route that uses the service role and returns threads/messages/profiles; frontend would call that instead of direct Supabase.

---

## 7. Env Vars (Server-Side)

| Variable | Required for | Notes |
|----------|----------------------|--------|
| `ADMIN_USER_IDS` or `ADMIN_EMAILS` | Admin access | Comma-separated; at least one required for any admin. |
| `SUPABASE_SERVICE_ROLE_KEY` | Applications, Reports, Data requests, Blocked, Export, Anonymize | Must be set in production. |
| `ADMIN_GATE_PASSWORD` | Optional gate screen | If set, gate cookie required. |
| `ADMIN_BASE_PATH` | Obscure URL | If set, only that path serves admin; `/admin` returns 404. |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | All Supabase usage | Standard. |

---

## 8. Middleware

- `src/proxy.ts`: When `ADMIN_BASE_PATH` is set, only that path is rewritten to `/admin`; direct `/admin` returns 404. API routes are not run through proxy (matcher excludes `api/`).

---

## 9. Fixes Applied in This Audit

1. **Reports API:** Uses `getServiceRoleClient()` so admins see all reports (RLS was “read own” only).
2. **Data-requests API:** Uses `getServiceRoleClient()` so admins see all data requests.
3. **Blocked-users API:** Uses `getServiceRoleClient()` so admins see all blocks.
4. **Export-user API:** Uses `getServiceRoleClient()` for full export regardless of RLS.
5. **Anonymize-user API:** Uses `getServiceRoleClient()` so profile update succeeds regardless of RLS.
6. **Shared helper:** `src/lib/supabase-service.ts` – `getServiceRoleClient()` for use in admin API routes only after `requireAdmin()`.

No frontend or auth flow changes were required; all wiring was correct. The only functional bugs were RLS preventing admin from seeing all rows in reports, data_requests, and blocked_users; those are fixed by using the service role in the corresponding API routes.
