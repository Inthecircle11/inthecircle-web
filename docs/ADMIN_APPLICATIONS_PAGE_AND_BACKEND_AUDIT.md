# Admin Applications Page & Backend — Audit

**Date:** 2026-03-03  
**Scope:** Admin Applications tab (frontend), GET/POST APIs for applications, cache, RPCs, and DB expectations.  
**Goal:** Single reference for data flow, contracts, dependencies, and risks.

---

## 1. Executive summary

| Layer | Status | Notes |
|-------|--------|--------|
| **Frontend (Applications tab)** | ✅ Solid | Status/assignment filters, sort, pagination, search (client-side on current page), bulk actions, detail modal, INP fix (rAF defer), counts-error banner. |
| **GET /api/admin/applications** | ✅ Solid | Pagination, status + assignment filter in DB, counts RPC, profiles merge (no `profiles.bio`), optional auth email RPC, cache (counts 30s, list 15s), clear on mutations. |
| **POST action/claim/release/bulk** | ✅ Solid | Auth + RBAC, conflict handling (409), cache clear, specific error messages for missing RPC/column. |
| **Dependencies** | ⚠️ Required | Supabase: `applications` table, `profiles` (id, name, username, email, profile_image_url, niche, phone), `admin_get_application_counts`, `admin_application_action_v2`; optional `admin_get_emails_for_user_ids`. |

**Risks:** Production DB must have expected columns and RPCs; `profiles.bio` is intentionally not selected (column may not exist). Cache is in-memory per serverless instance.

---

## 2. Frontend — Applications tab

### 2.1 Location and entry

- **Route:** Rendered when `activeTab === 'applications'` in `src/app/admin/page.tsx`.
- **Permission:** `read_applications` (and `mutate_applications` for actions). Tab visible via `TAB_PERMISSION.applications`.

### 2.2 Data flow

1. **Initial load:** `loadData()` (Overview) fetches `fetchApplications(sort, filter, 1, APPLICATIONS_PAGE_SIZE, statusFilter)` and sets `applications`, `applicationsTotal`, `stats` (counts), `applicationsCountsError`.
2. **Tab switch to Applications:** `loadTabData('applications')` calls `fetchApplications(..., applicationsPage, ...)` with current `appSort`, `appAssignmentFilter`, `appFilter` (status).
3. **Filter/sort/pagination:** Handlers set state immediately, then `requestAnimationFrame(() => loadData(...))` to avoid INP (blocking UI). `loadData` calls `fetchApplications` with the new page/filter/sort.
4. **API request:** `GET /api/admin/applications?page=&limit=&sort=&filter=&status=` (all optional; defaults: page=1, limit=50, sort=overdue, filter=all, status=all).

### 2.3 UI elements

| Element | Purpose | Backend / state |
|--------|---------|------------------|
| Search input | Filter list by name, email, username (client-side on current page) | No API param; `filteredApps` from `applications` |
| Status tabs | All, Pending, Approved, Waitlisted, Rejected, Suspended | `status` query param; counts from API `counts` |
| Sort / assignment dropdown | overdue, oldest, My items first; All, Unassigned, Assigned to me | `sort`, `filter` query params |
| Pagination | Page N, “Showing X–Y of Z” | `page`, `limit`; `total` from API |
| List rows | Avatar, name, @username, email, niche, IG, referrer, followers, status, date | `applications` from API |
| Row click | Open detail modal | — |
| Approve / Reject / Waitlist / Suspend | Single application action | POST `/api/admin/applications/[id]/action` |
| Claim / Release | Assignment | POST `.../claim`, `.../release` |
| Bulk bar | Approve/Reject/Waitlist all (selected pending), Clear selection | POST `/api/admin/bulk-applications` |
| Export CSV | Download current page as CSV | Client-side from `applications` |
| Counts error banner | When `admin_get_application_counts` fails | `countsError` from API |

### 2.4 State (relevant)

- `applications`, `applicationsTotal`, `applicationsPage`, `appFilter`, `appSort`, `appAssignmentFilter`, `appSearch`, `applicationsLoading`, `applicationsCountsError`, `selectedAppIds`, `selectedApp`, `actionLoading`, `stats` (counts).

### 2.5 Error handling

- 403 → `handle403` (refetch roles, switch tab). Non-OK response → `apps: []`, `total: 0`; `countsError` set when API returns `countsError: true`. Global `error` banner for API error messages; `applicationsCountsError` shows amber banner with migration/env hint.

