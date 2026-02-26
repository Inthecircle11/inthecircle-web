# Real-time setup (Supabase)

For real-time notifications and live inbox updates to work, the following tables must be included in Supabase’s **Realtime** publication.

## Enable Realtime for tables

1. In the [Supabase Dashboard](https://supabase.com/dashboard), open your project.
2. Go to **Database** → **Replication** (or **Realtime** in the left sidebar).
3. Under the **supabase_realtime** publication, ensure these tables are enabled:
   - **notifications** – so the notifications page updates live when new notifications are inserted/updated.
   - **messages** – so the inbox and header unread count update when new messages arrive.
   - **message_threads** – so the inbox list updates when threads change.
   - **profiles** – so profile image/name updates appear without refresh (e.g. in the header).

### Via SQL (optional)

You can also add tables to the publication with SQL in the SQL Editor:

```sql
-- Add tables to the realtime publication (run once per table)
alter publication supabase_realtime add table notifications;
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table message_threads;
alter publication supabase_realtime add table profiles;
```

If a table is already in the publication, the command will error; that’s safe to ignore.

## If real-time doesn’t work

- Confirm the table is in the **supabase_realtime** publication (Replication / Realtime in the dashboard).
- Check the browser console for `[notifications] Realtime subscription error` (or similar) to see connection/authorization issues.
- Ensure Row Level Security (RLS) allows the authenticated user to **SELECT** the rows you’re filtering on (e.g. `user_id = auth.uid()` for `notifications`).
