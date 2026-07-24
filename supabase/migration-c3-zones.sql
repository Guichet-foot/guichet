-- Migration : zones affiliées aux comptes C3
-- À exécuter dans le SQL Editor de Supabase Dashboard
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS c3_zone_ids uuid[] DEFAULT '{}';
