# Phase 12: Enterprise Confidence Stress Test — Report

**Goal:** Ensure the admin panel behaves correctly under edge cases, high load, permission transitions, and abnormal flows.

**Method:** Codebase analysis (no live execution). Recommendations assume manual or automated follow-up tests in staging/production.

---

## PART 1 — Permission Transition Test

### 1.1 Remove own super_admin while session active

| Check | Finding |
|-------|--------|
| **UI** | Own super_admin cannot be removed in the UI: `disabled={roleActionLoading !== null \|\| (r === 'super_admin' && au.admin_user_id === currentUserId)}` prevents the Remove button for your own super_admin. |
| **Backend** | Last super_admin cannot be removed: `countSuperAdmins(supabase) < 2` → 400 "Cannot remove super_admin: at least one super_admin must remain". If there are 2+ super_admins, the API would allow removing your own (UI blocks it). |
| **If role is removed via API** | Roles are loaded on **every** request in `requireAdmin()` via `getAdminRoles(supabase, user.id)`. So the next API call would return 403 for protected actions. Client state (`adminRoles`) is **not** refreshed: it is set only at initial `checkAdminAccess()`. So after 403 the user still sees the same sidebar/tabs until full reload. |

**Edge-case failure:** After another admin removes your role (or you remove your own via API), the next action returns 403 but the client does not refetch roles or redirect. User sees error banner but still sees tabs/buttons for which they no longer have permission until they refresh the page.

**Recommendation:** On any admin API 403, optionally call `GET /api/admin/check` and update `adminRoles`; if roles are empty or user no longer allowlisted, redirect to login or show "Session invalid, please sign in again."

### 1.2 Change another admin's role while they are logged in

| Check | Finding |
|-------|--------|
| **Permission refresh** | Each API request runs `requireAdmin()` → `getAdminRoles(supabase, user.id)` from DB. So the **other** admin’s next request gets updated roles and will get 403 on actions they can no longer perform. No “stale role in JWT.” |
| **Ghost access** | The other admin’s **client** still has old `adminRoles` in React state until they reload. So they can still see tabs/buttons and attempt actions; those attempts will fail with 403. No ghost access on the server; possible confusion on the client until reload. |

**Vulnerability:** Client-side permission state is not refreshed on 403, so the other admin has a confusing UX (tabs/buttons visible, then 403 on click) until they refresh.

---

## PART 2 — Multi-Tab Concurrency

| Check | Finding |
|-------|--------|
| **409 handling** | Application action, report update, and similar flows return 409 "Record changed by another moderator". UI sets `setError(data.error || 'Record changed by another moderator')`. |
| **Stale UI** | On 409 we **do not** call `loadData()` or `loadReports()`. The list stays stale; the user is not shown the current state (e.g. that the other tab already approved the item). |
| **Double submit** | `actionLoading` disables the same button in the current tab. There is no cross-tab lock: Tab A and Tab B can both click Approve; one gets 200 and one gets 409. |

**Race-condition vulnerability:** After 409, the second tab shows an error but does not refresh. User may not realize the action was already applied in the other tab.

**Recommendation:** On 409, call `loadData()` (or the relevant loader) so the list reflects current state, and keep the error message so the user knows why (e.g. "Record changed by another moderator. List refreshed.").

---

## PART 3 — Network Interruption

| Check | Finding |
|-------|--------|
| **Buttons disabled during mutation** | Yes. `actionLoading` (and `loading`, `verifyLoading`, `snapshotLoading`, etc.) disables primary action buttons during requests. |
| **Double submit** | Same-tab double submit is prevented by `actionLoading`. No idempotency key in the UI for bulk or single actions (bulk API supports `Idempotency-Key` header; UI does not set it). |
| **Slow network** | No request timeout (no `AbortController` or fetch timeout). Long-running requests keep the button disabled until they complete or the tab is closed. |
| **Offline during mutation** | Fetch fails; `catch` runs and we set a generic error (e.g. "Failed to approve"). No distinction between network error and server error; no "Retry" or "You appear to be offline" messaging. |
| **Snapshot/verify timeout** | Verify and snapshot calls have no timeout. Very slow responses would leave "Verifying…" / "Creating…" until they complete or fail. |

**UX weak points:** No retry CTA, no offline detection, no timeout with clear messaging. Users may not know whether to retry or refresh.

**Recommendation:** For mutations, on fetch failure set a message that suggests retry (e.g. "Request failed. Check your connection and try again."). Optionally add a "Retry" button or listen for `navigator.onLine` and show an offline banner.

---

## PART 4 — Large Data Handling

| Check | Finding |
|-------|--------|
| **Audit rows** | Default `loadAuditLog` limit is 100. Max request limit in API is 1000. No virtualization: all entries are rendered in one table. With 1000 rows the DOM can be heavy; no virtualized list. |
| **Large CSV export** | Capped at 1000 rows (`MAX_CSV_ROWS`). Export runs in one request; no streaming. For 1000 rows the response is bounded and should be acceptable. |
| **Large bulk reject** | `bulk-applications` accepts `application_ids` array with no server-side cap. Very large arrays (e.g. 1000+) could cause long-running requests, high memory, or timeouts. No UI cap on selection size. |
| **Many escalations open** | Risk tab loads `open_escalations` from `/api/admin/risk`; no pagination. List is rendered in full. Governance score and controls are shown; no virtualization. |