---

## 3. Backend — GET /api/admin/applications

### 3.1 Auth and params

- **Auth:** `requireAdmin` + `requirePermission(..., read_applications)`.
- **Query params:** `page`, `limit` (default 50, max 200), `sort` (overdue | oldest | assigned_to_me), `filter` (all | unassigned | assigned_to_me), `status` (all | pending | approved | rejected | waitlisted | suspended). When `page` is omitted, legacy response is array only (no `total/counts`).

### 3.2 Flow

1. **Counts:** From RPC `admin_get_application_counts` (or cache 30s). On error: log, set `countsErrorFlag`, use zeros.
2. **List:** Cache key `status-filter-page-limit`. On cache miss:
   - Query `applications` with `status` filter, assignment filter (`assigned_to` / `assignment_expires_at`), `order by submitted_at asc`, `range(offset, offset+limit-1)`.
   - Fetch `profiles` for returned `user_id`s: columns `id, name, username, email, profile_image_url, niche, phone` (no `bio` — column may not exist).
   - Merge into list; optionally enrich email via RPC `admin_get_emails_for_user_ids` for rows with no email.
   - Store in apps cache (15s TTL), evict oldest if size > 20.
3. **Sort (in-memory):** By priority (overdue 24h/6h) or oldest, or filter + sort for “assigned_to_me”.
4. **Response:** `{ applications, total, page, limit, counts, countsError }` (or legacy array).

### 3.3 Assignment filter (DB)

- **all:** No extra filter.
- **unassigned:** `.or('assigned_to.is.null,assignment_expires_at.lt.<nowIso>')`.
- **assigned_to_me:** `.eq('assigned_to', currentUserId).gte('assignment_expires_at', nowIso)`.

### 3.4 Status mapping (UI → DB)

- pending → SUBMITTED, PENDING_REVIEW, DRAFT, PENDING  
- approved → ACTIVE, APPROVED  
- rejected → REJECTED  
- waitlisted → WAITLISTED, WAITLIST  
- suspended → SUSPENDED  

### 3.5 Dependencies

- **Required:** `applications` table (with `status`, `submitted_at`, `user_id`, `assigned_to`, `assignment_expires_at`, `updated_at`, plus fields for display), `profiles` (id, name, username, email, profile_image_url, niche, phone), RPC `admin_get_application_counts`.
- **Optional:** RPC `admin_get_emails_for_user_ids` (enriches email when profile empty).

---

## 4. Backend — POST /api/admin/applications/[id]/action

- **Purpose:** Single application action: approve | reject | waitlist | suspend.
- **Auth:** `requireAdmin` + `mutate_applications`.
- **Body:** `{ action, updated_at? }`. If `updated_at` omitted, route fetches current `updated_at` then calls RPC.
- **RPC:** `admin_application_action_v2(p_application_id, p_updated_at, p_action)` — returns id if row updated, NULL if conflict (updated_at changed).
- **Conflict:** 409 “Record changed by another moderator”, code CONFLICT.
- **Fallback:** If RPC missing (42883) or no `updated_at`, fallback to direct `applications.update({ status, updated_at }).eq('id', id)`; 42703 → hint to add `updated_at` column.
- **Side effect:** On approve, `triggerWelcomeEmailForApplication` (fire-and-forget). Then `clearApplicationsCache()`.

---

## 5. Backend — POST claim / release

### 5.1 Claim

- **Purpose:** Assign application to current admin for `ADMIN_ASSIGNMENT_TTL_MINUTES` (default 15).
- **Update:** `assigned_to`, `assigned_at`, `assignment_expires_at` with `.or('assigned_to.is.null,assignment_expires_at.lt.<now>').eq('id', id)` so only unassigned/expired can be claimed.
- **409:** If no row updated or `assigned_to` !== current user. Then `clearApplicationsCache()`.

### 5.2 Release

- **Purpose:** Clear assignment for one application.
- **Update:** Set `assigned_to`, `assigned_at`, `assignment_expires_at` to null. Then `clearApplicationsCache()`.

---

## 6. Backend — POST /api/admin/bulk-applications

