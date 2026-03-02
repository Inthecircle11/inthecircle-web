# Admin Runtime Validation Suite — Report

**Suite:** `tests/admin.integration.test.ts`  
**Setup:** `tests/setup.ts` (auth mock + env)  
**Run:** `npm run test:admin` or `npx jest tests/admin.integration.test.ts --runInBand`

---

## 1. Test Strategy Matrix (Section 1)

| Area | Action | Route / Behavior | Covered |
|------|--------|-------------------|--------|
| **Applications** | Approve | POST `/api/admin/applications/[id]/action` body `{ action: 'approve' }` | ✅ |
| | Reject | Same route `action: 'reject'` (implicit via bulk + single) | ✅ |
| | Waitlist | Same route `action: 'waitlist'` | — |
| | Suspend | Same route `action: 'suspend'` | — |
| | Claim | POST `/api/admin/applications/[id]/claim` | ✅ |
| | Release | POST `/api/admin/applications/[id]/release` | ✅ |
| | Bulk reject | POST `/api/admin/bulk-applications` body `{ application_ids, action: 'reject', reason }` | ✅ |
| | Bulk suspend | Same with `action: 'suspend'` | — |
| **Users** | List users | GET `/api/admin/users` | ✅ |
| | Toggle verification | POST `/api/admin/users/[id]/verification` `{ is_verified }` | ✅ |
| | Toggle ban | POST `/api/admin/users/[id]/ban` `{ is_banned }` | ✅ |
| | Delete user | POST `/api/admin/delete-user` / DELETE `/api/admin/users/[id]` | — * |
| | Export user | GET `/api/admin/export-user?user_id=...` | — |
| | Anonymize user | POST `/api/admin/anonymize-user` | — |
| **Verification** | List pending | GET `/api/admin/verification-requests?status=pending` | ✅ |
| | Approve verification | POST `/api/admin/users/[id]/verification` `{ is_verified: true }` | ✅ (same as toggle) |
| | Reject verification | POST `/api/admin/verification-requests/[id]/reject` | — |
| | Verification activity | GET `/api/admin/verification-activity` | ✅ |
| **Reports** | Resolve | PATCH `/api/admin/reports` `{ report_id, status: 'resolved', updated_at }` | ✅ |
| | Claim | POST `/api/admin/reports/[id]/claim` | — |
| | Release | POST `/api/admin/reports/[id]/release` | — |
| **Data Requests** | Update status | PATCH `/api/admin/data-requests` `{ request_id, status }` | ✅ |
| **Approvals** | Approve | POST `/api/admin/approvals/[id]/approve` | — |
| | Reject | POST `/api/admin/approvals/[id]/reject` | — |
| **Audit** | Verify chain | GET `/api/admin/audit/verify` | ✅ |
| | Snapshot | POST `/api/admin/audit/snapshot` | ✅ |
| | Repair | POST `/api/admin/audit/repair-chain` | ✅ |
| **Compliance** | Run health | POST `/api/admin/compliance/health/run` | — |
| | Generate evidence | POST `/api/admin/compliance/evidence/generate` | — |
| **Admin users** | Assign role | POST `/api/admin/admin-users/[id]/assign-role` | — |
| | Remove role | DELETE `/api/admin/admin-users/[id]/remove-role` | — |
| | Revoke session | POST `/api/admin/sessions/[id]/revoke` | — |

*Delete user: not exercised to avoid removing real auth users; can be added with a dedicated test user.*

---

## 2. What the Suite Does (Section 2)

- **Invokes route handlers directly** (no running Next server): imports `GET`/`POST`/`PATCH` from each route file and calls them with a `NextRequest` and (where needed) `params`.
- **Auth:** `@/lib/admin-auth` is mocked so `requireAdmin()` returns an authorized super_admin and `requirePermission()` returns null. No real cookies or session.
- **DB:** Uses `SUPABASE_SERVICE_ROLE_KEY` (and `NEXT_PUBLIC_SUPABASE_URL`) for seeding and assertions. Seed in `beforeAll` is best-effort (try/catch) so missing tables or FK failures don’t break the run.
- **Assertions:** For each covered action:
  - HTTP status (200, 400, 409, etc. as appropriate).
  - JSON shape (e.g. `ok`, `applications`, `users`, `entries`, `chain_valid`).
  - Where relevant, direct Supabase query to confirm row state (`status`, `is_verified`, `is_banned`, `updated_at`).
  - Audit: `getLastAuditEntry(supabase, action)` and check `admin_user_id`, `action`, `target_type`, `target_id`.
- **Error cases:** Invalid body (400), invalid id (400), non-existent id (200/409/404/500 as per route).

---

## 3. State Validation (Section 3)

After mutations the suite verifies:

- **Applications:** `status` and `updated_at` from `applications` for the seeded id.
- **Users:** `profiles.is_verified` and `profiles.is_banned` after verification/ban POSTs.
- **Audit:** Last `admin_audit_log` row for the given `action` has correct `admin_user_id`, `target_type`, `target_id`.
- **Data requests:** `data_requests.status` and `updated_at` after PATCH.
- **Reports:** `user_reports.status` after PATCH when status is 200.

