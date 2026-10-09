-- Migration : Billets personnalisés (design finales) pour la billetterie
-- À exécuter dans l'éditeur SQL de Supabase
--
-- Ajoute un design alternatif pour les pass billetterie type "Finales" : logo
-- organisateur + image d'arrière-plan (stade), au lieu du billet thermique
-- compact standard. QR code et numéro de série restent inchangés.

ALTER TABLE billeterie
  ADD COLUMN IF NOT EXISTS custom_design boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS organizer_logo_url text,
  ADD COLUMN IF NOT EXISTS background_image_url text;

-- Bucket pour le logo organisateur et l'image d'arrière-plan des billets personnalisés
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'billeterie-assets',
  'billeterie-assets',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

-- Upload réservé aux rôles qui peuvent créer une billetterie
DROP POLICY IF EXISTS "billeterie creators upload billeterie assets" ON storage.objects;
CREATE POLICY "billeterie creators upload billeterie assets" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'billeterie-assets'
    AND get_user_role() IN ('super_admin', 'president_odcav', 'tresorier', 'fondateur', 'admin_zone')
  );

DROP POLICY IF EXISTS "billeterie creators update billeterie assets" ON storage.objects;
CREATE POLICY "billeterie creators update billeterie assets" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'billeterie-assets'
    AND get_user_role() IN ('super_admin', 'president_odcav', 'tresorier', 'fondateur', 'admin_zone')
  );

-- Lecture publique (nécessaire pour les afficher dans les PDF générés)
DROP POLICY IF EXISTS "public read billeterie assets" ON storage.objects;
CREATE POLICY "public read billeterie assets" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'billeterie-assets');
