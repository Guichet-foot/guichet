-- Créer le bucket card-photos s'il n'existe pas encore
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'card-photos',
  'card-photos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Permettre aux utilisateurs authentifiés d'uploader des photos de carte
CREATE POLICY IF NOT EXISTS "auth upload card photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'card-photos');

-- Accès public en lecture
CREATE POLICY IF NOT EXISTS "public read card photos"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'card-photos');

-- Permettre la suppression par l'uploader
CREATE POLICY IF NOT EXISTS "auth delete own card photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'card-photos' AND auth.uid() = owner);
