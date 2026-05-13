-- 123_rpc_record_opening_balance.sql
-- Atomic opening-balance: writes inventory_movements + inventory_stock
-- in a single transaction. Replaces the two-step pattern in
-- src/app/[locale]/dashboard/inventory/stock/[branchId]/actions.ts that
-- could leave a phantom movement row if the stock upsert failed.

CREATE OR REPLACE FUNCTION rpc_record_opening_balance(
  p_branch_id     TEXT,
  p_ingredient_id UUID,
  p_quantity      NUMERIC,
  p_performed_by  UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_previous_on_hand NUMERIC;
  v_delta            NUMERIC;
BEGIN
  IF p_quantity < 0 THEN
    RAISE EXCEPTION 'QUANTITY_NEGATIVE' USING ERRCODE = '22023';
  END IF;

  SELECT on_hand INTO v_previous_on_hand
  FROM inventory_stock
  WHERE branch_id = p_branch_id AND ingredient_id = p_ingredient_id;

  v_previous_on_hand := COALESCE(v_previous_on_hand, 0);
  v_delta := p_quantity - v_previous_on_hand;

  -- No-op if no change.
  IF v_delta = 0 THEN
    RETURN;
  END IF;

  INSERT INTO inventory_movements (
    branch_id, ingredient_id, movement_type, quantity, performed_by, performed_at, notes
  ) VALUES (
    p_branch_id, p_ingredient_id, 'opening_balance', v_delta, p_performed_by, NOW(),
    'Opening balance: ' || v_previous_on_hand::text || ' → ' || p_quantity::text
  );

  INSERT INTO inventory_stock (
    branch_id, ingredient_id, on_hand, reserved, catering_reserved, last_movement_at
  ) VALUES (
    p_branch_id, p_ingredient_id, p_quantity, 0, 0, NOW()
  )
  ON CONFLICT (branch_id, ingredient_id) DO UPDATE SET
    on_hand           = EXCLUDED.on_hand,
    reserved          = EXCLUDED.reserved,
    catering_reserved = EXCLUDED.catering_reserved,
    last_movement_at  = EXCLUDED.last_movement_at;
END;
$$;

-- Branch-scope auth happens in the calling server action via
-- assertInventoryWriteAccess. Service-role only — clients must not bypass.
REVOKE ALL ON FUNCTION rpc_record_opening_balance(TEXT, UUID, NUMERIC, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION rpc_record_opening_balance(TEXT, UUID, NUMERIC, UUID) TO service_role;
