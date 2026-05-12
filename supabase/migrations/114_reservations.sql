-- ============================================================
-- 114_reservations.sql
-- Reservations / advance booking system.
--
-- Adds:
--   1. reservations              — table+window registry for advance bookings
--   2. trg_reservations_updated_at
--   3. rpc_find_available_tables — returns candidate tables for a given window
--   4. rpc_create_reservation    — guarded insert with conflict check
--   5. RLS policies (read/insert/update branch-scoped; delete owner/GM)
--   6. Realtime publication for live calendar updates
--
-- Patterns reused:
--   - branches.id is TEXT (memory: feedback_rpc_create_order_signature)
--   - auth_user_role() / auth_user_branch_id() helpers (added in 046)
--   - updated_at trigger pattern (085)
--   - Bahrain phone regex '^\+973[0-9]{8}$' (099)
--
-- SAFE TO RE-RUN.
-- ============================================================

-- ── 1. reservations ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS reservations (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id         TEXT         NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  table_id          UUID         REFERENCES restaurant_tables(id) ON DELETE SET NULL,
  guest_name        TEXT         NOT NULL CHECK (char_length(guest_name) BETWEEN 1 AND 120),
  phone             TEXT         NOT NULL CHECK (phone ~ '^\+973[0-9]{8}$'),
  party_size        SMALLINT     NOT NULL CHECK (party_size BETWEEN 1 AND 50),
  reserved_for      TIMESTAMPTZ  NOT NULL,
  duration_minutes  INT          NOT NULL DEFAULT 90
                                   CHECK (duration_minutes BETWEEN 30 AND 300),
  status            TEXT         NOT NULL DEFAULT 'pending'
                                   CHECK (status IN
                                     ('pending','confirmed','seated','no_show','cancelled','completed')),
  source            TEXT         NOT NULL DEFAULT 'staff'
                                   CHECK (source IN ('website','phone','walk_in','staff')),
  special_requests  TEXT,
  confirmed_at      TIMESTAMPTZ,
  seated_at         TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  cancelled_at      TIMESTAMPTZ,
  created_by        UUID         REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── 2. Indexes ─────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_reservations_branch_reserved_for
  ON reservations (branch_id, reserved_for);

CREATE INDEX IF NOT EXISTS idx_reservations_branch_status
  ON reservations (branch_id, status);

CREATE INDEX IF NOT EXISTS idx_reservations_table_reserved_for
  ON reservations (table_id, reserved_for)
  WHERE table_id IS NOT NULL;

-- ── 3. updated_at trigger ──────────────────────────────────────

CREATE OR REPLACE FUNCTION reservations_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reservations_updated_at ON reservations;
CREATE TRIGGER trg_reservations_updated_at
  BEFORE UPDATE ON reservations
  FOR EACH ROW EXECUTE FUNCTION reservations_set_updated_at();

-- ── 4. RLS policies ────────────────────────────────────────────

ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

-- SELECT: owner/GM see all branches; everyone else scoped to own branch.
DROP POLICY IF EXISTS "reservations_select_staff" ON reservations;
CREATE POLICY "reservations_select_staff"
  ON reservations FOR SELECT TO authenticated
  USING (
    auth_user_role() IN ('owner', 'general_manager')
    OR branch_id = auth_user_branch_id()
  );

-- INSERT: cashier+ (owner / GM / branch_manager / cashier / waiter).
-- Branch-scoped: non-globals can only insert for their own branch.
DROP POLICY IF EXISTS "reservations_insert_staff" ON reservations;
CREATE POLICY "reservations_insert_staff"
  ON reservations FOR INSERT TO authenticated
  WITH CHECK (
    (
      auth_user_role() IN ('owner', 'general_manager')
    )
    OR (
      auth_user_role() IN ('branch_manager', 'cashier', 'waiter')
      AND branch_id = auth_user_branch_id()
    )
  );

-- UPDATE: cashier+, branch-scoped.
DROP POLICY IF EXISTS "reservations_update_staff" ON reservations;
CREATE POLICY "reservations_update_staff"
  ON reservations FOR UPDATE TO authenticated
  USING (
    auth_user_role() IN ('owner', 'general_manager')
    OR (
      auth_user_role() IN ('branch_manager', 'cashier', 'waiter')
      AND branch_id = auth_user_branch_id()
    )
  )
  WITH CHECK (
    auth_user_role() IN ('owner', 'general_manager')
    OR (
      auth_user_role() IN ('branch_manager', 'cashier', 'waiter')
      AND branch_id = auth_user_branch_id()
    )
  );

-- DELETE: owner/GM only.
DROP POLICY IF EXISTS "reservations_delete_owner_gm" ON reservations;
CREATE POLICY "reservations_delete_owner_gm"
  ON reservations FOR DELETE TO authenticated
  USING (auth_user_role() IN ('owner', 'general_manager'));

-- ── 5. rpc_find_available_tables ───────────────────────────────
-- Returns tables in the given branch that:
--   - have capacity >= p_party_size
--   - are active
--   - have NO 'pending'/'confirmed'/'seated' reservation whose [reserved_for,
--     reserved_for + duration) window overlaps the requested window.
--
-- SECURITY DEFINER so the scan sees all rows regardless of caller RLS,
-- but we re-assert branch scope inside the function so non-global callers
-- can only ask about their own branch.

CREATE OR REPLACE FUNCTION rpc_find_available_tables(
  p_branch_id        TEXT,
  p_party_size       INT,
  p_reserved_for     TIMESTAMPTZ,
  p_duration_minutes INT DEFAULT 90
)
RETURNS TABLE (
  table_id     UUID,
  table_number INT,
  capacity     INT,
  label_ar     TEXT,
  label_en     TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_end TIMESTAMPTZ;
  v_role       TEXT;
  v_branch     TEXT;
BEGIN
  -- Input validation
  IF p_party_size IS NULL OR p_party_size < 1 OR p_party_size > 50 THEN
    RAISE EXCEPTION 'INVALID_PARTY_SIZE';
  END IF;
  IF p_duration_minutes IS NULL OR p_duration_minutes < 30 OR p_duration_minutes > 300 THEN
    RAISE EXCEPTION 'INVALID_DURATION';
  END IF;
  IF p_reserved_for IS NULL THEN
    RAISE EXCEPTION 'INVALID_RESERVED_FOR';
  END IF;

  -- Branch-scope guard: non-globals may only query their own branch.
  -- service_role calls (auth.role() = 'service_role') skip the check.
  IF auth.role() <> 'service_role' THEN
    v_role := auth_user_role();
    v_branch := auth_user_branch_id();
    IF v_role IS NULL THEN
      RAISE EXCEPTION 'AUTH_REQUIRED';
    END IF;
    IF v_role NOT IN ('owner', 'general_manager') AND v_branch <> p_branch_id THEN
      RAISE EXCEPTION 'FORBIDDEN_BRANCH_SCOPE';
    END IF;
  END IF;

  v_window_end := p_reserved_for + (p_duration_minutes || ' minutes')::INTERVAL;

  RETURN QUERY
  SELECT
    rt.id        AS table_id,
    rt.table_number,
    rt.capacity,
    rt.label_ar,
    rt.label_en
  FROM restaurant_tables rt
  WHERE rt.branch_id = p_branch_id
    AND rt.is_active = TRUE
    AND rt.capacity >= p_party_size
    AND NOT EXISTS (
      SELECT 1
      FROM reservations r
      WHERE r.table_id = rt.id
        AND r.status IN ('pending', 'confirmed', 'seated')
        AND r.reserved_for < v_window_end
        AND (r.reserved_for + (r.duration_minutes || ' minutes')::INTERVAL) > p_reserved_for
    )
  ORDER BY rt.capacity ASC, rt.table_number ASC;
END;
$$;

REVOKE EXECUTE ON FUNCTION rpc_find_available_tables(TEXT, INT, TIMESTAMPTZ, INT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION rpc_find_available_tables(TEXT, INT, TIMESTAMPTZ, INT) TO authenticated;

-- ── 6. rpc_create_reservation ──────────────────────────────────
-- Guarded INSERT. If p_table_id is provided, raises RESERVATION_CONFLICT
-- when the [p_reserved_for, p_reserved_for + duration) window overlaps an
-- existing non-cancelled reservation on the same table.
--
-- SECURITY DEFINER so RLS does not double-gate INSERTs that the caller is
-- already authorised for; we explicitly check role + branch inside.

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
  v_id          UUID;
  v_window_end  TIMESTAMPTZ;
  v_role        TEXT;
  v_branch      TEXT;
  v_caller_uid  UUID;
  v_table_branch TEXT;
  v_table_active BOOLEAN;
BEGIN
  -- Auth + role gate
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

  -- Input validation
  IF p_guest_name IS NULL OR char_length(btrim(p_guest_name)) = 0 THEN
    RAISE EXCEPTION 'INVALID_GUEST_NAME';
  END IF;
  IF p_phone IS NULL OR p_phone !~ '^\+973[0-9]{8}$' THEN
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

  -- Table sanity + conflict check (only when a table is specified)
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
    p_branch_id, p_table_id, btrim(p_guest_name), p_phone, p_party_size,
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

-- ── 7. Realtime publication (live calendar updates) ───────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_publication_tables
    WHERE  pubname = 'supabase_realtime'
      AND  schemaname = 'public'
      AND  tablename = 'reservations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE reservations;
  END IF;
END $$;

-- ── 8. Table grants ────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON reservations TO authenticated;

-- ROLLBACK:
-- DROP FUNCTION IF EXISTS rpc_create_reservation(TEXT, TEXT, TEXT, INT, TIMESTAMPTZ, INT, UUID, TEXT, TEXT);
-- DROP FUNCTION IF EXISTS rpc_find_available_tables(TEXT, INT, TIMESTAMPTZ, INT);
-- DROP TABLE IF EXISTS reservations;
-- DROP FUNCTION IF EXISTS reservations_set_updated_at();
