# Admin Panel – Full Specification for Rebuild

This document describes the current Inthecircle admin panel in full detail so a new implementation can match behavior, branding, and structure. It includes routes, layout, branding/colors, tabs, components, types, RBAC, and API endpoints.

---

## 1. Entry & routing

- **Single entry URL:** `/admin` (or the path from `ADMIN_BASE_PATH` when set).
- **`/admin/login`:** Redirects to the admin base (e.g. `/admin`). No separate login page; login is inline on the main admin page.
- **Optional obscure path:** When `ADMIN_BASE_PATH` is set in env, middleware rewrites that path to the admin panel. Use `getAdminBase()` from `@/lib/admin` for client redirects so the obscure path works. If `ADMIN_DISABLE_DIRECT_ACCESS=true`, direct `/admin` can 404.
- **Layout:** `src/app/admin/layout.tsx` wraps all admin content. It sets `dynamic = 'force-dynamic'`, injects a hidden `<span id="admin-base" data-value={adminBase} />` for client-side base path, and renders a footer with build fingerprint (commit SHA or build timestamp). No navbar from the main app.

**Relevant files:**
- `src/app/admin/page.tsx` – main SPA (gate, login, sidebar, tabs).
- `src/app/admin/layout.tsx` – wrapper, metadata (title "Admin – Inthecircle", robots noindex), footer, `BuildVersionLog`.
- `src/app/admin/login/page.tsx` – client redirect to `getAdminBase()`.
- `src/lib/admin.ts` – `getAdminBase()` reads `#admin-base` `data-value` or falls back to `/admin`.

---

## 2. Branding & design system

The admin uses the same design tokens as the rest of the app (defined in `src/app/globals.css`). **Dark mode is the default;** light mode is applied via `prefers-color-scheme: light`.

### 2.1 CSS variables (colors)

**Dark mode (default):**

| Variable | Value | Usage |
|----------|--------|--------|
| `--bg` | `#000000` | Page background |
| `--bg-elevated` | `#0a0a0a` | Elevated areas |
| `--surface` | `rgba(255,255,255,0.10)` | Cards, sidebar, inputs |
| `--surface-hover` | `rgba(255,255,255,0.15)` | Hover states |
| `--elevated-surface` | `rgba(255,255,255,0.15)` | Raised panels |
| `--accent` | `#ffffff` | Primary accent (dark mode) |
| `--accent-alt` | `rgba(255,255,255,0.85)` | Secondary accent |
| **`--accent-purple`** | **`#6366F1`** | **Admin primary (buttons, active tab, links, focus)** |
| **`--accent-purple-alt`** | **`#8B5CF6`** | **Gradient end with accent-purple** |
| `--premium-gold` | `#F59E0B` | Premium actions (e.g. Connect) |
| `--premium-gold-light` | `#FBBF24` | |
| `--premium-gold-bright` | `#FCD34D` | |
| `--text` | `#ffffff` | Primary text |
| `--text-secondary` | `rgba(255,255,255,0.75)` | Secondary text |
| `--text-tertiary` | `rgba(255,255,255,0.72)` | Tertiary text |
| `--text-muted` | `rgba(255,255,255,0.65)` | Muted labels, hints |
| `--border` | `rgba(255,255,255,0.20)` | Borders |
| `--border-strong` | `rgba(255,255,255,0.25)` | Strong borders |
| `--separator` | `rgba(255,255,255,0.20)` | Dividers, card borders |
| `--input-bg` | `rgba(255,255,255,0.12)` | Input background |
| `--success` | `#4ADE80` | Success toasts, states |
| `--error` | `#FF6B6B` | Errors, destructive, badges |
| `--warning` | `#FFB84D` | Warnings |
| `--destructive` | `#FF6B6B` | Destructive actions |
| `--verified` | `#3b82f6` | Verified badge |
| `--online` | `#4ADE80` | Online indicator |
| `--button-text-on-accent` | `#000000` | Text on accent buttons (dark) |

**Gradients:**
- `--gradient-start`: `#6366F1`
- `--gradient-end`: `#8B5CF6`
- Purple gradient: `linear-gradient(135deg, var(--accent-purple), var(--accent-purple-alt))`

**Light mode** (from `prefers-color-scheme: light`): `--bg` → white, `--surface`/hover use black alpha, `--text`/secondary/muted use black alpha, `--button-text-on-accent` → white, shadows softened.

### 2.2 Spacing & radii

| Variable | Value |
|----------|--------|
| `--space-xs` | 8px |
| `--space-sm` | 12px |
| `--space-md` | 16px |
| `--space-lg` | 24px |
| `--space-xl` | 32px |
| `--space-xxl` | 48px |
| `--radius-sm` | 12px |
| `--radius-md` | 18px |
| `--radius-lg` | 26px |

Admin UI uses Tailwind classes like `rounded-xl` (12px), `rounded-2xl` (16px) for cards and buttons.

### 2.3 Shadows

| Variable | Purpose |
|----------|--------|
| `--shadow` | General shadow |
| `--shadow-soft` | Soft elevation |
| `--shadow-card` | Cards, modals |
| `--shadow-card-hover` | Card hover |
| `--shadow-button` | Buttons (includes purple tint) |
| `--shadow-glow-purple` | Purple glow |

### 2.4 Motion

