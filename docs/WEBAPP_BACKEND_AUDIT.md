# Webapp Backend Audit (Admin / Applications)

**Date:** 2026-03-04  
**Scope:** Backend used by the webapp admin panel, especially applications list and overview.

---

## 1. Applications API (`/api/admin/applications`)

### Dependencies
- **Auth:** `requireAdmin()` then `requirePermission(..., read_applications)`.
- **Supabase:** `getServiceRoleClient()` or createClient with `SUPABASE_SERVICE_ROLE_KEY`. Needs `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
- **RPCs:** `admin_get_application_counts()` (counts by status), optional `admin_get_emails_for_user_ids(p_user_ids)` (enrich email from auth.users).
- **Tables:** `applications` (with `submitted_at`, `status`, `assigned_to`, `assignment_expires_at`, `user_id`, etc.), `profiles` (for name, username, email, etc.).

### Query flow
1. Parse `page`, `limit`, `sort`, `filter` (assignment), `status` (tab filter).
2. Call `admin_get_application_counts()` for counts (used for filter tabs).
3. Build query: `applications` → optional `.in('status', ...)` → optional assignment filter → `.range(offset, offset+limit-1)`.
4. Fetch profiles for returned `user_id`s and merge; optionally fill email via `admin_get_emails_for_user_ids`.
5. Sort in memory (overdue/oldest/assigned_to_me), map to response shape, return `{ applications, total, page, limit, counts }`.

### Fixes applied
- **Assignment filter in DB:** For `filter=unassigned` use PostgREST `.or('(assigned_to.is.null,assignment_expires_at.lt.<iso>)')` so pagination is over the filtered set (avoids “No applications found” when first 50 rows are all assigned).
- **Error logging:** On query error, log `requestId`, `appsError.message`, and params. When `filter=all` and `status=all` but 0 rows with `counts.total > 0`, log a warning for debugging.

### Migrations (applications)
- **20260227000001_moderation_phase2.sql:** applications columns `assigned_to`, `assignment_expires_at`, `updated_at`, indexes.
- **20260303000001_fix_application_counts.sql:** `admin_get_application_counts()` (pending/approved/rejected/waitlisted/suspended/total).
- **20260303100002_admin_get_emails_for_user_ids.sql:** `admin_get_emails_for_user_ids(uuid[])` for email enrichment.

---

## 2. Overview stats API (`/api/admin/overview-stats`)

### Dependencies
- Same auth and Supabase as above.
- **RPCs:** `admin_get_overview_app_stats()` (application counts), `admin_get_overview_counts()` (users, threads, messages, applications_7d), optional `admin_get_active_today_count()`, `get_active_sessions(active_minutes)`.
- **Tables:** `profiles` (for verified count fallback).

### Migrations
- **20260225100000_admin_overview_app_stats.sql:** `admin_get_overview_app_stats()`.
- **20260229100001_admin_overview_counts_use_profiles.sql:** `admin_get_overview_counts()` (profiles + auth.users for new-user counts, applications_7d from applications).

---

## 3. Service role and env

- **getServiceRoleClient()** (`src/lib/supabase-service.ts`): Uses `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; returns null if either missing. Bypasses RLS.
- All admin list/overview routes use service role after `requireAdmin()` and permission check.

---

## 4. Checklist for “applications list empty but counts show”

- [x] Assignment filter applied in DB before `.range()` (not only in memory).
- [x] PostgREST `.or()` uses parentheses: `(assigned_to.is.null,assignment_expires_at.lt.<iso>)`.
- [x] Applications fetch uses `cache: 'no-store'` on the frontend.
- [x] Frontend refetches once when on Applications tab with empty list but `stats.total > 0`.
- [x] API logs query errors and logs a warning when 0 rows with counts.total > 0 and filter=all, status=all.

If the list is still empty, check Vercel/server logs for `[requestId] applications query error:` or the warning above; verify `applications` table has rows and `submitted_at`/`status` columns exist and RPCs are deployed.
