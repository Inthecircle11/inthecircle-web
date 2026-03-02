-- Add is_verified and is_banned to profiles for admin user actions (no client RPC).
-- Safe: ADD COLUMN IF NOT EXISTS.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_verified boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_banned boolean DEFAULT false;

COMMENT ON COLUMN public.profiles.is_verified IS 'Admin-set verification status (set via POST /api/admin/users/[id]/verification).';
COMMENT ON COLUMN public.profiles.is_banned IS 'Admin-set ban status (set via POST /api/admin/users/[id]/ban).';
