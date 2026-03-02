# Admin Panel — Full Functional Integrity Audit

**Date:** 2026-03-02  
**Scope:** 100% of admin features, buttons, mutations, RPCs, API routes, permissions, DB functions.  
**Assumption:** Production, no trust, schema drift may exist.

---

## 1. Summary Risk Score: **7 / 10** (High)

**Rationale:** Multiple RPCs are called from the UI and API but **have no CREATE in repo migrations**. Overview, Applications list, Users list, Verifications, and bulk application actions depend on these. A fresh deploy or a DB restored from migrations would break.

---

## 2. SECTION 1 — All Admin Actions (Structured Table)

| UI Action | File | API / RPC | Method | Parameters | Expected Response |
|-----------|------|-----------|--------|------------|-------------------|
| Gate check | page.tsx | `/api/admin/gate` | GET | — | `{ unlocked }` |
| Gate unlock | page.tsx | `/api/admin/gate` | POST | `{ password }` | `{ ok }` |
| Admin check | page.tsx | `/api/admin/check` | GET | — | `{ authorized, roles, sessionId }` |
| Identity | page.tsx | `/api/admin/identity` | GET | — | `{ app, hint }` |
| Overview stats | page.tsx | `/api/admin/overview-stats` | GET | — | `{ stats, activeToday, activeSessions, overviewCounts }` |
| Applications list | page.tsx | `/api/admin/applications` | GET | `sort, filter, status, page, limit` | `{ applications, total, page, limit, counts }` or array |
| Fallback apps | page.tsx | `supabase.rpc('admin_get_applications')` | RPC | — | array |
| Active sessions | page.tsx | `/api/admin/active-sessions` | GET | `minutes=15` | list |
| Reports | page.tsx | `/api/admin/reports` | GET | query params | `{ reports }` |
| Data requests | page.tsx | `/api/admin/data-requests` | GET | — | `{ requests }` |
| Audit list | page.tsx | `/api/admin/audit` | GET | query params | `{ entries }` or CSV |
| Audit verify | page.tsx | `/api/admin/audit/verify` | GET | — | `{ chain_valid, ... }` |
| Audit snapshot | page.tsx | `/api/admin/audit/snapshot` | POST | — | — |
| Audit repair | page.tsx | `/api/admin/audit/repair-chain` | POST | — | `{ ok, rows_updated }` |
| Config | page.tsx | `/api/admin/config` | GET | — | config object |
| Risk | page.tsx | `/api/admin/risk` | GET | — | escalations, KPIs |
| Approvals | page.tsx | `/api/admin/approvals` | GET | `status=pending` | list |
| Blocked users | page.tsx | `/api/admin/blocked-users` | GET | — | list |
| Compliance controls | page.tsx | `/api/admin/compliance/controls` | GET | — | list |
| Compliance evidence | page.tsx | `/api/admin/compliance/evidence` | GET | — | list |
| Compliance governance | page.tsx | `/api/admin/compliance/governance-reviews` | GET | — | list |
| Compliance health | page.tsx | `/api/admin/compliance/health` | GET | — | health object |
| Compliance health run | page.tsx | `/api/admin/compliance/health/run` | POST | — | — |
| Compliance evidence generate | page.tsx | `/api/admin/compliance/evidence/generate` | POST | — | — |
| App action (single) | page.tsx | `/api/admin/applications/:id/action` | POST | `{ action, updated_at? }` | `{ ok }` or 409 |
| Bulk applications | page.tsx | `/api/admin/bulk-applications` | POST | `{ application_ids, action, reason? }` | `{ ok, count }` or 202 + approval |
| Delete user | page.tsx | `/api/admin/delete-user` | POST | `{ user_id, reason }` | `{ ok }` or 202 |
| Claim application | page.tsx | `/api/admin/applications/:id/claim` | POST | — | `{ ok, assigned_to, assignment_expires_at }` |
| Release application | page.tsx | `/api/admin/applications/:id/release` | POST | — | `{ ok }` |
| Export user | page.tsx | `/api/admin/export-user` | GET | `user_id` | export data |
| Anonymize user | page.tsx | `/api/admin/anonymize-user` | POST | `{ user_id, reason }` | `{ ok }` or 202 |
| Claim report | page.tsx | `/api/admin/reports/:id/claim` | POST | — | `{ ok, ... }` |
| Release report | page.tsx | `/api/admin/reports/:id/release` | POST | — | `{ ok }` |
| Reports PATCH | page.tsx | `/api/admin/reports` | PATCH | `{ report_id, status, notes, updated_at }` | `{ ok }` |
| Data requests PATCH | page.tsx | `/api/admin/data-requests` | PATCH | `{ request_id, status, updated_at? }` | `{ ok }` |
| Resolve escalation | page.tsx | `/api/admin/escalations/:id/resolve` | POST | `{ notes? }` | `{ ok, id }` |
| Approve approval | page.tsx | `/api/admin/approvals/:id/approve` | POST | — | `{ ok, id }` |
| Reject approval | page.tsx | `/api/admin/approvals/:id/reject` | POST | — | `{ ok, id }` |
| Config PATCH | page.tsx | `/api/admin/config` | PATCH | body | — |
| Announce | page.tsx | `/api/admin/announce` | POST | body | — |
| Admin users list | page.tsx | `/api/admin/admin-users` | GET | — | list |
| Roles list | page.tsx | `/api/admin/roles` | GET | — | list |
| Sessions list | page.tsx | `/api/admin/sessions` | GET | — | list |
| Revoke session | page.tsx | `/api/admin/sessions/:id/revoke` | POST | — | — |
| Remove role | page.tsx | `/api/admin/admin-users/:id/remove-role` | DELETE | `role_name` query | — |
| Assign role | page.tsx | `/api/admin/admin-users/:id/assign-role` | POST | `{ role_name }` | — |
| **Toggle verification** | page.tsx | **supabase.rpc('admin_set_verification')** | **RPC** | **p_target_user_id, p_is_verified** | **—** |
| **Toggle ban** | page.tsx | **supabase.rpc('admin_set_banned')** | **RPC** | **p_target_user_id, p_is_banned** | **—** |
| **Approve verification** | page.tsx | **supabase.rpc('admin_set_verification')** | **RPC** | **p_target_user_id, p_is_verified: true** | **—** |
| Analytics overview | ProductAnalyticsTab.tsx | `/api/admin/analytics/overview` | GET | `days=30` | analytics data |