**Performance risks:** (1) Audit tab with limit 1000 and no virtualization may be slow on low-end devices. (2) Bulk action with hundreds of IDs has no server or client limit and could stress the server or hit timeouts. (3) Many open escalations could make the Risk table large.

**Recommendation:** Add a server-side (and optionally UI) limit for bulk operations (e.g. max 100 or 200 per request). Consider virtualizing the audit log table when limit > 100. Keep CSV at 1000 or add streaming for larger exports.

---

## PART 5 — Health & Risk Integrity

| Check | Finding |
|-------|--------|
| **Break a control (e.g. remove last super_admin)** | Backend prevents removal of last super_admin (remove-role returns 400). So you cannot "break" that control via the UI. If broken by direct DB change, next health run would run `checkCC61`: it checks at least one super_admin and no moderator+super_admin on same user; if no super_admin it returns `status: 'failed'`, `score: 0`, `notes: 'No super_admin exists'`. |
| **Run health check** | `POST /api/admin/compliance/health/run` runs `runControlHealthChecks`, `upsertControlHealth`, `ensureGovernanceReviewEscalation`. Control status and overall score are recalculated and stored. |
| **Escalation created** | `ensureGovernanceReviewEscalation` creates an open escalation when there has been no governance review in the last 90 days. Other controls (CC6.1, CC7.2, etc.) do not create escalations; they only set control health status. Risk dashboard creates escalations for pending_applications, pending_reports, overdue_data_requests when thresholds are crossed (in `GET /api/admin/risk`). |

**Conclusion:** Health run correctly updates control status and governance score. Escalation creation is implemented for governance review overdue and for risk metrics; it is not tied to CC6.1 (e.g. "no super_admin") in the health/run flow. Breaking CC6.1 via DB would be reflected in control health status and score; no automatic escalation is created for that specific failure in the current code.

---

## PART 6 — Snapshot Integrity

| Check | Finding |
|-------|--------|
| **Create snapshot** | `POST /api/admin/audit/snapshot` reads the latest audit row with `row_hash`, computes HMAC signature, upserts into `admin_audit_snapshots` by `snapshot_date`. |
| **Modify one audit row** | If an audit row is modified in the DB (e.g. `details` or `row_hash` changed), the chain formula (previous_hash → row_hash) breaks for that row and all subsequent rows. |
| **Run verify** | `GET /api/admin/audit/verify` loads rows in order, runs `verifyChain(rows)` which compares expected hash to `row_hash` and checks `previous_hash` link. On first mismatch it returns `chain_valid: false`, `first_corrupted_id: <id>`. Snapshot check compares latest row’s hash to stored `last_row_hash`; if the row was modified, the hash will not match and `snapshot_valid` will be false. |

**Conclusion:** Verify correctly detects a broken chain and identifies the first corrupted row. Snapshot integrity is validated against the current chain head; if the chain is invalid or the head was changed, snapshot validation reflects that.

---

## OUTPUT SUMMARY

### 1. Edge-case failures

- **Permission downgrade without reload:** After a user’s role is removed (by self via API or by another admin), the client still shows tabs/buttons until page reload; 403 is shown on action but roles are not refetched and there is no redirect to login.
- **409 without refresh:** After 409 "Record changed by another moderator", the list is not refreshed, so the user sees stale data and may not realize the action was already applied in another tab.
- **No distinction for network errors:** On fetch failure (e.g. offline), the message is generic; no "retry" or "offline" guidance.

### 2. Race-condition vulnerabilities

- **Multi-tab 409:** Two tabs can both trigger the same action; one gets 200 and one gets 409. The 409 tab does not refresh, so it stays stale.
- **No cross-tab lock:** No shared lock or idempotency in the UI for application/report actions (bulk API supports Idempotency-Key; UI does not send it).

### 3. UX weak points under stress

- No retry CTA or offline messaging after failed mutations.
- No request timeouts; slow or hanging requests leave buttons in a loading state.
- After 403, sidebar/tabs still reflect old permissions until reload.
- Large bulk selection has no warning or cap; very large bulk could feel unresponsive or time out.

### 4. Performance risks

- **Audit table:** Up to 1000 rows rendered without virtualization; can be slow with large limits.
- **Bulk applications:** No server or client limit on `application_ids` length; very large bulk could stress the server or time out.
- **Risk/Compliance:** Large numbers of open escalations or controls rendered in full (no virtualization).

### 5. Final enterprise readiness score

**7 / 10**

**Rationale:**

- **Strengths:** Permission checks on every request; 403 and 409 surfaced in UI; buttons disabled during mutations; health and verify/snapshot logic correct; CSV and audit list capped at 1000; Phase 11 permission messaging and tab filtering in place.
- **Gaps:** No client-side permission refresh or redirect on 403; no refresh on 409; no retry/offline/timeout handling; no bulk size limit; no virtualization for large lists; no idempotency key in UI for bulk.

**To approach 9–10:** Add 403 handling that refetches roles or redirects; refresh list (and optionally show a short message) on 409; add retry/offline messaging and optional timeouts; cap bulk size and consider virtualization for large audit/risk lists.

---

*Stress test completed via codebase analysis. Run the same scenarios in staging with real users and network simulation to validate.*
