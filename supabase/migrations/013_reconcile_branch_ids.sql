-- ============================================================
-- Kahramana Baghdad — Reconcile branch IDs
-- Migration: 013_reconcile_branch_ids.sql
-- Applied: 2026-04-28
--
-- PURPOSE:
--   Older environments seeded Qallali as branch id 'muharraq'.
--   Current application code uses the canonical contact IDs:
--   'riffa' | 'qallali' | 'badi'.
--
-- SAFE TO RE-RUN: uses UPSERT and idempotent UPDATEs.
-- ============================================================

INSERT INTO branches (id, name_ar, name_en, phone, whatsapp, wa_link, maps_url, is_active)
VALUES
  (
    'riffa',
    'فرع الرفاع',
    'Riffa Branch',
    '+97317131413',
    '+97317131413',
    'https://wa.me/97317131413',
    'https://maps.app.goo.gl/J3CMk9AnhSqSBsGQA',
    true
  ),
  (
    'qallali',
    'فرع قلالي',
    'Qallali Branch',
    '+97317131213',
    '+97317131213',
    'https://wa.me/97317131213',
    'https://maps.app.goo.gl/cVsYGpibZxy2rPEV8',
    true
  ),
  (
    'badi',
    'فرع البديع',
    'Al-Badi'' Branch',
    '',
    '',
    '',
    NULL,
    false
  )
ON CONFLICT (id) DO UPDATE SET
  name_ar   = EXCLUDED.name_ar,
  name_en   = EXCLUDED.name_en,
  phone     = EXCLUDED.phone,
  whatsapp  = EXCLUDED.whatsapp,
  wa_link   = EXCLUDED.wa_link,
  maps_url  = EXCLUDED.maps_url,
  is_active = EXCLUDED.is_active;

UPDATE orders
SET branch_id = 'qallali'
WHERE branch_id = 'muharraq';

UPDATE staff_basic
SET branch_id = 'qallali'
WHERE branch_id = 'muharraq';

UPDATE contact_messages
SET branch_id = 'qallali'
WHERE branch_id = 'muharraq';

UPDATE branches
SET is_active = false
WHERE id = 'muharraq';

-- ── ROLLBACK ──────────────────────────────────────────────────────────────────
-- UPDATE branches SET is_active = true WHERE id = 'muharraq';
-- UPDATE orders SET branch_id = 'muharraq' WHERE branch_id = 'qallali';
-- UPDATE staff_basic SET branch_id = 'muharraq' WHERE branch_id = 'qallali';
-- UPDATE contact_messages SET branch_id = 'muharraq' WHERE branch_id = 'qallali';
