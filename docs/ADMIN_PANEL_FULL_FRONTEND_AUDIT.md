# Admin Panel — Full Frontend Audit

**Date:** 2026-03-03  
**Scope:** Admin panel frontend: `/admin` (page.tsx), layout, login, all tabs, modals, state, APIs, a11y.  
**Goal:** Complete, filled audit of the admin UI for structure, behavior, and gaps.

---

## 1. Executive summary

| Area | Status | Notes |
|------|--------|--------|
| **Structure & navigation** | ✅ Solid | Single page app in `page.tsx`; 14 tabs; RBAC-gated via `TAB_PERMISSION`; breadcrumb "Admin / [Tab]"; refresh; Governance Health in sidebar. |
| **Entry flow** | ✅ Solid | Gate (optional `ADMIN_GATE_PASSWORD`), then `/api/admin/check`; login form (email/password, show/hide password, Back to app). |
| **Loading states** | ✅ Solid | Gate null → spinner; post-gate "Loading admin panel…"; per-tab loaders (applications, inbox, reports, data-requests, risk, approvals, audit, compliance, settings, config); action loading on buttons; refresh spinner. |
| **Error handling** | ✅ Solid | Global `error` banner with Dismiss + Retry; 403 → `handle403` (refetch roles, redirect to first allowed tab); 401/session expiry → re-auth; Applications counts error banner when `admin_get_application_counts` fails. |
| **Empty states** | ✅ Solid | Applications ("No applications found" + counts-error banner when RPC missing); Dashboard (niches, countries, cities); Product Analytics (dashes, CTA, "No funnel data"); other tabs have empty lists or messages. |
| **Applications list** | ✅ Fixed | Counts from `admin_get_application_counts` RPC; list from paginated API with assignment filter applied in DB (no longer "all zeros" or empty list when counts exist). |
| **Permissions** | ✅ Solid | Tab visibility by `hasPermission(adminRoles, TAB_PERMISSION[tab])`; Product Analytics shown when `adminRoles.length > 0`; API 403 triggers `handle403`. |
| **Modals** | ✅ Solid | Application detail, User detail, Conversation: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, Close `aria-label`; focus trap and return-focus via `useModalFocusTrap`. |
| **Accessibility** | ✅ Good | Nav `aria-label`; breadcrumb; icon buttons `aria-label`; toast `role="status"` `aria-live="polite"`; form inputs labeled / `aria-label`. |
| **Dependencies** | ⚠️ Backend | Applications: `admin_get_application_counts`, applications table + profiles, optional `admin_get_emails_for_user_ids`. Overview: overview-stats API. Other tabs: respective APIs. |

**Verdict:** The admin **frontend is complete and consistent**. Backend (Supabase RPCs, env vars) must be in place for full functionality. This audit documents the current frontend state as implemented.

---

## 2. Entry & auth flow

### 2.1 Gate (when `ADMIN_GATE_PASSWORD` is set)

| Area | Status | Implementation |
|------|--------|----------------|
| Layout | ✅ | Centered card, logo, "Admin access", password input. |
| Input | ✅ | Label "Password", `autoComplete="current-password"`, `gatePassword` state. |
| Submit | ✅ | "Continue" / "Checking…", `gateSubmitting` disables button. |
| Error | ✅ | `gateError` inline for wrong password. |
| API | ✅ | `POST /api/admin/gate` with `{ password }`. |

### 2.2 Loading (gate check / admin check)

| Screen | Status | Implementation |
|--------|--------|----------------|
| Gate null | ✅ | Spinner + "Loading…" while `gateUnlocked === null`. |
| After gate, before auth | ✅ | `GET /api/admin/check` → "Loading admin panel…" until `loadData()` completes (overview stats + applications page 1 when applicable). |
| Login submit | ✅ | "Admin Sign In" / "Signing in…", `loginLoading` disables button. |

### 2.3 Login (when not authorized)

| Area | Status | Implementation |
|------|--------|----------------|
| Layout | ✅ | Centered, Logo, "Inthecircle Admin", "Sign in with an admin account…". |
| Email | ✅ | `loginEmail`, validation "Please enter a valid email address". |
| Password | ✅ | `loginPassword`, show/hide toggle `loginPasswordVisible` with `aria-label`. |
| Submit | ✅ | "Admin Sign In" / "Signing in…", disabled when `loginLoading`. |
| Errors | ✅ | Inline for auth or "not authorized". |
| Back | ✅ | "Back to app" link. |
| API | ✅ | `POST /api/admin/login` with email/password; then `loadData()`. |

