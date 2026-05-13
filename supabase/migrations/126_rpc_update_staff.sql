-- Atomic staff update to eliminate TOCTOU between the read (permission check)
-- and write (UPDATE) in updateStaff(). Accepts only the three fields that
-- updateStaff() currently mutates; caller must hold service_role.
CREATE OR REPLACE FUNCTION rpc_update_staff(
  p_id        UUID,
  p_name      TEXT,
  p_role      staff_role,
  p_branch_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_rows INT;
BEGIN
  UPDATE staff_basic
  SET
    name      = p_name,
    role      = p_role,
    branch_id = p_branch_id
  WHERE id = p_id;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RAISE EXCEPTION 'staff_not_found: %', p_id;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION rpc_update_staff(UUID, TEXT, staff_role, TEXT)
  FROM PUBLIC;

GRANT EXECUTE ON FUNCTION rpc_update_staff(UUID, TEXT, staff_role, TEXT)
  TO service_role;
