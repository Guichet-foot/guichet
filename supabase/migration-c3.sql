-- Migration : Rôle C3 (Coordination Communale des Compétitions)
-- À exécuter dans l'éditeur SQL de Supabase

-- ================================================================
-- 1. Ajouter 'c3' au type de rôle
-- ================================================================
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('fondateur', 'super_admin', 'admin_zone', 'caissier', 'portier', 'c3'));

-- ================================================================
-- 2. Ajouter c3_account_id aux matchs + rendre zone_id nullable
--    Les matchs C3 ont zone_id=NULL et c3_account_id=profile.id
-- ================================================================
ALTER TABLE matches ADD COLUMN IF NOT EXISTS c3_account_id uuid REFERENCES profiles(id);
ALTER TABLE matches ALTER COLUMN zone_id DROP NOT NULL;

-- ================================================================
-- 3. Ajouter c3_account_id aux dépenses + rendre zone_id nullable
-- ================================================================
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS c3_account_id uuid REFERENCES profiles(id);
ALTER TABLE expenses ALTER COLUMN zone_id DROP NOT NULL;

-- ================================================================
-- 4. Ajouter c3_account_id aux modèles de billets + zone_id nullable
-- ================================================================
ALTER TABLE ticket_templates ADD COLUMN IF NOT EXISTS c3_account_id uuid REFERENCES profiles(id);
ALTER TABLE ticket_templates ALTER COLUMN zone_id DROP NOT NULL;

-- ================================================================
-- 5. Helper : récupérer l'ODCAV (super_admin) du compte C3
-- ================================================================
CREATE OR REPLACE FUNCTION get_c3_odcav_id()
RETURNS uuid LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT created_by_admin FROM profiles WHERE id = auth.uid()
$$;

-- ================================================================
-- 6. RLS MATCHES
-- ================================================================
DROP POLICY IF EXISTS "admin manages matches in zone" ON matches;
CREATE POLICY "admin manages matches in zone" ON matches FOR ALL
  USING (
    get_user_role() = 'fondateur'
    OR (get_user_role() = 'admin_zone'   AND zone_id = get_user_zone())
    OR (get_user_role() = 'super_admin'  AND is_user_zone_owner(zone_id))
    OR (get_user_role() = 'c3'           AND c3_account_id = auth.uid())
    OR (get_user_role() IN ('caissier', 'portier') AND (
          zone_id = get_user_zone()
          OR c3_account_id = get_c3_odcav_id()
        ))
  );

-- Ajout : caissier C3 voit les matchs de son C3
DROP POLICY IF EXISTS "caissier reads own zone matches" ON matches;
CREATE POLICY "caissier reads own zone matches" ON matches FOR SELECT
  USING (
    (zone_id = get_user_zone() AND get_user_role() IN ('caissier', 'portier'))
    OR (get_user_role() IN ('caissier', 'portier') AND c3_account_id = (
          SELECT created_by_admin FROM profiles WHERE id = auth.uid()
        ))
  );

-- ================================================================
-- 7. RLS TICKET_CATEGORIES
-- ================================================================
DROP POLICY IF EXISTS "admin manages categories" ON ticket_categories;
CREATE POLICY "admin manages categories" ON ticket_categories FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM matches m WHERE m.id = match_id
      AND (
        get_user_role() = 'fondateur'
        OR (get_user_role() = 'admin_zone'  AND m.zone_id = get_user_zone())
        OR (get_user_role() = 'super_admin' AND is_user_zone_owner(m.zone_id))
        OR (get_user_role() = 'c3'          AND m.c3_account_id = auth.uid())
      )
    )
  );

-- ================================================================
-- 8. RLS TICKETS
-- ================================================================
DROP POLICY IF EXISTS "admin reads tickets in zone" ON tickets;
CREATE POLICY "admin reads tickets in zone" ON tickets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM matches m WHERE m.id = match_id
      AND (
        get_user_role() = 'fondateur'
        OR (get_user_role() = 'admin_zone'   AND m.zone_id = get_user_zone())
        OR (get_user_role() = 'super_admin'  AND is_user_zone_owner(m.zone_id))
        OR (get_user_role() = 'c3'           AND m.c3_account_id = auth.uid())
      )
    )
    AND get_user_role() IN ('admin_zone', 'super_admin', 'c3', 'fondateur')
  );

-- ================================================================
-- 9. RLS EXPENSES
-- ================================================================
DROP POLICY IF EXISTS "admin manages expenses in zone" ON expenses;
CREATE POLICY "admin manages expenses in zone" ON expenses FOR ALL
  USING (
    get_user_role() = 'fondateur'
    OR (get_user_role() = 'admin_zone'   AND zone_id = get_user_zone())
    OR (get_user_role() = 'super_admin'  AND is_user_zone_owner(zone_id))
    OR (get_user_role() = 'c3'           AND c3_account_id = auth.uid())
  );

