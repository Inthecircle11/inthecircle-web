# Setting SUPABASE_SERVICE_ROLE_KEY in Vercel

Governance health (CC6.1) and many admin features require the **Supabase service role key** in your Vercel deployment. Follow these steps.

## 1. Get the service role key from Supabase

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project.
2. Go to **Settings** → **API**.
3. Under **Project API keys**, copy the **`service_role`** key (secret).  
   ⚠️ **Never** expose this key in client-side code or commit it to git.

## 2. Add it in Vercel

1. Open [Vercel Dashboard](https://vercel.com) → your team → **inthecircle-web** (or your project).
2. Go to **Settings** → **Environment Variables**.
3. Click **Add New**:
   - **Key:** `SUPABASE_SERVICE_ROLE_KEY`
   - **Value:** paste the `service_role` key from Supabase
   - **Environments:** select **Production** (and **Preview** if you use preview deployments).
4. Save.

## 3. Redeploy so the key is used

- Either trigger a new deployment: **Deployments** → **⋯** on the latest → **Redeploy**.
- Or push a commit; the next build will include the new variable.

## 4. Assign super_admin (fix CC6.1)

After the redeploy:

1. Open **Admin** (or **Settings**) once while logged in with your **allowlisted** admin account  
   (the one in `ADMIN_USER_IDS` or `ADMIN_EMAILS`).
2. Go to **Admin** → **Compliance** and click **Run health checks**.

The health-check API will detect "No super_admin exists", assign your account as `super_admin` in `admin_user_roles`, and re-run checks. Governance score should show **100/100** and CC6.1 will be healthy.

---

**Summary:** Set `SUPABASE_SERVICE_ROLE_KEY` in Vercel → redeploy → open Admin (or Settings) and run health checks. Your allowlisted account will be assigned `super_admin` and CC6.1 will pass.
