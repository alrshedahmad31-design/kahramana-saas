-- ============================================================
-- Kahramana Baghdad — Menu Items Enhanced Fields
-- Migration: 073_menu_items_enhanced.sql
-- ============================================================

ALTER TABLE menu_items 
ADD COLUMN IF NOT EXISTS description_ar TEXT,
ADD COLUMN IF NOT EXISTS description_en TEXT;

COMMENT ON COLUMN menu_items.description_ar IS 'Item description in Arabic';
COMMENT ON COLUMN menu_items.description_en IS 'Item description in English';