**LoadData RPCs (fallback or primary):**

- `admin_get_applications()` — page.tsx when API 403
- `admin_get_all_users()` — page.tsx loadData
- `admin_get_active_today_count()` — page.tsx loadData
- `admin_get_recent_verification_activity()` — page.tsx loadData

**API route RPCs:**

- overview-stats: `admin_get_all_stats()`, `get_active_sessions(active_minutes)`
- applications: `admin_get_application_counts()`, `admin_get_applications_fast(p_status, p_limit, p_offset)`
- applications/[id]/action: `admin_application_action_v2(p_application_id, p_updated_at, p_action)`
- bulk-applications: `admin_approve_application`, `admin_reject_application`, `admin_waitlist_application`, `admin_suspend_application` (each with `p_application_id`)
- delete-user: `admin_delete_user(p_user_id)`
- audit/repair-chain: `admin_repair_audit_chain()`

---

## 3. SECTION 2 — API Routes Verification

### 3.1 Route existence and method

All referenced `/api/admin/*` routes **exist** as files. No missing route files.

| Route | File Exists | GET | POST | PATCH | DELETE | requireAdmin | requirePermission |
|-------|-------------|-----|------|-------|--------|--------------|-------------------|
| gate | ✅ | ✅ | ✅ | — | — | **No** (by design) | — |
| identity | ✅ | ✅ | — | — | — | **No** (by design) | — |
| check | ✅ | ✅ | — | — | — | ✅ | — |
| overview-stats | ✅ | ✅ | — | — | — | ✅ | read_applications |
| applications | ✅ | ✅ | — | — | — | ✅ | read_applications |
| applications/[id]/action | ✅ | — | ✅ | — | — | ✅ | mutate_applications |
| applications/[id]/claim | ✅ | — | ✅ | — | — | ✅ | mutate_applications |
| applications/[id]/release | ✅ | — | ✅ | — | — | ✅ | mutate_applications |
| bulk-applications | ✅ | — | ✅ | — | — | ✅ | mutate_applications / bulk_applications |
| active-sessions | ✅ | ✅ | — | — | — | ✅ | active_sessions |
| reports | ✅ | ✅ | PATCH ✅ | — | — | ✅ | read_reports / resolve_reports |
| reports/[id]/claim | ✅ | — | ✅ | — | — | ✅ | resolve_reports |
| reports/[id]/release | ✅ | — | ✅ | — | — | ✅ | resolve_reports |
| data-requests | ✅ | ✅ | PATCH ✅ | — | — | ✅ | read_data_requests / update_data_requests |
| audit | ✅ | ✅ | POST ✅ | — | — | ✅ | read_audit / export_audit |
| audit/verify | ✅ | ✅ | — | — | — | ✅ | read_audit |
| audit/snapshot | ✅ | — | ✅ | — | — | ✅ | read_audit |
| audit/repair-chain | ✅ | — | ✅ | — | — | ✅ | export_audit |
| config | ✅ | ✅ | PATCH ✅ | — | — | ✅ | read_config / manage_config |
| risk | ✅ | ✅ | — | — | — | ✅ | read_risk |
| approvals | ✅ | ✅ | — | — | — | ✅ | approve_approval |
| approvals/[id]/approve | ✅ | — | ✅ | — | — | ✅ | approve_approval |
| approvals/[id]/reject | ✅ | — | ✅ | — | — | ✅ | approve_approval |
| blocked-users | ✅ | ✅ | — | — | — | ✅ | read_blocked_users |
| escalations/[id]/resolve | ✅ | — | ✅ | — | — | ✅ | resolve_escalations |
| delete-user | ✅ | — | ✅ | — | — | ✅ | delete_users |
| export-user | ✅ | ✅ | — | — | — | ✅ | export_user |
| anonymize-user | ✅ | — | ✅ | — | — | ✅ | anonymize_users |
| compliance/controls | ✅ | ✅ | — | — | — | ✅ | read_audit |
| compliance/evidence | ✅ | ✅ | — | — | — | ✅ | read_audit |
| compliance/evidence/generate | ✅ | — | ✅ | — | — | ✅ | export_audit |
| compliance/governance-reviews | ✅ | ✅ | POST ✅ | — | — | ✅ | read_audit |
| compliance/health | ✅ | ✅ | — | — | — | ✅ | read_audit |
| compliance/health/run | ✅ | — | ✅ | — | — | ✅ | export_audit |
| admin-users | ✅ | ✅ | — | — | — | ✅ | manage_roles |
| admin-users/[id]/assign-role | ✅ | — | ✅ | — | — | ✅ | manage_roles |
| admin-users/[id]/remove-role | ✅ | — | — | — | DELETE ✅ | ✅ | manage_roles |
| roles | ✅ | ✅ | — | — | — | ✅ | manage_roles |
| sessions | ✅ | ✅ | — | — | — | ✅ | active_sessions |
| sessions/[id]/revoke | ✅ | — | ✅ | — | — | ✅ | manage_roles |
| announce | ✅ | — | ✅ | — | — | ✅ | announce |
| analytics/overview | ✅ | ✅ | — | — | — | ✅ | read_analytics |

