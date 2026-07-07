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

-- Policies (DROP avant CREATE pour éviter les doublons)
DROP POLICY IF EXISTS "auth upload card photos" ON storage.objects;
CREATE POLICY "auth upload card photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'card-photos');

DROP POLICY IF EXISTS "public read card photos" ON storage.objects;
CREATE POLICY "public read card photos"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'card-photos');

DROP POLICY IF EXISTS "auth delete own card photos" ON storage.objects;
CREATE POLICY "auth delete own card photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'card-photos' AND auth.uid() = owner);
