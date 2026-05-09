-- ============================================================
-- 081_menu_images_storage.sql
-- Public Supabase Storage bucket for menu item images.
-- Public read, authenticated write. Server actions use the service role
-- (bypasses RLS) but these policies are required for any future direct
-- browser uploads gated by dashboard auth.
-- ============================================================

-- Bucket (idempotent)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'menu-images',
  'menu-images',
  true,
  2 * 1024 * 1024,                                       -- 2 MB
  ARRAY['image/webp', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Public read
DROP POLICY IF EXISTS "menu-images public read" ON storage.objects;
CREATE POLICY "menu-images public read" ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'menu-images');

-- Authenticated writes (server actions run as service role and bypass these)
DROP POLICY IF EXISTS "menu-images authenticated insert" ON storage.objects;
CREATE POLICY "menu-images authenticated insert" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'menu-images');

DROP POLICY IF EXISTS "menu-images authenticated update" ON storage.objects;
CREATE POLICY "menu-images authenticated update" ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'menu-images')
  WITH CHECK (bucket_id = 'menu-images');

DROP POLICY IF EXISTS "menu-images authenticated delete" ON storage.objects;
CREATE POLICY "menu-images authenticated delete" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'menu-images');
