-- =========================
-- SEED DATA
-- =========================

-- Zone test
INSERT INTO zones (id, name, region) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Zone Mbour', 'Thiès');

-- IMPORTANT : Les utilisateurs doivent être créés via Supabase Studio ou l'API admin.
-- Créer les auth.users suivants, puis insérer les profiles ci-dessous :
--
-- 1. super_admin : admin@guichetfoot.com / Admin1234
-- 2. admin_zone  : zone@guichetfoot.com / Zone1234
-- 3. caissier    : caissier1@guichetfoot.com / Caissier1234
-- 4. caissier    : caissier2@guichetfoot.com / Caissier1234
--
-- Après création des auth.users, récupérer les UUIDs et adapter les INSERT ci-dessous :

-- Exemple (remplacer les UUIDs par ceux générés) :
-- INSERT INTO profiles (id, full_name, phone, role, zone_id) VALUES
--   ('<uuid-admin>', 'Admin Principal', '+221770000001', 'super_admin', NULL),
--   ('<uuid-zone>', 'Admin Zone Mbour', '+221770000002', 'admin_zone', '11111111-1111-1111-1111-111111111111'),
--   ('<uuid-caissier1>', 'Aminata Diallo', '+221770000003', 'caissier', '11111111-1111-1111-1111-111111111111'),
--   ('<uuid-caissier2>', 'Moussa Ndiaye', '+221770000004', 'caissier', '11111111-1111-1111-1111-111111111111');

-- 3 Matchs test
INSERT INTO matches (id, zone_id, home_team, away_team, venue, match_date, status) VALUES
  ('22222222-2222-2222-2222-222222222221',
   '11111111-1111-1111-1111-111111111111',
   'ASC Ndiarème', 'ASC Yeumbeul',
   'Stade Municipal de Mbour',
   NOW() + INTERVAL '3 days',
   'programme'),

  ('22222222-2222-2222-2222-222222222222',
   '11111111-1111-1111-1111-111111111111',
   'ASC Saly', 'ASC Somone',
   'Stade Municipal de Saly',
   NOW(),
   'en_cours'),

  ('22222222-2222-2222-2222-222222222223',
   '11111111-1111-1111-1111-111111111111',
   'ASC Mbour', 'ASC Ngaparou',
   'Stade Caroline Faye',
   NOW() - INTERVAL '7 days',
   'termine');

-- Catégories billets pour chaque match
INSERT INTO ticket_categories (match_id, name, price, quantity_total, display_order) VALUES
  ('22222222-2222-2222-2222-222222222221', 'Tribune', 1500, 200, 0),
  ('22222222-2222-2222-2222-222222222221', 'Pelouse', 500, 500, 1),
  ('22222222-2222-2222-2222-222222222222', 'Tribune', 1500, 200, 0),
  ('22222222-2222-2222-2222-222222222222', 'Pelouse', 500, 500, 1),
  ('22222222-2222-2222-2222-222222222223', 'Tribune', 1500, 200, 0),
  ('22222222-2222-2222-2222-222222222223', 'Pelouse', 500, 500, 1);
