-- ============================================================
-- 116_reservations_phone_international.sql
-- Relax phone format on reservations to support international guests.
--
-- Two changes:
--   1. Column CHECK: from '^\+973[0-9]{8}$' to char_length BETWEEN 7 AND 30
--   2. rpc_create_reservation phone validation: same relaxation (without
--      this, the RPC still rejects non-Bahrain numbers even though the
--      table accepts them, blocking every booking path that goes through
--      the RPC — which is all of them today).
--
-- Filename uses 116 (not 115) because 115_delivery_proof.sql already
-- exists on disk; bumping avoids a duplicate-key collision in
-- schema_migrations and on disk.
--
-- SAFE TO RE-RUN.
-- ============================================================

-- ── 1. Column CHECK ────────────────────────────────────────────

ALTER TABLE reservations
  DROP CONSTRAINT IF EXISTS reservations_phone_check;

ALTER TABLE reservations
  ADD CONSTRAINT reservations_phone_check
  CHECK (char_length(phone) BETWEEN 7 AND 30);

-- ── 2. rpc_create_reservation — relax phone validation ────────
-- Same signature and behaviour as 114; the only line that changes is the
-- phone regex check, which is now a length-range check.

CREATE OR REPLACE FUNCTION rpc_create_reservation(
  p_branch_id        TEXT,
  p_guest_name       TEXT,
  p_phone            TEXT,
  p_party_size       INT,
  p_reserved_for     TIMESTAMPTZ,
  p_duration_minutes INT     DEFAULT 90,
  p_table_id         UUID    DEFAULT NULL,
  p_special_requests TEXT    DEFAULT NULL,
  p_source           TEXT    DEFAULT 'staff'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id           UUID;
  v_window_end   TIMESTAMPTZ;
  v_role         TEXT;
  v_branch       TEXT;
  v_caller_uid   UUID;
  v_table_branch TEXT;
  v_table_active BOOLEAN;
  v_phone_len    INT;
BEGIN
  v_caller_uid := auth.uid();
  IF auth.role() <> 'service_role' THEN
    IF v_caller_uid IS NULL THEN
      RAISE EXCEPTION 'AUTH_REQUIRED';
    END IF;
    v_role   := auth_user_role();
    v_branch := auth_user_branch_id();
    IF v_role IS NULL THEN
      RAISE EXCEPTION 'AUTH_REQUIRED';
    END IF;
    IF v_role NOT IN ('owner', 'general_manager', 'branch_manager', 'cashier', 'waiter') THEN
      RAISE EXCEPTION 'FORBIDDEN_ROLE';
    END IF;
    IF v_role NOT IN ('owner', 'general_manager') AND v_branch <> p_branch_id THEN
      RAISE EXCEPTION 'FORBIDDEN_BRANCH_SCOPE';
    END IF;
  END IF;

  IF p_guest_name IS NULL OR char_length(btrim(p_guest_name)) = 0 THEN
    RAISE EXCEPTION 'INVALID_GUEST_NAME';
  END IF;

  -- Relaxed phone check: any 7-30 character string (international support).
  v_phone_len := char_length(COALESCE(btrim(p_phone), ''));
  IF p_phone IS NULL OR v_phone_len < 7 OR v_phone_len > 30 THEN
    RAISE EXCEPTION 'INVALID_PHONE';
  END IF;

  IF p_party_size IS NULL OR p_party_size < 1 OR p_party_size > 50 THEN
    RAISE EXCEPTION 'INVALID_PARTY_SIZE';
  END IF;
  IF p_duration_minutes IS NULL OR p_duration_minutes < 30 OR p_duration_minutes > 300 THEN
    RAISE EXCEPTION 'INVALID_DURATION';
  END IF;
  IF p_reserved_for IS NULL THEN
    RAISE EXCEPTION 'INVALID_RESERVED_FOR';
  END IF;
  IF p_source NOT IN ('website', 'phone', 'walk_in', 'staff') THEN
    RAISE EXCEPTION 'INVALID_SOURCE';
  END IF;

  v_window_end := p_reserved_for + (p_duration_minutes || ' minutes')::INTERVAL;

  IF p_table_id IS NOT NULL THEN
    SELECT branch_id, is_active
      INTO v_table_branch, v_table_active
    FROM   restaurant_tables
    WHERE  id = p_table_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'TABLE_NOT_FOUND';
    END IF;
    IF v_table_branch <> p_branch_id THEN
      RAISE EXCEPTION 'TABLE_BRANCH_MISMATCH';
    END IF;
    IF NOT v_table_active THEN
      RAISE EXCEPTION 'TABLE_INACTIVE';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM   reservations r
      WHERE  r.table_id = p_table_id
        AND  r.status IN ('pending', 'confirmed', 'seated')
        AND  r.reserved_for < v_window_end
        AND  (r.reserved_for + (r.duration_minutes || ' minutes')::INTERVAL) > p_reserved_for
    ) THEN
      RAISE EXCEPTION 'RESERVATION_CONFLICT';
    END IF;
  END IF;

  INSERT INTO reservations (
    branch_id, table_id, guest_name, phone, party_size,
    reserved_for, duration_minutes, status, source,
    special_requests, created_by
  ) VALUES (
    p_branch_id, p_table_id, btrim(p_guest_name), btrim(p_phone), p_party_size,
    p_reserved_for, p_duration_minutes, 'pending', p_source,
    NULLIF(btrim(COALESCE(p_special_requests, '')), ''), v_caller_uid
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION rpc_create_reservation(
  TEXT, TEXT, TEXT, INT, TIMESTAMPTZ, INT, UUID, TEXT, TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION rpc_create_reservation(
  TEXT, TEXT, TEXT, INT, TIMESTAMPTZ, INT, UUID, TEXT, TEXT
) TO authenticated;