| Variable | Value |
|----------|--------|
| `--motion-duration-fast` | 150ms |
| `--motion-duration-normal` | 280ms |
| `--motion-duration-slow` | 400ms |
| `--ease-smooth` | cubic-bezier(0.33, 1, 0.68, 1) |
| `--ease-spring` | cubic-bezier(0.34, 1.56, 0.64, 1) |
| `--ease-out` | cubic-bezier(0, 0, 0.2, 1) |

Reduced motion: durations set to 0.01ms when `prefers-reduced-motion: reduce`.

### 2.5 Typography

- **Font:** `var(--font-sans)` = Plus Jakarta Sans (from `next/font/google`), fallback: `-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif`.
- **Body:** 16px, line-height 1.5, antialiased.
- **Admin labels:** Often `text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider`.
- **Headings:** `text-2xl font-bold tracking-tight text-[var(--text)]` for page titles; `text-lg font-semibold` for section titles.

### 2.6 Utility classes used in admin

- **Buttons:** `btn-gradient` (primary purple gradient), `btn-primary`, `btn-secondary`, `btn-gold`.
- **Inputs:** `input-field` (border, radius 12px, focus ring with `--accent-purple`).
- **Cards:** `card-premium` (glass), or manual `bg-[var(--surface)] border border-[var(--separator)] rounded-2xl shadow-[var(--shadow-card)]`.
- **Transitions:** `transition-smooth` (transform, opacity, background, border, box-shadow with fast duration and ease-smooth).
- **Focus:** `outline: 2px solid var(--accent-purple); outline-offset: 2px` (globals.css for focus-visible).

### 2.7 Admin-specific patterns

- **Active nav item:** `bg-[var(--accent-purple)]/15 text-[var(--text)] border border-[var(--accent-purple)]/30`.
- **Inactive nav:** `text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]`.
- **Badge (pending count):** `bg-[var(--error)] text-white` with `rounded-full`, small font.
- **Spinner:** `border-2 border-[var(--accent-purple)] border-t-transparent rounded-full animate-spin`.
- **Error alert:** `bg-[var(--error)]/10 border border-[var(--error)]/30 text-[var(--error)]`.
- **Success toast:** `bg-[var(--success)]/15 border-[var(--success)]/40 text-[var(--success)]`.

---

## 3. Layout structure

### 3.1 Shell (when authorized)

- **Wrapper:** `min-h-screen bg-[var(--bg)] text-[var(--text)] flex`.
- **Optional banner:** If “wrong deployment” is detected, a fixed top bar: `bg-red-600 text-white` with a short message.
- **Sidebar overlay (mobile):** When sidebar is open on small screens, a `fixed inset-0 z-40 bg-black/50` button to close it.

### 3.2 Left sidebar (fixed on desktop, drawer on mobile)

- **Width:** `w-64` (256px). **Position:** `fixed md:sticky`, `z-50`, full height. On mobile: `-translate-x-full` when closed, `translate-x-0` when open.
- **Background:** `bg-[var(--surface)] border-r border-[var(--separator)]`.
- **Header block:** Logo + “Admin” label, close button (mobile only). Logo from `@/components/Logo` with `size="sm"`.
- **Nav:** List of tab buttons. Each: icon (left), label, optional badge. Active: purple tint + border. Buttons: `rounded-xl`, `py-2.5`, `px-3`, `gap-3`.
- **Footer block (sidebar):**
  - **Governance Health:** Small card `rounded-xl bg-[var(--surface-hover)]/50 border border-[var(--separator)]` with score 0–100 (or “—”).
  - **Log out:** Button with sign-out icon, calls Supabase signOut then `router.push(getAdminBase())`.
  - **Back to app:** Button to `router.push('/')`.

### 3.3 Main content area

- **Header (sticky):**
  - Mobile: Hamburger to open sidebar.
  - Breadcrumb: “Admin” / active tab name (capitalized).
  - “Updated {time ago}” (optional, hidden on small screens).
  - Refresh button (reloads data).
- **Error strip:** When `error` state is set: full-width alert with message, “Retry” (clear error + loadData) and “Dismiss”.
- **Toast:** Fixed bottom-right, success or error style, single message.
- **Main:** `flex-1 overflow-auto p-4 md:p-6 max-w-6xl w-full mx-auto`. Renders the active tab component.

### 3.4 Loading & gate states

- **Gate not yet checked:** Full-screen spinner + “Loading…”.
- **Loading (after gate, before auth check):** Full-screen spinner + “Loading admin panel…”.
- **Gate locked:** Gate password form (see Section 6).
- **Not authorized:** Inline login form (see Section 6).

---

## 4. Tabs (navigation & content)

Tabs are permission-filtered: only tabs the user is allowed to see appear in the sidebar. Permission map below.

### 4.1 Tab list (order and permission)

| Tab ID | Label | Permission (RBAC) | Badge source |
|--------|--------|--------------------|--------------|
| `overview` | Overview | `read_applications` | — |
| `dashboard` | Dashboard | `read_applications` | — |
| `applications` | Applications | `read_applications` | `stats.pending` |
| `users` | Users | `read_users` | — |
| `verifications` | Verifications | `read_applications` | `pendingVerifications.length` |
| `inbox` | Inbox | `read_reports` | Sum of `conversations[].unreadCount` |
| `reports` | Reports | `read_reports` | Reports with status `pending` |
| `data-requests` | Data Requests | `read_data_requests` | Data requests with status `pending` |
| `risk` | Risk | `read_risk` | Count of open escalations with `threshold_level === 'red'` |
| `approvals` | Approvals | `approve_approval` | `approvalsPending.length` |
| `audit` | Audit Log | `read_audit` | — |
| `compliance` | Compliance | `read_audit` | — |
| `analytics` | Product Analytics | Always shown (no permission gate) | — |
| `settings` | Settings | `read_config` | — |

