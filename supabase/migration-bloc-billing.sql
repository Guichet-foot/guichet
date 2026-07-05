-- Migration : Facturation par bloc de billets + module Invendus
-- À exécuter dans l'éditeur SQL de Supabase

-- 1. Ajouter fee_per_block à platform_settings (1000 ou 800 FCFA par bloc de 100 billets)
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS fee_per_block integer DEFAULT 1000;

-- 2. Table pour les invendus déclarés par match
CREATE TABLE IF NOT EXISTS match_unsold (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  unsold_count integer NOT NULL DEFAULT 0,
  tout_vendus boolean NOT NULL DEFAULT false,
  declared_by uuid REFERENCES profiles(id),
  declared_at timestamptz DEFAULT now(),
  UNIQUE(match_id)
);

-- RLS pour match_unsold
ALTER TABLE match_unsold ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Lecture match_unsold pour authentifiés" ON match_unsold
  FOR SELECT TO authenticated USING (true);

CREATE POLICY IF NOT EXISTS "Admins gèrent les invendus" ON match_unsold
  FOR ALL TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid())
    IN ('super_admin', 'admin_zone', 'fondateur')
  );
