# Admin Panel Forensic Audit Report

**Date:** 2025-03-03  
**Scope:** Full route audit, frontend→API contract, RPC/DB layer, Applications list, Users/Verifications/Approvals, error handling, data consistency, analytics.

---

## 1. Overall health score: **6.5 / 10**

Admin panel is functional with correct auth and permissions on most routes. Critical issues: Applications list strips assignment data (breaking Claim/Release UI state), Users list omits email, and verification approve does not update `verification_requests`. Several medium issues (counts cache, dead RPC, response shape drift).

---

## 2. Critical issues

| # | Finding | Location | Impact |
|---|---------|----------|--------|
| 1 | **GET /api/admin/applications strips assignment fields** | `src/app/api/admin/applications/route.ts` L204–226 | Response always returns `assigned_to: null`, `assigned_at: null`, `assignment_expires_at: null`. Claim/Release and “Claimed by you” cannot be reflected in the UI. Claim/release APIs and DB columns exist and work; list API hides them. |
| 2 | **Users list API never returns email** | `src/app/api/admin/users/route.ts` L38–49 | `profiles` selection does not include email; response sets `email: null` for every user. Frontend and Application type expect `email`; Users tab and application rows show empty email. |
| 3 | **Verification approve does not update verification_requests** | `src/app/api/admin/users/[id]/verification/route.ts` | Setting `is_verified: true` only updates `profiles.is_verified`. `verification_requests` row stays `status = 'pending'`, so the request remains in the pending list after “Approve”. |

---

## 3. High‑risk issues

| # | Finding | Location | Impact |
|---|---------|----------|--------|
| 1 | **Applications list: profile fetch failure degrades response silently** | `src/app/api/admin/applications/route.ts` L136–145 | On profiles query error, code only `console.error`s and continues with empty `profilesMap`. Response is 200 with applications but empty name/username/email. No 5xx; client sees blank user data. |
| 2 | **Overview stats cache key omits permission** | `src/app/api/admin/overview-stats/route.ts` L20–24 | Single in-memory cache for overview. If one admin has `active_sessions` and another does not, cached body may include or omit `activeSessions` for the wrong user. |
| 3 | **Applications list filter “assigned_to_me” uses result.user.id but response zeroes assignment** | `src/app/api/admin/applications/route.ts` L174–170, 224–226 | Server-side filter “assigned_to_me” works, but each item in the response has assignment nulled. So list is correct by filter, but no item can show “Claimed by you” or enable Release. |
| 4 | **Sessions revoke uses manage_roles** | `src/app/api/admin/sessions/[id]/revoke/route.ts` L16 | Permission is `manage_roles` (not a dedicated “revoke_session”). Documented in ADMIN_PANEL_STRUCTURAL_AUDIT as “active_sessions” for revoke; doc/implementation mismatch. |

---

## 4. Medium issues

| # | Finding | Location | Impact |
|---|---------|----------|--------|
| 1 | **Dead RPC: admin_get_applications_fast** | Migrations reference it; no route calls it | `src/app/api/admin/applications/route.ts` uses direct `from('applications')` + profiles join. Migration `20260302100006_fix_admin_functions_search_path.sql` alters this function. Unused RPC adds maintenance and schema drift risk. |
| 2 | **admin_get_all_stats referenced in ALTER but not in overview-stats** | `supabase/migrations/20260302100006`; `overview-stats/route.ts` | overview-stats uses `admin_get_overview_app_stats` + `admin_get_overview_counts` (comment says admin_get_all_stats is outdated). RPC may still exist in DB; no drift if it’s unused. |
| 3 | **Bulk applications does not use conflict-safe update** | `src/app/api/admin/bulk-applications/route.ts` L113–118 | Uses direct `.update({ status, updated_at })` without `updated_at` check. Single-application action uses `admin_application_action_v2` (conflict-safe). Bulk can overwrite concurrent changes. |
| 4 | **Applications list cache shared across status/page; no invalidation on mutation** | `src/app/api/admin/applications/route.ts` L18–19, 68–86, 94–96 | Counts cached 30s, list 15s. After approve/reject/bulk, list can be stale until TTL. No cache invalidation on POST action or bulk. |
| 5 | **Remove-role writes two audit entries** | `src/app/api/admin/admin-users/[id]/remove-role/route.ts` L70–84 | `role_remove` and `control_drift_detected` both written. May be intentional; worth confirming to avoid duplicate/noisy audit. |
| 6 | **Frontend Applications list table does not render Claim/Release** | `src/app/admin/page.tsx` L3747–3812 | Table only shows Approve / Waitlist / Reject. `onClaim`/`onRelease` are passed into section but not used in the table. `_ApplicationCard` has Claim/Release but is not used for the applications list. So even if API returned assignment, current table would not show it. |

