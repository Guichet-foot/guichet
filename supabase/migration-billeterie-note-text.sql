-- Migration : champ Texte/Note libre affiché sur tous les billets
-- À exécuter dans l'éditeur SQL de Supabase
--
-- Note facultative saisie à la création du pass, affichée en gras sous le
-- titre sur le billet imprimé (standard ET personnalisé).

ALTER TABLE billeterie
  ADD COLUMN IF NOT EXISTS note_text text;