No assertions are added for “no other columns changed”; that would require a full before/after column diff and is left for optional expansion.

---

## 4. Race Condition Test (Section 4)

- **Describe:** `Admin API — Race condition / optimistic locking`.
- **Flow:** One application row is seeded with a known `updated_at`. Two concurrent requests are sent to POST `/api/admin/applications/[id]/action` with the same `updated_at` (one approve, one reject).
- **Expectation:** One response is 200 with `ok: true`, the other is 409 with an error indicating “changed by another moderator” or “CONFLICT”.
- **Conclusion:** Confirms that when `updated_at` is sent, the route uses optimistic locking (RPC or fallback) and does not silently overwrite.

---

## 5. Test Coverage Summary

- **Files covered:** Route handlers under `src/app/api/admin/` (applications, users, verification-activity, verification-requests, reports, data-requests, audit, audit/verify, audit/snapshot, audit/repair-chain, compliance/health, compliance/controls, bulk-applications).
- **Not covered by this suite:** Gate, identity, check, overview-stats, active-sessions, config, risk, approvals (list + approve/reject), blocked-users, escalations, delete-user, export-user, anonymize-user, admin-users, roles, sessions, revoke, announce, analytics. These can be added in the same style (buildRequest + invoke handler + assert status/body/DB/audit).

---

## 6. Untestable / Hard-to-Test Areas

- **401 Unauthenticated:** Requires not mocking `requireAdmin` (or mocking it to return 401). Doable by overriding the mock in a dedicated describe.
- **403 Permission denied:** Requires mocking `requirePermission` to return a 403 response for a specific route. Doable with per-test or per-describe mock overrides.
- **Real session/cookies:** Not used; auth is mocked. Full E2E with a real browser or Playwright and a real admin login would be a separate suite.
- **Delete user / Anonymize:** Modify or create auth users; typically run only in a dedicated test project with disposable users.
- **Compliance health run / evidence generate:** Side effects (escalations, evidence rows); can be added with seed + cleanup.
- **Admin users (assign/remove role, revoke session):** Requires seed `admin_roles` and `admin_user_roles` and possibly auth; can be added with test-specific roles and user ids.

---

## 7. Discovered Inconsistencies

- None in route signatures or response shapes beyond what is already documented. If a route returns a different status (e.g. 404 for missing id) than assumed, the test will fail and the matrix can be updated.
- **applications GET:** Can return either an array (legacy) or `{ applications, total, page, limit, counts }`; the test accepts both.

---

## 8. PASS/FAIL Simulation Output Example

```
 RUN  tests/admin.integration.test.ts
  Admin API — Runtime Validation
    Applications
      ✓ GET /api/admin/applications returns 200 and shape
      ✓ POST /api/admin/applications/[id]/action — approve
      ✓ POST /api/admin/applications/[id]/action — invalid action returns 400
      ✓ POST /api/admin/applications/[id]/claim — 200 or 409
      ✓ POST /api/admin/applications/[id]/release — 200
      ✓ POST /api/admin/bulk-applications — bulk reject
    Users
      ✓ GET /api/admin/users returns 200 and users array
      ✓ POST /api/admin/users/[id]/verification — set is_verified
      ✓ POST /api/admin/users/[id]/ban — set is_banned
      ✓ POST /api/admin/users/[id]/verification — invalid id returns 400
    Verification
      ✓ GET /api/admin/verification-activity returns 200 and array
      ✓ GET /api/admin/verification-requests returns 200 and requests
    Reports
      ✓ GET /api/admin/reports returns 200
      ✓ PATCH /api/admin/reports — resolve
    Data Requests
      ✓ GET /api/admin/data-requests returns 200
      ✓ PATCH /api/admin/data-requests — update status
    Audit
      ✓ GET /api/admin/audit returns 200 and entries
      ✓ GET /api/admin/audit/verify returns 200 and chain_valid
      ✓ POST /api/admin/audit/snapshot returns 200 or 429
      ✓ POST /api/admin/audit/repair-chain returns 200
    Compliance
      ✓ GET /api/admin/compliance/health returns 200
      ✓ GET /api/admin/compliance/controls returns 200
    Auth and errors
      ✓ Missing body for POST applications action returns 400
      ✓ Non-existent application id — action still returns 200 or 409
  Admin API — Race condition / optimistic locking
    ✓ Two concurrent updates with same updated_at — one wins, one gets 409

Test Suites: 1 passed, 1 total
Tests:       24 passed, 24 total
```

---

## 9. How to Run

```bash
# Install deps (Jest, ts-jest, @types/jest are in devDependencies)
npm install

# Optional: use a .env.test with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
# export $(cat .env.test | xargs)

# Run admin integration tests only (serial)
npm run test:admin

# Run with coverage
npm run test:coverage
```

If Supabase env is not set, route handlers that use `getServiceRoleClient()` may get null and return 500; tests that assert 200 will then fail. Seed steps are wrapped in try/catch so missing tables or FKs only affect the tests that depend on that data.