**Note:** Analytics tab is always visible; other tabs require the listed permission via `hasPermission(adminRoles, TAB_PERMISSION[id])`.

### 4.2 Tab components and props (summary)

- **OverviewTab:** Total users, new users (24h, 7d, 30d), growth rate, active today, active sessions, threads/messages stats, verified count, verification rate, application stats, approval rate, applications last 7d, signups/cumulative by week, locations by country, cities list, top niches, snapshot date, users list, applications list.
- **DashboardTab:** stats, totalUsers, verifiedUsersCount, newUsers (this week, 24h, 30d), activeUsersToday, pendingVerifications count, recentActivity, bannedUsersCount, threads/messages, approval/rejection/verification rates, topNiches, signupsByDay, maxSignupsInWeek, appsSubmittedThisWeek, avgMessagesPerThread, engagementFromExactCounts, locationsByCountry, citiesList, locationSetPct, usersWithLocationSet, topNichesByUser, nicheSetPct, topReferrers, setActiveTab, onRefreshData.
- **ApplicationsTab:** applications, allApplications, stats, filter, setFilter, getFilterCount, applicationsMigration, onStatusFilterChange, appSearch, setAppSearch, appSort, appAssignmentFilter, onSortFilterChange, applicationsTotal, applicationsPage, applicationsPageSize, onApplicationsPageChange, applicationsLoading, applicationsCountsError, currentUserId, onClaim, onRelease, selectedAppIds, setSelectedAppIds, onApprove, onReject, onWaitlist, onSuspend, onBulkAction, onExportCsv, actionLoading, selectedApp, setSelectedApp.
- **UsersTab:** users, usersTotalCount, usersPage, usersPageSize, onUsersPageChange, onToggleVerify, onToggleBan, onDelete, canDeleteUser, canAnonymizeUser, onExportUser, onAnonymizeUser, actionLoading, selectedUser, setSelectedUser.
- **VerificationsTab:** pendingVerifications, onApprove, onReject, actionLoading.
- **InboxTab:** conversations, loading, onRefresh, selectedConversation, setSelectedConversation, currentUserId, senderProfiles.
- **ReportsTab:** reports, loading, currentUserId, onRefresh, onClaim, onRelease, onResolve.
- **DataRequestsTab:** requests, loading, onRefresh, onStatusChange.
- **RiskTab:** data (riskData), loading, onRefresh, onResolve, canResolve, onNavigateToTab.
- **ApprovalsTab:** requests (approvalsPending), loading, onRefresh, onApprove, onReject, canApprove.
- **AuditLogTab:** entries, loading, onRefresh, onExportCsv, onVerifyChain, verifyResult, verifyLoading, onCreateSnapshot, snapshotLoading.
- **ComplianceTab:** controls, evidence, reviews, health, loading, generatingCode, onRefresh, onRunHealthCheck, onRepairChain, onGenerateEvidence, onAddReview, canExportAudit.
- **Product Analytics:** Rendered as `<AdminProductAnalyticsTab />` (no props from page).
- **SettingsTab:** appConfig, loading, onRefresh, onSaveConfig, sessions, sessionsLoading, onRevokeSession, adminUsers, adminUsersLoading, onAssignRole, onRemoveRole, currentUserId.

---

## 5. Components

### 5.1 Shared admin components

- **ConfirmModal** (`src/app/admin/components/ConfirmModal.tsx`): Accessible modal. Props: `open`, `title`, `description`, `requiredInput?: { placeholder, minLength, label? }`, `confirmLabel`, `cancelLabel`, `variant?: 'danger' | 'primary'`, `onConfirm`, `onCancel`. Supports required text input for destructive actions.
- **StatCard** (`src/app/admin/components/StatCard.tsx`): Card with icon (in colored circle), big number, title, trend line. Props: `title`, `value` (number or string), `icon` (emoji or element), `color` (CSS color), `trend` (string).
- **Avatar** (`src/app/admin/components/Avatar.tsx`): User avatar image or placeholder.
- **AdminSkeletonTable** (`src/app/admin/components/AdminSkeletonTable.tsx`): Table-shaped skeleton with `rounded-xl border border-[var(--separator)] bg-[var(--surface)]` and pulse placeholders.
- **AdminErrorBoundary** (`src/app/admin/AdminErrorBoundary.tsx`): Class component catching render errors; shows “Something went wrong” + optional message + Retry button. Uses `--bg`, `--surface`, `--border`, `--text`, `--text-muted`.
- **BuildVersionLog** (`src/app/admin/BuildVersionLog.tsx`): Logs `version` to console in development only; renders nothing.
- **Logo** (`src/components/Logo.tsx`): Used in layout and gate/login. Sizes: `sm`, `lg`.

### 5.2 Icons in sidebar

All are inline SVG components (no external icon lib): NavIconChart, NavIconLayout, NavIconUser, NavIconUsers, NavIconCheck, NavIconMessage, NavIconSettings, NavIconReport, NavIconAudit, NavIconCompliance, NavIconData, NavIconApproval, NavIconRisk, NavIconAnalytics. Stroke-based, `w-5 h-5`, `stroke="currentColor"`.

---

## 6. Gate & login flows

### 6.1 Gate (optional)

When `ADMIN_GATE_PASSWORD` is set:

