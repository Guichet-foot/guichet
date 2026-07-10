-- Migration : Matchs directs Fondateur
-- À exécuter dans le dashboard Supabase > SQL Editor

-- Colonnes pour les matchs directs (fondateur sans zone)
ALTER TABLE matches ADD COLUMN IF NOT EXISTS home_team_zone text;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS away_team_zone text;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS match_type text;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS is_direct boolean DEFAULT false;
