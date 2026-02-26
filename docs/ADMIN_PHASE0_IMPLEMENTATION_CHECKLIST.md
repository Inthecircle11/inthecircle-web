# Phase 0 Enterprise Hardening — Implementation Checklist

**Scope:** Audit filtering, CSV export, mandatory reason, rate limiting, IP/session in audit  
**Output:** Actionable steps for engineering execution.

---

## 1) Audit API filtering (admin, target, action, date range)

### Schema changes
- [ ] None required. Existing columns `admin_user_id`, `target_type`, `target_id`, `action`, `created_at` support filtering.

### Index changes
- [ ] Add composite index for admin + time filtering: `CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin_created ON admin_audit_log(admin_user_id, created_at DESC);`
- [ ] Date-range-only queries: already covered by existing `idx_admin_audit_log_created_at` on `(created_at DESC)`; no change.

### API endpoint updates
- [ ] **GET /api/admin/audit:** Parse query params: `admin_user_id` (uuid), `target_type` (string), `target_id` (string), `action` (string, exact or ILIKE), `date_from` (ISO8601), `date_to` (ISO8601), `limit` (default 50, max 200), `offset` (default 0).
- [ ] Build Supabase query: `.from('admin_audit_log').select('*')`. Apply `.eq('admin_user_id', admin_user_id)` if provided. Apply `.eq('target_type', target_type)` if provided. Apply `.eq('target_id', target_id)` if provided. Apply `.eq('action', action)` or `.ilike('action', `%${action}%`)` per product choice. Apply `.gte('created_at', date_from)` if provided. Apply `.lte('created_at', date_to)` if provided. Then `.order('created_at', { ascending: false }).range(offset, offset + limit - 1)`.
- [ ] Validate: `admin_user_id` must be valid UUID if present; `date_from`/`date_to` must be valid ISO dates; reject with 400 on invalid.
- [ ] Return JSON: `{ entries: data }` unchanged from current contract for non-export requests.

### Middleware changes
- [ ] None for filtering. Existing requireAdmin suffices.

### Backward compatibility
- [ ] All new params optional. Omission of all filters yields current behavior (last `limit` entries by created_at desc).

### Migration strategy
- [ ] Deploy API changes only; no DB migration required for filtering.

### Risk considerations
- [ ] Large date range + no limit cap could return too many rows; enforce max limit 200 and document max range (e.g. 1 year) if needed.

---

## 2) CSV export endpoint

### Schema changes
- [ ] None.

### Index changes
- [ ] None beyond 1). Filtering uses existing indexes.

### API endpoint updates
- [ ] **Option A:** Add query param `format=csv` to GET /api/admin/audit. When present, run same filtered query as 1), set response `Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="audit-log-{date}.csv"`. Stream or build CSV: header row `id,admin_user_id,admin_email,action,target_type,target_id,details,created_at,client_ip,session_id` (include new columns when 5) is done). Escape fields (quote if contains comma/newline).
- [ ] **Option B:** New route GET /api/admin/audit/export. Same query params as 1); same filtering; response CSV as above.
- [ ] For CSV: enforce max rows (e.g. 10,000) or same limit 200; document in API. Use streaming or chunked response if result set large.

### Middleware changes
- [ ] None. requireAdmin only.

### Backward compatibility
- [ ] New param or new route; existing GET /api/admin/audit unchanged when format not csv.

### Migration strategy
- [ ] Deploy with format=csv or /export; no migration.

### Risk considerations
- [ ] Large export can stress memory or timeout; cap rows and consider streaming.

---

## 3) Mandatory reason field for destructive and bulk actions

### Schema changes
- [ ] Add column to `admin_audit_log`: `reason text`. Nullable for backward compatibility. Migration: `ALTER TABLE admin_audit_log ADD COLUMN IF NOT EXISTS reason text;`

### Index changes
- [ ] None required for reason.