### 3.2 Unprotected routes (intentional)

- **GET /api/admin/gate** — No auth (gate before session).
- **GET /api/admin/identity** — No auth (deployment identity check).

### 3.3 Permission mismatches

- **audit/repair-chain**: Doc says "read_audit" in some places; code correctly uses **export_audit**. No mismatch.
- All other routes use the expected permission constants from `ADMIN_PERMISSIONS`.

**Report:** No missing route files. No wrong method usage. No permission constant mismatch. Gate and identity intentionally unprotected.

---

## 4. SECTION 3 — RPC Functions Verification

### 4.1 RPCs with CREATE in migrations (OK)

| RPC | Migration | Signature | Status |
|-----|-----------|-----------|--------|
| admin_application_action_v2 | 20260227000001_moderation_phase2.sql | (p_application_id uuid, p_updated_at timestamptz, p_action text) → uuid | ✅ OK |
| admin_repair_audit_chain | 20260228100000_audit_repair_chain_rpc.sql | () → jsonb | ✅ OK |
| admin_get_overview_counts | 20260225100001, 20260229100000, 20260229100001 | () → TABLE | ✅ OK |
| admin_get_overview_app_stats | 20260225100000_admin_overview_app_stats.sql | () → TABLE | ✅ OK |
| admin_get_active_today_count | 20260225100002 | () → TABLE(active_count bigint) | ✅ OK |
| get_active_sessions | 20260225000001_get_active_sessions.sql | (active_minutes integer DEFAULT 15) → TABLE | ✅ OK |
| admin_audit_log_set_previous_hash | 20260228000003 (trigger) | trigger | ✅ OK |
| admin_audit_log_set_row_hash | 20260228000003 (trigger) | trigger | ✅ OK |
| admin_sessions_forbid_delete | 20260224000001 (trigger) | trigger | ✅ OK |

