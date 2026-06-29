-- Migration : Compte Fondateur + structure abonnement
-- À exécuter dans l'éditeur SQL de Supabase

-- 1. Ajouter le rôle fondateur
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('fondateur', 'super_admin', 'admin_zone', 'caissier', 'portier'));

-- 2. Tracer qui a créé quel compte
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS created_by_admin uuid REFERENCES profiles(id);

-- 3. Structure abonnement (pas d'interface pour l'instant)
ALTER TABLE zones ADD COLUMN IF NOT EXISTS subscription_type text
  CHECK (subscription_type IN ('mensuel', '15_jours', 'annuel'));
ALTER TABLE zones ADD COLUMN IF NOT EXISTS subscription_start date;
ALTER TABLE zones ADD COLUMN IF NOT EXISTS subscription_end date;
ALTER TABLE zones ADD COLUMN IF NOT EXISTS subscription_active boolean DEFAULT true;

-- 4. RLS : le fondateur voit tout

-- ZONES
DROP POLICY IF EXISTS "fondateur_or_super_admin manages zones" ON zones;
DROP POLICY IF EXISTS "super_admin manages own zones" ON zones;
CREATE POLICY "fondateur_or_super_admin manages zones" ON zones FOR ALL
  USING (
    get_user_role() = 'fondateur'
    OR (get_user_role() = 'super_admin' AND created_by = auth.uid())
  );

-- MATCHES
DROP POLICY IF EXISTS "admin manages matches in zone" ON matches;
CREATE POLICY "admin manages matches in zone" ON matches FOR ALL
  USING (
    get_user_role() = 'fondateur'
    OR (zone_id = get_user_zone() AND get_user_role() = 'admin_zone')
    OR (get_user_role() = 'super_admin' AND is_user_zone_owner(zone_id))
  );

-- EXPENSES
DROP POLICY IF EXISTS "admin manages expenses in zone" ON expenses;
CREATE POLICY "admin manages expenses in zone" ON expenses FOR ALL
  USING (
    get_user_role() = 'fondateur'
    OR (zone_id = get_user_zone() AND get_user_role() = 'admin_zone')
    OR (get_user_role() = 'super_admin' AND is_user_zone_owner(zone_id))
  );

-- TEAMS
DROP POLICY IF EXISTS "admin manages teams in zone" ON teams;
CREATE POLICY "admin manages teams in zone" ON teams FOR ALL
  USING (
    get_user_role() = 'fondateur'
    OR (zone_id = get_user_zone() AND get_user_role() = 'admin_zone')
    OR (get_user_role() = 'super_admin' AND is_user_zone_owner(zone_id))
  );

-- PROFILES : fondateur voit tous les profils
DROP POLICY IF EXISTS "super_admin manages own zone profiles" ON profiles;
CREATE POLICY "fondateur_or_super_admin manages profiles" ON profiles FOR ALL
  USING (
    get_user_role() = 'fondateur'
    OR (get_user_role() = 'super_admin' AND (zone_id IS NULL OR is_user_zone_owner(zone_id)))
  );

-- TICKETS (admin read)
DROP POLICY IF EXISTS "admin reads tickets in zone" ON tickets;
CREATE POLICY "admin reads tickets in zone" ON tickets FOR SELECT
  USING (
    get_user_role() = 'fondateur'
    OR (
      EXISTS (
        SELECT 1 FROM matches m WHERE m.id = match_id
        AND (
          (m.zone_id = get_user_zone() AND get_user_role() = 'admin_zone')
          OR (get_user_role() = 'super_admin' AND is_user_zone_owner(m.zone_id))
        )
      )
      AND get_user_role() IN ('admin_zone', 'super_admin')
    )
  );

-- TICKET_CATEGORIES
DROP POLICY IF EXISTS "admin manages categories" ON ticket_categories;
CREATE POLICY "admin manages categories" ON ticket_categories FOR ALL
  USING (
    get_user_role() = 'fondateur'
    OR EXISTS (
      SELECT 1 FROM matches m WHERE m.id = match_id
      AND (
        (m.zone_id = get_user_zone() AND get_user_role() = 'admin_zone')
        OR (get_user_role() = 'super_admin' AND is_user_zone_owner(m.zone_id))
      )
    )
  );

-- TOURNAMENTS
DROP POLICY IF EXISTS "admin manages tournaments" ON tournaments;
CREATE POLICY "admin manages tournaments" ON tournaments FOR ALL
  USING (
    get_user_role() = 'fondateur'
    OR (zone_id = get_user_zone() AND get_user_role() = 'admin_zone')
    OR (get_user_role() = 'super_admin' AND is_user_zone_owner(zone_id))
  );

-- TICKET_TEMPLATES
DROP POLICY IF EXISTS "admin manages ticket_templates" ON ticket_templates;
CREATE POLICY "admin manages ticket_templates" ON ticket_templates FOR ALL
  USING (
    get_user_role() = 'fondateur'
    OR (zone_id = get_user_zone() AND get_user_role() = 'admin_zone')
    OR (get_user_role() = 'super_admin' AND is_user_zone_owner(zone_id))
  );

-- AUDIT
DROP POLICY IF EXISTS "admin reads audit" ON audit_log;
CREATE POLICY "admin reads audit" ON audit_log FOR SELECT
  USING (get_user_role() IN ('fondateur', 'admin_zone', 'super_admin'));
