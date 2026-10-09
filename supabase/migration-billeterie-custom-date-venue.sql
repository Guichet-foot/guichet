-- Migration : champs Date et Stade pour les billets personnalisés (design finales)
-- À exécuter dans l'éditeur SQL de Supabase
--
-- Permet de saisir explicitement la date et le stade affichés sur le billet
-- personnalisé, au lieu de les déduire des matchs rattachés au pass.

ALTER TABLE billeterie
  ADD COLUMN IF NOT EXISTS custom_date date,
  ADD COLUMN IF NOT EXISTS custom_venue text;
