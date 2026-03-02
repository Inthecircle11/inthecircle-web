# Admin Overview Data: End-to-End Audit

**Date:** 2026-03-02  
**Scope:** Why "Active today" can show "—" and "Verified" shows 0. Full data flow from DB → API → client → UI.

---

## 1. Executive Summary

| Metric | Expected | Observed | Root cause (audit) |
|--------|----------|----------|--------------------|
| **Active today** | Number (0 or count) | "—" (dash or blank) | Client can render `null` as blank; or deployment is stale (old code with `number \| null` state). |
| **Verified** | Number | 0 | Correct if no approved `verification_requests`; OR overview failed and fallback uses first-page `users` (none verified). |
| **Concurrent active users** | "1 active now" | Works | Uses `get_active_sessions(15)`; independent of "Active today". |

**Fixes applied in codebase:** (1) `activeUsersToday` state is `number` (initial 0), set to 0 on 403. (2) StatCard displays `value ?? 0` so null/undefined never renders blank. (3) Verified card uses `verifiedUsersCount ?? 0`.

---

## 2. Data Flow: Active Today

### 2.1 Database

- **RPC:** `admin_get_active_today_count()`  
  - **Migration:** `20260225100002_admin_get_active_today_count.sql`  
  - **Returns:** `TABLE (active_count bigint)`  
  - **Logic:** `count(DISTINCT user_id)` from `auth.sessions` where `GREATEST(updated_at, refreshed_at, created_at) > now() - interval '24 hours'`  
  - **Fallback (if RPC missing):** API uses `get_active_sessions(1440)` and counts distinct `user_id`.

- **RPC:** `get_active_sessions(active_minutes)`  
  - **Migration:** `20260225000001_get_active_sessions.sql`  
  - **Returns:** `user_id`, `email`, `last_active_at` from `auth.sessions` + `auth.users` for last N minutes.  
  - **Used for:** (1) "Concurrent active users" (15 min), (2) fallback for "Active today" count (1440 min) when `admin_get_active_today_count` is missing or errors.

### 2.2 API: `/api/admin/active-today`

- **File:** `src/app/api/admin/active-today/route.ts`  
- **Auth:** `requireAdmin` + `requirePermission(read_applications)`.  
- **Logic:** Calls `admin_get_active_today_count().maybeSingle()`; on error or missing RPC uses `get_active_sessions(1440)` and `Set(user_id).size`.  
- **Response:** `{ count: number }` (always 0 or positive).  
- **Possible failures:** 403 (no permission), 500 (missing Supabase key). Client treats non-ok as `null`.

### 2.3 API: `/api/admin/overview-stats`

- **File:** `src/app/api/admin/overview-stats/route.ts`  
- **Auth:** `requireAdmin` + `requirePermission(read_applications)`.  
- **Cache:** 60s in-memory; returns `activeToday`, `overviewCounts`, `activeSessions`, etc.  
- **RPC:** `admin_get_all_stats().single()`.  
  - **Important:** `admin_get_all_stats` is **not defined in repo migrations** (only `ALTER FUNCTION` in `20260302100006`). If missing in DB, this returns 500 and the whole overview request fails.  
- **activeToday in response:** If RPC doesn’t return it, route calls `admin_get_active_today_count()` then fallback `get_active_sessions(24*60)` and sets `body.activeToday = activeToday ?? 0`.  
- **Response shape:** `{ stats, activeToday, activeSessions, overviewCounts: { totalUsers, verifiedCount, ... } }`.  
- **Possible failures:** 403, 500 (e.g. missing `admin_get_all_stats`), timeout. Client treats non-ok or throw as `null`.

### 2.4 Client: fetch and state

- **State:** `activeUsersToday` is `useState<number>(0)` (initial 0).  
- **Fetch (parallel):** `fetchOverviewStats()`, `loadTabData()`, `fetchActiveToday()`.  
- **fetchActiveToday:** `GET /api/admin/active-today` → parses `data.count` → returns `number | null` (null on !res.ok or parse failure).  
- **fetchOverviewStats:** `GET /api/admin/overview-stats` → parses `data.activeToday` (null if missing or not a number).  
- **Merge logic (loadData):**
  - If overview **403:** `setActiveUsersToday(0)`, `setOverviewCounts(null)`.  
  - If overview **success:**  
    `activeTodayValue = activeTodayFromApi ?? overview.activeToday ?? overview.activeSessions?.count ?? 0`  
    then `setActiveUsersToday(activeTodayValue)`.  
  - If overview **null** (500/timeout): `setActiveUsersToday(activeTodayFromApi ?? (fetchActiveSessions().count ?? 0))`.  
- So after load, `activeUsersToday` should always be a number (0 or positive). The only way it could stay "empty" in UI is if the **component** received `null` (e.g. old bundle where state was still `number | null` and was never set, so React rendered `{null}` as nothing → looks like "—").

### 2.5 UI: Overview tab

- **Component:** `OverviewTab` receives `activeUsersToday: number`.  
- **StatCard:** `<StatCard title="Active today" value={activeUsersToday} ... />`.  
- **StatCard contract:** `value: number | string`. If `value` is `null` or `undefined`, React renders nothing → blank/dash.  
- **Defensive fix:** StatCard now renders `{value ?? value === 0 ? value : 0}` (or equivalent) so that `null`/`undefined` show as `0`.

---

## 3. Data Flow: Verified

### 3.1 Database

- **RPC:** `admin_get_overview_counts()` (used inside `admin_get_all_stats` if that wrapper exists).  
- **Migration:** `20260229100001_admin_overview_counts_use_profiles.sql`  
- **Column:** `verified_count bigint`  
- **Logic:**  
  `(SELECT count(DISTINCT user_id)::bigint FROM public.verification_requests WHERE upper(trim(coalesce(status::text, ''))) = 'APPROVED')`  
