# Full Production Audit — Admin Panel

**Environment:** Production (https://app.inthecircle.co)  
**Scope:** Admin panel flows, RBAC, destructive actions, audit/chain, escalation, session, control health, UI, console/network.  
**Method:** Codebase analysis (live browser/network verification recommended with real credentials).

---

## 1. Critical Bugs (must fix immediately)

### C1. Compliance role sees all tabs but gets failed/empty data on Overview and Applications

- **What:** On login, `checkAdminAccess()` runs `void loadData()` and `void loadInbox()`. `loadData()` calls `fetch('/api/admin/applications', ...)`. The applications API requires `read_applications`; the **compliance** role does **not** have `read_applications` (only `read_audit`, `export_audit`, `read_data_requests`, `read_reports`, `read_risk`, `active_sessions`). So compliance gets 403 from applications. The code then falls back to `supabase.rpc('admin_get_applications')`, which may also be restricted by RLS, so compliance can end up with empty applications and empty-looking Overview/Dashboard/Applications.
- **Impact:** Compliance users see all sidebar tabs (Overview, Applications, Users, etc.) but get empty or confusing data on first load; no clear “You don’t have permission” message.
- **Fix:** Either (a) filter sidebar tabs by role so compliance only sees Audit, Compliance, Data Requests, Reports, Risk, Settings (and optionally hide Overview/Applications/Users/Verifications/Inbox/Approvals), or (b) keep tabs but when a tab’s API returns 403, show an explicit message: “You don’t have permission to view this section” instead of empty content. Prefer (a) for clarity.

### C2. No UI for audit chain verify or snapshot

- **What:** APIs exist: `GET /api/admin/audit/verify` and `POST /api/admin/audit/snapshot`. The Audit tab has no “Verify chain” or “Create snapshot” buttons; users cannot run chain verification or create signed snapshots from the UI.
- **Impact:** Tamper-evident audit and snapshot are core to governance storytelling; evidence-on-demand is incomplete without UI access.
- **Fix:** Add “Verify chain” and “Create snapshot” (or “Record snapshot”) actions to the Audit tab (permission-gated by `read_audit` for verify, and by same permission for snapshot; snapshot may require a separate server secret). Show verify result (valid/invalid + first broken index if any) and snapshot success/failure.

---

## 2. High Severity (breaks trust)

### H1. 403 responses shown as generic “Failed to load…” instead of permission message

- **Where:** `loadAuditLog`: on `!res.ok` we set `setError(data.error || 'Failed to load audit log. Run Supabase migrations for admin_audit_log.')`. For 403, `data.error` is “Forbidden”, which is better than the migration message but still not “You don’t have permission to view the audit log.” Same pattern for other loaders that don’t special-case 403.
- **Impact:** Users (e.g. viewer on a route that returns 403) see a generic or misleading error, which undermines trust in permission clarity.
- **Fix:** For every admin API load (audit, reports, data-requests, config, risk, approvals, compliance), when `res.status === 403`, set a dedicated message like “You don’t have permission to view this section” and avoid suggesting migration/config errors.

### H2. Audit CSV export on 403 fails silently

- **Where:** `exportAuditCsv`: `if (!res.ok) return` with no `setError` or toast. A user with `read_audit` but not `export_audit` cannot see the Export CSV button (it’s gated by `canExportAudit`). If the button were ever exposed or called (e.g. race), 403 would do nothing visible.
- **Impact:** Silent failure on permission-denied export; minor from today’s UI but bad for debugging and consistency.
- **Fix:** If `!res.ok`, set error or show toast: e.g. “Export failed. You may not have permission to export audit data.” For 403 specifically, use a permission message.

### H3. Session revoke permission mismatch

- **What:** `sessions/[id]/revoke` requires `manage_roles`. Only super_admin has `manage_roles`. So only super_admins can revoke sessions. Design may intend “active_sessions” to allow revoke for compliance; if so, revoke should allow either `manage_roles` or `active_sessions`.
- **Impact:** Compliance can see sessions (active_sessions) but cannot revoke; may be intentional, but if compliance should revoke, this is a permission bug.
- **Fix:** Confirm intended policy. If compliance should revoke sessions, add revoke permission to `active_sessions` or a new permission and enforce in revoke route.

---

## 3. Medium Severity (UX inconsistency)

### M1. Success feedback missing after anonymize user

- **What:** Delete user flow calls `showToast('User deleted')` on success. Anonymize flow (in the same area) should show equivalent success feedback; need to confirm if `showToast` is called after successful anonymize.
- **Fix:** Ensure anonymize success path calls `showToast('User anonymized')` (or similar) and clears selection/error.

### M2. Verification approve/reject success uses setError for failure but no toast on success

- **What:** `approveVerification` / `rejectVerification` call `setError(...)` on failure and `loadData()` on success but do not call `showToast` on success. Inconsistent with delete/approval flows that show toasts.
- **Fix:** On success, call e.g. `showToast('Verification updated')` for consistency.

### M3. Bulk action 207 (partial success) not clearly surfaced

- **What:** Bulk applications API can return 207 with `{ ok: false, errors: [...] }`. UI sets `setError(data.errors?.join(', ') || ...)`. User sees errors but list may be partially updated; no explicit “Partial success” message.
- **Fix:** For 207, show a toast like “Some items failed” and list errors in the error banner, and refresh list so successful items are updated.

### M4. Overview/Dashboard load uses RPC fallback after API 403

- **What:** When applications API returns non-ok, `fetchApplications` falls back to `supabase.rpc('admin_get_applications')`. If RPC is also restricted for compliance, both paths yield empty data and Overview shows empty stats. No indication that this is due to permissions.
- **Fix:** Once C1 is addressed (tab filtering or 403 messaging), ensure 403 from applications does not fall back to RPC for roles that don’t have `read_applications`, or show permission message instead of empty state.

### M5. Data requests load error message mentions “id column”

- **Where:** `loadDataRequests`: `setError(data.error || 'Failed to load data requests. Ensure data_requests table has id column.')`. The “id column” part is implementation detail and can confuse.
- **Fix:** Use a user-facing message for 403 (“You don’t have permission…”) and for other errors a generic “Failed to load data requests” unless the error is clearly a schema issue for admins.

### M6. Risk/Approvals/Compliance 403 handling

- **What:** Approvals load explicitly skips setting error on 403: `if (!res.ok && res.status !== 403) setError(...)`. Compliance and Risk load don’t special-case 403 with a friendly message; they can show “Failed to load risk dashboard” or “Failed to load compliance data” for 403.
- **Fix:** For 403, set a permission-denied message; for other errors keep current message.

---

## 4. Low Severity (polish)

### L1. Export CSV download filename uses client date only

- **What:** `a.download = \`audit-log-${new Date().toISOString().slice(0, 10)}.csv\``. Fine for most cases; if export is delayed or timezone matters, could add time or timezone.
- **Fix:** Optional: include time or ensure server sends Content-Disposition with filename for consistency.

### L2. Governance Health badge shows “—” when score is null

- **What:** When `/api/admin/compliance/health` returns 403 or no score, badge shows “— / 100”. Tooltip explains the score. Acceptable.
- **Fix:** Optional: add “No data” or “Run checks” in tooltip when score is null.

### L3. No explicit loading state for governance health fetch in sidebar

- **What:** Sidebar badge updates when health response arrives; there’s no spinner for “loading” state for that specific fetch.
- **Fix:** Optional: show a subtle loading state (e.g. skeleton or “…”) until health is loaded or 403.

### L4. Settings tab config load failure message

- **What:** Config load shows “Failed to load config. Run Supabase migrations for app_config.” For 403, that’s wrong.
- **Fix:** Use permission message for 403; keep migration hint only for 500/schema errors if desired.

---

## 5. False Positives / Expected Behavior

### F1. All tabs visible to all roles

- **Observation:** Sidebar does not filter tabs by role; every admin sees the same list.
- **Status:** By design unless product decision is to hide tabs. Real issue is handling 403 and empty data (C1, H1).

### F2. Viewer can open Audit but cannot Export CSV

- **Observation:** Viewer has `read_audit` but not `export_audit`. Export CSV button is hidden via `canExportAudit` (super_admin or compliance only). So viewer sees Audit tab and list but no export button.
- **Status:** Correct; no change needed.

### F3. Moderator cannot approve/reject applications without mutate_applications

- **Observation:** Applications action API requires `mutate_applications`; moderator has it. Bulk requires `bulk_applications` (supervisor+). Expected.
- **Status:** Correct.

### F4. Delete/Anonymize require reason (min length)

- **Observation:** API enforces `reason` with min length; UI should prevent submit without reason. Confirm in UI that reason is required and validated before submit.
- **Status:** API is correct; UI validation is assumed; add to manual test checklist.

### F5. 409 “Record changed by another moderator” shown

- **Observation:** Application action, report update, and similar flows return 409 and UI sets `setError(data.error || 'Record changed by another moderator')`. Good.
- **Status:** Expected; no change.

### F6. Rate limit 429 for destructive actions

- **Observation:** Delete user, anonymize, bulk can return 429; UI sets error from `data.error` or “Rate limit exceeded. Try again later.” Good.
- **Status:** Expected.

---

## 6. Recommended Fix Order

1. **C1** — Compliance (and any role without `read_applications`) tab visibility or 403 messaging so they don’t see empty Overview/Applications without explanation.
2. **C2** — Add Audit tab actions: “Verify chain” and “Create snapshot” calling existing APIs, with clear success/failure and permission gating.
3. **H1** — For every admin data load, treat 403 with a dedicated “You don’t have permission…” message (audit, reports, data-requests, config, risk, approvals, compliance).
4. **H2** — Audit CSV export: on `!res.ok` (and especially 403) show error or toast instead of silent return.
5. **H3** — Confirm session revoke policy; if compliance should revoke, adjust permission for revoke route.
6. **M1–M6** — Success toasts for anonymize and verification; 207 handling for bulk; 403 and user-facing messages for data requests and risk/compliance loads.
7. **L1–L4** — Polish: export filename, governance badge tooltip when null, loading state for health, config 403 message.

---

## 7. Checklist for Live Verification (production)

Run these with real accounts (viewer, moderator, supervisor, compliance, super_admin) on https://app.inthecircle.co:

- [ ] **Navigation:** Open each tab (Overview, Applications, Reports, Users, Data Requests, Audit, Risk, Approvals, Compliance, Settings); confirm no console errors, no blank panes; counts and loading states make sense.
- [ ] **RBAC:** Per role, confirm which tabs show data vs permission message; try forbidden action (e.g. viewer export audit) and confirm 403 is clear.
- [ ] **Destructive:** Delete user, anonymize user, bulk reject/suspend; confirm reason required, approval flow when configured, 409 and 429 handling, success toasts.
- [ ] **Audit:** Filters, CSV export, then (after C2) verify chain and snapshot from UI; confirm hashes/chain in export if applicable.
- [ ] **Escalation/Risk:** Trigger threshold; confirm GET risk shows open escalations; resolve one; confirm audit has escalation_create and escalation_resolve.
- [ ] **Sessions:** Two devices; revoke one; confirm session list and audit; MFA flag if applicable.
- [ ] **Control health:** Run health from Compliance tab; confirm score and table update; trigger overdue governance review and confirm escalation.
- [ ] **Console/Network:** No unhandled errors; no 403/500 without UI feedback; no N+1 or 429 storms.

---

*Audit completed from codebase analysis. Production browser and role-based tests recommended to confirm and to catch environment-specific issues.*