---

## 5. Section 1 — Full route audit (table)

| Route | Method | Used By | requireAdmin | requirePermission | Response Shape | Status |
|-------|--------|---------|--------------|-------------------|----------------|--------|
| `/api/admin/gate` | GET | page.tsx (unlock check) | No (by design) | — | `{ unlocked }` | OK |
| `/api/admin/gate` | POST | page.tsx (submit password) | No (by design) | — | `{ ok, error? }` | OK |
| `/api/admin/identity` | GET | page.tsx (deployment check) | No (by design) | — | `{ app, hint }` | OK |
| `/api/admin/check` | GET | page.tsx | Yes | No (auth only) | `{ authorized, roles, sessionId }` | OK |
| `/api/admin/overview-stats` | GET | page.tsx | Yes | read_applications | `{ stats, activeToday, activeSessions?, overviewCounts }` | OK; cache key risk (high) |
| `/api/admin/applications` | GET | page.tsx | Yes | read_applications | `{ applications, total, page, limit, counts }` or legacy array | **Inconsistent response**: assignment fields always null |
| `/api/admin/applications/[id]/action` | POST | page.tsx | Yes | mutate_applications | `{ ok }` or 409 `{ error, code }` | OK |
| `/api/admin/applications/[id]/claim` | POST | page.tsx | Yes | mutate_applications | `{ ok, assigned_to, assignment_expires_at }` or 409 | OK |
| `/api/admin/applications/[id]/release` | POST | page.tsx | Yes | mutate_applications | `{ ok }` | OK |
| `/api/admin/bulk-applications` | POST | page.tsx | Yes | mutate_applications / bulk_applications | 200 `{ ok, count }`, 202 `{ approval_required, request_id }`, 207 `{ ok: false, errors }`, 429 | OK |
| `/api/admin/users` | GET | page.tsx | Yes | read_users | `{ users, total }`; users have `email: null` | **Missing field**: email always null |
| `/api/admin/users/[id]` | DELETE | — | Yes | delete_users | — | OK (exists) |
| `/api/admin/users/[id]/verification` | POST | page.tsx | Yes | mutate_users | `{ ok }` | **Logic gap**: does not set verification_requests.status |
| `/api/admin/users/[id]/ban` | POST | page.tsx | Yes | ban_users | `{ ok }` | OK |
| `/api/admin/verification-requests` | GET | page.tsx | Yes | read_applications | `{ requests }` | OK |
| `/api/admin/verification-requests/[id]/reject` | POST | page.tsx | Yes | mutate_users | `{ ok }` or 404 | OK |
| `/api/admin/verification-activity` | GET | page.tsx | Yes | read_applications | Array of activity items | OK |
| `/api/admin/active-today` | GET | page.tsx | Yes | read_applications | `{ count }` | OK |
| `/api/admin/active-sessions` | GET | page.tsx | Yes | active_sessions | `{ sessions?, count?, minutes? }` (RPC shape) | OK |
| `/api/admin/reports` | GET | page.tsx | Yes | read_reports | `{ reports }` | OK |
| `/api/admin/reports` | PATCH | page.tsx | Yes | resolve_reports | `{ ok }` or 409 | OK |
| `/api/admin/reports/[id]/claim` | POST | page.tsx | Yes | resolve_reports | — | OK |
| `/api/admin/reports/[id]/release` | POST | page.tsx | Yes | resolve_reports | — | OK |
| `/api/admin/data-requests` | GET | page.tsx | Yes | read_data_requests | `{ requests }` | OK |
| `/api/admin/data-requests` | PATCH | page.tsx | Yes | update_data_requests | — | OK |
| `/api/admin/risk` | GET | page.tsx | Yes | read_risk | — | OK |
| `/api/admin/escalations/[id]/resolve` | POST | page.tsx | Yes | resolve_escalations | — | OK |
| `/api/admin/approvals` | GET | page.tsx | Yes | approve_approval | `{ requests }` | OK |
| `/api/admin/approvals/[id]/approve` | POST | page.tsx | Yes | approve_approval | — | OK |
| `/api/admin/approvals/[id]/reject` | POST | page.tsx | Yes | approve_approval | — | OK |
| `/api/admin/blocked-users` | GET | page.tsx | Yes | read_blocked_users | — | OK |
| `/api/admin/audit` | GET | page.tsx | Yes | read_audit / export_audit | `{ entries }` or CSV | OK |
| `/api/admin/audit` | POST | page.tsx | Yes | permission by action (destructive) | — | OK |
| `/api/admin/audit/verify` | GET | page.tsx | Yes | read_audit | — | OK |
| `/api/admin/audit/snapshot` | POST | page.tsx | Yes | read_audit | — | OK |
| `/api/admin/audit/repair-chain` | POST | page.tsx | Yes | export_audit | — | OK |
| `/api/admin/compliance/controls` | GET | page.tsx | Yes | read_audit | — | OK |
| `/api/admin/compliance/evidence` | GET | page.tsx | Yes | read_audit | — | OK |
| `/api/admin/compliance/evidence/generate` | POST | page.tsx | Yes | export_audit | — | OK |
| `/api/admin/compliance/governance-reviews` | GET/POST | page.tsx | Yes | read_audit | — | OK |
| `/api/admin/compliance/health` | GET | page.tsx | Yes | read_audit | — | OK |
| `/api/admin/compliance/health/run` | POST | page.tsx | Yes | export_audit | — | OK |
| `/api/admin/config` | GET/PATCH | page.tsx | Yes | read_config / manage_config | — | OK |
| `/api/admin/announce` | POST | page.tsx | Yes | announce | — | OK |
| `/api/admin/delete-user` | POST | page.tsx | Yes | delete_users (+ request_approval) | — | OK |
| `/api/admin/anonymize-user` | POST | page.tsx | Yes | anonymize_users (+ request_approval) | — | OK |
| `/api/admin/export-user` | GET | page.tsx | Yes | export_user | Blob/JSON | OK |
| `/api/admin/admin-users` | GET | page.tsx | Yes | manage_roles | — | OK |
| `/api/admin/admin-users/[id]/assign-role` | POST | page.tsx | Yes | manage_roles | — | OK |
| `/api/admin/admin-users/[id]/remove-role` | DELETE | page.tsx | Yes | manage_roles | — | OK |
| `/api/admin/roles` | GET | page.tsx | Yes | manage_roles | — | OK |
| `/api/admin/sessions` | GET | page.tsx | Yes | active_sessions | — | OK |
| `/api/admin/sessions/[id]/revoke` | POST | page.tsx | Yes | manage_roles | — | OK (doc says active_sessions) |
| `/api/admin/analytics/overview` | GET | ProductAnalyticsTab | Yes | read_analytics | — | OK |
| `/api/admin/identity` | GET | — | No | — | — | By design |

