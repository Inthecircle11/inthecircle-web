# Admin Panel — Full UX Audit

**Date:** 2026-03-02  
**Scope:** Admin panel (`/admin`), all tabs and flows.  
**Goal:** Confirm the panel is solid and everything works 100%.

---

## 1. Executive summary

| Area | Status | Notes |
|------|--------|--------|
| **Structure & navigation** | ✅ Solid | 14 tabs, RBAC-gated, Product Analytics always visible for authorized admins, breadcrumb, refresh. |
| **Loading states** | ✅ Solid | Global loading (gate, auth, initial load), per-tab loading (inbox, reports, data-requests, risk, approvals, audit, compliance), refresh spinner, action loading on buttons. |
| **Error handling** | ✅ Solid | Global error banner with Dismiss, 403 → refetch roles + redirect to first allowed tab, session expiry → re-auth, API errors surface in banner or toast. |
| **Empty states** | ✅ Solid | Applications, Dashboard (top niches, countries, cities, demographics), Product Analytics (overview —, feature usage CTA, funnels). |
| **Permissions** | ✅ Solid | Tab visibility by permission; 403 on API triggers handle403; Product Analytics visible to any admin with roles. |
| **Dependencies** | ⚠️ Backend | Applications list/actions require Supabase: `admin_get_applications_fast`, `admin_get_application_counts`, `admin_application_action_v2`, and `applications` columns. Clear error messages added when these are missing. |
| **Identity & deployment** | ✅ Solid | Wrong-deployment banner if `/api/admin/identity` returns wrong app; toast for success/error. |

**Verdict:** The admin **UI/UX is solid**. The only recurring failure mode is **backend/database**: missing RPCs or columns cause “Operation failed” (or the new, specific messages). Ensure migrations are applied and env vars set so the panel works 100%.

---

## 2. Structure & navigation

- **Tabs (in order):** Overview, Dashboard, Applications, Users, Verifications, Inbox, Reports, Data Requests, Risk, Approvals, Audit Log, Compliance, Product Analytics, Settings.
- **Visibility:** Each tab is shown only if the user has the required permission (`TAB_PERMISSION`). Product Analytics is shown for any admin with at least one role (no separate permission check in the nav).
- **Mobile:** Sidebar collapses to overlay; open/close with aria-labels.
- **Breadcrumb:** “Admin / [Tab name]” in header.
- **Refresh:** Header “Updated X ago” + refresh button; clicking sets `refreshing` and calls `loadData()`; refresh icon spins while `refreshing`.
- **Governance health:** Shown in sidebar (e.g. 100/100); Compliance tab has detail.

---

## 3. Loading states

- **Gate:** Spinner while `gateUnlocked === null`.
- **Post-gate auth:** “Loading admin panel…” until `/api/admin/check` and initial `loadData()` complete.
- **Login form:** Submit shows “Checking…” and disables button.
- **Per-tab data:**  
  - Inbox: `inboxLoading` passed to `InboxTab`.  
  - Reports, Data Requests, Risk, Approvals, Audit, Compliance: each section has a `loading` prop and shows a loading state in the tab.
- **Actions:** `actionLoading` (application or user id) disables/spins the relevant Approve/Reject/Waitlist/Claim/etc. buttons.
- **Bulk actions:** `actionLoading === 'bulk'` used during bulk application actions.

---

## 4. Error handling

- **Global banner:** When `error` is set, a red banner shows the message and a “Dismiss” button (`setError(null)`).
- **403:** All relevant API paths call `handle403()` on 403: refetches roles, sets error to “You do not have permission to view this section.”, and switches to the first allowed tab.
- **401 / session expiry:** Various handlers set `setAuthorized(false)` and a “Session expired. Please log in again.” (or similar) message.
- **409:** Conflict messages (e.g. “Already claimed”, “Record changed by another moderator”) are shown in the banner.
- **429:** Rate limit message shown in banner.
- **Applications API:** Specific messages for missing DB function (42883) or column (42703) so admins know to run migrations.
- **Toast:** Success and error toasts (e.g. after anonymize, config save) with `aria-live="polite"`.

---

## 5. Empty states

- **Applications:** “No applications” or “No [filter] on this page” with short helper text; pagination hidden when empty.
- **Dashboard:** “No applications yet”, “No country data yet”, “No city data yet”, “No niche data yet” where relevant.
- **Product Analytics:** Overview shows “—” when no activity; “No activity in the last 30 days…”; feature usage has dashed card + `trackAppEvent()` CTA; funnels show “No funnel data yet.”
- **Other tabs:** Reports, Data Requests, Risk, Approvals, Audit, Compliance, Verifications, Inbox, Users each handle empty lists or “no data” in their UI.

---

## 6. Permissions & tab visibility