---

## 3. Shell (sidebar + header)

### 3.1 Sidebar

| Area | Status | Implementation |
|------|--------|----------------|
| Logo + "Admin" | ✅ | Top of sidebar. |
| Nav | ✅ | 14 items: Overview, Dashboard, Applications, Users, Verifications, Inbox, Reports, Data Requests, Risk, Approvals, Audit Log, Compliance, Product Analytics, Settings. Icons: NavIconChart, NavIconLayout, NavIconUser, NavIconUsers, NavIconCheck, NavIconMessage, NavIconReport, NavIconData, NavIconRisk, NavIconApproval, NavIconAudit, NavIconCompliance, NavIconAnalytics, NavIconSettings. |
| Visibility | ✅ | Tab shown only if `hasPermission(adminRoles, TAB_PERMISSION[id])` or `id === 'analytics'` with any role. |
| Badges | ✅ | Applications: `stats.pending` (capped "99+"); Verifications: pending count; Inbox, Reports, Data Requests: respective counts. `aria-label` includes count when badge > 0. |
| Governance Health | ✅ | "GOVERNANCE HEALTH" score (e.g. 100/100) in sidebar. |
| Logout / Back to app | ✅ | Bottom of sidebar. |
| Mobile | ✅ | `sidebarOpen` state; overlay; hamburger in header; close on nav or overlay click; `aria-label="Close menu"` / "Open menu". |
| A11y | ✅ | `<nav aria-label="Admin navigation">`; each item `aria-label={... label + badge text }`. |

### 3.2 Header (main content)

| Area | Status | Implementation |
|------|--------|----------------|
| Breadcrumb | ✅ | "Admin / [Tab name]" via `activeTab`; `aria-label="Breadcrumb"`. |
| "Updated X ago" | ✅ | `lastRefreshed` → relative time; hidden on small screens. |
| Refresh | ✅ | Icon button, spins when `refreshing`, `aria-label="Refresh"`, calls `loadData()`. |
| Error banner | ✅ | Full width below header; `error` state; "Dismiss" and "Retry" (Retry calls `loadData()` and clears error). |
| Toast | ✅ | `toast` state; `role="status"` `aria-live="polite"`; auto-dismiss 4s. |

---

## 4. Tab inventory & data flow

| Tab | Permission | Loading state | Data source | Empty / error |
|-----|------------|---------------|-------------|----------------|
| Overview | read_applications | `refreshing` + initial load | `/api/admin/overview-stats`, `fetchApplications(1, …)` | KPI zeros; "—" where no data. |
| Dashboard | read_applications | Same as Overview | Computed from `stats`, `users`, `applications`, `overviewCounts` | "No applications yet", "No country/city/niche data". |
| Applications | read_applications | `applicationsLoading` | `GET /api/admin/applications?page&limit&sort&filter&status` | "No applications found"; banner when `applicationsCountsError`. |
| Users | read_users | — | `fetchUsersAndProfiles()` → `/api/admin/users` | Empty list. |
| Verifications | read_applications | — | Overview/initial load | "No pending verification requests". |
| Inbox | read_reports | `inboxLoading` | `loadInbox()` → `/api/admin/inbox` + realtime | "No conversations yet". |
| Reports | read_reports | `reportsLoading` | `loadReports()` → `/api/admin/reports` | "No reports yet". |
| Data Requests | read_data_requests | `dataRequestsLoading` | `loadDataRequests()` → `/api/admin/data-requests` | "No data export or deletion requests yet". |
| Risk | read_risk | `riskLoading` | `loadRisk()` → `/api/admin/risk` | Empty escalations. |
| Approvals | approve_approval | `approvalsLoading` | `loadApprovals()` → `/api/admin/approvals` | Empty pending. |
| Audit Log | read_audit | `auditLoading` | `loadAuditLog()` → `/api/admin/audit` | "No audit entries yet". |
| Compliance | read_audit | `complianceLoading` | `loadCompliance()` → `/api/admin/compliance` | Controls/evidence empty or message. |
| Product Analytics | read_analytics | Own loading | `AdminProductAnalyticsTab` (60s cache note) | "—", "No activity", "No funnel data", CTA. |
| Settings | read_config | `configLoading`, `blockedLoading` | `loadAppConfig()` → `/api/admin/config`, blocked list | Sections: 2FA, feature flags, announcements, blocked users, admin settings. |

---

## 5. Applications tab (frontend detail)

