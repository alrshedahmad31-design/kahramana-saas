-- ============================================================
-- 046_security_hardening.sql
-- Closes 4 critical RLS issues found in dashboard audit
-- ============================================================

-- ── C1: business_hours + system_settings (write restricted to owner/GM) ──────

DROP POLICY IF EXISTS "business_hours_write_staff" ON business_hours;
CREATE POLICY "business_hours_write_admin_only"
  ON business_hours FOR ALL TO authenticated
  USING (auth_user_role()::text IN ('owner','general_manager'))
  WITH CHECK (auth_user_role()::text IN ('owner','general_manager'));

DROP POLICY IF EXISTS "system_settings_write_staff" ON system_settings;
CREATE POLICY "system_settings_write_admin_only"
  ON system_settings FOR ALL TO authenticated
  USING (auth_user_role()::text IN ('owner','general_manager'))
  WITH CHECK (auth_user_role()::text IN ('owner','general_manager'));

-- ── C2: purchase_order_items (branch-isolated) ────────────────────────────────

DROP POLICY IF EXISTS "poi_all_authenticated" ON purchase_order_items;
CREATE POLICY "poi_managers_branch_isolated"
  ON purchase_order_items FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM purchase_orders po
      WHERE po.id = purchase_order_items.purchase_order_id
        AND (
          auth_user_role()::text IN ('owner','general_manager')
          OR (auth_user_role()::text IN ('branch_manager','inventory_manager')
              AND po.branch_id = auth_user_branch_id())
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM purchase_orders po
      WHERE po.id = purchase_order_items.purchase_order_id
        AND (
          auth_user_role()::text IN ('owner','general_manager')
          OR (auth_user_role()::text IN ('branch_manager','inventory_manager')
              AND po.branch_id = auth_user_branch_id())
        )
    )
  );

-- ── C3: inventory_stock + inventory_movements (managers only) ─────────────────

DROP POLICY IF EXISTS "stock_insert_authenticated" ON inventory_stock;
CREATE POLICY "stock_insert_managers_only"
  ON inventory_stock FOR INSERT TO authenticated
  WITH CHECK (
    auth_user_role()::text IN ('owner','general_manager')
    OR (auth_user_role()::text IN ('branch_manager','inventory_manager')
        AND branch_id = auth_user_branch_id())
  );

DROP POLICY IF EXISTS "movements_insert_authenticated" ON inventory_movements;
CREATE POLICY "movements_insert_managers_only"
  ON inventory_movements FOR INSERT TO authenticated
  WITH CHECK (
    auth_user_role()::text IN ('owner','general_manager')
    OR (auth_user_role()::text IN ('branch_manager','inventory_manager')
        AND branch_id = auth_user_branch_id())
  );

-- ── C4: SECURITY DEFINER RPCs — restrict to service_role only ────────────────

REVOKE EXECUTE ON FUNCTION rpc_transfer_stock(TEXT,TEXT,UUID,NUMERIC,UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION rpc_inventory_count_submit(UUID,UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION rpc_inventory_count_session_approve(TEXT,TEXT,UUID) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION rpc_transfer_stock(TEXT,TEXT,UUID,NUMERIC,UUID) TO service_role;
GRANT EXECUTE ON FUNCTION rpc_inventory_count_submit(UUID,UUID) TO service_role;
GRANT EXECUTE ON FUNCTION rpc_inventory_count_session_approve(TEXT,TEXT,UUID) TO service_role;

-- ── C5: rpc_receive_purchase_order — add PO scope check ──────────────────────

CREATE OR REPLACE FUNCTION rpc_receive_purchase_order(
  p_po_id UUID,
  p_lines JSONB
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  line JSONB;
  v_item purchase_order_items;
BEGIN
  FOREACH line IN ARRAY (SELECT array_agg(el) FROM jsonb_array_elements(p_lines) el)
  LOOP
    UPDATE purchase_order_items
    SET
      quantity_received = (line->>'quantity_received')::NUMERIC,
      lot_number        = line->>'lot_number',
      expiry_date       = (line->>'expiry_date')::DATE,
      quality_rating    = (line->>'quality_rating')::SMALLINT,
      discrepancy_note  = line->>'discrepancy_note'
    WHERE id = (line->>'id')::UUID
      AND purchase_order_id = p_po_id   -- scope guard (C5 fix)
    RETURNING * INTO v_item;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'PO_LINE_NOT_FOUND_OR_SCOPE_VIOLATION' USING ERRCODE = 'P0001';
    END IF;
  END LOOP;
END;
$$;
