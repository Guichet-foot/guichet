-- Migration : ajouter le rôle "portier"
-- À exécuter dans l'éditeur SQL de Supabase

-- 1. Modifier la contrainte CHECK sur profiles.role
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('super_admin', 'admin_zone', 'caissier', 'portier'));

-- 2. Policy : le portier peut lire les matchs de sa zone
-- (déjà couvert par "caissier reads matches in zone" car il check get_user_zone())

-- 3. Policy : le portier peut scanner (update tickets)
-- (déjà couvert par "any user updates ticket scan in zone")

-- 4. Policy : le portier peut lire son propre profil
-- (déjà couvert par "users read own profile")

-- 5. Policy : le portier peut lire sa zone
-- (déjà couvert par "users read their zone")
