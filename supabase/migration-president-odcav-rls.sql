-- Fix RLS policies to include president_odcav role
-- Le Président ODCAV a les mêmes droits que le Super Admin sur toutes les tables.
-- À exécuter dans l'éditeur SQL de Supabase APRÈS migration-president-odcav.sql

-- ================================================================
-- Fonction utilitaire : is_odcav_admin()
-- Retourne true pour super_admin ET president_odcav
-- ================================================================
CREATE OR REPLACE FUNCTION is_odcav_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT get_user_role() IN ('super_admin', 'president_odcav')
$$;

-- ================================================================
-- 1. zones — SELECT + ALL
-- ================================================================
DROP POLICY IF EXISTS "users read their zone"                    ON zones;
DROP POLICY IF EXISTS "fondateur_or_super_admin manages zones"   ON zones;
DROP POLICY IF EXISTS "super_admin manages zones"                ON zones;

CREATE POLICY "users read their zone" ON zones FOR SELECT
  USING (
    get_user_role() = 'fondateur'
    OR (is_odcav_admin() AND created_by = auth.uid())
    OR id = get_user_zone()
  );

CREATE POLICY "odcav_admin manages zones" ON zones FOR ALL
  USING (
    get_user_role() = 'fondateur'
    OR (is_odcav_admin() AND created_by = auth.uid())
  )
  WITH CHECK (
    get_user_role() = 'fondateur'
    OR (is_odcav_admin() AND created_by = auth.uid())
  );

-- ================================================================
-- 2. profiles — ALL
-- ================================================================
DROP POLICY IF EXISTS "super_admin manages all profiles" ON profiles;

CREATE POLICY "odcav_admin manages all profiles" ON profiles FOR ALL
  USING (
    get_user_role() = 'fondateur'
    OR is_odcav_admin()
    OR auth.uid() = id
  );

-- ================================================================
-- 3. matches — SELECT + ALL (zone-scoped)
-- ================================================================
DROP POLICY IF EXISTS "Lecture des matchs"    ON matches;
DROP POLICY IF EXISTS "Gestion des matchs"    ON matches;

CREATE POLICY "Lecture des matchs" ON matches FOR SELECT TO authenticated
  USING (
    get_user_role() = 'fondateur'
    OR (is_odcav_admin() AND is_user_zone_owner(zone_id))
    OR (c3_account_id = auth.uid())
    OR (get_user_role() IN ('admin_zone', 'caissier', 'portier') AND zone_id = get_user_zone())
  );

CREATE POLICY "Gestion des matchs" ON matches FOR ALL TO authenticated
  USING (
    get_user_role() = 'fondateur'
    OR (is_odcav_admin() AND is_user_zone_owner(zone_id))
    OR (c3_account_id = auth.uid())
    OR (get_user_role() = 'admin_zone' AND zone_id = get_user_zone())
  );

-- ================================================================
-- 4. ticket_categories — SELECT + ALL
-- ================================================================
DROP POLICY IF EXISTS "Lecture des catégories" ON ticket_categories;
DROP POLICY IF EXISTS "Gestion des catégories" ON ticket_categories;

CREATE POLICY "Lecture des catégories" ON ticket_categories FOR SELECT TO authenticated
  USING (
    get_user_role() = 'fondateur'
    OR EXISTS (
      SELECT 1 FROM matches m WHERE m.id = match_id
        AND (
          (is_odcav_admin() AND is_user_zone_owner(m.zone_id))
          OR m.c3_account_id = auth.uid()
          OR (get_user_role() IN ('admin_zone', 'caissier', 'portier') AND m.zone_id = get_user_zone())
        )
    )
  );

CREATE POLICY "Gestion des catégories" ON ticket_categories FOR ALL TO authenticated
  USING (
    get_user_role() = 'fondateur'
    OR EXISTS (
      SELECT 1 FROM matches m WHERE m.id = match_id
        AND (
          (is_odcav_admin() AND is_user_zone_owner(m.zone_id))
          OR m.c3_account_id = auth.uid()
          OR (get_user_role() = 'admin_zone' AND m.zone_id = get_user_zone())
        )
    )
  );

-- ================================================================
-- 5. tickets — SELECT + ALL
-- ================================================================
DROP POLICY IF EXISTS "Lecture des tickets"  ON tickets;
DROP POLICY IF EXISTS "Gestion des tickets"  ON tickets;

CREATE POLICY "Lecture des tickets" ON tickets FOR SELECT TO authenticated
  USING (
    get_user_role() = 'fondateur'
    OR EXISTS (
      SELECT 1 FROM matches m WHERE m.id = match_id
        AND (
          (is_odcav_admin() AND is_user_zone_owner(m.zone_id))
          OR m.c3_account_id = auth.uid()
          OR (get_user_role() IN ('admin_zone', 'caissier', 'portier') AND m.zone_id = get_user_zone())
        )
    )
  );