1. On load, `fetch('/api/admin/gate', { method: 'POST', body: JSON.stringify({ password }) })` with password from sessionStorage key (e.g. `admin_gate`). If 200 and `{ ok: true }`, set `gateUnlocked = true` and store in sessionStorage.
2. If gate not yet passed, show **gate screen:** full-screen centered card with Logo, “Admin access” heading, short copy, single password field (`input-field`), “Continue” (`btn-gradient`), “Back to app” link. On submit, POST to gate API; on success set unlocked and proceed; on failure show `gateError`.
3. States: `gateUnlocked === null` (loading), `false` (show form), `true` (proceed to auth).

### 6.2 Auth (admin sign-in)

1. After gate (or if no gate), call `/api/admin/check` (or equivalent) to see if session is already admin. If authorized, set `authorized = true` and load identity/roles.
2. If not authorized, show **inline login** on the same page (no redirect): “Inthecircle Admin” title, “Sign in with an admin account to continue.”, card with email + password inputs (labels: “Email”, “Password”), show/hide password toggle, submit “Sign in” (`btn-gradient`). Submit to `POST /api/admin/sign-in` with `{ email, password }`. On success set authorized and load data; on failure show `loginError` in `bg-[var(--error)]/10 border border-[var(--error)]/30`.
3. Email validated client-side (basic email regex). Password required.

---

## 7. Types (`src/app/admin/types.ts`)

```ts
// Stats (application counts)
interface Stats {
  total: number
  pending: number
  approved: number
  rejected: number
  waitlisted: number
  suspended: number
}

interface Application {
  id: string
  user_id: string
  name: string
  username: string
  email: string
  profile_image_url: string | null
  bio: string
  niche: string
  application_date: string
  status: string
  review_notes: string | null
  referrer_username: string | null
  why_join: string | null
  what_to_offer: string | null
  collaboration_goals: string | null
  phone: string | null
  instagram_username: string | null
  follower_count: number | null
  updated_at?: string
  assigned_to?: string | null
  assigned_at?: string | null
  assignment_expires_at?: string | null
}

interface User {
  id: string
  name: string | null
  username: string | null
  email: string | null
  profile_image_url: string | null
  is_verified: boolean
  is_banned: boolean
  created_at: string | null
}

interface VerificationRequest {
  id: string
  user_id: string
  username: string
  profile_image_url: string | null
  requested_at: string
}

interface RecentActivity {
  id: string
  type: string
  title: string
  subtitle: string
  timestamp: Date
  color: string
}

interface InboxMessage {
  id: string
  thread_id: string
  sender_id: string
  content: string | null
  media_url: string | null
  media_type: string | null
  seen_at: string | null
  delivered_at: string | null
  created_at: string
}

interface InboxThread {
  id: string
  user1_id: string | null
  user2_id: string | null
  created_at: string
  updated_at: string
}

interface ConversationDisplay {
  threadId: string
  otherUserId: string
  otherUserName: string
  otherUserUsername: string
  otherUserAvatar: string | null
  lastMessage: string
  lastMessageTime: Date
  unreadCount: number
  messages: InboxMessage[]
}

interface LocationByCountry {
  country: string
  countryCode: string
  flag: string
  total: number
  cities: { city: string; count: number }[]
}

type Tab =
  | 'overview' | 'dashboard' | 'applications' | 'users' | 'verifications'
  | 'inbox' | 'reports' | 'data-requests' | 'risk' | 'approvals'
  | 'audit' | 'compliance' | 'analytics' | 'settings'

type AppFilter = 'all' | 'pending' | 'approved' | 'rejected' | 'waitlisted' | 'suspended'
```

---

## 8. RBAC (`src/lib/admin-rbac.ts`)

### 8.1 Roles

- `viewer`
- `moderator`
- `supervisor`
- `compliance`
- `super_admin`

### 8.2 Permissions (partial list used by tab visibility)

- `read_applications`, `mutate_applications`, `bulk_applications`
- `read_reports`, `resolve_reports`
- `read_data_requests`, `update_data_requests`
- `read_audit`, `export_audit`
- `read_users`, `mutate_users`, `export_user`, `ban_users`, `delete_users`, `anonymize_users`, `read_blocked_users`
- `read_config`, `manage_config`
- `read_risk`, `resolve_escalations`
- `request_approval`, `approve_approval`
- `read_analytics`
- Plus: `announce`, `manage_roles`, `active_sessions`

### 8.3 Tab → permission map (for sidebar visibility)

- overview, dashboard, applications → `read_applications`
- users → `read_users`
- verifications → `read_applications`
- inbox, reports → `read_reports`
- data-requests → `read_data_requests`
- risk → `read_risk`
- approvals → `approve_approval`
- audit, compliance → `read_audit`
- analytics → always visible
- settings → `read_config`

`hasPermission(adminRoles, permission)` returns true if any of the user’s roles has that permission.

---

## 9. API routes (admin)

All under `src/app/api/admin/`. Auth/session checks are done per route.

