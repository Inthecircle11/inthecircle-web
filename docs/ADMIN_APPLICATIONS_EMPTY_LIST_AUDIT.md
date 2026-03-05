# Admin Applications: "No applications found" despite counts (1824 / 1772) — End-to-end audit

**Date:** 2026-03-05  
**Symptom:** Applications tab shows **All (1824)**, **Pending (1772)**, etc., but the list area shows **"No applications found"**.

---

## 1. Executive summary

| Layer | Finding |
|-------|--------|
| **UI** | Shows "No applications found" when `applications.length === 0`; counts come from `stats` (same API response). |
| **Frontend** | Single request: `GET /api/admin/applications?page=1&limit=50&sort=overdue&filter=all&status=all`. Response is parsed once; `data.applications` and `data.counts` from same payload. |
| **API** | One handler: (1) RPC `admin_get_application_counts` → counts, (2) `supabase.from('applications').select('*').order(...).range(...)` → list. Same Supabase client (service role). |
| **Root cause** | **Backend:** The **list query** (direct table select via PostgREST) returns **0 rows** while the **counts RPC** returns **1824** for the same table. So the API responds with `{ applications: [], total: 1824, counts: { pending: 1772, ... } }`. |
| **Why counts ≠ list?** | Counts use **SECURITY DEFINER** RPC (runs as function owner, bypasses RLS). List uses **Supabase client** (service role). If RLS is enabled on `applications` and the service role’s session/context doesn’t bypass it in your project, or if there is a schema/search_path difference, the client select can see 0 rows while the RPC sees all. |

---

## 2. End-to-end data flow

### 2.1 Frontend (Applications tab)

1. **Entry:** `activeTab === 'applications'` → `loadData(undefined, { skipOverview: true })` runs.
2. **loadTabData('applications')** calls `fetchApplications(sort, filter, applicationsPage, APPLICATIONS_PAGE_SIZE, statusFilter)` with:
   - `sort` = `appSort` (default `'overdue'`)
   - `filter` = `appAssignmentFilter` (default `'all'`)
   - `statusFilter` = `appFilter` (default `'all'`)
3. **Request:**  
   `GET /api/admin/applications?page=1&limit=50&sort=overdue&filter=all&status=all`  
   (no other request is used for this tab’s counts or list.)

4. **Response handling (page.tsx):**
   - `parseAdminResponse(res, json)` → `data = { applications, total, counts }`
   - `setApplications(data.applications ?? [])`  ← **empty array**
   - `setApplicationsTotal(data.total)`         ← **1824**
   - `if (data.counts) setStats(data.counts)`    ← **{ pending: 1772, ... }**

5. **UI:**
   - **Filter counts** (All, Pending, …) use `stats` from `getFilterCount()` → shows **1824**, **1772**, etc.
   - **List** uses `applications` (passed as `filteredApps` after client-side search/status filter) → **empty** → "No applications found".

So the **same** API response carries both non-zero counts and an empty list; there is no frontend bug or second request overwriting the list.

### 2.2 Backend — GET /api/admin/applications

**File:** `src/app/api/admin/applications/route.ts`

1. **Auth:** `requireAdmin` + `requirePermission(read_applications)`. Uses **service role** client:  
   `getServiceRoleClient() ?? createClient(url, SUPABASE_SERVICE_ROLE_KEY)`.

2. **Counts:**
   - `await supabase.rpc('admin_get_application_counts').single()`
   - RPC is **SECURITY DEFINER**, `SET search_path = public`, `FROM applications`.
   - Returns `{ pending, approved, rejected, waitlisted, suspended, total }` (e.g. total 1824).

3. **List:**
   - `appsQuery = supabase.from('applications').select('*').order('submitted_at', { ascending: true })`
   - If `status !== 'all'` → `.in('status', dbStatuses)`
   - If `filter === 'unassigned'` → `.or('(assigned_to.is.null,assignment_expires_at.lt.<now>')`
   - If `filter === 'assigned_to_me'` → `.eq('assigned_to', result.user.id).gte('assignment_expires_at', now)`
   - `.range(offset, offset + limit - 1)` (e.g. 0–49 for page 1).
   - `const { data: appsData, error: appsError } = await appsQuery`
   - When the bug occurs: **appsError** is null, **appsData** is **[]** (0 rows).