### 4.2 RPCs ALTERed but never CREATE'd in repo (Schema drift)

These are **ALTER**-ed in `20260302100006_fix_admin_functions_search_path.sql` (search_path). No corresponding **CREATE** in this repo. If the DB was created only from repo migrations, they would not exist.

| RPC | Used by | Expected signature | Status |
|-----|---------|--------------------|--------|
| admin_get_all_stats | overview-stats/route.ts | () → single row `{ stats, overview, activeToday }` | ❌ **Missing CREATE** |
| admin_get_application_counts | applications/route.ts | () → single row counts | ❌ **Missing CREATE** |
| admin_get_applications_fast | applications/route.ts | (p_status, p_limit, p_offset) → set of rows | ❌ **Missing CREATE** |

### 4.3 RPCs called from code but never defined in migrations

| RPC | Call site | Parameters | Status |
|-----|-----------|------------|--------|
| **admin_set_verification** | page.tsx (toggleVerification, approveVerification) | p_target_user_id uuid, p_is_verified boolean | ❌ **MISSING** |
| **admin_set_banned** | page.tsx (toggleBan) | p_target_user_id uuid, p_is_banned boolean | ❌ **MISSING** |
| **admin_delete_user** | delete-user/route.ts, admin-approval.ts (executeApprovedAction) | p_user_id uuid | ❌ **MISSING** |
| admin_get_applications | page.tsx loadData fallback | () | ❌ **MISSING** |
| admin_get_all_users | page.tsx loadData | () | ❌ **MISSING** |
| admin_get_recent_verification_activity | page.tsx loadData | () | ❌ **MISSING** |
| **admin_approve_application** | bulk-applications/route.ts, admin-approval executeApprovedAction | p_application_id | ❌ **MISSING** |
| **admin_reject_application** | bulk-applications/route.ts, admin-approval | p_application_id | ❌ **MISSING** |
| **admin_waitlist_application** | bulk-applications/route.ts | p_application_id | ❌ **MISSING** |
| **admin_suspend_application** | bulk-applications/route.ts, admin-approval | p_application_id | ❌ **MISSING** |

### 4.4 Signature / return shape

- **admin_repair_audit_chain**: Returns `jsonb_build_object('ok', true, 'rows_updated', updated_count)`. Route expects `{ ok?, rows_updated? }`. ✅ Match.
- **admin_application_action_v2**: Returns uuid or NULL. Route treats null as 409. ✅ Match.

**Report:**  
- **Broken / missing RPCs:** admin_set_verification, admin_set_banned, admin_delete_user, admin_get_applications, admin_get_all_users, admin_get_recent_verification_activity, admin_approve_application, admin_reject_application, admin_waitlist_application, admin_suspend_application, admin_get_all_stats, admin_get_application_counts, admin_get_applications_fast (last three ALTER-only).  
- **Signature mismatches:** None for RPCs that are defined.  
- **Functions dropped in later migrations:** Not found.  
- **Renamed but frontend not updated:** Not found.