### API endpoint updates
- [ ] **POST /api/admin/audit:** Add optional body field `reason` (string). If present, insert into `reason` column. Do not require for existing callers until enforcement phase.
- [ ] **Enforcement:** Define list of “destructive” actions (e.g. `user_delete`, `user_anonymize`, `bulk_reject`, `bulk_suspend`, or action names containing `delete`, `anonymize`, `reject`). When POST body action is in that list, require `reason` (non-empty string, max length e.g. 500). Return 400 if missing.
- [ ] **Bulk applications:** POST /api/admin/bulk-applications — add body param `reason` (optional at first, then required when action is reject or suspend). Pass reason to audit POST when calling log (from API route after success). If audit is called from client, client must send reason; API route that performs bulk action should call audit with reason (server-side) so it cannot be bypassed.
- [ ] **Anonymize user:** POST /api/admin/anonymize-user — add body param `reason` (required for Phase 0). Return 400 if missing. On success, call audit insert with action, target_type user, target_id, details, reason.
- [ ] **Delete user (if exists):** Same as anonymize: require `reason` in body; pass to audit.
- [ ] **Reports PATCH:** Optional: add `reason` or use existing `notes` and store in audit details when resolving/dismissing. Not required for Phase 0 unless scope includes it.

### Middleware changes
- [ ] None. Validation in each route.

### Backward compatibility
- [ ] `reason` column nullable. Existing audit POST calls without reason continue to work until enforcement. New destructive routes require reason from day one.

### Migration strategy
- [ ] Deploy migration adding `reason`. Deploy API accepting reason. Update admin UI to collect reason in ConfirmModal for delete, anonymize, bulk reject (and bulk suspend if applicable). Then enable enforcement (require reason for destructive action list) in audit POST and in anonymize/bulk-applications/delete routes.

### Risk considerations
- [ ] Client could send empty reason if not validated server-side; enforce non-empty and max length in API.

---

## 4) Rate limiting destructive actions per admin

### Schema changes
- [ ] None. Use existing `admin_audit_log` to count actions in last 1 hour.

### Index changes
- [ ] Index `idx_admin_audit_log_admin_created` from 1) supports “count by admin_user_id where created_at > now() - 1 hour” and “action ILIKE '%delete%' OR action ILIKE '%anonymize%'”.

### API endpoint updates
- [ ] **Helper (server-side):** Function or inline: query `admin_audit_log` for `admin_user_id = X` and `created_at >= now() - interval '1 hour'` and `(action ILIKE '%delete%' OR action ILIKE '%anonymize%')`. Count rows. If count >= 5 (or configured threshold), return 429 with Retry-After and message.
- [ ] **Apply in routes:** Before performing destructive action in POST /api/admin/anonymize-user and POST that deletes user: call helper with req user id. If over limit, return 429. After successful action, audit insert runs (no need to check after).
- [ ] **Bulk applications:** Before bulk reject/suspend loop in POST /api/admin/bulk-applications: (1) count current destructive actions in last 1h for this admin (use same helper; treat bulk_reject as destructive). (2) If count + ids.length >= 5 (or threshold), return 429 or reject with “Rate limit: max N destructive actions per hour.” (3) Optionally cap ids.length (e.g. max 50) in same route.
- [ ] **Response:** 429 status, JSON `{ error: 'Rate limit exceeded for destructive actions. Max 5 per hour.' }`, header `Retry-After: 3600`.

### Middleware changes
- [ ] **Option A:** Middleware that intercepts POST /api/admin/anonymize-user, POST /api/admin/delete-user (if exists), POST /api/admin/bulk-applications (when action is reject/suspend). Runs count query and returns 429 if over limit. Requires access to Supabase in middleware or a small API that middleware calls.
- [ ] **Option B:** No global middleware; each route implements the check. Prefer Option B for clarity and to avoid middleware Supabase dependency.

### Backward compatibility
- [ ] New behavior: previously unlimited; now capped. Document in release notes. Threshold (5) should be configurable via env (e.g. ADMIN_DESTRUCTIVE_RATE_LIMIT_PER_HOUR).

### Migration strategy
- [ ] Deploy rate limit check in anonymize-user and bulk-applications (and delete-user if exists). Set threshold via env; default 5.

### Risk considerations
- [ ] Legitimate bulk operations (e.g. 10 rejects) may hit limit; cap per-request size (e.g. 50) and document “max N destructive actions per hour per admin.”

---

## 5) Add IP and session ID to audit log

