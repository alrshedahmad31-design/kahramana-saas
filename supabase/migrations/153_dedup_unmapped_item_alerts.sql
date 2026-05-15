-- ============================================================
-- Kahramana Baghdad
-- Migration: 153_dedup_unmapped_item_alerts.sql
--
-- Probe (session 120): inventory_alerts has 364 'unmapped_item' rows,
-- 158 still unread, generated over 12 days from 165 distinct menu slugs.
-- Root cause: `recipes` table is empty (0 rows) because chef-supplied
-- Excel template (Phase 3 deliverable) is still pending. The trigger
-- fn_inventory_reserve correctly emits an alert for every order line
-- with no recipe link, but with no dedup it floods ~30 alerts/day.
--
-- This migration:
--   1. Adds a 24h dedup guard inside fn_inventory_reserve so the same
--      unmapped slug is only alerted once per day (global, not
--      branch-scoped — unmapped_item is a menu property, not branch-
--      specific).
--   2. Adds a functional index supporting the dedup EXISTS lookup.
--   3. Bulk-marks the existing 158 unread alerts as read so the ops
--      banner stops surfacing them; new alerts (1/day per slug) will
--      surface naturally.
--
-- The trigger still works correctly once recipes are populated — the
-- dedup only short-circuits the alert INSERT, not the inventory
-- deduction path (which only fires when v_has_recipe = true anyway).
-- ============================================================

-- ── 1. Replace fn_inventory_reserve with dedup gate ─────────────────────────

CREATE OR REPLACE FUNCTION public.fn_inventory_reserve()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $function$
DECLARE
  v_branch_id   TEXT;
  v_required    NUMERIC(14,4);
  v_has_recipe  BOOLEAN := FALSE;
  rec           RECORD;
BEGIN
  SELECT branch_id INTO v_branch_id
  FROM orders WHERE id = NEW.order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND' USING ERRCODE = 'P0003';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM recipes WHERE menu_item_slug = NEW.menu_item_slug
  ) INTO v_has_recipe;

  IF NOT v_has_recipe THEN
    -- 24h dedup gate: only one alert per unmapped slug per day, regardless of
    -- branch. unmapped_item is a property of the menu (recipe missing for slug X)
    -- not the branch. Cuts the ~30/day noise floor to 1/day per unique slug.
    IF NOT EXISTS (
      SELECT 1 FROM inventory_alerts
      WHERE alert_type = 'unmapped_item'
        AND metadata->>'menu_item_slug' = NEW.menu_item_slug
        AND created_at > NOW() - INTERVAL '24 hours'
    ) THEN
      INSERT INTO inventory_alerts (branch_id, alert_type, severity, message, metadata)
      VALUES (
        v_branch_id, 'unmapped_item', 'info',
        'No recipe mapped for: ' || NEW.menu_item_slug,
        jsonb_build_object('menu_item_slug', NEW.menu_item_slug, 'order_id', NEW.order_id)
      );
    END IF;
    RETURN NEW;
  END IF;

  FOR rec IN
    -- Direct ingredients
    SELECT
      r.ingredient_id,
      r.quantity
        * COALESCE(r.yield_factor, i.default_yield_factor, 1.000)
        AS qty_per_unit
    FROM recipes r
    JOIN ingredients i ON i.id = r.ingredient_id
    WHERE r.menu_item_slug = NEW.menu_item_slug
      AND r.ingredient_id IS NOT NULL

    UNION ALL

    -- Prep-item ingredients (expanded)
    SELECT
      pii.ingredient_id,
      (r.quantity * COALESCE(r.yield_factor, 1.000))
        * (pii.quantity * COALESCE(pii.yield_factor, ing.default_yield_factor, 1.000))
        / NULLIF(p.batch_yield_qty, 0)
        AS qty_per_unit
    FROM recipes r
    JOIN prep_items p ON p.id = r.prep_item_id
    JOIN prep_item_ingredients pii ON pii.prep_item_id = p.id
    JOIN ingredients ing ON ing.id = pii.ingredient_id
    WHERE r.menu_item_slug = NEW.menu_item_slug
      AND r.prep_item_id IS NOT NULL
  LOOP
    v_required := rec.qty_per_unit * NEW.quantity;

    UPDATE inventory_stock
    SET
      reserved         = reserved + v_required,
      last_movement_at = NOW()
    WHERE branch_id     = v_branch_id
      AND ingredient_id = rec.ingredient_id
      AND (on_hand - reserved - catering_reserved) >= v_required;

    IF NOT FOUND THEN
      IF EXISTS (
        SELECT 1 FROM inventory_stock
        WHERE branch_id = v_branch_id AND ingredient_id = rec.ingredient_id
      ) THEN
        RAISE EXCEPTION 'INSUFFICIENT_STOCK' USING ERRCODE = 'P0001';
      ELSE
        RAISE EXCEPTION 'MISSING_STOCK_RECORD' USING ERRCODE = 'P0002';
      END IF;
    END IF;

    INSERT INTO inventory_movements (
      branch_id, ingredient_id, movement_type, quantity,
      order_id, order_item_id, performed_at
    ) VALUES (
      v_branch_id, rec.ingredient_id, 'reservation', v_required,
      NEW.order_id, NEW.id, NOW()
    );
  END LOOP;

  RETURN NEW;
END;
$function$;

-- ── 2. Functional index supporting the dedup EXISTS lookup ──────────────────

CREATE INDEX IF NOT EXISTS idx_inventory_alerts_unmapped_dedup
  ON public.inventory_alerts ((metadata->>'menu_item_slug'), created_at DESC)
  WHERE alert_type = 'unmapped_item';

-- ── 3. One-time cleanup: mark the 158 existing unread alerts as read ────────

UPDATE public.inventory_alerts
SET is_read = true
WHERE alert_type = 'unmapped_item'
  AND is_read = false;

-- ── Rollback (manual) ────────────────────────────────────────────────────────
--
-- To revert the trigger to its pre-153 body, run the CREATE OR REPLACE block
-- from migration 035_inventory_core.sql (lines ~571-668) — the only delta in
-- this migration is the 24h dedup IF wrapper around the INSERT.
--
-- DROP INDEX IF EXISTS public.idx_inventory_alerts_unmapped_dedup;
-- (The mark-read on existing rows is not reversible without an audit trail;
--  the rows themselves remain in the table.)
