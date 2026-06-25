-- Migration : Super Admin zone ownership + Paramètres zone
-- À exécuter dans l'éditeur SQL de Supabase

-- 1. Ajouter les colonnes à zones
ALTER TABLE zones ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES profiles(id);
ALTER TABLE zones ADD COLUMN IF NOT EXISTS logo text;
ALTER TABLE zones ADD COLUMN IF NOT EXISTS president text;
ALTER TABLE zones ADD COLUMN IF NOT EXISTS members jsonb DEFAULT '[]';
ALTER TABLE zones ADD COLUMN IF NOT EXISTS odcav text;
ALTER TABLE zones ADD COLUMN IF NOT EXISTS oncav text;

-- 2. Backfill created_by avec le premier super_admin existant
UPDATE zones SET created_by = (
  SELECT id FROM profiles WHERE role = 'super_admin' LIMIT 1
) WHERE created_by IS NULL;

-- 3. Helper : vérifie si l'utilisateur est propriétaire de la zone
CREATE OR REPLACE FUNCTION is_user_zone_owner(z_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM zones WHERE id = z_id AND created_by = auth.uid()
  );
$$;

-- 4. Mettre à jour les policies RLS

-- ZONES : super_admin ne voit que ses zones
DROP POLICY IF EXISTS "super_admin manages zones" ON zones;
CREATE POLICY "super_admin manages own zones" ON zones FOR ALL
  USING (
    (get_user_role() = 'super_admin' AND created_by = auth.uid())
  );

-- "users read their zone" reste inchangée (admin_zone/caissier/portier lisent leur zone)

-- MATCHES
DROP POLICY IF EXISTS "admin manages matches in zone" ON matches;
CREATE POLICY "admin manages matches in zone" ON matches FOR ALL
  USING (
    (zone_id = get_user_zone() AND get_user_role() = 'admin_zone')
    OR (get_user_role() = 'super_admin' AND is_user_zone_owner(zone_id))
  );

-- TICKET_CATEGORIES
DROP POLICY IF EXISTS "admin manages categories" ON ticket_categories;
CREATE POLICY "admin manages categories" ON ticket_categories FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM matches m WHERE m.id = match_id
      AND (
        (m.zone_id = get_user_zone() AND get_user_role() = 'admin_zone')
        OR (get_user_role() = 'super_admin' AND is_user_zone_owner(m.zone_id))
      )
    )
  );

-- TICKETS (admin read)
DROP POLICY IF EXISTS "admin reads tickets in zone" ON tickets;
CREATE POLICY "admin reads tickets in zone" ON tickets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM matches m WHERE m.id = match_id
      AND (
        (m.zone_id = get_user_zone() AND get_user_role() = 'admin_zone')
        OR (get_user_role() = 'super_admin' AND is_user_zone_owner(m.zone_id))
      )
    )
    AND get_user_role() IN ('admin_zone', 'super_admin')
  );

-- EXPENSES
DROP POLICY IF EXISTS "admin manages expenses in zone" ON expenses;
CREATE POLICY "admin manages expenses in zone" ON expenses FOR ALL
  USING (
    (zone_id = get_user_zone() AND get_user_role() = 'admin_zone')
    OR (get_user_role() = 'super_admin' AND is_user_zone_owner(zone_id))
  );

-- TEAMS
DROP POLICY IF EXISTS "admin manages teams in zone" ON teams;
CREATE POLICY "admin manages teams in zone" ON teams FOR ALL
  USING (
    (zone_id = get_user_zone() AND get_user_role() = 'admin_zone')
    OR (get_user_role() = 'super_admin' AND is_user_zone_owner(zone_id))
  );

-- TOURNAMENTS
DROP POLICY IF EXISTS "admin manages tournaments" ON tournaments;
CREATE POLICY "admin manages tournaments" ON tournaments FOR ALL
  USING (
    (zone_id = get_user_zone() AND get_user_role() = 'admin_zone')
    OR (get_user_role() = 'super_admin' AND is_user_zone_owner(zone_id))
  );

-- TOURNAMENT_GROUPS
DROP POLICY IF EXISTS "admin manages tournament_groups" ON tournament_groups;
CREATE POLICY "admin manages tournament_groups" ON tournament_groups FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM tournaments t WHERE t.id = tournament_id
      AND (
        (t.zone_id = get_user_zone() AND get_user_role() = 'admin_zone')
        OR (get_user_role() = 'super_admin' AND is_user_zone_owner(t.zone_id))
      )
    )
  );

-- TOURNAMENT_GROUP_TEAMS
DROP POLICY IF EXISTS "admin manages group_teams" ON tournament_group_teams;
CREATE POLICY "admin manages group_teams" ON tournament_group_teams FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM tournament_groups g
      JOIN tournaments t ON t.id = g.tournament_id
      WHERE g.id = group_id
      AND (
        (t.zone_id = get_user_zone() AND get_user_role() = 'admin_zone')
        OR (get_user_role() = 'super_admin' AND is_user_zone_owner(t.zone_id))
      )
    )
  );

-- TOURNAMENT_MATCHES
DROP POLICY IF EXISTS "admin manages tournament_matches" ON tournament_matches;
CREATE POLICY "admin manages tournament_matches" ON tournament_matches FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM tournaments t WHERE t.id = tournament_id
      AND (
        (t.zone_id = get_user_zone() AND get_user_role() = 'admin_zone')
        OR (get_user_role() = 'super_admin' AND is_user_zone_owner(t.zone_id))
      )
    )
  );

-- PROFILES : super_admin lit les profils des zones qu'il a créées
DROP POLICY IF EXISTS "super_admin manages all profiles" ON profiles;
CREATE POLICY "super_admin manages own zone profiles" ON profiles FOR ALL
  USING (
    get_user_role() = 'super_admin'
    AND (zone_id IS NULL OR is_user_zone_owner(zone_id))
  );
