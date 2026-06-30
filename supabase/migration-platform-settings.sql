-- Migration : Paramètres plateforme (frais + commission ODCAV)
-- À exécuter dans l'éditeur SQL de Supabase

-- Table des paramètres de la plateforme
-- Supporte l'historique : chaque ligne = un paramètre avec une date d'entrée en vigueur
CREATE TABLE IF NOT EXISTS platform_settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  frais_plateforme integer NOT NULL DEFAULT 5000,  -- FCFA par jour d'activité
  odcav_rate numeric(5,4) NOT NULL DEFAULT 0.05,   -- 5% fixe
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

-- Une seule entrée par date d'effet
CREATE UNIQUE INDEX IF NOT EXISTS platform_settings_date_idx
  ON platform_settings(effective_date);

-- RLS
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

-- Seul le fondateur peut créer/modifier
CREATE POLICY "fondateur manages platform settings" ON platform_settings
  FOR ALL TO authenticated
  USING (get_user_role() = 'fondateur')
  WITH CHECK (get_user_role() = 'fondateur');

-- Tous les utilisateurs connectés peuvent lire (pour afficher dans les stats)
CREATE POLICY "authenticated read platform settings" ON platform_settings
  FOR SELECT TO authenticated
  USING (true);

-- Paramètre initial par défaut
INSERT INTO platform_settings (frais_plateforme, odcav_rate, effective_date)
VALUES (5000, 0.05, CURRENT_DATE)
ON CONFLICT (effective_date) DO NOTHING;
