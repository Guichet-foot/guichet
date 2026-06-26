-- Migration : ajouter les scores aux matchs
-- À exécuter dans l'éditeur SQL de Supabase

ALTER TABLE matches ADD COLUMN IF NOT EXISTS home_score integer;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS away_score integer;
