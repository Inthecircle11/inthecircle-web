# Inthecircle Web – UI/UX Audit

**Date:** February 2025  
**Scope:** Main app (app.inthecircle.co), Admin panel (/admin), auth flows, core pages and components.

---

## 1. Executive summary

The app has a **solid design system** (tokens, dark/light, motion, focus) and **consistent layout** (max-width, main landmarks, bottom nav on mobile). **Accessibility** is partially addressed (focus, reduced motion, some ARIA) but **skip link, viewport zoom, and form label association** need improvement. **Key flows** (landing, login, signup, feed) are clear; **Settings** and **destructive actions** rely on `confirm()`/`alert()`. **Admin** is well structured with a left sidebar and clear metrics.

**Overall:** Good foundation; improvements recommended in accessibility, form semantics, and a few UX details.

---

## 2. Design system & consistency

### Strengths
- **CSS variables** in `globals.css`: `--bg`, `--surface`, `--accent-purple`, `--text`, spacing, radii, motion. Used across the app.
- **Light/dark:** `prefers-color-scheme: light` overrides; surfaces and text adapt.
- **Reduced motion:** `prefers-reduced-motion: reduce` shortens durations; `scroll-behavior: auto` when reduced.
- **Touch:** `touch-action: manipulation`, `-webkit-tap-highlight-color: transparent` for better mobile taps.
- **Safe area:** `.safe-area-bottom` and tab bar account for notches.
- **Shared components:** Buttons (`.btn-gradient`, `.btn-secondary`), inputs (`.input-field`), cards (`.card-premium`, `.card-interactive`), segmented control.
- **Layout:** Most app pages use `max-w-lg md:max-w-2xl lg:max-w-4xl mx-auto` and `pb-24 md:pb-6` for bottom nav clearance.

### Gaps
- **Page title size:** Mix of `text-[17px]`, `text-[18px]`, and `text-[28px]` for “page title” (e.g. Connect 17px, Feed “Community” 18px, Explore 28px). Recommend one scale (e.g. 18px or 20px) for in-app page titles.
- **Heading hierarchy:** Signup uses multiple `<h1>` (one per step). Prefer a single `<h1>` per route and use `<h2>` for step titles.
- **Error color:** Some pages use raw `red-500` (e.g. Settings, Feed) instead of `var(--error)`.

---

## 3. Accessibility

### Strengths
- **Focus:** `:focus-visible` with 2px purple outline and offset.
- **Landmarks:** `<main>` used on all main content; `<nav>` in Navigation with `aria-current="page"` on active item.
- **Links/buttons:** Nav items have `aria-label`; some icon buttons have `aria-label` (e.g. Refresh, password visibility).
- **Decorative elements:** Some use `aria-hidden` (e.g. logo decorative span, nav indicator).

### Critical / high priority
1. **Skip to main content:** No skip link. Keyboard and screen-reader users must tab through header/nav every time.  
   **Recommendation:** Add a “Skip to main content” link that’s focusable and jumps to `#main-content` (and add that id to the main wrapper or first `<main>`).

2. **Viewport zoom:** `maximumScale=1, userScalable=false` in layout viewport. This can block zoom and conflicts with WCAG (zoom to 200%).  
   **Recommendation:** Allow zoom, e.g. remove `maximumScale` and `userScalable: false`, or set `maximumScale: 5`.

3. **Form labels:** Login and signup use `<label>` without `htmlFor` and inputs without matching `id`. Admin login, forgot-password, update-password, and MFA use `htmlFor` + `id` correctly.  
   **Recommendation:** Add `id` to every form control and `htmlFor` on the corresponding `<label>` on login and signup (and any other form missing it).

### Medium priority
4. **Header landmark:** App header (logo + nav) has no `role="banner"`.  
   **Recommendation:** Add `role="banner"` to the desktop header (or wrap in `<header>` with that role if needed for clarity).

5. **Loading and errors:** Initial loading is a spinner with no `aria-live` or `role="status"`. Error messages in forms are not always associated with the field.  
   **Recommendation:** Add `role="status"` and `aria-live="polite"` to the global loading spinner; where possible use `aria-describedby` or `aria-errormessage` for field-level errors.

6. **Modal focus:** Create intent and other modals: focus trap and return focus on close not verified in this audit.  
   **Recommendation:** Ensure focus moves into the modal on open and returns to the trigger on close; consider `aria-modal="true"` and `role="dialog"`.

---

## 4. Key user flows

### Landing (/)
- Clear hero (logo, headline, CTA). “Create Account” and “Sign In” are obvious.
- Logged-in users redirect to feed; loading state is a spinner only (no “Redirecting…” text).
- **Recommendation:** Optional short “Taking you to your feed…” for logged-in users.

### Login (/login)
- Single form, segment to Sign In/Sign Up. Labels present but not associated (see §3).
- Error shown inline; submit button has loading state.
- **Recommendation:** Add `htmlFor`/`id`; consider “Forgot password?” link if not already visible.

