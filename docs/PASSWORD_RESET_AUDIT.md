# Password reset – end-to-end audit and fix

## Intended flow (step by step)

1. **User requests reset**  
   User is on **app.inthecircle.co/forgot-password** (optionally with `?email=user@example.com` so the field is pre-filled). They click **“Send reset link”**.

2. **App calls Supabase**  
   The app calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: 'https://app.inthecircle.co/auth/callback?next=/update-password' })`.  
   Supabase sends the **password reset email**. The link inside that email must point to **app.inthecircle.co**, not the marketing site.

3. **User clicks link in the reset email**  
   They should land on:  
   `https://app.inthecircle.co/auth/callback?code=...&next=/update-password`  
   (or equivalent with token in hash/query, depending on Supabase).

4. **Auth callback (app)**  
   `GET /auth/callback` runs on **app.inthecircle.co**. It exchanges `code` for a session and redirects to `origin + next` → **https://app.inthecircle.co/update-password**.

5. **Set new password**  
   User is on **app.inthecircle.co/update-password**, sees “Set new password”, enters password twice, submits. Then they are redirected to `/feed` (or the `next` you keep).

---

## What was going wrong

- **Reset email link sent you to inthecircle.co**  
  You got something like:  
  `https://inthecircle.co/?code=5afaab8f-3960-4fe2-a72d-37b25bdf2c2d`  
  That is the **marketing site** (inthecircle.co), not the app (app.inthecircle.co). So:
  - The request never hits the Next.js app.
  - The marketing site may show a generic page or redirect to home; there is no `/auth/callback` there, so the code is never exchanged and the user never reaches **Set new password**.

- **Cause**  
  Supabase builds the link in the reset email using:
  1. **Site URL** (Auth → URL Configuration) as the default base.
  2. **redirectTo** we pass from the app – but only if that URL is in the **Redirect URLs** allow list.

  If **Site URL** is `https://inthecircle.co` (or redirectTo is missing from the allow list), the link in the email will point to **inthecircle.co**, so the flow breaks.

---

## Fixes applied in code

1. **Forgot-password page**
   - Pre-fill email from `?email=...` in the URL (for “Reset it here” links from the welcome email).
   - Use **NEXT_PUBLIC_APP_URL** for `redirectTo` when set, so we always tell Supabase to send users back to the app (e.g. `https://app.inthecircle.co`), not the current origin.

2. **Env**
   - `.env.example` documents `NEXT_PUBLIC_APP_URL=https://app.inthecircle.co` for production.

3. **Docs**
   - `SUPABASE_REDIRECT_SETUP.md` already says to set Site URL to `https://app.inthecircle.co` and to add the app callback to Redirect URLs.

---

## What you must set in Supabase (required)

Otherwise the reset link in the email will keep pointing to inthecircle.co.

1. **Dashboard**  
   [Supabase → Auth → URL Configuration](https://supabase.com/dashboard/project/qcdknokprohcsewpbjvj/auth/url-configuration)

2. **Site URL**  
   Set to:  
   `https://app.inthecircle.co`  
   (not `https://inthecircle.co`).  
   This is the default base for links in auth emails (including password reset).

3. **Redirect URLs**  
   Add (if not already):
   - `https://app.inthecircle.co/auth/callback`
   - `https://app.inthecircle.co/**` (optional but useful so any path under the app is allowed)

   Our app sends `redirectTo: https://app.inthecircle.co/auth/callback?next=/update-password`. That full URL must be allowed (either by the exact callback URL or by the wildcard above).

4. **Save**  
   Save URL Configuration so the next reset email uses the new settings.

---

## App env (production)

In Vercel (or your host) for **app.inthecircle.co**:

- `NEXT_PUBLIC_APP_URL=https://app.inthecircle.co`

So the forgot-password page uses this for `redirectTo` and Supabase can accept it (because it’s in Redirect URLs and matches the app).

---

## Quick checklist

| Step | Where | What |
|------|--------|------|
| 1 | Supabase → Auth → URL Configuration | **Site URL** = `https://app.inthecircle.co` |
| 2 | Same page | **Redirect URLs** include `https://app.inthecircle.co/auth/callback` (and optionally `https://app.inthecircle.co/**`) |
| 3 | Vercel (or prod env) | `NEXT_PUBLIC_APP_URL=https://app.inthecircle.co` |
| 4 | App | Forgot-password uses `?email=...` for pre-fill and uses `NEXT_PUBLIC_APP_URL` for `redirectTo` (done in code) |

---

## Flow summary

```
User on app.inthecircle.co/forgot-password
  → optional ?email=... pre-fills field
  → clicks “Send reset link”
  → App calls resetPasswordForEmail(email, { redirectTo: 'https://app.inthecircle.co/auth/callback?next=/update-password' })
  → Supabase sends email with link to app.inthecircle.co (if Site URL + Redirect URLs are correct)

User clicks link in email
  → Lands on app.inthecircle.co/auth/callback?code=...&next=/update-password
  → Callback exchanges code for session, redirects to app.inthecircle.co/update-password

User on app.inthecircle.co/update-password
  → Sets new password → redirect to /feed (or next)
```

If the link in the email still goes to **inthecircle.co**, the only fix is Supabase URL Configuration (Site URL + Redirect URLs) and ensuring `NEXT_PUBLIC_APP_URL` is set in production.
