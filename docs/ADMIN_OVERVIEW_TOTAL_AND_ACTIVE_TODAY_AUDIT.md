# Admin Overview: Total Users & Active Today – Audit & Fix

## Problem Summary

- **Total users** sometimes showed wrong value (e.g. 500 or 54 instead of real count like 1824).
- **Active today** sometimes showed "—" (missing) even when concurrent active users showed 1–2.
- Fixing one metric seemed to break the other because both were tied to the same overview-stats response and branching.

## Root Causes

### 1. Total users

- **Display formula** was `overviewCounts?.totalUsers ?? usersTotalCount ?? users.length`.
- Overview-stats returns `overviewCounts.totalUsers` from RPC `admin_get_all_stats()`, which may be wrong, capped, or stale (e.g. 500).
- The **correct** count comes from `GET /api/admin/users`, which returns `total` from `profiles` count.
- When overview succeeded, the UI preferred overview’s wrong total over the users API total.

### 2. Active today

- **Source** was overview-stats first (`overview.activeToday`); fallback was `GET /api/admin/active-today` only when `overview.activeToday == null`.
- Overview-stats gets `activeToday` from:
  - RPC `admin_get_all_stats()` (if it returns it), or
  - Fallback: RPC `admin_get_active_today_count()` inside overview-stats when the first doesn’t provide it.
- If overview-stats returned `activeToday: null` (e.g. RPC missing or failed), the client called `fetchActiveToday()`.
- **Permission mismatch**: `GET /api/admin/active-today` requires `active_sessions`. Only **compliance** and **super_admin** have it. **viewer**, **moderator**, **supervisor** can load overview (read_applications) but get **403** on active-today, so the fallback never filled the card.
- So for most roles, Active today depended entirely on overview-stats including the value; if it didn’t, the card stayed "—".

### 3. Coupling

- Both metrics were driven by the same overview-stats call and the same success/failure path.
- Changing total users to prefer `usersTotalCount` didn’t touch Active today logic, but deployment/cache could make it look like “fixing total broke active today” when the real issue was permission + single-source reliance on overview for active today.

## Design Principles (End-to-End)

1. **Total users**: Single source of truth = **users API** (`GET /api/admin/users` → `total`). Overview is fallback only before users have loaded.
2. **Active today**: Two independent sources; prefer **dedicated endpoint** so it never depends only on overview:
   - Always call `GET /api/admin/active-today` when loading overview (in parallel).
   - Set the card from that response; if null, use `overview.activeToday`.
3. **Permissions**: Any admin who can open the overview should see both numbers. So active-today endpoint uses **read_applications** (same as overview), not **active_sessions**.
4. **Overview-stats**: Keeps server-side fallback for `activeToday` (from `admin_get_active_today_count`) for caching and consistency; client does not rely on it as the only source.

## Implemented Fixes

### 1. Total users (already done)

- **Formula**: `totalUsers = usersTotalCount ?? overviewCounts?.totalUsers ?? users.length`
- Users API is preferred; overview only when users total not yet loaded.

### 2. Active today – permission

- **File**: `src/app/api/admin/active-today/route.ts`
- **Change**: Require `read_applications` instead of `active_sessions`.
- **Reason**: Same as overview-stats; any role that can see the overview can see the count.

### 3. Active today – parallel fetch and merge

- **File**: `src/app/admin/page.tsx` (loadData)
- **Change**:
  - When loading overview, run **three** requests in parallel: `fetchOverviewStats()`, `loadTabData(activeTab, thisLoadId)`, `fetchActiveToday()`.
  - After they complete, set **Active today** from the dedicated fetch first:  
    `activeUsersToday = activeTodayFromApi ?? overview.activeToday ?? null`  
    (i.e. use dedicated result if not null, else overview, else null).
- **Reason**: Active today no longer depends only on overview; we always have a second source and avoid 403 making the card stay empty for viewer/moderator/supervisor.

### 4. Overview-stats (already done)

- When `admin_get_all_stats` doesn’t return `activeToday`, overview-stats calls `admin_get_active_today_count()` and sets `body.activeToday`.
- Preserve `0` (do not coerce to null).

## Data Flow After Fix

| Metric        | Primary source              | Fallback              | When it can be wrong / empty        |
|---------------|-----------------------------|------------------------|-------------------------------------|
| Total users   | Users API `total`           | overviewCounts.totalUsers, then users.length | Only before users load or if users API fails |
| Active today  | GET /api/admin/active-today | overview.activeToday   | Only if both fail (e.g. RPC missing) |

## How to Verify

1. **Total users**: Load overview; card should show same number as “Export users” list total (or DB `profiles` count). Refresh; number should stay correct.
2. **Active today**: As viewer (or any role with read_applications), load overview; card should show a number or 0, never "—" (unless RPC is missing in DB).
3. **Concurrent active users**: Still from overview-stats when user has `active_sessions`; independent of Active today count.

## Migrations / DB

- `admin_get_active_today_count()` must exist (migration `20260225100002_admin_get_active_today_count.sql`). If it’s missing in an environment, both overview-stats fallback and the active-today endpoint will fail for that metric until the migration is applied.
