-- 174_rpc_create_reservation_sqlstate_codes.sql
-- PUB-007: switch rpc_create_reservation sentinel matching from
-- error.message substring to SQLSTATE codes.
--
-- Backstory: the JS caller (src/app/[locale]/reserve/actions.ts)
-- discriminates conflict/invalid_phone/invalid_party_size by
-- substring-matching error.message. Future RPC refactors that wrap
-- error context would silently degrade to the generic server_error
-- branch. Pin each sentinel to a distinct SQLSTATE in class KH so
-- the caller can switch on error.code instead.
--
-- Class "KH" is not used by Postgres or any extension we install
-- (verified against migrations 000–173). MESSAGE text is preserved
-- so existing log/Sentry lines stay readable.
--
-- SAFE TO RE-RUN (CREATE OR REPLACE).

CREATE OR REPLACE FUNCTION rpc_create_reservation(
  p_branch_id        TEXT,
  p_guest_name       TEXT,
  p_phone            TEXT,
  p_party_size       INT,
  p_reserved_for     TIMESTAMPTZ,
  p_duration_minutes INT     DEFAULT 90,
  p_table_id         UUID    DEFAULT NULL,
  p_special_requests TEXT    DEFAULT NULL,
  p_source           TEXT    DEFAULT 'staff',
  p_seating_type     TEXT    DEFAULT NULL
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
BEGIN
  v_caller_uid := auth.uid();
  IF auth.role() <> 'service_role' THEN
    IF v_caller_uid IS NULL THEN
      RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = 'KH001';
    END IF;
    v_role   := auth_user_role();
    v_branch := auth_user_branch_id();
    IF v_role IS NULL THEN
      RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = 'KH001';
    END IF;
    IF v_role NOT IN ('owner', 'general_manager', 'branch_manager', 'cashier', 'waiter') THEN
      RAISE EXCEPTION 'FORBIDDEN_ROLE' USING ERRCODE = 'KH002';
    END IF;
    IF v_role NOT IN ('owner', 'general_manager') AND v_branch <> p_branch_id THEN
      RAISE EXCEPTION 'FORBIDDEN_BRANCH_SCOPE' USING ERRCODE = 'KH003';
    END IF;
  END IF;

  IF p_guest_name IS NULL OR char_length(btrim(p_guest_name)) = 0 THEN
    RAISE EXCEPTION 'INVALID_GUEST_NAME' USING ERRCODE = 'KH004';
  END IF;
  IF p_phone IS NULL
     OR char_length(btrim(p_phone)) < 7
     OR char_length(btrim(p_phone)) > 30 THEN
    RAISE EXCEPTION 'INVALID_PHONE' USING ERRCODE = 'KH005';
  END IF;
  IF p_party_size IS NULL OR p_party_size < 1 OR p_party_size > 50 THEN
    RAISE EXCEPTION 'INVALID_PARTY_SIZE' USING ERRCODE = 'KH006';
  END IF;
  IF p_duration_minutes IS NULL OR p_duration_minutes < 30 OR p_duration_minutes > 300 THEN
    RAISE EXCEPTION 'INVALID_DURATION' USING ERRCODE = 'KH007';
  END IF;
  IF p_reserved_for IS NULL THEN
    RAISE EXCEPTION 'INVALID_RESERVED_FOR' USING ERRCODE = 'KH008';
  END IF;
  IF p_source NOT IN ('website', 'phone', 'walk_in', 'staff') THEN
    RAISE EXCEPTION 'INVALID_SOURCE' USING ERRCODE = 'KH009';
  END IF;
  IF p_seating_type IS NOT NULL AND p_seating_type NOT IN ('family_section', 'arabic_seating', 'outdoor', 'indoor') THEN
    RAISE EXCEPTION 'INVALID_SEATING_TYPE' USING ERRCODE = 'KH010';
  END IF;

  v_window_end := p_reserved_for + (p_duration_minutes || ' minutes')::INTERVAL;

  IF p_table_id IS NOT NULL THEN
    SELECT branch_id, is_active
      INTO v_table_branch, v_table_active
    FROM   restaurant_tables
    WHERE  id = p_table_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'TABLE_NOT_FOUND' USING ERRCODE = 'KH011';
    END IF;
    IF v_table_branch <> p_branch_id THEN
      RAISE EXCEPTION 'TABLE_BRANCH_MISMATCH' USING ERRCODE = 'KH012';
    END IF;
    IF NOT v_table_active THEN
      RAISE EXCEPTION 'TABLE_INACTIVE' USING ERRCODE = 'KH013';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM   reservations r
      WHERE  r.table_id = p_table_id
        AND  r.status IN ('pending', 'confirmed', 'seated')
        AND  r.reserved_for < v_window_end
        AND  (r.reserved_for + (r.duration_minutes || ' minutes')::INTERVAL) > p_reserved_for
    ) THEN
      RAISE EXCEPTION 'RESERVATION_CONFLICT' USING ERRCODE = 'KH014';
    END IF;
  END IF;

  INSERT INTO reservations (
    branch_id, table_id, guest_name, phone, party_size,
    reserved_for, duration_minutes, status, source,
    special_requests, created_by, seating_type
  ) VALUES (
    p_branch_id, p_table_id, btrim(p_guest_name), btrim(p_phone), p_party_size,
    p_reserved_for, p_duration_minutes, 'pending', p_source,
    NULLIF(btrim(COALESCE(p_special_requests, '')), ''), v_caller_uid, p_seating_type
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- GRANTs unchanged from migration 117. CREATE OR REPLACE preserves
-- existing privileges, so no REVOKE/GRANT needed here.
