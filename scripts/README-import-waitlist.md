# Import waitlist from CSV

This script creates an **application** for each contact in your CSV and sets their status to **WAITLISTED**, so they appear in the admin panel under Applications → Waitlisted.

## What it does

- Reads a CSV with at least an **Email** column.
- For each **unique email**:
  - If the email already has a profile: updates their application to **WAITLISTED** (and optional phone).
  - If not: creates an auth user (with a random password), which triggers creation of a profile and application, then sets the application to **WAITLISTED** and optionally sets phone on the profile.

No signup or password is sent to the user; they can use “Forgot password” later to set one.

## Requirements

- **Supabase project** used by app.inthecircle.co.
- **Service role key** (Supabase Dashboard → Settings → API → `service_role` secret). Do not use the anon key.

## Setup

1. Set environment variables (use a `.env.local` or export in the shell):

   ```bash
   export SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
   export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
   ```

2. Run the script with the path to your CSV:

   ```bash
   npm run import-waitlist -- "/path/to/your/contacts.csv"
   ```

   Or directly:

   ```bash
   node scripts/import-waitlist-from-csv.mjs "/path/to/your/contacts.csv"
   ```

## CSV format

- **Required:** a column named `Email` (or `ِEmail الايميل (custom_5)` / `الايميل (email)`).
- **Optional:** `Name`, or `First Name` + `Last Name`, or `Full name الاسم كامل (custom_4)` for the display name.
- **Optional:** `Mobile Phone Number (mobile_phone_number)` or `رقم التليفون مع الكود الدولي (custom_3)` for phone (stored on profile).

Duplicate emails in the CSV are processed once. Existing users (same email) are only updated to WAITLISTED and optional phone; no new auth user is created.

### If the import stops or times out: use batch mode

Process a fixed number of **new** users per run, then re-run until done.

```bash
npm run import-waitlist -- "/path/to/contacts.csv" --batch 200
```

- **200** = at most 200 new users per run (~1 min). Re-run the **same command** to process the next 200. Existing/skipped don’t count toward the limit.
- If it still stops, use `--batch 100`. When stable, try `--batch 400`.

**Run in background** (keeps going if you close the terminal):

```bash
nohup node scripts/import-waitlist-from-csv.mjs "/path/to/contacts.csv" --batch 200 >> import.log 2>&1 &
tail -f import.log
```

Then run the same `nohup node ... --batch 200` again (and again) until the log shows no remaining.
