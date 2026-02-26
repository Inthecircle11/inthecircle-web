# Admin Sprint 01 — Execution Plan

**Sprint duration:** 2 weeks  
**Source:** docs/ADMIN_OPERATIONAL_CONTROL_AUDIT.md  
**Output:** Implementation-ready tasks for engineering.  
**Date:** February 2026.

---

## 1. Sprint objective

This sprint removes the single trust-breaking control (Clear Cache), replaces it with a truthful Refresh All Data flow including last-updated timestamp and stale-state indication, standardizes feedback for all state-changing actions (toasts for reports, data requests, exports), and replaces native `confirm()` for destructive actions (bulk reject, delete user, anonymize) with an in-app confirmation modal that logs confirmations to the audit trail. Gate recovery is added (Back to app link). Reports gain status filter and a way to open the reported user from the card. Outcome: zero fake actions in production, consistent operator feedback, and destructive actions auditable and consistent.

---

## 2. Selected focus areas

1. **Trust** — Remove fake action; add Refresh All Data, last-updated timestamp, stale indicator, and success/error feedback for every state-changing action.
2. **Risk** — Replace native confirm() for bulk reject, delete user, and anonymize with in-app confirmation modal; log confirmation events to audit.
3. **Operational drag** — Gate "Back to app"; Reports filter by status and "View user" from report card; reduce tab-switching to investigate a report.

---

## 3. Execution table

| # | Title | Category | Problem | Why it matters | Proposed solution | Acceptance criteria | Scope | Owner | Dependency |
|---|--------|----------|---------|----------------|-------------------|---------------------|--------|--------|------------|
| 1 | Remove Clear Cache button and handler | Trust | Dashboard "Clear Cache" triggers `alert('Cache cleared!')` with no effect. | Operators believe an action ran; it did not. Erodes trust in all controls. | Delete the Clear Cache button and its click handler in Dashboard Quick Actions. Remove any `alert('Cache cleared!')` call. | No "Clear Cache" button exists. No alert() on that path. Search codebase for "Clear Cache" and "Cache cleared" returns no UI or user-facing behavior. | S | FE | None |
| 2 | Add "Refresh all data" in Dashboard Quick Actions | Trust | Operators have no honest way to refresh from Dashboard. | Single place to refresh and see "last updated" without a fake action. | In Dashboard Quick Actions, add button "Refresh all data". On click: call existing `loadData()`, set loading state on button (spinner or disabled), on success call `setLastRefreshed(new Date())` and `showToast('Data refreshed')`, on failure show error toast. Disable button while `refreshing` is true. | Click "Refresh all data" triggers loadData(); button shows loading state during refresh; on success toast "Data refreshed" and lastRefreshed updates; on failure error toast; button disabled during refresh. | M | FE | None |
| 3 | Show "Last updated" in header and Dashboard | Trust | Operators cannot tell when data was last fetched. | Reduces acting on stale data; supports trust in Refresh. | Display "Last updated: X min ago" (or exact time) using existing `lastRefreshed`. Header: show next to or near Refresh button (visible on desktop; can remain hidden on small viewport if current behavior hides it). Dashboard: in Quick Actions block, show "Last updated: X ago" next to "Refresh all data". Update only when loadData() completes successfully. | Header shows "Last updated: X ago" when lastRefreshed is set. Dashboard Quick Actions block shows same. Value updates after successful loadData() (header Refresh or Dashboard "Refresh all data"). | S | FE | None |
| 4 | Stale data indicator | Trust | No signal when data is old. | Operators may act on outdated state. | When `lastRefreshed` is older than 5 minutes (constant or configurable), show a subtle indicator: e.g. "Data may be stale — Refresh" next to "Last updated" or style "Last updated" text with warning color. No auto-refresh. | When lastRefreshed exists and (now - lastRefreshed) > 5 min, a stale message or warning style is visible. After refresh, indicator clears until 5 min elapses again. | S | FE | 3 |
| 5 | Gate screen: "Back to app" link | Operational drag | Gate screen has no exit path to main app. | Operators stuck if they land on gate by mistake or want to leave. | On gate screen (when gateUnlocked === null and gate is shown), add a link "Back to app" that navigates to `/` (or app root). Place below or beside the gate form. | When gate is visible, "Back to app" link is present and navigates to app root. | S | FE | None |
| 6 | Reusable ConfirmModal component | Risk | Destructive actions use native confirm(); no in-app audit trail. | Enables consistent confirmation UX and logging to audit. | Implement a reusable modal: props `title`, `body` (string or node), `confirmLabel`, `cancelLabel`, `variant` ('danger' | 'default'), `onConfirm`, `onCancel`, `open`. Render in admin shell. Use focus trap and Escape to close (reuse or align with useModalFocusTrap). Danger variant: confirm button uses destructive (red) style. | Modal opens when open=true; shows title and body; Cancel and Confirm buttons; Escape and backdrop close call onCancel. Confirm calls onConfirm then closes. Focus trapped; focus returned on close. Danger variant shows red confirm button. | M | FE | None |
| 7 | Bulk reject: ConfirmModal + audit log | Risk | Bulk reject uses confirm(); confirmation not in audit. | Misclicks and disputes need an auditable record. | Replace confirm() in bulk reject flow with ConfirmModal. Body: "Reject N application(s)? This cannot be undone." Confirm label: "Reject". On confirm: call existing bulk reject API; on success log to audit e.g. "Bulk reject confirmed, N applications" (include admin id, count, timestamp). | Bulk reject opens ConfirmModal; no native confirm(). On confirm, API runs; success logs one audit entry with action type, count, admin, timestamp. | M | FE | 6 |
| 8 | Delete user: ConfirmModal + audit log | Risk | Delete user uses confirm(); confirmation not in audit. | Legal/dispute need to prove informed confirmation. | Replace confirm() in delete user flow with ConfirmModal. Body: "Permanently delete this user and all their data? This cannot be undone." Confirm label: "Delete". On confirm: call existing delete API; on success log to audit e.g. "User delete confirmed" with target user id, admin id, timestamp. | Delete user opens ConfirmModal; no native confirm(). On confirm, delete API runs; success logs audit entry with action, target user id, admin, timestamp. | M | FE | 6 |
| 9 | Anonymize user: ConfirmModal + audit log | Risk | Anonymize uses confirm(); confirmation not in audit. | GDPR-sensitive; audit trail required. | Replace confirm() in anonymize flow with ConfirmModal. Body: "Anonymize this user? Profile name/username/image will be replaced. This cannot be undone." Confirm label: "Anonymize". On confirm: call existing anonymize API; on success log to audit e.g. "User anonymize confirmed" with target user id, admin id, timestamp. | Anonymize opens ConfirmModal; no native confirm(). On confirm, API runs; success logs audit entry with action, target user id, admin, timestamp. | M | FE | 6 |
| 10 | Report Resolve/Dismiss: success and error toast | Trust | Resolve and Dismiss report show no feedback. | Operators cannot tell if action succeeded or failed. | After Report Resolve API success: showToast('Report resolved'). After failure: showToast(error message or 'Failed to resolve', 'error'). Same for Dismiss: showToast('Report dismissed') on success, error toast on failure. | Resolve shows success toast on success and error toast on failure. Dismiss shows success toast on success and error toast on failure. | S | FE | None |
| 11 | Data Request status Update: success and error toast | Trust | Updating data request status shows no feedback. | Operators cannot tell if update applied. | After Data Request PATCH success: showToast('Status updated'). On failure: showToast(error or 'Failed to update status', 'error'). | Update button success shows "Status updated" toast; failure shows error toast. | S | FE | None |
| 12 | Export actions: toast on trigger | Trust | CSV (users/applications) and User JSON export have no feedback. | Operators may repeat click or assume failure. | After triggering export (download start): showToast('Export started') or 'Download started'. Apply to Export users CSV, Export applications CSV (Overview and Applications), and User export (JSON) in user modal. | Each of the three export triggers shows a short toast (e.g. "Export started" or "Download started") when the download is triggered. | S | FE | None |
| 13 | Reports: filter by status | Operational drag | Reports list has no filter; all statuses mixed. | Operators cannot focus on Pending only. | Add filter chips or tabs: Pending | Resolved | Dismissed (or All). If API supports `?status=` (or equivalent), filter server-side. Otherwise filter client-side from existing reports list. Default to Pending when available. | Reports tab has status filter. Selecting Pending shows only pending; Resolved/Dismissed show only those. Counts or labels reflect filtered state. | M | FE | API supports status filter or client has status field on each report |
| 14 | Reports: "View user" from report card | Operational drag | No way to open reported user from report card. | Extra tab switch and search to investigate. | On each report card, add link or button "View user" that opens the User detail modal for the reported user (reporter or reported, as appropriate — typically reported user). Use existing user modal; pass user id from report payload. If user id not in payload, fetch or hide button. | Each report card has "View user" (or "View reported user"); click opens User modal for the relevant user. If data insufficient, button hidden or disabled with clear reason. | M | FE | Report payload includes user id for reported user (or API to resolve it) |