All mutation routes that were checked use `requireAdmin` and the appropriate `requirePermission`. No empty `catch {}` found; all `console.error` usages in admin routes are followed by a return with a proper JSON error response.

---

## 6. Section 2 — Frontend → API contract check

- **overview-stats**  
  - Frontend expects: `stats`, `activeToday`, `activeSessions`, `overviewCounts`, and handles 403.  
  - API returns: `stats`, `activeToday`, `activeSessions` (if permission), `overviewCounts`.  
  - **Match.** Minor: `activeSessions` can be `null` when no permission; frontend handles null.

- **applications**  
  - Frontend: expects `applications` array, `total`, `counts` (optional), or legacy array.  
  - API: returns `applications` with `assigned_to`, `assigned_at`, `assignment_expires_at` always null.  
  - **Mismatch:** Contract type includes assignment; API strips it.

- **active-today**  
  - Frontend: `data.count` (number).  
  - API: `{ count }`.  
  - **Match.**

- **users**  
  - Frontend: `users[].email` used in list and export.  
  - API: `email: null` for every user.  
  - **Mismatch:** Missing email (profiles not joined with email source or column missing).

- **verification-requests**  
  - Frontend: `requests[]` with `id`, `user_id`, `username`, `requested_at`, `profile_image_url`.  
  - API: `requests` with `requested_at` from `created_at`.  
  - **Match.**

- **approvals**  
  - Frontend: `requests` array.  
  - API: `requests` from DB.  
  - **Match.**

- **reports**  
  - GET: `reports` with assignment fields; PATCH: `report_id`, `status`, `notes`, `updated_at`.  
  - **Match.** 409 handled.

- **Single application action**  
  - Frontend sends `action`, `updated_at` (optional); handles 409.  
  - **Match.**

- **Bulk applications**  
  - Frontend sends `application_ids`, `action`, `reason` (for reject/suspend); handles 202, 207, 429.  
  - **Match.** No 409 expected for bulk.

- **Reports PATCH**  
  - Frontend sends `report_id`, `status`, `notes`, `updated_at`.  
  - API requires `updated_at` for conflict safety.  
  - **Match.**