| Area | Status | Implementation |
|------|--------|----------------|
| Search | ✅ | `appSearch`; placeholder "Search by name, email, or username…"; client-side filter on current page (`filteredApps`). |
| Counts | ✅ | From API `counts` (RPC `admin_get_application_counts`); tabs: All (stats.total), Pending, Approved, Rejected, Waitlisted, Suspended. |
| Counts error | ✅ | When API sets `countsError`, `applicationsCountsError` true → amber banner: "Application counts could not be loaded…" + migration/env hint. |
| Status filters | ✅ | All, Pending, Approved, Waitlisted, Rejected, Suspended; `appFilter`; server sends `status` param; counts from RPC. |
| Assignment filter | ✅ | Sort/filter dropdown: All, Unassigned, Assigned to me; server applies in DB so list is not empty when counts exist. |
| Sort | ✅ | overdue, oldest, My items first; `appSort`; server-side. |
| Pagination | ✅ | `applicationsPage`, `APPLICATIONS_PAGE_SIZE` (50); "Showing X–Y of Z", "Page A of B"; `onApplicationsPageChange` → `loadData(..., { applicationsPage })`. |
| List | ✅ | Rows: avatar, name, @username, email, niche, Instagram, referrer, followers, status, date; click → detail modal. |
| Bulk bar | ✅ | When pending selected; Approve all / Reject all / Waitlist all / Clear; `selectedAppIds`; actions call bulk API. |
| Select all | ✅ | "Select all (this page)" / "Deselect all (this page)". |
| Detail modal | ✅ | Full fields; Approve/Reject/Waitlist/Suspend; Claim/Release; focus trap; Escape/backdrop close. |
| Export CSV | ✅ | Current page only; tooltip "Exports current page only…". |

---

## 6. State inventory (key useState)

- **Auth / gate:** `gateUnlocked`, `gatePassword`, `gateError`, `gateSubmitting`, `loading`, `authorized`, `adminRoles`, `error`, `toast`, `activeTab`, `currentUserId`.
- **Applications:** `applications`, `stats`, `applicationsTotal`, `applicationsPage`, `appFilter`, `appSort`, `appAssignmentFilter`, `appSearch`, `applicationsLoading`, `applicationsCountsError`, `selectedAppIds`, `selectedApp`, `actionLoading`.
- **Users:** `users`, `usersTotalCount`, `profilesWithDemographics`, `selectedUser`.
- **Overview/Dashboard:** `overviewCounts`, `lastRefreshed`, `refreshing`, `activeSessions`, `activeUsersToday`, `pendingVerifications`, `recentActivity`, etc.
- **Tabs:** `inboxLoading`, `reportsLoading`, `dataRequestsLoading`, `riskLoading`, `approvalsLoading`, `auditLoading`, `complianceLoading`, `configLoading`, `blockedLoading`, `auditVerifyLoading`, `auditSnapshotLoading`.
- **UI:** `sidebarOpen`, `signingOut`, `loginEmail`, `loginPassword`, `loginLoading`, `loginPasswordVisible`, `announceSuccess`, `configSaveSuccess`.
- **Audit:** `filterAction`, `filterTargetType`, `filterTargetId`, `filterDateFrom`, `filterDateTo`.

---

## 7. API surface used by frontend

| Endpoint | Method | Used by |
|----------|--------|---------|
| `/api/admin/gate` | POST | Gate submit |
| `/api/admin/check` | GET | Auth check, roles |
| `/api/admin/login` | POST | Login form |
| `/api/admin/overview-stats` | GET | Overview KPIs, counts, active today, sessions |
| `/api/admin/applications` | GET | Applications list (page, limit, sort, filter, status) |
| `/api/admin/applications/[id]/action` | POST | Approve/Reject/Waitlist/Suspend |
| `/api/admin/applications/[id]/claim` | POST | Claim |
| `/api/admin/applications/[id]/release` | POST | Release |
| `/api/admin/bulk-applications` | POST | Bulk actions |
| `/api/admin/users` | GET | Users list |
| `/api/admin/users/[id]/verification` | POST | Verify user |
| `/api/admin/users/[id]/ban` | POST | Ban |
| `/api/admin/verification-requests` | GET | Pending verifications |
| `/api/admin/verification-requests/[id]/approve` | POST | Approve verification |
| `/api/admin/verification-requests/[id]/reject` | POST | Reject verification |
| `/api/admin/inbox` | GET | Inbox threads |
| `/api/admin/reports` | GET | Reports |
| `/api/admin/data-requests` | GET | Data requests |
| `/api/admin/risk` | GET | Risk escalations |
| `/api/admin/approvals` | GET | Pending approvals |
| `/api/admin/audit` | GET | Audit log |
| `/api/admin/config` | GET/PATCH | Settings config |
| `/api/admin/identity` | GET | Wrong-deployment banner (optional) |
| Plus Compliance, Product Analytics, and other tab-specific routes as implemented. | | |