---

## 4. Definition of done

- **Per task:** Code merged to main (or sprint branch); acceptance criteria verified; no regressions on existing admin flows (gate, login, applications, users, reports, data requests, audit, settings).
- **Sprint:** All 14 tasks merged; admin deployed to production; zero occurrences of "Clear Cache" or `alert('Cache cleared!')` in production bundle; ConfirmModal used for bulk reject, delete user, anonymize; all state-changing actions listed above have defined success/error feedback (toast or inline).
- **Testing:** Manual test of each acceptance criterion; smoke test of gate, login, refresh, one destructive flow, reports filter, and report → View user.

---

## 5. Success metrics after sprint

| Metric | Target | How measured |
|--------|--------|--------------|
| Fake actions in production | 0 | Grep/build check: no "Clear Cache" button, no alert('Cache cleared!') in admin code path. |
| Destructive actions using native confirm() | 0 | Bulk reject, delete user, anonymize use ConfirmModal only; no window.confirm in those flows. |
| Audit log entries for confirmations | Present | After bulk reject, delete user, anonymize: at least one audit row per action with identifiable action type and target. |
| State-changing actions with feedback | 100% of listed actions | Report Resolve/Dismiss, Data Request Update, Export (users CSV, applications CSV, user JSON) show toast on success or error. |
| Stale indicator visible when data > 5 min old | Yes | When lastRefreshed is set and older than 5 min, stale message or warning style is visible until refresh. |
| Gate "Back to app" present | Yes | Gate screen has clickable "Back to app" that navigates to app root. |
| Reports filter and View user | Yes | Reports tab has status filter (Pending/Resolved/Dismissed or All). Report card has "View user" (or equivalent) opening user modal. |