---

## 5. SECTION 4 — Database Tables & Columns

### 5.1 Mutations and tables

- **applications**: updated_at, status, assigned_to, assigned_at, assignment_expires_at — all added in 20260227000001. ✅
- **user_reports**: updated_at, assigned_to, assigned_at, assignment_expires_at, status, notes, reviewed_by, reviewed_at — present in migrations. ✅
- **data_requests**: status, updated_at — 20260229100002 adds updated_at. ✅
- **admin_escalations**: status, resolved_at, notes — 20260228000001. ✅
- **admin_approval_requests**: full lifecycle columns — 20260228000002. ✅
- **admin_audit_log**: previous_hash, row_hash — 20260228000003. ✅
- **admin_audit_snapshots**: 20260228000004 (control_framework). ✅
- **profiles**: Used by anonymize (name, username, profile_image_url, location, bio, niche, instagram_username, updated_at). Existence assumed; **is_verified / is_banned** not found in migrations grep — if admin_set_verification / admin_set_banned are added, they will need these columns or equivalent (e.g. verification_requests + profiles).

### 5.2 Risk

- **admin_set_verification / admin_set_banned**: No migration defines them. They likely expect `profiles.is_verified` and `profiles.is_banned` (or similar). Schema for profiles in repo does not show these columns in migrations — **constraint/column drift risk** when adding the RPCs.

**Report:** Tables used by API routes exist. Missing columns risk for profiles if verification/ban RPCs are added without a migration that adds is_verified / is_banned.

---

## 6. SECTION 5 — Migration Order & Drift

### 6.1 Chronological migrations (relevant)

- 20260220000001–20000004: admin_audit_log, user_reports, data_requests, app_config  
- 20260221000001: fix RLS linter  
- 20260224000001: admin_sessions_phase6 (admin_sessions_forbid_delete)  
- 20260225000001–25100002: get_active_sessions, admin_get_overview_counts, admin_get_active_today_count  
- 20260225100000: admin_get_overview_app_stats  
- 20260226000001: admin_rbac  
- 20260227000001: moderation_phase2 (applications/user_reports columns, admin_application_action_v2, admin_idempotency_keys)  
- 20260228000001–00005: escalations, approval_requests, audit tamper-evident, control framework  
- 20260228100000: admin_repair_audit_chain  
- 20260229100000–29100002: overview counts, profiles, data_requests updated_at  
- 20260302*: analytics schema, cron, retention, RPCs, fix_admin_functions_search_path  

### 6.2 Drift

- **20260302100006** runs `ALTER FUNCTION ... admin_get_application_counts()`, `admin_get_all_stats()`, `admin_get_applications_fast(...)`. No migration in the repo **creates** these functions. So either: (1) they were created outside the repo, or (2) a migration that created them was removed/squashed. **Result:** Migration order assumes objects that are not defined in the repo → **schema drift**.

### 6.3 Dropped / renamed

- No dropped functions still referenced.
- No renamed tables still referenced in code.

**Report:** Drift = ALTER-only for admin_get_all_stats, admin_get_application_counts, admin_get_applications_fast. No duplicate function definitions or out-of-order dependency found.

---

## 7. SECTION 6 — Admin Permissions Map

### 7.1 ADMIN_PERMISSIONS (admin-rbac.ts)

All 25 permissions are defined and used. No unused constant; no permission used but not defined.

### 7.2 TAB_PERMISSION (page.tsx)

| Tab | Permission | Used in hasPermission(TAB_PERMISSION[id]) |
|-----|------------|------------------------------------------|
| overview | read_applications | ✅ |
| dashboard | read_applications | ✅ |
| applications | read_applications | ✅ |
| users | read_users | ✅ |
| verifications | read_applications | ✅ |
| inbox | read_reports | ✅ |
| reports | read_reports | ✅ |
| data-requests | read_data_requests | ✅ |
| risk | read_risk | ✅ |
| approvals | approve_approval | ✅ |
| audit | read_audit | ✅ |
| compliance | read_audit | ✅ |
| analytics | read_analytics | ✅ (and special-case "analytics" in nav) |
| settings | read_config | ✅ |