| Route | Methods | Purpose |
|-------|--------|--------|
| `check` | GET | Check if current session is admin (used for auth state). |
| `sign-in` | POST | Admin login (email + password). |
| `gate` | POST | Optional gate password check. |
| `identity` | GET | Current admin user + roles. |
| `overview-stats` | GET | Overview stats. |
| `applications` | GET | List applications (with search/sort/filter/pagination). |
| `applications/[id]/action` | POST | Approve/reject/waitlist/suspend application. |
| `applications/[id]/claim` | POST | Claim application for review. |
| `applications/[id]/release` | POST | Release claim. |
| `bulk-applications` | POST | Bulk action on applications. |
| `users` | GET | List users (paginated). |
| `users/[id]` | GET/PATCH | Get or update user. |
| `users/[id]/verification` | POST | Toggle verification. |
| `users/[id]/ban` | POST | Ban user. |
| `delete-user` | POST | Delete user (super_admin). |
| `anonymize-user` | POST | Anonymize user (may create approval request). |
| `export-user` | GET | GDPR export single user (JSON). |
| `verification-requests` | GET | List verification requests. |
| `verification-requests/[id]/reject` | POST | Reject verification (approve may be different). |
| `verification-activity` | GET | Verification activity for dashboard. |
| `active-today` | GET | Active users today. |
| `reports` | GET/PATCH | List reports, update report status. |
| `reports/[id]/claim` | POST | Claim report. |
| `reports/[id]/release` | POST | Release report. |
| `data-requests` | GET/PATCH | List/update data requests. |
| `risk` | GET | Risk/escalations data. |
| `escalations/[id]/resolve` | POST | Resolve escalation. |
| `approvals` | GET | Pending approval requests. |
| `approvals/[id]/approve` | POST | Approve. |
| `approvals/[id]/reject` | POST | Reject. |
| `audit` | GET | Audit log (with filters). |
| `audit/verify` | GET | Verify audit chain. |
| `audit/snapshot` | POST | Create snapshot. |
| `audit/repair-chain` | POST | Repair audit chain. |
| `compliance/health` | GET | Compliance health. |
| `compliance/health/run` | POST | Run health checks. |
| `compliance/controls` | GET | Controls list. |
| `compliance/evidence` | GET | Evidence list. |
| `compliance/evidence/generate` | POST | Generate evidence. |
| `compliance/governance-reviews` | GET/POST | List or add governance reviews. |
| `config` | GET/PATCH | App config. |
| `sessions` | GET | Active admin sessions. |
| `sessions/[id]/revoke` | POST | Revoke session. |
| `admin-users` | GET | Admin users. |
| `admin-users/[id]/assign-role` | POST | Assign role. |
| `admin-users/[id]/remove-role` | POST | Remove role. |
| `roles` | GET | Available roles. |
| `blocked-users` | GET | Blocked users list. |
| `analytics/overview` | GET | Product analytics overview. |
| `announce` | POST | Announce (if used). |

---

## 10. Hooks & data loading

- **useGate:** Reads `ADMIN_GATE_PASSWORD` (via env or API), manages gate unlock state and sessionStorage.
- **useAdminAuth:** Session check, sets `authorized`, loads identity and `adminRoles` (e.g. from `/api/admin/identity`).
- **useApplications:** Applications list with filters, sort, pagination, search (calls `/api/admin/applications`).
- **useUsers:** Users list with pagination (calls `/api/admin/users`).

Data loading is centralized in the main page: one primary `loadData()` (and tab-specific loaders like `loadAuditLog`, `loadReports`, `loadDataRequests`, `loadAppConfig`, `loadRisk`, `loadApprovals`, `loadCompliance`, `loadInbox`). Refresh button and retry on error call `loadData()` or the appropriate loader.

---

## 11. Environment variables (admin-related)

- **ADMIN_BASE_PATH** – Optional path segment for “obscure” admin URL (e.g. `admin-panel` → `/admin-panel`).
- **ADMIN_DISABLE_DIRECT_ACCESS** – If `true`, direct `/admin` can 404 (obscure path only).
- **ADMIN_GATE_PASSWORD** – Optional shared password to show gate screen before login.
- **ADMIN_USER_IDS** / **ADMIN_EMAILS** – Server-side allowlist for who counts as admin (never use `NEXT_PUBLIC_` for these).

---

## 12. Metadata & SEO

- **Layout metadata:** `title: 'Admin – Inthecircle'`, `description: 'Admin panel for Inthecircle. Review applications, users, verifications, and inbox.'`, `robots: 'noindex, nofollow'`.
- **Build version:** Shown in layout footer; from `VERCEL_GIT_COMMIT_SHA` or `BUILD_TIMESTAMP` or `'unknown'`.

---

## 13. File map (current implementation)

- **Page & layout:** `src/app/admin/page.tsx`, `src/app/admin/layout.tsx`, `src/app/admin/login/page.tsx`.
- **Tabs:** `src/app/admin/tabs/OverviewTab.tsx`, `DashboardTab.tsx`, `ApplicationsTab.tsx`, `UsersTab.tsx`, `VerificationsTab.tsx`, `InboxTab.tsx`, `ReportsTab.tsx`, `DataRequestsTab.tsx`, `RiskTab.tsx`, `ApprovalsTab.tsx`, `AuditLogTab.tsx`, `ComplianceTab.tsx`, `SettingsTab.tsx`, `src/app/admin/tabs/index.ts` (re-exports). Product Analytics: `src/app/admin/ProductAnalyticsTab.tsx`.
- **Components:** `src/app/admin/components/ConfirmModal.tsx`, `StatCard.tsx`, `Avatar.tsx`, `AdminSkeletonTable.tsx`; `src/app/admin/AdminErrorBoundary.tsx`, `BuildVersionLog.tsx`.
- **Hooks:** `src/app/admin/hooks/useGate.ts`, `useAdminAuth.ts`, `useApplications.ts`, `useUsers.ts`, `src/app/admin/hooks/index.ts`.
- **Types:** `src/app/admin/types.ts`.
- **Utils:** `src/app/admin/utils.ts` (e.g. `downloadCSV`, `formatTimeAgo`).
- **Lib:** `src/lib/admin.ts` (getAdminBase), `src/lib/admin-rbac.ts` (roles/permissions).

