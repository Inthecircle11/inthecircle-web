# Phase 11: Stability & UX Hardening — Implementation Summary

**Goal:** Eliminate confusing permission states, silent failures, and missing surfaced controls from the production audit.

---

## 1. Files changed

| File | Changes |
|------|--------|
| `src/app/admin/page.tsx` | Permission UX (403 handling, tab filtering, PERMISSION_DENIED_MESSAGE); `loadData` applications 403 + no RPC fallback; all loaders 403 → permission message, no migration hints; `exportAuditCsv` error handling; Audit tab Verify chain + Create snapshot UI + state; anonymize/verification toasts; bulk 207 partial-success message; session revoke 403 toast; `SettingsTab` `showToast` prop. |
| `src/lib/admin-rbac.ts` | No changes (imported `hasPermission`, `ADMIN_PERMISSIONS` for tab filtering). |

**No API routes or contracts were changed.** All updates are client-side UX and error messaging; backend behavior and response shapes are unchanged.

---

## 2. Summary of improvements

### Part 1 — Permission UX hardening

- **403 handling:** For every admin data load (Applications via `loadData`, Audit, Reports, Data Requests, Config, Risk, Approvals, Compliance), when `response.status === 403` the UI shows: *"You do not have permission to view this section."* No migration/database hints and no RPC fallback on 403 for applications.
- **Applications 403:** `fetchApplications` returns `{ apps, permissionDenied }`; on 403 it returns `{ apps: [], permissionDenied: true }` and does **not** call `supabase.rpc('admin_get_applications')`. `loadData` sets the permission message and empty applications/stats when `permissionDenied` is true.
- **Tab filtering by role:** Sidebar tabs are filtered by permission: each tab id is mapped to a required permission (`TAB_PERMISSION`); only tabs for which `hasPermission(adminRoles, TAB_PERMISSION[id])` are shown. Compliance sees only Audit, Compliance, Risk, Data Requests, Reports (and no Overview/Applications/Users/Verifications/Inbox/Approvals/Settings if they lack the corresponding permission). Viewer sees tabs for which they have read permission; moderator/supervisor/super_admin see progressively more.
- **Redirect when current tab is hidden:** If the active tab is not in the visible list (e.g. after role change or compliance login), `activeTab` is set to the first visible tab.

### Part 2 — Audit tab controls

- **Verify audit chain:** Button "Verify audit chain" calls `GET /api/admin/audit/verify`. Result is shown: `chain_valid` (green/red badge), `snapshot_valid` (green/amber), `first_corrupted_id` (if any), `rows_checked`. Gated by presence of handler (audit tab is already gated by `read_audit`).
- **Create daily snapshot:** Button "Create daily snapshot" calls `POST /api/admin/audit/snapshot`. Success toast with snapshot date or generic "Daily snapshot created"; on 403 or other error, error toast. Both actions show loading state.

### Part 3 — CSV export error handling

- **exportAuditCsv:** On `!res.ok`, the function no longer returns silently. It sets a global error: if `res.status === 403` → *"Export failed. You may not have permission."*; otherwise → *"Export failed. Please try again."* On network exception it sets *"Export failed. Please try again."*

### Part 4 — Session revoke alignment

- **Backend unchanged:** `POST /api/admin/sessions/:id/revoke` still requires `manage_roles` (super_admin only). No backend change.
- **UI:** Revoke button remains gated by `canManageRoles` (super_admin). On 403 from revoke (e.g. if policy were relaxed later), the UI shows a toast: *"You don't have permission to revoke sessions."* `SettingsTab` now receives a `showToast` prop so it can surface this message.

### Part 5 — UX consistency

- **Anonymize user:** On successful anonymize, the UI shows a success toast: *"User anonymized."*
- **Verification approve/reject:** On successful approve or reject verification, the UI shows *"Verification updated."*
- **Bulk 207 partial success:** When the bulk applications API returns 207 with `data.errors`, the UI shows an error line: *"Some items failed. X succeeded, Y failed."* plus up to 3 error snippets, and if any succeeded, a success toast for the succeeded count.
- **Migration hints removed for 403:** All loaders use the single permission message for 403; generic failure messages no longer mention migrations or schema (e.g. "Ensure data_requests table has id column" or "Run Supabase migrations for admin_audit_log" removed for 403 paths).
- **Mutations refresh state:** Existing behavior preserved (e.g. `loadData()`, `loadReports()`, etc. after mutations). No change to refresh logic.

---

## 3. Breaking risks

- **Tab visibility:** Roles with fewer permissions (e.g. compliance) now see fewer sidebar tabs. If a compliance user had bookmarks or habits around Overview/Applications, they will no longer see those tabs and will be redirected to the first visible tab (e.g. Audit). This is intentional and improves clarity.
- **Initial load for compliance:** On first load, `loadData()` may set *"You do not have permission to view this section."* and empty applications; the redirect effect will switch to the first visible tab. So compliance may briefly see the permission banner if they land on a tab they can’t access before redirect runs.
- **Bulk 207:** The new message and toast are additive. Callers that depend on the previous generic error string may need to handle the new *"Some items failed. X succeeded, Y failed."* format if they parse the error message.

---

## 4. API contract confirmation

- **No API contracts changed.** All modified behavior is in the admin SPA:
  - `GET /api/admin/audit/verify` — already existed; response shape unchanged.
  - `POST /api/admin/audit/snapshot` — already existed; request/response unchanged.
  - `GET /api/admin/audit` (including `format=csv`), `GET /api/admin/applications`, reports, data-requests, config, risk, approvals, compliance, sessions, revoke — request/response shapes and status codes unchanged. Only client-side handling of 403 and error messages was updated.

---

*Phase 11 implementation complete. No backend or API contract changes.*
