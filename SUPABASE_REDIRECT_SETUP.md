# Supabase Auth Redirect URLs Setup

Add these URLs to your Supabase project for password reset and email confirmation to work:

**Dashboard:** https://supabase.com/dashboard/project/qcdknokprohcsewpbjvj/auth/url-configuration

## Redirect URLs to Add

1. `https://app.inthecircle.co/auth/callback`
2. `https://inthecircle-web.vercel.app/auth/callback`
3. `https://inthecircle-web-ahmed-khalifas-projects-9cca8f38.vercel.app/auth/callback`
4. `http://localhost:3000/auth/callback` (for local dev)

## Site URL (recommended)

Set **Site URL** to: `https://app.inthecircle.co`

## Wildcard option (covers all preview deployments)

Alternatively, add: `https://*.vercel.app/auth/callback` to cover all Vercel preview URLs.
