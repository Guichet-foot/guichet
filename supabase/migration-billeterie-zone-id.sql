-- Ajout de la colonne zone_id sur la table billeterie
-- Permet d'associer une billetterie à une zone directement (sans passer par match_ids)
-- Nécessaire pour le tableau de bord des admins zone lorsque la billetterie n'a pas de matchs

ALTER TABLE billeterie
  ADD COLUMN IF NOT EXISTS zone_id uuid REFERENCES zones(id) ON DELETE SET NULL;
