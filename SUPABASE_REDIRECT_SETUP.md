# Supabase Auth Redirect URLs Setup

**Critical for password reset:** The link in the reset email is built from **Site URL**. If Site URL is `https://inthecircle.co` (marketing site), users land there and never reach the app to set a new password. Set Site URL to **app.inthecircle.co** and add the app callback to Redirect URLs.

**Dashboard:** https://supabase.com/dashboard/project/qcdknokprohcsewpbjvj/auth/url-configuration

## Site URL (required)

Set **Site URL** to: `https://app.inthecircle.co`  
Do **not** use `https://inthecircle.co` here.

## Redirect URLs to Add

1. `https://app.inthecircle.co/auth/callback`
2. `https://inthecircle-web.vercel.app/auth/callback`
3. `https://inthecircle-web-ahmed-khalifas-projects-9cca8f38.vercel.app/auth/callback`
4. `http://localhost:3000/auth/callback` (for local dev)

## Wildcard option (covers all preview deployments)

Alternatively, add: `https://*.vercel.app/auth/callback` to cover all Vercel preview URLs.