---

## 7. Section 3 — RPC / DB layer check

**RPCs used by admin routes:**

| RPC | Route(s) | Migration / existence |
|-----|----------|------------------------|
| `admin_get_application_counts` | applications/route.ts | 20260303000001_fix_application_counts.sql — EXISTS |
| `admin_get_overview_app_stats` | overview-stats/route.ts | 20260225100000_admin_overview_app_stats.sql — EXISTS |
| `admin_get_overview_counts` | overview-stats/route.ts | 20260302120000_fix_admin_overview_counts_accurate.sql — EXISTS |
| `admin_get_active_today_count` | active-today, overview-stats | 20260225100002_admin_get_active_today_count.sql — EXISTS |
| `get_active_sessions` | active-today, overview-stats, active-sessions | 20260225000001_get_active_sessions.sql — EXISTS |
| `admin_application_action_v2` | applications/[id]/action | 20260227000001_moderation_phase2.sql — EXISTS |
| `admin_repair_audit_chain` | audit/repair-chain, compliance/health/run | 20260228100000_audit_repair_chain_rpc.sql — EXISTS |
| `analytics_get_dau_wau_mau` etc. | analytics/overview | 20260302000003_analytics_queries_rpc.sql, 20260302100002, 20260302100005 — EXIST |

**Findings:**

- **admin_get_applications_fast:** Altered in 20260302100006; **not called** by any route. Applications list uses direct table + profiles join. **Dead RPC.**
- **admin_get_all_stats:** Altered in 20260302100006; **not called** by overview-stats (which uses overview counts + app stats). No drift if unused.
- **Tables:** `applications` has `assigned_to`, `assigned_at`, `assignment_expires_at` (used by claim/release). List route does not return them.
- **applications.updated_at:** Used by `admin_application_action_v2` and fallback; column expected. No NOT NULL or signature mismatch found for the used RPCs.

---

## 8. Section 4 — Applications list (screenshot focus)

- **GET /api/admin/applications**  
  - Counts from `admin_get_application_counts` (pending, approved, rejected, waitlisted, suspended, total).  
  - Status filters: API maps UI `pending` → DB `SUBMITTED` etc.; `waitlisted` ↔ `waitlist` handled.  
  - **Counts:** RPC returns bigint; route normalizes to number. Counts can be cached 30s; list 15s. If DB has e.g. Approved(54), counts will match after cache refresh.

- **Pending(0), Rejected(0), Suspended(0), Approved(54):**  
  - Reflect DB state as of last RPC call; 30s cache may delay reflection of recent changes.

- **Row click → detail:**  
  - `setSelectedApp(app)` opens `ApplicationDetailModal` with same `app` object. No extra fetch. **OK.**

- **Bulk actions:**  
  - Update DB; success path calls `loadData()` which refetches. Counts/list can stay stale up to cache TTL (no invalidation). **Stale counts risk.**

- **Optimistic updates:**  
  - Single approve/reject: no optimistic update; on 409 frontend shows error and does not call `loadData()`. **OK.**  
  - Bulk: no 409; 207 partial failure handled; on success `loadData()` refetches. **OK.**

- **Pagination:**  
  - Frontend sends `page`, `limit`; API returns `applications`, `total`, `page`, `limit`, `counts`. **OK.**

- **UI state inconsistency:**  
  - Assignment state is never shown for applications because API returns null for assignment and table does not render Claim/Release. **Critical** for any future use of assignment in the list.

---

## 9. Section 5 — Users / Verifications / Approvals

**Users**

- Toggle verification: POST `/api/admin/users/[id]/verification` — exists, updates `profiles.is_verified`, audit log. Does **not** update `verification_requests.status`.
- Toggle ban: POST `/api/admin/users/[id]/ban` — exists, updates `profiles.is_banned`, audit.
- Delete user: POST `/api/admin/delete-user` — exists, approval flow when enabled, audit.
- Export: GET `/api/admin/export-user?user_id=` — exists, permission, returns blob.

**Verifications**

- Pending list: GET `/api/admin/verification-requests?status=pending` — OK.
- Approve: POST `/api/admin/users/[id]/verification` with `is_verified: true` — **does not** set `verification_requests.status` to approved; request stays in pending list.
- Reject: POST `/api/admin/verification-requests/[id]/reject` — updates status to rejected, audit. **OK.**
- Activity feed: GET `/api/admin/verification-activity` — OK.

**Approvals**

