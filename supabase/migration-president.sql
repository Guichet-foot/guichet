-- Add is_president flag to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_president boolean NOT NULL DEFAULT false;

-- Ensure created_by_admin exists (idempotent)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS created_by_admin uuid REFERENCES profiles(id);

-- Update RLS: also let admin_zone presidents manage profiles in their zone
DROP POLICY IF EXISTS "admin_zone reads profiles in zone" ON profiles;
CREATE POLICY "admin_zone reads profiles in zone" ON profiles FOR SELECT
  USING (zone_id = get_user_zone() AND get_user_role() = 'admin_zone');