Every tab has a permission; every protected route checks a permission. No route is accessible without requireAdmin; mutate routes also use requirePermission.

### 7.3 Inconsistencies

- **Analytics tab:** Shown if `id === 'analytics' || hasPermission(..., TAB_PERMISSION[id])`. So analytics is shown when user has read_analytics. ✅
- **Compliance** has read_audit; repair-chain and health/run use export_audit — only roles with export_audit can run those actions. ✅

**Report:** No route without permission check. No permission constant unused. No permission used but not defined. Tab–permission map consistent.

---

## 8. SECTION 7 — Simulated Action Matrix (PASS/FAIL)

| Area | Action | Route/RPC exists | Permission | DB object | Result |
|------|--------|------------------|------------|-----------|--------|
| Applications | Approve (single) | ✅ POST action | mutate_applications | admin_application_action_v2 ✅ | **PASS** |
| Applications | Reject (single) | ✅ POST action | mutate_applications | admin_application_action_v2 ✅ | **PASS** |
| Applications | Waitlist | ✅ POST action | mutate_applications | admin_application_action_v2 ✅ | **PASS** |
| Applications | Suspend | ✅ POST action | mutate_applications | admin_application_action_v2 ✅ | **PASS** |
| Applications | Claim | ✅ POST claim | mutate_applications | applications.assigned_to ✅ | **PASS** |
| Applications | Release | ✅ POST release | mutate_applications | applications ✅ | **PASS** |
| Applications | Bulk approve | ✅ POST bulk-applications | mutate_applications | RPC admin_approve_application ❌ | **FAIL** |
| Applications | Bulk reject | ✅ POST bulk-applications | bulk_applications | RPC admin_reject_application ❌ | **FAIL** |
| Applications | Bulk waitlist | ✅ POST bulk-applications | mutate_applications | RPC admin_waitlist_application ❌ | **FAIL** |
| Applications | Bulk suspend | ✅ POST bulk-applications | bulk_applications | RPC admin_suspend_application ❌ | **FAIL** |
| Users | Delete | ✅ POST delete-user | delete_users | RPC admin_delete_user ❌ | **FAIL** |
| Users | Anonymize | ✅ POST anonymize-user | anonymize_users | direct update ✅ | **PASS** |
| Users | Export | ✅ GET export-user | export_user | route logic ✅ | **PASS** |
| Users | Toggle verification | ❌ RPC only | (client) | admin_set_verification ❌ | **FAIL** |
| Users | Toggle ban | ❌ RPC only | (client) | admin_set_banned ❌ | **FAIL** |
| Reports | Resolve / dismiss | ✅ PATCH reports | resolve_reports | user_reports ✅ | **PASS** |
| Reports | Claim | ✅ POST claim | resolve_reports | user_reports ✅ | **PASS** |
| Reports | Release | ✅ POST release | resolve_reports | user_reports ✅ | **PASS** |
| Data requests | Update status | ✅ PATCH data-requests | update_data_requests | data_requests ✅ | **PASS** |
| Approvals | Approve | ✅ POST approve | approve_approval | admin_approval_requests ✅ | **PASS** |
| Approvals | Reject | ✅ POST reject | approve_approval | admin_approval_requests ✅ | **PASS** |
| Audit | Verify chain | ✅ GET audit/verify | read_audit | admin_audit_log ✅ | **PASS** |
| Audit | Snapshot | ✅ POST audit/snapshot | read_audit | admin_audit_snapshots ✅ | **PASS** |
| Audit | Repair chain | ✅ POST repair-chain | export_audit | admin_repair_audit_chain ✅ | **PASS** |
| Compliance | Run health | ✅ POST health/run | export_audit | control health ✅ | **PASS** |
| Compliance | Generate evidence | ✅ POST evidence/generate | export_audit | admin_control_evidence ✅ | **PASS** |
| Admin users | Assign role | ✅ POST assign-role | manage_roles | admin_user_roles ✅ | **PASS** |
| Admin users | Remove role | ✅ DELETE remove-role | manage_roles | admin_user_roles ✅ | **PASS** |
| Admin users | Revoke session | ✅ POST revoke | manage_roles | admin_sessions ✅ | **PASS** |
| Overview | Load stats | ✅ GET overview-stats | read_applications | admin_get_all_stats ❌ | **FAIL** |
| Applications list | Load list/counts | ✅ GET applications | read_applications | admin_get_application_counts, admin_get_applications_fast ❌ | **FAIL** |
| Users list (loadData) | Load users | RPC only | — | admin_get_all_users ❌ | **FAIL** |
| Verifications | Approve (button) | RPC only | — | admin_set_verification ❌ | **FAIL** |

