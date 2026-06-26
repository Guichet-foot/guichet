-- Migration : ajouter description aux modèles de billets
-- À exécuter dans l'éditeur SQL de Supabase

ALTER TABLE ticket_templates ADD COLUMN IF NOT EXISTS description text;