---

## 14. Backend wiring (how each feature connects)

This section describes **how each admin feature is wired to the backend**: which APIs are called, when (on load vs on action), request/response shape, and what state is updated or refetched after actions. All `fetch` calls use `credentials: 'include'` so the session cookie is sent.

### 14.1 Auth & gate

| Step | API | When | Request | Response / next step |
|------|-----|------|--------|----------------------|
| Gate check | `GET /api/admin/gate` | On mount (once) | — | `{ data: { unlocked?: boolean } }`. If `unlocked === true`, skip gate; else show gate form. |
| Gate submit | `POST /api/admin/gate` | On gate form submit | `{ password: string }` | `{ data: { ok?: boolean } }`. On success set `gateUnlocked = true`. |
| Auth check | `GET /api/admin/check` | After gate (or if no gate), once | — | `{ data: { authorized?: boolean, roles?: string[], sessionId?: string } }`. If authorized, set `authorized = true`, `adminRoles = roles`, then call `loadData()`. |
| Login | `POST /api/admin/sign-in` | Inline login form submit | `{ email: string, password: string }` | Success: session cookie set; then same flow as auth check (e.g. redirect or set authorized and loadData). Error: `{ error: string }`. |
| Identity | `GET /api/admin/identity` | After authorized (for deployment/app identity) | — | `{ data: { app?: string, ... } }`. Used for “wrong deployment” banner. |

### 14.2 Overview tab

**Data loading:** Part of the main `loadData()` when `!options.skipOverview`.

| Source | API / backend | Query / params | Response used for |
|--------|----------------|----------------|-------------------|
| Overview stats | `GET /api/admin/overview-stats` | — | Single request returns (server-side): `stats` (application counts), `activeToday`, `activeSessions` (if permission), `overviewCounts` (totalUsers, verifiedCount, newUsersLast24h/7d/30d, totalThreadCount, totalMessageCount, applicationsSubmittedLast7d, applicationsApprovedLast7d). Backend uses RPCs: `admin_get_overview_app_stats`, `admin_get_overview_counts`, plus direct table counts. 30s cache (keyed by permission). |
| Applications (first page) | `GET /api/admin/applications` | `page=1`, `limit`, `sort`, `filter`, `status` (from appFilter), `search` | `applications`, `total`, `counts` (pending, approved, rejected, waitlisted, suspended). Backend: `admin_get_application_counts` (or fallback `admin_get_application_stats`) + list RPC or query. |
| Users (first page) | `GET /api/admin/users` | `page=1`, `limit` | `users`, `total`. Each user can include `location`, `niche` from profiles. |

Overview tab is **read-only**; no actions. Refreshing uses the header “Refresh” button which calls `loadData()`.

### 14.3 Dashboard tab

**Data loading:** When `activeTab === 'dashboard'`, `loadData(undefined, { skipOverview: true })` runs and `loadTabData('dashboard', ...)` inside loadData fetches:

| Source | API / backend | Response used for |
|--------|----------------|-------------------|
| Verification activity | `GET /api/admin/verification-activity` | `recentActivity` (title, subtitle, timestamp, color). |
| Pending verifications | `GET /api/admin/verification-requests?status=pending` | `pendingVerifications`. |
| Engagement counts | Supabase client: `message_threads` count, `messages` count | `totalThreadCount`, `totalMessageCount`. |
| Reports + data requests | `GET /api/admin/reports` + `GET /api/admin/data-requests` (in parallel) | `reports`, `dataRequests` (for dashboard context). |

Dashboard also uses state already set by overview (e.g. `stats`, `overviewCounts`, `activeUsersToday`, `activeSessions`). No dedicated dashboard API; it aggregates overview + verification activity + reports/data-requests.

### 14.4 Applications tab

**Data loading:**

- **Initial / Overview:** When overview is loaded, applications for page 1 are fetched with current `sort`, `filter`, `status` (appFilter), `search`.
- **Applications tab only:** When `activeTab === 'applications'`, `loadData(undefined, { skipOverview: true, applicationsPage })` runs; inside loadData, `fetchApplications(sort, filter, applicationsPage, APPLICATIONS_PAGE_SIZE, statusFilter, appSearch)` calls:
  - **API:** `GET /api/admin/applications?page=&limit=&sort=&filter=&status=&search=`
  - **Query params:** `sort` (e.g. `overdue`), `filter` (assignment filter), `status` (all | pending | approved | rejected | waitlisted | suspended), `search` (server-side search by email/name/username).
  - **Response:** `{ applications, total, counts?, migrationRequired?, migrationError?, migrationSql? }`. On 503 + migration fields, UI shows migration CTA. On 403, `handle403()`.

**Actions:**

| Action | API | Request | Then |
|--------|-----|--------|------|
| Approve | `POST /api/admin/applications/[id]/action` | `{ action: 'approve', updated_at?: string }` | On success: `loadData()`, welcome email triggered server-side. On 409: “Record changed by another moderator”. |
| Reject | Same | `{ action: 'reject', updated_at? }` | `loadData()`. |
| Waitlist | Same | `{ action: 'waitlist', updated_at? }` | `loadData()`. |
| Suspend | Same | `{ action: 'suspend', updated_at? }` | `loadData()`. |
| Claim | `POST /api/admin/applications/[id]/claim` | — | On success: `loadData()`. On 409: “Already claimed”. |
| Release | `POST /api/admin/applications/[id]/release` | — | On success: `loadData()`. |
| Bulk reject/suspend | `POST /api/admin/bulk-applications` | `{ application_ids: string[], action: 'reject' | 'suspend', reason: string }` | On success: `loadApprovals()` (if approval created) and/or `loadData()`. |