4. **Response:**  
   `adminSuccess({ applications: list, total, page, limit, counts })`  
   with `list` from `appsData` (empty), `total` from counts (1824). So the API correctly returns what the DB gave: empty list + non-zero counts.

Conclusion: the **list query** (PostgREST `applications` select) returns 0 rows in the environment where it runs; the **counts RPC** returns 1824. So the issue is **backend/DB**: different visibility of `applications` between:

- RPC `admin_get_application_counts()` (SECURITY DEFINER, same schema), and  
- Service-role PostgREST select on `applications`.

Possible reasons:

- **RLS on `applications`:** In some setups the service role might not bypass RLS for the REST API path (e.g. role or API configuration). The DEFINER function always runs with definer rights and sees all rows.
- **Schema / search_path:** Less likely if both use `public`, but worth checking (e.g. multiple schemas, or PostgREST default schema).
- **Replication / read replica:** If counts and list hit different nodes and replica is behind, list could be empty; unlikely for a single table.

---

## 3. RPC vs direct select (fix applied)

| Source | Used for | Runs as | Sees |
|--------|----------|---------|------|
| `admin_get_application_counts()` | Counts | DEFINER (e.g. postgres) | All rows in `public.applications` |
| `admin_get_applications_page()` (new) | List (primary) | DEFINER | Same as counts; list and counts match. |
| `supabase.from('applications').select(...)` | List (fallback if RPC missing) | Service role via PostgREST | Can be 0 rows if RLS or context restricts |

The route now tries **admin_get_applications_page** first. If the RPC exists and succeeds, the list uses the same security context as the counts. If the RPC is missing, the route falls back to the direct select and logs a warning.

---

## 4. Files touched in audit

| File | Role |
|------|------|
| `src/app/admin/page.tsx` | loadData, fetchApplications, setApplications/setStats, ApplicationsTab with `filteredApps` and `getFilterCount(stats)` |
| `src/app/admin/tabs/ApplicationsTab.tsx` | Renders "No applications found" when `applications.length === 0`; receives `applications={filteredApps}` |
| `src/app/api/admin/applications/route.ts` | GET: RPC for counts; RPC admin_get_applications_page for list (fallback: direct select); returns `{ applications, total, counts }` |
| `src/lib/admin-client.ts` | parseAdminResponse: unwraps `data` from `{ ok, data, error }` |
| `supabase/migrations/20260303000001_fix_application_counts.sql` | admin_get_application_counts() SECURITY DEFINER |
| `supabase/migrations/20260305000001_admin_get_applications_page.sql` | admin_get_applications_page() SECURITY DEFINER for list |
| `src/lib/admin-applications-cache.ts` | No-op (cache removed); not responsible for empty list |

---

## 5. Recommendations

1. **Use an RPC for the list (implemented):** Migration `20260305000001_admin_get_applications_page.sql` adds `admin_get_applications_page(p_status, p_filter, p_assigned_to, p_limit, p_offset)` with **SECURITY DEFINER**. The API route tries this RPC first; if it succeeds, the list comes from the same security context as the counts. If the RPC is missing (e.g. migration not yet applied), the route falls back to the direct table select. **Apply the migration** so the list and counts always match.
2. **Verify production:** Check whether `applications` has RLS enabled and which roles bypass it; confirm schema and that the service role used by the API is the one that should bypass RLS.
3. **Logging:** Server logs when `rowCount === 0 && counts.total > 0` (and when falling back from RPC to direct select) so you can see mismatches.
4. **UI:** When the list is empty but `applicationsTotal > 0`, the Applications tab shows a short hint to apply the migration (see `ApplicationsTab.tsx`).

---

## 6. Conclusion

- **Not** a frontend bug: one request, one response; counts and list from same `data`.
- **Not** an API parsing bug: backend returns `applications: []` and `counts: { total: 1824, ... }` when the list query returns 0 rows.
- **Is** a backend/DB visibility issue: the **list query** (direct `applications` select) can return 0 rows while the **counts RPC** returns 1824. **Fix:** Use the new **SECURITY DEFINER** RPC `admin_get_applications_page` for the list (migration `20260305000001_admin_get_applications_page.sql`). Apply the migration, then redeploy; the list will be loaded via the RPC and match the counts.
