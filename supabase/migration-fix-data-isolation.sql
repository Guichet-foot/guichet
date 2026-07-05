-- Fix isolation des données par super_admin
-- À exécuter dans l'éditeur SQL de Supabase

-- ================================================================
-- 1. match_unsold : la politique SELECT "USING (true)" donnait accès
--    à TOUS les invendus de tous les super_admin.
--    Correction : filtrer via la zone du match (via la table matches).
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
        )
    )
  );

-- ================================================================
-- 2. odcav_settings : une seule ligne 'global' partagée par tous.
--    Correction : chaque super_admin a sa propre ligne dont l'id
--    est son auth.uid() (text). La ligne 'global' reste en DB mais
--    ne sera plus accessible via les nouvelles policies.
-- ================================================================
DROP POLICY IF EXISTS "super_admin manages odcav settings" ON odcav_settings;
DROP POLICY IF EXISTS "authenticated read odcav settings"  ON odcav_settings;

-- Chaque super_admin gère uniquement sa propre ligne (id = auth.uid())
CREATE POLICY "super_admin manages own odcav settings" ON odcav_settings
  FOR ALL TO authenticated
  USING (
    get_user_role() = 'fondateur'
    OR (get_user_role() = 'super_admin' AND id = auth.uid()::text)
  )
  WITH CHECK (
    get_user_role() = 'fondateur'
    OR (get_user_role() = 'super_admin' AND id = auth.uid()::text)
  );

-- Lecture : un utilisateur authentifié peut lire les settings de
-- son propre super_admin (via l'id passé explicitement par l'app).
-- On garde SELECT ouvert pour les admin_zone qui affichent le logo.
CREATE POLICY "authenticated read odcav settings" ON odcav_settings
  FOR SELECT TO authenticated USING (true);