- So **Verified** = number of distinct users with at least one **APPROVED** row in `verification_requests`, **not** `profiles.is_verified`.

### 3.2 API

- **overview-stats** returns `overviewCounts.verifiedCount` from parsed RPC (e.g. `admin_get_all_stats` → overview.verifiedCount).  
- Mapping in route: `verifiedCount: Number(parsed.overview?.verifiedCount) || 0`.  
- If overview-stats fails (500/403), client never gets `overviewCounts`.

### 3.3 Client

- **Computed:** `verifiedUsersCount = overviewCounts?.verifiedCount ?? users.filter(u => u.is_verified).length`  
- So if overview failed or `overviewCounts` is null, we use the **current users list** (first page) and count `is_verified`. If that list is empty or no one is verified, we get 0.  
- **Display:** `<StatCard title="Verified" value={verifiedUsersCount ?? 0} ... />`.

### 3.4 Why Verified can be 0

- **Correct:** No rows in `verification_requests` with status `APPROVED` → 0.  
- **Correct:** Overview failed and the loaded `users` slice has no `is_verified === true` → 0.  
- **Mismatch:** If "Verified" is intended to mean "profiles with is_verified = true", that is a different metric; current DB uses `verification_requests` APPROVED count. Document which definition product wants.

---

## 4. Why "Concurrent active users" Shows 1 but "Active today" Shows —

- **Concurrent active users:** Uses `activeSessions` from overview-stats (when user has `active_sessions` permission) or from `fetchActiveSessions()` in the overview-failed branch. Both use `get_active_sessions(15)`. So "1 active now" is correct.  
- **Active today:** Uses `admin_get_active_today_count()` (24h) or fallback `get_active_sessions(1440)`. If the **overview-stats** call fails (e.g. 500 because `admin_get_all_stats` is missing), the client goes to the `else` branch and sets `activeUsersToday = activeTodayFromApi ?? activeSessionsData?.count`. So if `/api/admin/active-today` also failed (403/500), we’d use `activeSessionsData?.count` (the 15‑minute count). That would be 1, not "—". So if the user still sees "—", the most likely explanation is **stale front-end**: an old bundle where `activeUsersToday` was `number | null`, never set (e.g. both requests failed or didn’t run), and the card rendered `{null}` as blank.  
- **Defense:** StatCard now coerces `value` to a number and displays 0 when `value` is null/undefined, so even with stale state or missed fetches we show 0 instead of blank.

---

## 5. RPC `admin_get_all_stats` (Missing in Repo)

- **Referenced in:** `src/app/api/admin/overview-stats/route.ts`  
- **Expected return shape:** Single row with `stats` (app counts), `overview` (totalUsers, verifiedCount, newUsers*, threads, messages, apps*), and optionally `activeToday`.  
- **Repo:** No `CREATE FUNCTION` for `admin_get_all_stats`; only `ALTER FUNCTION ... SET search_path` in `20260302100006_fix_admin_functions_search_path.sql`.  
- **Implication:** If this RPC does not exist in the project’s Supabase DB (e.g. created elsewhere or never applied), `overview-stats` returns 500 and the client sees no overview data. Then:
  - **Active today** is taken from `/api/admin/active-today` and/or `get_active_sessions(15)` fallback (so we can still show a number if those succeed).  
  - **Verified** falls back to `users.filter(u => u.is_verified).length` (first page only).  
- **Recommendation:** Either (1) add a migration that creates `admin_get_all_stats()` (e.g. calling `admin_get_overview_app_stats()`, `admin_get_overview_counts()`, and optionally `admin_get_active_today_count()` and returning one composite row), or (2) change overview-stats to call `admin_get_overview_app_stats`, `admin_get_overview_counts`, and active-today separately and build the response in the route (no dependency on a single RPC).  
- **Done:** overview-stats route now has a **fallback**: when `admin_get_all_stats` errors or is missing, it calls `admin_get_overview_app_stats()` and `admin_get_overview_counts()` separately and builds `stats` / `overviewCounts`, so the dashboard works without the composite RPC.

---

## 6. Checklist: Ensure Active Today and Verified Always Show a Number

- [x] `activeUsersToday` state type is `number`, initial 0.  
- [x] On overview 403, `setActiveUsersToday(0)`.  
- [x] Merge uses `?? 0` so we always set a number.  
- [x] StatCard displays `value ?? 0` (or equivalent) so null/undefined render as 0.  
- [x] Verified card uses `verifiedUsersCount ?? 0`.  
- [ ] Deploy latest bundle so production runs the above.  
- [ ] (Optional) Add or fix `admin_get_all_stats` in DB for single-call optimization; overview-stats already falls back to separate RPCs when it’s missing.

---

## 7. File Reference

| Layer | File | Relevant part |
|-------|------|----------------|
| DB | `supabase/migrations/20260225100002_admin_get_active_today_count.sql` | 24h active count |
| DB | `supabase/migrations/20260225000001_get_active_sessions.sql` | 15m / 1440m sessions |
| DB | `supabase/migrations/20260229100001_admin_overview_counts_use_profiles.sql` | verified_count, total_users, etc. |
| API | `src/app/api/admin/active-today/route.ts` | GET → { count } |
| API | `src/app/api/admin/overview-stats/route.ts` | GET → stats, activeToday, overviewCounts |
| Client | `src/app/admin/page.tsx` | loadData, fetchOverviewStats, fetchActiveToday, state, OverviewTab, StatCard |
