# Admin Panel Audit – Full Button & Feature Check

**Date:** 2026-02-25

## Scope

Every tab, section, button, and feature in the admin panel was audited for:

- Correct API route and method (GET/POST/PATCH/DELETE)
- Error handling: non-ok responses surface a message (setError or showToast)
- No silent failures

## Summary of Fixes Applied

1. **Applications → Release**  
   On failure, the UI now shows the server error message instead of a generic "Failed to release" (parses `res.json()` and uses `data?.error`).

2. **Reports → Release**  
   Same: parse response and show `data?.error` on failure.

3. **Data Requests → Status change**  
   On PATCH failure, show `data?.error` instead of generic "Failed to update request".

4. **Compliance → Run health checks**  
   When the API returns 500 with `details` (e.g. CC6.1 auto-fix), the banner now shows both error and details for easier debugging.

5. **Settings → Save config**  
   On PATCH failure, show `data?.error` instead of generic "Failed to save config".

6. **Settings → Session revoke**  
   On failure (other than 403), show toast with `data?.error` or "Failed to revoke session".

7. **Settings → Remove role / Assign role**  
   On failure, always set role error message (including when `data.error` is missing) so the user sees "Failed to remove role" or "Failed to assign role".

8. **Audit log (logAudit)**  
   When the audit POST fails (e.g. network or 500), the catch block now logs to `console.error` so failures are visible in devtools instead of being silent.

9. **Settings → Admin users & roles load**  
   When loading admin users or roles fails (!res.ok), the UI now sets `roleError` so the user sees "Failed to load admin users" or "Failed to load roles" instead of an empty list with no explanation.

## Verified Working

| Section        | Buttons / features                                                                 | API / source                         | Status   |
|----------------|-------------------------------------------------------------------------------------|--------------------------------------|----------|
| Gate / Login   | Gate password submit, Login submit, Back                                            | POST /api/admin/gate, /api/admin/check | OK       |
| Overview       | Refresh, Export users CSV, Export applications CSV, Quick actions, View queue links | loadData, local CSV from state       | OK       |
| Applications   | Claim, Release, Approve/Reject/Waitlist/Suspend (single + bulk), filters, pagination | applications/route, action, claim, release, bulk-applications | OK (errors surfaced) |
| Users          | Toggle verify, Toggle ban, Delete, Export user, Anonymize                           | RPCs + export-user, anonymize-user  | OK       |
| Verifications  | Approve, Reject                                                                    | admin_set_verification               | OK       |
| Inbox          | Refresh, thread list, messages                                                     | message_threads, messages, profiles  | OK       |
| Reports        | Claim, Release, Resolve/Dismiss, filters                                            | reports/route, claim, release        | OK (errors surfaced) |
| Data Requests  | Status change (pending/completed/failed)                                            | data-requests PATCH                  | OK (errors surfaced) |
| Risk           | Resolve escalation, View queue links                                               | escalations/[id]/resolve             | OK       |
| Approvals      | Approve, Reject, Refresh                                                            | approvals/route, approve, reject    | OK       |
| Audit Log      | Refresh, Export CSV, Verify chain, Create snapshot, sort headers                   | audit, verify, snapshot              | OK       |
| Compliance     | Run health checks, Repair chain, Generate evidence, Add governance review, Evidence links | health/run, repair-chain, evidence/generate, governance-reviews | OK (errors + details) |
| Settings       | Save config, Announce, Load blocked, Admin users & roles (assign/remove), Load sessions, Revoke session | config, announce, blocked-users, admin-users, roles, sessions | OK (errors surfaced) |

## API Routes Present (40)

All referenced admin API routes exist under `src/app/api/admin/`:

- check, gate, identity, applications, applications/[id]/action, claim, release
- bulk-applications, active-sessions, reports, reports/[id]/claim, release
- data-requests, risk, escalations/[id]/resolve, approvals, approvals/[id]/approve, reject
- audit, audit/verify, audit/snapshot, audit/repair-chain
- compliance/health, compliance/health/run, compliance/controls, compliance/evidence, compliance/evidence/generate, compliance/governance-reviews
- config, announce, blocked-users, export-user, anonymize-user, delete-user
- admin-users, admin-users/[id]/assign-role, remove-role, roles, sessions, sessions/[id]/revoke

## RPCs / DB

- **admin_application_action_v2** – used by applications/[id]/action (in migration 20260227000001).
- **admin_approve_application, admin_reject_application, admin_waitlist_application, admin_suspend_application** – fallback when updated_at not sent.
- **admin_get_applications, admin_get_all_users, admin_get_active_today_count, admin_get_recent_verification_activity** – dashboard/overview and users (may live in another repo if not in migrations).
- **admin_set_verification, admin_set_banned** – verifications/users.
- Tables: applications, profiles, verification_requests, message_threads, messages, user_reports, data_requests, admin_audit_log, admin_control_health, admin_approval_requests, admin_user_roles, admin_roles, admin_sessions, admin_escalations, etc. – created via migrations; repair/push was applied where needed.

## Recommendations

1. **Overview export** – Export users/applications CSV uses currently loaded state (paginated applications may be partial). For full export, consider a dedicated export API that streams all rows.
2. **Governance health** – Ensure `SUPABASE_SERVICE_ROLE_KEY` is set in Vercel and RBAC migration applied so CC6.1 auto-fix and other controls work.
3. **Run health checks** – If the API returns 500 with `details`, the red banner now shows the full message; use it to debug missing tables or RPCs.