### Schema changes
- [ ] Migration: `ALTER TABLE admin_audit_log ADD COLUMN IF NOT EXISTS client_ip text;`
- [ ] Migration: `ALTER TABLE admin_audit_log ADD COLUMN IF NOT EXISTS session_id text;`
- [ ] Both nullable for backward compatibility.

### Index changes
- [ ] Optional: `CREATE INDEX IF NOT EXISTS idx_admin_audit_log_session_id ON admin_audit_log(session_id);` for “all actions in session” queries. Optional: index on client_ip only if filtering by IP is required.

### API endpoint updates
- [ ] **Get client IP:** In Next.js App Router, use `headers().get('x-forwarded-for')` or `headers().get('x-real-ip')`; fallback to `request.headers.get('x-forwarded-for')` in route. Take first IP if comma-separated (client). Store in `client_ip` (max length e.g. 45 for IPv6).
- [ ] **Get session ID:** Option A: from Supabase auth session (e.g. `(await supabase.auth.getSession()).data.session?.id` or equivalent). Option B: generate or pass from client (e.g. stable session identifier from cookie or header). Prefer server-derived session id from Supabase if available.
- [ ] **POST /api/admin/audit:** In route, after requireAdmin, compute `client_ip` and `session_id`. Add to insert: `client_ip: clientIp ?? null`, `session_id: sessionId ?? null`.

### Middleware changes
- [ ] None. IP and session read in audit route only. If other admin routes must log IP/session, either pass to audit POST or add a thin middleware that attaches IP/session to request for downstream use.

### Backward compatibility
- [ ] New columns nullable. Existing rows have null; new inserts have values. Existing GET/export can include new columns in response.

### Migration strategy
- [ ] Deploy migration adding columns. Deploy API changes to populate on insert. No backfill required for old rows.

### Risk considerations
- [ ] IP can be spoofed if not behind trusted proxy; document that IP is “best effort” and which headers are trusted. PII: store only IP and session id; no additional PII in audit without policy.

---

## Cross-cutting checklist

### Migrations (single file or ordered)
- [ ] Create migration file `YYYYMMDD_phase0_audit_enterprise.sql` (or split per team).
- [ ] Add `reason text` to admin_audit_log.
- [ ] Add `client_ip text` to admin_audit_log.
- [ ] Add `session_id text` to admin_audit_log.
- [ ] Add index `idx_admin_audit_log_admin_created ON admin_audit_log(admin_user_id, created_at DESC)`.
- [ ] Run migration in staging then production.

### Audit POST callers (client)
- [ ] Admin UI: when calling logAudit for destructive actions (bulk reject, delete user, anonymize), include `reason` from ConfirmModal or input. Pass in body to POST /api/admin/audit.
- [ ] If audit is called from API routes after destructive action (recommended), reason is sent from server; ensure UI sends reason to that API so the API can include it in audit.

### Audit GET callers (client)
- [ ] Admin Audit tab: add optional filters (admin, target type, target id, action, date from, date to). Build query string from filters; call GET /api/admin/audit?…&limit=100. Display results.
- [ ] Add “Export CSV” button: same filters; call GET /api/admin/audit/export?… or GET /api/admin/audit?…&format=csv; trigger download.

### Environment
- [ ] Add `ADMIN_DESTRUCTIVE_RATE_LIMIT_PER_HOUR` (optional, default 5).
- [ ] Document trusted proxy headers for IP (e.g. x-forwarded-for, x-real-ip).

### Tests
- [ ] Unit or integration: audit GET with each filter alone and combined; audit GET with format=csv returns CSV and correct headers.
- [ ] Audit POST with reason; audit POST without reason for non-destructive still works; audit POST without reason for destructive returns 400 after enforcement.
- [ ] Rate limit: 6th destructive action in same hour for same admin returns 429.
- [ ] Audit POST stores client_ip and session_id when present.

### Documentation
- [ ] API doc: GET /api/admin/audit query params (admin_user_id, target_type, target_id, action, date_from, date_to, limit, offset, format).
- [ ] API doc: POST /api/admin/audit body (action, target_type, target_id, details, reason required for destructive list).
- [ ] Runbook: how to export audit for legal (filter by admin, date range, CSV export).
