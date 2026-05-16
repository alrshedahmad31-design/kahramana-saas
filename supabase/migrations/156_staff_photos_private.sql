-- VULN-010: Staff photo bucket contains PII (faces of named employees) and
-- must not be world-readable. Switch the storage bucket from public to
-- private and replace the public-SELECT policy with an authenticated-only
-- SELECT policy. Application code (StaffFormWizard upload + staff list
-- render) is updated in the same change to use createSignedUrl(60-min TTL)
-- instead of getPublicUrl. Existing rows in staff_basic.profile_photo_url
-- may still hold legacy public URLs; the resolver helper extracts the
-- storage path and signs it on read, so no data migration is needed.

-- ── Flip bucket visibility ───────────────────────────────────────────────────
UPDATE storage.buckets
SET    public = false
WHERE  id = 'staff-photos';

-- ── Drop the public-SELECT policy ────────────────────────────────────────────
-- The original policy in migration 026 was named "Staff photos are public".
DROP POLICY IF EXISTS "Staff photos are public" ON storage.objects;

-- ── Authenticated-only SELECT policy ─────────────────────────────────────────
-- Anyone signed in (staff dashboard, driver app) can read staff photos via
-- the signed-URL flow; anonymous (customer-facing site) cannot.
DROP POLICY IF EXISTS "Authenticated users can read staff photos" ON storage.objects;
CREATE POLICY "Authenticated users can read staff photos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'staff-photos');