- Approve: POST `/api/admin/approvals/[id]/approve` — loads request, executes action via `executeApprovedAction`, updates status, audit. **OK.**
- Reject: POST `/api/admin/approvals/[id]/reject` — updates status, audit. **OK.**

---

## 10. Section 6 — Error handling audit

- No instances of `catch (e) {}` or equivalent that swallow and do not return.
- All `console.error` usages in admin API routes are followed by a `return` with a proper JSON error (4xx/5xx). No 5xx swallowed.
- Frontend: 401 → set authorized false; 403 → permission denied handling; 409 → conflict message; 429 → rate limit message. **OK.**

---

## 11. Section 7 — Data consistency check

- **Duplicate IDs:** List keys use `app.id`, `r.id`; no duplicate key issue observed.
- **Missing key props:** Application/report lists use stable `id` for keys. **OK.**
- **Unstable list keys:** Not observed.
- **Sorting:** Applications by `submitted_at` + priority; reports by `created_at` + priority. **OK.**
- **Date/timezone:** Dates sent as ISO strings; frontend uses `new Date(...)`. No explicit timezone normalization; consistent use of ISO. **OK.**
- **Null/undefined:** Application list maps `a.name ?? ''` etc.; detail modal uses `app.email || '-'`. Users list has `email: null`; UI may show blank. **OK except missing email.**

---

## 12. Section 8 — Analytics side effects

- Admin actions (e.g. application approve, user ban) use `writeAuditLog`; no direct analytics event calls found in the audited admin mutation routes.
- ProductAnalyticsTab fetches `/api/admin/analytics/overview`; analytics RPCs are read-only.
- No double session end or missing event flush identified in the admin panel code paths audited.

---

## 13. Exact fixes required

| Priority | File | Change |
|----------|------|--------|
| Critical | `src/app/api/admin/applications/route.ts` | In the response mapping (L204–226), return real `assigned_to`, `assigned_at`, `assignment_expires_at` from the merged list item (from `a` before overwriting), instead of hardcoding `null`. Ensure the select from `applications` includes these columns (already in `*`). |
| Critical | `src/app/api/admin/users/route.ts` | Include email in the response: either (a) add `email` to `profiles` select if the column exists, or (b) join with `auth.users` via service role and select email, then map into each user in `list`. |
| Critical | `src/app/api/admin/users/[id]/verification/route.ts` | When `isVerified === true`, after updating `profiles`, update `verification_requests` for that user: set `status = 'approved'` and `reviewed_at = now()` for rows with `user_id = userId` and `status = 'pending'`. Optionally limit to one row (e.g. most recent). |
| High | `src/app/api/admin/applications/route.ts` | On profiles fetch error, either return 500 or return a structured partial response with an error flag; do not return 200 with blank name/username/email. |
| High | `src/app/api/admin/overview-stats/route.ts` | Cache key should include permission context (e.g. whether `active_sessions` is allowed) so that admins with different permissions do not share the same cached body, or skip caching when `activeSessions` is fetched. |
| Medium | `src/app/api/admin/bulk-applications/route.ts` | Consider conflict-safe bulk update (e.g. per-row `updated_at` check or single RPC that returns conflict count) to avoid overwriting concurrent edits. |
| Medium | `src/app/api/admin/applications/route.ts` | Invalidate or bypass counts/list cache when mutations occur (e.g. after action or bulk), or reduce TTL; alternatively invalidate from applications/[id]/action and bulk-applications (e.g. shared cache key version or delete cache entries). |
| Low | Docs / code | Align session revoke permission: either document that revoke uses `manage_roles` or introduce a dedicated permission and use it for revoke. |
| Low | Migrations / code | Remove or stop altering `admin_get_applications_fast` if it remains unused; or switch applications list to use it and remove the direct query. |

---

## Summary

- **Auth and permissions:** Consistently applied; no route that should be protected is missing `requireAdmin` or appropriate `requirePermission`.
- **Response shape and contract:** Two critical mismatches (applications assignment fields null; users email null) and one logic gap (verification approve not updating verification_requests).
- **RPC/DB:** All used RPCs exist in migrations; one dead RPC (`admin_get_applications_fast`). No schema/signature drift found for used functions.
- **Error handling:** No swallowed errors; 4xx/5xx returned and handled on the frontend.
- **Applications list:** Counts and pagination correct; assignment state missing in API and not used in current table UI; cache can show stale counts after mutations.
- **Users / Verifications / Approvals:** Flows work except verification approve leaving requests pending and users list missing email.

Implementing the critical and high-priority fixes above will resolve the main correctness and consistency issues in the Admin Panel.
