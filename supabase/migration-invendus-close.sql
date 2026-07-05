-- Migration : Ajout du champ is_closed à match_unsold
-- Permet de "Terminer" la déclaration d'invendus d'un match
ALTER TABLE match_unsold ADD COLUMN IF NOT EXISTS is_closed boolean NOT NULL DEFAULT false;