Backend: `applications/[id]/action` uses RPC `admin_application_action_v2` with `p_application_id`, `p_updated_at`, `p_action` for conflict-safe update; on approve, `triggerWelcomeEmailForApplication` is called and application cache is cleared.

### 14.5 Users tab

**Data loading:**

- **When `activeTab === 'users'`:** Effect runs `loadUsers(usersPage)`.
  - **API:** `GET /api/admin/users?page=&limit=`
  - **Response:** `{ users, total }`. Users include profile fields (e.g. location, niche) where the API returns them.

**Actions:**

| Action | API | Request | Then |
|--------|-----|--------|------|
| Toggle verification | `POST /api/admin/users/[id]/verification` | `{ is_verified: true }` or `{ is_verified: false }` | `loadData()`. |
| Toggle ban | `POST /api/admin/users/[id]/ban` | (body per API) | `loadData()`. |
| Delete user | `POST /api/admin/delete-user` | `{ user_id: string }` (and possibly reason) | On success: `loadApprovals()` if approval created, `loadData()`. |
| Export user | `GET /api/admin/export-user?user_id=` | — | Blob download; filename `user-export-{id}.json`. |
| Anonymize user | `POST /api/admin/anonymize-user` | `{ user_id: string, reason: string }` | On 202 + approval_required: show toast, loadApprovals; else on success: `loadData()`, toast. On 429: rate limit message. |

### 14.6 Verifications tab

**Data loading:** Pending list comes from `loadData()` when dashboard/overview is loaded: `GET /api/admin/verification-requests?status=pending` → `pendingVerifications`.

**Actions:**

| Action | API | Request | Then |
|--------|-----|--------|------|
| Approve | `POST /api/admin/users/[userId]/verification` | `{ is_verified: true }` | `loadData()`, audit log. |
| Reject | `POST /api/admin/verification-requests/[requestId]/reject` | — | Uses `pendingVerifications.find(p => p.user_id === userId).id` as requestId. Then `loadData()`, toast, audit. |

So “approve” is implemented as setting the user’s verification flag; “reject” uses the verification-request-specific endpoint.

### 14.7 Inbox tab

**Data loading:** No REST API for inbox. When `activeTab === 'inbox'` and `currentUserId` is set, `loadInbox()` runs:

1. **Supabase client** (service or admin-authed): `from('message_threads').select('*').order('updated_at', { ascending: false }).limit(100)`.
2. Then `from('messages').select('*').in('thread_id', threadIds).order('created_at', { ascending: false })`.
3. Then `from('profiles').select('id, username, name, profile_image_url').in('id', allUserIds)`.

Frontend builds `ConversationDisplay[]` (threadId, otherUserId, names, lastMessage, lastMessageTime, unreadCount, messages) and `senderProfiles`. **Real-time:** Supabase Realtime subscriptions on `messages` and `message_threads` trigger `loadInbox()` on change.

**Actions:** None from this tab (read-only admin view of all conversations).

### 14.8 Reports tab

**Data loading:** When `activeTab === 'reports'`, effect runs `loadReports(opts)`.

- **API:** `GET /api/admin/reports?sort=&filter=&status=` (query params optional).
- **Response:** `reports` array stored in state.

**Actions:**

| Action | API | Request | Then |
|--------|-----|--------|------|
| Claim | `POST /api/admin/reports/[id]/claim` | — | On success: `loadReports()`. On 409: “Already claimed”. |
| Release | `POST /api/admin/reports/[id]/release` | — | On success: `loadReports()`. |
| Resolve | `PATCH /api/admin/reports` | `{ report_id, status: 'resolved' | 'dismissed', notes?, updated_at? }` | On success: `loadReports()`. On 409: “Record changed by another moderator”. |

### 14.9 Data requests tab

**Data loading:** When `activeTab === 'data-requests'`, `loadDataRequests()` runs.

- **API:** `GET /api/admin/data-requests`
- **Response:** `{ data: { requests? } }` → stored as `dataRequests`.

**Actions:**

| Action | API | Request | Then |
|--------|-----|--------|------|
| Update status | `PATCH /api/admin/data-requests` | `{ request_id, status, updated_at? }` | On success: `loadDataRequests()`. On 409: “Record changed by another user”. |

### 14.10 Risk tab

**Data loading:** When `activeTab === 'risk'`, `loadRisk()` runs.

- **API:** `GET /api/admin/risk`
- **Response:** `data` stored as `riskData` (e.g. open_escalations, threshold_level).

**Actions:**

| Action | API | Request | Then |
|--------|-----|--------|------|
| Resolve escalation | `POST /api/admin/escalations/[id]/resolve` | `{ notes?: string }` | On success: `loadRisk()`, toast “Escalation resolved”. |

`canResolve` is true for roles supervisor, compliance, super_admin.

### 14.11 Approvals tab

**Data loading:** When `activeTab === 'approvals'`, `loadApprovals()` runs.

- **API:** `GET /api/admin/approvals?status=pending`
- **Response:** `{ data: { requests? } }` → `approvalsPending`.

**Actions:**

