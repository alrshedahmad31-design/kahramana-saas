-- Preserve customer per-item instructions for kitchen and customer order views.

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS notes TEXT;
