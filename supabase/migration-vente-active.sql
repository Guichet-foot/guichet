-- Migration : ajouter le contrôle de vente sur les matchs
-- À exécuter dans l'éditeur SQL de Supabase

ALTER TABLE matches ADD COLUMN IF NOT EXISTS vente_active boolean NOT NULL DEFAULT false;
