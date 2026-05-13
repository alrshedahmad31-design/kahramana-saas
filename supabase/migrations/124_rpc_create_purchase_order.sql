-- 124_rpc_create_purchase_order.sql
-- Atomic PO creation: inserts purchase_orders + all purchase_order_items in
-- one transaction. Replaces the two-step pattern in
-- src/app/[locale]/dashboard/inventory/purchases/actions.ts where a bad
-- items payload could leave an empty PO behind.

CREATE OR REPLACE FUNCTION rpc_create_purchase_order(
  p_supplier_id  UUID,
  p_branch_id    TEXT,
  p_created_by   UUID,
  p_items        JSONB,
  p_expected_at  DATE DEFAULT NULL,
  p_notes        TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_po_id UUID;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'ITEMS_NOT_ARRAY' USING ERRCODE = '22023';
  END IF;

  INSERT INTO purchase_orders (
    supplier_id, branch_id, expected_at, notes, created_by, status
  ) VALUES (
    p_supplier_id, p_branch_id, p_expected_at, p_notes, p_created_by, 'draft'
  )
  RETURNING id INTO v_po_id;

  -- Empty items array is allowed (matches current app behaviour: a draft PO
  -- can be created with no line items yet and edited later).
  IF jsonb_array_length(p_items) > 0 THEN
    INSERT INTO purchase_order_items (
      purchase_order_id, ingredient_id, quantity_ordered, unit_cost,
      lot_number, expiry_date, quantity_received
    )
    SELECT
      v_po_id,
      (elem->>'ingredient_id')::UUID,
      (elem->>'quantity_ordered')::NUMERIC,
      (elem->>'unit_cost')::NUMERIC,
      NULLIF(elem->>'lot_number', ''),
      NULLIF(elem->>'expiry_date', '')::DATE,
      0
    FROM jsonb_array_elements(p_items) AS elem;
  END IF;

  RETURN v_po_id;
END;
$$;

GRANT EXECUTE ON FUNCTION rpc_create_purchase_order(UUID, TEXT, UUID, JSONB, DATE, TEXT) TO service_role;