CREATE POLICY "Gestion des tickets" ON tickets FOR ALL TO authenticated
  USING (
    get_user_role() = 'fondateur'
    OR EXISTS (
      SELECT 1 FROM matches m WHERE m.id = match_id
        AND (
          (is_odcav_admin() AND is_user_zone_owner(m.zone_id))
          OR m.c3_account_id = auth.uid()
          OR (get_user_role() IN ('admin_zone', 'caissier', 'portier') AND m.zone_id = get_user_zone())
        )
    )
  );

-- ================================================================
-- 6. expenses — SELECT + ALL
-- ================================================================
DROP POLICY IF EXISTS "Lecture des dépenses"  ON expenses;
DROP POLICY IF EXISTS "Gestion des dépenses"  ON expenses;

CREATE POLICY "Lecture des dépenses" ON expenses FOR SELECT TO authenticated
  USING (
    get_user_role() = 'fondateur'
    OR (is_odcav_admin() AND is_user_zone_owner(zone_id))
    OR (get_user_role() = 'admin_zone' AND zone_id = get_user_zone())
  );

CREATE POLICY "Gestion des dépenses" ON expenses FOR ALL TO authenticated
  USING (
    get_user_role() = 'fondateur'
    OR (is_odcav_admin() AND is_user_zone_owner(zone_id))
    OR (get_user_role() = 'admin_zone' AND zone_id = get_user_zone())
  );

-- ================================================================
-- 7. match_unsold — SELECT + ALL
-- ================================================================
DROP POLICY IF EXISTS "Lecture match_unsold pour authentifiés"  ON match_unsold;
DROP POLICY IF EXISTS "Admins gèrent les invendus"              ON match_unsold;

CREATE POLICY "Lecture match_unsold pour authentifiés" ON match_unsold
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM matches m WHERE m.id = match_unsold.match_id
        AND (
          get_user_role() = 'fondateur'
          OR (is_odcav_admin() AND is_user_zone_owner(m.zone_id))
          OR (get_user_role() = 'admin_zone' AND m.zone_id = get_user_zone())
          OR (get_user_role() IN ('caissier', 'portier') AND m.zone_id = get_user_zone())
          OR m.c3_account_id = auth.uid()
        )
    )
  );

CREATE POLICY "Admins gèrent les invendus" ON match_unsold
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM matches m WHERE m.id = match_unsold.match_id
        AND (
          get_user_role() = 'fondateur'
          OR (is_odcav_admin() AND is_user_zone_owner(m.zone_id))
          OR (get_user_role() = 'admin_zone' AND m.zone_id = get_user_zone())
          OR m.c3_account_id = auth.uid()
        )
    )
  );

-- ================================================================
-- 8. odcav_settings — ALL
-- ================================================================
DROP POLICY IF EXISTS "super_admin manages own odcav settings" ON odcav_settings;
DROP POLICY IF EXISTS "authenticated read odcav settings"       ON odcav_settings;

CREATE POLICY "odcav_admin manages own odcav settings" ON odcav_settings
  FOR ALL TO authenticated
  USING (
    get_user_role() = 'fondateur'
    OR (is_odcav_admin() AND id = auth.uid()::text)
  )
  WITH CHECK (
    get_user_role() = 'fondateur'
    OR (is_odcav_admin() AND id = auth.uid()::text)
  );

CREATE POLICY "authenticated read odcav settings" ON odcav_settings
  FOR SELECT TO authenticated USING (true);

-- ================================================================
-- 9. teams — si elle a des policies super_admin
-- ================================================================
DROP POLICY IF EXISTS "super_admin manages teams" ON teams;
CREATE POLICY "odcav_admin manages teams" ON teams FOR ALL TO authenticated
  USING (
    get_user_role() = 'fondateur'
    OR (is_odcav_admin() AND is_user_zone_owner(zone_id))
    OR (get_user_role() = 'admin_zone' AND zone_id = get_user_zone())
  );

DROP POLICY IF EXISTS "users read teams" ON teams;
CREATE POLICY "users read teams" ON teams FOR SELECT TO authenticated
  USING (
    get_user_role() = 'fondateur'
    OR (is_odcav_admin() AND is_user_zone_owner(zone_id))
    OR zone_id = get_user_zone()
  );

-- ================================================================
-- 10. access_cards — si elle a des policies super_admin
-- ================================================================
DROP POLICY IF EXISTS "super_admin manages access_cards" ON access_cards;
CREATE POLICY "odcav_admin manages access_cards" ON access_cards FOR ALL TO authenticated
  USING (
    get_user_role() = 'fondateur'
    OR (is_odcav_admin() AND is_user_zone_owner(zone_id))
    OR (get_user_role() = 'admin_zone' AND zone_id = get_user_zone())
  )
  WITH CHECK (
    get_user_role() = 'fondateur'
    OR (is_odcav_admin() AND is_user_zone_owner(zone_id))
    OR (get_user_role() = 'admin_zone' AND zone_id = get_user_zone())
  );

DROP POLICY IF EXISTS "users read access_cards" ON access_cards;
CREATE POLICY "users read access_cards" ON access_cards FOR SELECT TO authenticated
  USING (
    get_user_role() = 'fondateur'
    OR (is_odcav_admin() AND is_user_zone_owner(zone_id))
    OR zone_id = get_user_zone()
  );
