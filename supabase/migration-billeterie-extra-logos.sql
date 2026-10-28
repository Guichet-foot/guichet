-- Migration : logos supplémentaires sur le billet personnalisé
-- À exécuter dans l'éditeur SQL de Supabase
--
-- Le billet personnalisé n'affichait qu'un seul logo (organizer_logo_url).
-- Ajoute un tableau de logos supplémentaires (équipes, partenaires...)
-- affichés sur la même ligne que le logo organisateur, en haut du billet.

ALTER TABLE billeterie
  ADD COLUMN IF NOT EXISTS extra_logo_urls text[];
