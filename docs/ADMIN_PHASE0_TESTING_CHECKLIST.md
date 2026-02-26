# Phase 0 Enterprise Hardening — Testing Checklist

Execute these steps to validate the implementation. Use staging or a test admin account.

---

## 1. Destructive without reason

- **Delete user:** Open Users → select user → Delete User. In the reason step, leave reason empty or &lt; 5 characters. Click "Delete User".  
  **Expected:** Button disabled until reason ≥ 5 characters; no request sent with short reason.
- **Anonymize user:** Same flow, leave reason short.  
  **Expected:** Cannot submit until reason ≥ 5 characters.
- **Bulk reject:** Applications → select one or more → Reject. In the prompt, enter 1–4 characters or cancel.  
  **Expected:** Error "Reason required (min 5 characters)" and no bulk request; or no request if cancelled.
- **Audit POST (direct):** `POST /api/admin/audit` with body `{ "action": "user_delete", "target_type": "user", "target_id": "<id>" }` (no `reason`).  
  **Expected:** 400 with message like "reason required for this action".

---

## 2. Destructive with reason

- **Delete user:** Select user → Delete User → enter reason ≥ 5 chars → Delete User.  
  **Expected:** User deleted; Audit tab shows entry with action `user_delete` and the reason in the Reason column.
- **Anonymize user:** Select user → Anonymize user → enter reason ≥ 5 chars → Anonymize.  
  **Expected:** Profile anonymized; audit entry `user_anonymize` with reason.
- **Bulk reject:** Select applications → Reject → confirm → enter reason ≥ 5 chars.  
  **Expected:** Applications rejected; one audit entry `bulk_reject` with reason (and details.count/ids).
- **Bulk suspend:** Same with Suspend and reason.  
  **Expected:** Applications suspended; audit entry `bulk_suspend` with reason.

---

## 3. Rate limit breach

- **Setup:** Ensure `ADMIN_DESTRUCTIVE_RATE_LIMIT_PER_HOUR` is 5 (or set to 2 for quick test).
- **Steps:** As the same admin, perform 6 destructive actions within 1 hour (e.g. 6 anonymize or 6 bulk reject, or mix of delete/anonymize/bulk reject/suspend).  
  **Expected:** First 5 succeed; 6th returns 429 with message like "Rate limit exceeded" and `Retry-After: 3600`. No audit row for the 6th.
- **Audit POST:** Call `POST /api/admin/audit` six times with `action: "user_delete"` and valid reason (same admin session).  
  **Expected:** 5 succeed; 6th returns 429.

---

## 4. Audit filtering

- **No filters:** GET `/api/admin/audit?limit=10`.  
  **Expected:** 200, `entries` array, newest first; up to 10 rows.
- **By action:** GET `/api/admin/audit?action=reject&limit=50`.  
  **Expected:** Only entries where action contains "reject" (e.g. `application_reject`, `bulk_reject`).
- **By target_type:** GET `/api/admin/audit?target_type=user&limit=20`.  
  **Expected:** Only entries with `target_type=user`.
- **By date range:** GET `/api/admin/audit?date_from=2025-01-01T00:00:00.000Z&date_to=2025-12-31T23:59:59.999Z&limit=100`.  
  **Expected:** Only entries with `created_at` in range.
- **Combined:** Use admin_user_id (UUID), action, target_type, date_from, date_to together.  
  **Expected:** Results match all filters; order `created_at` DESC.
- **UI:** Audit tab — set Action (partial), Target type, Target ID, Date from/to → Refresh.  
  **Expected:** Table shows only filtered results.

---

## 5. CSV export

- **API:** GET `/api/admin/audit?format=csv&limit=100`.  
  **Expected:** 200; `Content-Type: text/csv; charset=utf-8`; `Content-Disposition: attachment; filename="audit-log-YYYY-MM-DD.csv"`; body is CSV with header row and data; columns include id, admin_user_id, admin_email, action, target_type, target_id, details, reason, client_ip, session_id, created_at.
- **With filters:** Same query with action, date_from, date_to.  
  **Expected:** CSV contains only rows matching filters; max 1000 rows.
- **UI:** Audit tab → set filters (optional) → Export CSV.  
  **Expected:** Browser downloads a CSV file; opening it shows same columns and filtered data.

---

## 6. IP and session logging

- **After any audit insert:** In DB or via GET audit, inspect latest row(s).  
  **Expected:** `client_ip` populated (or null if behind proxy that doesn’t send x-forwarded-for/x-real-ip); `session_id` populated (Supabase session id or fallback UUID).
- **Direct POST audit:** Call POST from a client; then GET audit and find the new entry.  
  **Expected:** That entry has `client_ip` and `session_id` set (subject to env/headers).

---

## 7. Performance impact

- **Audit list:** GET `/api/admin/audit?limit=200` and measure response time.  
  **Expected:** Response time acceptable (e.g. &lt; 1s for 200 rows with indexes).
- **Filtered query:** GET with admin_user_id + date_from + date_to.  
  **Expected:** Uses composite index; no full table scan (check DB explain if needed).
- **Rate limit check:** Before each destructive call, one count query runs.  
  **Expected:** No noticeable slowdown for single actions.

---

## 8. Backward compatibility

- **Non-destructive audit:** POST with `action: "application_approve"`, no `reason`.  
  **Expected:** 200; row inserted with reason=null.
- **Existing UI flows:** Approve application, Waitlist, Ban/Unban, Verify, Export user.  
  **Expected:** All work without asking for reason; audit entries created (reason null where not required).
- **Audit GET no params:** GET `/api/admin/audit` (no query params).  
  **Expected:** 200; default limit (50); entries by created_at DESC.

---

## Sign-off

| Test area                    | Pass / Fail | Notes |
|-----------------------------|------------|--------|
| Destructive without reason  |            |       |
| Destructive with reason     |            |       |
| Rate limit breach           |            |       |
| Audit filtering             |            |       |
| CSV export                  |            |       |
| IP + session logging        |            |       |
| Performance                 |            |       |
| Backward compatibility      |            |       |