-- ================================================================
-- 10. RLS TEAMS : C3 lit les équipes des zones de son ODCAV
-- ================================================================
DROP POLICY IF EXISTS "admin manages teams in zone" ON teams;
CREATE POLICY "admin manages teams in zone" ON teams FOR ALL
  USING (
    get_user_role() = 'fondateur'
    OR (get_user_role() IN ('admin_zone', 'caissier', 'portier') AND zone_id = get_user_zone())
    OR (get_user_role() = 'super_admin' AND is_user_zone_owner(zone_id))
    OR (get_user_role() = 'c3' AND EXISTS (
          SELECT 1 FROM zones z
          WHERE z.id = teams.zone_id AND z.created_by = get_c3_odcav_id()
        ))
  );

-- ================================================================
-- 11. RLS TICKET_TEMPLATES
-- ================================================================
DROP POLICY IF EXISTS "admin manages ticket_templates" ON ticket_templates;
DROP POLICY IF EXISTS "users read ticket_templates in zone" ON ticket_templates;

CREATE POLICY "admin manages ticket_templates" ON ticket_templates FOR ALL
  USING (
    get_user_role() = 'fondateur'
    OR (get_user_role() = 'admin_zone'  AND zone_id = get_user_zone())
    OR (get_user_role() = 'super_admin' AND is_user_zone_owner(zone_id))
    OR (get_user_role() = 'c3'          AND c3_account_id = auth.uid())
  );

CREATE POLICY "users read ticket_templates in zone" ON ticket_templates FOR SELECT
  USING (
    zone_id = get_user_zone()
    OR (get_user_role() = 'c3' AND c3_account_id = auth.uid())
  );

-- ================================================================
-- 12. RLS PROFILES : C3 gère ses propres caissier/portier
-- ================================================================
DROP POLICY IF EXISTS "c3 manages own staff" ON profiles;
CREATE POLICY "c3 manages own staff" ON profiles FOR ALL
  USING (
    get_user_role() = 'c3'
    AND (
      id = auth.uid()
      OR (created_by_admin = auth.uid() AND role IN ('caissier', 'portier'))
    )
  );

-- ================================================================
-- 13. RLS MATCH_UNSOLD : inclure C3
-- (mise à jour des politiques déjà corrigées dans migration-fix-data-isolation)
-- ================================================================
DROP POLICY IF EXISTS "Lecture match_unsold pour authentifiés" ON match_unsold;
CREATE POLICY "Lecture match_unsold pour authentifiés" ON match_unsold
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = match_unsold.match_id
        AND (
          get_user_role() = 'fondateur'
          OR (get_user_role() = 'super_admin' AND is_user_zone_owner(m.zone_id))
          OR (get_user_role() = 'admin_zone'  AND m.zone_id = get_user_zone())
          OR (get_user_role() = 'c3'          AND m.c3_account_id = auth.uid())
          OR (get_user_role() IN ('caissier', 'portier') AND m.zone_id = get_user_zone())
        )
    )
  );

DROP POLICY IF EXISTS "Admins gèrent les invendus" ON match_unsold;
CREATE POLICY "Admins gèrent les invendus" ON match_unsold
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = match_unsold.match_id
        AND (
          get_user_role() = 'fondateur'
          OR (get_user_role() = 'super_admin' AND is_user_zone_owner(m.zone_id))
          OR (get_user_role() = 'admin_zone'  AND m.zone_id = get_user_zone())
          OR (get_user_role() = 'c3'          AND m.c3_account_id = auth.uid())
        )
    )
  );

-- ================================================================
-- 14. RLS ODCAV_SETTINGS : permettre à C3 de gérer sa propre ligne
-- ================================================================
DROP POLICY IF EXISTS "super_admin manages own odcav settings" ON odcav_settings;
CREATE POLICY "super_admin manages own odcav settings" ON odcav_settings
  FOR ALL TO authenticated
  USING (
    get_user_role() = 'fondateur'
    OR (get_user_role() = 'super_admin' AND id = auth.uid()::text)
    OR (get_user_role() = 'c3'          AND id = auth.uid()::text)
  )
  WITH CHECK (
    get_user_role() = 'fondateur'
    OR (get_user_role() = 'super_admin' AND id = auth.uid()::text)
    OR (get_user_role() = 'c3'          AND id = auth.uid()::text)
  );