| Action | API | Request | Then |
|--------|-----|--------|------|
| Approve | `POST /api/admin/approvals/[id]/approve` | — | On success: `loadApprovals()`, `loadData()`, toast. On 409: toast “Another approver acted first”, then `loadApprovals()`. |
| Reject | `POST /api/admin/approvals/[id]/reject` | — | On success: `loadApprovals()`, toast. On 409: same as above. |

`canApprove` is true for supervisor, super_admin.

### 14.12 Audit log tab

**Data loading:** When `activeTab === 'audit'`, `loadAuditLog(filters)` runs.

- **API:** `GET /api/admin/audit?from_ts=&to_ts=&action=&actor_id=&limit=` (query params from filters).
- **Response:** `entries` stored as `auditLog`.

**Actions:**

| Action | API | Request | Then |
|--------|-----|--------|------|
| Export CSV | Client-side | — | Build CSV from `auditLog` and download (no extra API). |
| Verify chain | `GET /api/admin/audit/verify` | — | Response stored as `auditVerifyResult` (UI shows result). On 403: `handle403()`. |
| Create snapshot | `POST /api/admin/audit/snapshot` | — | On success: toast with snapshot_date; on 403: permission toast. |

### 14.13 Compliance tab

**Data loading:** When `activeTab === 'compliance'`, `loadCompliance()` runs. Four requests in parallel:

- `GET /api/admin/compliance/controls` → `complianceControls`
- `GET /api/admin/compliance/evidence` → `complianceEvidence`
- `GET /api/admin/compliance/governance-reviews` → `complianceReviews`
- `GET /api/admin/compliance/health` → `complianceHealth` (also used for sidebar “Governance Health” score)

**Actions:**

| Action | API | Request | Then |
|--------|-----|--------|------|
| Run health check | `POST /api/admin/compliance/health/run` | — | On success: `loadCompliance()`, toast. |
| Repair chain | `POST /api/admin/audit/repair-chain` | — | On success: toast with rows_updated, `loadCompliance()`. |
| Generate evidence | `POST /api/admin/compliance/evidence/generate` | `{ control_code: string }` | On success: `loadCompliance()`, toast. |
| Add governance review | `POST /api/admin/compliance/governance-reviews` | `{ review_period: string, summary?: string }` | On success: `loadCompliance()`, toast. |

Export audit (if `canExportAudit`) is typically a separate export flow (e.g. export audit CSV from audit tab or compliance context).

### 14.14 Product Analytics tab

**Data loading:** The tab itself fetches on mount (no props from page).

- **API:** `GET /api/admin/analytics/overview?days=30`
- **Response:** JSON with overview (dau, wau, mau, stickiness, etc.), dauWauMau, featureUsage, adminProductivity, adminTabUsage, funnelApp, funnelAdmin, dailyAggregates, insights. Stored in local state and rendered in the tab.

No actions; read-only analytics.

### 14.15 Settings tab

**Data loading:**

- **Config:** When `activeTab === 'settings'`, `loadAppConfig()` runs: `GET /api/admin/config` → `appConfig` (key-value map).
- **Blocked users:** `loadBlockedUsers()`: `GET /api/admin/blocked-users` → `blockedUsers`. Called when Settings tab needs it (e.g. when opening blocked section).
- **Sessions:** Inside SettingsTab, `loadAdminSessions()`: `GET /api/admin/sessions` → `adminSessions`. Only if user has permission (e.g. active_sessions).
- **Admin users & roles:** Inside SettingsTab (super_admin only), `loadAdminUsersAndRoles()`: in parallel `GET /api/admin/admin-users` and `GET /api/admin/roles` → `adminUsers`, `rolesList`.

**Actions:**

| Action | API | Request | Then |
|--------|-----|--------|------|
| Save config | `PATCH /api/admin/config` | `updates: Record<string, string>` | On success: `loadAppConfig()`, setAppConfig(prev => ({ ...prev, ...updates })), toast. |
| Revoke session | `POST /api/admin/sessions/[id]/revoke` | — | On success: refresh sessions list (callback from tab). |
| Assign role | `POST /api/admin/admin-users/[id]/assign-role` | (role body per API) | On success: refresh admin users (tab state). |
| Remove role | `POST /api/admin/admin-users/[id]/remove-role` | (body per API) | Same. |
| Announce | `POST /api/admin/announce` | `{ title, body, segment }` | On success: set announce success message, toast. |

### 14.16 Real-time (Supabase Realtime)

When `authorized === true`, the page subscribes to Postgres changes (via Supabase client):

- **applications** → on any change: `loadData()`.
- **profiles** → on any change: `loadData()`.
- **verification_requests** → on any change: `loadData()`.
- **messages** → on any change: `loadInbox()`.
- **message_threads** → on any change: `loadInbox()`.

So applications, profiles, verifications, and inbox stay updated without manual refresh. Other tabs (reports, data-requests, risk, approvals, audit, compliance, settings) are refetched only when the user switches to that tab or clicks Refresh.

### 14.17 Governance health (sidebar)

The “Governance Health” score (0–100) comes from the same compliance health API: when `loadCompliance()` runs (compliance tab), or when a dedicated effect runs `GET /api/admin/compliance/health`, the response includes a score that is stored and displayed in the sidebar. So it’s either loaded with compliance tab or via a separate periodic/dedicated fetch depending on implementation.

---

Use this spec to rebuild the admin panel with the same structure, branding (including purple accent and design tokens), tabs, permissions, API surface, and backend wiring as above.
