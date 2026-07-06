-- Migration : Rôle Président ODCAV + Comptes directs avec modules
-- À exécuter dans l'éditeur SQL de Supabase

-- ================================================================
-- 1. Ajouter le rôle president_odcav au CHECK constraint
-- ================================================================
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN (
    'fondateur',
    'president_odcav',
    'super_admin',
    'admin_zone',
    'caissier',
    'portier',
    'c3'
  ));

-- ================================================================
-- 2. Ville pour les comptes C3 (ex: "C3 NGUEKOKH")
-- ================================================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS city text;

-- ================================================================
-- 3. Modules autorisés pour les comptes directs
--    NULL = accès complet
--    array = seulement ces modules visibles dans la sidebar
--    Ex: ARRAY['finances','rapports']
-- ================================================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS permitted_modules text[];
