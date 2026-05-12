-- ============================================================
-- 115_delivery_proof.sql
-- Delivery Proof system: storage and column for photo evidence.
-- ============================================================

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS delivery_proof_url TEXT;

-- ── Storage bucket ───────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'delivery-proofs',
  'delivery-proofs', 
  false,
  5242880,  -- 5MB max
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ── Storage RLS ──────────────────────────────────────────────

-- 1. السائق يرفع فقط لطلباته
-- We use assigned_driver_id to match the existing schema (reconciled in audit).
DROP POLICY IF EXISTS "driver_upload_own_proof" ON storage.objects;
CREATE POLICY "driver_upload_own_proof" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'delivery-proofs' AND
    EXISTS (
      SELECT 1 FROM orders o
      JOIN staff_basic s ON s.id = auth.uid()
      WHERE o.id::text = split_part(name, '/', 1)
      AND o.assigned_driver_id = s.id
      AND s.role = 'driver'
    )
  );

-- 2. Manager يقرأ
DROP POLICY IF EXISTS "manager_read_proofs" ON storage.objects;
CREATE POLICY "manager_read_proofs" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'delivery-proofs' AND
    EXISTS (
      SELECT 1 FROM staff_basic
      WHERE id = auth.uid()
      AND role IN ('owner','general_manager','branch_manager')
    )
  );

GRANT ALL ON orders TO authenticated;