- **Map:** `TAB_PERMISSION` ties each tab to one permission (e.g. `read_applications`, `read_users`, `read_analytics`). `hasPermission(adminRoles, permission)` controls visibility.
- **Product Analytics:** Nav shows the tab if `adminRoles.length > 0` (always for authorized admins). API still enforces `read_analytics`.
- **Tab switch on 403:** If the current tab becomes disallowed after a 403, `activeTab` is set to the first allowed tab.
- **Initial tab:** On load, if current `activeTab` is not in the allowed list, it’s reset to the first allowed tab.

---

## 7. Section-by-section checklist

| Section | Loading | Error | Empty state | 403 handling | Notes |
|--------|---------|--------|-------------|----------------|------|
| Overview | Global load | Banner | Dashboard-style empties | handle403 if permissionDenied | Uses overview-stats + applications. |
| Dashboard | Global load | Banner | Top niches, countries, cities, demographics | — | Receives computed stats and lists. |
| Applications | Refresh + actionLoading | Banner + specific API messages | “No applications” / filter message | handle403, permissionDenied | Pagination, claim/release, approve/reject/waitlist/suspend, bulk, export CSV. |
| Users | actionLoading | Banner | — | — | Toggle verify/ban, delete, export, anonymize. |
| Verifications | actionLoading | Banner | — | — | Approve/reject pending. |
| Inbox | inboxLoading | — | Conversations list | — | Load inbox on tab open; realtime subs. |
| Reports | reportsLoading | Banner | — | handle403 | List, claim, resolve. |
| Data Requests | dataRequestsLoading | Banner | — | handle403 | List, update status. |
| Risk | riskLoading | Banner | — | handle403 | Escalations, metrics. |
| Approvals | approvalsLoading | Banner | — | handle403 | Pending approvals, approve/reject. |
| Audit | auditLoading | Banner | — | handle403 | Log, filters, verify chain, snapshot, repair. |
| Compliance | complianceLoading | Banner | — | handle403 | Controls, evidence, reviews, health. |
| Product Analytics | Own loading | Own error | Dashes, CTA, “No funnel data” | 403 → “No permission” | Separate component; 60s cache note. |
| Settings | configLoading | Banner | — | handle403 | Config, announce, roles, admin users. |

---

## 8. Accessibility

- **Nav:** `aria-label="Admin navigation"`; each nav item has an `aria-label` (including badge when present).
- **Breadcrumb:** `aria-label="Breadcrumb"`.
- **Refresh button:** `aria-label="Refresh"`.
- **Toast:** `role="status"` and `aria-live="polite"`.
- **Modals:** Focus trap and return-focus (e.g. conversation modal `role="dialog"`, `aria-modal="true"`, `aria-labelledby`).
- **Form inputs:** Labels and/or `aria-label` (e.g. search applications, search users, filter action/target type/date).
- **Buttons:** Dismiss, close menu, etc. have `aria-label` where needed.

---

## 9. What must be true for “100% working”

1. **Supabase**
   - Migrations applied so that `admin_get_applications_fast`, `admin_get_application_counts`, and `admin_application_action_v2` exist and `applications` has the expected columns (e.g. `updated_at`, `assigned_to`, `assigned_at`, `assignment_expires_at`).
   - Run `20260302100006_fix_admin_functions_search_path.sql` if those functions exist and you need to fix search_path.

2. **Vercel / env**
   - `ADMIN_BASE_PATH` set for production (required by next.config).
   - `ADMIN_EMAILS` or `ADMIN_USER_IDS` so admins can sign in.
   - `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (and any other required keys).

3. **Auth**
   - Admins sign in with an allowlisted account; roles come from `/api/admin/check` (e.g. from `admin_user_roles` + `admin_roles`). Backfill assigns `super_admin` if no roles.

4. **Deployment**
   - App served from **inthecircle-web**; wrong-deployment banner appears if identity API returns a different app name.

---

## 10. Recommendations

- **Done:** Retry on global error banner — error banner now has both **Retry** (calls `loadData()` and clears error) and **Dismiss**.
- **Done:** Applications list loading state — when changing page, sort, or filter on the Applications tab, a “Loading applications…” spinner is shown until the list refetches; `applicationsLoading` is cleared on any skipOverview load finish (including tab switch).
- **Already done (earlier):** Clearer Applications API errors for missing function/column; Product Analytics always in nav for authorized admins; Product Analytics UI (dashes, funnel bars, empty states).
- **Keep:** Domain check (`npm run verify-domain`), Vercel audit doc, and applying migrations so backend matches the panel’s expectations.

---

**Conclusion:** The admin panel UX is in good shape: consistent loading, errors, empty states, permissions, and accessibility. For everything to work 100%, ensure the database has the required admin RPCs and columns and that Vercel env and deployment are correct.