### Signup (/signup)
- Multi-step (basic → profile → socials → complete). Progress bar and step titles.
- Multiple `<h1>` (see §2). Step changes may not announce to screen readers.
- **Recommendation:** One `<h1>` for the page, `<h2>` for step; optional `aria-live` for step changes.

### Feed (/feed)
- Header with “Community”, filters, refresh. Empty state with logo and “Share Your Intent” CTA.
- Error banner when load fails. Cards are tappable and visually consistent.
- **Recommendation:** Ensure filter pills have clear selected state and are keyboard operable.

### Profile & settings
- Profile: avatar, stats, tabs (Posts/About), edit and sign out.
- Settings: sections, toggles, links. Delete account uses `confirm()` twice and `alert()`.  
- **Recommendation:** Replace delete-account flow with a dedicated modal or page: confirm with “DELETE” input, then show success/error in-app instead of `alert()`.

---

## 5. Admin panel (/admin)

### Strengths
- Left sidebar with nav (Dashboard, Applications, Users, Verifications, Inbox, Settings), badges, “Back to app” and “Log out”.
- Dashboard: KPIs, secondary metrics, 7-day signups, funnel, top niches, demographics/locations, engagement, data-accuracy note.
- Top bar: current section title, last updated, refresh. Mobile: hamburger opens sidebar overlay.
- Gate and “Admin Access Required” screens are clear; admin login is separate from main app.

### Gaps
- Tables/lists (e.g. Applications, Users): no explicit `role="grid"` or column headers for screen readers; could add scope for sortable columns later.
- Dense metrics: ensure text and contrast meet WCAG where small type is used.

---

## 6. Responsiveness & layout

### Strengths
- Mobile: bottom tab bar (64px + safe area), main content `pb-24` to avoid overlap.
- Desktop: top header with horizontal nav; content centered with max-width.
- Admin sidebar: fixed on desktop, overlay on mobile with close overlay and button.
- Breakpoints used consistently (e.g. `md:` for desktop nav and padding).

### Gaps
- Some tables (admin Applications/Users) may horizontal scroll on small screens; consider sticky first column or card layout for very narrow widths if needed.

---

## 7. Loading, errors & empty states

### Strengths
- Feed: skeleton while loading; empty state with CTA.
- Auth: loading spinner; form errors shown inline.
- ErrorBoundary: simple message + “Refresh page” button.
- Admin: loading and “Loading…” text for gate and data.

### Gaps
- No global “toast” or non-blocking success feedback (e.g. after saving profile); some flows use `alert()`.
- A few pages may show blank content until data loads; ensure at least a spinner or skeleton where appropriate.

---

## 8. Content & copy

- **Landing:** “The #1 networking app for creators” is clear.
- **Empty feed:** “Welcome to the circle” and filter-specific empty copy are good.
- **Admin:** “Data accuracy” note explains metrics and timezone; section titles are clear.
- **Recommendation:** Centralise any legal/critical copy (e.g. delete account, data use) and keep tone consistent.

---

## 9. Performance & technical UX

- **Dynamic imports:** CreateIntentModal, CommentsModal, MFAChallenge, MFAEnroll loaded dynamically to reduce initial bundle.
- **Images:** Next.js Image and OptimizedAvatar; logo has `priority` on landing.
- **Real-time:** Supabase channels used on feed/profile and admin; good for live updates.

---

## 10. Recommendations summary

| Priority | Item | Action |
|----------|------|--------|
| High | Skip link | Add “Skip to main content” and `id="main-content"` on main. |
| High | Viewport zoom | Allow zoom (remove or relax `maximumScale` / `userScalable: false`). |
| High | Form labels | Add `id` + `htmlFor` on login and signup (and any other forms missing it). |
| Medium | Page title size | Standardise in-app page title size (e.g. 18px). |
| Medium | Heading hierarchy | One `<h1>` per page; use `<h2>` for steps/sections. |
| Medium | Delete account | Replace `confirm()`/`alert()` with modal or page and in-app feedback. |
| Medium | Error color | Use `var(--error)` instead of raw red where applicable. |
| Low | Header landmark | Add `role="banner"` to app header. |
| Low | Loading announcement | Add `role="status"` / `aria-live` to global loading. |
| Low | Modal focus | Ensure modals trap focus and restore it on close; add `aria-modal`/`role="dialog"` where appropriate. |

---

## 11. Conclusion

The inthecircle web app has a **strong base**: design tokens, dark/light, motion, touch, and layout are in good shape. The **admin** dashboard is clear and information-dense with a professional layout.

The main improvements are **accessibility** (skip link, zoom, form labels, and a few ARIA/landmark tweaks) and **UX polish** (consistent page titles, one h1 per page, and replacing `confirm()`/`alert()` for critical flows like delete account). Addressing the high-priority items will improve both compliance and usability without large redesigns.
