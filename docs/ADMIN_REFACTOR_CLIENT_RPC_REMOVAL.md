# Admin Panel — Remove Client RPC / Centralize in API

**Date:** 2026-03-02

## Summary

All admin mutations and data fetches that previously used client-side `supabase.rpc('admin_*')` now go through `/api/admin/*` routes. Server-side API routes use service role and direct table updates (or existing RPCs where still required).

---

## 1. Frontend (page.tsx) — Replacements

| Previous | Replacement |
|----------|-------------|
| `supabase.rpc('admin_get_applications')` (fallback) | Removed; use only `GET /api/admin/applications` (no fallback). |
| `supabase.rpc('admin_get_all_users')` | `GET /api/admin/users` |
| `supabase.rpc('admin_get_active_today_count')` | Removed; use `overview-stats.activeToday` only (fallback branch sets null). |
| `supabase.rpc('admin_get_recent_verification_activity')` | `GET /api/admin/verification-activity` |
| `supabase.from('verification_requests').select(...)` (pending) | `GET /api/admin/verification-requests?status=pending` |
| `supabase.rpc('admin_set_verification', …)` (toggle + approve) | `POST /api/admin/users/[id]/verification` with `{ is_verified }` |
| `supabase.rpc('admin_set_banned', …)` | `POST /api/admin/users/[id]/ban` with `{ is_banned }` |
| `supabase.from('verification_requests').update(...)` (reject) | `POST /api/admin/verification-requests/[id]/reject` |

Delete user: still `POST /api/admin/delete-user` (body `user_id`, `reason`). Implementation now uses Auth Admin API via `deleteUserById()` instead of RPC.

---

## 2. New API Routes

| Route | Method | Permission | Purpose |
|-------|--------|------------|---------|
| `/api/admin/users` | GET | read_users | List users (profiles); replaces admin_get_all_users. |
| `/api/admin/users/[id]` | DELETE | delete_users | Delete user (Auth Admin + profiles cleanup). |
| `/api/admin/users/[id]/verification` | POST | mutate_users | Set profiles.is_verified; audit log. |
| `/api/admin/users/[id]/ban` | POST | ban_users | Set profiles.is_banned; audit log. |
| `/api/admin/verification-activity` | GET | read_applications | Recent approved/rejected verification activity. |
| `/api/admin/verification-requests` | GET | read_applications | Pending (or filtered) verification requests. |
| `/api/admin/verification-requests/[id]/reject` | POST | mutate_users | Reject a verification request; audit log. |

All use `requireAdmin()` and the stated permission.

---

## 3. Updated Routes / Lib

- **POST /api/admin/delete-user**  
  Uses `deleteUserById(serviceSupabase, userId)` from `@/lib/admin-delete-user` instead of `admin_delete_user` RPC.

- **POST /api/admin/bulk-applications**  
  Uses direct `applications` UPDATE (status + updated_at) per id instead of `admin_approve_application`, `admin_reject_application`, `admin_waitlist_application`, `admin_suspend_application` RPCs.

- **lib/admin-approval.ts**  
  - `executeApprovedAction` for `user_delete`: calls `deleteUserById(supabase, userId)` instead of RPC.  
  - `executeApprovedAction` for `bulk_reject` / `bulk_suspend`: direct `applications` UPDATE instead of RPC.

- **lib/admin-delete-user.ts** (new)  
  `deleteUserById(supabase, userId)`: `supabase.auth.admin.deleteUser(userId)` then delete from `profiles`.

---

## 4. Permissions

- **mutate_users** added in `admin-rbac.ts`. Used for verification and ban routes. Granted to moderator and supervisor (and super_admin via full permissions).
- Verification: `POST .../verification` and `POST .../reject` use `mutate_users`.
- Ban: `POST .../ban` uses existing `ban_users`.

---

## 5. Migrations

- **20260302110000_profiles_verified_banned.sql**  
  Adds `profiles.is_verified` and `profiles.is_banned` (IF NOT EXISTS).

- **20260302110001_drop_replaced_admin_rpcs.sql**  
  Drops (IF EXISTS):  
  `admin_set_verification`, `admin_set_banned`, `admin_delete_user`,  
  `admin_approve_application`, `admin_reject_application`,  
  `admin_waitlist_application`, `admin_suspend_application`.

---

## 6. Removed RPC References

- **Client (page.tsx):** No remaining `supabase.rpc('admin_*')` or `.rpc(` calls. Confirmed by grep.
- **Server:** No references to `admin_set_verification`, `admin_set_banned`, `admin_delete_user`, or the four bulk application RPCs. Remaining server-side `admin_*` RPC usage (intentional):  
  `admin_repair_audit_chain`, `admin_application_action_v2`, `admin_get_all_stats`, `admin_get_application_counts`, `admin_get_applications_fast`, `get_active_sessions` (non-admin).

---

## 7. PASS/FAIL Revalidation

| Check | Result |
|-------|--------|
| No client `supabase.rpc('admin_*')` | PASS (grep: none in client) |
| Verification toggle uses API | PASS (`POST .../users/[id]/verification`) |
| Ban toggle uses API | PASS (`POST .../users/[id]/ban`) |
| Approve verification uses API | PASS (same as verification with `is_verified: true`) |
| Reject verification uses API | PASS (`POST .../verification-requests/[id]/reject`) |
| Users list uses API | PASS (`GET /api/admin/users`) |
| Applications list no RPC fallback | PASS (removed) |
| Delete user uses deleteUserById (no RPC) | PASS |
| Bulk applications use direct UPDATE | PASS |
| Approval execute uses deleteUserById + direct UPDATE | PASS |
| New routes use requireAdmin + requirePermission | PASS |
| profiles.is_verified / is_banned migration | PASS (added) |
| Drop replaced RPCs migration | PASS (added) |

---

*Refactor complete. All admin mutations go through API routes; no client admin RPC.*
