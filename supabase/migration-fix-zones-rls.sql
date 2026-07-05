-- Fix: chaque super_admin ne voit que ses propres zones
--
-- Problème : la politique "users read their zone" (schema.sql) contient
--   get_user_role() = 'super_admin'
-- ce qui donne à TOUS les super_admin la lecture de TOUTES les zones.
-- PostgreSQL applique un OR sur les politiques SELECT permissives,
-- donc même si "fondateur_or_super_admin manages zones" est correcte,
-- l'ancienne politique SELECT écrase tout.

-- 1. Supprimer l'ancienne politique SELECT trop large
DROP POLICY IF EXISTS "users read their zone" ON zones;

-- 2. Recréer une politique SELECT stricte par rôle :
--    • fondateur  → voit tout
--    • super_admin → voit uniquement les zones qu'il a créées
--    • admin_zone / caissier / portier → voit uniquement sa propre zone
CREATE POLICY "users read their zone" ON zones FOR SELECT
  USING (
    get_user_role() = 'fondateur'
    OR (get_user_role() = 'super_admin' AND created_by = auth.uid())
    OR id = get_user_zone()
  );

-- Note : la politique "fondateur_or_super_admin manages zones" (FOR ALL)
-- gère déjà INSERT / UPDATE / DELETE avec la même logique.
-- La politique ci-dessus couvre uniquement le SELECT pour les autres rôles.