- **Purpose:** Bulk approve | reject | waitlist | suspend.
- **Auth:** `mutate_applications` (approve/waitlist) or `bulk_applications` (reject/suspend). Rate limit: 20 bulk requests/min per admin; destructive (reject/suspend) may require approval or additional rate check.
- **Body:** `application_ids[]`, `action`, `reason` (required for reject/suspend, min 5 chars), `updated_at_by_id` (map of id → updated_at for conflict checking).
- **Cap:** `MAX_BULK_APPLICATION_IDS = 200`.
- **Conflict:** Each update uses `eq('updated_at', updated_at)`; any conflict → 409 “Some applications were modified by another admin”.
- **Idempotency:** Optional `Idempotency-Key` header; stored in `admin_idempotency_keys`.
- **Audit:** `writeAuditLog` for bulk action; on approve, `triggerWelcomeEmailForApplication` per id. Then `clearApplicationsCache()`.

---

## 7. Cache (admin-applications-cache)

- **Counts:** Single object, TTL 30s. Keyed by nothing (global).
- **List:** Map key `status-filter-page-limit`, TTL 15s. Max 20 keys; evict oldest.
- **Clear:** `clearApplicationsCache()` called from action, claim, release, bulk-applications. Counts set to null, apps map cleared.
- **Note:** In-memory per serverless instance; not shared across invocations or regions.

---

## 8. Database expectations (summary)

| Object | Required | Notes |
|--------|----------|--------|
| Table `applications` | Yes | Columns: id, user_id, status, submitted_at, updated_at, assigned_to, assigned_at, assignment_expires_at; display: name, username, email, profile_image_url, bio, niche, phone, referrer_username, instagram_username, follower_count, why_join, what_to_offer, collaboration_goals, review_notes. |
| Table `profiles` | Yes | id, name, username, email, profile_image_url, niche, phone. `bio` not selected (may not exist). |
| RPC `admin_get_application_counts` | Yes | Returns pending, approved, rejected, waitlisted, suspended, total (bigint). |
| RPC `admin_application_action_v2` | Yes (for conflict-safe single action) | (p_application_id, p_updated_at, p_action) → uuid or NULL. |
| RPC `admin_get_emails_for_user_ids` | Optional | p_user_ids → { user_id, email }[] for email enrichment. |

### Migrations (reference)

- `20260227000001_moderation_phase2.sql`: applications assignment + updated_at, trigger, `admin_application_action_v2`.
- `20260303000001_fix_application_counts.sql`: `admin_get_application_counts`.
- `20260303100002_admin_get_emails_for_user_ids.sql`: email enrichment RPC.

---

## 9. Gaps and recommendations

### Addressed

- List empty despite counts: assignment filter applied in DB; cache key includes filter.
- Counts RPC missing: UI shows counts-error banner and migration/env hint.
- `profiles.bio` missing: Removed from profiles select; bio from application row or empty.
- INP: Filter/sort/pagination handlers defer `loadData` with `requestAnimationFrame`.
- Cache cleared on all mutations.

### Optional improvements

1. **Export all:** API or streaming endpoint for full CSV export (e.g. by status).
2. **Server-side search:** `?q=` for name/email/username across all applications.
3. **Profiles.bio:** If added to DB, add `bio` back to profiles select for richer detail.
4. **Cache:** If multiple regions/instances need consistency, consider short TTL or cache invalidation via edge/store.

---

## 10. File reference

| File | Purpose |
|------|---------|
| `src/app/admin/page.tsx` | Applications tab, fetchApplications, loadData, filter/sort/pagination handlers, ApplicationsTab, detail modal. |
| `src/app/api/admin/applications/route.ts` | GET list (pagination, counts, profiles merge, email RPC, cache). |
| `src/app/api/admin/applications/[id]/action/route.ts` | POST single action. |
| `src/app/api/admin/applications/[id]/claim/route.ts` | POST claim. |
| `src/app/api/admin/applications/[id]/release/route.ts` | POST release. |
| `src/app/api/admin/bulk-applications/route.ts` | POST bulk action. |
| `src/lib/admin-applications-cache.ts` | Counts + list cache, clearApplicationsCache. |
| `supabase/migrations/20260227000001_moderation_phase2.sql` | applications assignment + updated_at, admin_application_action_v2. |
| `supabase/migrations/20260303000001_fix_application_counts.sql` | admin_get_application_counts. |
| `supabase/migrations/20260303100002_admin_get_emails_for_user_ids.sql` | admin_get_emails_for_user_ids. |

---

**Conclusion:** The Applications page and its backend are documented end-to-end. Ensure production Supabase has the required table columns and RPCs; then list, counts, actions, claim/release, and bulk behave as described above.