**Summary:** **PASS** where route and DB object exist; **FAIL** where RPC is missing or only ALTER exists.

---

## 9. SECTION 8 — Super Strict Check: admin_set_verification and admin_* RPCs

### 9.1 admin_set_verification

- **UI/API locations:**  
  - `src/app/admin/page.tsx` (around 1674, 1747): `supabase.rpc('admin_set_verification', { p_target_user_id, p_is_verified })`.
- **Migrations:** **No** `CREATE FUNCTION admin_set_verification` (or similar) in any migration. **Never existed** in this repo.
- **Expected signature:**  
  - `admin_set_verification(p_target_user_id uuid, p_is_verified boolean)`  
  - Expected behavior: set `profiles.is_verified` (or equivalent) for `p_target_user_id` to `p_is_verified`; possibly update verification_requests. Return void or ok.

### 9.2 admin_set_banned

- **Location:** `src/app/admin/page.tsx` (~1693): `supabase.rpc('admin_set_banned', { p_target_user_id, p_is_banned })`.
- **Migrations:** **No** CREATE. **Never existed** in repo.
- **Expected signature:** `admin_set_banned(p_target_user_id uuid, p_is_banned boolean)` (e.g. set profiles.is_banned).

### 9.3 admin_delete_user

- **Locations:**  
  - `src/app/api/admin/delete-user/route.ts` (line 74): `serviceSupabase.rpc('admin_delete_user', { p_user_id: userId })`.  
  - `src/lib/admin-approval.ts` (line 99): `supabase.rpc('admin_delete_user', { p_user_id: userId })`.
- **Migrations:** **No** CREATE. **Never existed** in repo.
- **Expected signature:** `admin_delete_user(p_user_id uuid)` — typically SECURITY DEFINER, delete or anonymize auth.users + related rows.

### 9.4 Other admin_* string literals

- All other `admin_*` RPC names referenced in the codebase are listed in Section 3. Those that have CREATE are OK; the rest are missing or ALTER-only as reported.

**Exact fix required (see below):** Add migrations that CREATE the missing functions, or replace client/API calls with API routes that perform the same operations via service role and table updates (and add migrations for any new columns/tables).

---

## 10. Final Lists

### 10.1 Broken RPCs (called but not defined in repo)

1. admin_set_verification  
2. admin_set_banned  
3. admin_delete_user  
4. admin_get_applications  
5. admin_get_all_users  
6. admin_get_recent_verification_activity  
7. admin_approve_application  
8. admin_reject_application  
9. admin_waitlist_application  
10. admin_suspend_application  

### 10.2 Missing routes

**None.** All referenced admin API routes exist.

### 10.3 Signature mismatches

**None** for RPCs that are defined in migrations.

### 10.4 Permission inconsistencies

**None.** All routes use requireAdmin and the correct ADMIN_PERMISSIONS constant where required.

### 10.5 Schema drift

- **ALTER-only (no CREATE in repo):** admin_get_all_stats, admin_get_application_counts, admin_get_applications_fast.  
- **Profiles:** is_verified / is_banned not present in migrations; required if admin_set_verification / admin_set_banned are implemented as DB functions.

### 10.6 PASS/FAIL matrix

See Section 7 table. **FAIL** for: Overview stats, Applications list (when relying on these RPCs), Users list (admin_get_all_users), Verifications (admin_set_verification), Users toggle verification/ban (admin_set_verification, admin_set_banned), Delete user (admin_delete_user), Bulk application actions (admin_approve/reject/waitlist/suspend_application).

