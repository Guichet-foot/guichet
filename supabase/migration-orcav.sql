-- Ajout du champ ORCAV sur la table zones
ALTER TABLE zones ADD COLUMN IF NOT EXISTS orcav text;
