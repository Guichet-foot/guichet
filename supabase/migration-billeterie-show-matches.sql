-- Ajout du flag pour masquer les matchs sur le billet imprimé
-- Quand false, les matchs ne sont pas affichés sur le billet physique

ALTER TABLE billeterie
  ADD COLUMN IF NOT EXISTS show_matches_on_ticket boolean NOT NULL DEFAULT true;
