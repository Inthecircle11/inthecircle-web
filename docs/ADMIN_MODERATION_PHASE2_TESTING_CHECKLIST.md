# Enterprise Moderation Control Phase 2 — Testing Checklist

Use staging or a test admin account. Ensure the Phase 2 migration has been applied (`20260227000001_moderation_phase2.sql`).

---

## 1. Claim conflict (reports)

- **Setup:** Two moderator sessions (e.g. two browsers or incognito), same report ID.
- **Steps:** Moderator A and Moderator B both click **Claim** on the same pending report at nearly the same time.
- **Expected:** One receives **200** and the report shows “Claimed by you”; the other receives **409** with message like “Already claimed” or “Report is already assigned”.

---

## 2. Claim conflict (applications)

- **Setup:** Two moderator sessions, same pending application.
- **Steps:** Moderator A and Moderator B both click **Claim** on the same application at nearly the same time.
- **Expected:** One **200**, report shows “Claimed by you”; the other **409** (“Already claimed” or “Application is already assigned”).

---

## 3. Concurrent approve (applications)

- **Setup:** Two moderators with the same pending application in view (neither has claimed, or both have stale data).
- **Steps:** Both click **Approve** at nearly the same time (or one Approve, one Reject).
- **Expected:** One request **succeeds** (200); the other receives **409** “Record changed by another moderator”. No duplicate approval.

---

## 4. Claim expiry

- **Setup:** Set `ADMIN_ASSIGNMENT_TTL_MINUTES` to 1 (or 2) for quick test. Moderator A claims a report or application.
- **Steps:** Wait until after TTL (e.g. 1–2 minutes). Do not refresh. Moderator B opens the same item and clicks **Claim**.
- **Expected:** Moderator B can claim (200). Item becomes “Claimed by you” for B. (Optional: UI countdown or “Expires in …” reflects TTL.)

---

## 5. Assigned item not claimable until expired

- **Setup:** Moderator A claims a report (or application). TTL not yet expired.
- **Steps:** Moderator B opens the same report/application and tries **Claim**.
- **Expected:** **409** or UI disallows claim (e.g. button disabled with “Claimed by another moderator”). After TTL expires, B can claim (see §4).

---

## 6. Sorting — overdue first

- **API:** GET `/api/admin/reports?sort=overdue` and GET `/api/admin/applications?sort=overdue`.
- **Expected:** 200; order is SLA-based: oldest/overdue first (e.g. created &gt; 24h, then &gt; 6h, then newer). Default sort when no `sort` param should behave as overdue.
- **UI:** Reports tab → Sort **Overdue**; Applications tab → Sort **Overdue**. Refresh.
- **Expected:** List order matches API; oldest items at top.

---

## 7. Idempotency key (bulk)

- **Setup:** Pick 2–3 pending application IDs. Use a fixed idempotency key, e.g. `test-bulk-001`.
- **Steps:**  
  1. POST `/api/admin/bulk-applications` with `{ "application_ids": ["id1","id2"], "action": "approve" }` and header `Idempotency-Key: test-bulk-001`.  
  2. Repeat the **exact** same request (same key, same body).
- **Expected:** First request **200**, applications updated. Second request **200** with **same response body** (cached); no duplicate side effects (e.g. audit entries or status changes only once).

---

## 8. Performance (1000+ queue items)

- **Setup:** Seed `user_reports` and/or `applications` with 1000+ rows (e.g. mix of pending/resolved and assigned/unassigned).
- **Steps:**  
  - GET `/api/admin/reports?status=pending&sort=overdue&filter=all`.  
  - GET `/api/admin/applications?sort=overdue&filter=all`.  
  - Use filters: `filter=unassigned`, `filter=assigned_to_me`, `sort=oldest`, `sort=assigned_to_me`.
- **Expected:** Responses return in reasonable time (&lt; ~3s on typical staging); no N+1 or full table scan. Indexes on `(assigned_to, assignment_expires_at)`, `created_at`, `updated_at` are used (check with EXPLAIN if needed).

---

## 9. Backward compatibility

- **Unclaimed items:** Open a report or application that has **no** assignment (`assigned_to` null or expired). As any moderator, click **Resolve** (report) or **Approve** (application) without claiming first.
- **Expected:** Action succeeds (200). Unclaimed items remain processable without requiring claim.
- **Legacy clients:** Omit `updated_at` in PATCH report or POST application action (if supported for backward compat).
- **Expected:** Either 400 “updated_at required” or fallback behavior per design; no 500.

---

## 10. UI — Filters and badges

- **Reports tab:** Use filters **All**, **Unassigned**, **My items**. Use sort **Overdue**, **Oldest**, **My items**. Click **Claim** / **Release**.
- **Expected:** List updates per filter/sort; “Claimed by you” and “Claimed by another moderator” badges appear; action buttons disabled when claimed by another moderator (until expired).
- **Applications tab:** Same (Assignment: All / Unassigned / My items; Sort: Overdue / Oldest / My items). Claim / Release; badges; Approve/Reject/Waitlist/Suspend disabled when claimed by another moderator.
- **Expected:** Consistent behavior with reports; no duplicate claims; 409 surfaced in UI (e.g. error toast or message).

---

## Sign-off

| Check | Result |
|------|--------|
| §1 Claim conflict (reports) | ☐ |
| §2 Claim conflict (applications) | ☐ |
| §3 Concurrent approve | ☐ |
| §4 Claim expiry | ☐ |
| §5 Assigned not claimable until expired | ☐ |
| §6 Sort overdue | ☐ |
| §7 Idempotency bulk | ☐ |
| §8 Performance 1000+ | ☐ |
| §9 Backward compatibility | ☐ |
| §10 UI filters and badges | ☐ |
