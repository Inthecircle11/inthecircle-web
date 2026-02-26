# Admin RBAC — Testing Checklist

Execute after deploying RBAC migration and API/UI changes. Use staging and test accounts with different roles.

---

## 1. Viewer cannot mutate

- **Setup:** Assign `viewer` role only to a test admin (remove other roles).
- **Applications:** GET /api/admin/applications → 200. Do not call approve/reject/waitlist/suspend from UI (buttons may still show; API must reject). If UI hides mutate buttons for viewer, confirm no approve/reject/waitlist/suspend buttons or they are disabled.
- **Reports:** GET /api/admin/reports → 200. PATCH /api/admin/reports (resolve/dismiss) → 403.
- **Config:** GET /api/admin/config → 200. PATCH /api/admin/config → 403.
- **Audit:** GET /api/admin/audit → 200. GET /api/admin/audit?format=csv → 403 (viewer has read_audit but not export_audit).
- **Users:** No delete or anonymize buttons (or 403 if triggered).

---

## 2. Moderator cannot delete

- **Setup:** Assign `moderator` only.
- **Applications:** Single approve/reject/waitlist/suspend → 200. Bulk reject/suspend → 403 (moderator has mutate_applications, not bulk_applications).
- **Reports:** PATCH resolve/dismiss → 200.
- **Delete user:** User modal must not show Delete or Anonymize (or API returns 403). POST /api/admin/audit with action user_delete and reason → 403. POST /api/admin/anonymize-user with reason → 403.

---

## 3. Supervisor cannot delete

- **Setup:** Assign `supervisor` only.
- **Bulk reject/suspend:** POST /api/admin/bulk-applications with action reject or suspend (and reason) → 200.
- **Ban user:** Toggle ban in UI → 200.
- **Delete/Anonymize:** Delete and Anonymize buttons must not show (or 403). POST /api/admin/anonymize-user → 403. Audit POST with action user_delete → 403.

---

## 4. Super_admin can delete

- **Setup:** Assign `super_admin` (or allowlisted admin with backfill).
- **Anonymize:** POST /api/admin/anonymize-user with user_id and reason → 200. Audit entry created.
- **Delete:** After delete user from UI (reason provided) → success; audit entry user_delete with reason.
- **Role management:** GET /api/admin/roles → 200. GET /api/admin/admin-users → 200. POST assign-role, DELETE remove-role → 200 when valid.

---

## 5. Role change audited

- **Setup:** super_admin account.
- **Assign role:** POST /api/admin/admin-users/:id/assign-role with role_name (e.g. moderator). Then GET /api/admin/audit, filter action=role_assign → entry with target_id = that admin id, details.role_name.
- **Remove role:** DELETE /api/admin/admin-users/:id/remove-role?role_name=moderator. Then GET audit, filter action=role_remove → entry with target_id, details.role_name.

---

## 6. Removing last super_admin blocked

- **Setup:** Ensure only one super_admin in the system (or use a test env with one).
- **Remove own super_admin:** As that super_admin, DELETE remove-role for self with role_name=super_admin → 400 with message like "at least one super_admin must remain".
- **Remove other's super_admin when last:** If there is exactly one super_admin, DELETE remove-role for that user with role_name=super_admin → 400.

---

## 7. Admin cannot assign role without permission

- **Setup:** moderator or viewer (no manage_roles).
- **GET /api/admin/roles** → 403.
- **GET /api/admin/admin-users** → 403.
- **POST /api/admin/admin-users/:id/assign-role** → 403.
- **DELETE /api/admin/admin-users/:id/remove-role** → 403.
- **UI:** Settings tab must not show "Admin users & roles" section for non–super_admin.

---

## 8. Backward compatibility

- **Allowlisted admin with no roles:** First request to any admin API → backfill assigns super_admin; subsequent requests have roles; GET /api/admin/check returns { authorized: true, roles: ['super_admin'] }.
- **Existing super_admin:** All existing flows (applications, reports, config, audit, delete, anonymize, bulk, role management) work as before.

---

## 9. Compliance role

- **Setup:** Assign `compliance` only.
- **Audit:** GET /api/admin/audit → 200. GET /api/admin/audit?format=csv → 200.
- **Data requests:** GET /api/admin/data-requests → 200. PATCH (update status) → 403 (compliance has read_data_requests, not update_data_requests).
- **Reports:** GET /api/admin/reports → 200. PATCH resolve/dismiss → 403.
- **Applications:** GET /api/admin/applications → 403 (compliance has no read_applications in current matrix; if it should have read-only, add and retest).

---

## Sign-off

| Test | Pass / Fail | Notes |
|------|-------------|--------|
| Viewer cannot mutate | | |
| Moderator cannot delete | | |
| Supervisor cannot delete | | |
| Super_admin can delete | | |
| Role change audited | | |
| Removing last super_admin blocked | | |
| Non–super_admin cannot manage roles | | |
| Backward compatibility | | |
| Compliance role | | |
