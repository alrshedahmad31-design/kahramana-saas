-- ============================================================
-- Kahramana Baghdad — Inventory: treat 'returned' as consumption
-- Migration: 057_inventory_returned_fix.sql
--
-- F&B rule: a returned order means food was already prepared.
-- Raw materials are NOT restored. 'returned' = consumption, not release.
--
-- Before this fix: trigger WHEN clause excluded 'returned' entirely,
-- leaving reservation rows dangling and understating available stock.
-- ============================================================

-- Replace function: add 'returned' to the consumption branch
CREATE OR REPLACE FUNCTION fn_inventory_finalize_or_release()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_type  inventory_movement_type;
  rec     RECORD;
BEGIN
  -- delivered / completed / returned → food was prepared, deduct on_hand
  -- cancelled                        → food never made, release reservation only
  IF NEW.status IN ('delivered', 'completed', 'returned') THEN
    v_type := 'consumption';
  ELSE
    v_type := 'release';
  END IF;

  FOR rec IN
    SELECT ingredient_id, SUM(quantity) AS total_qty
    FROM inventory_movements
    WHERE order_id     = NEW.id
      AND movement_type = 'reservation'
    GROUP BY ingredient_id
  LOOP
    IF v_type = 'consumption' THEN
      UPDATE inventory_stock
      SET
        reserved         = GREATEST(0, reserved - rec.total_qty),
        on_hand          = GREATEST(0, on_hand  - rec.total_qty),
        last_movement_at = NOW()
      WHERE branch_id     = NEW.branch_id
        AND ingredient_id = rec.ingredient_id;
    ELSE
      -- release: free the reservation without touching on_hand
      UPDATE inventory_stock
      SET
        reserved         = GREATEST(0, reserved - rec.total_qty),
        last_movement_at = NOW()
      WHERE branch_id     = NEW.branch_id
        AND ingredient_id = rec.ingredient_id;
    END IF;

    INSERT INTO inventory_movements (
      branch_id, ingredient_id, movement_type, quantity, order_id, performed_at
    ) VALUES (
      NEW.branch_id, rec.ingredient_id, v_type, rec.total_qty, NEW.id, NOW()
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- Recreate trigger with 'returned' included in WHEN clause
DROP TRIGGER IF EXISTS trg_inventory_finalize ON orders;
CREATE TRIGGER trg_inventory_finalize
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  WHEN (
    NEW.status IN ('delivered', 'completed', 'cancelled', 'returned')
    AND NEW.status IS DISTINCT FROM OLD.status
  )
  EXECUTE FUNCTION fn_inventory_finalize_or_release();