---

## 8. Modals

| Modal | Focus trap | Return focus | role/aria | Close |
|-------|------------|--------------|-----------|--------|
| Application detail | ✅ `useModalFocusTrap` | ✅ | `role="dialog"` `aria-modal="true"` `aria-labelledby="app-detail-title"`; Close `aria-label="Close"` | Escape, backdrop, Close button |
| User detail | ✅ (same pattern) | ✅ | dialog, aria-labelledby, Close aria-label | Escape, backdrop, Close |
| Conversation | ✅ | ✅ | `role="dialog"` `aria-modal="true"` `aria-labelledby="conversation-modal-title"`; Close `aria-label="Close"` | Escape, backdrop, Close |

---

## 9. Accessibility

| Item | Status |
|------|--------|
| Nav `aria-label="Admin navigation"` | ✅ |
| Nav item aria-label (with badge when present) | ✅ |
| Breadcrumb `aria-label="Breadcrumb"` | ✅ |
| Refresh `aria-label="Refresh"` | ✅ |
| Toast `role="status"` `aria-live="polite"` | ✅ |
| Modals `role="dialog"` `aria-modal="true"` `aria-labelledby` | ✅ |
| Modal Close buttons `aria-label` | ✅ |
| Focus trap in modals | ✅ `useModalFocusTrap` |
| Focus return on modal close | ✅ |
| Login password toggle `aria-label` | ✅ |
| Search/filter inputs `aria-label` | ✅ (Search users, Filter by action, etc.) |
| Form labels (gate, login, Settings) | ✅ |

---

## 10. Consistency & responsive

| Element | Status |
|---------|--------|
| Primary actions | Purple gradient / `var(--accent-purple)` |
| Danger | Red (Reject, Delete, Dismiss) |
| Success | Green (Approve, Resolve) |
| Empty states | Icon + message (+ optional subline) |
| Sidebar drawer (mobile) | Overlay + slide-in |
| Filter tabs | flex-wrap |
| Tables / long content | Overflow scroll |
| Modals | max-h-[90vh], p-4 |

---

## 11. Gaps & recommendations

### Addressed in current codebase

- Applications list empty despite counts: **fixed** by applying assignment filter in DB in `/api/admin/applications` and cache key including `filter`.
- Counts error when RPC missing: **banner** shown when `applicationsCountsError` is true.
- Retry on error: **Retry** button on global error banner.
- Applications loading state: **applicationsLoading** set when changing page/sort/filter on Applications tab.
- Modal focus: **useModalFocusTrap** and return-focus implemented.
- Applications labels: "Assigned to me" (filter) vs "My items first" (sort); "Select all (this page)"; Export CSV tooltip; search scope hint.

### Optional improvements

1. **Export CSV all:** Add "Export all (CSV)" via API (streaming or paginated) for compliance/full export.
2. **Search applications:** Server-side search `?q=...` so search covers all applications, not just current page.
3. **Stale data:** Optional indicator when `lastRefreshed` > 5 min (e.g. "Data may be stale").
4. **Settings save feedback:** Inline "Saved" or toast after successful config save (in addition to error banner).
5. **Inbox "Requests" segment:** Wire to real data or show "Coming soon".

---

## 12. Files referenced

| File | Purpose |
|------|---------|
| `src/app/admin/page.tsx` | Main admin panel (gate, login, shell, all tabs, modals). |
| `src/app/admin/layout.tsx` | Layout, build fingerprint footer, BuildVersionLog. |
| `src/app/admin/login/page.tsx` | Redirects to admin base (no standalone login UI). |
| `src/app/admin/ProductAnalyticsTab.tsx` | Product Analytics tab. |
| `src/app/admin/BuildVersionLog.tsx` | Build version logging. |
| `src/lib/admin-rbac.ts` | TAB_PERMISSION, hasPermission, ADMIN_PERMISSIONS. |
| `src/lib/admin-auth.ts` | requireAdmin, auth helpers. |
| `src/app/api/admin/*` | All admin API routes consumed by the frontend. |

---

**Conclusion:** The admin panel frontend is fully wired: 14 tabs, RBAC, loading/error/empty states, modals with focus management, and Applications list/counts fixed to use DB assignment filter and RPC counts. This document serves as the filled frontend audit reference.