---

## 11. Root Cause Analysis: admin_set_verification Error

- **Symptom:** "Failed to update verification" (or similar) when toggling verification or approving verification in the UI.
- **Cause:** The frontend calls `supabase.rpc('admin_set_verification', ...)`. The function **does not exist** in the database when migrations are applied from this repo alone.
- **Why it’s missing:** No migration in the repo ever created `admin_set_verification`. It may have been created manually, in another repo, or never added.
- **Impact:** Users tab verification toggle and Verifications tab approve button do not work in any environment that only has repo migrations.

---

## 12. Exact Fix Required

### Option A — Add missing RPCs via migrations (recommended)

1. **admin_set_verification**  
   - New migration:  
     - Ensure `profiles` has `is_verified` (boolean, default false). If not, add column.  
     - `CREATE OR REPLACE FUNCTION public.admin_set_verification(p_target_user_id uuid, p_is_verified boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN UPDATE profiles SET is_verified = p_is_verified, updated_at = now() WHERE id = p_target_user_id; END; $$;`

2. **admin_set_banned**  
   - Ensure `profiles` has `is_banned` (boolean).  
   - `CREATE OR REPLACE FUNCTION public.admin_set_banned(p_target_user_id uuid, p_is_banned boolean) RETURNS void ...` (update profiles.is_banned).

3. **admin_delete_user**  
   - `CREATE OR REPLACE FUNCTION public.admin_delete_user(p_user_id uuid) RETURNS void SECURITY DEFINER` — implement deletion/anonymization of auth.users and related rows (e.g. via Supabase auth admin API or direct delete where allowed).

4. **admin_get_all_stats**  
   - CREATE function that returns a single jsonb/row with keys `stats`, `overview`, `activeToday` matching what overview-stats expects (see overview-stats/route.ts).

5. **admin_get_application_counts**  
   - CREATE function returning one row with pending, approved, rejected, waitlisted, suspended, total (e.g. from applications grouped by status).

6. **admin_get_applications_fast**  
   - CREATE function with (p_status text, p_limit int, p_offset int) returning setof rows (applications + profile join).

7. **admin_get_applications**  
   - CREATE function returning setof application rows (or alias to admin_get_applications_fast with null, limit, 0).

8. **admin_get_all_users**  
   - CREATE function returning setof user/profile rows for admin users list.

9. **admin_get_recent_verification_activity**  
   - CREATE function returning recent verification-related rows for dashboard.

10. **admin_approve_application**, **admin_reject_application**, **admin_waitlist_application**, **admin_suspend_application**  
    - Each: `(p_application_id uuid) RETURNS void` (or uuid), updating applications.status to ACTIVE, REJECTED, WAITLISTED, SUSPENDED respectively. Can be wrappers around admin_application_action_v2 or direct UPDATEs.

Apply migrations in order; ensure search_path and SECURITY DEFINER are set where appropriate (and aligned with 20260302100006 if those functions are later altered there).

### Option B — Replace RPCs with API routes

- **Toggle verification / ban:** Add POST `/api/admin/users/:id/verification` and `/api/admin/users/:id/ban`. In route: requireAdmin + permission (e.g. mutate_applications or a new permission), then use service role to UPDATE profiles (is_verified / is_banned). Remove direct `supabase.rpc('admin_set_verification'|'admin_set_banned')` from page.tsx.
- **Delete user:** Keep calling delete-user API; implement actual deletion inside the route (e.g. via Supabase Auth Admin API) instead of calling admin_delete_user RPC, or add admin_delete_user in a migration and keep current flow.
- **Bulk applications:** In bulk-applications route, for each id call `admin_application_action_v2` with the appropriate action (approve/reject/waitlist/suspend) instead of separate admin_*_application RPCs, or add the four RPCs in a migration.

Either option restores integrity; Option A keeps current client/API surface; Option B reduces dependency on missing RPCs and centralizes logic in the API.

---

*End of audit.*
