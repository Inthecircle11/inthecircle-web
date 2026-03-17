# Supabase Auth Redirect URLs Setup

**Critical for password reset:** The link in the reset email is built from **Site URL** and must point to the **webapp** so users can set a new password. If the link sends users to `/download` or the marketing site, the flow is broken.

**Dashboard:** https://supabase.com/dashboard/project/qcdknokprohcsewpbjvj/auth/url-configuration

## Site URL (required)

Set **Site URL** to: `https://app.inthecircle.co`  
Do **not** use `https://inthecircle.co` or any URL that points to the download page.

## Redirect URLs to Add

Add these **exact** URLs (one per line in the dashboard):

1. `https://app.inthecircle.co/auth/callback`
2. `https://app.inthecircle.co/update-password`
3. `https://inthecircle-web.vercel.app/auth/callback`
4. `https://inthecircle-web-ahmed-khalifas-projects-9cca8f38.vercel.app/auth/callback`
5. `http://localhost:3000/auth/callback` (for local dev)

**Do not add** `https://app.inthecircle.co/download` as a redirect URL for auth. If it is listed, remove it—otherwise password reset links can land on the download page instead of the update-password flow. The webapp redirects recovery tokens from `/download` to `/update-password` as a fallback, but the correct fix is to use the URLs above.

## Wildcard option (covers all preview deployments)

You can add: `https://*.vercel.app/auth/callback` to cover all Vercel preview URLs.

## Apply via script (optional)

To set Site URL and Redirect URLs via the Supabase Management API (e.g. in CI or one-off fix):

```bash
SUPABASE_ACCESS_TOKEN=your_pat node scripts/set-auth-redirect-urls.mjs
```

Requires a [Personal Access Token](https://supabase.com/dashboard/account/tokens) with access to the project. Loads `NEXT_PUBLIC_SUPABASE_URL` from `.env.local` if set.
