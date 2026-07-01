-- Migration : Paramètres ODCAV (logo, adresse, président, membres)
-- À exécuter dans l'éditeur SQL de Supabase

CREATE TABLE IF NOT EXISTS odcav_settings (
  id text PRIMARY KEY DEFAULT 'global',
  logo_url text,
  nom text,
  adresse text,
  president text,
  telephone text,
  email text,
  membres jsonb DEFAULT '[]'::jsonb,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE odcav_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin manages odcav settings" ON odcav_settings;
CREATE POLICY "super_admin manages odcav settings" ON odcav_settings
  FOR ALL TO authenticated
  USING (get_user_role() IN ('super_admin', 'fondateur'))
  WITH CHECK (get_user_role() IN ('super_admin', 'fondateur'));

DROP POLICY IF EXISTS "authenticated read odcav settings" ON odcav_settings;
CREATE POLICY "authenticated read odcav settings" ON odcav_settings
  FOR SELECT TO authenticated USING (true);

-- Ligne unique par défaut
INSERT INTO odcav_settings (id) VALUES ('global') ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Bucket Supabase Storage pour le logo ODCAV
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('odcav-assets', 'odcav-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Lecture publique (pour afficher le logo dans les PDFs)
DROP POLICY IF EXISTS "public read odcav assets" ON storage.objects;
CREATE POLICY "public read odcav assets" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'odcav-assets');

-- Upload réservé au super_admin / fondateur
DROP POLICY IF EXISTS "super_admin upload odcav assets" ON storage.objects;
CREATE POLICY "super_admin upload odcav assets" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'odcav-assets'
    AND get_user_role() IN ('super_admin', 'fondateur')
  );

-- Remplacement (upsert) du logo
DROP POLICY IF EXISTS "super_admin update odcav assets" ON storage.objects;
CREATE POLICY "super_admin update odcav assets" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'odcav-assets'
    AND get_user_role() IN ('super_admin', 'fondateur')
  );

-- Suppression du logo
DROP POLICY IF EXISTS "super_admin delete odcav assets" ON storage.objects;
CREATE POLICY "super_admin delete odcav assets" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'odcav-assets'
    AND get_user_role() IN ('super_admin', 'fondateur')
  );
