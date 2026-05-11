-- 1. Aggressive Drop for bump_station_order
DO $$ 
DECLARE r RECORD;
BEGIN
    FOR r IN (SELECT oid::regprocedure as proc_name FROM pg_proc WHERE proname = 'bump_station_order') 
    LOOP EXECUTE 'DROP FUNCTION ' || r.proc_name; END LOOP;
END $$;

-- 2. Aggressive Drop for update_order_item_station_status
DO $$ 
DECLARE r RECORD;
BEGIN
    FOR r IN (SELECT oid::regprocedure as proc_name FROM pg_proc WHERE proname = 'update_order_item_station_status') 
    LOOP EXECUTE 'DROP FUNCTION ' || r.proc_name; END LOOP;
END $$;

-- 3. Recreate bump_station_order (TEXT based)
CREATE OR REPLACE FUNCTION bump_station_order(
  p_order_id UUID,
  p_station  TEXT
) RETURNS void AS $$
DECLARE
  v_branch_id TEXT;
  v_caller_branch_id TEXT;
BEGIN
  v_caller_branch_id := (SELECT branch_id FROM staff WHERE id = auth.uid());
  SELECT branch_id INTO v_branch_id FROM orders WHERE id = p_order_id;
  
  IF v_branch_id IS DISTINCT FROM v_caller_branch_id AND v_caller_branch_id IS NOT NULL THEN
    RAISE EXCEPTION 'Unauthorized: Branch mismatch';
  END IF;

  UPDATE order_item_station_status
  SET status = 'completed', bumped_at = NOW()
  WHERE order_id = p_order_id
    AND station::text = p_station
    AND status != 'completed';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Recreate update_order_item_station_status (TEXT based)
CREATE OR REPLACE FUNCTION update_order_item_station_status(
  p_order_id        UUID,
  p_item_id         UUID,
  p_station         TEXT,
  p_status          TEXT,
  p_expected_status TEXT DEFAULT NULL
) RETURNS void AS $$
DECLARE
  v_branch_id TEXT;
  v_caller_branch_id TEXT;
BEGIN
  v_caller_branch_id := (SELECT branch_id FROM staff WHERE id = auth.uid());
  SELECT branch_id INTO v_branch_id FROM orders WHERE id = p_order_id;
  
  IF v_branch_id IS DISTINCT FROM v_caller_branch_id AND v_caller_branch_id IS NOT NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE order_item_station_status
  SET status = p_status::kds_item_status
  WHERE item_id = p_item_id
    AND station::text = p_station
    AND (p_expected_status IS NULL OR status::text = p_expected_status);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
