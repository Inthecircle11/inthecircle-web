# Approval welcome email (web repo)

When an admin **approves** an application (single or bulk) from the web admin panel, the applicant receives a **welcome email** using the same template as the iOS app.

## How it works

1. **Template and sending** live in the **Inthecircle** repo (iOS/Supabase), not in this repo:
   - **Edge Function:** `Inthecircle/supabase/functions/send-welcome-email/`
   - It sends the “You’re in” / “Congratulations, you’ve been accepted” email via Resend (creator and brand variants).

2. **This repo** does not send email itself. After a successful approve it **calls** that Edge Function with a synthetic webhook payload so the function sends the email:
   - **Helper:** `src/lib/trigger-welcome-email.ts` → `triggerWelcomeEmailForApplication(supabase, applicationId)`
   - Used by: `POST /api/admin/applications/[id]/action` (single approve) and `POST /api/admin/bulk-applications` (bulk approve).

3. So you have **one template**, one sender (the Edge Function), and the web just **triggers** it.

## Requirements

- **Same Supabase project** as the one where the Edge Function is deployed (so `NEXT_PUBLIC_SUPABASE_URL` points to that project).
- **Edge Function** `send-welcome-email` deployed and **RESEND_API_KEY** set in Supabase Edge Function secrets.
- **SUPABASE_SERVICE_ROLE_KEY** (or SUPABASE_ANON_KEY) set in the web app env so it can invoke the function.

## Optional: Database webhook

The Inthecircle project can also use a **Database Webhook** on `applications` UPDATE to call the same Edge Function. If that webhook is configured, the email may be sent twice when approving from the web (once by the web’s trigger, once by the webhook). To avoid duplicates the Edge Function uses `welcome_email_sent_at` and skips if already sent. So either:

- Rely only on the **web trigger** (this repo), and don’t create the webhook for the same project, or  
- Rely only on the **webhook** and remove the trigger from this repo, or  
- Keep both; the function’s duplicate check ensures only one email is sent.

## Test

To send a test welcome email to an address (uses the same Edge Function template):

```bash
node scripts/send-approval-email-test.mjs someone@example.com
```

Requires `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_ANON_KEY` (or service role) in `.env.local`.
